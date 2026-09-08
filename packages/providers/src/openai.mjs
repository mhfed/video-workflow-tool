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

export async function generateImageOpenAI(prompt, outputFile, cfg) {
  ensureDir(path.dirname(outputFile));
  const res = await openaiFetch(cfg, '/images/generations', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ model: cfg.openaiImageModel, prompt, size: cfg.openaiImageSize, quality: cfg.openaiImageQuality, output_format:'png' }) });
  const data = await res.json(); const b64 = data?.data?.[0]?.b64_json;
  if (!b64) throw new Error('OpenAI image response did not contain data[0].b64_json');
  fs.writeFileSync(outputFile, Buffer.from(b64,'base64')); return outputFile;
}

export async function synthesizeSpeechOpenAI(text, outputFile, cfg) {
  ensureDir(path.dirname(outputFile));
  const res = await openaiFetch(cfg, '/audio/speech', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ model: cfg.openaiTtsModel, input:text, voice:cfg.openaiTtsVoice, instructions:cfg.openaiTtsInstructions, response_format:'mp3' }) });
  fs.writeFileSync(outputFile, Buffer.from(await res.arrayBuffer())); return outputFile;
}
