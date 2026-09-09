import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { ensureDir, nowIso, readJson, slugify, writeJson } from './utils.mjs';
import { planScriptScenes, planSrtScenes } from './scene-plan.mjs';
import { normalizeLanguage } from './languages.mjs';
import { normalizeWorkflow } from './workflow.mjs';
import { normalizeVideoFormat, videoFormatSettings } from './video-format.mjs';

export function projectDir(cfg, id) { return path.join(cfg.workspaceDir, id); }
export function projectFile(cfg, id) { return path.join(projectDir(cfg, id), 'project.json'); }
export function sceneDir(cfg, id, sceneId) { return path.join(projectDir(cfg, id), 'scenes', sceneId); }

export function createProject({ title, sourceText, sourceType = 'script', topic = '', workflowMode = 'studio', format = 'landscape' }, cfg) {
  if (!title?.trim()) throw new Error('title is required');
  if (!sourceText?.trim()) throw new Error('source text is required');
  const id = `${slugify(title)}-${crypto.randomBytes(3).toString('hex')}`;
  const planCfg={...cfg,format};
  const planned = sourceType === 'srt' ? planSrtScenes(sourceText, planCfg) : planScriptScenes(sourceText, planCfg);
  if (!planned.length) throw new Error('No scenes were generated');
  let cursor = 0;
  const scenes = planned.map((s, i) => {
    const durationMs = s.durationMs;
    const item = { id: `scene-${String(i + 1).padStart(3,'0')}`, index: i, text: s.text, startMs: cursor, endMs: cursor + durationMs, durationMs, sourceStartMs: s.sourceStartMs ?? null, sourceEndMs: s.sourceEndMs ?? null, visualPrompt: s.visualPrompt, status: 'planned', review: {script:'pending',voice:'pending',visual:'pending',clip:'pending'}, cache: {}, artifacts: {} };
    cursor += durationMs;
    return item;
  });
  const language=normalizeLanguage(cfg.contentLanguage);
  const project = { version: 3, id, title: title.trim(), createdAt: nowIso(), updatedAt: nowIso(), source: { type: sourceType, text: sourceText, topic: topic || null }, settings: { renderer: cfg.renderer, workflowMode, ...videoFormatSettings(format,cfg), fps: cfg.fps, language, captions: true, captionLanguage: language }, scenes, artifacts: {}, status: 'planned' };
  normalizeWorkflow(project);
  ensureDir(projectDir(cfg,id)); ensureDir(path.join(projectDir(cfg,id),'scenes'));
  fs.writeFileSync(path.join(projectDir(cfg,id), sourceType === 'srt' ? 'source.srt' : 'script.md'), sourceText);
  if(topic) fs.writeFileSync(path.join(projectDir(cfg,id),'topic.txt'),topic);
  saveProject(project,cfg);
  return project;
}

export function saveProject(project, cfg) { normalizeWorkflow(project); normalizeVideoFormat(project.settings,cfg); project.updatedAt = nowIso(); writeJson(projectFile(cfg,project.id), project); return project; }
export function loadProject(id,cfg) { const project=normalizeWorkflow(readJson(projectFile(cfg,id))); normalizeVideoFormat(project.settings,cfg); return project; }
export function listProjects(cfg) { ensureDir(cfg.workspaceDir); return fs.readdirSync(cfg.workspaceDir,{withFileTypes:true}).filter((e)=>e.isDirectory()).map((e)=>{ try { return loadProject(e.name,cfg); } catch { return null; } }).filter(Boolean).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)); }
export function updateTimeline(project) { let cursor=0; for (const scene of project.scenes) { scene.startMs=cursor; scene.endMs=cursor+scene.durationMs; cursor=scene.endMs; } return project; }
