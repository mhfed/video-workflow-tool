import { useEffect, useState } from 'react';
import {
  Activity,
  AudioLines,
  ArrowRight,
  BrainCircuit,
  Bot,
  CheckCircle2,
  CircleDot,
  Clapperboard,
  Command,
  Eye,
  EyeOff,
  Film,
  FileText,
  Gauge,
  Image as ImageIcon,
  KeyRound,
  LoaderCircle,
  Mic2,
  Play,
  Plus,
  RefreshCw,
  Save,
  Server,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { copyFor, UI_LANGUAGES } from './i18n';
import ApplicationNavigation from './ApplicationNavigation';
import CommandPalette from './CommandPalette';
import DirectorWorkspace from './DirectorWorkspace';

const api=async(url,options={})=>{
  const response=await fetch(url,{headers:{'content-type':'application/json',...(options.headers||{})},...options});
  const body=await response.json();
  if(!response.ok)throw new Error(body.error||response.statusText);
  return body;
};

const rendererOptions=(names,c)=>names.map((name)=><SelectItem key={name} value={name}>{c[name]||name}</SelectItem>);
const rendererSummary=(name)=>name==='whiteboard'
  ? {title:'Draw-on animation',body:'Uses the external whiteboard engine and generated scene illustration.'}
  :name==='cinematic-broll'
    ? {title:'Local cinematic footage',body:'Uses project-local B-roll with burned subtitles and optional background music.'}
    :name==='draw-reveal'
      ? {title:'Color illustration reveal',body:'A moving hand progressively reveals project-local full-color artwork.'}
    : {title:'Fast image motion',body:'Uses FFmpeg for a subtle zoom and remains the offline fallback.'};

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
  const hydrated=(settings)=>({...settings,apiKey:'',clearApiKey:false,vivibeApiKey:'',clearVivibeApiKey:false,pexelsApiKey:'',clearPexelsApiKey:false,pixabayApiKey:'',clearPixabayApiKey:false});

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
            <div className="settings-section-title"><Film/><span><strong>{c.brollProviders}</strong><small>{c.brollProvidersHint}</small></span></div>
            <div className="settings-fields two-columns">
              <label>Pexels API key<Input type="password" autoComplete="new-password" value={form.pexelsApiKey} onChange={(event)=>setForm((current)=>({...current,pexelsApiKey:event.target.value,clearPexelsApiKey:false}))} placeholder={form.hasPexelsKey?'Leave blank to keep saved key':'Pexels API key'}/>{form.hasPexelsKey&&<Button type="button" size="sm" variant="ghost" onClick={()=>setForm((current)=>({...current,clearPexelsApiKey:!current.clearPexelsApiKey,pexelsApiKey:''}))}>{form.clearPexelsApiKey?c.keepKey:c.removeKey}</Button>}</label>
              <label>Pixabay API key<Input type="password" autoComplete="new-password" value={form.pixabayApiKey} onChange={(event)=>setForm((current)=>({...current,pixabayApiKey:event.target.value,clearPixabayApiKey:false}))} placeholder={form.hasPixabayKey?'Leave blank to keep saved key':'Pixabay API key'}/>{form.hasPixabayKey&&<Button type="button" size="sm" variant="ghost" onClick={()=>setForm((current)=>({...current,clearPixabayApiKey:!current.clearPixabayApiKey,pixabayApiKey:''}))}>{form.clearPixabayApiKey?c.keepKey:c.removeKey}</Button>}</label>
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
              <p><strong>{rendererSummary(form.renderer).title}</strong><span>{rendererSummary(form.renderer).body}</span></p>
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
  const [navDrawer,setNavDrawer]=useState(null);
  const [paletteOpen,setPaletteOpen]=useState(false);
  const [workspaceContext,setWorkspaceContext]=useState(null);
  const [workspaceCommand,setWorkspaceCommand]=useState(null);

  const activeJob=[...(current?.jobs||[])].reverse().find((job)=>['queued','running','cancelling'].includes(job.status))||null;
  const running=!!activeJob||!!current&&health?.running?.includes(current.id);
  const config=health?.config;
  const c=copyFor(config?.uiLanguage||'vi');
  const refreshHealth=async()=>setHealth(await api('/api/health'));
  const refreshProjects=async()=>setProjects(await api('/api/projects'));
  const load=async(id)=>{const project=await api(`/api/projects/${encodeURIComponent(id)}`);setCurrent(project);await Promise.all([refreshProjects(),refreshHealth()]);};

  useEffect(()=>{Promise.all([refreshProjects(),refreshHealth()]).catch((cause)=>setError(cause.message));},[]);
  useEffect(()=>{const openPalette=(event)=>{if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='k'){event.preventDefault();setPaletteOpen((value)=>!value);}};window.addEventListener('keydown',openPalette);return()=>window.removeEventListener('keydown',openPalette);},[]);
  useEffect(()=>{
    if(!current?.id||!activeJob)return;
    let stopped=false;
    const tick=async()=>{try{const project=await api(`/api/projects/${encodeURIComponent(current.id)}`);if(!stopped){setCurrent(project);setProjects((items)=>items.map((item)=>item.id===project.id?project:item));}}catch(cause){if(!stopped)setError(cause.message);}};
    const timer=setInterval(tick,700);tick();return()=>{stopped=true;clearInterval(timer);};
  },[current?.id,activeJob?.id,activeJob?.status]);

  const createProject=async(payload)=>{
    setBusy(true);setError('');
    try{const project=await api('/api/projects',{method:'POST',body:JSON.stringify(payload)});setDialogOpen(false);await load(project.id);}
    catch(cause){setError(cause.message);}finally{setBusy(false);}
  };
  const createDemo=()=>createProject(config?.contentLanguage==='en'?{title:'Small Habits — Test Cut',sourceType:'script',sourceText:'Small habits feel insignificant at first, but repetition gives them power. Each action becomes a vote for the person you want to become. Make the next step obvious, easy, and satisfying, then let consistency do the heavy lifting.',minutes:1,language:'en'}:{title:'Thói quen nhỏ — Bản thử',sourceType:'script',sourceText:'Những thói quen nhỏ ban đầu có vẻ không đáng kể, nhưng sự lặp lại tạo cho chúng sức mạnh. Mỗi hành động là một lá phiếu cho con người bạn muốn trở thành. Hãy làm cho bước tiếp theo thật rõ ràng, dễ dàng và thú vị, rồi để sự kiên trì tạo nên khác biệt.',minutes:1,language:'vi'});
  const saveScene=async(sceneId,payload)=>{setBusy(true);setError('');try{const project=await api(`/api/projects/${encodeURIComponent(current.id)}/scenes/${encodeURIComponent(sceneId)}`,{method:'PATCH',body:JSON.stringify(payload)});setCurrent(project);await refreshProjects();return project;}catch(cause){setError(cause.message);return null;}finally{setBusy(false);}};
  const updateProject=async(payload)=>{setBusy(true);setError('');try{const project=await api(`/api/projects/${encodeURIComponent(current.id)}`,{method:'PATCH',body:JSON.stringify(payload)});setCurrent(project);await refreshProjects();return project;}catch(cause){setError(cause.message);return null;}finally{setBusy(false);}};
  const changeRenderer=async(renderer)=>{if(!current||renderer===current.settings?.renderer)return;await updateProject({renderer});};
  const changeFormat=async(format)=>{if(!current||format===current.settings?.format)return;await updateProject({format});};
  const enqueueJob=async(type,request={})=>{setBusy(true);setError('');try{const result=await api(`/api/projects/${encodeURIComponent(current.id)}/jobs`,{method:'POST',body:JSON.stringify({type,request})});setCurrent(result.project);await refreshProjects();return result;}catch(cause){setError(cause.message);return null;}finally{setBusy(false);}};
  const run=async(body={})=>!!await enqueueJob('render',body);
  const runStage=async(sceneId,stage)=>run({sceneId,stage});
  const runBulk=async(stage,sceneIds)=>run({stage,sceneIds});
  const reviewStage=async(sceneId,stage,decision)=>{setBusy(true);setError('');try{const project=await api(`/api/projects/${encodeURIComponent(current.id)}/scenes/${encodeURIComponent(sceneId)}/review`,{method:'POST',body:JSON.stringify({stage,decision})});setCurrent(project);await refreshProjects();return project;}catch(cause){setError(cause.message);return null;}finally{setBusy(false);}};
  const reviewBulk=async(stage,sceneIds,decision)=>{setBusy(true);setError('');try{const project=await api(`/api/projects/${encodeURIComponent(current.id)}/review`,{method:'POST',body:JSON.stringify({stage,sceneIds,decision})});setCurrent(project);await refreshProjects();}catch(cause){setError(cause.message);}finally{setBusy(false);}};
  const editSceneStructure=async(sceneId,payload)=>{setBusy(true);setError('');try{const result=await api(`/api/projects/${encodeURIComponent(current.id)}/scenes/${encodeURIComponent(sceneId)}/actions`,{method:'POST',body:JSON.stringify(payload)});setCurrent(result.project);await refreshProjects();return result;}catch(cause){setError(cause.message);return null;}finally{setBusy(false);}};
  const insertNewScene=async(afterSceneId)=>{setBusy(true);setError('');try{const result=await api(`/api/projects/${encodeURIComponent(current.id)}/scenes`,{method:'POST',body:JSON.stringify({afterSceneId,text:c.language==='en'?'A new scene.':'Một phân cảnh mới.'})});setCurrent(result.project);await refreshProjects();return result;}catch(cause){setError(cause.message);return null;}finally{setBusy(false);}};
  const planDirection=async(sceneId,instruction)=>{setError('');try{return await api(`/api/projects/${encodeURIComponent(current.id)}/director`,{method:'POST',body:JSON.stringify({sceneId,instruction})});}catch(cause){setError(cause.message);throw cause;}};
  const searchBroll=async({provider,query,orientation='portrait'})=>api(`/api/broll/search?provider=${encodeURIComponent(provider)}&query=${encodeURIComponent(query)}&orientation=${encodeURIComponent(orientation)}`);
  const selectBroll=async(sceneId,selection,brollStartMs=0)=>{setBusy(true);setError('');try{const result=await api(`/api/projects/${encodeURIComponent(current.id)}/scenes/${encodeURIComponent(sceneId)}/broll`,{method:'POST',body:JSON.stringify({selection,brollStartMs})});setCurrent(result.project);await refreshProjects();return result;}catch(cause){setError(cause.message);throw cause;}finally{setBusy(false);}};
  const uploadArtwork=async(sceneId,file)=>{setBusy(true);setError('');try{const response=await fetch(`/api/projects/${encodeURIComponent(current.id)}/scenes/${encodeURIComponent(sceneId)}/artwork`,{method:'POST',headers:{'content-type':file.type,'x-file-name':encodeURIComponent(file.name)},body:file});const result=await response.json();if(!response.ok)throw new Error(result.error||response.statusText);setCurrent(result.project);await refreshProjects();return result;}catch(cause){setError(cause.message);throw cause;}finally{setBusy(false);}};
  const loadRoughCut=async()=>api(`/api/projects/${encodeURIComponent(current.id)}/rough-cut`);
  const cancelJob=async(jobId)=>{setError('');try{const result=await api(`/api/projects/${encodeURIComponent(current.id)}/jobs/${encodeURIComponent(jobId)}/cancel`,{method:'POST'});setCurrent(result.project);return result;}catch(cause){setError(cause.message);return null;}};
  const historyAction=async(action)=>{setBusy(true);setError('');try{const project=await api(`/api/projects/${encodeURIComponent(current.id)}/history/${action}`,{method:'POST'});setCurrent(project);await refreshProjects();return project;}catch(cause){setError(cause.message);return null;}finally{setBusy(false);}};
  const selectSceneTake=async(sceneId,kind,takeId)=>{setBusy(true);setError('');try{const project=await api(`/api/projects/${encodeURIComponent(current.id)}/scenes/${encodeURIComponent(sceneId)}/takes/${encodeURIComponent(kind)}/${encodeURIComponent(takeId)}/select`,{method:'POST'});setCurrent(project);await refreshProjects();return project;}catch(cause){setError(cause.message);return null;}finally{setBusy(false);}};
  const runQuality=async(sceneIds=null)=>!!await enqueueJob('quality',sceneIds?{sceneIds}:{});
  const getRepairPlan=async()=>api(`/api/projects/${encodeURIComponent(current.id)}/quality/repair-plan`);
  const applyRepairs=async(actions)=>{setBusy(true);setError('');try{const result=await api(`/api/projects/${encodeURIComponent(current.id)}/quality/repair`,{method:'POST',body:JSON.stringify({actions})});setCurrent(result.project);return result;}catch(cause){setError(cause.message);return null;}finally{setBusy(false);}};
  const commandSceneId=workspaceContext?.sceneId||current?.scenes?.[0]?.id;
  const sendWorkspaceCommand=(type,payload={})=>setWorkspaceCommand({type,...payload,id:Date.now()});
  const paletteItems=[
    {id:'new',group:c.commandGroups.navigation,label:c.newProduction,meta:c.commandNewBody,icon:Plus,run:()=>setDialogOpen(true)},
    {id:'settings',group:c.commandGroups.navigation,label:c.settingsNav,meta:c.providerSettings,icon:Settings2,run:()=>setSettingsOpen(true)},
    ...projects.map((project)=>({id:`project-${project.id}`,group:c.commandGroups.projects,label:project.title,meta:`${project.scenes.length} ${c.scenes}`,icon:Clapperboard,run:()=>load(project.id)})),
    ...(current?.scenes||[]).map((scene,index)=>({id:`scene-${scene.id}`,group:c.commandGroups.scenes,label:`${c.sceneLabel} ${String(index+1).padStart(2,'0')} · ${scene.text.split(/[.!?]/)[0]}`,meta:`${(scene.durationMs/1000).toFixed(1)} ${c.seconds}`,icon:FileText,run:()=>sendWorkspaceCommand('scene',{sceneId:scene.id})})),
    ...(current&&commandSceneId?[['voice',AudioLines],['visual',ImageIcon],['clip',Film]].map(([stage,icon])=>({id:`regenerate-${stage}`,group:c.commandGroups.actions,label:`${c.regenerate} ${c[`${stage}Stage`].toLowerCase()}`,meta:c.commandCurrentScene,icon,run:()=>runStage(commandSceneId,stage)})) : []),
    ...(current&&commandSceneId?[{id:'quality-scene',group:c.commandGroups.actions,label:c.checkScene,meta:c.commandCurrentScene,icon:Gauge,run:()=>runQuality([commandSceneId])},{id:'focus-preview',group:c.commandGroups.actions,label:c.focusPreview,meta:c.commandCurrentScene,icon:Eye,shortcut:'F',run:()=>sendWorkspaceCommand('focus')},{id:'export-final',group:c.commandGroups.actions,label:c.exportFinal,meta:current.title,icon:Clapperboard,run:()=>run({stage:'final'})}] : []),
  ];
  return <div className="app-shell">
    <header className="app-header">
      <button className="brand" onClick={()=>setCurrent(null)}><BrandMark/><span><strong>CUTROOM</strong><small>{c.brandSubtitle}</small></span></button>
      <div className="header-rule"/>
      <div className="runtime-status">
        <span className={`status-light ${health?'online':''}`}/>
        <div><strong>{health?c.systemReady:c.connecting}</strong><small>{config?`${config.mockMode?'Mock':'Live'} · ${config.renderer}`:c.localRuntime}</small></div>
      </div>
      <button className="command-trigger" onClick={()=>setPaletteOpen(true)}><Command/><span>{c.quickActions}</span><kbd>⌘ K</kbd></button>
      <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={()=>Promise.all([refreshProjects(),refreshHealth()])}><RefreshCw/></Button></TooltipTrigger><TooltipContent>{c.refreshWorkspace}</TooltipContent></Tooltip>
    </header>

    <div className={`workspace-grid ${current?'project-open':''}`}>
      <ApplicationNavigation current={current} projects={projects} drawer={navDrawer} onDrawer={setNavDrawer} onHome={()=>{setNavDrawer(null);setCurrent(null);}} onCreate={()=>{setNavDrawer(null);setDialogOpen(true);}} onSelect={load} onSettings={()=>{setNavDrawer(null);setSettingsOpen(true);}} health={health} c={c}/>

      <main className={`main-stage ${current?'director-shell-stage':''}`}>
        {error&&<div className="error-banner"><CircleDot/><span>{error}</span><button onClick={()=>setError('')}>{c.dismiss}</button></div>}
        {!current?<EmptyState onCreate={()=>setDialogOpen(true)} onDemo={createDemo} c={c}/>:<>
          {current.error&&<div className="project-error"><strong>{c.lastRunStopped}</strong><span>{current.error.message}</span></div>}
          <DirectorWorkspace key={current.id} project={current} running={busy||running} keyboardLocked={paletteOpen||dialogOpen||settingsOpen||!!navDrawer} activeJob={activeJob} command={workspaceCommand} onContextChange={setWorkspaceContext} onCancelJob={cancelJob} onUndo={()=>historyAction('undo')} onRedo={()=>historyAction('redo')} onSelectTake={selectSceneTake} onRunQuality={runQuality} onGetRepairPlan={getRepairPlan} onApplyRepairs={applyRepairs} onSave={saveScene} onRunStage={runStage} onReview={reviewStage} onRunAll={run} onLoadRoughCut={loadRoughCut} onUpdateProject={updateProject} onSceneAction={editSceneStructure} onInsertScene={insertNewScene} onDirectorPlan={planDirection} onSearchBroll={searchBroll} onSelectBroll={selectBroll} onUploadArtwork={uploadArtwork} brollProviders={{names:config?.brollProviderNames||['pexels','pixabay'],configured:{pexels:!!config?.hasPexelsKey,pixabay:!!config?.hasPixabayKey}}} rendererNames={config?.rendererNames||[]} c={c}/>
        </>}
      </main>
    </div>
    <NewProjectDialog open={dialogOpen} onOpenChange={setDialogOpen} onCreate={createProject} busy={busy} defaultRenderer={config?.renderer||'simple'} rendererNames={config?.rendererNames||[]} defaultLanguage={config?.contentLanguage||'vi'} c={c}/>
    <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} onSaved={refreshHealth} c={c}/>
    <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} items={paletteItems} c={c}/>
  </div>;
}
