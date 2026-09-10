import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  AudioLines,
  ArrowLeft,
  ArrowRight,
  BrainCircuit,
  Bot,
  Check,
  CheckCircle2,
  CircleDot,
  Clapperboard,
  Eye,
  EyeOff,
  Film,
  FileText,
  Grid2X2,
  Image as ImageIcon,
  KeyRound,
  Layers3,
  ListChecks,
  LoaderCircle,
  Maximize2,
  Mic2,
  MoreHorizontal,
  Play,
  Plus,
  RefreshCw,
  Save,
  Server,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  WandSparkles,
  X,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { copyFor, UI_LANGUAGES } from './i18n';

const api=async(url,options={})=>{
  const response=await fetch(url,{headers:{'content-type':'application/json',...(options.headers||{})},...options});
  const body=await response.json();
  if(!response.ok)throw new Error(body.error||response.statusText);
  return body;
};

const statusLabel=(status,c)=>c.status[status]||status||c.status.draft;
const badgeVariant=(status)=>status==='complete'?'default':status==='error'?'destructive':'secondary';
const rendererOptions=(names,c)=>names.map((name)=><SelectItem key={name} value={name}>{c[name]||name}</SelectItem>);

function BrandMark(){
  return <div className="brand-mark" aria-hidden="true"><span/><span/><span/></div>;
}

function EmptyState({onCreate,onDemo,c}){
  return <div className="empty-state">
    <div className="empty-kicker"><Sparkles size={14}/> {c.emptyKicker}</div>
    <h2>{c.emptyTitle}<br/><em>{c.emptyAccent}</em></h2>
    <p>{c.emptyBody}</p>
    <div className="empty-actions">
      <Button size="lg" onClick={onCreate}><Plus/>{c.newProduction}</Button>
      <Button size="lg" variant="outline" onClick={onDemo}><Play/>{c.createTest}</Button>
    </div>
    <div className="pipeline-map" aria-label={c.workflow}>
      {[['01',c.write],['02',c.illustrate],['03',c.voice],['04',c.render]].map(([number,label],index)=><div className="pipeline-step" key={number}>
        <span>{number}</span><strong>{label}</strong>{index<3&&<ArrowRight/>}
      </div>)}
    </div>
  </div>;
}

function StagePreview({project,scene,stage,c}){
  const version=encodeURIComponent(project.updatedAt||'current');
  const media=(kind)=>`/media/${encodeURIComponent(project.id)}/scenes/${encodeURIComponent(scene.id)}/${kind}?v=${version}`;
  if(stage==='clip'&&scene.artifacts?.clip)return <video className="workbench-video" controls preload="metadata" src={media('clip')}/>;
  if(stage==='visual'&&scene.artifacts?.visual)return <img className="workbench-image" src={media('visual')} alt={`${c.visual} ${scene.id}`}/>;
  if(stage==='voice'&&scene.artifacts?.voice)return <div className="voice-stage-preview"><Mic2/><strong>{c.narration}</strong><p>{scene.text}</p><audio controls preload="metadata" src={media('voice')}/></div>;
  if(stage==='script')return <div className="script-stage-preview"><span>“</span><p>{scene.text}</p><small>{scene.text.length} {c.chars} · {(scene.durationMs/1000).toFixed(1)} {c.seconds}</small></div>;
  return <div className="artifact-placeholder workbench-placeholder">
    <div className="frame-corners"><span/><span/><span/><span/></div>
    {stage==='voice'?<Mic2/>:stage==='clip'?<Film/>:<ImageIcon/>}<span>{stage==='visual'&&scene.cache?.image?c.mockVisualReady:c.awaitingStage}</span>
  </div>;
}

const stageArtifactReady=(scene,stage)=>stage==='script'||stage==='voice'&&!!scene.cache?.voice||stage==='visual'&&!!scene.cache?.image||stage==='clip'&&!!scene.artifacts?.clip;
const WORKBENCH_STAGES=['script','voice','visual','clip'];
const stageLabel=(stage,c)=>({script:c.scriptStage,voice:c.voiceStage,visual:c.visualStage,clip:c.clipStage}[stage]);
const StageIcon=({stage})=>stage==='script'?<FileText/>:stage==='voice'?<AudioLines/>:stage==='visual'?<ImageIcon/>:<Clapperboard/>;
const canGenerateStage=(scene,stage)=>stage==='voice'||stage==='visual'?scene.review?.script==='approved':stage==='clip'?scene.review?.voice==='approved'&&scene.review?.visual==='approved':false;
const reviewRank=(decision)=>({'changes-requested':0,stale:1,pending:2,approved:9}[decision]??3);

