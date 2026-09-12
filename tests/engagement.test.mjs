import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { applyHookVariant, buildRetentionPreflight, normalizeEngagementPlan, normalizeEngagementProposal } from '../packages/core/src/engagement.mjs';
import { invalidateScene } from '../packages/core/src/invalidation.mjs';
import { createProject, loadProject, saveProject } from '../packages/core/src/project.mjs';
import { visualPromptFor } from '../packages/core/src/scene-plan.mjs';

function fixture(t) {
  const workspaceDir=fs.mkdtempSync(path.join(os.tmpdir(),'vwt-engagement-'));
  t.after(()=>fs.rmSync(workspaceDir,{recursive:true,force:true}));
  return {workspaceDir,renderer:'simple',width:320,height:180,fps:10,sceneTargetSec:4,sceneMinSec:1,sceneMaxSec:6,wordsPerMinute:150,contentLanguage:'vi'};
}

test('projects normalize an additive engagement plan and preserve it across loads', (t) => {
  const cfg=fixture(t),project=createProject({title:'Vì sao ta trì hoãn',sourceText:'Bạn không thiếu ý chí. Não ưu tiên phần thưởng gần. Một bước nhỏ làm hành động dễ bắt đầu hơn.',brief:{targetViewer:'Người hay trì hoãn',viewerQuestion:'Vì sao tôi biết cần làm mà vẫn trì hoãn?',corePromise:'Hiểu cơ chế trì hoãn và biết cách bắt đầu',hook:'Bạn không thiếu ý chí.',desiredTakeaway:'Bắt đầu bằng một bước đủ nhỏ'}},cfg);
  assert.equal(project.engagementPlan.version,1);
  assert.equal(project.engagementPlan.promise,'Hiểu cơ chế trì hoãn và biết cách bắt đầu');
  assert.equal(project.engagementPlan.beats.length,project.scenes.length);
  assert.deepEqual(project.engagementPlan.beats.map((beat)=>beat.sceneId),project.scenes.map((scene)=>scene.id));
  assert.equal(project.engagementPlan.hookLab.variants.length,3);
  const once=structuredClone(project.engagementPlan);saveProject(project,cfg);
  assert.deepEqual(loadProject(project.id,cfg).engagementPlan,once);
  assert.deepEqual(normalizeEngagementPlan(once,project),once);
});

test('retention preflight reports explainable findings and maps them to the scene timeline', (t) => {
  const cfg=fixture(t),plannedScenes=[
    {text:'Cùng một ý được nhắc lại.',visualIntent:'Một hình giống nhau',durationMs:2000,narrativeRole:'hook'},
    {text:'Cùng một ý được nhắc lại và hãy đăng ký.',visualIntent:'Một hình giống nhau',durationMs:2000,narrativeRole:'explanation'},
    {text:'Bây giờ mới tới phần giải thích.',visualIntent:'Cơ chế được mở ra',durationMs:2000,narrativeRole:'turn'},
    {text:'Kết luận cuối cùng.',visualIntent:'Kết quả',durationMs:2000,narrativeRole:'resolution'},
  ],project=createProject({title:'Một chủ đề',sourceText:plannedScenes.map((scene)=>scene.text).join(' '),plannedScenes,format:'short'},cfg);
  project.engagementPlan.promise='';project.engagementPlan.payoff='';
  const report=buildRetentionPreflight(project);
  assert.equal(report.status,'warn');
  assert.ok(report.findings.every((item)=>item.id&&item.label&&item.note));
  assert.equal(report.journey.length,project.scenes.length);
  assert.deepEqual(report.journey.map((beat)=>[beat.startMs,beat.endMs]),project.scenes.map((scene)=>[scene.startMs,scene.endMs]));
  assert.equal(report.findings.find((item)=>item.id==='promise').status,'warn');
  assert.equal(report.findings.find((item)=>item.id==='cta-order').status,'warn');
});

test('engagement proposals stay provider-neutral and hook selection invalidates only the opening scene', (t) => {
  const cfg=fixture(t),project=createProject({title:'Hook test',sourceText:'Opening sentence. A second scene follows.'},cfg);
  while(project.scenes.length<2)project.scenes.push({...structuredClone(project.scenes[0]),id:`scene-00${project.scenes.length+1}`,index:project.scenes.length,startMs:project.scenes.at(-1).endMs,endMs:project.scenes.at(-1).endMs+project.scenes[0].durationMs});
  project.engagementPlan=normalizeEngagementProposal({promise:'A useful promise for the viewer.',payoff:'A concrete ending that fulfills it.',beats:project.scenes.map((scene)=>({sceneId:scene.id,newInformation:scene.text})),hookVariants:[{id:'new-hook',label:'New hook',hook:'A sharper opening question?',visualIntent:'A visible contradiction',reason:'Starts with tension.'}]},project);
  for(const scene of project.scenes){scene.cache={voice:`voice-${scene.id}`,image:`image-${scene.id}`,video:`video-${scene.id}`,clip:`clip-${scene.id}`};scene.artifacts={voice:'voice.mp3',visual:'visual.png',video:'video.mp4',clip:'clip.mp4'};}
  project.artifacts.final='output/final.mp4';const second=structuredClone(project.scenes[1]);
  const result=applyHookVariant(project,'new-hook',cfg,{invalidateScene,visualPromptFor});
  assert.equal(result.changed,true);assert.equal(project.scenes[0].text,'A sharper opening question?');
  assert.equal(project.scenes[0].cache.voice,undefined);assert.equal(project.scenes[0].cache.image,undefined);
  assert.deepEqual(project.scenes[1],second);assert.equal(project.artifacts.final,undefined);
  assert.equal(project.engagementPlan.hookLab.selectedVariantId,'new-hook');
});
