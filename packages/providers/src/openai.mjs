import fs from 'node:fs';
import path from 'node:path';
import { ensureDir, sleep } from '../../core/src/utils.mjs';

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
export async function generateScriptOpenAI(topic, cfg, {minutes=cfg.scriptMinutes}={}) {
  const prompt = `Write a complete YouTube explainer narration in the same language as the topic. Topic: ${topic}\nTarget duration: about ${minutes} minutes. Start with a strong hook, build a clear logical story, use concrete examples, keep sentences natural for voice-over, and end with a memorable conclusion. Do not use markdown headings, bullet lists, citations, stage directions, or image instructions. Return only the narration script.`;
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
export async function synthesizeSpeechOpenAI(text, outputFile, cfg) {
  ensureDir(path.dirname(outputFile));
  const res = await openaiFetch(cfg, '/audio/speech', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ model: cfg.openaiTtsModel, input:text, voice:cfg.openaiTtsVoice, instructions:cfg.openaiTtsInstructions, response_format:'mp3' }) });
  fs.writeFileSync(outputFile, Buffer.from(await res.arrayBuffer())); return outputFile;
}
