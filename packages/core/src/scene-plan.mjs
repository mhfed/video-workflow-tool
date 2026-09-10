import { parseSrt } from './srt.mjs';

const words = (s) => String(s).trim().split(/\s+/).filter(Boolean).length;
export const estimateDurationSec = (text, wpm = 150) => Math.max(2, words(text) / (wpm / 60));

function sentenceUnits(text) {
  const paragraphs = text.replace(/\r/g,'').split(/\n\s*\n/).map((x)=>x.trim()).filter(Boolean);
  const result = [];
  for (const p of paragraphs) {
    const pieces = p.match(/[^.!?。！？]+[.!?。！？]?/g) || [p];
    for (const x of pieces.map((v)=>v.trim()).filter(Boolean)) result.push(x);
  }
  return result;
}

export function visualPromptFor(text, cfg={}, visualIntent=text) {
  const frame=cfg.format==='short'?'9:16 vertical':'16:9 landscape';
  const intent=String(visualIntent||text).trim();
  const memory=cfg.memory||{};
  const continuity=[memory.artDirection&&`Art direction: ${memory.artDirection}`,memory.characters?.length&&`Recurring characters: ${memory.characters.join('; ')}`,memory.palette?.length&&`Palette: ${memory.palette.join(', ')}`].filter(Boolean).join('. ');
  return `Create one clean ${frame} whiteboard-style illustration. Narration context: ${JSON.stringify(text)}. Creative intent: ${JSON.stringify(intent)}.${continuity?` Project continuity: ${continuity}.`:''} Keep every important subject fully visible inside the central 76% safe area, leaving at least 12% empty margin on every edge. Nothing may touch or continue beyond the canvas boundary. Warm light beige paper background, dark hand-drawn ink lines, sparse red/orange/blue accents, strong visual hierarchy, generous whitespace, no captions, no labels, no readable text, no photorealism, no 3D.`;
}

function narrativeRole(text,index,total) {
  const value=String(text).toLowerCase();
  if(index===0||/[?？]$/.test(value))return 'hook';
  if(/\b(ví dụ|chẳng hạn|for example|imagine|hãy tưởng tượng)\b/.test(value))return 'example';
  if(/\b(nhưng|tuy nhiên|trái lại|but|however|instead|yet)\b/.test(value))return 'turn';
  if(index===total-1||/\b(cuối cùng|tóm lại|vì vậy|therefore|finally|in short)\b/.test(value))return 'resolution';
  return 'explanation';
}

export function planSemanticScenes(text,cfg) {
  const units=sentenceUnits(text),scenes=[];let bucket=[],sec=0,role=null;
  const flush=()=>{
    if(!bucket.length)return;
    const sceneText=bucket.map((item)=>item.text).join(' ').trim();
    const visualIntent=bucket.length===1?bucket[0].text:`${bucket[0].text} → ${bucket.at(-1).text}`;
    const durationSec=Math.min(cfg.sceneMaxSec,Math.max(cfg.sceneMinSec,estimateDurationSec(sceneText,cfg.wordsPerMinute)));
    scenes.push({text:sceneText,visualIntent,narrativeRole:role,durationMs:Math.round(durationSec*1000),visualPrompt:visualPromptFor(sceneText,cfg,visualIntent)});
    bucket=[];sec=0;role=null;
  };
  units.forEach((unit,index)=>{
    const nextRole=narrativeRole(unit,index,units.length),unitSec=estimateDurationSec(unit,cfg.wordsPerMinute);
    const startsBeat=bucket.length&&nextRole!==role&&nextRole!=='explanation';
    if(startsBeat||bucket.length&&sec>=cfg.sceneMinSec&&sec+unitSec>cfg.sceneTargetSec)flush();
    role ||= nextRole;bucket.push({text:unit,role:nextRole});sec+=unitSec;
    if(sec>=cfg.sceneMaxSec)flush();
  });
  flush();return scenes;
}

export function planScriptScenes(text, cfg) {
  return planSemanticScenes(text,cfg);
}

export function planSrtScenes(text, cfg) {
  const cues = parseSrt(text), scenes = []; let bucket = [];
  const flush = () => {
    if (!bucket.length) return;
    const startMs = bucket[0].startMs, endMs = bucket.at(-1).endMs, sceneText = bucket.map((c)=>c.text).join(' ').trim();
    scenes.push({ text: sceneText, visualIntent: sceneText, durationMs: endMs - startMs, sourceStartMs: startMs, sourceEndMs: endMs, visualPrompt: visualPromptFor(sceneText,cfg,sceneText) });
    bucket = [];
  };
  for (const cue of cues) { bucket.push(cue); const durationSec = (bucket.at(-1).endMs - bucket[0].startMs) / 1000; if (durationSec >= cfg.sceneTargetSec || durationSec >= cfg.sceneMaxSec) flush(); }
  flush(); return scenes;
}
