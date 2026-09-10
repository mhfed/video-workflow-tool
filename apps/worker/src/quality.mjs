import path from 'node:path';
import { config } from '../../../packages/core/src/env.mjs';
import { probeDuration, probeVideoSize } from '../../../packages/core/src/media.mjs';
import { loadProject, projectDir, saveProject } from '../../../packages/core/src/project.mjs';
import { run } from '../../../packages/core/src/process.mjs';
import { fileExists, nowIso } from '../../../packages/core/src/utils.mjs';
import { inspectVisualOpenAI, transcribeAudioOpenAI } from '../../../packages/providers/src/openai.mjs';
import { runPipeline } from './pipeline.mjs';

const check=(status,label,note,value=null)=>({status,label,note,...(value===null?{}:{value})});
const rank={pass:0,unchecked:1,warn:2,fail:3};
const aggregate=(checks)=>Object.values(checks).reduce((worst,item)=>rank[item.status]>rank[worst]?item.status:worst,'pass');
const abortIfNeeded=(signal)=>{if(signal?.aborted)throw Object.assign(new Error('Operation cancelled'),{name:'AbortError'});};

async function visualQuality(scene,project,cfg,signal) {
  const tr=(en,vi)=>project.settings?.language==='vi'?vi:en;
  const relative=scene.artifacts?.visual;
  if(!relative)return {status:'unchecked',checkedAt:nowIso(),checks:{asset:check('unchecked',tr('Visual asset','Tệp hình ảnh'),tr('Generate a visual before running frame QA.','Hãy tạo hình ảnh trước khi kiểm tra khung hình.'))}};
  const file=path.join(projectDir(cfg,project.id),relative);
  if(!fileExists(file))return {status:'fail',checkedAt:nowIso(),checks:{asset:check('fail',tr('Visual asset','Tệp hình ảnh'),tr('The selected visual file is missing.','Không tìm thấy tệp hình ảnh đang được chọn.'))}};
  const size=await probeVideoSize(file,cfg,{signal}),expected=project.settings.width/project.settings.height,actual=size.width/size.height,ratioDelta=Math.abs(actual-expected)/expected;
  const checks={
    crop:check(ratioDelta<=.025?'pass':ratioDelta<=.12?'warn':'fail',tr('Frame crop','Tỉ lệ khung'),ratioDelta<=.025?tr('Aspect ratio matches the project canvas.','Tỉ lệ khớp với canvas dự án.'):tr(`Source is ${size.width}×${size.height}; the renderer will need to contain it.`,`Nguồn là ${size.width}×${size.height}; renderer sẽ cần đặt vừa trong khung.`),`${size.width}×${size.height}`),
    safeArea:check('unchecked',tr('Safe area','Vùng an toàn'),tr('Enable an OpenAI visual provider to inspect subject placement.','Bật OpenAI visual để kiểm tra vị trí chủ thể.')),
    unwantedText:check('unchecked',tr('Unwanted text','Chữ không mong muốn'),tr('Enable an OpenAI visual provider to inspect readable text.','Bật OpenAI visual để kiểm tra chữ đọc được.')),
    styleDrift:check('unchecked',tr('Style continuity','Tính nhất quán'),tr('Enable an OpenAI visual provider to compare project memory.','Bật OpenAI visual để đối chiếu bộ nhớ dự án.'))
  };
  if(!cfg.mockMode&&cfg.openaiApiKey){
    try{
      const vision=await inspectVisualOpenAI(file,{scene,project},cfg,{signal});
      for(const key of ['safeArea','crop','unwantedText','styleDrift'])if(vision?.[key])checks[key]=check(['pass','warn','fail'].includes(vision[key].status)?vision[key].status:'warn',checks[key].label,String(vision[key].note||'Vision review completed.'),checks[key].value||null);
    }catch(error){
      if(error.name==='AbortError')throw error;
      checks.safeArea=check('unchecked',tr('Safe area','Vùng an toàn'),tr(`Vision review unavailable: ${error.message}`,`Không thể kiểm tra hình ảnh bằng AI: ${error.message}`));
    }
  }
  return {status:aggregate(checks),checkedAt:nowIso(),checks};
}

