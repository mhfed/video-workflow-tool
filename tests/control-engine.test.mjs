import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { recordHistory, redoProject, undoProject } from '../packages/core/src/history.mjs';
import { selectTake } from '../packages/core/src/takes.mjs';
import { invalidateScene } from '../packages/core/src/invalidation.mjs';
import { buildRoughCutManifest } from '../packages/core/src/rough-cut.mjs';
import { buildRepairPlan } from '../packages/core/src/repair-plan.mjs';
import { planSemanticScenes, visualPromptFor } from '../packages/core/src/scene-plan.mjs';
import { run } from '../packages/core/src/process.mjs';
import { ProjectJobQueue } from '../apps/worker/src/job-queue.mjs';
import { createProject, loadProject } from '../packages/core/src/project.mjs';

const scene=()=>({id:'scene-001',index:0,text:'A scene',durationMs:2000,review:{script:'approved',voice:'approved',visual:'approved',clip:'approved'},cache:{voice:'voice-2',image:'image-2',video:'video-2',clip:'clip-2'},artifacts:{voice:'v2.mp3',visual:'i2.png',video:'r2.mp4',clip:'c2.mp4'},takes:{voice:[{id:'voice-1',path:'v1.mp3',cacheKey:'voice-1',durationMs:1800},{id:'voice-2',path:'v2.mp3',cacheKey:'voice-2',durationMs:2000}],visual:[],video:[],clip:[]},selectedTakes:{voice:'voice-2'}});

test('history restores project edits and supports redo',()=>{
  const project={title:'Before',settings:{},scenes:[scene()],artifacts:{},history:{undo:[],redo:[]}};
  recordHistory(project,'Rename project');project.title='After';
  assert.equal(undoProject(project),true);assert.equal(project.title,'Before');
  assert.equal(redoProject(project),true);assert.equal(project.title,'After');
});

test('selecting an older voice take keeps the take and invalidates only downstream media',()=>{
  const project={status:'complete',scenes:[scene()],artifacts:{final:'output/final.mp4'}};const item=project.scenes[0];
  selectTake(project,item,'voice','voice-1');
  assert.equal(item.artifacts.voice,'v1.mp3');assert.equal(item.durationMs,1800);
  assert.equal(item.artifacts.video,undefined);assert.equal(item.artifacts.clip,undefined);
  assert.equal(item.artifacts.visual,'i2.png');assert.equal(project.artifacts.final,undefined);
});

test('reselecting the active take is a no-op and editing clears only stale selections',()=>{
  const project={status:'complete',scenes:[scene()],artifacts:{final:'output/final.mp4'}};const item=project.scenes[0];
  selectTake(project,item,'voice','voice-2');
  assert.equal(item.artifacts.clip,'c2.mp4');assert.equal(project.artifacts.final,'output/final.mp4');
  invalidateScene(project,item,{textChanged:true});
  assert.equal(item.selectedTakes.voice,undefined);assert.equal(item.selectedTakes.video,undefined);assert.equal(item.selectedTakes.clip,undefined);
  assert.equal(item.artifacts.visual,'i2.png');
});

test('rough cut manifest uses selected cached clips without final assembly',()=>{
  const project={id:'demo',title:'Demo',updatedAt:'now',scenes:[scene()]};
  const manifest=buildRoughCutManifest(project);
  assert.equal(manifest.readyScenes,1);assert.match(manifest.scenes[0].clip,/\/media\/demo\/scenes\/scene-001\/clip/);
});

test('repair plan scopes visual and voice fixes with cost preview',()=>{
  const item=scene();item.quality={visual:{checks:{safeArea:{status:'fail',label:'Safe area'}}},audio:{checks:{pacing:{status:'warn',label:'Pacing'}}}};
  const plan=buildRepairPlan({scenes:[item]});
  assert.deepEqual(plan.actions.map((action)=>action.stage),['visual','voice']);assert.deepEqual(plan.cost,{imageRequests:1,voiceRequests:1,renders:2});
});

