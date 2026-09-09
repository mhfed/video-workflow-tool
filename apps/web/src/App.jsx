import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  CircleDot,
  Clapperboard,
  Eye,
  EyeOff,
  Film,
  Image as ImageIcon,
  KeyRound,
  LoaderCircle,
  Mic2,
  MoreHorizontal,
  Play,
  Plus,
  RefreshCw,
  Save,
  Server,
  Settings2,
  ShieldCheck,
  Sparkles,
  WandSparkles,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const api=async(url,options={})=>{
  const response=await fetch(url,{headers:{'content-type':'application/json',...(options.headers||{})},...options});
  const body=await response.json();
  if(!response.ok)throw new Error(body.error||response.statusText);
  return body;
};

const statusLabel=(status)=>({draft:'Draft',planned:'Planned','voice-ready':'Voice ready','visual-ready':'Visual ready',rendered:'Rendered',ready:'Ready',running:'Rendering',complete:'Complete',error:'Needs attention'}[status]||status||'Draft');
const badgeVariant=(status)=>status==='complete'?'default':status==='error'?'destructive':'secondary';

function BrandMark(){
  return <div className="brand-mark" aria-hidden="true"><span/><span/><span/></div>;
}

function EmptyState({onCreate,onDemo}){
  return <div className="empty-state">
    <div className="empty-kicker"><Sparkles size={14}/> local-first production desk</div>
    <h2>Turn one idea into<br/><em>a finished cut.</em></h2>
    <p>Shape the script, direct each visual, render only what changed, and review the final film from one calm workspace.</p>
    <div className="empty-actions">
      <Button size="lg" onClick={onCreate}><Plus/>New production</Button>
      <Button size="lg" variant="outline" onClick={onDemo}><Play/>Create test project</Button>
    </div>
    <div className="pipeline-map" aria-label="Workflow stages">
      {[['01','Write'],['02','Illustrate'],['03','Voice'],['04','Render']].map(([number,label],index)=><div className="pipeline-step" key={label}>
        <span>{number}</span><strong>{label}</strong>{index<3&&<ArrowRight/>}
      </div>)}
    </div>
  </div>;
}

function ArtifactPreview({project,scene}){
  const artifacts=scene.artifacts||{};
  const version=encodeURIComponent(project.updatedAt||'current');
  const media=(kind)=>`/media/${encodeURIComponent(project.id)}/scenes/${encodeURIComponent(scene.id)}/${kind}?v=${version}`;
  if(!artifacts.visual&&!artifacts.voice&&!artifacts.clip)return <div className="artifact-placeholder">
    <div className="frame-corners"><span/><span/><span/><span/></div>
    <ImageIcon size={24}/><span>Awaiting first render</span>
  </div>;
  return <div className="artifact-grid">
    {artifacts.visual&&<figure><img src={media('visual')} alt={`Visual for ${scene.id}`}/><figcaption><ImageIcon/>Visual</figcaption></figure>}
    {artifacts.clip&&<figure className="clip-preview"><video controls preload="metadata" src={media('clip')}/><figcaption><Film/>Rendered clip</figcaption></figure>}
    {artifacts.voice&&<figure className="audio-preview"><audio controls preload="metadata" src={media('voice')}/><figcaption><Mic2/>Narration</figcaption></figure>}
  </div>;
}

function SceneCard({project,scene,index,running,onSave,onRender}){
  const [text,setText]=useState(scene.text);
  const [prompt,setPrompt]=useState(scene.visualPrompt);
  useEffect(()=>{setText(scene.text);setPrompt(scene.visualPrompt);},[scene.text,scene.visualPrompt]);
  const dirty=text!==scene.text||prompt!==scene.visualPrompt;
  return <Card className="scene-card">
    <CardHeader className="scene-card-header">
      <div className="scene-number">{String(index+1).padStart(2,'0')}</div>
      <div className="scene-heading">
        <div className="scene-meta"><span>{scene.id}</span><Badge variant={badgeVariant(scene.status)}>{statusLabel(scene.status)}</Badge></div>
        <CardTitle>{text.split(/[.!?]/)[0]||`Scene ${index+1}`}</CardTitle>
      </div>
      <div className="scene-duration"><span>{(scene.durationMs/1000).toFixed(1)}</span> sec</div>
    </CardHeader>
    <CardContent className="scene-card-content">
      <ArtifactPreview project={project} scene={scene}/>
      <div className="scene-editor">
        <label htmlFor={`${scene.id}-narration`}><span>Narration</span><small>{text.length} chars</small></label>
        <Textarea id={`${scene.id}-narration`} value={text} onChange={(event)=>setText(event.target.value)} rows={5}/>
        <label htmlFor={`${scene.id}-prompt`}><span>Visual direction</span><small>image prompt</small></label>
        <Textarea id={`${scene.id}-prompt`} value={prompt} onChange={(event)=>setPrompt(event.target.value)} rows={6}/>
        <div className="scene-actions">
          <Button variant="ghost" disabled={!dirty||running} onClick={()=>onSave(scene.id,{text,visualPrompt:prompt})}><Save/>Save edit</Button>
          <Button disabled={running} onClick={()=>onRender(scene.id,{text,visualPrompt:prompt})}>{running?<LoaderCircle className="spin"/>:<WandSparkles/>}Render scene</Button>
        </div>
      </div>
    </CardContent>
  </Card>;
}

