import test from 'node:test';
import assert from 'node:assert/strict';
import { pointAtProgress, movePathPoint, partialPath } from '../apps/web/src/draw-path-model.mjs';
import { assignDrawRevealPath, drawRevealPathChanged, normalizeDrawRevealPathUpdate } from '../apps/web/src/draw-reveal-path.mjs';
import { drawRevealRenderInputs } from '../packages/renderers/src/draw-reveal.mjs';
import { getRenderer } from '../packages/renderers/src/registry.mjs';

function fixture() {
  const scene={id:'scene-001',drawReveal:{},status:'ready',cache:{voice:'voice-key',image:'image-key',video:'video-key',clip:'clip-key'},artifacts:{voice:'voice.mp3',visual:'art.png',video:'video.mp4',clip:'clip.mp4'},review:{voice:'approved',visual:'approved',clip:'approved'}};
  return {scene,project:{settings:{drawReveal:{path:[[.2,.2],[.8,.8]]}},status:'complete',artifacts:{final:'output/final.mp4'},scenes:[scene]}};
}

test('draw path updates normalize precision and reject invalid editor payloads',()=>{
  assert.deepEqual(normalizeDrawRevealPathUpdate([[.1234567,.2],[.9,.8765432]]),[[.12346,.2],[.9,.87654]]);
  assert.equal(normalizeDrawRevealPathUpdate(null),null);
  assert.throws(()=>normalizeDrawRevealPathUpdate(undefined),/requires "path"/);
  assert.throws(()=>normalizeDrawRevealPathUpdate([[0,0]]),/at least two/);
  assert.throws(()=>normalizeDrawRevealPathUpdate([[.5,.5],[.5,.5]]),/distinct points/);
  assert.throws(()=>normalizeDrawRevealPathUpdate([[0,0],[1.1,1]]),/values from 0 to 1/);
  assert.throws(()=>normalizeDrawRevealPathUpdate(Array.from({length:65},()=>[.5,.5])),/at most 64/);
});

test('saving and resetting a path preserve voice and artwork while invalidating only rendered media',async()=>{
  const {project,scene}=fixture(),path=[[.1,.15],[.8,.3],[.4,.9]];
  assert.equal(drawRevealPathChanged(scene,path),true);assignDrawRevealPath(project,scene,path);
  assert.deepEqual(scene.drawReveal.path,path);assert.equal(scene.cache.voice,'voice-key');assert.equal(scene.cache.image,'image-key');assert.equal(scene.artifacts.voice,'voice.mp3');assert.equal(scene.artifacts.visual,'art.png');assert.equal(scene.cache.video,undefined);assert.equal(scene.cache.clip,undefined);assert.equal(project.artifacts.final,undefined);
  assert.equal(drawRevealPathChanged(scene,path),false);assert.equal(drawRevealPathChanged(scene,null),true);
  scene.cache.video='new-video';scene.cache.clip='new-clip';assignDrawRevealPath(project,scene,null);
  assert.equal(scene.drawReveal.path,null);assert.equal((await drawRevealRenderInputs({scene,project,projectRoot:process.cwd()})).pathMode,'contour-v1');assert.equal(scene.cache.image,'image-key');assert.equal(scene.cache.video,undefined);
});

test('path editor timeline follows distance and supports deterministic point order',()=>{
  const points=[[0,0],[1,0],[1,1]];
  assert.deepEqual(pointAtProgress(points,.25),[.5,0]);assert.deepEqual(pointAtProgress(points,.75),[1,.5]);
  assert.deepEqual(partialPath(points,.75),[[0,0],[1,0],[1,.5]]);
  assert.deepEqual(movePathPoint(points,1,-1),[[1,0],[0,0],[1,1]]);assert.equal(movePathPoint(points,0,-1),points);
  assert.equal(typeof getRenderer('draw-reveal').resolvePath,'function');
});
