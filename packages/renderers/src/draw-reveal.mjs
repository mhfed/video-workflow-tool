import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { run } from '../../core/src/process.mjs';
import { probeVideoSize } from '../../core/src/media.mjs';
import { ensureDir, fileExists, sha256 } from '../../core/src/utils.mjs';
import { captionFor, escapeFilterValue, renderCaptionPng, supportsFilter } from './cinematic-broll.mjs';

const IMAGE_EXTENSIONS=new Set(['.png','.jpg','.jpeg']);
const AUDIO_EXTENSIONS=new Set(['.aac','.flac','.m4a','.mp3','.ogg','.wav']);
const defaultHand=fileURLToPath(new URL('../assets/drawing-hand-vi.png',import.meta.url));

function finiteNumber(value,fallback,{min=-Infinity,max=Infinity}={}) {
  const number=Number(value);
  return Number.isFinite(number)&&number>=min&&number<=max?number:fallback;
}

function settingsFor(scene,project) {
  return {...(project?.settings?.drawReveal||{}),...(scene?.drawReveal||{})};
}

function assertRelativeAsset(value,field,sceneId,projectRoot,extensions) {
  if(typeof value!=='string'||!value.trim())throw new Error(`Draw Reveal scene ${sceneId} requires "${field}" with a local project-relative asset path.`);
  if(path.isAbsolute(value))throw new Error(`Draw Reveal scene ${sceneId} field "${field}" must be project-relative, not absolute: ${value}`);
  const root=path.resolve(projectRoot),resolved=path.resolve(root,value);
  if(resolved!==root&&!resolved.startsWith(`${root}${path.sep}`))throw new Error(`Draw Reveal scene ${sceneId} field "${field}" must stay inside the project directory: ${value}`);
  const extension=path.extname(resolved).toLowerCase();
  if(!extensions.has(extension))throw new Error(`Draw Reveal scene ${sceneId} field "${field}" has unsupported extension "${extension||'(none)'}".`);
  if(!fileExists(resolved))throw new Error(`Draw Reveal scene ${sceneId} is missing "${field}" at ${value}. Add the local asset inside the project directory.`);
  return resolved;
}

async function fileIdentity(file) {
  const hash=crypto.createHash('sha256');
  await new Promise((resolve,reject)=>fs.createReadStream(file).on('data',(chunk)=>hash.update(chunk)).on('end',resolve).on('error',reject));
  return hash.digest('hex');
}

function normalizedPath(value,rows=9,bounds={left:.06,right:.94,top:.06,bottom:.94}) {
  if(value!==undefined){
    if(!Array.isArray(value)||value.length<2)throw new Error('Draw Reveal "path" must contain at least two normalized [x, y] points.');
    if(value.length>64)throw new Error('Draw Reveal "path" supports at most 64 points.');
    return value.map((point,index)=>{
      if(!Array.isArray(point)||point.length!==2||!point.every(Number.isFinite)||point.some((number)=>number<0||number>1))throw new Error(`Draw Reveal path point ${index+1} must be [x, y] with values from 0 to 1.`);
      return [point[0],point[1]];
    });
  }
  const count=Math.round(finiteNumber(rows,9,{min:3,max:24})),points=[];
  for(let index=0;index<count;index++){
    const y=bounds.top+(bounds.bottom-bounds.top)*(index/(count-1));
    points.push(index%2===0?[bounds.left,y]:[bounds.right,y]);
  }
  return points;
}

function pathMetrics(points,width,height) {
  const scaled=points.map(([x,y])=>[x*(width-1),y*(height-1)]),segments=[];
  let total=0;
  for(let index=0;index<scaled.length-1;index++){
    const [x1,y1]=scaled[index],[x2,y2]=scaled[index+1],length=Math.hypot(x2-x1,y2-y1);
    if(length>0){segments.push({x1,y1,x2,y2,length,start:total});total+=length;}
  }
  if(!segments.length)throw new Error('Draw Reveal path must contain two distinct points.');
  return {scaled,segments,total};
}

