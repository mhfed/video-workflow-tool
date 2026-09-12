import { useEffect, useState } from 'react';
import { Activity, BookOpen, Clapperboard, Grid2X2, Lightbulb, ListChecks, Plus, Search, Settings2, Trash2, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const statusLabel=(status,c)=>c.status[status]||status||c.status.draft;

export default function ApplicationNavigation({current,projects,section,onSection,channelAvailable,drawer,onDrawer,onCreate,onSelect,onDelete,onSettings,health,c}){
  const [query,setQuery]=useState('');
  useEffect(()=>{if(drawer!=='projects')setQuery('');},[drawer]);
  useEffect(()=>{if(!drawer)return;const close=(event)=>{if(event.key==='Escape')onDrawer(null);};window.addEventListener('keydown',close);return()=>window.removeEventListener('keydown',close);},[drawer,onDrawer]);
  const visible=projects.filter((project)=>project.title.toLowerCase().includes(query.trim().toLowerCase()));
  const activity=projects.flatMap((project)=>(project.jobs||[]).map((job)=>({project,job}))).sort((a,b)=>String(b.job.createdAt||'').localeCompare(String(a.job.createdAt||''))).slice(0,30);
  const navButton=(id,label,Icon,onClick,active=false,badge=null,disabled=false)=><Tooltip key={id}><TooltipTrigger asChild><button className={`nav-rail-button ${active?'active':''}`} aria-label={label} aria-current={active?'page':undefined} disabled={disabled} onClick={onClick}><Icon/><span>{label}</span>{badge!==null&&badge>0&&<b>{badge}</b>}</button></TooltipTrigger><TooltipContent side="right">{label}</TooltipContent></Tooltip>;
  return <>
    <aside className="app-nav-rail" aria-label={c.mainNavigation}>
      <Tooltip><TooltipTrigger asChild><button className="nav-create" aria-label={c.newProduction} onClick={onCreate}><Plus/><span>{c.create}</span></button></TooltipTrigger><TooltipContent side="right">{c.newProduction}</TooltipContent></Tooltip>
      <nav className="nav-stack content-nav">
        {navButton('overview',c.channelOverview,Grid2X2,()=>onSection('overview'),section==='overview'&&!drawer,null,!channelAvailable)}
        {navButton('videos',c.projectLibrary,Clapperboard,()=>onSection('videos'),section==='videos'&&!drawer,projects.length)}
        {navButton('ideas',c.ideaBank,Lightbulb,()=>onSection('ideas'),section==='ideas'&&!drawer,null,!channelAvailable)}
        {navButton('profile',c.channelProfile,BookOpen,()=>onSection('profile'),section==='profile'&&!drawer,null,!channelAvailable)}
      </nav>
      <div className="nav-rail-rule"/>
      <nav className="nav-stack utility-nav">
        {navButton('projects',c.searchVideoLibrary,Search,()=>onDrawer(drawer==='projects'?null:'projects'),drawer==='projects')}
        {navButton('activity',c.activityCenter,ListChecks,()=>onDrawer(drawer==='activity'?null:'activity'),drawer==='activity',activity.filter(({job})=>['queued','running','cancelling','failed'].includes(job.status)).length)}
      </nav>
      <div className="nav-rail-spacer"/>
      <div className="nav-runtime" title={health?c.systemReady:c.connecting}><span className={`status-light ${health?'online':''}`}/><small>{health?'ON':'—'}</small></div>
      {navButton('settings',c.settingsNav,Settings2,onSettings,false)}
    </aside>
    {drawer&&<><button className="nav-drawer-scrim" aria-label={c.closePanel} onClick={()=>onDrawer(null)}/><aside className={`nav-drawer ${drawer}`}>
      <header><div><span>{drawer==='projects'?c.projectLibrary:c.activityCenter}</span><p>{drawer==='projects'?c.projectLibraryBody:c.activityCenterBody}</p></div><button aria-label={c.closePanel} onClick={()=>onDrawer(null)}><X/></button></header>
      {drawer==='projects'?<><label className="nav-project-search"><Search/><Input value={query} onChange={(event)=>setQuery(event.target.value)} placeholder={c.searchProjects}/></label><div className="nav-project-list">{visible.length?visible.map((project)=><div key={project.id} className={`nav-project-row ${project.id===current?.id?'active':''}`}><button className="nav-project-open" onClick={()=>{onDrawer(null);onSelect(project.id);}}><span><Clapperboard/></span><div><strong>{project.title}</strong><small>{project.scenes.length} {c.scenes} · {statusLabel(project.status,c)}</small></div></button><Tooltip><TooltipTrigger asChild><button className="nav-project-delete" aria-label={`${c.deleteProject}: ${project.title}`} onClick={()=>onDelete(project)}><Trash2/><span className="sr-only">{c.deleteProject}</span></button></TooltipTrigger><TooltipContent side="right">{c.deleteProject}</TooltipContent></Tooltip></div>):<div className="nav-empty compact"><Search/><strong>{c.noProjectsFound}</strong><p>{c.noProjectsFoundBody}</p></div>}</div></>:<div className="nav-activity-list">{activity.length?activity.map(({project,job})=><button key={`${project.id}-${job.id}`} onClick={()=>{onDrawer(null);onSelect(project.id);}}><span className={`job-state ${job.status}`}>{job.progress?.percent||0}%</span><div><strong>{project.title}</strong><small>{c.jobTypes[job.type]||job.type} · {c.jobStates[job.status]||job.status}</small></div><i/></button>):<div className="nav-empty"><Activity/><strong>{c.noActivity}</strong><p>{c.noActivityBody}</p></div>}</div>}
      <footer><span className={`status-light ${health?'online':''}`}/><div><strong>{health?c.systemReady:c.connecting}</strong><small>{health?.config?`${health.config.mockMode?'Mock':'Live'} · ${health.config.renderer}`:c.localRuntime}</small></div></footer>
    </aside></>}
  </>;
}
