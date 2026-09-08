import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../../../packages/core/src/env.mjs';
import { createProject, listProjects, loadProject, saveProject, projectDir } from '../../../packages/core/src/project.mjs';
import { generateScriptOpenAI } from '../../../packages/providers/src/openai.mjs';
import { generateScriptMock } from '../../../packages/providers/src/mock.mjs';
import { runPipeline } from '../../worker/src/pipeline.mjs';

const cfg=config();
const here=path.dirname(fileURLToPath(import.meta.url));
const pub=path.resolve(here,'../public');
const json=(res,status,data)=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8'});res.end(JSON.stringify(data,null,2));};
const readBody=(req)=>new Promise((resolve,reject)=>{let b='';req.on('data',d=>b+=d);req.on('end',()=>{try{resolve(b?JSON.parse(b):{});}catch(e){reject(e);}});req.on('error',reject);});
const serve=(res,file,type)=>{const stream=fs.createReadStream(file);stream.on('error',()=>{if(!res.headersSent)res.writeHead(404);res.end();});res.writeHead(200,{'content-type':type});stream.pipe(res);};

const server=http.createServer(async (req,res)=>{
  try {
    const url=new URL(req.url,`http://${req.headers.host}`); const parts=url.pathname.split('/').filter(Boolean);
    if(req.method==='GET' && parts[0]==='media' && parts[1] && parts[2]==='final') {
      const p=loadProject(decodeURIComponent(parts[1]),cfg);
      if(!p.artifacts?.final){res.writeHead(404).end('No final video');return;}
      const file=path.join(projectDir(cfg,p.id),p.artifacts.final);
      if(!fs.existsSync(file)){res.writeHead(404).end('Missing final video');return;}
      return serve(res,file,'video/mp4');
    }
    if(req.method==='GET' && url.pathname==='/api/projects') return json(res,200,listProjects(cfg));
    if(req.method==='POST' && url.pathname==='/api/projects') { const b=await readBody(req); let sourceText=b.sourceText||'',sourceType=b.sourceType||'script',topic=''; if(sourceType==='topic'){topic=String(b.topic||b.sourceText||'').trim();if(!topic)throw new Error('topic is required');sourceText=cfg.mockMode||cfg.textProvider==='mock'?generateScriptMock(topic):await generateScriptOpenAI(topic,cfg,{minutes:Number(b.minutes||cfg.scriptMinutes)});} return json(res,201,createProject({title:b.title||topic,sourceText,sourceType,topic},cfg)); }
    if(parts[0]==='api'&&parts[1]==='projects'&&parts[2]) {
      const id=decodeURIComponent(parts[2]);
      if(req.method==='GET'&&parts.length===3) return json(res,200,loadProject(id,cfg));
      if(req.method==='PATCH'&&parts[3]==='scenes'&&parts[4]) {
        const b=await readBody(req); const p=loadProject(id,cfg); const s=p.scenes.find(x=>x.id===parts[4]);
        if(!s) return json(res,404,{error:'scene not found'});
        if(typeof b.text==='string') s.text=b.text;
        if(typeof b.visualPrompt==='string') s.visualPrompt=b.visualPrompt;
        s.cache={}; s.status='planned'; saveProject(p,cfg); return json(res,200,p);
      }
      if(req.method==='POST'&&parts[3]==='run') { const b=await readBody(req); const result=await runPipeline(id,{force:!!b.force,sceneId:b.sceneId||null}); return json(res,200,{project:result.project,final:result.final}); }
    }
    if(req.method==='GET' && url.pathname==='/app.js') return serve(res,path.join(pub,'app.js'),'text/javascript; charset=utf-8');
    if(req.method==='GET' && url.pathname==='/styles.css') return serve(res,path.join(pub,'styles.css'),'text/css; charset=utf-8');
    if(req.method==='GET' && (url.pathname==='/'||url.pathname==='/index.html')) return serve(res,path.join(pub,'index.html'),'text/html; charset=utf-8');
    res.writeHead(404).end('Not found');
  } catch(e) { json(res,500,{error:e.message,stack:process.env.NODE_ENV==='development'?e.stack:undefined}); }
});
server.listen(cfg.webPort,cfg.webHost,()=>console.log(`Video Workflow Tool: http://${cfg.webHost}:${cfg.webPort}`));
