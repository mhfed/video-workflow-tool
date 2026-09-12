import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { ensureDir, nowIso, readJson, slugify, writeJson } from './utils.mjs';
import { estimateDurationSec, planScriptScenes, planSrtScenes, visualPromptFor } from './scene-plan.mjs';
import { normalizeLanguage } from './languages.mjs';
import { normalizeWorkflow } from './workflow.mjs';
import { normalizeVideoFormat, videoFormatSettings } from './video-format.mjs';
import { invalidateFinal, invalidateScene } from './invalidation.mjs';
import { DEFAULT_PEN_APPEARANCE } from './pen-settings.mjs';
import { loadChannel } from './channel.mjs';
import { projectChannelFields, snapshotChannel } from './channel-inheritance.mjs';
import { normalizeBrief, normalizeMemory } from './content-contract.mjs';

export function projectDir(cfg, id) { return path.join(cfg.workspaceDir, id); }
export function projectFile(cfg, id) { return path.join(projectDir(cfg, id), 'project.json'); }
export function sceneDir(cfg, id, sceneId) { return path.join(projectDir(cfg, id), 'scenes', sceneId); }

export function createProject({ title, sourceText, sourceType = 'script', topic = '', workflowMode = 'studio', format, plannedScenes = null, channelId = null, channel = null, channelSnapshot = null, brief = null, ideaId = null, ideaSource = null, memory: videoMemory = {}, productionSettings = {} }, cfg) {
  if (!title?.trim()) throw new Error('title is required');
  if (!sourceText?.trim()) throw new Error('source text is required');
  const id = `${slugify(title)}-${crypto.randomBytes(3).toString('hex')}`;
  const inherited = channelSnapshot || (channel || channelId ? snapshotChannel(channel || loadChannel(channelId, cfg), cfg) : null);
  const contentBrief = normalizeBrief(brief);
  format ||= contentBrief?.format || inherited?.resolved.settings.format || 'landscape';
  const memory=normalizeMemory({...inherited?.resolved.memory,...videoMemory});
  const planCfg={...cfg,format,memory};
  const planned = Array.isArray(plannedScenes)&&plannedScenes.length?plannedScenes:sourceType === 'srt' ? planSrtScenes(sourceText, planCfg) : planScriptScenes(sourceText, planCfg);
  if (!planned.length) throw new Error('No scenes were generated');
  let cursor = 0;
  const scenes = planned.map((s, i) => {
    const durationMs = s.durationMs;
    const intent=s.visualIntent||s.text;
    const item = { id: `scene-${String(i + 1).padStart(3,'0')}`, index: i, text: s.text, visualIntent:intent, narrativeRole:s.narrativeRole||null, startMs: cursor, endMs: cursor + durationMs, durationMs, sourceStartMs: s.sourceStartMs ?? null, sourceEndMs: s.sourceEndMs ?? null, visualPrompt: s.visualPrompt||visualPromptFor(s.text,{...planCfg,memory},intent), status: 'planned', review: {script:'pending',voice:'pending',visual:'pending',clip:'pending'}, cache: {}, artifacts: {}, takes:{}, selectedTakes:{} };
    cursor += durationMs;
    return item;
  });
  const language=normalizeLanguage(productionSettings.language || inherited?.resolved.settings.language || cfg.contentLanguage);
  const settings = { renderer: cfg.renderer, workflowMode, fps: cfg.fps, language, captions: true, captionLanguage: language, pen:{...DEFAULT_PEN_APPEARANCE}, ...inherited?.resolved.settings, ...productionSettings, ...videoFormatSettings(format,cfg) };
  if (contentBrief?.targetDurationSec && productionSettings.targetDurationSec === undefined) settings.targetDurationSec = contentBrief.targetDurationSec;
  const project = { version: 7, id, title: title.trim(), createdAt: nowIso(), updatedAt: nowIso(), source: { type: sourceType, text: sourceText, topic: topic || null }, settings, memory, scenes, artifacts: {}, jobs:[], history:{undo:[],redo:[]}, quality:{status:'unchecked'}, status: 'planned', ...projectChannelFields(inherited), brief: contentBrief, ideaId, ideaSource };
  normalizeWorkflow(project);
  ensureDir(projectDir(cfg,id)); ensureDir(path.join(projectDir(cfg,id),'scenes'));
  fs.writeFileSync(path.join(projectDir(cfg,id), sourceType === 'srt' ? 'source.srt' : 'script.md'), sourceText);
  if(topic) fs.writeFileSync(path.join(projectDir(cfg,id),'topic.txt'),topic);
  saveProject(project,cfg);
  return project;
}

