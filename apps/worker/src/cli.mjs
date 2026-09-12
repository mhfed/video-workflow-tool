#!/usr/bin/env node
import fs from 'node:fs';
import { config } from '../../../packages/core/src/env.mjs';
import { listProjects, loadProject } from '../../../packages/core/src/project.mjs';
import { runPipeline } from './pipeline.mjs';
import { createVideo } from './create-video.mjs';

function args(argv){const out={_:[]};for(let i=0;i<argv.length;i++){const v=argv[i];if(v.startsWith('--')){const k=v.slice(2);out[k]=argv[i+1]?.startsWith('--')?true:argv[++i];}else out._.push(v);}return out;}
const a=args(process.argv.slice(2)),cmd=a._[0],cfg=config();

try {
  if(cmd==='create') {
    const sourceFile=a.script||a.srt,brief=a.brief?JSON.parse(fs.readFileSync(a.brief,'utf8')):null;
    if(!a.topic&&!sourceFile&&!a.idea&&!brief)throw new Error('Use --topic "...", --script <file>, --srt <file>, --brief <json>, or --channel <id> --idea <id>');
    const p=await createVideo({title:a.title||a.topic||sourceFile,sourceText:sourceFile?fs.readFileSync(sourceFile,'utf8'):undefined,sourceType:a.topic?'topic':a.srt?'srt':a.script?'script':'topic',topic:a.topic,language:a.language,format:a.format,minutes:a.minutes,workflowMode:a.mode||'studio',channelId:a.channel,ideaId:a.idea,brief},cfg);
    console.log(JSON.stringify({id:p.id,title:p.title,sourceType:p.source.type,language:p.settings.language,workflowMode:p.settings.workflowMode,format:p.settings.format,size:`${p.settings.width}x${p.settings.height}`,scenes:p.scenes.length},null,2));
  } else if(cmd==='run') {
    if(!a.project)throw new Error('--project is required');const r=await runPipeline(a.project,{force:!!a.force,sceneId:a.scene||null,stage:a.stage||'all'});console.log(JSON.stringify({project:r.project.id,status:r.project.status,final:r.final},null,2));
  } else if(cmd==='status') {
    if(a.project)console.log(JSON.stringify(loadProject(a.project,cfg),null,2));else console.log(JSON.stringify(listProjects(cfg).map((p)=>({id:p.id,title:p.title,status:p.status,updatedAt:p.updatedAt,format:p.settings.format,scenes:p.scenes.length})),null,2));
  } else console.log(`Video Workflow Tool\n\nCommands:\n  create --title "..." --topic "Vì sao ta trì hoãn" [--minutes 6] [--language vi|en] [--format landscape|short] [--mode studio|auto]\n  create --title "..." --script script.md [--language vi|en] [--format landscape|short] [--mode studio|auto]\n  create --title "..." --srt subtitles.srt [--language vi|en] [--format landscape|short] [--mode studio|auto]\n  create --channel <id> --idea <idea-id> [--language vi|en] [--format landscape|short]\n  create --channel <id> --brief <json-file>\n  Any create command also accepts --channel <id>.\n  run --project <id> [--scene scene-001] [--stage voice|visual|clip|final|all] [--force]\n  status [--project <id>]`);
} catch(e) { console.error(e.stack||e.message); process.exitCode=1; }
