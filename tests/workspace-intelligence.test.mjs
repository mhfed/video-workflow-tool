import test from 'node:test';
import assert from 'node:assert/strict';
import {
  bestAvailableView,
  buildActionInbox,
  getNextAction,
} from '../apps/web/src/workspace-intelligence.mjs';

const copy={
  needsAttention:'Needs attention',outOfDate:'Out of date',sceneReady:'Ready',needsReview:'Needs review',inProgress:'In progress',sceneDraft:'Draft',
  reviseNarration:'Revise narration',reviseNarrationBody:'Narration needs changes',reviseVisual:'Revise visual',reviseVisualBody:'Visual needs changes',
  generateVoice:'Generate voice',generateVoiceBody:'Voice is missing',renderClip:'Render clip',renderClipBody:'Clip is missing',regenerate:'Regenerate',open:'Open',
  qualityNeedsReview:'Review quality flags',qualityNeedsReviewBody:'QA needs a decision',reviewClip:'Review clip',reviewClipBody:'Clip is ready',
  reviewVisual:'Review visual',reviewVisualBody:'Visual is ready',reviewVoice:'Review voice',reviewVoiceBody:'Voice is ready',approve:'Approve',
  approveNarration:'Approve narration',approveNarrationBody:'Narration is ready',generateVisual:'Generate visual',generateVisualBody:'Visual is missing',generate:'Generate',render:'Render',
  underMinute:'< 1 min',noProviderCost:'no provider cost',oneImageRequest:'1 image request',oneVoiceRequest:'1 voice request',oneLocalRender:'1 local render',
};

const scene=(overrides={})=>({
  id:'scene-001',review:{script:'approved',voice:'approved',visual:'approved',clip:'approved'},cache:{voice:'voice-key',image:'image-key'},artifacts:{clip:'clip.mp4'},...overrides,
});

test('best available preview prefers clip, then visual, voice, and script',()=>{
  assert.equal(bestAvailableView(scene()),'clip');
  assert.equal(bestAvailableView(scene({artifacts:{},cache:{image:'image-key',voice:'voice-key'}})),'visual');
  assert.equal(bestAvailableView(scene({artifacts:{},cache:{voice:'voice-key'}})),'voice');
  assert.equal(bestAvailableView(scene({artifacts:{},cache:{}})),'script');
});

test('quality warnings remain actionable after the clip is approved',()=>{
  const action=getNextAction(scene({quality:{status:'warn'}}),copy,true);
  assert.equal(action.kind,'quality');
  assert.equal(action.title,copy.qualityNeedsReview);
});

test('action inbox reports reason, ETA, and provider request cost per scene',()=>{
  const project={artifacts:{},scenes:[
    scene({id:'scene-001',review:{script:'changes-requested'},cache:{},artifacts:{}}),
    scene({id:'scene-002',review:{script:'approved'},cache:{},artifacts:{}}),
  ]};
  const inbox=buildActionInbox(project,copy);
  assert.deepEqual(inbox.map(({sceneId,kind,stage})=>({sceneId,kind,stage})),[
    {sceneId:'scene-001',kind:'edit',stage:'script'},
    {sceneId:'scene-002',kind:'run',stage:'visual'},
  ]);
  assert.deepEqual(inbox[0].estimate,{time:'< 1 min',cost:'no provider cost'});
  assert.deepEqual(inbox[1].estimate,{time:'~30s',cost:'1 image request'});
  assert.match(inbox[1].body,/Visual/);
});
