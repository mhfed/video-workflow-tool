import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { run } from '../../core/src/process.mjs';
import { coverVideoFilter } from '../../core/src/video-fit.mjs';
import { ensureDir, fileExists, sha256 } from '../../core/src/utils.mjs';

const VIDEO_EXTENSIONS=new Set(['.mp4','.mov','.mkv','.webm']);
const AUDIO_EXTENSIONS=new Set(['.aac','.flac','.m4a','.mp3','.ogg','.wav']);
const captionScript=fileURLToPath(new URL('../scripts/render-caption.swift',import.meta.url));
const filterSupport=new Map();

function assertRelativeAsset(value,field,sceneId,projectRoot,extensions) {
  if(typeof value!=='string'||!value.trim())throw new Error(`Cinematic B-roll scene ${sceneId} requires "${field}" with a local project-relative media path.`);
  if(path.isAbsolute(value))throw new Error(`Cinematic B-roll scene ${sceneId} field "${field}" must be project-relative, not absolute: ${value}`);
  const root=path.resolve(projectRoot),resolved=path.resolve(root,value);
  if(resolved!==root&&!resolved.startsWith(`${root}${path.sep}`))throw new Error(`Cinematic B-roll scene ${sceneId} field "${field}" must stay inside the project directory: ${value}`);
  const extension=path.extname(resolved).toLowerCase();
  if(!extensions.has(extension))throw new Error(`Cinematic B-roll scene ${sceneId} field "${field}" has unsupported extension "${extension||'(none)'}".`);
  if(!fileExists(resolved))throw new Error(`Cinematic B-roll scene ${sceneId} is missing "${field}" at ${value}. Add the local media file inside the project directory.`);
  return resolved;
}

async function fileIdentity(file) {
  const hash=crypto.createHash('sha256');
  await new Promise((resolve,reject)=>fs.createReadStream(file).on('data',(chunk)=>hash.update(chunk)).on('end',resolve).on('error',reject));
  return hash.digest('hex');
}

function settingsFor(scene,project) {
  return {...(project?.settings?.cinematicBroll||{}),...(scene?.cinematicBroll||{})};
}

function finiteNumber(value,fallback,{min=-Infinity,max=Infinity}={}) {
  const number=Number(value);
  return Number.isFinite(number)&&number>=min&&number<=max?number:fallback;
}

function captionFor(text,maxWords=14,maxCharsPerLine=22) {
  const words=String(text||'').replace(/\s+/g,' ').trim().split(' ').filter(Boolean);
  const limit=Math.max(4,Math.round(finiteNumber(maxWords,14,{min:4,max:24})));
  const lineLimit=Math.max(10,Math.round(maxCharsPerLine));
  const selected=[];
  for(const word of words.slice(0,limit)){
    if(selected.length&&[...selected,word].join(' ').length>lineLimit*2+1)break;
    selected.push(word);
  }
  const truncated=selected.length<words.length;
  if(truncated&&selected.length)selected[selected.length-1]=`${selected[selected.length-1].replace(/[.!?,;:…]+$/u,'')}…`;
  if(selected.length<2)return selected.join(' ');
  let split=1,best=Infinity,bestOverflow=Infinity;
  for(let index=1;index<selected.length;index++){
    const first=selected.slice(0,index).join(' ').length,second=selected.slice(index).join(' ').length;
    const overflow=Math.max(0,first-lineLimit)+Math.max(0,second-lineLimit);
    const score=Math.abs(first-second);
    if(overflow<bestOverflow||overflow===bestOverflow&&score<best){bestOverflow=overflow;best=score;split=index;}
  }
  return `${selected.slice(0,split).join(' ')}\n${selected.slice(split).join(' ')}`;
}

function escapeFilterValue(value) {
  return String(value).replaceAll('\\','\\\\').replaceAll(':','\\:').replaceAll("'","\\'").replaceAll(',','\\,');
}

async function supportsFilter(ffmpegBin,name) {
  const key=`${ffmpegBin}:${name}`;
  if(!filterSupport.has(key))filterSupport.set(key,(async()=>{
    try {
      const result=await run(ffmpegBin,['-hide_banner','-filters'],{capture:true});
      return new RegExp(`(?:^|\\n)\\s*[.A-Z]{2,3}\\s+${name}\\s`,'m').test(`${result.stdout}\n${result.stderr}`);
    } catch { return false; }
  })());
  return filterSupport.get(key);
}

async function renderCaptionPng({captionFile,text,width,height,fontSize,position,signal}) {
  if(process.platform!=='darwin')throw new Error('Cinematic B-roll subtitles require an FFmpeg build with the drawtext filter. Install FFmpeg with libfreetype support.');
  const moduleCache=path.join(os.tmpdir(),'vwt-swift-module-cache');
  ensureDir(moduleCache);
  await run('/usr/bin/swift',[captionScript,captionFile,String(width),String(height),text,String(fontSize),String(position)],{capture:true,signal,env:{SWIFT_MODULECACHE_PATH:moduleCache,CLANG_MODULE_CACHE_PATH:moduleCache}});
}

export async function prepareCinematicVisual({scene,project,projectRoot}) {
  const file=assertRelativeAsset(scene.broll,'broll',scene.id,projectRoot,VIDEO_EXTENSIONS);
  return {
    file,
    cacheKey:sha256({path:scene.broll,content:await fileIdentity(file)}),
    provider:'local-broll',
    label:path.basename(scene.broll)
  };
}

export function cinematicRenderInputs({scene,project}) {
  const settings=settingsFor(scene,project);
  return {
    brollStartMs:finiteNumber(scene.brollStartMs,0,{min:0}),
    subtitles:settings.subtitles!==false,
    subtitleFontSize:settings.subtitleFontSize??null,
    subtitleMaxWords:finiteNumber(settings.subtitleMaxWords,14,{min:4,max:24}),
    subtitlePosition:finiteNumber(settings.subtitlePosition,0.68,{min:0.2,max:0.82})
  };
}