test('semantic planning recognizes narrative turns and project memory compiles into prompts',()=>{
  const cfg={sceneTargetSec:8,sceneMinSec:2,sceneMaxSec:12,wordsPerMinute:150};
  const planned=planSemanticScenes('Why does this matter? The pattern looks simple. However, one detail changes everything. Finally, use it every day.',cfg);
  assert.ok(planned.some((item)=>item.narrativeRole==='turn'));assert.ok(planned.some((item)=>item.narrativeRole==='resolution'));
  const prompt=visualPromptFor('Narration',{format:'landscape',memory:{characters:['Mai wears a red scarf'],palette:['navy','coral'],artDirection:'editorial ink'}},'Mai decides');
  assert.match(prompt,/Mai wears a red scarf/);assert.match(prompt,/editorial ink/);
});

test('subprocess cancellation rejects with AbortError',async()=>{
  const controller=new AbortController();setTimeout(()=>controller.abort(),40);
  await assert.rejects(run(process.execPath,['-e','setInterval(()=>{},1000)'],{capture:true,signal:controller.signal}),(error)=>error.name==='AbortError');
});

test('persistent job queue records progress in project.json',async()=>{
  const workspaceDir=fs.mkdtempSync(path.join(os.tmpdir(),'vwt-jobs-'));
  const cfg={workspaceDir,renderer:'simple',width:320,height:180,fps:10,sceneTargetSec:2,sceneMinSec:1,sceneMaxSec:3,wordsPerMinute:150,contentLanguage:'en'};
  const project=createProject({title:'Queue test',sourceText:'One short scene.',workflowMode:'auto'},cfg);
  const queue=new ProjectJobQueue({getConfig:()=>cfg,runners:{probe:async(_id,{onProgress})=>{await onProgress({completed:1,total:2,percent:50,message:'Halfway'});await onProgress({completed:2,total:2,percent:100,message:'Done'});}}});
  const job=queue.enqueue(project.id,'probe',{});
  const deadline=Date.now()+2000;let saved;
  while(Date.now()<deadline){saved=loadProject(project.id,cfg).jobs.find((item)=>item.id===job.id);if(saved?.status==='complete')break;await new Promise((resolve)=>setTimeout(resolve,20));}
  assert.equal(saved.status,'complete');assert.equal(saved.progress.percent,100);assert.ok(saved.events.length>=2);
});

test('persistent job queue cancels an active job through AbortSignal',async()=>{
  const workspaceDir=fs.mkdtempSync(path.join(os.tmpdir(),'vwt-cancel-'));
  const cfg={workspaceDir,renderer:'simple',width:320,height:180,fps:10,sceneTargetSec:2,sceneMinSec:1,sceneMaxSec:3,wordsPerMinute:150,contentLanguage:'en'};
  const project=createProject({title:'Cancel test',sourceText:'One short scene.',workflowMode:'auto'},cfg);
  const queue=new ProjectJobQueue({getConfig:()=>cfg,runners:{wait:async(_id,{signal})=>new Promise((resolve,reject)=>{
    const abort=()=>{const error=new Error('Cancelled');error.name='AbortError';reject(error);};
    if(signal.aborted)abort();else signal.addEventListener('abort',abort,{once:true});
  })}});
  const job=queue.enqueue(project.id,'wait',{});
  const runningDeadline=Date.now()+2000;
  while(Date.now()<runningDeadline){
    const saved=loadProject(project.id,cfg).jobs.find((item)=>item.id===job.id);
    if(saved?.status==='running')break;
    await new Promise((resolve)=>setTimeout(resolve,20));
  }
  assert.equal(queue.cancel(project.id,job.id).status,'cancelling');
  const cancelDeadline=Date.now()+2000;let saved;
  while(Date.now()<cancelDeadline){saved=loadProject(project.id,cfg).jobs.find((item)=>item.id===job.id);if(saved?.status==='cancelled')break;await new Promise((resolve)=>setTimeout(resolve,20));}
  assert.equal(saved.status,'cancelled');
});