const normalized=(value)=>String(value||'').normalize('NFKD').toLowerCase().replace(/[^a-z0-9\p{L}\p{N}]+/gu,' ').trim();

async function audioQuality(scene,project,cfg,signal) {
  const tr=(en,vi)=>project.settings?.language==='vi'?vi:en;
  const relative=scene.artifacts?.voice;
  if(!relative)return {status:'unchecked',checkedAt:nowIso(),checks:{asset:check('unchecked',tr('Voice asset','Tệp giọng đọc'),tr('Generate voice before running audio QA.','Hãy tạo giọng đọc trước khi kiểm tra âm thanh.'))}};
  const file=path.join(projectDir(cfg,project.id),relative);
  if(!fileExists(file))return {status:'fail',checkedAt:nowIso(),checks:{asset:check('fail',tr('Voice asset','Tệp giọng đọc'),tr('The selected voice file is missing.','Không tìm thấy tệp giọng đọc đang được chọn.'))}};
  const duration=await probeDuration(file,cfg,{signal});
  const analysis=await run(cfg.ffmpegBin,['-hide_banner','-i',file,'-af','silencedetect=noise=-45dB:d=0.35,volumedetect','-f','null','-'],{capture:true,signal});
  const output=`${analysis.stdout}\n${analysis.stderr}`;
  const silence=[...output.matchAll(/silence_duration:\s*([0-9.]+)/g)].reduce((sum,match)=>sum+Number(match[1]||0),0);
  const mean=Number(output.match(/mean_volume:\s*(-?[0-9.]+) dB/)?.[1]);
  const peak=Number(output.match(/max_volume:\s*(-?[0-9.]+) dB/)?.[1]);
  const words=String(scene.text).trim().split(/\s+/).filter(Boolean).length,wpm=Math.round(words/Math.max(duration/60,.01)),silenceRatio=silence/Math.max(duration,.01);
  const checks={
    silence:check(silenceRatio>.45?'fail':silenceRatio>.22?'warn':'pass',tr('Silence','Khoảng lặng'),tr(`${Math.round(silenceRatio*100)}% of the take is silent.`,`${Math.round(silenceRatio*100)}% thời lượng không có tiếng.`),silenceRatio),
    clipping:check(Number.isFinite(peak)&&peak>-.35?'fail':Number.isFinite(peak)&&peak>-.8?'warn':'pass',tr('Clipping','Vỡ tiếng'),Number.isFinite(peak)?tr(`Peak level is ${peak.toFixed(1)} dB.`,`Mức đỉnh là ${peak.toFixed(1)} dB.`):tr('No measurable peak was reported.','Không đo được mức đỉnh.'),peak),
    pacing:check(wpm<95||wpm>205?'warn':'pass',tr('Pacing','Nhịp đọc'),tr(`${wpm} words per minute.`,`${wpm} từ mỗi phút.`),wpm),
    pronunciation:check('unchecked',tr('Pronunciation','Phát âm'),tr('Transcription comparison requires an OpenAI key.','Cần OpenAI key để đối chiếu bản chép lời.'))
  };
  if(!cfg.mockMode&&cfg.openaiApiKey){
    try{
      const prompt=(project.memory?.pronunciations||[]).join(', '),transcript=await transcribeAudioOpenAI(file,cfg,{language:project.settings?.language,prompt,signal});
      const transcriptNormalized=normalized(transcript),transcriptWords=new Set(transcriptNormalized.split(' '));
      const watched=(project.memory?.pronunciations||[]).map((item)=>normalized(item.split(/[=:]/)[0])).filter(Boolean);
      const missing=watched.filter((item)=>!transcriptNormalized.includes(item));
      const expected=normalized(scene.text).split(' ').filter(Boolean),matched=expected.filter((word)=>transcriptWords.has(word)).length/Math.max(1,expected.length);
      checks.pronunciation=check(missing.length?'warn':matched<.72?'warn':'pass',tr('Pronunciation','Phát âm'),missing.length?tr(`Review: ${missing.join(', ')}.`,`Cần nghe lại: ${missing.join(', ')}.`):tr(`Transcript coverage ${Math.round(matched*100)}%.`,`Bản chép lời khớp ${Math.round(matched*100)}%.`),{transcript,missing,coverage:matched});
    }catch(error){
      if(error.name==='AbortError')throw error;
      checks.pronunciation=check('unchecked',tr('Pronunciation','Phát âm'),tr(`Transcription unavailable: ${error.message}`,`Không thể chép lời để đối chiếu: ${error.message}`));
    }
  }
  return {status:aggregate(checks),checkedAt:nowIso(),durationSec:duration,meanVolumeDb:Number.isFinite(mean)?mean:null,checks};
}

