import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { probeDuration, probeVideoSize } from '../packages/core/src/media.mjs';
import { run } from '../packages/core/src/process.mjs';
import { cinematicClipInputs, cinematicRenderInputs, mixCinematicBrollAudio, prepareCinematicVisual, renderCinematicBrollScene } from '../packages/renderers/src/cinematic-broll.mjs';

const cfg={ffmpegBin:'ffmpeg',ffprobeBin:'ffprobe',width:180,height:320,fps:10};

async function audioStreams(file) {
  const {stdout}=await run('ffprobe',['-v','error','-select_streams','a','-show_entries','stream=codec_type','-of','csv=p=0',file],{capture:true});
  return stdout.trim().split(/\s+/).filter(Boolean);
}

test('cinematic renderer validates its required local B-roll input',async()=>{
  const projectRoot=fs.mkdtempSync(path.join(os.tmpdir(),'vwt-cinematic-missing-'));
  await assert.rejects(
    prepareCinematicVisual({scene:{id:'scene-007'},project:{},projectRoot}),
    /scene scene-007 requires "broll"/
  );
  await assert.rejects(
    prepareCinematicVisual({scene:{id:'scene-007',broll:'assets/missing.mp4'},project:{},projectRoot}),
    /scene scene-007 is missing "broll" at assets\/missing\.mp4/
  );
});

test('cinematic cache inputs track local content and renderer-specific options',async()=>{
  const projectRoot=fs.mkdtempSync(path.join(os.tmpdir(),'vwt-cinematic-cache-'));
  fs.mkdirSync(path.join(projectRoot,'assets'));
  fs.writeFileSync(path.join(projectRoot,'assets','clip.mp4'),'first');
  fs.writeFileSync(path.join(projectRoot,'assets','music.mp3'),'music-one');
  const scene={id:'scene-002',broll:'assets/clip.mp4',brollStartMs:250,backgroundMusic:'assets/music.mp3'};
  const project={settings:{cinematicBroll:{subtitleMaxWords:10,musicVolumeDb:-24}}};
  const first=await prepareCinematicVisual({scene,project,projectRoot});
  fs.writeFileSync(path.join(projectRoot,'assets','clip.mp4'),'second');
  const second=await prepareCinematicVisual({scene,project,projectRoot});
  assert.notEqual(first.cacheKey,second.cacheKey);
  assert.deepEqual(cinematicRenderInputs({scene,project}),{brollStartMs:250,subtitles:true,subtitleFontSize:null,subtitleMaxWords:10,subtitlePosition:0.68});
  const clipInputs=await cinematicClipInputs({scene,project,projectRoot});
  assert.equal(clipInputs.backgroundMusic,'assets/music.mp3');
  assert.equal(clipInputs.musicVolumeDb,-24);
  assert.equal(clipInputs.content.length,64);
});

test('cinematic renderer loops, cover-crops, captions, and mixes local music under narration',async()=>{
  const projectRoot=fs.mkdtempSync(path.join(os.tmpdir(),'vwt cinematic '));
  const assets=path.join(projectRoot,'local assets');
  fs.mkdirSync(assets,{recursive:true});
  const broll=path.join(assets,'wide source.mp4');
  const voice=path.join(assets,'voice.wav');
  const music=path.join(assets,'music.wav');
  const video=path.join(projectRoot,'scene video.mp4');
  const clip=path.join(projectRoot,'scene clip.mp4');
  await run('ffmpeg',['-loglevel','error','-y','-f','lavfi','-i','testsrc2=s=320x180:r=10:d=0.35','-c:v','libx264','-pix_fmt','yuv420p',broll],{capture:true});
  await run('ffmpeg',['-loglevel','error','-y','-f','lavfi','-i','sine=frequency=440:duration=1.2','-c:a','pcm_s16le',voice],{capture:true});
  await run('ffmpeg',['-loglevel','error','-y','-f','lavfi','-i','sine=frequency=180:duration=0.25','-c:a','pcm_s16le',music],{capture:true});
  const scene={id:'scene-001',text:'A short emotional subtitle stays safe and readable.',broll:'local assets/wide source.mp4',brollStartMs:100,backgroundMusic:'local assets/music.wav'};
  const project={settings:{cinematicBroll:{musicVolumeDb:-20,subtitleMaxWords:12}}};
  const prepared=await prepareCinematicVisual({scene,project,projectRoot});
  assert.equal(prepared.file,broll);
  await renderCinematicBrollScene({scene,project,projectRoot,imageFile:prepared.file,outputFile:video,durationSec:1.2,cfg});
  await mixCinematicBrollAudio({scene,project,projectRoot,videoFile:video,voiceFile:voice,outputFile:clip,durationSec:1.2,cfg});
  assert.deepEqual(await probeVideoSize(clip,cfg),{width:180,height:320});
  const duration=await probeDuration(clip,cfg);
  assert.ok(duration>=1.1&&duration<=1.35,`unexpected duration ${duration}`);
  assert.deepEqual(await audioStreams(clip),['audio']);
  assert.ok(fs.statSync(clip).size>0);
});