export function drawRevealPath({path:explicitPath,pathRows=9,artworkWidth=null,artworkHeight=null,canvasWidth=null,canvasHeight=null}={}) {
  let bounds;
  if(!explicitPath&&artworkWidth&&artworkHeight&&canvasWidth&&canvasHeight){
    const scale=Math.min(canvasWidth/artworkWidth,canvasHeight/artworkHeight),displayWidth=artworkWidth*scale/canvasWidth,displayHeight=artworkHeight*scale/canvasHeight;
    const insetX=displayWidth*.04,insetY=displayHeight*.04;
    bounds={left:(1-displayWidth)/2+insetX,right:(1+displayWidth)/2-insetX,top:(1-displayHeight)/2+insetY,bottom:(1+displayHeight)/2-insetY};
  }
  return normalizedPath(explicitPath,pathRows,bounds);
}

export function writeRevealSchedule(file,{width,height,path:points}) {
  const longest=Math.max(width,height),scale=Math.min(1,360/longest);
  const maskWidth=Math.max(32,Math.round(width*scale)),maskHeight=Math.max(32,Math.round(height*scale));
  const {segments,total}=pathMetrics(points,maskWidth,maskHeight),pixels=Buffer.alloc(maskWidth*maskHeight),diagonal=Math.hypot(maskWidth,maskHeight);
  for(let y=0;y<maskHeight;y++)for(let x=0;x<maskWidth;x++){
    let closest=Infinity,order=1;
    for(const segment of segments){
      const dx=segment.x2-segment.x1,dy=segment.y2-segment.y1;
      const projection=Math.max(0,Math.min(1,((x-segment.x1)*dx+(y-segment.y1)*dy)/(segment.length*segment.length)));
      const nearX=segment.x1+dx*projection,nearY=segment.y1+dy*projection,distance=Math.hypot(x-nearX,y-nearY);
      if(distance<closest){closest=distance;order=(segment.start+segment.length*projection)/total;}
    }
    const distanceLag=Math.min(.1,closest/diagonal*.5);
    pixels[y*maskWidth+x]=Math.round(Math.min(1,order*.9+distanceLag)*255);
  }
  fs.writeFileSync(file,Buffer.concat([Buffer.from(`P5\n${maskWidth} ${maskHeight}\n255\n`),pixels]));
  return {width:maskWidth,height:maskHeight};
}

