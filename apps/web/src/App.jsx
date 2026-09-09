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
import { copyFor, UI_LANGUAGES } from './i18n';

const api=async(url,options={})=>{
  const response=await fetch(url,{headers:{'content-type':'application/json',...(options.headers||{})},...options});
  const body=await response.json();
  if(!response.ok)throw new Error(body.error||response.statusText);
  return body;
};

const statusLabel=(status,c)=>c.status[status]||status||c.status.draft;
const badgeVariant=(status)=>status==='complete'?'default':status==='error'?'destructive':'secondary';

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

function ArtifactPreview({project,scene,c}){
  const artifacts=scene.artifacts||{};
  const version=encodeURIComponent(project.updatedAt||'current');
  const media=(kind)=>`/media/${encodeURIComponent(project.id)}/scenes/${encodeURIComponent(scene.id)}/${kind}?v=${version}`;
  if(!artifacts.visual&&!artifacts.voice&&!artifacts.clip)return <div className="artifact-placeholder">
    <div className="frame-corners"><span/><span/><span/><span/></div>
    <ImageIcon size={24}/><span>{c.awaitingRender}</span>
  </div>;
  return <div className="artifact-grid">
    {artifacts.visual&&<figure><img src={media('visual')} alt={`${c.visual} ${scene.id}`}/><figcaption><ImageIcon/>{c.visual}</figcaption></figure>}
    {artifacts.clip&&<figure className="clip-preview"><video controls preload="metadata" src={media('clip')}/><figcaption><Film/>{c.renderedClip}</figcaption></figure>}
    {artifacts.voice&&<figure className="audio-preview"><audio controls preload="metadata" src={media('voice')}/><figcaption><Mic2/>{c.narration}</figcaption></figure>}
  </div>;
}

function SceneCard({project,scene,index,running,onSave,onRender,c}){
  const [text,setText]=useState(scene.text);
  const [prompt,setPrompt]=useState(scene.visualPrompt);
  useEffect(()=>{setText(scene.text);setPrompt(scene.visualPrompt);},[scene.text,scene.visualPrompt]);
  const dirty=text!==scene.text||prompt!==scene.visualPrompt;
  return <Card className="scene-card">
    <CardHeader className="scene-card-header">
      <div className="scene-number">{String(index+1).padStart(2,'0')}</div>
      <div className="scene-heading">
        <div className="scene-meta"><span>{scene.id}</span><Badge variant={badgeVariant(scene.status)}>{statusLabel(scene.status,c)}</Badge></div>
        <CardTitle>{text.split(/[.!?]/)[0]||`${c.scenes} ${index+1}`}</CardTitle>
      </div>
      <div className="scene-duration"><span>{(scene.durationMs/1000).toFixed(1)}</span> {c.seconds}</div>
    </CardHeader>
    <CardContent className="scene-card-content">
      <ArtifactPreview project={project} scene={scene} c={c}/>
      <div className="scene-editor">
        <label htmlFor={`${scene.id}-narration`}><span>{c.narration}</span><small>{text.length} {c.chars}</small></label>
        <Textarea id={`${scene.id}-narration`} value={text} onChange={(event)=>setText(event.target.value)} rows={5}/>
        <label htmlFor={`${scene.id}-prompt`}><span>{c.visualDirection}</span><small>{c.imagePrompt}</small></label>
        <Textarea id={`${scene.id}-prompt`} value={prompt} onChange={(event)=>setPrompt(event.target.value)} rows={6}/>
        <div className="scene-actions">
          <Button variant="ghost" disabled={!dirty||running} onClick={()=>onSave(scene.id,{text,visualPrompt:prompt})}><Save/>{c.saveEdit}</Button>
          <Button disabled={running} onClick={()=>onRender(scene.id,{text,visualPrompt:prompt})}>{running?<LoaderCircle className="spin"/>:<WandSparkles/>}{c.renderScene}</Button>
        </div>
      </div>
    </CardContent>
  </Card>;
}