function ProjectOverview({project,running,onOpenScene,onBulkRun,onBulkReview,c}){
  const [filter,setFilter]=useState('all');
  const [bulkOpen,setBulkOpen]=useState(false);
  const [finalOpen,setFinalOpen]=useState(false);
  const stats=WORKBENCH_STAGES.map((stage)=>({stage,approved:project.scenes.filter((scene)=>scene.review?.[stage]==='approved').length}));
  const counts={pending:0,stale:0,'changes-requested':0};
  for(const scene of project.scenes)for(const stage of WORKBENCH_STAGES){const decision=scene.review?.[stage]||'pending';if(counts[decision]!==undefined)counts[decision]++;}
  const visibleScenes=filter==='all'?project.scenes:project.scenes.filter((scene)=>WORKBENCH_STAGES.some((stage)=>(scene.review?.[stage]||'pending')===filter));
  const attention=project.scenes.flatMap((scene)=>WORKBENCH_STAGES.map((stage)=>({scene,stage,decision:scene.review?.[stage]||'pending'}))).filter((item)=>item.decision==='changes-requested'||item.decision==='stale');
  const next=[...attention].sort((a,b)=>reviewRank(a.decision)-reviewRank(b.decision))[0]||project.scenes.flatMap((scene)=>WORKBENCH_STAGES.map((stage)=>({scene,stage,decision:scene.review?.[stage]||'pending'}))).find((item)=>item.decision!=='approved');
  const version=encodeURIComponent(project.updatedAt||'current');
  return <section className="project-overview">
    <div className="overview-progress">{stats.map(({stage,approved})=><Tooltip key={stage}><TooltipTrigger asChild><button aria-label={`${stageLabel(stage,c)}: ${approved}/${project.scenes.length}`} onClick={()=>onOpenScene(project.scenes.find((scene)=>scene.review?.[stage]!=='approved')?.id||project.scenes[0].id,stage)}><span className="stage-glyph"><StageIcon stage={stage}/></span><div><strong>{approved}<em>/{project.scenes.length}</em></strong><small>{stageLabel(stage,c)}</small></div><i><b style={{width:`${approved/project.scenes.length*100}%`}}/></i></button></TooltipTrigger><TooltipContent>{stageLabel(stage,c)} · {approved}/{project.scenes.length} {c.approvedLower}</TooltipContent></Tooltip>)}</div>
    <div className="overview-board">
      <div className="overview-toolbar"><strong>{c.scenes}</strong><div className="filter-chips"><button className={filter==='all'?'active':''} onClick={()=>setFilter('all')}>{project.scenes.length}</button><button className={filter==='changes-requested'?'active changes-requested':''} onClick={()=>setFilter('changes-requested')}><CircleDot/>{counts['changes-requested']}</button><button className={filter==='stale'?'active stale':''} onClick={()=>setFilter('stale')}><AlertTriangle/>{counts.stale}</button><button className={filter==='pending'?'active pending':''} onClick={()=>setFilter('pending')}><span/>{counts.pending}</button></div><div className="overview-tools">
        <div className="bulk-menu"><Tooltip><TooltipTrigger asChild><button className={bulkOpen?'active':''} onClick={()=>setBulkOpen((value)=>!value)} aria-label={c.bulkActions}><Layers3/></button></TooltipTrigger><TooltipContent>{c.bulkActions}</TooltipContent></Tooltip>{bulkOpen&&<div className="bulk-popover"><div><Layers3/><strong>{c.bulkActions}</strong><button onClick={()=>setBulkOpen(false)}><X/></button></div>{WORKBENCH_STAGES.map((stage)=>{const generateIds=project.scenes.filter((scene)=>stage!=='script'&&canGenerateStage(scene,stage)&&scene.review?.[stage]!=='approved').map((scene)=>scene.id);const approveIds=project.scenes.filter((scene)=>stageArtifactReady(scene,stage)&&scene.review?.[stage]!=='approved').map((scene)=>scene.id);return <section key={stage}><span><StageIcon stage={stage}/>{stageLabel(stage,c)}</span>{stage!=='script'&&<button disabled={running||!generateIds.length} onClick={()=>{setBulkOpen(false);onBulkRun(stage,generateIds);}}><RefreshCw/><b>{generateIds.length}</b></button>}<button disabled={running||!approveIds.length} onClick={()=>{setBulkOpen(false);onBulkReview(stage,approveIds,'approved');}}><Check/><b>{approveIds.length}</b></button></section>;})}</div>}</div>
        <Tooltip><TooltipTrigger asChild><button disabled={!project.artifacts?.final} onClick={()=>setFinalOpen(true)} aria-label={c.previewFinal}><Maximize2/></button></TooltipTrigger><TooltipContent>{c.previewFinal}</TooltipContent></Tooltip>
        {next&&<button className="continue-work" onClick={()=>onOpenScene(next.scene.id,next.stage)}><Sparkles/><span>{c.continueWork}</span><ArrowRight/></button>}
      </div></div>
      <div className="scene-matrix">
        <div className="matrix-head"><span>{c.sceneNavigator}</span>{WORKBENCH_STAGES.map((stage)=><Tooltip key={stage}><TooltipTrigger asChild><strong aria-label={stageLabel(stage,c)}><StageIcon stage={stage}/></strong></TooltipTrigger><TooltipContent>{stageLabel(stage,c)}</TooltipContent></Tooltip>)}</div>
        <div className="matrix-body">{visibleScenes.map((scene)=><div className="matrix-row" key={scene.id}>
          {(()=>{const index=project.scenes.findIndex((item)=>item.id===scene.id);return <button className="matrix-scene" onClick={()=>onOpenScene(scene.id,'script')}><b>{String(index+1).padStart(2,'0')}</b><span>{scene.text.split(/[.!?]/)[0]}</span><small>{(scene.durationMs/1000).toFixed(1)}s</small></button>;})()}
          {WORKBENCH_STAGES.map((stage)=>{const decision=scene.review?.[stage]||'pending';return <button key={stage} className={`matrix-cell ${decision}`} onClick={()=>onOpenScene(scene.id,stage)} title={`${scene.id} · ${stageLabel(stage,c)} · ${c.review[decision]}`}>{decision==='approved'?<Check/>:decision==='changes-requested'?<X/>:decision==='stale'?<AlertTriangle/>:<span/>}</button>;})}
        </div>)}</div>
      </div>
    </div>
    <Dialog open={finalOpen} onOpenChange={setFinalOpen}><DialogContent className="final-preview-dialog"><DialogHeader><DialogTitle>{c.finalFilm}</DialogTitle><DialogDescription>{project.title}</DialogDescription></DialogHeader>{project.artifacts?.final&&<video controls autoPlay preload="metadata" src={`/media/${encodeURIComponent(project.id)}/final?v=${version}`}/>}</DialogContent></Dialog>
  </section>;
}

