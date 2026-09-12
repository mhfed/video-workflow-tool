import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { applyPackagingVariant, buildPackagingPreflight, normalizePackaging, normalizePackagingProposal, selectPackagingVariant } from '../packages/core/src/packaging.mjs';
import { invalidateScene } from '../packages/core/src/invalidation.mjs';
import { createProject, loadProject, saveProject } from '../packages/core/src/project.mjs';
import { visualPromptFor } from '../packages/core/src/scene-plan.mjs';

function fixture(t) {
  const workspaceDir=fs.mkdtempSync(path.join(os.tmpdir(),'vwt-packaging-'));
  t.after(()=>fs.rmSync(workspaceDir,{recursive:true,force:true}));
  return {workspaceDir,renderer:'simple',width:320,height:180,fps:10,sceneTargetSec:4,sceneMinSec:1,sceneMaxSec:6,wordsPerMinute:150,contentLanguage:'vi'};
}

test('packaging contract normalizes three provider-neutral concepts and survives reload', (t) => {
  const cfg=fixture(t),project=createProject({title:'Vì sao ta trì hoãn',sourceText:'Bạn không thiếu ý chí. Não ưu tiên phần thưởng gần. Một bước nhỏ giúp bạn bắt đầu.',brief:{targetViewer:'Người hay trì hoãn',corePromise:'Hiểu cơ chế trì hoãn và biết cách bắt đầu',desiredTakeaway:'Bắt đầu bằng một bước đủ nhỏ'}},cfg);
  assert.equal(project.packaging.version,1);
  assert.equal(project.packaging.variants.length,3);
  const proposed=normalizePackagingProposal({variants:[
    {id:'package-a',title:'Bạn không thiếu ý chí',thumbnailDirection:'Một người đối diện nút bắt đầu',thumbnailText:'BẮT ĐẦU',focalPoint:'Nút bắt đầu',promise:'Hiểu cách bắt đầu',curiosityMechanism:'Đảo ngược niềm tin',targetViewer:'Người hay trì hoãn',hook:'Bạn không thiếu ý chí.'},
    {id:'package-b',title:'Vì sao bạn vẫn trì hoãn?',thumbnailDirection:'Đồng hồ đối lập danh sách việc',thumbnailText:'VÌ SAO?',focalPoint:'Đồng hồ',promise:'Hiểu cách bắt đầu',curiosityMechanism:'Câu hỏi',targetViewer:'Người hay trì hoãn',hook:'Vì sao biết cần làm mà ta vẫn trì hoãn?'},
    {id:'package-c',title:'Một bước phá vòng trì hoãn',thumbnailDirection:'Một bước chân qua vạch',thumbnailText:'CHỈ 1 BƯỚC',focalPoint:'Bước chân',promise:'Hiểu cách bắt đầu',curiosityMechanism:'Kết quả cụ thể',targetViewer:'Người hay trì hoãn',hook:'Một bước đủ nhỏ có thể phá vòng trì hoãn.'},
  ]},project);
  project.packaging=proposed;saveProject(project,cfg);
  assert.deepEqual(loadProject(project.id,cfg).packaging,proposed);
  assert.deepEqual(normalizePackaging(proposed,project),proposed);
});

test('packaging preflight explains mobile legibility and promise alignment', (t) => {
  const cfg=fixture(t),project=createProject({title:'Một tiêu đề',sourceText:'Nội dung thực tế giải thích một bước nhỏ để bắt đầu.',brief:{corePromise:'Biết một bước nhỏ để bắt đầu',desiredTakeaway:'Bắt đầu bằng một bước nhỏ'}},cfg);
  project.packaging=normalizePackagingProposal({variants:[{id:'too-long',title:'Một tiêu đề cực kỳ rất dài với quá nhiều từ không cần thiết khiến người xem khó đọc trên điện thoại',thumbnailDirection:'Không rõ chủ thể',thumbnailText:'QUÁ NHIỀU CHỮ TRÊN MỘT THUMBNAIL NHỎ',promise:'Một lời hứa không liên quan',hook:'Một đoạn mở khác hẳn'}]},project);
  const report=buildPackagingPreflight(project,'too-long');
  assert.equal(report.status,'warn');
  assert.equal(report.findings.find((item)=>item.id==='title-length').status,'warn');
  assert.equal(report.findings.find((item)=>item.id==='thumbnail-legibility').status,'warn');
  assert.ok(report.findings.every((item)=>item.label&&item.note));
});

test('selecting packaging never invalidates media; explicit hook apply invalidates only opening scene', (t) => {
  const cfg=fixture(t),project=createProject({title:'Original',sourceText:'Opening sentence. A second scene follows.',plannedScenes:[{text:'Opening sentence.',durationMs:2000},{text:'A second scene follows.',durationMs:2000}]},cfg);
  project.packaging=normalizePackagingProposal({variants:[{id:'package-a',title:'New title',thumbnailDirection:'One focal image',thumbnailText:'LOOK',focalPoint:'Face',promise:'A concrete useful promise',curiosityMechanism:'Question',targetViewer:'Curious viewers',hook:'A sharper opening question?'}]},project);
  for(const scene of project.scenes){scene.cache={voice:`voice-${scene.id}`,image:`image-${scene.id}`,video:`video-${scene.id}`,clip:`clip-${scene.id}`};scene.artifacts={voice:'voice.mp3',visual:'visual.png',video:'video.mp4',clip:'clip.mp4'};}
  project.artifacts.final='output/final.mp4';const before=structuredClone(project);
  selectPackagingVariant(project,'package-a');
  assert.deepEqual(project.scenes,before.scenes);assert.deepEqual(project.artifacts,before.artifacts);assert.equal(project.title,'Original');
  const second=structuredClone(project.scenes[1]);
  applyPackagingVariant(project,'package-a',cfg,{applyTitle:true,applyHook:true,invalidateScene,visualPromptFor});
  assert.equal(project.title,'New title');assert.equal(project.scenes[0].text,'A sharper opening question?');
  assert.equal(project.scenes[0].cache.voice,undefined);assert.deepEqual(project.scenes[1],second);assert.equal(project.artifacts.final,undefined);
});
