import fs from 'node:fs';
import path from 'node:path';
import { ensureDir, sleep } from '../../core/src/utils.mjs';
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
    await sleep(500 * (2 ** i));
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
export async function generateScriptOpenAI(topic, cfg, {minutes=cfg.scriptMinutes,language=cfg.contentLanguage}={}) {
  const outputLanguage=languageInfo(normalizeLanguage(language)).promptName;
  const prompt = `Write a complete YouTube explainer narration in ${outputLanguage}. Topic: ${topic}\nTarget duration: about ${minutes} minutes. Start with a strong hook, build a clear logical story, use concrete examples, keep sentences natural for voice-over, and end with a memorable conclusion. Do not use markdown headings, bullet lists, citations, stage directions, or image instructions. Return only the narration script in ${outputLanguage}.`;
  const res = await openaiFetch(cfg, '/responses', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ model: cfg.openaiTextModel, input: prompt }) });
  const text=responseText(await res.json()); if(!text) throw new Error('OpenAI Responses API returned no narration text'); return text;
}
export async function generateImageOpenAI(prompt, outputFile, cfg) {
  ensureDir(path.dirname(outputFile));
  const res = await openaiFetch(cfg, '/images/generations', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ model: cfg.openaiImageModel, prompt, size: cfg.openaiImageSize, quality: cfg.openaiImageQuality, output_format:'png' }) });
  const data = await res.json(); const item=data?.data?.[0]; const b64 = item?.b64_json;
  if (b64) { fs.writeFileSync(outputFile, Buffer.from(b64,'base64')); return outputFile; }
  if (item?.url) { const image=await fetch(item.url); if(!image.ok) throw new Error(`OpenAI image download failed (${image.status})`); fs.writeFileSync(outputFile,Buffer.from(await image.arrayBuffer())); return outputFile; }
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
export async function synthesizeSpeechOpenAI(text, outputFile, cfg) {
  ensureDir(path.dirname(outputFile));
  const res = await openaiFetch(cfg, '/audio/speech', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ model: cfg.openaiTtsModel, input:text, voice:cfg.openaiTtsVoice, instructions:cfg.openaiTtsInstructions, response_format:'mp3' }) });
  fs.writeFileSync(outputFile, Buffer.from(await res.arrayBuffer())); return outputFile;
}
