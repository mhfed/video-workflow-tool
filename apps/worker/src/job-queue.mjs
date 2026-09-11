import crypto from 'node:crypto';
import { listProjects, loadProject, saveProject } from '../../../packages/core/src/project.mjs';
import { nowIso } from '../../../packages/core/src/utils.mjs';

const ACTIVE=new Set(['queued','running','cancelling']);

export class ProjectJobQueue {
  constructor({getConfig,runners}){
    this.getConfig=getConfig;
    this.runners=runners;
    this.controllers=new Map();
    this.pumping=false;
  }

  start(){
    const cfg=this.getConfig();
    for(const project of listProjects(cfg)){
      let changed=false;
      for(const job of project.jobs||[])if(job.status==='running'||job.status==='cancelling'){
        job.status='queued';job.message='Resuming after server restart';delete job.startedAt;changed=true;
      }
      if(changed)saveProject(project,cfg);
    }
    this.pump();
  }

  activeProjectIds(){
    const ids=new Set([...this.controllers.values()].map((item)=>item.projectId));
    const cfg=this.getConfig();
    for(const project of listProjects(cfg))if(project.jobs?.some((job)=>ACTIVE.has(job.status)))ids.add(project.id);
    return [...ids];
  }

  enqueue(projectId,type,request={}){
    if(!this.runners[type])throw new Error(`Unsupported job type: ${type}`);
    const cfg=this.getConfig(),project=loadProject(projectId,cfg);
    const job={id:`job-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`,type,status:'queued',request:structuredClone(request),createdAt:nowIso(),message:'Queued',progress:{completed:0,total:1,percent:0,estimatedRemainingMs:null},events:[]};
    project.jobs ||= [];project.jobs.push(job);
    if(project.jobs.length>40)project.jobs.splice(0,project.jobs.length-40);
    saveProject(project,cfg);this.pump();return job;
  }

  cancel(projectId,jobId){
    const cfg=this.getConfig(),project=loadProject(projectId,cfg),job=project.jobs?.find((item)=>item.id===jobId);
    if(!job)throw new Error('job not found');
    if(job.status==='queued'){
      job.status='cancelled';job.cancelledAt=nowIso();job.message='Cancelled before start';saveProject(project,cfg);return job;
    }
    const active=this.controllers.get(jobId);
    if(job.status==='running'&&active){job.status='cancelling';job.message='Stopping provider and renderer';saveProject(project,cfg);active.controller.abort();return job;}
    if(job.status==='running'&&!active){
      job.status='cancelled';job.cancelledAt=nowIso();job.message='Cancelled after worker stopped';job.error=null;saveProject(project,cfg);return job;
    }
    return job;
  }

  update(projectId,jobId,mutate){
    const cfg=this.getConfig(),project=loadProject(projectId,cfg),job=project.jobs?.find((item)=>item.id===jobId);
    if(!job)return null;
    mutate(job,project);saveProject(project,cfg);return job;
  }

  hasQueued(){
    const cfg=this.getConfig();
    return listProjects(cfg).some((project)=>project.jobs?.some((job)=>job.status==='queued'));
  }

  async pump(){
    if(this.pumping||this.controllers.size)return;
    this.pumping=true;
    try{
      const cfg=this.getConfig();let candidate=null;
      for(const project of listProjects(cfg))for(const job of project.jobs||[])if(job.status==='queued'&&(!candidate||job.createdAt<candidate.job.createdAt))candidate={projectId:project.id,job};
      if(!candidate)return;
      const {projectId,job}=candidate,controller=new AbortController();
      this.controllers.set(job.id,{projectId,controller});
      const started=Date.now();
      this.update(projectId,job.id,(item)=>{item.status='running';item.startedAt=nowIso();item.message='Starting';});
      const onProgress=async(event)=>this.update(projectId,job.id,(item)=>{
        const completed=Number(event.completed||0),total=Math.max(1,Number(event.total||1)),elapsed=Date.now()-started;
        item.progress={completed,total,percent:Math.max(0,Math.min(100,Number(event.percent??Math.round(completed/total*100)))),estimatedRemainingMs:completed>0?Math.round(elapsed/completed*Math.max(0,total-completed)):null,stage:event.stage||null,sceneId:event.sceneId||null};
        item.message=event.message||item.message;
        item.events ||= [];item.events.push({at:nowIso(),...event});if(item.events.length>80)item.events.splice(0,item.events.length-80);
      });
      try{
        await this.runners[job.type](projectId,{...job.request,signal:controller.signal,onProgress});
        this.update(projectId,job.id,(item,project)=>{item.status='complete';item.completedAt=nowIso();item.message='Complete';item.progress={...item.progress,completed:item.progress.total,percent:100,estimatedRemainingMs:0};delete project.error;});
      }catch(error){
        const cancelled=controller.signal.aborted||error.name==='AbortError';
        this.update(projectId,job.id,(item,project)=>{item.status=cancelled?'cancelled':'failed';item[`${cancelled?'cancelled':'failed'}At`]=nowIso();item.message=cancelled?'Cancelled':error.message;item.error=cancelled?null:{message:error.message};if(!cancelled){project.status='error';project.error={message:error.message,at:nowIso(),jobId:item.id};}});
      }finally{
        this.controllers.delete(job.id);
      }
    }finally{
      this.pumping=false;
      if(!this.controllers.size&&this.hasQueued())setImmediate(()=>this.pump());
    }
  }
}
