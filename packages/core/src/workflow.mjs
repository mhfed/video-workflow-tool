export const WORKFLOW_MODES = new Set(['auto','studio']);
export const REVIEW_STAGES = ['script','voice','visual','clip'];
export const REVIEW_DECISIONS = new Set(['pending','approved','changes-requested','stale']);

export function normalizeWorkflow(project) {
  project.version=Math.max(Number(project.version)||1,4);
  project.settings ||= {};
  if (!WORKFLOW_MODES.has(project.settings.workflowMode)) project.settings.workflowMode='studio';
  for (const scene of project.scenes || []) {
    if(typeof scene.visualIntent!=='string'||!scene.visualIntent.trim())scene.visualIntent=scene.text||'';
    scene.review ||= {};
    for (const stage of REVIEW_STAGES) {
      if (!REVIEW_DECISIONS.has(scene.review[stage])) scene.review[stage]='pending';
    }
  }
  return project;
}

export function setReviewDecision(project, scene, stage, decision) {
  if (!REVIEW_STAGES.includes(stage)) throw new Error(`Unsupported review stage: ${stage}`);
  if (!REVIEW_DECISIONS.has(decision)) throw new Error(`Unsupported review decision: ${decision}`);
  normalizeWorkflow(project);
  scene.review[stage]=decision;
  if (stage==='script' && decision!=='approved') {
    scene.review.voice='stale';
    scene.review.visual='stale';
    scene.review.clip='stale';
  }
  if ((stage==='voice'||stage==='visual') && decision!=='approved') scene.review.clip='stale';
  return project;
}

export function requireApproved(scene, stages, action) {
  const missing=stages.filter((stage)=>scene.review?.[stage]!=='approved');
  if (missing.length) throw new Error(`Approve ${missing.join(' and ')} for ${scene.id} before ${action}.`);
}

export function markArtifactForReview(scene, stage) {
  scene.review ||= {};
  scene.review[stage]='pending';
  if (stage==='voice'||stage==='visual') scene.review.clip='stale';
  return scene;
}
