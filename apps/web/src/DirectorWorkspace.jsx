import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  AudioLines,
  Bot,
  Check,
  CheckCircle2,
  Clapperboard,
  Copy,
  Eye,
  FileText,
  Film,
  Image as ImageIcon,
  Layers3,
  LoaderCircle,
  Merge,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Save,
  Scissors,
  Send,
  Sparkles,
  Trash2,
  WandSparkles,
  X,
  Zap,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

const STAGES=['script','voice','visual','clip'];
const VIEWS=['best','script','voice','visual','clip'];
const labels=(c)=>({best:c.bestAvailable,script:c.scriptStage,voice:c.voiceStage,visual:c.visualStage,clip:c.clipStage});
const StageIcon=({stage})=>stage==='script'?<FileText/>:stage==='voice'?<AudioLines/>:stage==='visual'?<ImageIcon/>:<Film/>;
const mediaUrl=(project,scene,kind)=>`/media/${encodeURIComponent(project.id)}/scenes/${encodeURIComponent(scene.id)}/${kind}?v=${encodeURIComponent(project.updatedAt||'current')}`;
const ready=(scene,stage)=>stage==='script'||stage==='voice'&&!!scene.cache?.voice||stage==='visual'&&!!scene.cache?.image||stage==='clip'&&!!scene.artifacts?.clip;

function sceneHealth(scene,c,hasFinal=false){
  const decisions=STAGES.map((stage)=>scene.review?.[stage]||'pending');
  if(decisions.includes('changes-requested'))return {key:'attention',label:c.needsAttention,tone:'danger'};
  if(decisions.includes('stale'))return {key:'stale',label:c.outOfDate,tone:'warning'};
  if(scene.review?.clip==='approved'||hasFinal&&scene.artifacts?.clip)return {key:'ready',label:c.sceneReady,tone:'success'};
  if(scene.artifacts?.clip)return {key:'review',label:c.needsReview,tone:'accent'};
  if(scene.cache?.voice||scene.cache?.image)return {key:'progress',label:c.inProgress,tone:'progress'};
  return {key:'draft',label:c.sceneDraft,tone:'muted'};
}

function nextForScene(scene,c,hasFinal=false){
  const decision=(stage)=>scene.review?.[stage]||'pending';
  if(decision('script')==='changes-requested')return {kind:'edit',stage:'script',title:c.reviseNarration,body:c.reviseNarrationBody};
  if(decision('visual')==='changes-requested')return {kind:'edit',stage:'visual',title:c.reviseVisual,titleAction:c.open,body:c.reviseVisualBody};
  if(decision('voice')==='changes-requested')return {kind:'run',stage:'voice',title:c.generateVoice,titleAction:c.regenerate,body:c.generateVoiceBody};
  if(decision('clip')==='changes-requested')return {kind:'run',stage:'clip',title:c.renderClip,titleAction:c.regenerate,body:c.renderClipBody};
  if(ready(scene,'clip'))return decision('clip')==='approved'||hasFinal?null:{kind:'review',stage:'clip',title:c.reviewClip,titleAction:c.approve,body:c.reviewClipBody};
  if(ready(scene,'visual')&&decision('visual')!=='approved')return {kind:'review',stage:'visual',title:c.reviewVisual,titleAction:c.approve,body:c.reviewVisualBody};
  if(ready(scene,'voice')&&decision('voice')!=='approved')return {kind:'review',stage:'voice',title:c.reviewVoice,titleAction:c.approve,body:c.reviewVoiceBody};
  if(decision('script')!=='approved')return {kind:'review',stage:'script',title:c.approveNarration,titleAction:c.approve,body:c.approveNarrationBody};
  if(!ready(scene,'visual'))return {kind:'run',stage:'visual',title:c.generateVisual,titleAction:c.generate,body:c.generateVisualBody};
  if(decision('visual')!=='approved')return {kind:'review',stage:'visual',title:c.reviewVisual,titleAction:c.approve,body:c.reviewVisualBody};
  if(!ready(scene,'voice'))return {kind:'run',stage:'voice',title:c.generateVoice,titleAction:c.generate,body:c.generateVoiceBody};
  if(decision('voice')!=='approved')return {kind:'review',stage:'voice',title:c.reviewVoice,titleAction:c.approve,body:c.reviewVoiceBody};
  if(!ready(scene,'clip'))return {kind:'run',stage:'clip',title:c.renderClip,titleAction:c.render,body:c.renderClipBody};
  if(decision('clip')!=='approved')return {kind:'review',stage:'clip',title:c.reviewClip,titleAction:c.approve,body:c.reviewClipBody};
  return null;
}

