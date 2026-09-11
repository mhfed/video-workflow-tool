import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { probeDuration, probeVideoSize } from '../packages/core/src/media.mjs';
import { run } from '../packages/core/src/process.mjs';
import { drawRevealClipInputs, drawRevealPath, drawRevealRenderInputs, generateDrawRevealPath, mixDrawRevealAudio, prepareDrawRevealVisual, renderDrawRevealScene } from '../packages/renderers/src/draw-reveal.mjs';

const cfg={ffmpegBin:'ffmpeg',ffprobeBin:'ffprobe',width:180,height:320,fps:10};

async function audioStreams(file) {
  const {stdout}=await run('ffprobe',['-v','error','-select_streams','a','-show_entries','stream=codec_type','-of','csv=p=0',file],{capture:true});
  return stdout.trim().split(/\s+/).filter(Boolean);
}

test('draw-reveal validates required local artwork and normalized explicit paths',async()=>{
  const projectRoot=fs.mkdtempSync(path.join(os.tmpdir(),'vwt-draw-missing-'));
  await assert.rejects(prepareDrawRevealVisual({scene:{id:'scene-009'},projectRoot}),/scene scene-009 requires "artwork"/);
  await assert.rejects(prepareDrawRevealVisual({scene:{id:'scene-009',artwork:'assets/missing.png'},projectRoot}),/is missing "artwork" at assets\/missing\.png/);
  assert.throws(()=>drawRevealPath({path:[[0,0],[2,1]]}),/values from 0 to 1/);
  assert.deepEqual(drawRevealPath({path:[[.1,.2],[.8,.7]]}),[[.1,.2],[.8,.7]]);
  const fitted=drawRevealPath({pathRows:3,artworkWidth:320,artworkHeight:180,canvasWidth:180,canvasHeight:320});
  assert.ok(fitted.every(([,y])=>y>.3&&y<.7),'automatic path should stay inside the fitted landscape artwork');
});

test('draw-reveal cache inputs track artwork, path, hand, subtitles, and music',async()=>{
  const projectRoot=fs.mkdtempSync(path.join(os.tmpdir(),'vwt-draw-cache-')),assets=path.join(projectRoot,'assets');
  fs.mkdirSync(assets);fs.writeFileSync(path.join(assets,'art.png'),'first');fs.writeFileSync(path.join(assets,'hand.png'),'hand');fs.writeFileSync(path.join(assets,'music.mp3'),'music');
  const scene={id:'scene-002',artwork:'assets/art.png',backgroundMusic:'assets/music.mp3',drawReveal:{path:[[.1,.1],[.9,.9]],handAsset:'assets/hand.png',subtitleMaxWords:9}};
  const project={settings:{drawReveal:{musicVolumeDb:-23}}};
  const first=await prepareDrawRevealVisual({scene,projectRoot});fs.writeFileSync(path.join(assets,'art.png'),'second');const second=await prepareDrawRevealVisual({scene,projectRoot});
  assert.notEqual(first.cacheKey,second.cacheKey);
  const inputs=await drawRevealRenderInputs({scene,project,projectRoot});
  assert.deepEqual(inputs.path,[[.1,.1],[.9,.9]]);assert.equal(inputs.pathMode,'explicit');assert.equal(inputs.pathRows,9);assert.equal(inputs.handAsset,'assets/hand.png');assert.equal(inputs.handContent.length,64);assert.equal(inputs.subtitleMaxWords,9);
  const clipInputs=await drawRevealClipInputs({scene,project,projectRoot});assert.equal(clipInputs.musicVolumeDb,-23);assert.equal(clipInputs.content.length,64);
});

test('draw-reveal falls back deterministically when artwork has no detectable contours',async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'vwt-draw-fallback-')),artwork=path.join(root,'blank.png'),output=path.join(root,'scene.mp4');
  await run('ffmpeg',['-loglevel','error','-y','-f','lavfi','-i','color=c=white:s=120x80','-frames:v','1',artwork],{capture:true});
  const generated=await generateDrawRevealPath({artwork,outputFile:output,pathRows:5,cfg});
  assert.equal(generated.mode,'serpentine-fallback');assert.equal(generated.path.length,5);assert.ok(generated.path.every(([x,y])=>x>=0&&x<=1&&y>=0&&y<=1));
  assert.equal(fs.existsSync(`${output}.edges.pgm`),false);
});

test('draw-reveal progressively reveals color artwork, follows duration, and mixes narration with quiet music',async()=>{
  const projectRoot=fs.mkdtempSync(path.join(os.tmpdir(),'vwt draw reveal ')),assets=path.join(projectRoot,'local assets');fs.mkdirSync(assets,{recursive:true});
  const artwork=path.join(assets,'colored artwork.png'),voice=path.join(assets,'voice.wav'),music=path.join(assets,'music.wav'),video=path.join(projectRoot,'scene video.mp4'),clip=path.join(projectRoot,'scene clip.mp4');
  await run('ffmpeg',['-loglevel','error','-y','-f','lavfi','-i','color=c=white:s=180x320','-vf','drawbox=x=20:y=35:w=140:h=90:color=red:t=fill,drawbox=x=48:y=155:w=84:h=110:color=blue:t=fill','-frames:v','1',artwork],{capture:true});
  await run('ffmpeg',['-loglevel','error','-y','-f','lavfi','-i','sine=frequency=440:duration=1.2','-c:a','pcm_s16le',voice],{capture:true});
  await run('ffmpeg',['-loglevel','error','-y','-f','lavfi','-i','sine=frequency=180:duration=0.25','-c:a','pcm_s16le',music],{capture:true});
  const scene={id:'scene-001',text:'The colored illustration appears under the moving hand.',artwork:'local assets/colored artwork.png',backgroundMusic:'local assets/music.wav',drawReveal:{subtitles:true,musicVolumeDb:-20}};
  const project={settings:{drawReveal:{revealPortion:.85}}},prepared=await prepareDrawRevealVisual({scene,projectRoot});
  const generated=await generateDrawRevealPath({artwork,outputFile:video,pathRows:9,cfg});assert.equal(generated.mode,'contour-v1');assert.ok(generated.path.length>8);
  await renderDrawRevealScene({scene,project,projectRoot,imageFile:prepared.file,outputFile:video,durationSec:1.2,cfg});
  await mixDrawRevealAudio({scene,project,projectRoot,videoFile:video,voiceFile:voice,outputFile:clip,durationSec:1.2,cfg});
  assert.deepEqual(await probeVideoSize(clip,cfg),{width:180,height:320});const duration=await probeDuration(clip,cfg);assert.ok(duration>=1.1&&duration<=1.35,`unexpected duration ${duration}`);
  assert.deepEqual(await audioStreams(clip),['audio']);assert.ok(fs.statSync(clip).size>0);assert.equal(fs.existsSync(`${video}.reveal.pgm`),false);
  const early=await run('ffmpeg',['-loglevel','error','-ss','0.1','-i',video,'-frames:v','1','-f','framemd5','-'],{capture:true});
  const late=await run('ffmpeg',['-loglevel','error','-ss','1.0','-i',video,'-frames:v','1','-f','framemd5','-'],{capture:true});
  assert.notEqual(early.stdout.split('\n').at(-2),late.stdout.split('\n').at(-2),'early and final reveal frames should differ');
});
