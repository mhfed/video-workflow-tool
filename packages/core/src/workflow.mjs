import { normalizeTakes } from './takes.mjs';
import { normalizePenAppearance } from './pen-settings.mjs';
import { normalizeContentProject, normalizeMemory } from './content-contract.mjs';
import { normalizeEngagementPlan } from './engagement.mjs';

export const WORKFLOW_MODES = new Set(['auto','studio']);
export const REVIEW_STAGES = ['script','voice','visual','clip'];
export const REVIEW_DECISIONS = new Set(['pending','approved','changes-requested','stale']);

export function normalizeWorkflow(project) {
  normalizeContentProject(project);
  project.version=Math.max(Number(project.version)||1,7);
  project.settings ||= {};
  if (!WORKFLOW_MODES.has(project.settings.workflowMode)) project.settings.workflowMode='studio';
  project.settings.pen=normalizePenAppearance(project.settings.pen);
  project.memory=normalizeMemory(project.memory);
  project.jobs=Array.isArray(project.jobs)?project.jobs:[];
  project.history ||= {undo:[],redo:[]};
  project.history.undo=Array.isArray(project.history.undo)?project.history.undo:[];
  project.history.redo=Array.isArray(project.history.redo)?project.history.redo:[];
  for (const scene of project.scenes || []) {
    if(typeof scene.visualIntent!=='string'||!scene.visualIntent.trim())scene.visualIntent=scene.text||'';
    scene.review ||= {};
    for (const stage of REVIEW_STAGES) {
      if (!REVIEW_DECISIONS.has(scene.review[stage])) scene.review[stage]='pending';
    }
    normalizeTakes(scene);
  }
  project.engagementPlan=normalizeEngagementPlan(project.engagementPlan,project);
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
