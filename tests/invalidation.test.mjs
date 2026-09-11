import test from 'node:test';
import assert from 'node:assert/strict';
import { invalidateFinal, invalidateRenderedMedia, invalidateScene } from '../packages/core/src/invalidation.mjs';

function fixture() {
  const scene={
    text:'old narration', visualPrompt:'old prompt', status:'ready',
    cache:{voice:'voice-key',image:'image-key',video:'video-key',clip:'clip-key'},
    artifacts:{voice:'voice.mp3',visual:'visual.png',video:'video.mp4',clip:'clip.mp4'},
    operations:{voice:{provider:'vivibe',id:'export-1',cacheKey:'voice-key',state:'processing'}}
  };
  return {project:{status:'complete',artifacts:{final:'output/final.mp4'},scenes:[scene]},scene};
}

test('prompt-only edit preserves voice and invalidates visual downstream artifacts',()=>{
  const {project,scene}=fixture();
  invalidateScene(project,scene,{promptChanged:true});
  assert.equal(scene.cache.voice,'voice-key');
  assert.equal(scene.artifacts.voice,'voice.mp3');
  assert.equal(scene.cache.image,undefined);
  assert.equal(scene.artifacts.visual,undefined);
  assert.equal(scene.cache.video,undefined);
  assert.equal(scene.cache.clip,undefined);
  assert.equal(project.artifacts.final,undefined);
  assert.equal(project.status,'planned');
});

test('narration edit preserves image but invalidates voice and downstream video',()=>{
  const {project,scene}=fixture();
  invalidateScene(project,scene,{textChanged:true});
  assert.equal(scene.cache.image,'image-key');
  assert.equal(scene.artifacts.visual,'visual.png');
  assert.equal(scene.cache.voice,undefined);
  assert.equal(scene.artifacts.voice,undefined);
  assert.equal(scene.operations.voice,undefined);
  assert.equal(scene.cache.video,undefined);
  assert.equal(scene.cache.clip,undefined);
  assert.equal(project.artifacts.final,undefined);
});

test('no-op edit keeps caches and final artifact intact',()=>{
  const {project,scene}=fixture();
  invalidateScene(project,scene,{});
  assert.equal(scene.cache.voice,'voice-key');
  assert.equal(scene.cache.image,'image-key');
  assert.equal(project.artifacts.final,'output/final.mp4');
  assert.equal(project.status,'complete');
});

test('explicit final invalidation removes stale final metadata',()=>{
  const {project}=fixture();
  project.artifacts.captions='output/captions.vtt';
  invalidateFinal(project);
  assert.equal(project.artifacts.final,undefined);
  assert.equal(project.artifacts.captions,undefined);
  assert.equal(project.status,'planned');
});

test('renderer change preserves source media and invalidates every rendered artifact',()=>{
  const first=fixture();
  const second={...structuredClone(first.scene),artifacts:{voice:'voice-2.mp3'},cache:{voice:'voice-2-key',video:'video-2-key',clip:'clip-2-key'}};
  first.project.scenes.push(second);
  invalidateRenderedMedia(first.project);
  assert.equal(first.scene.cache.voice,'voice-key');
  assert.equal(first.scene.cache.image,'image-key');
  assert.equal(first.scene.artifacts.voice,'voice.mp3');
  assert.equal(first.scene.artifacts.visual,'visual.png');
  assert.equal(first.scene.cache.video,undefined);
  assert.equal(first.scene.artifacts.clip,undefined);
  assert.equal(first.scene.status,'visual-ready');
  assert.equal(second.cache.voice,'voice-2-key');
  assert.equal(second.cache.video,undefined);
  assert.equal(second.status,'voice-ready');
  assert.equal(first.project.artifacts.final,undefined);
  assert.equal(first.project.status,'planned');
});

test('format change can reuse voice and visual source artifacts',()=>{
  const {project,scene}=fixture();
  project.settings={format:'landscape',width:1920,height:1080};
  Object.assign(project.settings,{format:'short',width:1080,height:1920});
  invalidateRenderedMedia(project);
  assert.equal(scene.cache.voice,'voice-key');
  assert.equal(scene.cache.image,'image-key');
  assert.equal(scene.cache.video,undefined);
  assert.equal(scene.cache.clip,undefined);
  assert.equal(project.artifacts.final,undefined);
});

test('scene renderer change invalidates only that scene render and final output',()=>{
  const {project,scene}=fixture();
  const other=structuredClone(scene);
  other.id='scene-002';
  project.scenes.push(other);
  scene.renderer='simple';
  invalidateScene(project,scene,{rendererChanged:true});
  assert.equal(scene.cache.voice,'voice-key');
  assert.equal(scene.artifacts.voice,'voice.mp3');
  assert.equal(scene.cache.image,'image-key');
  assert.equal(scene.artifacts.visual,'visual.png');
  assert.equal(scene.cache.video,undefined);
  assert.equal(scene.artifacts.video,undefined);
  assert.equal(scene.cache.clip,undefined);
  assert.equal(scene.artifacts.clip,undefined);
  assert.equal(scene.review.clip,'stale');
  assert.equal(project.artifacts.final,undefined);
  assert.equal(other.cache.video,'video-key');
  assert.equal(other.artifacts.clip,'clip.mp4');
});

test('changing a resolved B-roll visual preserves voice and invalidates visual media downstream',()=>{
  const {project,scene}=fixture();
  invalidateScene(project,scene,{visualChanged:true});
  assert.equal(scene.cache.voice,'voice-key');
  assert.equal(scene.artifacts.voice,'voice.mp3');
  assert.equal(scene.cache.image,undefined);
  assert.equal(scene.artifacts.visual,undefined);
  assert.equal(scene.cache.video,undefined);
  assert.equal(scene.cache.clip,undefined);
  assert.equal(project.artifacts.final,undefined);
});
