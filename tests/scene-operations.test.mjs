import test from 'node:test';
import assert from 'node:assert/strict';
import { duplicateScene, insertScene, mergeSceneWithNext, moveScene, removeScene, splitScene } from '../packages/core/src/project.mjs';

const cfg={wordsPerMinute:150,sceneMinSec:2,sceneMaxSec:12,format:'landscape'};
function fixture(){return {version:4,status:'complete',settings:{format:'landscape'},artifacts:{final:'output/final.mp4'},scenes:[
  {id:'scene-001',index:0,text:'Câu thứ nhất đủ dài. Câu thứ hai để tách.',visualIntent:'Hai ý liên tiếp',visualPrompt:'old',durationMs:5000,startMs:0,endMs:5000,status:'ready',review:{script:'approved',voice:'approved',visual:'approved',clip:'approved'},cache:{voice:'v1',image:'i1',video:'r1',clip:'c1'},artifacts:{voice:'v.mp3',visual:'i.png',video:'r.mp4',clip:'c.mp4'}},
  {id:'scene-002',index:1,text:'Cảnh tiếp theo.',visualIntent:'Một cảnh tiếp theo',visualPrompt:'next',durationMs:3000,startMs:5000,endMs:8000,status:'planned',review:{script:'pending',voice:'pending',visual:'pending',clip:'pending'},cache:{},artifacts:{}}
]};}

test('insert and duplicate create stable fresh scene ids without touching source artifacts',()=>{
  const project=fixture();const inserted=insertScene(project,{afterSceneId:'scene-001',text:'Cảnh chen vào.'},cfg);
  const copy=duplicateScene(project,'scene-001',cfg);
  assert.equal(new Set(project.scenes.map((scene)=>scene.id)).size,4);
  assert.equal(inserted.index,2);
  assert.deepEqual(copy.artifacts,{});
  assert.equal(project.scenes.find((scene)=>scene.id==='scene-001').artifacts.voice,'v.mp3');
  assert.equal(project.artifacts.final,undefined);
});

test('split invalidates only the source scene and adds a fresh second scene',()=>{
  const project=fixture();const result=splitScene(project,'scene-001',cfg);
  assert.equal(project.scenes.length,3);
  assert.match(result.first.text,/đủ dài\.$/);
  assert.match(result.second.text,/^Câu thứ hai/);
  assert.equal(result.first.artifacts.voice,undefined);
  assert.deepEqual(result.second.artifacts,{});
  assert.equal(project.scenes.find((scene)=>scene.id==='scene-002').text,'Cảnh tiếp theo.');
});

test('move, merge, and remove keep indexes and timeline consistent',()=>{
  const project=fixture();moveScene(project,'scene-002','up');
  assert.equal(project.scenes[0].id,'scene-002');
  const merged=mergeSceneWithNext(project,'scene-002',cfg);
  assert.match(merged.text,/Câu thứ nhất/);
  insertScene(project,{text:'Cảnh cuối.'},cfg);
  const removedId=project.scenes[0].id;removeScene(project,removedId);
  assert.deepEqual(project.scenes.map((scene)=>scene.index),[0]);
  assert.equal(project.scenes[0].startMs,0);
});