function Workbench({project,initialSceneId,initialStage,running,onSave,onRunStage,onReview,rendererNames,c}){
  const [selectedId,setSelectedId]=useState(initialSceneId||project.scenes[0]?.id);
  const [stage,setStage]=useState(initialStage||'script');
  const [viewMode,setViewMode]=useState('scene');
  const sceneIndex=Math.max(0,project.scenes.findIndex((item)=>item.id===selectedId));
  const scene=project.scenes[sceneIndex]||project.scenes[0];
  const [text,setText]=useState(scene.text);
  const [prompt,setPrompt]=useState(scene.visualPrompt);
  useEffect(()=>{if(!project.scenes.some((item)=>item.id===selectedId))setSelectedId(project.scenes[0]?.id);},[project.id,project.scenes,selectedId]);
  useEffect(()=>{setText(scene.text);setPrompt(scene.visualPrompt);},[scene.id,scene.text,scene.visualPrompt]);
  const dirty=text!==scene.text||prompt!==scene.visualPrompt;
  const decision=scene.review?.[stage]||'pending';
  const ready=stageArtifactReady(scene,stage);
  const upstreamApproved=stage==='script'||canGenerateStage(scene,stage);
  const go=(offset)=>setSelectedId(project.scenes[Math.min(project.scenes.length-1,Math.max(0,sceneIndex+offset))].id);
  const smartNext=(approvedCurrent=false)=>{
    const candidates=[];
    for(const [itemIndex,item] of project.scenes.entries())for(const [stageIndex,itemStage] of WORKBENCH_STAGES.entries()){
      const itemDecision=approvedCurrent&&item.id===scene.id&&itemStage===stage?'approved':item.review?.[itemStage]||'pending';
      if(itemDecision!=='approved')candidates.push({item,itemStage,itemIndex,stageIndex,rank:reviewRank(itemDecision)});
    }
    const filtered=viewMode==='stage'?candidates.filter((item)=>item.itemStage===stage):candidates;
    filtered.sort((a,b)=>a.rank-b.rank||(viewMode==='stage'?a.itemIndex-b.itemIndex:a.itemIndex-b.itemIndex||a.stageIndex-b.stageIndex));
    const next=filtered[0];if(next){setSelectedId(next.item.id);setStage(next.itemStage);}
  };
  const approveAndNext=async()=>{await onReview(scene.id,stage,'approved');smartNext(true);};

  useEffect(()=>{
    const handle=(event)=>{
      if(['INPUT','TEXTAREA','BUTTON'].includes(event.target?.tagName))return;
      if(event.key==='ArrowDown')go(1);
      if(event.key==='ArrowUp')go(-1);
      if(/^[1-4]$/.test(event.key))setStage(WORKBENCH_STAGES[Number(event.key)-1]);
    };
    window.addEventListener('keydown',handle);return()=>window.removeEventListener('keydown',handle);
  },[sceneIndex,project.scenes.length]);

  return <section className="workbench">
    <aside className={`scene-navigator view-${viewMode}`}>
      <div className="workbench-pane-head"><span>{c.sceneNavigator}</span><Badge variant="outline">{project.scenes.length}</Badge></div>
      <div className="review-view-toggle"><button className={viewMode==='scene'?'active':''} onClick={()=>setViewMode('scene')}><ListChecks/>{c.byScene}</button><button className={viewMode==='stage'?'active':''} onClick={()=>setViewMode('stage')}><Layers3/>{c.byStage}</button></div>
      <button className="smart-next" onClick={()=>smartNext()}><Sparkles/>{c.nextTask}<ArrowRight/></button>
      <div className="scene-nav-list">{project.scenes.map((item,index)=><button key={item.id} className={item.id===scene.id?'active':''} onClick={()=>setSelectedId(item.id)}>
        <span className="scene-nav-number">{String(index+1).padStart(2,'0')}</span>
        <span className="scene-nav-copy"><strong>{item.text.split(/[.!?]/)[0]}</strong><small>{(item.durationMs/1000).toFixed(1)} {c.seconds}</small></span>
        <span className="scene-nav-dots">{WORKBENCH_STAGES.map((itemStage)=><i key={itemStage} className={`${item.review?.[itemStage]||'pending'} ${itemStage===stage?'current-stage':''}`} title={`${stageLabel(itemStage,c)}: ${c.review[item.review?.[itemStage]||'pending']}`}/>)}</span>
      </button>)}</div>
    </aside>

    <div className="preview-deck">
      <div className="preview-toolbar"><div><span>{scene.id}</span><strong>{stageLabel(stage,c)}</strong></div><Badge variant={badgeVariant(scene.status)}>{statusLabel(scene.status,c)}</Badge></div>
      <div className={`preview-canvas format-${project.settings?.format||'landscape'}`}><StagePreview project={project} scene={scene} stage={stage} c={c}/></div>
      <div className="scene-pager"><button disabled={sceneIndex===0} onClick={()=>go(-1)}><ArrowLeft/>{c.previousScene}</button><span>{sceneIndex+1} / {project.scenes.length}</span><button disabled={sceneIndex===project.scenes.length-1} onClick={()=>go(1)}>{c.nextScene}<ArrowRight/></button></div>
    </div>

    <aside className="scene-inspector">
      <div className="workbench-pane-head"><span>{c.inspector}</span><small>{stageLabel(stage,c)}</small></div>
      <div className="inspector-body">
        <label className="scene-renderer"><span>{c.renderer}</span><small>{c.sceneRendererHint}</small><Select value={scene.renderer||project.settings?.renderer} onValueChange={(renderer)=>onSave(scene.id,{text,visualPrompt:prompt,renderer})} disabled={running}><SelectTrigger aria-label={c.renderer}><SelectValue/></SelectTrigger><SelectContent>{rendererOptions(rendererNames,c)}</SelectContent></Select></label>
        {stage==='script'&&<label><span>{c.narration}</span><small>{text.length} {c.chars}</small><Textarea value={text} onChange={(event)=>setText(event.target.value)} rows={12}/></label>}
        {stage==='visual'&&<label><span>{c.visualDirection}</span><small>{c.imagePrompt}</small><Textarea value={prompt} onChange={(event)=>setPrompt(event.target.value)} rows={14}/></label>}
        {stage==='voice'&&<div className="inspector-note"><Mic2/><strong>{c.voiceStage}</strong><p>{c.voiceInspectorBody}</p><small>{(scene.durationMs/1000).toFixed(1)} {c.seconds}</small></div>}
        {stage==='clip'&&<div className="inspector-note"><Film/><strong>{c.clipStage}</strong><p>{c.clipInspectorBody}</p><small>{scene.artifacts?.clip||c.awaitingStage}</small></div>}
      </div>
      <div className="inspector-actions"><Button variant="outline" disabled={!dirty||running} onClick={()=>onSave(scene.id,{text,visualPrompt:prompt})}><Save/>{c.saveEdit}</Button></div>
    </aside>

    <footer className="stage-dock">
      <div className="stage-tabs">{WORKBENCH_STAGES.map((itemStage)=>{const itemDecision=scene.review?.[itemStage]||'pending';return <Tooltip key={itemStage}><TooltipTrigger asChild><button aria-label={stageLabel(itemStage,c)} className={`${stage===itemStage?'active':''} ${itemDecision}`} onClick={()=>setStage(itemStage)}><span className="stage-tab-icon"><StageIcon stage={itemStage}/></span><strong>{stageLabel(itemStage,c)}</strong><i/></button></TooltipTrigger><TooltipContent>{c.review[itemDecision]}</TooltipContent></Tooltip>;})}</div>
      <div className="stage-primary">
        {project.settings?.workflowMode==='auto'?<Button disabled={running} onClick={async()=>{if(dirty)await onSave(scene.id,{text,visualPrompt:prompt});await onRunStage(scene.id,'all');}}>{running?<LoaderCircle className="spin"/>:<WandSparkles/>}{c.renderScene}</Button>:<>
          {stage!=='script'&&<Button variant="outline" disabled={running||!upstreamApproved} onClick={()=>onRunStage(scene.id,stage)}><RefreshCw/>{ready?c.regenerate:c.generate}</Button>}
          {ready&&decision!=='changes-requested'&&<Button variant="ghost" disabled={running} onClick={()=>onReview(scene.id,stage,'changes-requested')}><X/>{c.requestChanges}</Button>}
          <Button disabled={running||dirty||!ready||decision==='approved'} onClick={approveAndNext}><Check/>{sceneIndex<project.scenes.length-1?c.approveNext:c.approve}</Button>
        </>}
      </div>
    </footer>
  </section>;
}

