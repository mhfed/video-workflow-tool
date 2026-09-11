import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../../../packages/core/src/env.mjs';
import { updateEnvFile } from '../../../packages/core/src/env-file.mjs';
import { createProject, duplicateScene, insertScene, listProjects, loadProject, mergeSceneWithNext, moveScene, removeScene, saveProject, splitScene, projectDir } from '../../../packages/core/src/project.mjs';
import { invalidateRenderedMedia, invalidateScene } from '../../../packages/core/src/invalidation.mjs';
import { visualPromptFor } from '../../../packages/core/src/scene-plan.mjs';
import { SUPPORTED_RENDERERS } from '../../../packages/core/src/validate-config.mjs';
import { SUPPORTED_LANGUAGES } from '../../../packages/core/src/languages.mjs';
import { SUPPORTED_VIDEO_FORMATS, videoFormatSettings } from '../../../packages/core/src/video-format.mjs';
import { setReviewDecision, WORKFLOW_MODES } from '../../../packages/core/src/workflow.mjs';
import { buildRoughCutManifest } from '../../../packages/core/src/rough-cut.mjs';
import { buildRepairPlan } from '../../../packages/core/src/repair-plan.mjs';
import { recordHistory, redoProject, undoProject } from '../../../packages/core/src/history.mjs';
import { selectTake } from '../../../packages/core/src/takes.mjs';
import { generateScriptOpenAI, planNarrativeBeatsOpenAI } from '../../../packages/providers/src/openai.mjs';
import { generateScriptMock } from '../../../packages/providers/src/mock.mjs';
import { listVivibeVoices } from '../../../packages/providers/src/vivibe.mjs';
import { planSceneDirection } from '../../../packages/providers/src/director.mjs';
import { brollProviderNames, searchBroll } from '../../../packages/providers/src/broll.mjs';
import { runPipeline } from '../../worker/src/pipeline.mjs';
import { ProjectJobQueue } from '../../worker/src/job-queue.mjs';
import { runQualityChecks, runRepairActions } from '../../worker/src/quality.mjs';
import { rendererNames, resolveRendererName } from '../../../packages/renderers/src/registry.mjs';
import { rendererInputError } from './renderer-input.mjs';
import { mediaTypeFor, serveMedia } from './media.mjs';
import { assignDownloadedBroll, downloadBrollAsset } from './broll-media.mjs';