function bestView(scene){
  if(scene.artifacts?.clip)return 'clip';
  if(scene.artifacts?.visual||scene.cache?.image)return 'visual';
  if(scene.artifacts?.voice||scene.cache?.voice)return 'voice';
  return 'script';
}

function Preview({project,scene,view,c}){
  const actual=view==='best'?bestView(scene):view;
  if(actual==='clip'&&scene.artifacts?.clip)return <video className="director-media" controls preload="metadata" src={mediaUrl(project,scene,'clip')}/>;
  if(actual==='visual'&&scene.artifacts?.visual)return <img className="director-media" src={mediaUrl(project,scene,'visual')} alt={`${c.visual} ${scene.index+1}`}/>;
  if(actual==='voice'&&scene.artifacts?.voice)return <div className="director-voice-card"><span><AudioLines/></span><small>{c.voiceStage}</small><p>{scene.text}</p><audio controls preload="metadata" src={mediaUrl(project,scene,'voice')}/></div>;
  if(actual==='script')return <div className="director-script-card"><span>“</span><p>{scene.text}</p><footer><strong>{String(scene.index+1).padStart(2,'0')}</strong><small>{(scene.durationMs/1000).toFixed(1)} {c.seconds}</small></footer></div>;
  return <div className="director-empty-preview"><span><StageIcon stage={actual}/></span><strong>{labels(c)[actual]}</strong><p>{actual==='visual'&&scene.cache?.image?c.mockVisualReady:c.awaitingStage}</p></div>;
}

function SceneActions({scene,index,count,onAction,onInsert,c}){
  const [open,setOpen]=useState(false);
  const act=async(action,extra={})=>{setOpen(false);await onAction(scene.id,{action,...extra});};
  const remove=async()=>{if(!window.confirm(c.removeSceneConfirm))return;await act('remove');};
  return <div className="scene-actions" onClick={(event)=>event.stopPropagation()}>
    <button className="scene-more" aria-label={c.structure} onClick={()=>setOpen((value)=>!value)}><MoreHorizontal/></button>
    {open&&<div className="scene-actions-menu">
      <button disabled={index===0} onClick={()=>act('move',{direction:'up'})}><ArrowUp/>{c.moveUp}</button>
      <button disabled={index===count-1} onClick={()=>act('move',{direction:'down'})}><ArrowDown/>{c.moveDown}</button>
      <button onClick={()=>act('split')}><Scissors/>{c.splitScene}</button>
      <button onClick={()=>act('duplicate')}><Copy/>{c.duplicateScene}</button>
      <button disabled={index===count-1} onClick={()=>act('merge-next')}><Merge/>{c.mergeNext}</button>
      <button onClick={()=>{setOpen(false);onInsert(scene.id);}}><Plus/>{c.addAfter}</button>
      <button className="danger" disabled={count===1} onClick={remove}><Trash2/>{c.removeScene}</button>
    </div>}
  </div>;
}

function Storyboard({project,selectedId,onSelect,onAction,onInsert,c}){
  return <aside className="director-storyboard">
    <header><div><span>{c.storyboard}</span><strong>{project.scenes.length} {c.scenes}</strong></div><button aria-label={c.addScene} onClick={()=>onInsert(selectedId)}><Plus/></button></header>
    <div className="storyboard-list">{project.scenes.map((scene,index)=>{
      const health=sceneHealth(scene,c,!!project.artifacts?.final),active=scene.id===selectedId;
      return <article key={scene.id} className={`storyboard-card ${active?'active':''}`} onClick={()=>onSelect(scene.id)}>
        <div className="storyboard-thumb">
          {scene.artifacts?.visual?<img src={mediaUrl(project,scene,'visual')} alt=""/>:<span>{String(index+1).padStart(2,'0')}</span>}
          {scene.artifacts?.clip&&<i><Film/></i>}
        </div>
        <div className="storyboard-copy"><div><span>SC {String(index+1).padStart(2,'0')}</span><small>{(scene.durationMs/1000).toFixed(1)}s</small></div><strong>{scene.text}</strong><footer><em className={health.tone}/><span>{health.label}</span><div>{STAGES.map((stage)=><i key={stage} className={scene.review?.[stage]||'pending'}/>)}</div></footer></div>
        <SceneActions scene={scene} index={index} count={project.scenes.length} onAction={onAction} onInsert={onInsert} c={c}/>
      </article>;
    })}</div>
    <button className="storyboard-add" onClick={()=>onInsert(project.scenes.at(-1)?.id)}><Plus/><span>{c.addScene}</span></button>
  </aside>;
}

