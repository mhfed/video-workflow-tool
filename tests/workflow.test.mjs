import test from 'node:test';
import assert from 'node:assert/strict';
import { markArtifactForReview, normalizeWorkflow, requireApproved, setReviewDecision } from '../packages/core/src/workflow.mjs';

const fixture=()=>({settings:{},scenes:[{id:'scene-001'}]});

test('legacy projects default to Studio with explicit review checkpoints',()=>{
  const project=normalizeWorkflow(fixture());
  assert.equal(project.settings.workflowMode,'studio');
  assert.deepEqual(project.scenes[0].review,{script:'pending',voice:'pending',visual:'pending',clip:'pending'});
});

test('rejecting an upstream stage makes dependent approvals stale',()=>{
  const project=normalizeWorkflow(fixture()); const scene=project.scenes[0];
  scene.review={script:'approved',voice:'approved',visual:'approved',clip:'approved'};
  setReviewDecision(project,scene,'voice','changes-requested');
  assert.equal(scene.review.voice,'changes-requested');
  assert.equal(scene.review.clip,'stale');
  assert.equal(scene.review.visual,'approved');
});

test('newly generated artifacts return to review and stale the dependent clip',()=>{
  const scene={review:{voice:'changes-requested',clip:'approved'}};
  markArtifactForReview(scene,'voice');
  assert.equal(scene.review.voice,'pending');
  assert.equal(scene.review.clip,'stale');
  scene.review.voice='approved';
  markArtifactForReview(scene,'voice');
  assert.equal(scene.review.voice,'pending');
});

test('approval guard reports the missing creative decisions',()=>{
  const scene={id:'scene-001',review:{voice:'approved',visual:'pending'}};
  assert.throws(()=>requireApproved(scene,['voice','visual'],'rendering the clip'),/Approve visual/);
});
