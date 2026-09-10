#!/usr/bin/env node
import fs from 'node:fs';
import { config } from '../../../packages/core/src/env.mjs';
import { createProject, listProjects, loadProject } from '../../../packages/core/src/project.mjs';
import { normalizeLanguage, SUPPORTED_LANGUAGES } from '../../../packages/core/src/languages.mjs';
import { SUPPORTED_VIDEO_FORMATS } from '../../../packages/core/src/video-format.mjs';
import { generateScriptOpenAI, planNarrativeBeatsOpenAI } from '../../../packages/providers/src/openai.mjs';
import { generateScriptMock } from '../../../packages/providers/src/mock.mjs';
import { runPipeline } from './pipeline.mjs';

function args(argv){const out={_:[]};for(let i=0;i<argv.length;i++){const v=argv[i];if(v.startsWith('--')){const k=v.slice(2);out[k]=argv[i+1]?.startsWith('--')?true:argv[++i];}else out._.push(v);}return out;}
const a=args(process.argv.slice(2)),cmd=a._[0],cfg=config();

try {
  if(cmd==='create') {
    let sourceFile=a.script||a.srt,sourceText,sourceType,topic='';
    const language=normalizeLanguage(a.language,cfg.contentLanguage),format=a.format||'landscape';
    if(a.language&&!SUPPORTED_LANGUAGES.has(a.language))throw new Error('--language must be one of: vi, en');
    if(!SUPPORTED_VIDEO_FORMATS.has(format))throw new Error('--format must be one of: landscape, short');
    if(a.topic){topic=String(a.topic);sourceText=cfg.mockMode||cfg.textProvider==='mock'?generateScriptMock(topic,{language}):await generateScriptOpenAI(topic,cfg,{minutes:Number(a.minutes||cfg.scriptMinutes),language});sourceType='topic';}
    else {if(!sourceFile)throw new Error('Use --topic "...", --script <file>, or --srt <file>');sourceText=fs.readFileSync(sourceFile,'utf8');sourceType=a.srt?'srt':'script';}
    let plannedScenes=null;
    if(sourceType!=='srt'&&!cfg.mockMode&&cfg.textProvider==='openai'){
      try{plannedScenes=await planNarrativeBeatsOpenAI(sourceText,{...cfg,contentLanguage:language},{language,format});}
      catch(error){console.warn(`Semantic planner fallback: ${error.message}`);}
    }
    const p=createProject({title:a.title||topic||sourceFile,sourceText,sourceType,topic,workflowMode:a.mode||'studio',format,plannedScenes},{...cfg,contentLanguage:language});
    console.log(JSON.stringify({id:p.id,title:p.title,sourceType:p.source.type,language:p.settings.language,workflowMode:p.settings.workflowMode,format:p.settings.format,size:`${p.settings.width}x${p.settings.height}`,scenes:p.scenes.length},null,2));
  } else if(cmd==='run') {
    if(!a.project)throw new Error('--project is required');const r=await runPipeline(a.project,{force:!!a.force,sceneId:a.scene||null,stage:a.stage||'all'});console.log(JSON.stringify({project:r.project.id,status:r.project.status,final:r.final},null,2));
  } else if(cmd==='status') {
    if(a.project)console.log(JSON.stringify(loadProject(a.project,cfg),null,2));else console.log(JSON.stringify(listProjects(cfg).map((p)=>({id:p.id,title:p.title,status:p.status,updatedAt:p.updatedAt,format:p.settings.format,scenes:p.scenes.length})),null,2));
  } else console.log(`Video Workflow Tool\n\nCommands:\n  create --title "..." --topic "Vì sao ta trì hoãn" [--minutes 6] [--language vi|en] [--format landscape|short] [--mode studio|auto]\n  create --title "..." --script script.md [--language vi|en] [--format landscape|short] [--mode studio|auto]\n  create --title "..." --srt subtitles.srt [--language vi|en] [--format landscape|short] [--mode studio|auto]\n  run --project <id> [--scene scene-001] [--stage voice|visual|clip|final|all] [--force]\n  status [--project <id>]`);
} catch(e) { console.error(e.stack||e.message); process.exitCode=1; }
