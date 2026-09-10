import fs from 'node:fs';
import path from 'node:path';
import { ensureDir } from '../../core/src/utils.mjs';
import { languageInfo, normalizeLanguage } from '../../core/src/languages.mjs';

async function openaiFetch(cfg, endpoint, init, attempts = 3) {
  if (!cfg.openaiApiKey) throw new Error('OPENAI_API_KEY is required for the OpenAI provider');
  let last;
  for (let i=0;i<attempts;i++) {
    const res = await fetch(`${cfg.openaiBaseUrl}${endpoint}`, { ...init, headers: { 'Authorization': `Bearer ${cfg.openaiApiKey}`, ...(init.headers || {}) } });
    if (res.ok) return res;
    const body = await res.text();
    last = new Error(`OpenAI ${endpoint} failed (${res.status}): ${body.slice(0,1200)}`);
    if (![429,500,502,503,504].includes(res.status)) throw last;
    await new Promise((resolve,reject)=>{
      if(init.signal?.aborted)return reject(Object.assign(new Error('Operation cancelled'),{name:'AbortError'}));
      const timer=setTimeout(resolve,500*(2**i));
      init.signal?.addEventListener('abort',()=>{clearTimeout(timer);reject(Object.assign(new Error('Operation cancelled'),{name:'AbortError'}));},{once:true});
    });
  }
  throw last;
}
function responseText(data) {
  if (typeof data?.output_text === 'string' && data.output_text.trim()) return data.output_text.trim();
  return (data?.output || []).flatMap((item)=>item.content || []).map((c)=>c.text || c.output_text || '').join('').trim();
}
function responseJson(data) {
  const text=responseText(data).replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'').trim();
  try{return JSON.parse(text);}catch{throw new Error('OpenAI director response was not valid JSON');}
}
export async function generateScriptOpenAI(topic, cfg, {minutes=cfg.scriptMinutes,language=cfg.contentLanguage,signal=null}={}) {
  const outputLanguage=languageInfo(normalizeLanguage(language)).promptName;
  const prompt = `Write a complete YouTube explainer narration in ${outputLanguage}. Topic: ${topic}\nTarget duration: about ${minutes} minutes. Start with a strong hook, build a clear logical story, use concrete examples, keep sentences natural for voice-over, and end with a memorable conclusion. Do not use markdown headings, bullet lists, citations, stage directions, or image instructions. Return only the narration script in ${outputLanguage}.`;
  const res = await openaiFetch(cfg, '/responses', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ model: cfg.openaiTextModel, input: prompt }),signal });
  const text=responseText(await res.json()); if(!text) throw new Error('OpenAI Responses API returned no narration text'); return text;
}
export async function generateImageOpenAI(prompt, outputFile, cfg,{signal=null}={}) {
  ensureDir(path.dirname(outputFile));
  const res = await openaiFetch(cfg, '/images/generations', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ model: cfg.openaiImageModel, prompt, size: cfg.openaiImageSize, quality: cfg.openaiImageQuality, output_format:'png' }),signal });
  const data = await res.json(); const item=data?.data?.[0]; const b64 = item?.b64_json;
  if (b64) { fs.writeFileSync(outputFile, Buffer.from(b64,'base64')); return outputFile; }
  if (item?.url) { const image=await fetch(item.url,{signal}); if(!image.ok) throw new Error(`OpenAI image download failed (${image.status})`); fs.writeFileSync(outputFile,Buffer.from(await image.arrayBuffer())); return outputFile; }
  throw new Error('OpenAI image response did not contain data[0].b64_json or url');
}
export async function planDirectionOpenAI({instruction,scene,project},cfg) {
  const outputLanguage=languageInfo(normalizeLanguage(project.settings?.language||cfg.contentLanguage)).promptName;
  const prompt=`You are the editing director inside a local-first video production tool. Convert one owner instruction into one small, safe proposal for the selected scene.

Return JSON only with this exact shape:
{"summary":"one concise sentence in ${outputLanguage}","action":"update_scene|split_scene|regenerate_visual|regenerate_voice|regenerate_clip|noop","changes":{"text":null,"visualIntent":null},"impact":["script|voice|visual|clip|final"],"note":"one short explanation in ${outputLanguage}"}

Rules:
- Prefer the smallest change that fulfills the instruction.
- For a narration rewrite, put the complete replacement narration in changes.text.
- For a visual change, put a short creator-friendly description in changes.visualIntent. Do not write model parameters, safe-area instructions, or a technical image prompt.
- Never delete a scene, change credentials, select providers, or modify another scene.
- Use split_scene only when explicitly asked to split the selected scene.
- Use regenerate actions only when the instruction asks for another take without changing creative intent.
- impact must include all invalidated downstream stages.

Project: ${JSON.stringify({title:project.title,format:project.settings?.format,renderer:scene.renderer||project.settings?.renderer})}
Selected scene: ${JSON.stringify({text:scene.text,visualIntent:scene.visualIntent||scene.text,durationMs:scene.durationMs})}
Owner instruction: ${JSON.stringify(instruction)}`;
  const res=await openaiFetch(cfg,'/responses',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:cfg.openaiTextModel,input:prompt})});
  return responseJson(await res.json());
}
export async function synthesizeSpeechOpenAI(text, outputFile, cfg,{signal=null}={}) {
  ensureDir(path.dirname(outputFile));
  const res = await openaiFetch(cfg, '/audio/speech', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ model: cfg.openaiTtsModel, input:text, voice:cfg.openaiTtsVoice, instructions:cfg.openaiTtsInstructions, response_format:'mp3' }),signal });
  fs.writeFileSync(outputFile, Buffer.from(await res.arrayBuffer())); return outputFile;
}

