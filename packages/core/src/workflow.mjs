import { normalizeTakes } from './takes.mjs';

export const WORKFLOW_MODES = new Set(['auto','studio']);
export const REVIEW_STAGES = ['script','voice','visual','clip'];
export const REVIEW_DECISIONS = new Set(['pending','approved','changes-requested','stale']);

function normalizeMemory(memory={}) {
  return {
    characters:Array.isArray(memory.characters)?memory.characters.map(String).filter(Boolean).slice(0,30):[],
    palette:Array.isArray(memory.palette)?memory.palette.map(String).filter(Boolean).slice(0,12):[],
    artDirection:typeof memory.artDirection==='string'?memory.artDirection:'',
    pronunciations:Array.isArray(memory.pronunciations)?memory.pronunciations.map(String).filter(Boolean).slice(0,50):[]
  };
}

export function normalizeWorkflow(project) {
  project.version=Math.max(Number(project.version)||1,6);
  project.settings ||= {};
  if (!WORKFLOW_MODES.has(project.settings.workflowMode)) project.settings.workflowMode='studio';
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