function NewProjectDialog({open,onOpenChange,onCreate,busy,defaultRenderer='simple',rendererNames,defaultLanguage='vi',c}){
  const [sourceType,setSourceType]=useState('topic');
  const [renderer,setRenderer]=useState(defaultRenderer);
  const [language,setLanguage]=useState(defaultLanguage);
  const [workflowMode,setWorkflowMode]=useState('studio');
  const [format,setFormat]=useState('landscape');
  useEffect(()=>{if(open){setRenderer(defaultRenderer);setLanguage(defaultLanguage);setWorkflowMode('studio');setFormat('landscape');}},[open,defaultRenderer,defaultLanguage]);
  const submit=(event)=>{event.preventDefault();const data=Object.fromEntries(new FormData(event.currentTarget));onCreate({...data,sourceType,renderer,language,workflowMode,format});};
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="new-project-dialog">
      <DialogHeader>
        <div className="dialog-index">{c.newIndex}</div>
        <DialogTitle>{c.startProduction}</DialogTitle>
        <DialogDescription>{c.startDescription}</DialogDescription>
      </DialogHeader>
      <form onSubmit={submit} className="new-project-form">
        <div className="field-row">
          <label>{c.projectTitle}<Input name="title" placeholder={c.titlePlaceholder} required/></label>
          <label>{c.startingPoint}<Select value={sourceType} onValueChange={setSourceType}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="topic">{c.topicAuto}</SelectItem><SelectItem value="script">{c.preparedScript}</SelectItem><SelectItem value="srt">{c.srtSubtitles}</SelectItem></SelectContent></Select></label>
        </div>
        <label>{sourceType==='topic'?c.explainPrompt:sourceType==='srt'?c.pasteSrt:c.pasteScript}
          <Textarea name="sourceText" rows={10} placeholder={sourceType==='topic'?c.topicPlaceholder:sourceType==='srt'?'1\n00:00:00,000 --> 00:00:04,000\n…':c.scriptPlaceholder} required/>
        </label>
        <div className="production-options">
          <label>{c.videoFormat}<Select value={format} onValueChange={setFormat}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="landscape">{c.landscapeFormat}</SelectItem><SelectItem value="short">{c.shortFormat}</SelectItem></SelectContent></Select><small>{format==='short'?c.shortFormatHint:c.landscapeFormatHint}</small></label>
          <label>{c.renderStyle}<Select value={renderer} onValueChange={setRenderer}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{rendererOptions(rendererNames,c)}</SelectContent></Select><small>{c.rendererHint}</small></label>
          <label>{c.contentLanguage}<Select value={language} onValueChange={setLanguage}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{UI_LANGUAGES.map((item)=><SelectItem key={item.code} value={item.code}>{item.label}</SelectItem>)}</SelectContent></Select></label>
          <label className="minutes-field">{c.targetLength}<Input name="minutes" type="number" min="1" max="60" defaultValue="6"/><span>{c.minutes}</span></label>
        </div>
        <div className="mode-picker"><button type="button" className={workflowMode==='studio'?'active':''} onClick={()=>setWorkflowMode('studio')}><SlidersHorizontal/><span><strong>{c.studioMode}</strong><small>{c.studioModeBody}</small></span></button><button type="button" className={workflowMode==='auto'?'active':''} onClick={()=>setWorkflowMode('auto')}><Bot/><span><strong>{c.autoMode}</strong><small>{c.autoModeBody}</small></span></button></div>
        <DialogFooter><Button type="button" variant="ghost" onClick={()=>onOpenChange(false)}>{c.cancel}</Button><Button type="submit" disabled={busy}>{busy?<LoaderCircle className="spin"/>:<Clapperboard/>}{c.createProduction}</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}