function Impact({items,c}){
  if(!items?.length)return null;
  return <div className="director-impact"><span>{c.affected}</span><div>{items.map((stage)=><em key={stage}>{stage==='final'?c.finalFilm:labels(c)[stage]}</em>)}</div></div>;
}

export default function DirectorWorkspace({project,running,onSave,onRunStage,onReview,onRunAll,onRoughCut,onUpdateProject,onSceneAction,onInsertScene,onDirectorPlan,rendererNames,c}){
  const [selectedId,setSelectedId]=useState(project.scenes[0]?.id);
  const [view,setView]=useState('best');
  const [panel,setPanel]=useState('director');
  const [text,setText]=useState('');
  const [visualIntent,setVisualIntent]=useState('');
  const [instruction,setInstruction]=useState('');
  const [proposal,setProposal]=useState(null);
  const [directing,setDirecting]=useState(false);
  const [directorError,setDirectorError]=useState('');
  const [finalOpen,setFinalOpen]=useState(false);
  const scene=project.scenes.find((item)=>item.id===selectedId)||project.scenes[0];
  const sceneIndex=project.scenes.findIndex((item)=>item.id===scene?.id);
  const totalMs=project.scenes.reduce((sum,item)=>sum+item.durationMs,0);
  const completed=project.scenes.filter((item)=>item.review?.clip==='approved'||project.artifacts?.final&&item.artifacts?.clip).length;
  const progress=Math.round(completed/Math.max(1,project.scenes.length)*100);
  const next=useMemo(()=>{
    const hasFinal=!!project.artifacts?.final;
    const own=nextForScene(scene,c,hasFinal);if(own)return {...own,sceneId:scene.id};
    for(const item of project.scenes){const action=nextForScene(item,c,hasFinal);if(action)return {...action,sceneId:item.id};}
    if(!project.artifacts?.final)return {kind:'final',title:c.exportFinal,titleAction:c.export,body:c.exportFinalBody};
    return null;
  },[project,scene,c]);

  useEffect(()=>{if(!project.scenes.some((item)=>item.id===selectedId))setSelectedId(project.scenes[0]?.id);},[project.scenes,selectedId]);
  useEffect(()=>{setText(scene?.text||'');setVisualIntent(scene?.visualIntent||scene?.text||'');setProposal(null);setDirectorError('');},[scene?.id,scene?.text,scene?.visualIntent]);
  if(!scene)return null;
  const dirty=text!==scene.text||visualIntent!==(scene.visualIntent||scene.text);
  const health=sceneHealth(scene,c,!!project.artifacts?.final);

  const selectScene=(id)=>{setSelectedId(id);setView('best');};
  const sceneAction=async(id,payload)=>{const result=await onSceneAction(id,payload);if(result?.selectedSceneId)setSelectedId(result.selectedSceneId);return result;};
  const insert=async(afterSceneId)=>{const result=await onInsertScene(afterSceneId);if(result?.selectedSceneId){setSelectedId(result.selectedSceneId);setPanel('edit');setView('script');}return result;};
  const runNext=async()=>{
    if(!next)return;
    if(next.sceneId&&next.sceneId!==scene.id)setSelectedId(next.sceneId);
    if(next.kind==='edit'){setPanel('edit');setView(next.stage);return;}
    if(next.kind==='review')return onReview(next.sceneId||scene.id,next.stage,'approved');
    if(next.kind==='run')return onRunStage(next.sceneId||scene.id,next.stage);
    if(next.kind==='final')return onRunAll({stage:'final'});
  };
  const askDirector=async(event)=>{event.preventDefault();if(!instruction.trim())return;setDirecting(true);setDirectorError('');try{setProposal(await onDirectorPlan(scene.id,instruction));}catch(error){setDirectorError(error.message);}finally{setDirecting(false);}};
  const applyProposal=async()=>{
    if(!proposal)return;setDirecting(true);setDirectorError('');
    try{
      let applied=true;
      if(proposal.action==='update_scene')applied=await onSave(scene.id,Object.fromEntries(Object.entries(proposal.changes||{}).filter(([,value])=>typeof value==='string')));
      else if(proposal.action==='split_scene')applied=await sceneAction(scene.id,{action:'split'});
      else if(proposal.action==='regenerate_visual')applied=await onRunStage(scene.id,'visual');
      else if(proposal.action==='regenerate_voice')applied=await onRunStage(scene.id,'voice');
      else if(proposal.action==='regenerate_clip')applied=await onRunStage(scene.id,'clip');
      if(!applied)return;
      setProposal(null);setInstruction('');
    }catch(error){setDirectorError(error.message);}finally{setDirecting(false);}
  };
  const save=async()=>{if(await onSave(scene.id,{text,visualIntent}))setPanel('director');};
  const rendererOptions=rendererNames.map((name)=><SelectItem key={name} value={name}>{c[name]||name}</SelectItem>);

  return <section className="director-room">
    <header className="director-project-header">
      <div className="director-project-title"><span><Clapperboard/> {c.directingRoom}</span><h1>{project.title}</h1><p>{project.scenes.length} {c.scenes} · {(totalMs/60000).toFixed(1)} min · {project.settings?.format==='short'?'9:16':'16:9'}</p></div>
      <div className="director-project-progress"><div><span>{c.projectProgress}</span><strong>{progress}%</strong></div><i><b style={{width:`${progress}%`}}/></i></div>
      <div className="director-project-actions">
        <Select value={project.settings?.workflowMode||'studio'} onValueChange={(workflowMode)=>onUpdateProject({workflowMode})} disabled={running}><SelectTrigger aria-label={c.workflowMode}><SelectValue/></SelectTrigger><SelectContent><SelectItem value="studio">{c.controlled}</SelectItem><SelectItem value="auto">{c.autopilot}</SelectItem></SelectContent></Select>
        {project.artifacts?.final?<Button variant="outline" onClick={()=>setFinalOpen(true)}><Eye/>{c.watchFinal}</Button>:<Button disabled={running} onClick={onRoughCut}>{running?<LoaderCircle className="spin"/>:<WandSparkles/>}{c.createRoughCut}</Button>}
      </div>
    </header>

    <div className="director-grid">
      <Storyboard project={project} selectedId={scene.id} onSelect={selectScene} onAction={sceneAction} onInsert={insert} c={c}/>

      <main className="director-stage">
        <header className="director-stage-head"><div><span>SCENE {String(sceneIndex+1).padStart(2,'0')}</span><strong>{view==='best'?c.bestAvailable:labels(c)[view]}</strong></div><Badge className={`health-${health.tone}`} variant="outline">{health.label}</Badge></header>
        <nav className="director-view-tabs" aria-label={c.selectView}>{VIEWS.map((item)=><button key={item} className={view===item?'active':''} onClick={()=>setView(item)}>{item==='best'?<Sparkles/>:<StageIcon stage={item}/>}<span>{labels(c)[item]}</span></button>)}</nav>
        <div className={`director-preview format-${project.settings?.format||'landscape'}`}><Preview project={project} scene={scene} view={view} c={c}/></div>
        <footer className="director-pager"><button disabled={sceneIndex===0} onClick={()=>selectScene(project.scenes[sceneIndex-1].id)}><ArrowLeft/>{c.previousScene}</button><div><strong>{sceneIndex+1}</strong><span>/ {project.scenes.length}</span></div><button disabled={sceneIndex===project.scenes.length-1} onClick={()=>selectScene(project.scenes[sceneIndex+1].id)}>{c.nextScene}<ArrowRight/></button></footer>
      </main>

      <aside className="director-panel">
        <nav><button className={panel==='director'?'active':''} onClick={()=>setPanel('director')}><Bot/>{c.director}</button><button className={panel==='edit'?'active':''} onClick={()=>setPanel('edit')}><Layers3/>{c.editScene}</button></nav>
        {panel==='director'?<div className="director-panel-body">
          <section className="next-action-card">
            <span><Zap/>{c.nextMove}</span>
            {next?<><h2>{next.title}</h2><p>{next.body}</p><Button disabled={running} onClick={runNext}>{running?<LoaderCircle className="spin"/>:next.kind==='review'?<Check/>:next.kind==='edit'?<FileText/>:next.kind==='final'?<Clapperboard/>:<RefreshCw/>}{next.titleAction||c.open}</Button></>:<><h2>{c.allReady}</h2><p>{c.allReadyBody}</p><CheckCircle2 className="all-ready-mark"/></>}
          </section>
          <section className="director-command">
            <header><span><Sparkles/>{c.director}</span><Badge variant="outline">SC {String(sceneIndex+1).padStart(2,'0')}</Badge></header>
            <form onSubmit={askDirector}><Textarea value={instruction} onChange={(event)=>setInstruction(event.target.value)} rows={4} placeholder={c.directorPlaceholder}/><div className="director-suggestions"><button type="button" onClick={()=>setInstruction(c.visualSuggestion)}>{c.visualSuggestion}</button><button type="button" onClick={()=>setInstruction(c.regenerateSuggestion)}>{c.regenerateSuggestion}</button><button type="button" onClick={()=>setInstruction(c.splitSuggestion)}>{c.splitSuggestion}</button></div><Button type="submit" disabled={directing||!instruction.trim()}>{directing?<LoaderCircle className="spin"/>:<Send/>}{c.prepareProposal}</Button></form>
          </section>
          {directorError&&<div className="director-inline-error"><AlertTriangle/><span>{directorError}</span></div>}
          {proposal&&<section className="director-proposal"><header><span>{c.proposal}</span><button onClick={()=>setProposal(null)}><X/></button></header><h3>{proposal.summary}</h3><p>{proposal.note}</p><Impact items={proposal.impact} c={c}/><footer><Button variant="ghost" onClick={()=>setProposal(null)}>{c.discard}</Button><Button disabled={directing||proposal.action==='noop'} onClick={applyProposal}>{directing?<LoaderCircle className="spin"/>:<Check/>}{c.apply}</Button></footer></section>}
        </div>:<div className="director-panel-body edit-panel">
          <section><div className="field-title"><span>{c.narration}</span><small>{text.length} {c.chars}</small></div><Textarea value={text} onChange={(event)=>setText(event.target.value)} rows={8}/></section>
          <section><div className="field-title"><span>{c.visualIntent}</span><small>{c.visualIntentHint}</small></div><Textarea value={visualIntent} onChange={(event)=>setVisualIntent(event.target.value)} rows={6}/></section>
          <details className="director-advanced"><summary>{c.advanced}</summary><label><span>{c.videoFormat}</span><Select value={project.settings?.format||'landscape'} onValueChange={(format)=>onUpdateProject({format})} disabled={running}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="landscape">16:9</SelectItem><SelectItem value="short">9:16</SelectItem></SelectContent></Select></label><label><span>{c.projectRenderer}</span><Select value={project.settings?.renderer} onValueChange={(renderer)=>onUpdateProject({renderer})} disabled={running}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{rendererOptions}</SelectContent></Select></label><label><span>{c.sceneRendererHint}</span><Select value={scene.renderer||project.settings?.renderer} onValueChange={(renderer)=>onSave(scene.id,{renderer})} disabled={running}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{rendererOptions}</SelectContent></Select></label><label><span>{c.technicalPrompt}</span><Textarea value={scene.visualPrompt||''} readOnly rows={5}/></label></details>
          <div className="edit-save"><p>{dirty?c.unsavedImpact:c.noUnsavedChanges}</p><Button disabled={running||!dirty} onClick={save}><Save/>{c.saveChanges}</Button></div>
        </div>}
      </aside>
    </div>

    <footer className="director-timeline">
      <div><span>{c.timeline}</span><strong>{Math.floor(totalMs/60000)}:{String(Math.round(totalMs/1000)%60).padStart(2,'0')}</strong></div>
      <div className="timeline-track">{project.scenes.map((item,index)=>{const itemHealth=sceneHealth(item,c,!!project.artifacts?.final);return <button key={item.id} className={`${item.id===scene.id?'active':''} ${itemHealth.tone}`} style={{flexGrow:Math.max(1,item.durationMs)}} onClick={()=>selectScene(item.id)} title={`${index+1}. ${item.text}`}><span>{index+1}</span><i/></button>;})}</div>
    </footer>

    <Dialog open={finalOpen} onOpenChange={setFinalOpen}><DialogContent className="final-preview-dialog"><DialogHeader><DialogTitle>{c.finalFilm}</DialogTitle><DialogDescription>{project.title}</DialogDescription></DialogHeader>{project.artifacts?.final&&<video controls autoPlay preload="metadata" src={`/media/${encodeURIComponent(project.id)}/final?v=${encodeURIComponent(project.updatedAt||'current')}`}/>}</DialogContent></Dialog>
  </section>;
}