export async function cinematicClipInputs({scene,project,projectRoot}) {
  const music=scene.backgroundMusic||project?.settings?.backgroundMusic||null;
  const settings=settingsFor(scene,project);
  if(!music)return {backgroundMusic:null,musicVolumeDb:finiteNumber(settings.musicVolumeDb,-20,{min:-60,max:0})};
  const file=assertRelativeAsset(music,'backgroundMusic',scene.id,projectRoot,AUDIO_EXTENSIONS);
  return {backgroundMusic:music,content:await fileIdentity(file),musicVolumeDb:finiteNumber(settings.musicVolumeDb,-20,{min:-60,max:0})};
}

export async function renderCinematicBrollScene({scene,project,projectRoot,imageFile,outputFile,durationSec,cfg,signal}) {
  const broll=imageFile||assertRelativeAsset(scene.broll,'broll',scene.id,projectRoot,VIDEO_EXTENSIONS);
  const options=cinematicRenderInputs({scene,project});
  const duration=Math.max(0.04,finiteNumber(durationSec,0,{min:0.04}));
  const startSec=options.brollStartMs/1000;
  const fontSize=Math.max(18,Math.round(finiteNumber(options.subtitleFontSize,cfg.height*0.047,{min:12,max:240})));
  const maxCharsPerLine=Math.floor(cfg.width*.84/(fontSize*.58));
  const caption=captionFor(scene.text,options.subtitleMaxWords,maxCharsPerLine);
  const textFile=`${outputFile}.caption.txt`,captionFile=`${outputFile}.caption.png`;
  ensureDir(path.dirname(outputFile));
  const inputArgs=['-y','-stream_loop','-1'];
  if(startSec>0)inputArgs.push('-ss',String(startSec));
  inputArgs.push('-i',broll);
  let filter=`[0:v]${coverVideoFilter(cfg.width,cfg.height)},fps=${cfg.fps}`;
  try {
    if(options.subtitles&&caption){
      if(await supportsFilter(cfg.ffmpegBin,'drawtext')){
        fs.writeFileSync(textFile,caption);
        const border=Math.max(2,Math.round(fontSize*.08));
        const spacing=Math.max(2,Math.round(fontSize*.12));
        filter+=`,drawtext=font='Sans':textfile='${escapeFilterValue(textFile)}':fontcolor=white:fontsize=${fontSize}:line_spacing=${spacing}:borderw=${border}:bordercolor=black@0.92:shadowx=${Math.max(1,Math.round(border/2))}:shadowy=${Math.max(1,Math.round(border/2))}:shadowcolor=black@0.8:x=(w-text_w)/2:y=h*${options.subtitlePosition}-text_h/2`;
        filter+=',format=yuv420p[v]';
        await run(cfg.ffmpegBin,[...inputArgs,'-filter_complex',filter,'-map','[v]','-an','-t',String(duration),'-c:v','libx264','-preset','medium','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',outputFile],{capture:true,signal});
      } else {
        await renderCaptionPng({captionFile,text:caption,width:cfg.width,height:cfg.height,fontSize,position:options.subtitlePosition,signal});
        filter+=',format=yuv420p[base];[1:v]format=rgba[caption];[base][caption]overlay=0:0:shortest=1,format=yuv420p[v]';
        await run(cfg.ffmpegBin,[...inputArgs,'-loop','1','-framerate',String(cfg.fps),'-i',captionFile,'-filter_complex',filter,'-map','[v]','-an','-t',String(duration),'-c:v','libx264','-preset','medium','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',outputFile],{capture:true,signal});
      }
    } else {
      filter+=',format=yuv420p[v]';
      await run(cfg.ffmpegBin,[...inputArgs,'-filter_complex',filter,'-map','[v]','-an','-t',String(duration),'-c:v','libx264','-preset','medium','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',outputFile],{capture:true,signal});
    }
  } finally {
    fs.rmSync(textFile,{force:true});
    fs.rmSync(captionFile,{force:true});
  }
  return outputFile;
}

export async function mixCinematicBrollAudio({scene,project,projectRoot,videoFile,voiceFile,outputFile,durationSec,cfg,signal}) {
  const music=scene.backgroundMusic||project?.settings?.backgroundMusic||null;
  if(!music){
    await run(cfg.ffmpegBin,['-y','-i',videoFile,'-i',voiceFile,'-map','0:v:0','-map','1:a:0','-c:v','copy','-c:a','aac','-b:a','192k','-shortest','-movflags','+faststart',outputFile],{capture:true,signal});
    return outputFile;
  }
  const musicFile=assertRelativeAsset(music,'backgroundMusic',scene.id,projectRoot,AUDIO_EXTENSIONS);
  const volume=finiteNumber(settingsFor(scene,project).musicVolumeDb,-20,{min:-60,max:0});
  const duration=Math.max(0.04,finiteNumber(durationSec,0,{min:0.04}));
  const filter=`[1:a]aresample=async=1:first_pts=0[voice];[2:a]volume=${volume}dB,atrim=0:${duration},asetpts=PTS-STARTPTS[music];[voice][music]amix=inputs=2:duration=first:dropout_transition=0:normalize=0,alimiter=limit=0.95[a]`;
  await run(cfg.ffmpegBin,['-y','-i',videoFile,'-i',voiceFile,'-stream_loop','-1','-i',musicFile,'-filter_complex',filter,'-map','0:v:0','-map','[a]','-c:v','copy','-c:a','aac','-b:a','192k','-t',String(duration),'-movflags','+faststart',outputFile],{capture:true,signal});
  return outputFile;
}