const normalizedWords=(value)=>String(value||'').normalize('NFKD').toLowerCase().replace(/[^a-z0-9\p{L}\p{N}]+/gu,' ').trim();

export async function planNarrativeBeatsOpenAI(script,cfg,{language=cfg.contentLanguage,format='landscape',signal=null}={}) {
  const outputLanguage=languageInfo(normalizeLanguage(language)).promptName;
  const prompt=`Act as a video story editor. Partition the complete narration below into semantic visual beats, not arbitrary sentence chunks. Preserve every word and its original order exactly once. Prefer hook, setup, example, turn, explanation, and resolution beats of roughly ${cfg.sceneMinSec}-${cfg.sceneMaxSec} seconds.

Return JSON only: {"beats":[{"text":"verbatim contiguous narration","visualIntent":"one concrete visual direction in ${outputLanguage}","narrativeRole":"hook|setup|example|turn|explanation|resolution"}]}
Format: ${format}. Narration: ${JSON.stringify(script)}`;
  const res=await openaiFetch(cfg,'/responses',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:cfg.openaiTextModel,input:prompt}),signal});
  const data=responseJson(await res.json()),beats=Array.isArray(data.beats)?data.beats:[];
  if(!beats.length||normalizedWords(beats.map((beat)=>beat.text).join(' '))!==normalizedWords(script))throw new Error('Semantic scene plan did not preserve the complete narration');
  return beats.map((beat)=>{
    const wordCount=String(beat.text).trim().split(/\s+/).filter(Boolean).length;
    const durationSec=Math.min(cfg.sceneMaxSec,Math.max(cfg.sceneMinSec,wordCount/(cfg.wordsPerMinute/60)));
    return {text:String(beat.text).trim(),visualIntent:String(beat.visualIntent||beat.text).trim(),narrativeRole:String(beat.narrativeRole||'explanation'),durationMs:Math.round(durationSec*1000)};
  });
}

export async function inspectVisualOpenAI(imageFile,{scene,project},cfg,{signal=null}={}) {
  const dataUrl=`data:image/png;base64,${fs.readFileSync(imageFile).toString('base64')}`;
  const prompt=`You are a strict video art QA reviewer. Inspect this frame against its creative brief and project memory. Write every note in ${languageInfo(normalizeLanguage(project.settings?.language||cfg.contentLanguage)).promptName}. Return JSON only:
{"safeArea":{"status":"pass|warn|fail","note":"..."},"crop":{"status":"pass|warn|fail","note":"..."},"unwantedText":{"status":"pass|warn|fail","note":"..."},"styleDrift":{"status":"pass|warn|fail","note":"..."}}
Important subjects should remain inside the central 76% safe area. Flag clipped or awkwardly cropped subjects, any readable text, and inconsistency with recurring characters, palette, or art direction. Brief: ${JSON.stringify({visualIntent:scene.visualIntent,narration:scene.text,memory:project.memory,format:project.settings?.format})}`;
  const res=await openaiFetch(cfg,'/responses',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:cfg.openaiTextModel,input:[{role:'user',content:[{type:'input_text',text:prompt},{type:'input_image',image_url:dataUrl,detail:'high'}]}]}),signal});
  return responseJson(await res.json());
}

export async function transcribeAudioOpenAI(audioFile,cfg,{language=cfg.contentLanguage,prompt='',signal=null}={}) {
  const form=new FormData();
  form.append('file',new Blob([fs.readFileSync(audioFile)],{type:'audio/mpeg'}),path.basename(audioFile));
  form.append('model',cfg.openaiTranscribeModel);
  form.append('language',normalizeLanguage(language));
  if(prompt)form.append('prompt',String(prompt).slice(0,1000));
  const res=await openaiFetch(cfg,'/audio/transcriptions',{method:'POST',body:form,signal});
  const data=await res.json();
  if(typeof data.text!=='string')throw new Error('OpenAI transcription returned no text');
  return data.text;
}