let cfg=config();
const here=path.dirname(fileURLToPath(import.meta.url));
const pub=path.resolve(here,'../dist');
const envFile=path.resolve('.env');
const legacyRunning=new Set();
const jobQueue=new ProjectJobQueue({getConfig:()=>cfg,runners:{render:runPipeline,quality:runQualityChecks,repair:runRepairActions}});
const json=(res,status,data)=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8'});res.end(JSON.stringify(data,null,2));};
const readBody=(req)=>new Promise((resolve,reject)=>{let b='';req.on('data',d=>b+=d);req.on('end',()=>{try{resolve(b?JSON.parse(b):{});}catch(e){reject(e);}});req.on('error',reject);});
const serve=(res,file,type)=>{const stream=fs.createReadStream(file);stream.on('error',()=>{if(!res.headersSent)res.writeHead(404);res.end();});res.writeHead(200,{'content-type':type});stream.pipe(res);};
const mimeFor=(file)=>({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.ico':'image/x-icon'}[path.extname(file).toLowerCase()]||'application/octet-stream');
const safeConfig=()=>({mockMode:cfg.mockMode,renderer:cfg.renderer,rendererNames,brollProviderNames,uiLanguage:cfg.uiLanguage,contentLanguage:cfg.contentLanguage,textProvider:cfg.textProvider,imageProvider:cfg.imageProvider,voiceProvider:cfg.voiceProvider,textModel:cfg.openaiTextModel,imageModel:cfg.openaiImageModel,imageSize:cfg.openaiImageSize,ttsModel:cfg.openaiTtsModel,ttsVoice:cfg.openaiTtsVoice,vivibeVoiceId:cfg.vivibeVoiceId,whiteboardAutoInstall:cfg.whiteboardAutoInstall,hasOpenAIKey:!!cfg.openaiApiKey,hasVivibeKey:!!cfg.vivibeApiKey,hasPexelsKey:!!cfg.pexelsApiKey,hasPixabayKey:!!cfg.pixabayApiKey});
const safeSettings=()=>({hasOpenAIKey:!!cfg.openaiApiKey,hasVivibeKey:!!cfg.vivibeApiKey,hasPexelsKey:!!cfg.pexelsApiKey,hasPixabayKey:!!cfg.pixabayApiKey,rendererNames,brollProviderNames,uiLanguage:cfg.uiLanguage,contentLanguage:cfg.contentLanguage,enableOpenAI:!cfg.mockMode&&[cfg.textProvider,cfg.imageProvider].every(value=>value==='openai'),voiceProvider:cfg.voiceProvider,renderer:cfg.renderer,baseUrl:cfg.openaiBaseUrl,textModel:cfg.openaiTextModel,imageModel:cfg.openaiImageModel,imageSize:cfg.openaiImageSize,imageQuality:cfg.openaiImageQuality,ttsModel:cfg.openaiTtsModel,ttsVoice:cfg.openaiTtsVoice,ttsInstructions:cfg.openaiTtsInstructions,vivibeBaseUrl:cfg.vivibeBaseUrl,vivibeVoiceId:cfg.vivibeVoiceId,vivibeSpeed:cfg.vivibeSpeed});
const isLoopback=(address='')=>address==='127.0.0.1'||address==='::1'||address.startsWith('::ffff:127.');
const settingString=(body,key,{fallback='',max=500}={})=>typeof body[key]==='string'?body[key].replace(/[\r\n]+/g,' ').trim().slice(0,max):fallback;
const projectBusy=(id)=>legacyRunning.has(id)||jobQueue.activeProjectIds().includes(id);
const activeIds=()=>[...new Set([...legacyRunning,...jobQueue.activeProjectIds()])];

function projectMemory(value={}){
  return {
    characters:Array.isArray(value.characters)?value.characters.map((item)=>String(item).trim()).filter(Boolean).slice(0,30):[],
    palette:Array.isArray(value.palette)?value.palette.map((item)=>String(item).trim()).filter(Boolean).slice(0,12):[],
    artDirection:typeof value.artDirection==='string'?value.artDirection.trim().slice(0,3000):'',
    pronunciations:Array.isArray(value.pronunciations)?value.pronunciations.map((item)=>String(item).trim()).filter(Boolean).slice(0,50):[]
  };
}

function settingsUpdates(body) {
  const updates={};
  const uiLanguage=settingString(body,'uiLanguage',{fallback:cfg.uiLanguage,max:10});
  const contentLanguage=settingString(body,'contentLanguage',{fallback:cfg.contentLanguage,max:10});
  if(!SUPPORTED_LANGUAGES.has(uiLanguage)||!SUPPORTED_LANGUAGES.has(contentLanguage))throw new Error('Unsupported language.');
  updates.UI_LANGUAGE=uiLanguage;
  updates.CONTENT_LANGUAGE=contentLanguage;
  const apiKey=settingString(body,'apiKey',{max:500});
  if(apiKey)updates.OPENAI_API_KEY=apiKey;
  else if(body.clearApiKey===true)updates.OPENAI_API_KEY='';
  const baseUrl=settingString(body,'baseUrl',{fallback:cfg.openaiBaseUrl,max:500});
  let parsed;
  try{parsed=new URL(baseUrl);}catch{throw new Error('OPENAI_BASE_URL must be a valid URL.');}
  if(!['http:','https:'].includes(parsed.protocol)||parsed.username||parsed.password)throw new Error('OPENAI_BASE_URL must use HTTP(S) and cannot include credentials.');
  updates.OPENAI_BASE_URL=baseUrl.replace(/\/$/,'');
  updates.OPENAI_TEXT_MODEL=settingString(body,'textModel',{fallback:cfg.openaiTextModel,max:120});
  updates.OPENAI_IMAGE_MODEL=settingString(body,'imageModel',{fallback:cfg.openaiImageModel,max:120});
  updates.OPENAI_TTS_MODEL=settingString(body,'ttsModel',{fallback:cfg.openaiTtsModel,max:120});
  updates.OPENAI_TTS_VOICE=settingString(body,'ttsVoice',{fallback:cfg.openaiTtsVoice,max:120});
  for(const [label,key] of [['Script model','OPENAI_TEXT_MODEL'],['Image model','OPENAI_IMAGE_MODEL'],['Speech model','OPENAI_TTS_MODEL'],['Voice','OPENAI_TTS_VOICE']]){
    if(!updates[key])throw new Error(`${label} cannot be empty.`);
  }
  updates.OPENAI_TTS_INSTRUCTIONS=settingString(body,'ttsInstructions',{fallback:cfg.openaiTtsInstructions,max:1000});
  const imageSize=settingString(body,'imageSize',{fallback:cfg.openaiImageSize,max:30});
  if(!['1024x1024','1024x1536','1536x1024','auto'].includes(imageSize))throw new Error('Unsupported OpenAI image size.');
  updates.OPENAI_IMAGE_SIZE=imageSize;
  const imageQuality=settingString(body,'imageQuality',{fallback:cfg.openaiImageQuality,max:30});
  if(!['low','medium','high','auto'].includes(imageQuality))throw new Error('Unsupported OpenAI image quality.');
  updates.OPENAI_IMAGE_QUALITY=imageQuality;
  const renderer=settingString(body,'renderer',{fallback:cfg.renderer,max:30});
  if(!SUPPORTED_RENDERERS.has(renderer))throw new Error('Unsupported video renderer.');
  updates.VIDEO_RENDERER=renderer;

  const voiceProvider=settingString(body,'voiceProvider',{fallback:cfg.voiceProvider,max:30});
  if(!['openai','vivibe','mock'].includes(voiceProvider))throw new Error('Unsupported voice provider.');
  updates.VOICE_PROVIDER=voiceProvider;
  const vivibeApiKey=settingString(body,'vivibeApiKey',{max:500});
  if(vivibeApiKey)updates.VIVIBE_API_KEY=vivibeApiKey;
  else if(body.clearVivibeApiKey===true)updates.VIVIBE_API_KEY='';
  const vivibeBaseUrl=settingString(body,'vivibeBaseUrl',{fallback:cfg.vivibeBaseUrl,max:500});
  let vivibeParsed;
  try{vivibeParsed=new URL(vivibeBaseUrl);}catch{throw new Error('VIVIBE_BASE_URL must be a valid URL.');}
  if(!['http:','https:'].includes(vivibeParsed.protocol)||vivibeParsed.username||vivibeParsed.password)throw new Error('VIVIBE_BASE_URL must use HTTP(S) and cannot include credentials.');
  updates.VIVIBE_BASE_URL=vivibeBaseUrl.replace(/\/$/,'');
  updates.VIVIBE_VOICE_ID=settingString(body,'vivibeVoiceId',{fallback:cfg.vivibeVoiceId,max:160});
  const vivibeSpeed=Number(body.vivibeSpeed??cfg.vivibeSpeed);
  if(!Number.isFinite(vivibeSpeed)||vivibeSpeed<0.5||vivibeSpeed>2)throw new Error('Vivibe speed must be between 0.5 and 2.0.');
  updates.VIVIBE_SPEED=String(vivibeSpeed);
  const pexelsApiKey=settingString(body,'pexelsApiKey',{max:500});
  if(pexelsApiKey)updates.PEXELS_API_KEY=pexelsApiKey;
  else if(body.clearPexelsApiKey===true)updates.PEXELS_API_KEY='';
  const pixabayApiKey=settingString(body,'pixabayApiKey',{max:500});
  if(pixabayApiKey)updates.PIXABAY_API_KEY=pixabayApiKey;
  else if(body.clearPixabayApiKey===true)updates.PIXABAY_API_KEY='';

  const enableOpenAI=typeof body.enableOpenAI==='boolean'?body.enableOpenAI:(!cfg.mockMode&&cfg.textProvider==='openai'&&cfg.imageProvider==='openai');
  updates.TEXT_PROVIDER=enableOpenAI?'openai':'mock';
  updates.IMAGE_PROVIDER=enableOpenAI?'openai':'mock';
  updates.MOCK_MODE=!enableOpenAI&&voiceProvider==='mock'?'1':'0';
  const willHaveKey=updates.OPENAI_API_KEY!==undefined?!!updates.OPENAI_API_KEY:!!cfg.openaiApiKey;
  if((enableOpenAI||voiceProvider==='openai')&&!willHaveKey)throw new Error('Add an OpenAI API key before enabling an OpenAI provider.');
  const willHaveVivibeKey=updates.VIVIBE_API_KEY!==undefined?!!updates.VIVIBE_API_KEY:!!cfg.vivibeApiKey;
  if(voiceProvider==='vivibe'&&!willHaveVivibeKey)throw new Error('Add a Vivibe API key before selecting Vivibe voice.');
  if(voiceProvider==='vivibe'&&!updates.VIVIBE_VOICE_ID)throw new Error('Choose or enter a Vivibe Voice ID.');
  return updates;
}

const server=http.createServer(async (req,res)=>{
  try {
    const url=new URL(req.url,`http://${req.headers.host}`); const parts=url.pathname.split('/').filter(Boolean);
    if(req.method==='GET'&&url.pathname==='/api/health') return json(res,200,{ok:true,running:activeIds(),config:safeConfig()});
    if(url.pathname==='/api/settings') {
      if(!isLoopback(req.socket.remoteAddress))return json(res,403,{error:'Settings are only available from this machine.'});
      if(req.method==='GET')return json(res,200,safeSettings());
      if(req.method==='PATCH'){
        if(activeIds().length)return json(res,409,{error:'Wait for the active job to finish before changing settings.'});
        const updates=settingsUpdates(await readBody(req));
        updateEnvFile(envFile,updates);
        for(const [key,value] of Object.entries(updates))process.env[key]=value;
        cfg=config();
        return json(res,200,safeSettings());
      }
    }
    if(req.method==='POST'&&url.pathname==='/api/settings/test') {
      if(!isLoopback(req.socket.remoteAddress))return json(res,403,{error:'Settings are only available from this machine.'});
      if(!cfg.openaiApiKey)return json(res,400,{error:'No OpenAI API key is configured.'});
      const endpoint=`${cfg.openaiBaseUrl}/models/${encodeURIComponent(cfg.openaiTextModel)}`;
      const response=await fetch(endpoint,{headers:{authorization:`Bearer ${cfg.openaiApiKey}`}});
      if(!response.ok){const detail=await response.json().catch(()=>({}));return json(res,response.status,{error:detail.error?.message||`OpenAI returned HTTP ${response.status}.`});}
      return json(res,200,{ok:true,model:cfg.openaiTextModel,requestId:response.headers.get('x-request-id')||null});
    }
    if(req.method==='POST'&&url.pathname==='/api/voice-providers/vivibe/voices') {
      if(!isLoopback(req.socket.remoteAddress))return json(res,403,{error:'Voice provider settings are only available from this machine.'});
      const b=await readBody(req); const apiKey=settingString(b,'apiKey',{fallback:cfg.vivibeApiKey,max:500}); const baseUrl=settingString(b,'baseUrl',{fallback:cfg.vivibeBaseUrl,max:500});
      if(!apiKey)return json(res,400,{error:'Add or save a Vivibe API key before loading voices.'});
      let parsed;try{parsed=new URL(baseUrl);}catch{return json(res,400,{error:'VIVIBE_BASE_URL must be a valid URL.'});}
      if(!['http:','https:'].includes(parsed.protocol)||parsed.username||parsed.password)return json(res,400,{error:'VIVIBE_BASE_URL must use HTTP(S) and cannot include credentials.'});
      const voices=await listVivibeVoices({...cfg,vivibeApiKey:apiKey,vivibeBaseUrl:baseUrl});
      return json(res,200,{items:voices.items.map((voice)=>({id:String(voice.id||''),name:String(voice.name||voice.id||'Unnamed voice'),isActive:voice.isActive!==false})).filter((voice)=>voice.id&&voice.isActive),total:voices.total});
    }
    if(req.method==='GET'&&url.pathname==='/api/broll/search') {
      if(!isLoopback(req.socket.remoteAddress))return json(res,403,{error:'B-roll search is only available from this machine.'});
      const provider=String(url.searchParams.get('provider')||'pexels'),query=String(url.searchParams.get('query')||'');
      const result=await searchBroll({provider,query,page:Number(url.searchParams.get('page')||1),perPage:Number(url.searchParams.get('perPage')||12),orientation:String(url.searchParams.get('orientation')||'portrait'),language:cfg.contentLanguage},cfg);
      return json(res,200,result);
    }
    if(req.method==='GET'&&parts[0]==='media'&&parts[1]) {
      const p=loadProject(decodeURIComponent(parts[1]),cfg);
      if(parts[2]==='final') {
        if(!p.artifacts?.final){res.writeHead(404).end('No final video');return;}
        return serveMedia(req,res,path.join(projectDir(cfg,p.id),p.artifacts.final),mediaTypeFor('final'));
      }
      if(parts[2]==='captions') {
        if(!p.artifacts?.captions){res.writeHead(404).end('No captions');return;}
        return serveMedia(req,res,path.join(projectDir(cfg,p.id),p.artifacts.captions),mediaTypeFor('captions'));
      }
      if(parts[2]==='scenes'&&parts[3]&&parts[4]) {
        const s=p.scenes.find(x=>x.id===decodeURIComponent(parts[3])); if(!s){res.writeHead(404).end('Scene not found');return;}
        const kind=parts[4]; const artifactKey=kind==='visual'?'visual':kind;
        const rel=s.artifacts?.[artifactKey]; if(!rel){res.writeHead(404).end(`No ${kind} artifact`);return;}
        return serveMedia(req,res,path.join(projectDir(cfg,p.id),rel),mediaTypeFor(kind));
      }
    }
    if(req.method==='GET' && url.pathname==='/api/projects') return json(res,200,listProjects(cfg));
    if(req.method==='POST' && url.pathname==='/api/projects') {
      const b=await readBody(req);let sourceText=b.sourceText||'',sourceType=b.sourceType||'script',topic='',plannedScenes=null;
      const renderer=typeof b.renderer==='string'?b.renderer:cfg.renderer,language=typeof b.language==='string'?b.language:cfg.contentLanguage,format=typeof b.format==='string'?b.format:'landscape',workflowMode=WORKFLOW_MODES.has(b.workflowMode)?b.workflowMode:'studio';
      if(!SUPPORTED_RENDERERS.has(renderer))return json(res,400,{error:'Unsupported video renderer.'});
      if(!SUPPORTED_LANGUAGES.has(language))return json(res,400,{error:'Unsupported project language.'});
      if(!SUPPORTED_VIDEO_FORMATS.has(format))return json(res,400,{error:'Unsupported video format.'});
      if(sourceType==='topic'){topic=String(b.topic||b.sourceText||'').trim();if(!topic)throw new Error('topic is required');sourceText=cfg.mockMode||cfg.textProvider==='mock'?generateScriptMock(topic,{language}):await generateScriptOpenAI(topic,cfg,{minutes:Number(b.minutes||cfg.scriptMinutes),language});}
      if(sourceType!=='srt'&&!cfg.mockMode&&cfg.textProvider==='openai'){
        try{plannedScenes=await planNarrativeBeatsOpenAI(sourceText,{...cfg,contentLanguage:language},{language,format});}
        catch(error){console.warn(`Semantic planner fallback: ${error.message}`);}
      }
      return json(res,201,createProject({title:b.title||topic,sourceText,sourceType,topic,workflowMode,format,plannedScenes},{...cfg,renderer,contentLanguage:language}));
    }
    if(parts[0]==='api'&&parts[1]==='projects'&&parts[2]) {
      const id=decodeURIComponent(parts[2]);
      if(req.method==='GET'&&parts.length===3) return json(res,200,loadProject(id,cfg));
      if(req.method==='GET'&&parts[3]==='jobs'&&parts.length===4)return json(res,200,{items:loadProject(id,cfg).jobs||[]});
      if(req.method==='POST'&&parts[3]==='jobs'&&parts.length===4){
        const b=await readBody(req),type=b.type||'render',request=b.request||Object.fromEntries(Object.entries(b).filter(([key])=>key!=='type'));
        const job=jobQueue.enqueue(id,type,request);return json(res,202,{job,project:loadProject(id,cfg)});
      }
      if(req.method==='POST'&&parts[3]==='jobs'&&parts[4]&&parts[5]==='cancel'){
        const job=jobQueue.cancel(id,decodeURIComponent(parts[4]));return json(res,200,{job,project:loadProject(id,cfg)});
      }
      if(req.method==='GET'&&parts[3]==='rough-cut'&&parts.length===4)return json(res,200,buildRoughCutManifest(loadProject(id,cfg)));
      if(req.method==='GET'&&parts[3]==='quality'&&parts[4]==='repair-plan')return json(res,200,buildRepairPlan(loadProject(id,cfg)));
      if(req.method==='POST'&&parts[3]==='quality'&&parts[4]==='repair'){
        const b=await readBody(req),plan=buildRepairPlan(loadProject(id,cfg)),selected=Array.isArray(b.actions)?b.actions:plan.actions;
        const job=jobQueue.enqueue(id,'repair',{actions:selected});return json(res,202,{job,plan,project:loadProject(id,cfg)});
      }
      if(req.method==='POST'&&parts[3]==='history'&&['undo','redo'].includes(parts[4])){
        if(projectBusy(id))return json(res,409,{error:'Wait for the active job before changing project history.'});
        const p=loadProject(id,cfg),changed=parts[4]==='undo'?undoProject(p):redoProject(p);
        if(!changed)return json(res,409,{error:`Nothing to ${parts[4]}.`});
        saveProject(p,cfg);return json(res,200,p);
      }
      if(req.method==='POST'&&parts[3]==='scenes'&&parts[4]&&parts[5]==='takes'&&parts[6]&&parts[7]&&parts[8]==='select'){
        if(projectBusy(id))return json(res,409,{error:'Wait for the active job before selecting a take.'});
        const p=loadProject(id,cfg),s=p.scenes.find((scene)=>scene.id===decodeURIComponent(parts[4]));if(!s)return json(res,404,{error:'scene not found'});
        recordHistory(p,`Select ${parts[6]} take for ${s.id}`);selectTake(p,s,decodeURIComponent(parts[6]),decodeURIComponent(parts[7]));saveProject(p,cfg);return json(res,200,p);
      }
      if(req.method==='POST'&&parts[3]==='scenes'&&parts[4]&&parts[5]==='broll'){
        if(!isLoopback(req.socket.remoteAddress))return json(res,403,{error:'B-roll downloads are only available from this machine.'});
        if(projectBusy(id))return json(res,409,{error:'Wait for this project job to finish before changing B-roll.'});
        const body=await readBody(req),p=loadProject(id,cfg),s=p.scenes.find((scene)=>scene.id===decodeURIComponent(parts[4]));if(!s)return json(res,404,{error:'scene not found'});
        const downloaded=await downloadBrollAsset(body.selection,projectDir(cfg,p.id)),previousRenderer=resolveRendererName(s,p,cfg);
        recordHistory(p,`Select ${downloaded.source.provider} B-roll for ${s.id}`);
        assignDownloadedBroll(p,s,downloaded,{brollStartMs:body.brollStartMs,currentRenderer:previousRenderer});saveProject(p,cfg);
        return json(res,200,{project:p,asset:{path:downloaded.path,reused:downloaded.reused,source:s.brollSource}});
      }
      if(req.method==='PATCH'&&parts.length===3) {
        if(projectBusy(id))return json(res,409,{error:'Wait for this project job to finish before changing it.'});
        const p=loadProject(id,cfg); p.settings||={};
        const b=await readBody(req);
        recordHistory(p,'Update project settings');
        if(typeof b.title==='string'&&b.title.trim())p.title=b.title.trim().slice(0,160);
        if(typeof b.renderer==='string'){
          if(!SUPPORTED_RENDERERS.has(b.renderer))return json(res,400,{error:'Unsupported video renderer.'});
          if(p.settings.renderer!==b.renderer){p.settings.renderer=b.renderer;invalidateRenderedMedia(p);}
        }
        if(typeof b.workflowMode==='string'){
          if(!WORKFLOW_MODES.has(b.workflowMode))return json(res,400,{error:'Unsupported workflow mode.'});
          p.settings.workflowMode=b.workflowMode;
        }
        if(typeof b.format==='string'){
          if(!SUPPORTED_VIDEO_FORMATS.has(b.format))return json(res,400,{error:'Unsupported video format.'});
          if(p.settings.format!==b.format){Object.assign(p.settings,videoFormatSettings(b.format,cfg));for(const scene of p.scenes){const prompt=visualPromptFor(scene.text,{...cfg,format:b.format,memory:p.memory},scene.visualIntent);const promptChanged=prompt!==scene.visualPrompt;scene.visualPrompt=prompt;invalidateScene(p,scene,{promptChanged});}}
        }
        if(b.memory&&typeof b.memory==='object'){
          p.memory=projectMemory(b.memory);
          for(const scene of p.scenes){const prompt=visualPromptFor(scene.text,{...cfg,format:p.settings?.format,memory:p.memory},scene.visualIntent);const promptChanged=prompt!==scene.visualPrompt;scene.visualPrompt=prompt;invalidateScene(p,scene,{promptChanged});}
        }
        saveProject(p,cfg);
        return json(res,200,p);
      }
      if(req.method==='POST'&&parts[3]==='director'&&parts.length===4) {
        const b=await readBody(req);const p=loadProject(id,cfg);const s=p.scenes.find((scene)=>scene.id===b.sceneId);
        if(!s)return json(res,404,{error:'scene not found'});
        return json(res,200,await planSceneDirection({instruction:b.instruction,scene:s,project:p,cfg}));
      }
      if(req.method==='POST'&&parts[3]==='scenes'&&parts.length===4) {
        if(projectBusy(id))return json(res,409,{error:'Wait for this project job to finish before changing scene structure.'});
        const b=await readBody(req),p=loadProject(id,cfg);recordHistory(p,'Add scene');const scene=insertScene(p,b,cfg);saveProject(p,cfg);
        return json(res,201,{project:p,selectedSceneId:scene.id});
      }
      if(req.method==='POST'&&parts[3]==='scenes'&&parts[4]&&parts[5]==='actions') {
        if(projectBusy(id))return json(res,409,{error:'Wait for this project job to finish before changing scene structure.'});
        const b=await readBody(req),p=loadProject(id,cfg),sceneId=decodeURIComponent(parts[4]);let selectedSceneId=sceneId;recordHistory(p,`${b.action||'Edit'} ${sceneId}`);
        if(b.action==='duplicate')selectedSceneId=duplicateScene(p,sceneId,cfg).id;
        else if(b.action==='split')selectedSceneId=splitScene(p,sceneId,cfg,{at:Number.isInteger(b.at)?b.at:null}).second.id;
        else if(b.action==='merge-next')selectedSceneId=mergeSceneWithNext(p,sceneId,cfg).id;
        else if(b.action==='remove'){const index=p.scenes.findIndex((scene)=>scene.id===sceneId);removeScene(p,sceneId);selectedSceneId=p.scenes[Math.min(index,p.scenes.length-1)].id;}
        else if(b.action==='move')selectedSceneId=moveScene(p,sceneId,b.direction).id;
        else return json(res,400,{error:'Unsupported scene action.'});
        saveProject(p,cfg);return json(res,200,{project:p,selectedSceneId});
      }
      if(req.method==='PATCH'&&parts[3]==='scenes'&&parts[4]) {
        if(projectBusy(id))return json(res,409,{error:'Wait for this project job to finish before editing a scene.'});
        const b=await readBody(req); const p=loadProject(id,cfg); const s=p.scenes.find(x=>x.id===parts[4]);
        if(!s) return json(res,404,{error:'scene not found'});
        const rendererError=rendererInputError(b); if(rendererError)return json(res,400,{error:rendererError});
        const nextText=typeof b.text==='string'?b.text:s.text;const nextIntent=typeof b.visualIntent==='string'?b.visualIntent:s.visualIntent||s.text;const intentChanged=nextIntent!==s.visualIntent;
        let nextPrompt=typeof b.visualPrompt==='string'?b.visualPrompt:s.visualPrompt;
        if(typeof b.visualIntent==='string'||nextText!==s.text)nextPrompt=visualPromptFor(nextText,{...cfg,format:p.settings?.format,memory:p.memory},nextIntent);
        const nextRenderer=typeof b.renderer==='string'?b.renderer:s.renderer;
        const textChanged=nextText!==s.text,promptChanged=intentChanged||nextPrompt!==s.visualPrompt&&typeof b.visualPrompt==='string',rendererChanged=typeof b.renderer==='string'&&nextRenderer!==resolveRendererName(s,p,cfg);recordHistory(p,`Edit ${s.id}`);s.text=nextText;s.visualIntent=nextIntent;s.visualPrompt=nextPrompt;
        if(typeof b.renderer==='string')s.renderer=nextRenderer;
        invalidateScene(p,s,{textChanged,promptChanged,rendererChanged}); saveProject(p,cfg); return json(res,200,p);
      }
      if(req.method==='POST'&&parts[3]==='scenes'&&parts[4]&&parts[5]==='review') {
        if(projectBusy(id))return json(res,409,{error:'Wait for this project job to finish before reviewing a scene.'});
        const b=await readBody(req); const p=loadProject(id,cfg); const s=p.scenes.find(x=>x.id===parts[4]);
        if(!s)return json(res,404,{error:'scene not found'});
        const reviewable=b.stage==='script'||b.stage==='voice'&&!!s.cache?.voice||b.stage==='visual'&&!!s.cache?.image||b.stage==='clip'&&!!s.artifacts?.clip;
        if(b.decision==='approved'&&!reviewable)return json(res,409,{error:`Generate ${b.stage} before approving it.`});
        recordHistory(p,`${b.decision} ${b.stage} for ${s.id}`);setReviewDecision(p,s,b.stage,b.decision); saveProject(p,cfg); return json(res,200,p);
      }
      if(req.method==='POST'&&parts[3]==='review'&&parts.length===4) {
        if(projectBusy(id))return json(res,409,{error:'Wait for this project job to finish before reviewing scenes.'});
        const b=await readBody(req); const p=loadProject(id,cfg); const ids=Array.isArray(b.sceneIds)?[...new Set(b.sceneIds)]:[];
        const scenes=p.scenes.filter((scene)=>ids.includes(scene.id));
        if(!ids.length||scenes.length!==ids.length)return json(res,400,{error:'Choose one or more valid scenes.'});
        for(const s of scenes){
          const reviewable=b.stage==='script'||b.stage==='voice'&&!!s.cache?.voice||b.stage==='visual'&&!!s.cache?.image||b.stage==='clip'&&!!s.artifacts?.clip;
          if(b.decision==='approved'&&!reviewable)return json(res,409,{error:`Generate ${b.stage} for ${s.id} before approving it.`});
        }
        recordHistory(p,`${b.decision} ${b.stage} for ${scenes.length} scenes`);for(const s of scenes)setReviewDecision(p,s,b.stage,b.decision);
        saveProject(p,cfg); return json(res,200,p);
      }
      if(req.method==='POST'&&parts[3]==='run') {
        if(projectBusy(id)) return json(res,409,{error:'This project is already running'});
        const b=await readBody(req); legacyRunning.add(id);
        try { const result=await runPipeline(id,{force:!!b.force,sceneId:b.sceneId||null,sceneIds:Array.isArray(b.sceneIds)?b.sceneIds:null,stage:b.stage||'all'}); return json(res,200,{project:result.project,final:result.final}); }
        catch(e){ try{const p=loadProject(id,cfg);p.status='error';p.error={message:e.message,at:new Date().toISOString()};saveProject(p,cfg);}catch{} throw e; }
        finally { legacyRunning.delete(id); }
      }
    }
    if(req.method==='GET') {
      const relative=url.pathname==='/'?'index.html':decodeURIComponent(url.pathname).replace(/^\/+/, '');
      const file=path.resolve(pub,relative);
      if(file.startsWith(`${pub}${path.sep}`)&&fs.existsSync(file)&&fs.statSync(file).isFile()) return serve(res,file,mimeFor(file));
    }
    res.writeHead(404).end('Not found');
  } catch(e) { json(res,500,{error:e.message,stack:process.env.NODE_ENV==='development'?e.stack:undefined}); }
});
server.listen(cfg.webPort,cfg.webHost,()=>{console.log(`Video Workflow Tool: http://${cfg.webHost}:${cfg.webPort}`);jobQueue.start();});
