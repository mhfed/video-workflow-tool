import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeDirectorProposal, planSceneDirection } from '../packages/providers/src/director.mjs';

const project={title:'Demo',settings:{language:'vi',format:'landscape',renderer:'simple'}};
const scene={id:'scene-001',text:'Một câu khá dài để thử.',visualIntent:'Một người đang suy nghĩ.',durationMs:4000};
const cfg={mockMode:true,textProvider:'mock',contentLanguage:'vi'};

test('mock Director turns plain visual direction into a scoped proposal',async()=>{
  const proposal=await planSceneDirection({instruction:'Cho nhân vật đứng dưới mưa, góc máy rộng',scene,project,cfg});
  assert.equal(proposal.action,'update_scene');
  assert.match(proposal.changes.visualIntent,/đứng dưới mưa/);
  assert.deepEqual(proposal.impact,['visual','clip','final']);
});

test('mock Director recognizes an explicit scene split',async()=>{
  const proposal=await planSceneDirection({instruction:'Tách cảnh này thành hai cảnh',scene,project,cfg});
  assert.equal(proposal.action,'split_scene');
  assert.ok(proposal.impact.includes('voice'));
});

test('Director proposals discard unsupported actions and stages',()=>{
  const proposal=normalizeDirectorProposal({action:'delete_project',impact:['voice','secrets'],changes:{text:' ok '}},'vi');
  assert.equal(proposal.action,'noop');
  assert.deepEqual(proposal.impact,['voice']);
  assert.equal(proposal.changes.text,'ok');
});

