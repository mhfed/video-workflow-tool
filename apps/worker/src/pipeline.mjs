import fs from 'node:fs';
import path from 'node:path';
import { config } from '../../../packages/core/src/env.mjs';
import { loadProject, saveProject, sceneDir, projectDir, updateTimeline } from '../../../packages/core/src/project.mjs';
import { invalidateFinal } from '../../../packages/core/src/invalidation.mjs';
import { buildWebVtt } from '../../../packages/core/src/captions.mjs';
import { languageInfo, normalizeLanguage } from '../../../packages/core/src/languages.mjs';
import { sha256, fileExists, ensureDir, nowIso } from '../../../packages/core/src/utils.mjs';
import { probeDuration } from '../../../packages/core/src/media.mjs';
import { run } from '../../../packages/core/src/process.mjs';
import { containVideoFilter } from '../../../packages/core/src/video-fit.mjs';
import { markArtifactForReview, normalizeWorkflow, requireApproved } from '../../../packages/core/src/workflow.mjs';
import { createTakeTarget, recordTake } from '../../../packages/core/src/takes.mjs';
import { generateImage, imageCacheConfig } from '../../../packages/providers/src/image.mjs';
import { synthesizeVoice, voiceCacheConfig } from '../../../packages/providers/src/voice.mjs';
import { getRenderer, resolveRendererName } from '../../../packages/renderers/src/registry.mjs';

function log(event, detail={}) { console.log(JSON.stringify({time:new Date().toISOString(),event,...detail})); }
const effectiveProvider = (configured, cfg) => cfg.mockMode ? 'mock' : configured;
const RENDER_CONTRACT='contain-v2';

const abortIfNeeded=(signal)=>{if(signal?.aborted)throw Object.assign(new Error('Operation cancelled'),{name:'AbortError'});};
const artifactFile=(scene,project,cfg,kind)=>scene.artifacts?.[kind]?path.join(projectDir(cfg,project.id),scene.artifacts[kind]):null;

async function ensureVoice(scene, project, cfg, force=false,signal=null) {
  const dir=ensureDir(sceneDir(cfg,project.id,scene.id));
  const provider=effectiveProvider(cfg.voiceProvider,cfg);
  const key=sha256({text:scene.text,provider,...voiceCacheConfig(provider,cfg)});
  const current=artifactFile(scene,project,cfg,'voice');
  if (!force && scene.cache.voice===key && fileExists(current)) return current;
  const checkpoint=scene.operations?.voice;
  const jobId=checkpoint?.provider===provider&&checkpoint?.cacheKey===key?checkpoint.id:null;
  const target=createTakeTarget(dir,'voice','mp3',key),file=target.file;
  log('voice:start',{scene:scene.id,provider});
  await synthesizeVoice({provider,text:scene.text,outputFile:file,cfg,durationSec:scene.durationMs/1000,signal,jobId,onJob:({id,resumed})=>{
    scene.operations ||= {};
    const previous=scene.operations.voice;
    scene.operations.voice={provider,id,cacheKey:key,state:'processing',createdAt:previous?.id===id&&previous.createdAt?previous.createdAt:nowIso(),updatedAt:nowIso()};
    saveProject(project,cfg);
    log(resumed?'voice:resume':'voice:queued',{scene:scene.id,provider,jobId:id});
  }});
  scene.durationMs=Math.round((await probeDuration(file,cfg,{signal}))*1000);
  scene.cache.voice=key; recordTake(scene,'voice',{id:target.id,path:path.relative(projectDir(cfg,project.id),file),cacheKey:key,provider,durationMs:scene.durationMs}); scene.status='voice-ready'; markArtifactForReview(scene,'voice');
  if(scene.operations)delete scene.operations.voice;
  saveProject(updateTimeline(project),cfg); log('voice:done',{scene:scene.id,durationMs:scene.durationMs}); return file;
}

async function ensureImage(scene, project, cfg, force=false,signal=null) {
  const dir=ensureDir(sceneDir(cfg,project.id,scene.id));
  const renderer=resolveRendererName(scene,project,cfg);
  const adapter=getRenderer(renderer);
  if(adapter.prepareVisual){
    const prepared=await adapter.prepareVisual({scene,project,projectRoot:projectDir(cfg,project.id),cfg,signal});
    const key=prepared.cacheKey;
    if(!force&&scene.cache.image===key)return prepared.file;
    scene.cache.image=key;
    recordTake(scene,'visual',{cacheKey:key,provider:prepared.provider,label:prepared.label,meta:{source:scene.broll}});
    scene.status='visual-ready';markArtifactForReview(scene,'visual');saveProject(project,cfg);
    return prepared.file;
  }
  const provider=effectiveProvider(cfg.imageProvider,cfg);
  const key=sha256({prompt:scene.visualPrompt,provider,...imageCacheConfig(provider,cfg)});
  const current=artifactFile(scene,project,cfg,'visual');
  if (!force && scene.cache.image===key && (provider==='mock' || fileExists(current))) return provider==='mock' ? null : current;
  if (provider==='mock') { scene.cache.image=key; recordTake(scene,'visual',{cacheKey:key,provider,label:`Mock take ${scene.takes?.visual?.length+1||1}`}); markArtifactForReview(scene,'visual'); saveProject(project,cfg); return null; }
  const target=createTakeTarget(dir,'visual','png',key),file=target.file;
  log('image:start',{scene:scene.id,provider}); await generateImage({provider,prompt:scene.visualPrompt,outputFile:file,cfg,signal});
  scene.cache.image=key; recordTake(scene,'visual',{id:target.id,path:path.relative(projectDir(cfg,project.id),file),cacheKey:key,provider}); scene.status='visual-ready'; markArtifactForReview(scene,'visual'); saveProject(project,cfg); log('image:done',{scene:scene.id}); return file;
}