export function saveProject(project, cfg) { normalizeWorkflow(project); normalizeVideoFormat(project.settings,cfg); project.updatedAt = nowIso(); writeJson(projectFile(cfg,project.id), project); return project; }
export function loadProject(id,cfg) { const project=normalizeWorkflow(readJson(projectFile(cfg,id))); normalizeVideoFormat(project.settings,cfg); return project; }
export function listProjects(cfg, { channelId } = {}) { ensureDir(cfg.workspaceDir); return fs.readdirSync(cfg.workspaceDir,{withFileTypes:true}).filter((e)=>e.isDirectory()&&!e.name.startsWith('.')).map((e)=>{ try { return loadProject(e.name,cfg); } catch { return null; } }).filter((project)=>project&&(channelId===undefined||project.channelId===(channelId||null))).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)); }
export function deleteProject(id,cfg) {
  const workspace=path.resolve(cfg.workspaceDir),target=path.resolve(workspace,String(id||''));
  if(target===workspace||path.dirname(target)!==workspace)throw new Error('Invalid project id.');
  const project=loadProject(id,cfg);
  fs.rmSync(target,{recursive:true,force:false});
  return project;
}
export function updateTimeline(project) { let cursor=0; for (const scene of project.scenes) { scene.startMs=cursor; scene.endMs=cursor+scene.durationMs; cursor=scene.endMs; } return project; }

function nextSceneId(project) {
  const used=new Set(project.scenes.map((scene)=>scene.id));
  let number=Math.max(0,...project.scenes.map((scene)=>Number(scene.id.match(/^scene-(\d+)$/)?.[1]||0)))+1;
  while(used.has(`scene-${String(number).padStart(3,'0')}`))number++;
  return `scene-${String(number).padStart(3,'0')}`;
}

function sceneDuration(text,cfg) {
  const seconds=estimateDurationSec(text,cfg.wordsPerMinute||150);
  return Math.round(Math.min(cfg.sceneMaxSec||12,Math.max(cfg.sceneMinSec||2,seconds))*1000);
}

function newScene(project,{text,visualIntent,renderer},cfg) {
  const narration=String(text||'Cảnh mới').trim();
  const intent=String(visualIntent||narration).trim();
  return {id:nextSceneId(project),index:0,text:narration,visualIntent:intent,startMs:0,endMs:0,durationMs:sceneDuration(narration,cfg),sourceStartMs:null,sourceEndMs:null,visualPrompt:visualPromptFor(narration,{...cfg,format:project.settings?.format,memory:project.memory},intent),...(renderer?{renderer}:{}),status:'planned',review:{script:'pending',voice:'pending',visual:'pending',clip:'pending'},cache:{},artifacts:{},takes:{},selectedTakes:{}};
}

function finishStructureChange(project) {
  project.scenes.forEach((scene,index)=>{scene.index=index;});
  updateTimeline(project);
  invalidateFinal(project);
  return project;
}

export function insertScene(project,{afterSceneId=null,text='',visualIntent='',renderer=null}={},cfg) {
  const scene=newScene(project,{text,visualIntent,renderer},cfg);
  const afterIndex=afterSceneId?project.scenes.findIndex((item)=>item.id===afterSceneId):-1;
  project.scenes.splice(afterIndex<0?project.scenes.length:afterIndex+1,0,scene);
  finishStructureChange(project);
  return scene;
}