export async function runQualityChecks(projectId,{sceneIds=null,signal=null,onProgress=null}={}) {
  const cfg=config(),project=loadProject(projectId,cfg),ids=Array.isArray(sceneIds)?new Set(sceneIds):null;
  const targets=project.scenes.filter((scene)=>!ids||ids.has(scene.id));
  if(!targets.length)throw new Error('Choose at least one valid scene for quality review.');
  const total=targets.length*2;let completed=0;
  const emit=async(event)=>onProgress?.({...event,completed,total,percent:Math.round(completed/total*100)});
  for(const scene of targets){
    abortIfNeeded(signal);await emit({stage:'visual-qa',sceneId:scene.id,message:`Inspecting frame ${scene.index+1}`});
    scene.quality ||= {};scene.quality.visual=await visualQuality(scene,project,cfg,signal);completed++;saveProject(project,cfg);await emit({stage:'visual-qa',sceneId:scene.id,message:`Frame ${scene.index+1} checked`});
    abortIfNeeded(signal);await emit({stage:'audio-qa',sceneId:scene.id,message:`Inspecting audio ${scene.index+1}`});
    scene.quality.audio=await audioQuality(scene,project,cfg,signal);scene.quality.status=aggregate({visual:scene.quality.visual,audio:scene.quality.audio});completed++;saveProject(project,cfg);await emit({stage:'audio-qa',sceneId:scene.id,message:`Audio ${scene.index+1} checked`});
  }
  const statuses=project.scenes.map((scene)=>scene.quality?.status||'unchecked');
  project.quality={status:statuses.includes('fail')?'fail':statuses.includes('warn')?'warn':statuses.every((item)=>item==='pass')?'pass':'unchecked',checkedAt:nowIso(),checkedScenes:project.scenes.filter((scene)=>scene.quality?.checkedAt||scene.quality?.visual||scene.quality?.audio).length};
  saveProject(project,cfg);return {project:loadProject(projectId,cfg)};
}

export async function runRepairActions(projectId,{actions=[],signal=null,onProgress=null}={}) {
  const valid=actions.filter((item)=>item&&['voice','visual'].includes(item.stage)&&typeof item.sceneId==='string');
  if(!valid.length)throw new Error('The repair plan has no runnable actions.');
  let completed=0;const total=valid.length;
  for(const action of valid){
    abortIfNeeded(signal);
    await onProgress?.({stage:`repair-${action.stage}`,sceneId:action.sceneId,message:`Repairing ${action.stage} for ${action.sceneId}`,completed,total,percent:Math.round(completed/total*100)});
    await runPipeline(projectId,{sceneId:action.sceneId,stage:action.stage,force:true,signal});
    completed++;
    await onProgress?.({stage:`repair-${action.stage}`,sceneId:action.sceneId,message:`${action.sceneId} repair ready for review`,completed,total,percent:Math.round(completed/total*100)});
  }
  return {project:loadProject(projectId,config())};
}