async function ensureVideo(scene, project, cfg, imageFile, force=false,signal=null) {
  const dir=ensureDir(sceneDir(cfg,project.id,scene.id));
  const renderer=resolveRendererName(scene,project,cfg);
  const adapter=getRenderer(renderer);
  const keyParts={renderer,renderContract:RENDER_CONTRACT,durationMs:scene.durationMs,image:scene.cache.image,text:scene.text,width:cfg.width,height:cfg.height,fps:cfg.fps,hand:adapter.cacheSignature(cfg)};
  if(adapter.renderCacheInputs)keyParts.rendererInputs=await adapter.renderCacheInputs({scene,project,projectRoot:projectDir(cfg,project.id),cfg,signal});
  const key=sha256(keyParts);
  const current=artifactFile(scene,project,cfg,'video');
  if (!force && scene.cache.video===key && fileExists(current)) return current;
  const target=createTakeTarget(dir,'video','mp4',key),file=target.file;
  log('render:start',{scene:scene.id,renderer});
  const args={scene,project,projectRoot:projectDir(cfg,project.id),imageFile,outputFile:file,durationSec:scene.durationMs/1000,cfg,signal};
  await adapter.render(args);
  scene.cache.video=key; recordTake(scene,'video',{id:target.id,path:path.relative(projectDir(cfg,project.id),file),cacheKey:key,provider:renderer}); scene.status='rendered'; saveProject(project,cfg); log('render:done',{scene:scene.id}); return file;
}

async function ensureClip(scene, project, cfg, videoFile, voiceFile, force=false,signal=null) {
  const dir=ensureDir(sceneDir(cfg,project.id,scene.id));
  const renderer=resolveRendererName(scene,project,cfg),adapter=getRenderer(renderer);
  const keyParts={video:scene.cache.video,voice:scene.cache.voice,fit:RENDER_CONTRACT,width:cfg.width,height:cfg.height,fps:cfg.fps};
  if(adapter.clipCacheInputs)keyParts.rendererInputs=await adapter.clipCacheInputs({scene,project,projectRoot:projectDir(cfg,project.id),cfg,signal});
  const key=sha256(keyParts);
  const current=artifactFile(scene,project,cfg,'clip');
  if (!force && scene.cache.clip===key && fileExists(current)) return current;
  const target=createTakeTarget(dir,'clip','mp4',key),file=target.file;
  if(adapter.mixAudio)await adapter.mixAudio({scene,project,projectRoot:projectDir(cfg,project.id),videoFile,voiceFile,outputFile:file,durationSec:scene.durationMs/1000,cfg,signal});
  else {
    const vf=containVideoFilter(cfg.width,cfg.height);
    await run(cfg.ffmpegBin,['-y','-i',videoFile,'-i',voiceFile,'-map','0:v:0','-map','1:a:0','-vf',vf,'-r',String(cfg.fps),'-c:v','libx264','-preset','medium','-crf','18','-c:a','aac','-b:a','192k','-shortest','-movflags','+faststart',file],{capture:true,signal});
  }
  scene.cache.clip=key; recordTake(scene,'clip',{id:target.id,path:path.relative(projectDir(cfg,project.id),file),cacheKey:key,provider:'ffmpeg'}); scene.status='ready'; markArtifactForReview(scene,'clip'); saveProject(project,cfg); return file;
}

async function concatClips(project,cfg,clips,signal=null) {
  const outDir=ensureDir(path.join(projectDir(cfg,project.id),'output'));
  const list=path.join(outDir,'concat.txt');
  const final=path.join(outDir,'final.mp4');
  const joined=path.join(outDir,'joined.mp4');
  const captions=path.join(outDir,'captions.vtt');
  const captionsEnabled=project.settings?.captions!==false;
  const captionLanguage=normalizeLanguage(project.settings?.captionLanguage||project.settings?.language||cfg.contentLanguage);
  const embeddedLanguage=languageInfo(captionLanguage).mp4Code;
  fs.writeFileSync(list,clips.map((f)=>`file '${f.replaceAll("'","'\\''")}'`).join('\n')+'\n');
  await run(cfg.ffmpegBin,['-y','-f','concat','-safe','0','-i',list,'-c','copy','-movflags','+faststart',captionsEnabled?joined:final],{capture:true,signal});
  if(captionsEnabled) {
    fs.writeFileSync(captions,buildWebVtt(project));
    try {
      await run(cfg.ffmpegBin,['-y','-i',joined,'-i',captions,'-map','0:v:0','-map','0:a:0?','-map','1:0','-c:v','copy','-c:a','copy','-c:s','mov_text','-metadata:s:s:0',`language=${embeddedLanguage}`,'-disposition:s:0','default','-movflags','+faststart',final],{capture:true,signal});
    } finally { fs.rmSync(joined,{force:true}); }
    project.artifacts.captions=path.relative(projectDir(cfg,project.id),captions);
  } else {
    delete project.artifacts.captions;
    fs.rmSync(captions,{force:true});
  }
  project.artifacts.final=path.relative(projectDir(cfg,project.id),final); project.status='complete'; saveProject(project,cfg); return final;
}