function NewProjectDialog({open,onOpenChange,onCreate,busy,defaultRenderer='simple'}){
  const [sourceType,setSourceType]=useState('topic');
  const [renderer,setRenderer]=useState(defaultRenderer);
  useEffect(()=>{if(open)setRenderer(defaultRenderer);},[open,defaultRenderer]);
  const submit=(event)=>{event.preventDefault();const data=Object.fromEntries(new FormData(event.currentTarget));onCreate({...data,sourceType,renderer});};
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="new-project-dialog">
      <DialogHeader>
        <div className="dialog-index">NEW / 001</div>
        <DialogTitle>Start a production</DialogTitle>
        <DialogDescription>Bring a topic, a finished script, or timed subtitles. Every scene stays independently editable and renderable.</DialogDescription>
      </DialogHeader>
      <form onSubmit={submit} className="new-project-form">
        <div className="field-row">
          <label>Project title<Input name="title" placeholder="The habit loop" required/></label>
          <label>Starting point<Select value={sourceType} onValueChange={setSourceType}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="topic">Topic → auto script</SelectItem><SelectItem value="script">Prepared script</SelectItem><SelectItem value="srt">SRT subtitles</SelectItem></SelectContent></Select></label>
        </div>
        <label>{sourceType==='topic'?'What should the film explain?':sourceType==='srt'?'Paste SRT subtitles':'Paste narration script'}
          <Textarea name="sourceText" rows={10} placeholder={sourceType==='topic'?'Why tiny habits compound over time':sourceType==='srt'?'1\n00:00:00,000 --> 00:00:04,000\nYour first subtitle…':'Begin with the idea you want viewers to remember…'} required/>
        </label>
        <div className="production-options">
          <label>Render style<Select value={renderer} onValueChange={setRenderer}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="whiteboard">Whiteboard draw</SelectItem><SelectItem value="simple">Simple motion</SelectItem></SelectContent></Select><small>Saved with this project; you can change it later.</small></label>
          <label className="minutes-field">Target length<Input name="minutes" type="number" min="1" max="60" defaultValue="6"/><span>minutes</span></label>
        </div>
        <DialogFooter><Button type="button" variant="ghost" onClick={()=>onOpenChange(false)}>Cancel</Button><Button type="submit" disabled={busy}>{busy?<LoaderCircle className="spin"/>:<Clapperboard/>}Create production</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}