export function duplicateScene(project,sceneId,cfg) {
  const index=project.scenes.findIndex((scene)=>scene.id===sceneId);
  if(index<0)throw new Error('scene not found');
  const source=project.scenes[index];
  const scene=newScene(project,{text:source.text,visualIntent:source.visualIntent,renderer:source.renderer},cfg);
  project.scenes.splice(index+1,0,scene);
  finishStructureChange(project);
  return scene;
}

function splitPoint(text,requested) {
  const source=String(text||'').trim();
  if(Number.isInteger(requested)&&requested>0&&requested<source.length)return requested;
  const middle=Math.floor(source.length/2);
  const lower=Math.floor(source.length*.22),upper=Math.ceil(source.length*.78),punctuation=[],spaces=[];
  for(let index=1;index<source.length-1;index++){
    if(index<lower||index>upper)continue;
    if(/[.!?;,:]/.test(source[index])&&/\s/.test(source[index+1]||''))punctuation.push(index+1);
    else if(/\s/.test(source[index]))spaces.push(index+1);
  }
  const nearest=(items)=>items.sort((a,b)=>Math.abs(a-middle)-Math.abs(b-middle))[0];
  return nearest(punctuation)||nearest(spaces)||middle;
}

export function splitScene(project,sceneId,cfg,{at=null}={}) {
  const index=project.scenes.findIndex((scene)=>scene.id===sceneId);
  if(index<0)throw new Error('scene not found');
  const source=project.scenes[index];
  const originalText=source.text,originalIntent=source.visualIntent||source.text;
  const point=splitPoint(source.text,at);
  const firstText=source.text.slice(0,point).trim();
  const secondText=source.text.slice(point).trim();
  if(!firstText||!secondText)throw new Error('Scene needs more text before it can be split.');
  const intentWasNarration=originalIntent===originalText;
  const firstIntent=intentWasNarration?firstText:`${originalIntent} — nhịp 1`;
  const secondIntent=intentWasNarration?secondText:`${originalIntent} — nhịp 2`;
  source.text=firstText;source.visualIntent=firstIntent;source.durationMs=sceneDuration(firstText,cfg);source.visualPrompt=visualPromptFor(firstText,{...cfg,format:project.settings?.format,memory:project.memory},firstIntent);
  invalidateScene(project,source,{textChanged:true,promptChanged:true});
  const second=newScene(project,{text:secondText,visualIntent:secondIntent,renderer:source.renderer},cfg);
  project.scenes.splice(index+1,0,second);
  finishStructureChange(project);
  return {first:source,second};
}

export function mergeSceneWithNext(project,sceneId,cfg) {
  const index=project.scenes.findIndex((scene)=>scene.id===sceneId);
  if(index<0)throw new Error('scene not found');
  if(index>=project.scenes.length-1)throw new Error('There is no next scene to merge.');
  const scene=project.scenes[index],next=project.scenes[index+1];
  scene.text=`${scene.text} ${next.text}`.trim();
  scene.visualIntent=`${scene.visualIntent||scene.text} ${next.visualIntent||next.text}`.trim();
  scene.durationMs=sceneDuration(scene.text,cfg);
  scene.visualPrompt=visualPromptFor(scene.text,{...cfg,format:project.settings?.format,memory:project.memory},scene.visualIntent);
  invalidateScene(project,scene,{textChanged:true,promptChanged:true});
  project.scenes.splice(index+1,1);
  finishStructureChange(project);
  return scene;
}

export function removeScene(project,sceneId) {
  if(project.scenes.length<=1)throw new Error('A project must keep at least one scene.');
  const index=project.scenes.findIndex((scene)=>scene.id===sceneId);
  if(index<0)throw new Error('scene not found');
  const [removed]=project.scenes.splice(index,1);
  finishStructureChange(project);
  return removed;
}

export function moveScene(project,sceneId,direction) {
  const index=project.scenes.findIndex((scene)=>scene.id===sceneId);
  if(index<0)throw new Error('scene not found');
  const target=direction==='up'?index-1:direction==='down'?index+1:Number(direction);
  if(!Number.isInteger(target)||target<0||target>=project.scenes.length)return project.scenes[index];
  const [scene]=project.scenes.splice(index,1);project.scenes.splice(target,0,scene);
  finishStructureChange(project);
  return scene;
}
