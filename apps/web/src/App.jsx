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
  LogIn,
  LogOut,
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
  Trash2,
  TriangleAlert,
  X,
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { copyFor, UI_LANGUAGES } from './i18n';
import ApplicationNavigation from './ApplicationNavigation';
import CommandPalette from './CommandPalette';
import DirectorWorkspace from './DirectorWorkspace';
import ChannelWorkspace, { BriefFields, VideoContextDialog } from './ChannelWorkspace';
import { usePersistentState } from './hooks/usePersistentState';

const api=async(url,options={})=>{
  const response=await fetch(url,{headers:{'content-type':'application/json',...(options.headers||{})},...options});
  const text=await response.text();let body={};
  if(text){try{body=JSON.parse(text);}catch{body={error:text};}}
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

function NewProjectDialog({open,onOpenChange,onCreate,busy,defaultRenderer='simple',rendererNames,defaultLanguage='vi',channel=null,idea=null,error='',c}){
  const [sourceType,setSourceType]=useState('topic');
  const [renderer,setRenderer]=useState(defaultRenderer);
  const [language,setLanguage]=useState(defaultLanguage);
  const [workflowMode,setWorkflowMode]=useState('studio');
  const [format,setFormat]=useState('landscape');
  const [brief,setBrief]=useState({});
  useEffect(()=>{if(open){setRenderer(channel?.productionDefaults.renderer||channel?.visualIdentity.preferredRenderer||defaultRenderer);setLanguage(channel?.productionDefaults.language||defaultLanguage);setWorkflowMode('studio');setFormat(idea?.brief?.format||channel?.productionDefaults.format||'landscape');setSourceType('topic');setBrief({targetViewer:channel?.strategy.targetAudience||'',...(idea?{pillar:idea.pillar,angle:idea.angle,viewerQuestion:idea.viewerQuestion,hook:idea.hook,corePromise:idea.corePromise,...Object.fromEntries(Object.entries(idea.brief||{}).filter(([,value])=>value!==null&&value!==''))}:{})});}},[open,defaultRenderer,defaultLanguage,channel?.id,idea?.id]);
  const submit=(event)=>{event.preventDefault();const data=Object.fromEntries(new FormData(event.currentTarget));const hasBrief=Object.values(brief).some(Boolean);onCreate({...data,sourceType,renderer,language,workflowMode,format,ideaId:idea?.id||null,brief:hasBrief?{...brief,topic:sourceType==='topic'?data.sourceText:brief.topic||'',format,targetDurationSec:Number(data.minutes)*60}:null});};
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="new-project-dialog">
      <DialogHeader>
        <div className="dialog-index">{c.newIndex}</div>
        <DialogTitle>{c.language==='en'?'Start a new video':'Bắt đầu video mới'}</DialogTitle>
        <DialogDescription>{c.startDescription}</DialogDescription>
      </DialogHeader>
      <form onSubmit={submit} className="new-project-form">
        {channel&&<div className="new-video-channel-note">{channel.identity.name} · {c.language==='en'?'Channel revision':'Phiên bản kênh'} {channel.revision}</div>}
        <div className="field-row">
          <label>{c.projectTitle}<Input name="title" defaultValue={idea?.title||''} placeholder={c.titlePlaceholder} required/></label>
          <label>{c.startingPoint}<Select value={sourceType} onValueChange={setSourceType}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="topic">{c.topicAuto}</SelectItem><SelectItem value="script">{c.preparedScript}</SelectItem><SelectItem value="srt">{c.srtSubtitles}</SelectItem></SelectContent></Select></label>
        </div>
        <label>{sourceType==='topic'?c.explainPrompt:sourceType==='srt'?c.pasteSrt:c.pasteScript}
          <Textarea name="sourceText" rows={5} defaultValue={idea?.topic||idea?.title||''} placeholder={sourceType==='topic'?c.topicPlaceholder:sourceType==='srt'?'1\n00:00:00,000 --> 00:00:04,000\n…':c.scriptPlaceholder} required/>
        </label>
        <details className="brief-disclosure" open={!!idea}><summary>{c.language==='en'?'Creative brief (optional)':'Brief sáng tạo (không bắt buộc)'}</summary><BriefFields value={brief} onChange={setBrief} c={c}/></details>
        <div className="production-options">
          <label>{c.videoFormat}<Select value={format} onValueChange={setFormat}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="landscape">{c.landscapeFormat}</SelectItem><SelectItem value="short">{c.shortFormat}</SelectItem></SelectContent></Select><small>{format==='short'?c.shortFormatHint:c.landscapeFormatHint}</small></label>
          <label>{c.renderStyle}<Select value={renderer} onValueChange={setRenderer}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{rendererOptions(rendererNames,c)}</SelectContent></Select><small>{c.rendererHint}</small></label>
          <label>{c.contentLanguage}<Select value={language} onValueChange={setLanguage}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{UI_LANGUAGES.map((item)=><SelectItem key={item.code} value={item.code}>{item.label}</SelectItem>)}</SelectContent></Select></label>
          <label className="minutes-field">{c.targetLength}<Input name="minutes" type="number" min="0.1" step="0.1" max="240" defaultValue={(idea?.brief?.targetDurationSec||channel?.productionDefaults.targetDurationSec||360)/60}/><span>{c.minutes}</span></label>
        </div>
        <div className="mode-picker"><button type="button" className={workflowMode==='studio'?'active':''} onClick={()=>setWorkflowMode('studio')}><SlidersHorizontal/><span><strong>{c.studioMode}</strong><small>{c.studioModeBody}</small></span></button><button type="button" className={workflowMode==='auto'?'active':''} onClick={()=>setWorkflowMode('auto')}><Bot/><span><strong>{c.autoMode}</strong><small>{c.autoModeBody}</small></span></button></div>
        {error&&<p className="content-error" role="alert">{error}</p>}
        <DialogFooter><Button type="button" variant="ghost" onClick={()=>onOpenChange(false)}>{c.cancel}</Button><Button type="submit" disabled={busy}>{busy?<LoaderCircle className="spin"/>:<Clapperboard/>}{c.createProduction}</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}

function DeleteProjectDialog({project,busy,blocked,error,onOpenChange,onConfirm,c}){
  return <Dialog open={!!project} onOpenChange={(open)=>{if(!open&&!busy)onOpenChange(false);}}>
    <DialogContent className="delete-project-dialog">
      <div className="delete-project-warning"><TriangleAlert/></div>
      <DialogHeader>
        <div className="dialog-index">{c.dangerZone}</div>
        <DialogTitle>{c.deleteProject}</DialogTitle>
        <DialogDescription>{c.deleteProjectBody}</DialogDescription>
      </DialogHeader>
      <div className="delete-project-target"><span>{c.projectTitle}</span><strong>{project?.title}</strong><small>{project?.scenes?.length||0} {c.scenes}</small></div>
      {blocked&&<div className="delete-project-error"><CircleDot/><span>{c.deleteProjectBusy}</span></div>}
      {error&&<div className="delete-project-error"><CircleDot/><span>{error}</span></div>}
      <DialogFooter><Button type="button" variant="ghost" disabled={busy} onClick={()=>onOpenChange(false)}>{c.cancel}</Button><Button type="button" variant="destructive" disabled={busy||blocked} onClick={onConfirm}>{busy?<LoaderCircle className="spin"/>:<Trash2/>}{busy?c.deletingProject:c.deletePermanently}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}

function SettingsDialog({open,onOpenChange,onSaved,c}){
  const [form,setForm]=useState(null);
  const [activeTab,setActiveTab]=useState('general');
  const [showKey,setShowKey]=useState(false);
  const [showVivibeKey,setShowVivibeKey]=useState(false);
  const [vivibeVoices,setVivibeVoices]=useState([]);
  const [voiceLoading,setVoiceLoading]=useState(false);
  const [saving,setSaving]=useState(false);
  const [codexAuth,setCodexAuth]=useState({available:true,connected:false,authType:null,email:null,planType:null,error:null});
  const [authLoading,setAuthLoading]=useState(false);
  const [message,setMessage]=useState(null);
  const update=(key,value)=>setForm((current)=>({...current,[key]:value}));
  const hydrated=(settings)=>({...settings,apiKey:'',clearApiKey:false,vivibeApiKey:'',clearVivibeApiKey:false,pexelsApiKey:'',clearPexelsApiKey:false,pixabayApiKey:'',clearPixabayApiKey:false});

  useEffect(()=>{
    if(!open)return;
    setForm(null);setActiveTab('general');setMessage(null);setShowKey(false);setShowVivibeKey(false);setVivibeVoices([]);
    api('/api/settings').then((settings)=>setForm(hydrated(settings))).catch((cause)=>setMessage({type:'error',text:cause.message}));
  },[open]);

  useEffect(()=>{
    if(!open)return;
    let stopped=false;
    const refresh=()=>api('/api/codex/status').then((status)=>{if(!stopped)setCodexAuth(status);}).catch((cause)=>{if(!stopped)setCodexAuth({available:false,connected:false,error:cause.message});});
    refresh();const timer=setInterval(refresh,2500);
    return()=>{stopped=true;clearInterval(timer);};
  },[open]);

  const persist=async(testAfter=false)=>{
    setSaving(true);setMessage(null);
    try{
      const settings=await api('/api/settings',{method:'PATCH',body:JSON.stringify(form)});
      setForm(hydrated(settings));
      await onSaved();
      if(testAfter){
        const result=await api('/api/settings/test',{method:'POST',body:'{}'});
        setMessage({type:'success',text:result.provider==='codex'||result.codex?c.codexTestSuccess:`Connected successfully with ${result.model}.`});
      }else setMessage({type:'success',text:c.settingsSaved});
    }catch(cause){setMessage({type:'error',text:cause.message});}
    finally{setSaving(false);}
  };

  const connectCodex=async()=>{
    setAuthLoading(true);setMessage(null);
    const popup=window.open('about:blank','cutroom-chatgpt-login','popup,width=720,height=760');
    try{
      const result=await api('/api/codex/login',{method:'POST',body:'{}'});
      if(popup)popup.location.href=result.authUrl;else window.open(result.authUrl,'_blank','noopener,noreferrer');
      setMessage({type:'success',text:c.codexLoginStarted});
    }catch(cause){popup?.close();setMessage({type:'error',text:cause.message});}
    finally{setAuthLoading(false);}
  };
  const disconnectCodex=async()=>{
    setAuthLoading(true);setMessage(null);
    try{setCodexAuth(await api('/api/codex/logout',{method:'POST',body:'{}'}));setMessage({type:'success',text:c.codexLoggedOut});}
    catch(cause){setMessage({type:'error',text:cause.message});}
    finally{setAuthLoading(false);}
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

  const codexSelected=!!form&&(form.textProvider==='codex'||form.imageProvider==='codex');
  const openAISelected=!!form&&[form.textProvider,form.imageProvider,form.voiceProvider].includes('openai');
  const settingsTabs=[
    {id:'general',label:c.settingsTabGeneral,description:c.settingsTabGeneralBody,icon:Settings2},
    {id:'generation',label:c.settingsTabGeneration,description:c.settingsTabGenerationBody,icon:BrainCircuit},
    {id:'broll',label:c.settingsTabBroll,description:c.settingsTabBrollBody,icon:Film},
    {id:'voice',label:c.settingsTabVoice,description:c.settingsTabVoiceBody,icon:Mic2},
    {id:'connection',label:c.settingsTabConnection,description:c.settingsTabConnectionBody,icon:Server},
  ];
  const activeTabMeta=settingsTabs.find((item)=>item.id===activeTab)||settingsTabs[0];

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="settings-dialog">
      {!form?<div className="settings-loading"><DialogTitle className="sr-only">{c.providerSettings}</DialogTitle><DialogDescription className="sr-only">{c.loadingConfig}</DialogDescription><LoaderCircle className="spin"/><span>{c.loadingConfig}</span></div>:<div className="settings-layout">
        <aside className="settings-aside">
          <div className="settings-aside-head"><div className="dialog-index">{c.settingsIndex}</div><DialogTitle>{c.providerSettings}</DialogTitle><DialogDescription>{c.providerDescription}</DialogDescription></div>
          <nav className="settings-tabs" aria-label={c.providerSettings}>
            {settingsTabs.map((item)=>{const Icon=item.icon;return <button key={item.id} type="button" className={activeTab===item.id?'active':''} aria-current={activeTab===item.id?'page':undefined} onClick={()=>{setActiveTab(item.id);setMessage(null);}}><Icon/><span><strong>{item.label}</strong><small>{item.description}</small></span><ArrowRight/></button>;})}
          </nav>
          <div className="settings-provider-summary" aria-label={c.connectionsModels}>
            <span className={(form.textProvider==='codex'?codexAuth.connected:form.textProvider==='mock'||form.hasOpenAIKey&&!form.clearApiKey)?'online':''}><i/>{c.textProviderLabel}</span>
            <span className={(form.imageProvider==='codex'?codexAuth.connected:form.imageProvider==='mock'||form.hasOpenAIKey&&!form.clearApiKey)?'online':''}><i/>{c.imageProviderLabel}</span>
            <span className={form.voiceProvider==='mock'||form.voiceProvider==='openai'&&form.hasOpenAIKey||form.voiceProvider==='vivibe'&&form.hasVivibeKey?'online':''}><i/>{c.voiceSource}</span>
          </div>
        </aside>

        <div className="settings-main">
          <DialogHeader className="settings-content-head"><div className="dialog-index">{c.settingsIndex}</div><DialogTitle>{activeTabMeta.label}</DialogTitle><DialogDescription>{activeTabMeta.description}</DialogDescription></DialogHeader>
          <div className="settings-tab-content" key={activeTab}>
            {activeTab==='general'&&<>
              <section className="settings-section"><div className="settings-section-title"><Settings2/><span><strong>{c.languageRegion}</strong><small>{c.languageRegionHint}</small></span></div><div className="settings-fields two-columns"><label>{c.interfaceLanguage}<Select value={form.uiLanguage} onValueChange={(value)=>update('uiLanguage',value)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{UI_LANGUAGES.map((item)=><SelectItem key={item.code} value={item.code}>{item.label}</SelectItem>)}</SelectContent></Select></label><label>{c.defaultVideoLanguage}<Select value={form.contentLanguage} onValueChange={(value)=>update('contentLanguage',value)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{UI_LANGUAGES.map((item)=><SelectItem key={item.code} value={item.code}>{item.label}</SelectItem>)}</SelectContent></Select></label></div></section>
              <section className="settings-section"><div className="settings-section-title"><Clapperboard/><span><strong>{c.defaultRenderer}</strong><small>{c.appliedNew}</small></span></div><div className="renderer-setting"><label>{c.renderStyle}<Select value={form.renderer} onValueChange={(value)=>update('renderer',value)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{rendererOptions(form.rendererNames||[],c)}</SelectContent></Select></label><p><strong>{rendererSummary(form.renderer).title}</strong><span>{rendererSummary(form.renderer).body}</span></p></div></section>
            </>}
            {activeTab==='generation'&&<>
              <section className="settings-section"><div className="settings-section-title"><FileText/><span><strong>{c.textProviderLabel}</strong><small>{c.textProviderHint}</small></span></div><div className="text-provider-row"><label>{c.provider}<Select value={form.textProvider} onValueChange={(value)=>update('textProvider',value)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="codex">ChatGPT subscription</SelectItem><SelectItem value="openai">OpenAI API</SelectItem><SelectItem value="mock">Mock · offline</SelectItem></SelectContent></Select></label><p>{form.textProvider==='codex'?c.codexProviderBody:form.textProvider==='openai'?c.openaiTextProviderBody:c.mockTextProviderBody}</p></div></section>
              <section className="settings-section"><div className="settings-section-title"><ImageIcon/><span><strong>{c.imageProviderLabel}</strong><small>{c.imageProviderHint}</small></span></div><div className="text-provider-row"><label>{c.provider}<Select value={form.imageProvider} onValueChange={(value)=>update('imageProvider',value)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="codex">ChatGPT subscription · ImageGen</SelectItem><SelectItem value="openai">OpenAI Image API</SelectItem><SelectItem value="mock">Mock · offline</SelectItem></SelectContent></Select></label><p>{form.imageProvider==='codex'?c.codexImageProviderBody:form.imageProvider==='openai'?c.openaiImageProviderBody:c.mockImageProviderBody}</p></div></section>
              <section className="settings-section"><div className="settings-section-title"><BrainCircuit/><span><strong>{c.generationStack}</strong><small>{c.modelsUsed}</small></span></div><div className="settings-fields two-columns">{form.textProvider==='openai'&&<label>{c.scriptModel}<Input value={form.textModel} onChange={(event)=>update('textModel',event.target.value)} /></label>}{form.imageProvider==='openai'&&<label>{c.imageModel}<Input value={form.imageModel} onChange={(event)=>update('imageModel',event.target.value)} /></label>}{form.imageProvider==='codex'&&<label>{c.imageModel}<Input value="gpt-image-2 · ImageGen" disabled /></label>}{form.imageProvider!=='mock'&&<label>{c.imageSize}<Select value={form.imageSize} onValueChange={(value)=>update('imageSize',value)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="1536x1024">1536 × 1024</SelectItem><SelectItem value="1024x1024">1024 × 1024</SelectItem><SelectItem value="1024x1536">1024 × 1536</SelectItem><SelectItem value="auto">Auto</SelectItem></SelectContent></Select></label>}{form.imageProvider!=='mock'&&<label>{c.imageQuality}<Select value={form.imageQuality} onValueChange={(value)=>update('imageQuality',value)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="low">Low</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="high">High</SelectItem><SelectItem value="auto">Auto</SelectItem></SelectContent></Select></label>}</div></section>
            </>}
            {activeTab==='broll'&&<section className="settings-section"><div className="settings-section-title"><Film/><span><strong>{c.brollProviders}</strong><small>{c.brollProvidersHint}</small></span></div><div className="settings-fields two-columns"><label>Pexels API key<Input type="password" autoComplete="new-password" value={form.pexelsApiKey} onChange={(event)=>setForm((current)=>({...current,pexelsApiKey:event.target.value,clearPexelsApiKey:false}))} placeholder={form.hasPexelsKey?'Leave blank to keep saved key':'Pexels API key'}/>{form.hasPexelsKey&&<Button type="button" size="sm" variant="ghost" onClick={()=>setForm((current)=>({...current,clearPexelsApiKey:!current.clearPexelsApiKey,pexelsApiKey:''}))}>{form.clearPexelsApiKey?c.keepKey:c.removeKey}</Button>}</label><label>Pixabay API key<Input type="password" autoComplete="new-password" value={form.pixabayApiKey} onChange={(event)=>setForm((current)=>({...current,pixabayApiKey:event.target.value,clearPixabayApiKey:false}))} placeholder={form.hasPixabayKey?'Leave blank to keep saved key':'Pixabay API key'}/>{form.hasPixabayKey&&<Button type="button" size="sm" variant="ghost" onClick={()=>setForm((current)=>({...current,clearPixabayApiKey:!current.clearPixabayApiKey,pixabayApiKey:''}))}>{form.clearPixabayApiKey?c.keepKey:c.removeKey}</Button>}</label></div></section>}
            {activeTab==='voice'&&<section className="settings-section voice-provider-section"><div className="settings-section-title"><Mic2/><span><strong>{c.voiceSource}</strong><small>{c.narrationProvider}</small></span></div><div className="voice-provider-head"><label>{c.provider}<Select value={form.voiceProvider} onValueChange={(value)=>{update('voiceProvider',value);setVivibeVoices([]);}}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="openai">OpenAI Speech</SelectItem><SelectItem value="vivibe">Vivibe / LucyAI</SelectItem><SelectItem value="mock">Mock</SelectItem></SelectContent></Select></label><p>{form.voiceProvider==='vivibe'?'Async Vietnamese voice generation via ttsLongText. Audio is normalized to MP3 before entering the timeline.':form.voiceProvider==='openai'?'Direct speech synthesis with model, voice, and delivery instructions.':'Offline silent MP3 for smoke tests and zero-cost development.'}</p></div>{form.voiceProvider==='openai'&&<><div className="settings-fields two-columns voice-fields"><label>Speech model<Input value={form.ttsModel} onChange={(event)=>update('ttsModel',event.target.value)} /></label><label>Voice<Input value={form.ttsVoice} onChange={(event)=>update('ttsVoice',event.target.value)} /></label></div><label className="instruction-field">Voice direction<Textarea rows={3} value={form.ttsInstructions} onChange={(event)=>update('ttsInstructions',event.target.value)} /></label></>}{form.voiceProvider==='vivibe'&&<div className="vivibe-panel"><div className="settings-fields two-columns"><label className="key-field">Vivibe API key<div className="key-input"><Input type={showVivibeKey?'text':'password'} autoComplete="new-password" value={form.vivibeApiKey} onChange={(event)=>setForm((current)=>({...current,vivibeApiKey:event.target.value,clearVivibeApiKey:false}))} placeholder={form.hasVivibeKey?'Leave blank to keep saved key':'Paste Vivibe API key'}/><button type="button" onClick={()=>setShowVivibeKey((value)=>!value)} aria-label={showVivibeKey?'Hide Vivibe API key':'Show Vivibe API key'}>{showVivibeKey?<EyeOff/>:<Eye/>}</button></div><small>{form.hasVivibeKey&&!form.clearVivibeApiKey?'A key is already stored.':'Created at vivibe.app/docs/api-keys.'}</small></label><label>JSON-RPC URL<Input value={form.vivibeBaseUrl} onChange={(event)=>update('vivibeBaseUrl',event.target.value)} /><small>Default: api.lucylab.io/json-rpc</small></label></div>{form.hasVivibeKey&&<Button type="button" size="sm" variant={form.clearVivibeApiKey?'secondary':'ghost'} className="remove-key" onClick={()=>setForm((current)=>({...current,clearVivibeApiKey:!current.clearVivibeApiKey,vivibeApiKey:''}))}>{form.clearVivibeApiKey?'Keep saved Vivibe key':'Remove saved Vivibe key'}</Button>}<div className="voice-identity-row"><label>Voice ID<Input value={form.vivibeVoiceId} onChange={(event)=>update('vivibeVoiceId',event.target.value)} placeholder="Your Vivibe voice ID"/></label><label>Speed<Input type="number" min="0.5" max="2" step="0.1" value={form.vivibeSpeed} onChange={(event)=>update('vivibeSpeed',event.target.value)}/></label><Button type="button" variant="outline" disabled={voiceLoading||form.clearVivibeApiKey||(!form.hasVivibeKey&&!form.vivibeApiKey)} onClick={loadVivibeVoices}>{voiceLoading?<LoaderCircle className="spin"/>:<RefreshCw/>}Load voices</Button></div>{vivibeVoices.length>0&&<label className="vivibe-voice-list">Available voices<Select value={form.vivibeVoiceId||undefined} onValueChange={(value)=>update('vivibeVoiceId',value)}><SelectTrigger><SelectValue placeholder="Choose a voice"/></SelectTrigger><SelectContent>{vivibeVoices.map((voice)=><SelectItem key={voice.id} value={voice.id}>{voice.name}</SelectItem>)}</SelectContent></Select><small>{vivibeVoices.length} active voices returned by getUserVoices.</small></label>}</div>}</section>}
            {activeTab==='connection'&&<>
              <div className="security-card"><ShieldCheck/><div><strong>{c.serverSecrets}</strong><p>{c.serverSecretsBody}</p></div></div>
              {codexSelected&&<section className="settings-section"><div className="settings-section-title"><Sparkles/><span><strong>ChatGPT</strong><small>{c.codexConnectHint}</small></span></div><div className={`codex-connect-card ${codexAuth.connected?'connected':''}`}><div className="codex-connect-status"><span className="codex-mark">GPT</span><div><strong>{codexAuth.connected?c.codexConnected:c.codexNotConnected}</strong><small>{codexAuth.connected?[codexAuth.email,codexAuth.planType&&String(codexAuth.planType).toUpperCase()].filter(Boolean).join(' · '):codexAuth.error||c.codexConnectHint}</small></div></div><div className="codex-connect-actions"><label>{c.codexModel}<Input value={form.codexModel} onChange={(event)=>update('codexModel',event.target.value)} placeholder={c.codexModelPlaceholder}/></label>{codexAuth.connected?<Button type="button" variant="outline" className="disconnect-action" disabled={authLoading} onClick={disconnectCodex}>{authLoading?<LoaderCircle className="spin"/>:<LogOut/>}{c.disconnect}</Button>:<Button type="button" disabled={authLoading||codexAuth.available===false} onClick={connectCodex}>{authLoading?<LoaderCircle className="spin"/>:<LogIn/>}{c.connectChatGPT}</Button>}</div></div></section>}
              <section className="settings-section"><div className="settings-section-title"><Server/><span><strong>{c.connection}</strong><small>{c.credentialEndpoint}</small></span></div><div className="settings-fields two-columns"><label className="key-field">{c.apiKey}<div className="key-input"><Input type={showKey?'text':'password'} autoComplete="new-password" value={form.apiKey} onChange={(event)=>setForm((current)=>({...current,apiKey:event.target.value,clearApiKey:false}))} placeholder={form.hasOpenAIKey?'••••••••':'sk-proj-…'}/><button type="button" onClick={()=>setShowKey((value)=>!value)} aria-label={c.apiKey}>{showKey?<EyeOff/>:<Eye/>}</button></div></label><label>{c.baseUrl}<Input value={form.baseUrl} onChange={(event)=>update('baseUrl',event.target.value)} placeholder="https://api.openai.com/v1"/></label></div>{form.hasOpenAIKey&&<Button type="button" size="sm" variant={form.clearApiKey?'secondary':'ghost'} className="remove-key" onClick={()=>setForm((current)=>({...current,clearApiKey:!current.clearApiKey,apiKey:''}))}>{form.clearApiKey?'Keep saved key':'Remove saved key'}</Button>}</section>
            </>}
          </div>
          <div className="settings-actions">{message&&<div className={`settings-message ${message.type}`}>{message.type==='success'?<CheckCircle2/>:<CircleDot/>}<span>{message.text}</span></div>}<DialogFooter className="settings-footer"><Button type="button" variant="ghost" onClick={()=>onOpenChange(false)}>{c.close}</Button><Button type="button" variant="outline" disabled={saving||codexSelected&&!codexAuth.connected||openAISelected&&(form.clearApiKey||(!form.hasOpenAIKey&&!form.apiKey))} onClick={()=>persist(true)}>{saving?<LoaderCircle className="spin"/>:<Activity/>}{c.saveTest}</Button><Button type="button" disabled={saving} onClick={()=>persist(false)}>{saving?<LoaderCircle className="spin"/>:<Save/>}{c.saveSettings}</Button></DialogFooter></div>
        </div>
      </div>}
    </DialogContent>
  </Dialog>;
}

export default function App(){
  const [projects,setProjects]=useState([]);
  const [channels,setChannels]=useState([]);
  const [contentNavigation,setContentNavigation]=usePersistentState('cutroom:channel-navigation',{channelId:null});
  const channelId=typeof contentNavigation.channelId==='string'?contentNavigation.channelId:null;
  const setChannelId=(id)=>setContentNavigation({channelId:id});
  const [ideaToCreate,setIdeaToCreate]=useState(null);
  const [contextVideo,setContextVideo]=useState(null);
  const [current,setCurrent]=useState(null);
  const [health,setHealth]=useState(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [dialogOpen,setDialogOpen]=useState(false);
  const [settingsOpen,setSettingsOpen]=useState(false);
  const [projectToDelete,setProjectToDelete]=useState(null);
  const [deletingProjectId,setDeletingProjectId]=useState(null);
  const [deleteProjectError,setDeleteProjectError]=useState('');
  const [navDrawer,setNavDrawer]=useState(null);
  const [paletteOpen,setPaletteOpen]=useState(false);
  const [workspaceContext,setWorkspaceContext]=useState(null);
  const [workspaceCommand,setWorkspaceCommand]=useState(null);
  const [dismissedProjectError,setDismissedProjectError]=useState('');

  const activeJob=[...(current?.jobs||[])].reverse().find((job)=>['queued','running','cancelling'].includes(job.status))||null;
  const running=!!activeJob||!!current&&health?.running?.includes(current.id);
  const projectErrorKey=current?.error?[current.id,current.error.jobId,current.error.at,current.error.message].filter(Boolean).join(':'):'';
  const showProjectError=!!current?.error&&dismissedProjectError!==projectErrorKey;
  const config=health?.config;
  const c=copyFor(config?.uiLanguage||'vi');
  const selectedChannel=channels.find((channel)=>channel.id===channelId)||null;
  const channelProjects=projects.filter((project)=>(project.channelId||null)===channelId);
  const refreshHealth=async()=>setHealth(await api('/api/health'));
  const refreshProjects=async()=>setProjects(await api('/api/projects'));
  const refreshChannels=async()=>setChannels(await api('/api/channels'));
  const refreshContent=()=>Promise.all([refreshProjects(),refreshChannels()]);
  const load=async(id)=>{const project=await api(`/api/projects/${encodeURIComponent(id)}`);setCurrent(project);setChannelId(project.channelId||null);await Promise.all([refreshProjects(),refreshHealth(),refreshChannels()]);};
  const openNewVideo=(idea=null)=>{setIdeaToCreate(idea);setError('');setNavDrawer(null);setDialogOpen(true);};
  const chooseChannel=(id)=>{setChannelId(id);setCurrent(null);setNavDrawer(null);};
  const contextSaved=async(project)=>{if(current?.id===project.id){setCurrent(project);setChannelId(project.channelId||null);}await refreshContent();};

  useEffect(()=>{Promise.all([refreshProjects(),refreshHealth(),refreshChannels()]).catch((cause)=>setError(cause.message));},[]);
  useEffect(()=>{const openPalette=(event)=>{if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='k'){event.preventDefault();setPaletteOpen((value)=>!value);}};window.addEventListener('keydown',openPalette);return()=>window.removeEventListener('keydown',openPalette);},[]);
  useEffect(()=>{
    if(!current?.id||!activeJob)return;
    let stopped=false;
    const tick=async()=>{try{const project=await api(`/api/projects/${encodeURIComponent(current.id)}`);if(!stopped){setCurrent(project);setProjects((items)=>items.map((item)=>item.id===project.id?project:item));}}catch(cause){if(!stopped)setError(cause.message);}};
    const timer=setInterval(tick,700);tick();return()=>{stopped=true;clearInterval(timer);};
  },[current?.id,activeJob?.id,activeJob?.status]);

  const createProject=async(payload)=>{
    setBusy(true);setError('');
    try{const project=await api('/api/projects',{method:'POST',body:JSON.stringify({...payload,channelId})});setDialogOpen(false);setIdeaToCreate(null);await load(project.id);}
    catch(cause){setError(cause.message);}finally{setBusy(false);}
  };
  const createDemo=()=>createProject(config?.contentLanguage==='en'?{title:'Small Habits — Test Cut',sourceType:'script',sourceText:'Small habits feel insignificant at first, but repetition gives them power. Each action becomes a vote for the person you want to become. Make the next step obvious, easy, and satisfying, then let consistency do the heavy lifting.',minutes:1,language:'en'}:{title:'Thói quen nhỏ — Bản thử',sourceType:'script',sourceText:'Những thói quen nhỏ ban đầu có vẻ không đáng kể, nhưng sự lặp lại tạo cho chúng sức mạnh. Mỗi hành động là một lá phiếu cho con người bạn muốn trở thành. Hãy làm cho bước tiếp theo thật rõ ràng, dễ dàng và thú vị, rồi để sự kiên trì tạo nên khác biệt.',minutes:1,language:'vi'});
  const deleteSelectedProject=async()=>{
    if(!projectToDelete)return false;
    const id=projectToDelete.id;setDeletingProjectId(id);setDeleteProjectError('');setError('');
    try{
      await api(`/api/projects/${encodeURIComponent(id)}`,{method:'DELETE'});
      setProjects((items)=>items.filter((project)=>project.id!==id));
      if(current?.id===id)setCurrent(null);
      setProjectToDelete(null);setNavDrawer(null);await refreshHealth();return true;
    }catch(cause){setDeleteProjectError(cause.message);return false;}
    finally{setDeletingProjectId(null);}
  };
  const saveScene=async(sceneId,payload)=>{setBusy(true);setError('');try{const project=await api(`/api/projects/${encodeURIComponent(current.id)}/scenes/${encodeURIComponent(sceneId)}`,{method:'PATCH',body:JSON.stringify(payload)});setCurrent(project);await refreshProjects();return project;}catch(cause){setError(cause.message);return null;}finally{setBusy(false);}};
  const updateProject=async(payload)=>{setBusy(true);setError('');try{const project=await api(`/api/projects/${encodeURIComponent(current.id)}`,{method:'PATCH',body:JSON.stringify(payload)});setCurrent(project);await refreshProjects();return project;}catch(cause){setError(cause.message);return null;}finally{setBusy(false);}};
  const changeRenderer=async(renderer)=>{if(!current||renderer===current.settings?.renderer)return;await updateProject({renderer});};
  const changeFormat=async(format)=>{if(!current||format===current.settings?.format)return;await updateProject({format});};
  const enqueueJob=async(type,request={})=>{setBusy(true);setError('');try{const result=await api(`/api/projects/${encodeURIComponent(current.id)}/jobs`,{method:'POST',body:JSON.stringify({type,request})});setCurrent(result.project);await refreshProjects();return result;}catch(cause){setError(cause.message);return null;}finally{setBusy(false);}};
  const run=async(body={})=>!!await enqueueJob('render',body);
  const runStage=async(sceneId,stage)=>run({sceneId,stage});
  const runBulk=async(stage,sceneIds)=>run({stage,sceneIds});
  const reviewStage=async(sceneId,stage,decision)=>{setBusy(true);setError('');try{const project=await api(`/api/projects/${encodeURIComponent(current.id)}/scenes/${encodeURIComponent(sceneId)}/review`,{method:'POST',body:JSON.stringify({stage,decision})});setCurrent(project);await refreshProjects();return project;}catch(cause){setError(cause.message);return null;}finally{setBusy(false);}};
  const reviewBulk=async(stage,sceneIds,decision)=>{setBusy(true);setError('');try{const project=await api(`/api/projects/${encodeURIComponent(current.id)}/review`,{method:'POST',body:JSON.stringify({stage,sceneIds,decision})});setCurrent(project);await refreshProjects();return project;}catch(cause){setError(cause.message);return null;}finally{setBusy(false);}};
  const editSceneStructure=async(sceneId,payload)=>{setBusy(true);setError('');try{const result=await api(`/api/projects/${encodeURIComponent(current.id)}/scenes/${encodeURIComponent(sceneId)}/actions`,{method:'POST',body:JSON.stringify(payload)});setCurrent(result.project);await refreshProjects();return result;}catch(cause){setError(cause.message);return null;}finally{setBusy(false);}};
  const insertNewScene=async(afterSceneId)=>{setBusy(true);setError('');try{const result=await api(`/api/projects/${encodeURIComponent(current.id)}/scenes`,{method:'POST',body:JSON.stringify({afterSceneId,text:c.language==='en'?'A new scene.':'Một phân cảnh mới.'})});setCurrent(result.project);await refreshProjects();return result;}catch(cause){setError(cause.message);return null;}finally{setBusy(false);}};
  const planDirection=async(sceneId,instruction)=>{setError('');try{return await api(`/api/projects/${encodeURIComponent(current.id)}/director`,{method:'POST',body:JSON.stringify({sceneId,instruction})});}catch(cause){setError(cause.message);throw cause;}};
  const searchBroll=async({provider,query,orientation='portrait'})=>api(`/api/broll/search?provider=${encodeURIComponent(provider)}&query=${encodeURIComponent(query)}&orientation=${encodeURIComponent(orientation)}`);
  const selectBroll=async(sceneId,selection,brollStartMs=0)=>{setBusy(true);setError('');try{const result=await api(`/api/projects/${encodeURIComponent(current.id)}/scenes/${encodeURIComponent(sceneId)}/broll`,{method:'POST',body:JSON.stringify({selection,brollStartMs})});setCurrent(result.project);await refreshProjects();return result;}catch(cause){setError(cause.message);throw cause;}finally{setBusy(false);}};
  const uploadArtwork=async(sceneId,file)=>{setBusy(true);setError('');try{const response=await fetch(`/api/projects/${encodeURIComponent(current.id)}/scenes/${encodeURIComponent(sceneId)}/artwork`,{method:'POST',headers:{'content-type':file.type,'x-file-name':encodeURIComponent(file.name)},body:file});const result=await response.json();if(!response.ok)throw new Error(result.error||response.statusText);setCurrent(result.project);await refreshProjects();return result;}catch(cause){setError(cause.message);throw cause;}finally{setBusy(false);}};
  const loadDrawRevealPath=(sceneId)=>api(`/api/projects/${encodeURIComponent(current.id)}/scenes/${encodeURIComponent(sceneId)}/draw-reveal/path`);
  const saveDrawRevealPath=async(sceneId,path)=>{setBusy(true);setError('');try{const result=await api(`/api/projects/${encodeURIComponent(current.id)}/scenes/${encodeURIComponent(sceneId)}/draw-reveal/path`,{method:'PATCH',body:JSON.stringify({path})});setCurrent(result.project);await refreshProjects();return result;}catch(cause){setError(cause.message);throw cause;}finally{setBusy(false);}};
  const loadRoughCut=async()=>api(`/api/projects/${encodeURIComponent(current.id)}/rough-cut`);
  const cancelJob=async(jobId)=>{setError('');try{const result=await api(`/api/projects/${encodeURIComponent(current.id)}/jobs/${encodeURIComponent(jobId)}/cancel`,{method:'POST'});setCurrent(result.project);return result;}catch(cause){setError(cause.message);return null;}};
  const historyAction=async(action)=>{setBusy(true);setError('');try{const project=await api(`/api/projects/${encodeURIComponent(current.id)}/history/${action}`,{method:'POST'});setCurrent(project);setChannelId(project.channelId||null);await refreshProjects();return project;}catch(cause){setError(cause.message);return null;}finally{setBusy(false);}};
  const selectSceneTake=async(sceneId,kind,takeId)=>{setBusy(true);setError('');try{const project=await api(`/api/projects/${encodeURIComponent(current.id)}/scenes/${encodeURIComponent(sceneId)}/takes/${encodeURIComponent(kind)}/${encodeURIComponent(takeId)}/select`,{method:'POST'});setCurrent(project);await refreshProjects();return project;}catch(cause){setError(cause.message);return null;}finally{setBusy(false);}};
  const runQuality=async(sceneIds=null)=>!!await enqueueJob('quality',sceneIds?{sceneIds}:{});
  const getRepairPlan=async()=>api(`/api/projects/${encodeURIComponent(current.id)}/quality/repair-plan`);
  const applyRepairs=async(actions)=>{setBusy(true);setError('');try{const result=await api(`/api/projects/${encodeURIComponent(current.id)}/quality/repair`,{method:'POST',body:JSON.stringify({actions})});setCurrent(result.project);return result;}catch(cause){setError(cause.message);return null;}finally{setBusy(false);}};
  const commandSceneId=workspaceContext?.sceneId||current?.scenes?.[0]?.id;
  const sendWorkspaceCommand=(type,payload={})=>setWorkspaceCommand({type,...payload,id:Date.now()});
  const paletteItems=[
    {id:'new',group:c.commandGroups.navigation,label:c.newProduction,meta:c.commandNewBody,icon:Plus,run:()=>openNewVideo()},
    {id:'settings',group:c.commandGroups.navigation,label:c.settingsNav,meta:c.providerSettings,icon:Settings2,run:()=>setSettingsOpen(true)},
    ...projects.map((project)=>({id:`project-${project.id}`,group:c.commandGroups.projects,label:project.title,meta:`${project.scenes.length} ${c.scenes}`,icon:Clapperboard,run:()=>load(project.id)})),
    ...(current?.scenes||[]).map((scene,index)=>({id:`scene-${scene.id}`,group:c.commandGroups.scenes,label:`${c.sceneLabel} ${String(index+1).padStart(2,'0')} · ${scene.text.split(/[.!?]/)[0]}`,meta:`${(scene.durationMs/1000).toFixed(1)} ${c.seconds}`,icon:FileText,run:()=>sendWorkspaceCommand('scene',{sceneId:scene.id})})),
    ...(current&&commandSceneId?[['voice',AudioLines],['visual',ImageIcon],['clip',Film]].map(([stage,icon])=>({id:`regenerate-${stage}`,group:c.commandGroups.actions,label:`${c.regenerate} ${c[`${stage}Stage`].toLowerCase()}`,meta:c.commandCurrentScene,icon,run:()=>runStage(commandSceneId,stage)})) : []),
    ...(current&&commandSceneId?[{id:'quality-scene',group:c.commandGroups.actions,label:c.checkScene,meta:c.commandCurrentScene,icon:Gauge,run:()=>runQuality([commandSceneId])},{id:'focus-preview',group:c.commandGroups.actions,label:c.focusPreview,meta:c.commandCurrentScene,icon:Eye,shortcut:'F',run:()=>sendWorkspaceCommand('focus')},{id:'export-final',group:c.commandGroups.actions,label:c.exportFinal,meta:current.title,icon:Clapperboard,run:()=>run({stage:'final'})}] : []),
  ];
  return <div className={`app-shell ${current?'editing':''}`}>
    {!current&&<header className="app-header">
      <button className="brand" onClick={()=>setCurrent(null)}><BrandMark/><span><strong>CUTROOM</strong><small>YouTube Content OS</small></span></button>
      <div className="header-rule"/>
      <div className="runtime-status">
        <span className={`status-light ${health?'online':''}`}/>
        <div><strong>{health?c.systemReady:c.connecting}</strong><small>{config?`${config.mockMode?'Mock':'Live'} · ${config.renderer}`:c.localRuntime}</small></div>
      </div>
      <button className="command-trigger" onClick={()=>setPaletteOpen(true)}><Command/><span>{c.quickActions}</span><kbd>⌘ K</kbd></button>
      <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={()=>Promise.all([refreshContent(),refreshHealth()]).catch((cause)=>setError(cause.message))}><RefreshCw/></Button></TooltipTrigger><TooltipContent>{c.refreshWorkspace}</TooltipContent></Tooltip>
    </header>}

    <div className={`workspace-grid ${current?'project-open':''}`}>
      <ApplicationNavigation current={current} projects={channelProjects} drawer={navDrawer} onDrawer={setNavDrawer} onHome={()=>{setNavDrawer(null);setCurrent(null);refreshChannels().catch((cause)=>setError(cause.message));}} onCreate={()=>openNewVideo()} onSelect={load} onDelete={(project)=>{setDeleteProjectError('');setProjectToDelete(project);}} onSettings={()=>{setNavDrawer(null);setSettingsOpen(true);}} health={health} c={c}/>

      <main className={`main-stage ${current?'director-shell-stage with-video-context':''}`}>
        {(error||showProjectError)&&<div className="app-alert-stack" aria-live="assertive">
          {error&&<Alert variant="destructive" className="app-alert"><TriangleAlert/><div className="app-alert-copy"><AlertTitle>{c.needsAttention}</AlertTitle><AlertDescription>{error}</AlertDescription></div><Button variant="ghost" size="icon-sm" aria-label={c.dismiss} onClick={()=>setError('')}><X/></Button></Alert>}
          {showProjectError&&<Alert variant="destructive" className="app-alert"><TriangleAlert/><div className="app-alert-copy"><AlertTitle>{c.lastRunStopped}</AlertTitle><AlertDescription>{current.error.message}</AlertDescription></div><Button variant="ghost" size="icon-sm" aria-label={c.dismiss} onClick={()=>setDismissedProjectError(projectErrorKey)}><X/></Button></Alert>}
        </div>}
        {!current?<ChannelWorkspace key={channelId||'unassigned'} channels={channels} channelId={channelId} onChannelChange={chooseChannel} projects={channelProjects} onSelect={load} onCreate={openNewVideo} onRefresh={refreshContent} onManageVideo={setContextVideo} c={c}/>:<>
          <div className="video-context-toolbar"><button onClick={()=>{setCurrent(null);refreshChannels().catch((cause)=>setError(cause.message));}}><ArrowRight style={{transform:'rotate(180deg)'}}/>{selectedChannel?.identity.name||(current.channelId?(c.language==='en'?'Channel unavailable':'Kênh không khả dụng'):(c.language==='en'?'Unassigned':'Chưa phân kênh'))}</button>{current.channelRevision&&<span>{c.language==='en'?'Inherited':'Đã nhận'} r{current.channelRevision}{selectedChannel&&selectedChannel.revision!==current.channelRevision?` · ${c.language==='en'?'Channel':'Kênh'} r${selectedChannel.revision}`:''}</span>}<button disabled={busy||running} onClick={()=>setContextVideo(current)}><Settings2/>{c.language==='en'?'Channel & Brief':'Kênh & Brief'}</button></div>
          <DirectorWorkspace key={current.id} project={current} running={busy||running} keyboardLocked={paletteOpen||dialogOpen||settingsOpen||!!contextVideo||!!projectToDelete||!!navDrawer} activeJob={activeJob} command={workspaceCommand} onContextChange={setWorkspaceContext} onCreate={()=>openNewVideo()} onCancelJob={cancelJob} onUndo={()=>historyAction('undo')} onRedo={()=>historyAction('redo')} onSelectTake={selectSceneTake} onRunQuality={runQuality} onGetRepairPlan={getRepairPlan} onApplyRepairs={applyRepairs} onSave={saveScene} onRunStage={runStage} onReview={reviewStage} onReviewBulk={reviewBulk} onRunAll={run} onLoadRoughCut={loadRoughCut} onUpdateProject={updateProject} onSceneAction={editSceneStructure} onInsertScene={insertNewScene} onDirectorPlan={planDirection} onSearchBroll={searchBroll} onSelectBroll={selectBroll} onUploadArtwork={uploadArtwork} onLoadDrawRevealPath={loadDrawRevealPath} onSaveDrawRevealPath={saveDrawRevealPath} brollProviders={{names:config?.brollProviderNames||['pexels','pixabay'],configured:{pexels:!!config?.hasPexelsKey,pixabay:!!config?.hasPixabayKey}}} rendererNames={config?.rendererNames||[]} c={c}/>
        </>}
      </main>
    </div>
    <NewProjectDialog key={`${channelId||'unassigned'}-${ideaToCreate?.id||'new'}`} open={dialogOpen} onOpenChange={setDialogOpen} onCreate={createProject} busy={busy} defaultRenderer={config?.renderer||'simple'} rendererNames={config?.rendererNames||[]} defaultLanguage={config?.contentLanguage||'vi'} channel={selectedChannel} idea={ideaToCreate} error={error} c={c}/>
    {contextVideo&&<VideoContextDialog key={contextVideo.id} video={contextVideo} channels={channels} onClose={()=>setContextVideo(null)} onSaved={contextSaved} c={c}/>}
    <DeleteProjectDialog project={projectToDelete} busy={deletingProjectId===projectToDelete?.id} blocked={!!projectToDelete&&(projectToDelete.jobs||[]).some((job)=>['queued','running','cancelling'].includes(job.status))||!!projectToDelete&&health?.running?.includes(projectToDelete.id)} error={deleteProjectError} onOpenChange={(open)=>{if(!open){setProjectToDelete(null);setDeleteProjectError('');}}} onConfirm={deleteSelectedProject} c={c}/>
    <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} onSaved={refreshHealth} c={c}/>
    <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} items={paletteItems} c={c}/>
  </div>;
}