function NewProjectDialog({open,onOpenChange,onCreate,busy,defaultRenderer='simple',defaultLanguage='vi',c}){
  const [sourceType,setSourceType]=useState('topic');
  const [renderer,setRenderer]=useState(defaultRenderer);
  const [language,setLanguage]=useState(defaultLanguage);
  useEffect(()=>{if(open){setRenderer(defaultRenderer);setLanguage(defaultLanguage);}},[open,defaultRenderer,defaultLanguage]);
  const submit=(event)=>{event.preventDefault();const data=Object.fromEntries(new FormData(event.currentTarget));onCreate({...data,sourceType,renderer,language});};
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
          <label>{c.renderStyle}<Select value={renderer} onValueChange={setRenderer}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="whiteboard">{c.whiteboard}</SelectItem><SelectItem value="simple">{c.simple}</SelectItem></SelectContent></Select><small>{c.rendererHint}</small></label>
          <label>{c.contentLanguage}<Select value={language} onValueChange={setLanguage}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{UI_LANGUAGES.map((item)=><SelectItem key={item.code} value={item.code}>{item.label}</SelectItem>)}</SelectContent></Select></label>
          <label className="minutes-field">{c.targetLength}<Input name="minutes" type="number" min="1" max="60" defaultValue="6"/><span>{c.minutes}</span></label>
        </div>
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
              <label>{c.renderStyle}<Select value={form.renderer} onValueChange={(value)=>update('renderer',value)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="whiteboard">{c.whiteboard}</SelectItem><SelectItem value="simple">{c.simple}</SelectItem></SelectContent></Select></label>
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

  const running=!!current&&health?.running?.includes(current.id);
  const config=health?.config;
  const c=copyFor(config?.uiLanguage||'vi');
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
  const createDemo=()=>createProject(config?.contentLanguage==='en'?{title:'Small Habits — Test Cut',sourceType:'script',sourceText:'Small habits feel insignificant at first, but repetition gives them power. Each action becomes a vote for the person you want to become. Make the next step obvious, easy, and satisfying, then let consistency do the heavy lifting.',minutes:1,language:'en'}:{title:'Thói quen nhỏ — Bản thử',sourceType:'script',sourceText:'Những thói quen nhỏ ban đầu có vẻ không đáng kể, nhưng sự lặp lại tạo cho chúng sức mạnh. Mỗi hành động là một lá phiếu cho con người bạn muốn trở thành. Hãy làm cho bước tiếp theo thật rõ ràng, dễ dàng và thú vị, rồi để sự kiên trì tạo nên khác biệt.',minutes:1,language:'vi'});
  const saveScene=async(sceneId,payload)=>{setBusy(true);setError('');try{const project=await api(`/api/projects/${encodeURIComponent(current.id)}/scenes/${encodeURIComponent(sceneId)}`,{method:'PATCH',body:JSON.stringify(payload)});setCurrent(project);await refreshProjects();}catch(cause){setError(cause.message);}finally{setBusy(false);}};
  const changeRenderer=async(renderer)=>{if(!current||renderer===current.settings?.renderer)return;setBusy(true);setError('');try{const project=await api(`/api/projects/${encodeURIComponent(current.id)}`,{method:'PATCH',body:JSON.stringify({renderer})});setCurrent(project);await refreshProjects();}catch(cause){setError(cause.message);}finally{setBusy(false);}};
  const run=async(body={})=>{setBusy(true);setError('');try{await api(`/api/projects/${encodeURIComponent(current.id)}/run`,{method:'POST',body:JSON.stringify(body)});await load(current.id);}catch(cause){setError(cause.message);try{await load(current.id);}catch{}}finally{setBusy(false);await refreshHealth().catch(()=>{});}};
  const renderScene=async(sceneId,payload)=>{await saveScene(sceneId,payload);await run({sceneId});};

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

    <div className="workspace-grid">
      <aside className="project-rail">
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

      <main className="main-stage">
        {error&&<div className="error-banner"><CircleDot/><span>{error}</span><button onClick={()=>setError('')}>{c.dismiss}</button></div>}
        {!current?<EmptyState onCreate={()=>setDialogOpen(true)} onDemo={createDemo} c={c}/>:<>
          <section className="project-header">
            <div><div className="eyebrow">{c.production} / {current.id.slice(-6).toUpperCase()}</div><h1>{current.title}</h1><div className="project-subline"><Badge variant={badgeVariant(current.status)}>{statusLabel(current.status,c)}</Badge><span>{current.scenes.length} {c.scenes}</span><span>{completed}/{current.scenes.length} {c.rendered}</span></div></div>
            <div className="project-actions">
              <label className="renderer-control"><span>{c.renderer}</span><Select value={current.settings?.renderer||config?.renderer||'simple'} onValueChange={changeRenderer} disabled={busy||running}><SelectTrigger aria-label={c.renderer}><SelectValue/></SelectTrigger><SelectContent><SelectItem value="whiteboard">{c.whiteboard}</SelectItem><SelectItem value="simple">{c.simple}</SelectItem></SelectContent></Select></label>
              <Button variant="outline" onClick={()=>load(current.id)}><RefreshCw/>{c.refresh}</Button><Button size="lg" disabled={busy||running} onClick={()=>run()}>{busy||running?<LoaderCircle className="spin"/>:<Play/>}{busy||running?c.rendering:c.runPipeline}</Button>
            </div>
          </section>
          <Separator/>
          {current.error&&<div className="project-error"><strong>{c.lastRunStopped}</strong><span>{current.error.message}</span></div>}
          {current.artifacts?.final?<Card className="final-card"><div className="final-copy"><Badge>{c.masterCut}</Badge><h2>{c.finalFilm}</h2><p>{c.finalBody}</p><code>{current.artifacts.final}</code></div><video controls preload="metadata" src={`/media/${encodeURIComponent(current.id)}/final?v=${encodeURIComponent(current.updatedAt||'current')}`}>{current.artifacts?.captions&&<track key={current.updatedAt} kind="subtitles" src={`/media/${encodeURIComponent(current.id)}/captions?v=${encodeURIComponent(current.updatedAt||'current')}`} srcLang={current.settings?.captionLanguage||'vi'} label={current.settings?.captionLanguage==='vi'?'Tiếng Việt':c.subtitles} default/>}</video></Card>:<div className="final-awaiting"><Film/><div><strong>{c.masterPending}</strong><span>{c.masterPendingBody}</span></div><span className="progress-count">{completed}/{current.scenes.length}</span></div>}
          <div className="section-heading"><div><span>{c.sceneDesk}</span><h2>{c.directBeat}</h2></div><p>{c.sceneDeskBody}</p></div>
          <div className="scene-list">{current.scenes.map((scene,index)=><SceneCard key={scene.id} project={current} scene={scene} index={index} running={busy||running} onSave={saveScene} onRender={renderScene} c={c}/>)}</div>
        </>}
      </main>
    </div>
    <NewProjectDialog open={dialogOpen} onOpenChange={setDialogOpen} onCreate={createProject} busy={busy} defaultRenderer={config?.renderer||'simple'} defaultLanguage={config?.contentLanguage||'vi'} c={c}/>
    <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} onSaved={refreshHealth} c={c}/>
  </div>;
}