function SettingsDialog({open,onOpenChange,onSaved}){
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
      }else setMessage({type:'success',text:'Settings saved to the local .env file.'});
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
      {!form?<div className="settings-loading"><DialogTitle className="sr-only">Provider settings</DialogTitle><DialogDescription className="sr-only">Loading local provider configuration.</DialogDescription><LoaderCircle className="spin"/><span>Loading local configuration…</span></div>:<div className="settings-layout">
        <aside className="settings-aside">
          <div><div className="dialog-index">SYSTEM / PROVIDERS</div><DialogTitle>Provider settings</DialogTitle><DialogDescription>Mix replaceable text, image, and voice services for this local production desk.</DialogDescription></div>
          <div className="security-card"><ShieldCheck/><div><strong>Server-side secrets</strong><p>Provider keys are written only to the local <code>.env</code> file and are never returned to this browser.</p></div></div>
          <div className="connection-state"><span className={`status-light ${form.hasOpenAIKey&&!form.clearApiKey?'online':''}`}/><div><strong>{form.clearApiKey?'OpenAI key marked for removal':form.hasOpenAIKey?'OpenAI connected':'No OpenAI key'}</strong><small>Text & image · {form.enableOpenAI?'live':'mock'}</small></div></div>
          <div className="connection-state"><span className={`status-light ${form.voiceProvider==='mock'||form.voiceProvider==='openai'&&form.hasOpenAIKey||form.voiceProvider==='vivibe'&&form.hasVivibeKey?'online':''}`}/><div><strong>{form.voiceProvider==='vivibe'?'Vivibe / LucyAI':form.voiceProvider==='openai'?'OpenAI voice':'Mock voice'}</strong><small>Active voice source</small></div></div>
          <div className="settings-mode"><div><strong>Use OpenAI generation</strong><span>Text and image providers</span></div><Switch checked={form.enableOpenAI} onCheckedChange={(value)=>update('enableOpenAI',value)}/></div>
          <div className="settings-aside-foot"><KeyRound/><span>Voice is selected independently, so Vivibe can run alongside OpenAI text and images.</span></div>
        </aside>

        <div className="settings-main">
          <DialogHeader><DialogTitle>Connections & models</DialogTitle><DialogDescription>Choose each provider independently. Existing scene artifacts stay cached until their provider inputs change.</DialogDescription></DialogHeader>
          <div className="settings-section">
            <div className="settings-section-title"><Server/><span><strong>Connection</strong><small>Credential and API endpoint</small></span></div>
            <div className="settings-fields two-columns">
              <label className="key-field">API key<div className="key-input"><Input type={showKey?'text':'password'} autoComplete="new-password" value={form.apiKey} onChange={(event)=>setForm((current)=>({...current,apiKey:event.target.value,clearApiKey:false}))} placeholder={form.hasOpenAIKey?'Leave blank to keep saved key':'sk-proj-…'}/><button type="button" onClick={()=>setShowKey((value)=>!value)} aria-label={showKey?'Hide API key':'Show API key'}>{showKey?<EyeOff/>:<Eye/>}</button></div><small>{form.hasOpenAIKey&&!form.clearApiKey?'A key is already stored. Enter a new one only to replace it.':'Paste a project-scoped API key.'}</small></label>
              <label>Base URL<Input value={form.baseUrl} onChange={(event)=>update('baseUrl',event.target.value)} placeholder="https://api.openai.com/v1"/><small>Use the standard endpoint unless you have a compatible proxy.</small></label>
            </div>
            {form.hasOpenAIKey&&<Button type="button" size="sm" variant={form.clearApiKey?'secondary':'ghost'} className="remove-key" onClick={()=>setForm((current)=>({...current,clearApiKey:!current.clearApiKey,apiKey:''}))}>{form.clearApiKey?'Keep saved key':'Remove saved key'}</Button>}
          </div>
          <Separator/>
          <div className="settings-section">
            <div className="settings-section-title"><Clapperboard/><span><strong>Default renderer</strong><small>Applied when a new production is created</small></span></div>
            <div className="renderer-setting">
              <label>Render style<Select value={form.renderer} onValueChange={(value)=>update('renderer',value)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="whiteboard">Whiteboard draw</SelectItem><SelectItem value="simple">Simple motion</SelectItem></SelectContent></Select></label>
              <p><strong>{form.renderer==='whiteboard'?'Draw-on animation':'Fast image motion'}</strong><span>{form.renderer==='whiteboard'?'Uses the external whiteboard engine and generated scene illustration.':'Uses FFmpeg for a subtle zoom and remains the offline fallback.'}</span></p>
            </div>
          </div>
          <Separator/>
          <div className="settings-section">
            <div className="settings-section-title"><BrainCircuit/><span><strong>Generation stack</strong><small>Models used for scripts and illustrations</small></span></div>
            <div className="settings-fields two-columns">
              <label>Script model<Input value={form.textModel} onChange={(event)=>update('textModel',event.target.value)} /></label>
              <label>Image model<Input value={form.imageModel} onChange={(event)=>update('imageModel',event.target.value)} /></label>
              <label>Image size<Select value={form.imageSize} onValueChange={(value)=>update('imageSize',value)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="1536x1024">1536 × 1024 · landscape</SelectItem><SelectItem value="1024x1024">1024 × 1024 · square</SelectItem><SelectItem value="1024x1536">1024 × 1536 · portrait</SelectItem><SelectItem value="auto">Auto</SelectItem></SelectContent></Select></label>
              <label>Image quality<Select value={form.imageQuality} onValueChange={(value)=>update('imageQuality',value)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="low">Low</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="high">High</SelectItem><SelectItem value="auto">Auto</SelectItem></SelectContent></Select></label>
            </div>
          </div>
          <Separator/>
          <div className="settings-section voice-provider-section">
            <div className="settings-section-title"><Mic2/><span><strong>Voice source</strong><small>Provider adapter used for narration</small></span></div>
            <div className="voice-provider-head">
              <label>Provider<Select value={form.voiceProvider} onValueChange={(value)=>{update('voiceProvider',value);setVivibeVoices([]);}}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="openai">OpenAI Speech</SelectItem><SelectItem value="vivibe">Vivibe / LucyAI</SelectItem><SelectItem value="mock">Mock silence</SelectItem></SelectContent></Select></label>
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
          <DialogFooter className="settings-footer"><Button type="button" variant="ghost" onClick={()=>onOpenChange(false)}>Close</Button><Button type="button" variant="outline" disabled={saving||form.clearApiKey||(!form.hasOpenAIKey&&!form.apiKey)} onClick={()=>persist(true)}>{saving?<LoaderCircle className="spin"/>:<Activity/>}Save & test OpenAI</Button><Button type="button" disabled={saving} onClick={()=>persist(false)}>{saving?<LoaderCircle className="spin"/>:<Save/>}Save settings</Button></DialogFooter>
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

  const running=!!current&&health?.running?.includes(current.id);
  const config=health?.config;
  const completed=useMemo(()=>current?.scenes?.filter((scene)=>scene.status==='ready').length||0,[current]);

  const refreshHealth=async()=>setHealth(await api('/api/health'));
  const refreshProjects=async()=>setProjects(await api('/api/projects'));
  const load=async(id)=>{const project=await api(`/api/projects/${encodeURIComponent(id)}`);setCurrent(project);await Promise.all([refreshProjects(),refreshHealth()]);};

  useEffect(()=>{Promise.all([refreshProjects(),refreshHealth()]).catch((cause)=>setError(cause.message));},[]);

  const createProject=async(payload)=>{
    setBusy(true);setError('');
    try{const project=await api('/api/projects',{method:'POST',body:JSON.stringify(payload)});setDialogOpen(false);await load(project.id);}
    catch(cause){setError(cause.message);}finally{setBusy(false);}
  };
  const createDemo=()=>createProject({title:'Small Habits — Test Cut',sourceType:'script',sourceText:'Small habits feel insignificant at first, but repetition gives them power. Each action becomes a vote for the person you want to become. Make the next step obvious, easy, and satisfying, then let consistency do the heavy lifting.',minutes:1});
  const saveScene=async(sceneId,payload)=>{setBusy(true);setError('');try{const project=await api(`/api/projects/${encodeURIComponent(current.id)}/scenes/${encodeURIComponent(sceneId)}`,{method:'PATCH',body:JSON.stringify(payload)});setCurrent(project);await refreshProjects();}catch(cause){setError(cause.message);}finally{setBusy(false);}};
  const changeRenderer=async(renderer)=>{if(!current||renderer===current.settings?.renderer)return;setBusy(true);setError('');try{const project=await api(`/api/projects/${encodeURIComponent(current.id)}`,{method:'PATCH',body:JSON.stringify({renderer})});setCurrent(project);await refreshProjects();}catch(cause){setError(cause.message);}finally{setBusy(false);}};
  const run=async(body={})=>{setBusy(true);setError('');try{await api(`/api/projects/${encodeURIComponent(current.id)}/run`,{method:'POST',body:JSON.stringify(body)});await load(current.id);}catch(cause){setError(cause.message);try{await load(current.id);}catch{}}finally{setBusy(false);await refreshHealth().catch(()=>{});}};
  const renderScene=async(sceneId,payload)=>{await saveScene(sceneId,payload);await run({sceneId});};

  return <div className="app-shell">
    <header className="app-header">
      <button className="brand" onClick={()=>setCurrent(null)}><BrandMark/><span><strong>CUTROOM</strong><small>video workflow desk</small></span></button>
      <div className="header-rule"/>
      <div className="runtime-status">
        <span className={`status-light ${health?'online':''}`}/>
        <div><strong>{health?'System ready':'Connecting'}</strong><small>{config?`${config.mockMode?'Mock':'Live'} · ${config.renderer}`:'local runtime'}</small></div>
      </div>
      <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={()=>Promise.all([refreshProjects(),refreshHealth()])}><RefreshCw/></Button></TooltipTrigger><TooltipContent>Refresh workspace</TooltipContent></Tooltip>
    </header>

    <div className="workspace-grid">
      <aside className="project-rail">
        <div className="rail-heading"><span>Productions</span><Badge variant="outline">{projects.length}</Badge></div>
        <Button className="new-project-button" onClick={()=>setDialogOpen(true)}><Plus/>New production</Button>
        <ScrollArea className="project-scroll">
          <div className="project-list">{projects.map((project)=><button key={project.id} className={`project-item ${project.id===current?.id?'active':''}`} onClick={()=>load(project.id)}>
            <span className="project-thumb"><Clapperboard/></span>
            <span className="project-copy"><strong>{project.title}</strong><small>{project.scenes.length} scenes · {statusLabel(project.status)}</small></span>
            <MoreHorizontal className="project-more"/>
          </button>)}</div>
        </ScrollArea>
        <button className="rail-footer" onClick={()=>setSettingsOpen(true)}>
          <div><Settings2/><span><strong>{config?.mockMode?'TEST MODE':'PRODUCTION'}</strong><small>{config?.hasOpenAIKey?'API key configured':'OpenAI settings'}</small></span></div>
          <div className="provider-line">{config?.imageModel||'image'}<br/>{config?.voiceProvider||'voice'}{config?.voiceProvider==='vivibe'&&config?.vivibeVoiceId?` · ${config.vivibeVoiceId.slice(0,8)}`:''}</div>
        </button>
      </aside>

      <main className="main-stage">
        {error&&<div className="error-banner"><CircleDot/><span>{error}</span><button onClick={()=>setError('')}>Dismiss</button></div>}
        {!current?<EmptyState onCreate={()=>setDialogOpen(true)} onDemo={createDemo}/>:<>
          <section className="project-header">
            <div><div className="eyebrow">PRODUCTION / {current.id.slice(-6).toUpperCase()}</div><h1>{current.title}</h1><div className="project-subline"><Badge variant={badgeVariant(current.status)}>{statusLabel(current.status)}</Badge><span>{current.scenes.length} scenes</span><span>{completed}/{current.scenes.length} rendered</span></div></div>
            <div className="project-actions">
              <label className="renderer-control"><span>Renderer</span><Select value={current.settings?.renderer||config?.renderer||'simple'} onValueChange={changeRenderer} disabled={busy||running}><SelectTrigger aria-label="Project renderer"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="whiteboard">Whiteboard draw</SelectItem><SelectItem value="simple">Simple motion</SelectItem></SelectContent></Select></label>
              <Button variant="outline" onClick={()=>load(current.id)}><RefreshCw/>Refresh</Button><Button size="lg" disabled={busy||running} onClick={()=>run()}>{busy||running?<LoaderCircle className="spin"/>:<Play/>}{busy||running?'Rendering…':'Run full pipeline'}</Button>
            </div>
          </section>
          <Separator/>
          {current.error&&<div className="project-error"><strong>Last run stopped</strong><span>{current.error.message}</span></div>}
          {current.artifacts?.final?<Card className="final-card"><div className="final-copy"><Badge>MASTER CUT</Badge><h2>Final film</h2><p>The latest approved scene renders, joined and ready for review.</p><code>{current.artifacts.final}</code></div><video controls preload="metadata" src={`/media/${encodeURIComponent(current.id)}/final?v=${encodeURIComponent(current.updatedAt||'current')}`}>{current.artifacts?.captions&&<track key={current.updatedAt} kind="subtitles" src={`/media/${encodeURIComponent(current.id)}/captions?v=${encodeURIComponent(current.updatedAt||'current')}`} srcLang={current.settings?.captionLanguage||'und'} label={current.settings?.captionLanguage==='vi'?'Tiếng Việt':'Subtitles'} default/>}</video></Card>:<div className="final-awaiting"><Film/><div><strong>Master cut pending</strong><span>Render the full pipeline after reviewing your scenes.</span></div><span className="progress-count">{completed}/{current.scenes.length}</span></div>}
          <div className="section-heading"><div><span>SCENE DESK</span><h2>Direct every beat.</h2></div><p>Save a rewrite or re-render one scene without restarting the whole production.</p></div>
          <div className="scene-list">{current.scenes.map((scene,index)=><SceneCard key={scene.id} project={current} scene={scene} index={index} running={busy||running} onSave={saveScene} onRender={renderScene}/>)}</div>
        </>}
      </main>
    </div>
    <NewProjectDialog open={dialogOpen} onOpenChange={setDialogOpen} onCreate={createProject} busy={busy} defaultRenderer={config?.renderer||'simple'}/>
    <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} onSaved={refreshHealth}/>
  </div>;
}