function SettingsDialog({open,onOpenChange,onSaved,c}){
  const [form,setForm]=useState(null);
  const [showKey,setShowKey]=useState(false);
  const [showVivibeKey,setShowVivibeKey]=useState(false);
  const [vivibeVoices,setVivibeVoices]=useState([]);
  const [voiceLoading,setVoiceLoading]=useState(false);
  const [saving,setSaving]=useState(false);
  const [message,setMessage]=useState(null);
  const update=(key,value)=>setForm((current)=>({...current,[key]:value}));
  const hydrated=(settings)=>({...settings,apiKey:'',clearApiKey:false,vivibeApiKey:'',clearVivibeApiKey:false});

  useEffect(()=>{
    if(!open)return;
    setForm(null);setMessage(null);setShowKey(false);setShowVivibeKey(false);setVivibeVoices([]);
    api('/api/settings').then((settings)=>setForm(hydrated(settings))).catch((cause)=>setMessage({type:'error',text:cause.message}));
  },[open]);

  const persist=async(testAfter=false)=>{
    setSaving(true);setMessage(null);
    try{
      const settings=await api('/api/settings',{method:'PATCH',body:JSON.stringify(form)});
      setForm(hydrated(settings));
      await onSaved();
      if(testAfter){
        const result=await api('/api/settings/test',{method:'POST',body:'{}'});
        setMessage({type:'success',text:`Connected successfully with ${result.model}.`});
      }else setMessage({type:'success',text:c.settingsSaved});
    }catch(cause){setMessage({type:'error',text:cause.message});}
    finally{setSaving(false);}
  };

  const loadVivibeVoices=async()=>{
    setVoiceLoading(true);setMessage(null);
    try{
      const result=await api('/api/voice-providers/vivibe/voices',{method:'POST',body:JSON.stringify({apiKey:form.vivibeApiKey,baseUrl:form.vivibeBaseUrl})});
      setVivibeVoices(result.items||[]);
      if(!form.vivibeVoiceId&&result.items?.[0])update('vivibeVoiceId',result.items[0].id);
      setMessage({type:'success',text:`Loaded ${result.items?.length||0} active Vivibe voices.`});
    }catch(cause){setMessage({type:'error',text:cause.message});}
    finally{setVoiceLoading(false);}
  };

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="settings-dialog">
      {!form?<div className="settings-loading"><DialogTitle className="sr-only">{c.providerSettings}</DialogTitle><DialogDescription className="sr-only">{c.loadingConfig}</DialogDescription><LoaderCircle className="spin"/><span>{c.loadingConfig}</span></div>:<div className="settings-layout">
        <aside className="settings-aside">
          <div><div className="dialog-index">{c.settingsIndex}</div><DialogTitle>{c.providerSettings}</DialogTitle><DialogDescription>{c.providerDescription}</DialogDescription></div>
          <div className="security-card"><ShieldCheck/><div><strong>{c.serverSecrets}</strong><p>{c.serverSecretsBody}</p></div></div>
          <div className="connection-state"><span className={`status-light ${form.hasOpenAIKey&&!form.clearApiKey?'online':''}`}/><div><strong>{form.clearApiKey?'OpenAI key marked for removal':form.hasOpenAIKey?'OpenAI connected':'No OpenAI key'}</strong><small>Text & image · {form.enableOpenAI?'live':'mock'}</small></div></div>
          <div className="connection-state"><span className={`status-light ${form.voiceProvider==='mock'||form.voiceProvider==='openai'&&form.hasOpenAIKey||form.voiceProvider==='vivibe'&&form.hasVivibeKey?'online':''}`}/><div><strong>{form.voiceProvider==='vivibe'?'Vivibe / LucyAI':form.voiceProvider==='openai'?'OpenAI voice':'Mock voice'}</strong><small>Active voice source</small></div></div>
          <div className="settings-mode"><div><strong>{c.useOpenAI}</strong><span>{c.textImageProviders}</span></div><Switch checked={form.enableOpenAI} onCheckedChange={(value)=>update('enableOpenAI',value)}/></div>
          <div className="settings-aside-foot"><KeyRound/><span>{c.independentVoice}</span></div>
        </aside>

        <div className="settings-main">
          <DialogHeader><DialogTitle>{c.connectionsModels}</DialogTitle><DialogDescription>{c.connectionsBody}</DialogDescription></DialogHeader>
          <div className="settings-section">
            <div className="settings-section-title"><Settings2/><span><strong>{c.languageRegion}</strong><small>{c.languageRegionHint}</small></span></div>
            <div className="settings-fields two-columns">
              <label>{c.interfaceLanguage}<Select value={form.uiLanguage} onValueChange={(value)=>update('uiLanguage',value)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{UI_LANGUAGES.map((item)=><SelectItem key={item.code} value={item.code}>{item.label}</SelectItem>)}</SelectContent></Select></label>
              <label>{c.defaultVideoLanguage}<Select value={form.contentLanguage} onValueChange={(value)=>update('contentLanguage',value)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{UI_LANGUAGES.map((item)=><SelectItem key={item.code} value={item.code}>{item.label}</SelectItem>)}</SelectContent></Select></label>
            </div>
          </div>
          <Separator/>
          <div className="settings-section">
            <div className="settings-section-title"><Server/><span><strong>{c.connection}</strong><small>{c.credentialEndpoint}</small></span></div>
            <div className="settings-fields two-columns">
              <label className="key-field">{c.apiKey}<div className="key-input"><Input type={showKey?'text':'password'} autoComplete="new-password" value={form.apiKey} onChange={(event)=>setForm((current)=>({...current,apiKey:event.target.value,clearApiKey:false}))} placeholder={form.hasOpenAIKey?'••••••••':'sk-proj-…'}/><button type="button" onClick={()=>setShowKey((value)=>!value)} aria-label={c.apiKey}>{showKey?<EyeOff/>:<Eye/>}</button></div></label>
              <label>{c.baseUrl}<Input value={form.baseUrl} onChange={(event)=>update('baseUrl',event.target.value)} placeholder="https://api.openai.com/v1"/></label>
            </div>
            {form.hasOpenAIKey&&<Button type="button" size="sm" variant={form.clearApiKey?'secondary':'ghost'} className="remove-key" onClick={()=>setForm((current)=>({...current,clearApiKey:!current.clearApiKey,apiKey:''}))}>{form.clearApiKey?'Keep saved key':'Remove saved key'}</Button>}
          </div>
          <Separator/>
          <div className="settings-section">
            <div className="settings-section-title"><Clapperboard/><span><strong>{c.defaultRenderer}</strong><small>{c.appliedNew}</small></span></div>
            <div className="renderer-setting">
              <label>{c.renderStyle}<Select value={form.renderer} onValueChange={(value)=>update('renderer',value)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{rendererOptions(form.rendererNames||[],c)}</SelectContent></Select></label>
              <p><strong>{form.renderer==='whiteboard'?'Draw-on animation':'Fast image motion'}</strong><span>{form.renderer==='whiteboard'?'Uses the external whiteboard engine and generated scene illustration.':'Uses FFmpeg for a subtle zoom and remains the offline fallback.'}</span></p>
            </div>
          </div>
          <Separator/>
          <div className="settings-section">
            <div className="settings-section-title"><BrainCircuit/><span><strong>{c.generationStack}</strong><small>{c.modelsUsed}</small></span></div>
            <div className="settings-fields two-columns">
              <label>{c.scriptModel}<Input value={form.textModel} onChange={(event)=>update('textModel',event.target.value)} /></label>
              <label>{c.imageModel}<Input value={form.imageModel} onChange={(event)=>update('imageModel',event.target.value)} /></label>
              <label>{c.imageSize}<Select value={form.imageSize} onValueChange={(value)=>update('imageSize',value)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="1536x1024">1536 × 1024</SelectItem><SelectItem value="1024x1024">1024 × 1024</SelectItem><SelectItem value="1024x1536">1024 × 1536</SelectItem><SelectItem value="auto">Auto</SelectItem></SelectContent></Select></label>
              <label>{c.imageQuality}<Select value={form.imageQuality} onValueChange={(value)=>update('imageQuality',value)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="low">Low</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="high">High</SelectItem><SelectItem value="auto">Auto</SelectItem></SelectContent></Select></label>
            </div>
          </div>
          <Separator/>
          <div className="settings-section voice-provider-section">
            <div className="settings-section-title"><Mic2/><span><strong>{c.voiceSource}</strong><small>{c.narrationProvider}</small></span></div>
            <div className="voice-provider-head">
              <label>{c.provider}<Select value={form.voiceProvider} onValueChange={(value)=>{update('voiceProvider',value);setVivibeVoices([]);}}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="openai">OpenAI Speech</SelectItem><SelectItem value="vivibe">Vivibe / LucyAI</SelectItem><SelectItem value="mock">Mock</SelectItem></SelectContent></Select></label>
              <p>{form.voiceProvider==='vivibe'?'Async Vietnamese voice generation via ttsLongText. Audio is normalized to MP3 before entering the timeline.':form.voiceProvider==='openai'?'Direct speech synthesis with model, voice, and delivery instructions.':'Offline silent MP3 for smoke tests and zero-cost development.'}</p>
            </div>
            {form.voiceProvider==='openai'&&<><div className="settings-fields two-columns voice-fields"><label>Speech model<Input value={form.ttsModel} onChange={(event)=>update('ttsModel',event.target.value)} /></label><label>Voice<Input value={form.ttsVoice} onChange={(event)=>update('ttsVoice',event.target.value)} /></label></div><label className="instruction-field">Voice direction<Textarea rows={3} value={form.ttsInstructions} onChange={(event)=>update('ttsInstructions',event.target.value)} /></label></>}
            {form.voiceProvider==='vivibe'&&<div className="vivibe-panel">
              <div className="settings-fields two-columns">
                <label className="key-field">Vivibe API key<div className="key-input"><Input type={showVivibeKey?'text':'password'} autoComplete="new-password" value={form.vivibeApiKey} onChange={(event)=>setForm((current)=>({...current,vivibeApiKey:event.target.value,clearVivibeApiKey:false}))} placeholder={form.hasVivibeKey?'Leave blank to keep saved key':'Paste Vivibe API key'}/><button type="button" onClick={()=>setShowVivibeKey((value)=>!value)} aria-label={showVivibeKey?'Hide Vivibe API key':'Show Vivibe API key'}>{showVivibeKey?<EyeOff/>:<Eye/>}</button></div><small>{form.hasVivibeKey&&!form.clearVivibeApiKey?'A key is already stored.':'Created at vivibe.app/docs/api-keys.'}</small></label>
                <label>JSON-RPC URL<Input value={form.vivibeBaseUrl} onChange={(event)=>update('vivibeBaseUrl',event.target.value)} /><small>Default: api.lucylab.io/json-rpc</small></label>
              </div>
              {form.hasVivibeKey&&<Button type="button" size="sm" variant={form.clearVivibeApiKey?'secondary':'ghost'} className="remove-key" onClick={()=>setForm((current)=>({...current,clearVivibeApiKey:!current.clearVivibeApiKey,vivibeApiKey:''}))}>{form.clearVivibeApiKey?'Keep saved Vivibe key':'Remove saved Vivibe key'}</Button>}
              <div className="voice-identity-row">
                <label>Voice ID<Input value={form.vivibeVoiceId} onChange={(event)=>update('vivibeVoiceId',event.target.value)} placeholder="Your Vivibe voice ID"/></label>
                <label>Speed<Input type="number" min="0.5" max="2" step="0.1" value={form.vivibeSpeed} onChange={(event)=>update('vivibeSpeed',event.target.value)}/></label>
                <Button type="button" variant="outline" disabled={voiceLoading||form.clearVivibeApiKey||(!form.hasVivibeKey&&!form.vivibeApiKey)} onClick={loadVivibeVoices}>{voiceLoading?<LoaderCircle className="spin"/>:<RefreshCw/>}Load voices</Button>
              </div>
              {vivibeVoices.length>0&&<label className="vivibe-voice-list">Available voices<Select value={form.vivibeVoiceId||undefined} onValueChange={(value)=>update('vivibeVoiceId',value)}><SelectTrigger><SelectValue placeholder="Choose a voice"/></SelectTrigger><SelectContent>{vivibeVoices.map((voice)=><SelectItem key={voice.id} value={voice.id}>{voice.name}</SelectItem>)}</SelectContent></Select><small>{vivibeVoices.length} active voices returned by getUserVoices.</small></label>}
            </div>}
          </div>
          {message&&<div className={`settings-message ${message.type}`}>
            {message.type==='success'?<CheckCircle2/>:<CircleDot/>}<span>{message.text}</span>
          </div>}
          <DialogFooter className="settings-footer"><Button type="button" variant="ghost" onClick={()=>onOpenChange(false)}>{c.close}</Button><Button type="button" variant="outline" disabled={saving||form.clearApiKey||(!form.hasOpenAIKey&&!form.apiKey)} onClick={()=>persist(true)}>{saving?<LoaderCircle className="spin"/>:<Activity/>}{c.saveTest}</Button><Button type="button" disabled={saving} onClick={()=>persist(false)}>{saving?<LoaderCircle className="spin"/>:<Save/>}{c.saveSettings}</Button></DialogFooter>
        </div>
      </div>}
    </DialogContent>
  </Dialog>;
}

export default function App(){
  const [projects,setProjects]=useState([]);
  const [current,setCurrent]=useState(null);
  const [health,setHealth]=useState(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [dialogOpen,setDialogOpen]=useState(false);
  const [settingsOpen,setSettingsOpen]=useState(false);
  const [projectView,setProjectView]=useState('overview');
  const [workbenchFocus,setWorkbenchFocus]=useState({sceneId:null,stage:'script'});

  const running=!!current&&health?.running?.includes(current.id);
  const config=health?.config;
  const c=copyFor(config?.uiLanguage||'vi');
  const approvedClips=useMemo(()=>current?.scenes?.filter((scene)=>scene.review?.clip==='approved').length||0,[current]);

  const refreshHealth=async()=>setHealth(await api('/api/health'));
  const refreshProjects=async()=>setProjects(await api('/api/projects'));
  const load=async(id)=>{const project=await api(`/api/projects/${encodeURIComponent(id)}`);setCurrent(project);setProjectView('overview');await Promise.all([refreshProjects(),refreshHealth()]);};

  useEffect(()=>{Promise.all([refreshProjects(),refreshHealth()]).catch((cause)=>setError(cause.message));},[]);

  const createProject=async(payload)=>{
    setBusy(true);setError('');
    try{const project=await api('/api/projects',{method:'POST',body:JSON.stringify(payload)});setDialogOpen(false);await load(project.id);}
    catch(cause){setError(cause.message);}finally{setBusy(false);}
  };
  const createDemo=()=>createProject(config?.contentLanguage==='en'?{title:'Small Habits — Test Cut',sourceType:'script',sourceText:'Small habits feel insignificant at first, but repetition gives them power. Each action becomes a vote for the person you want to become. Make the next step obvious, easy, and satisfying, then let consistency do the heavy lifting.',minutes:1,language:'en'}:{title:'Thói quen nhỏ — Bản thử',sourceType:'script',sourceText:'Những thói quen nhỏ ban đầu có vẻ không đáng kể, nhưng sự lặp lại tạo cho chúng sức mạnh. Mỗi hành động là một lá phiếu cho con người bạn muốn trở thành. Hãy làm cho bước tiếp theo thật rõ ràng, dễ dàng và thú vị, rồi để sự kiên trì tạo nên khác biệt.',minutes:1,language:'vi'});
  const saveScene=async(sceneId,payload)=>{setBusy(true);setError('');try{const project=await api(`/api/projects/${encodeURIComponent(current.id)}/scenes/${encodeURIComponent(sceneId)}`,{method:'PATCH',body:JSON.stringify(payload)});setCurrent(project);await refreshProjects();}catch(cause){setError(cause.message);}finally{setBusy(false);}};
  const updateProject=async(payload)=>{setBusy(true);setError('');try{const project=await api(`/api/projects/${encodeURIComponent(current.id)}`,{method:'PATCH',body:JSON.stringify(payload)});setCurrent(project);await refreshProjects();}catch(cause){setError(cause.message);}finally{setBusy(false);}};
  const changeRenderer=async(renderer)=>{if(!current||renderer===current.settings?.renderer)return;await updateProject({renderer});};
  const changeFormat=async(format)=>{if(!current||format===current.settings?.format)return;await updateProject({format});};
  const run=async(body={})=>{setBusy(true);setError('');try{await api(`/api/projects/${encodeURIComponent(current.id)}/run`,{method:'POST',body:JSON.stringify(body)});await load(current.id);}catch(cause){setError(cause.message);try{await load(current.id);}catch{}}finally{setBusy(false);await refreshHealth().catch(()=>{});}};
  const runStage=async(sceneId,stage)=>run({sceneId,stage});
  const runBulk=async(stage,sceneIds)=>run({stage,sceneIds});
  const reviewStage=async(sceneId,stage,decision)=>{setBusy(true);setError('');try{const project=await api(`/api/projects/${encodeURIComponent(current.id)}/scenes/${encodeURIComponent(sceneId)}/review`,{method:'POST',body:JSON.stringify({stage,decision})});setCurrent(project);await refreshProjects();}catch(cause){setError(cause.message);}finally{setBusy(false);}};
  const reviewBulk=async(stage,sceneIds,decision)=>{setBusy(true);setError('');try{const project=await api(`/api/projects/${encodeURIComponent(current.id)}/review`,{method:'POST',body:JSON.stringify({stage,sceneIds,decision})});setCurrent(project);await refreshProjects();}catch(cause){setError(cause.message);}finally{setBusy(false);}};
  const openWorkbench=(sceneId,stage='script')=>{setWorkbenchFocus({sceneId,stage});setProjectView('workbench');};

  return <div className="app-shell">
    <header className="app-header">
      <button className="brand" onClick={()=>setCurrent(null)}><BrandMark/><span><strong>CUTROOM</strong><small>{c.brandSubtitle}</small></span></button>
      <div className="header-rule"/>
      <div className="runtime-status">
        <span className={`status-light ${health?'online':''}`}/>
        <div><strong>{health?c.systemReady:c.connecting}</strong><small>{config?`${config.mockMode?'Mock':'Live'} · ${config.renderer}`:c.localRuntime}</small></div>
      </div>
      <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={()=>Promise.all([refreshProjects(),refreshHealth()])}><RefreshCw/></Button></TooltipTrigger><TooltipContent>{c.refreshWorkspace}</TooltipContent></Tooltip>
    </header>

    <div className={`workspace-grid ${current?'project-open':''}`}>
      <aside className={`project-rail ${current?'compact':''}`}>
        <div className="rail-heading"><span>{c.productions}</span><Badge variant="outline">{projects.length}</Badge></div>
        <Button className="new-project-button" onClick={()=>setDialogOpen(true)}><Plus/>{c.newProduction}</Button>
        <ScrollArea className="project-scroll">
          <div className="project-list">{projects.map((project)=><button key={project.id} className={`project-item ${project.id===current?.id?'active':''}`} onClick={()=>load(project.id)}>
            <span className="project-thumb"><Clapperboard/></span>
            <span className="project-copy"><strong>{project.title}</strong><small>{project.scenes.length} {c.scenes} · {statusLabel(project.status,c)}</small></span>
            <MoreHorizontal className="project-more"/>
          </button>)}</div>
        </ScrollArea>
        <button className="rail-footer" onClick={()=>setSettingsOpen(true)}>
          <div><Settings2/><span><strong>{config?.mockMode?c.testMode:c.production}</strong><small>{config?.hasOpenAIKey?c.apiConfigured:c.openaiSettings}</small></span></div>
          <div className="provider-line">{config?.imageModel||'image'}<br/>{config?.voiceProvider||'voice'}{config?.voiceProvider==='vivibe'&&config?.vivibeVoiceId?` · ${config.vivibeVoiceId.slice(0,8)}`:''}</div>
        </button>
      </aside>

      <main className={`main-stage ${current?'workbench-stage':''}`}>
        {error&&<div className="error-banner"><CircleDot/><span>{error}</span><button onClick={()=>setError('')}>{c.dismiss}</button></div>}
        {!current?<EmptyState onCreate={()=>setDialogOpen(true)} onDemo={createDemo} c={c}/>:<>
          <section className="project-header compact-header">
            <div><div className="eyebrow">{c.production} / {current.id.slice(-6).toUpperCase()}</div><h1>{current.title}</h1></div>
            <div className="project-actions">
              <div className="project-view-tabs"><button className={projectView==='overview'?'active':''} onClick={()=>setProjectView('overview')}><Grid2X2/>{c.overview}</button><button className={projectView==='workbench'?'active':''} onClick={()=>openWorkbench(workbenchFocus.sceneId||current.scenes[0].id,workbenchFocus.stage)}><SlidersHorizontal/>{c.workbench}</button></div>
              <div className="compact-progress"><strong>{approvedClips}/{current.scenes.length}</strong><small>{c.clipsApproved}</small></div>
              <div className="mode-switch light"><button className={current.settings?.workflowMode==='studio'?'active':''} disabled={busy||running} onClick={()=>updateProject({workflowMode:'studio'})}><SlidersHorizontal/>{c.studioMode}</button><button className={current.settings?.workflowMode==='auto'?'active':''} disabled={busy||running} onClick={()=>updateProject({workflowMode:'auto'})}><Bot/>{c.autoMode}</button></div>
              <label className="renderer-control"><span>{c.renderer}</span><Select value={current.settings?.renderer||config?.renderer||'simple'} onValueChange={changeRenderer} disabled={busy||running}><SelectTrigger aria-label={c.renderer}><SelectValue/></SelectTrigger><SelectContent>{rendererOptions(config?.rendererNames||[],c)}</SelectContent></Select></label>
              <label className="renderer-control"><span>{c.videoFormat}</span><Select value={current.settings?.format||'landscape'} onValueChange={changeFormat} disabled={busy||running}><SelectTrigger aria-label={c.videoFormat}><SelectValue/></SelectTrigger><SelectContent><SelectItem value="landscape">16:9</SelectItem><SelectItem value="short">9:16</SelectItem></SelectContent></Select></label>
              <Button size="lg" disabled={busy||running||current.settings?.workflowMode==='studio'&&approvedClips!==current.scenes.length} onClick={()=>run({stage:current.settings?.workflowMode==='studio'?'final':'all'})}>{busy||running?<LoaderCircle className="spin"/>:<Play/>}{busy||running?c.rendering:current.settings?.workflowMode==='studio'?c.assembleFinal:c.runPipeline}</Button>
            </div>
          </section>
          {current.error&&<div className="project-error"><strong>{c.lastRunStopped}</strong><span>{current.error.message}</span></div>}
          {projectView==='overview'?<ProjectOverview project={current} running={busy||running} onOpenScene={openWorkbench} onBulkRun={runBulk} onBulkReview={reviewBulk} c={c}/>:<Workbench key={`${current.id}:${workbenchFocus.sceneId}:${workbenchFocus.stage}`} project={current} initialSceneId={workbenchFocus.sceneId} initialStage={workbenchFocus.stage} running={busy||running} onSave={saveScene} onRunStage={runStage} onReview={reviewStage} rendererNames={config?.rendererNames||[]} c={c}/>}
        </>}
      </main>
    </div>
    <NewProjectDialog open={dialogOpen} onOpenChange={setDialogOpen} onCreate={createProject} busy={busy} defaultRenderer={config?.renderer||'simple'} rendererNames={config?.rendererNames||[]} defaultLanguage={config?.contentLanguage||'vi'} c={c}/>
    <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} onSaved={refreshHealth} c={c}/>
  </div>;
}