export async function runPipeline(projectId,{force=false,sceneId=null,sceneIds=null,stage='all',signal=null,onProgress=null}={}) {
  const baseCfg=config(); const project=normalizeWorkflow(loadProject(projectId,baseCfg));
  const cfg={...baseCfg,width:project.settings.width,height:project.settings.height,fps:project.settings.fps,openaiImageSize:project.settings.format==='short'?'1024x1536':baseCfg.openaiImageSize}; const clips=[];
  const studio=project.settings.workflowMode==='studio';
  const targets=sceneId?[sceneId]:Array.isArray(sceneIds)?[...new Set(sceneIds)]:null;
  if(!['voice','visual','clip','final','all'].includes(stage))throw new Error(`Unsupported pipeline stage: ${stage}`);
  if(targets&&!targets.length)throw new Error('Choose at least one scene to run.');
  if(targets&&stage==='final')throw new Error('Final assembly always runs at project scope.');
  if(studio&&stage==='all')throw new Error('Studio mode runs one reviewed stage at a time. Switch to Auto run for an end-to-end render.');
  if(targets?.some((id)=>!project.scenes.some((scene)=>scene.id===id)))throw new Error('One or more selected scenes do not exist.');
  const selectedCount=targets?.length||project.scenes.length;
  const total=stage==='voice'||stage==='visual'?selectedCount:stage==='clip'?selectedCount*4:stage==='final'?1:selectedCount*4+1;
  let completed=0;
  const emit=async(detail)=>{const event={...detail,completed,total,percent:Math.round(completed/Math.max(1,total)*100)};await onProgress?.(event);};
  const step=async(detail,operation)=>{abortIfNeeded(signal);await emit(detail);const value=await operation();completed++;await emit({...detail,message:`${detail.message} — done`});return value;};
  if (targets) { invalidateFinal(project); saveProject(project,cfg); }
  for (const scene of project.scenes) {
    if (targets && !targets.includes(scene.id)) { if (scene.artifacts.clip) clips.push(path.join(projectDir(cfg,project.id),scene.artifacts.clip)); continue; }
    if(stage==='final')continue;
    if(studio)requireApproved(scene,['script'],`generating ${stage==='all'?'media':stage}`);
    if(stage==='voice'){await step({stage:'voice',sceneId:scene.id,message:`Generating voice for scene ${scene.index+1}`},()=>ensureVoice(scene,project,cfg,force,signal));continue;}
    if(stage==='visual'){await step({stage:'visual',sceneId:scene.id,message:`Generating visual for scene ${scene.index+1}`},()=>ensureImage(scene,project,cfg,force,signal));continue;}
    if(studio&&stage==='clip')requireApproved(scene,['voice','visual'],'rendering the clip');
    const voice=await step({stage:'voice',sceneId:scene.id,message:`Generating voice for scene ${scene.index+1}`},()=>ensureVoice(scene,project,cfg,force,signal));
    const image=await step({stage:'visual',sceneId:scene.id,message:`Generating visual for scene ${scene.index+1}`},()=>ensureImage(scene,project,cfg,force,signal));
    if(studio&&stage==='clip')requireApproved(scene,['voice','visual'],'rendering the clip');
    const video=await step({stage:'render',sceneId:scene.id,message:`Rendering scene ${scene.index+1}`},()=>ensureVideo(scene,project,cfg,image,force,signal));
    const clip=await step({stage:'clip',sceneId:scene.id,message:`Mixing scene ${scene.index+1}`},()=>ensureClip(scene,project,cfg,video,voice,force,signal)); clips.push(clip);
  }
  if (targets || stage!=='all'&&stage!=='final') return {project:loadProject(projectId,cfg),final:null};
  if(studio)for(const scene of project.scenes)requireApproved(scene,['clip'],'assembling the final cut');
  const allClips=project.scenes.map((s)=>s.artifacts.clip ? path.join(projectDir(cfg,project.id),s.artifacts.clip) : null);
  if (allClips.some((x)=>!x || !fileExists(x))) throw new Error('Not all scenes have final clips');
  const final=await step({stage:'final',sceneId:null,message:'Assembling final cut'},()=>concatClips(project,cfg,allClips,signal)); log('pipeline:complete',{project:project.id,final}); return {project:loadProject(project.id,cfg),final};
}