function colorValue(value) {
  const text=String(value||'0xFFFFFF').trim();
  return /^(?:0x|#)[0-9a-f]{6}$/i.test(text)?text:'0xFFFFFF';
}

function coordinateExpression(points,axis,width,height,duration) {
  const {scaled,segments,total}=pathMetrics(points,width,height),coordinate=axis==='x'?0:1;
  let expression=String(scaled.at(-1)[coordinate]);
  for(let index=segments.length-1;index>=0;index--){
    const segment=segments[index],start=segment.start/total*duration,end=(segment.start+segment.length)/total*duration;
    const from=axis==='x'?segment.x1:segment.y1,to=axis==='x'?segment.x2:segment.y2;
    expression=`if(lt(t\\,${end.toFixed(6)})\\,${from.toFixed(3)}+${(to-from).toFixed(3)}*(t-${start.toFixed(6)})/${Math.max(.000001,end-start).toFixed(6)}\\,${expression})`;
  }
  return expression;
}

function handFileFor(scene,project,projectRoot) {
  const configured=settingsFor(scene,project).handAsset;
  return configured?assertRelativeAsset(configured,'handAsset',scene.id,projectRoot,IMAGE_EXTENSIONS):defaultHand;
}

export function drawRevealHandSignature() {
  return fileExists(defaultHand)?crypto.createHash('sha256').update(fs.readFileSync(defaultHand)).digest('hex'):null;
}

export async function prepareDrawRevealVisual({scene,projectRoot}) {
  const file=assertRelativeAsset(scene.artwork,'artwork',scene.id,projectRoot,IMAGE_EXTENSIONS);
  return {file,cacheKey:sha256({path:scene.artwork,content:await fileIdentity(file)}),provider:'local-artwork',label:path.basename(scene.artwork)};
}

export async function drawRevealRenderInputs({scene,project,projectRoot,cfg={ffprobeBin:'ffprobe',width:1920,height:1080},signal=null}) {
  const settings=settingsFor(scene,project),hand=handFileFor(scene,project,projectRoot);
  let pathOptions=settings;
  if(settings.path===undefined){
    const artwork=assertRelativeAsset(scene.artwork,'artwork',scene.id,projectRoot,IMAGE_EXTENSIONS),size=await probeVideoSize(artwork,cfg,{signal});
    pathOptions={...settings,artworkWidth:size.width,artworkHeight:size.height,canvasWidth:cfg.width,canvasHeight:cfg.height};
  }
  return {
    path:drawRevealPath(pathOptions),
    handAsset:settings.handAsset||null,
    handContent:settings.handAsset?await fileIdentity(hand):null,
    handScale:finiteNumber(settings.handScale,.3,{min:.12,max:.6}),
    handAnchorX:finiteNumber(settings.handAnchorX,.105,{min:0,max:1}),
    handAnchorY:finiteNumber(settings.handAnchorY,.045,{min:0,max:1}),
    revealPortion:finiteNumber(settings.revealPortion,.88,{min:.5,max:.98}),
    backgroundColor:colorValue(settings.backgroundColor),
    subtitles:settings.subtitles!==false,
    subtitleFontSize:settings.subtitleFontSize??null,
    subtitleMaxWords:finiteNumber(settings.subtitleMaxWords,14,{min:4,max:24}),
    subtitlePosition:finiteNumber(settings.subtitlePosition,.72,{min:.2,max:.86})
  };
}

export async function drawRevealClipInputs({scene,project,projectRoot}) {
  const music=scene.backgroundMusic||project?.settings?.backgroundMusic||null,settings=settingsFor(scene,project);
  if(!music)return {backgroundMusic:null,musicVolumeDb:finiteNumber(settings.musicVolumeDb,-20,{min:-60,max:0})};
  const file=assertRelativeAsset(music,'backgroundMusic',scene.id,projectRoot,AUDIO_EXTENSIONS);
  return {backgroundMusic:music,content:await fileIdentity(file),musicVolumeDb:finiteNumber(settings.musicVolumeDb,-20,{min:-60,max:0})};
}

export async function renderDrawRevealScene({scene,project,projectRoot,imageFile,outputFile,durationSec,cfg,signal}) {
  const artwork=imageFile||assertRelativeAsset(scene.artwork,'artwork',scene.id,projectRoot,IMAGE_EXTENSIONS);
  const hand=handFileFor(scene,project,projectRoot),options=await drawRevealRenderInputs({scene,project,projectRoot,cfg,signal});
  const duration=Math.max(.04,finiteNumber(durationSec,0,{min:.04})),revealDuration=duration*options.revealPortion;
  const maskFile=`${outputFile}.reveal.pgm`,textFile=`${outputFile}.caption.txt`,captionFile=`${outputFile}.caption.png`;
  const fontSize=Math.max(18,Math.round(finiteNumber(options.subtitleFontSize,cfg.height*.047,{min:12,max:240})));
  const caption=captionFor(scene.text,options.subtitleMaxWords,Math.floor(cfg.width*.84/(fontSize*.58)));
  const handWidth=Math.max(24,Math.round(cfg.width*options.handScale));
  const x=coordinateExpression(options.path,'x',cfg.width,cfg.height,revealDuration),y=coordinateExpression(options.path,'y',cfg.width,cfg.height,revealDuration);
  ensureDir(path.dirname(outputFile));writeRevealSchedule(maskFile,{width:cfg.width,height:cfg.height,path:options.path});
  const args=['-y','-loop','1','-framerate',String(cfg.fps),'-i',artwork,'-loop','1','-framerate',String(cfg.fps),'-i',maskFile,'-loop','1','-framerate',String(cfg.fps),'-i',hand];
  let filter=`color=c=${options.backgroundColor}:s=${cfg.width}x${cfg.height}:r=${cfg.fps}:d=${duration}[paper];color=c=${options.backgroundColor}:s=${cfg.width}x${cfg.height}:r=${cfg.fps}:d=${duration}[blank];[0:v]scale=${cfg.width}:${cfg.height}:force_original_aspect_ratio=decrease,format=rgba[art];[paper][art]overlay=(W-w)/2:(H-h)/2:shortest=1,format=rgb24[full];[1:v]scale=${cfg.width}:${cfg.height}:flags=bilinear,format=gray,geq=lum='if(lte(lum(X\\,Y)\\,255*min(T/${revealDuration.toFixed(6)}\\,1))\\,255\\,0)',setrange=full[mask];[full][mask]alphamerge[masked];[blank][masked]overlay=0:0:shortest=1[revealed];[2:v]scale=${handWidth}:-1,format=rgba[hand];[revealed][hand]overlay=x='${x}-overlay_w*${options.handAnchorX}':y='${y}-overlay_h*${options.handAnchorY}':enable='between(t,0,${revealDuration.toFixed(6)})'[withhand]`;
  try {
    if(options.subtitles&&caption&&await supportsFilter(cfg.ffmpegBin,'drawtext')){
      fs.writeFileSync(textFile,caption);
      const border=Math.max(2,Math.round(fontSize*.08)),spacing=Math.max(2,Math.round(fontSize*.12));
      filter+=`;[withhand]drawtext=font='Sans':textfile='${escapeFilterValue(textFile)}':fontcolor=white:fontsize=${fontSize}:line_spacing=${spacing}:borderw=${border}:bordercolor=black@0.92:shadowx=${Math.max(1,Math.round(border/2))}:shadowy=${Math.max(1,Math.round(border/2))}:shadowcolor=black@0.8:x=(w-text_w)/2:y=h*${options.subtitlePosition}-text_h/2,format=yuv420p[v]`;
    } else if(options.subtitles&&caption){
      await renderCaptionPng({captionFile,text:caption,width:cfg.width,height:cfg.height,fontSize,position:options.subtitlePosition,signal});
      args.push('-loop','1','-framerate',String(cfg.fps),'-i',captionFile);
      filter+=';[3:v]format=rgba[caption];[withhand][caption]overlay=0:0:shortest=1,format=yuv420p[v]';
    } else filter+=';[withhand]format=yuv420p[v]';
    await run(cfg.ffmpegBin,[...args,'-filter_complex',filter,'-map','[v]','-an','-t',String(duration),'-r',String(cfg.fps),'-c:v','libx264','-preset','medium','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',outputFile],{capture:true,signal});
  } finally {
    for(const file of [maskFile,textFile,captionFile])fs.rmSync(file,{force:true});
  }
  return outputFile;
}

export async function mixDrawRevealAudio({scene,project,projectRoot,videoFile,voiceFile,outputFile,durationSec,cfg,signal}) {
  const music=scene.backgroundMusic||project?.settings?.backgroundMusic||null;
  if(!music){
    await run(cfg.ffmpegBin,['-y','-i',videoFile,'-i',voiceFile,'-map','0:v:0','-map','1:a:0','-c:v','copy','-c:a','aac','-b:a','192k','-shortest','-movflags','+faststart',outputFile],{capture:true,signal});
    return outputFile;
  }
  const musicFile=assertRelativeAsset(music,'backgroundMusic',scene.id,projectRoot,AUDIO_EXTENSIONS),settings=settingsFor(scene,project);
  const volume=finiteNumber(settings.musicVolumeDb,-20,{min:-60,max:0}),duration=Math.max(.04,finiteNumber(durationSec,0,{min:.04}));
  const filter=`[1:a]aresample=async=1:first_pts=0[voice];[2:a]volume=${volume}dB,atrim=0:${duration},asetpts=PTS-STARTPTS[music];[voice][music]amix=inputs=2:duration=first:dropout_transition=0:normalize=0,alimiter=limit=0.95[a]`;
  await run(cfg.ffmpegBin,['-y','-i',videoFile,'-i',voiceFile,'-stream_loop','-1','-i',musicFile,'-filter_complex',filter,'-map','0:v:0','-map','[a]','-c:v','copy','-c:a','aac','-b:a','192k','-t',String(duration),'-movflags','+faststart',outputFile],{capture:true,signal});
  return outputFile;
}
