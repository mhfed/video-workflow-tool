import { spawn } from 'node:child_process';
import { languageInfo, normalizeLanguage } from '../../core/src/languages.mjs';

const MAX_OUTPUT_BYTES=2*1024*1024;
const normalizedWords=(value)=>String(value||'').normalize('NFKD').toLowerCase().replace(/[^a-z0-9\p{L}\p{N}]+/gu,' ').trim();

function cleanJson(text,label='Codex response') {
  const value=String(text||'').replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'').trim();
  try{return JSON.parse(value);}catch{throw new Error(`${label} was not valid JSON`);}
}

export function parseCodexJsonl(text) {
  let final='';
  const errors=[];
  for(const line of String(text||'').split(/\r?\n/)){
    if(!line.trim())continue;
    let event;try{event=JSON.parse(line);}catch{continue;}
    if(event.type==='item.completed'&&event.item?.type==='agent_message'&&typeof event.item.text==='string')final=event.item.text;
    if(event.type==='error')errors.push(event.message||event.error?.message||'Unknown Codex error');
    if(event.type==='turn.failed')errors.push(event.error?.message||event.message||'Codex turn failed');
  }
  if(final.trim())return final.trim();
  throw new Error(errors.filter(Boolean).join('; ')||'Codex returned no final message');
}

export function runCodexPrompt(prompt,cfg,{signal=null,spawnImpl=spawn}={}) {
  if(signal?.aborted)return Promise.reject(Object.assign(new Error('Operation cancelled'),{name:'AbortError'}));
  const bin=cfg.codexBin||'codex';
  const args=['exec','--json','--color','never','--sandbox','read-only','--ephemeral','--ignore-user-config','--ignore-rules','--skip-git-repo-check'];
  if(cfg.codexModel)args.push('--model',cfg.codexModel);
  args.push('-');
  return new Promise((resolve,reject)=>{
    const child=spawnImpl(bin,args,{cwd:process.cwd(),env:process.env,stdio:['pipe','pipe','pipe']});
    let stdout='',stderr='',settled=false;
    const timeoutMs=Number(cfg.codexTimeoutMs)||300000;
    const finish=(error,value)=>{if(settled)return;settled=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);error?reject(error):resolve(value);};
    const abort=()=>{child.kill('SIGTERM');finish(Object.assign(new Error('Operation cancelled'),{name:'AbortError'}));};
    const timer=setTimeout(()=>{child.kill('SIGTERM');finish(new Error(`Codex timed out after ${Math.round(timeoutMs/1000)} seconds`));},timeoutMs);
    signal?.addEventListener('abort',abort,{once:true});
    child.on('error',(error)=>finish(new Error(error.code==='ENOENT'?`Codex CLI was not found at ${bin}. Install Codex, then connect ChatGPT in Provider settings.`:error.message)));
    child.stdout.on('data',(chunk)=>{stdout+=chunk;if(stdout.length>MAX_OUTPUT_BYTES){child.kill('SIGTERM');finish(new Error('Codex output exceeded the safe size limit'));}});
    child.stderr.on('data',(chunk)=>{stderr=(stderr+chunk).slice(-16000);});
    child.on('close',(code)=>{
      if(settled)return;
      if(code!==0)return finish(new Error(`Codex failed (${code}): ${stderr.trim().slice(-2000)||'Check ChatGPT connection in Provider settings.'}`));
      try{finish(null,parseCodexJsonl(stdout));}catch(error){finish(error);}
    });
    child.stdin.on('error',(error)=>{if(error.code!=='EPIPE')finish(error);});
    child.stdin.end(`${prompt}\n`);
  });
}

export async function generateScriptCodex(topic,cfg,{minutes=cfg.scriptMinutes,language=cfg.contentLanguage,signal=null}={}) {
  const outputLanguage=languageInfo(normalizeLanguage(language)).promptName;
  return runCodexPrompt(`You are a narration writer operating as a text-only provider. Do not inspect files, run commands, browse, or use tools. Write a complete YouTube explainer narration in ${outputLanguage}. Topic: ${topic}\nTarget duration: about ${minutes} minutes. Start with a strong hook, build a clear logical story, use concrete examples, keep sentences natural for voice-over, and end with a memorable conclusion. Do not use markdown headings, bullet lists, citations, stage directions, or image instructions. Return only the narration script in ${outputLanguage}.`,cfg,{signal});
}

export async function planNarrativeBeatsCodex(script,cfg,{language=cfg.contentLanguage,format='landscape',signal=null}={}) {
  const outputLanguage=languageInfo(normalizeLanguage(language)).promptName;
  const prompt=`You are a video story editor operating as a text-only provider. Do not inspect files, run commands, browse, or use tools. Partition the complete narration below into semantic visual beats, not arbitrary sentence chunks. Preserve every word and its original order exactly once. Prefer hook, setup, example, turn, explanation, and resolution beats of roughly ${cfg.sceneMinSec}-${cfg.sceneMaxSec} seconds.\n\nReturn JSON only: {"beats":[{"text":"verbatim contiguous narration","visualIntent":"one concrete visual direction in ${outputLanguage}","narrativeRole":"hook|setup|example|turn|explanation|resolution"}]}\nFormat: ${format}. Narration: ${JSON.stringify(script)}`;
  const data=cleanJson(await runCodexPrompt(prompt,cfg,{signal}),'Codex scene plan'),beats=Array.isArray(data.beats)?data.beats:[];
  if(!beats.length||normalizedWords(beats.map((beat)=>beat.text).join(' '))!==normalizedWords(script))throw new Error('Semantic scene plan did not preserve the complete narration');
  return beats.map((beat)=>{
    const wordCount=String(beat.text).trim().split(/\s+/).filter(Boolean).length;
    const durationSec=Math.min(cfg.sceneMaxSec,Math.max(cfg.sceneMinSec,wordCount/(cfg.wordsPerMinute/60)));
    return {text:String(beat.text).trim(),visualIntent:String(beat.visualIntent||beat.text).trim(),narrativeRole:String(beat.narrativeRole||'explanation'),durationMs:Math.round(durationSec*1000)};
  });
}

export async function planDirectionCodex({instruction,scene,project},cfg,{signal=null}={}) {
  const outputLanguage=languageInfo(normalizeLanguage(project.settings?.language||cfg.contentLanguage)).promptName;
  const prompt=`You are the editing director inside a local-first video production tool. Operate as a text-only provider: do not inspect files, run commands, browse, or use tools. Convert one owner instruction into one small, safe proposal for the selected scene.\n\nReturn JSON only with this exact shape:\n{"summary":"one concise sentence in ${outputLanguage}","action":"update_scene|split_scene|regenerate_visual|regenerate_voice|regenerate_clip|noop","changes":{"text":null,"visualIntent":null},"impact":["script|voice|visual|clip|final"],"note":"one short explanation in ${outputLanguage}"}\n\nRules:\n- Prefer the smallest change that fulfills the instruction.\n- For a narration rewrite, put the complete replacement narration in changes.text.\n- For a visual change, put a short creator-friendly description in changes.visualIntent.\n- Never delete a scene, change credentials, select providers, or modify another scene.\n- Use split_scene only when explicitly asked to split the selected scene.\n- Use regenerate actions only when the instruction asks for another take without changing creative intent.\n- impact must include all invalidated downstream stages.\n\nProject: ${JSON.stringify({title:project.title,format:project.settings?.format,renderer:scene.renderer||project.settings?.renderer})}\nSelected scene: ${JSON.stringify({text:scene.text,visualIntent:scene.visualIntent||scene.text,durationMs:scene.durationMs})}\nOwner instruction: ${JSON.stringify(instruction)}`;
  return cleanJson(await runCodexPrompt(prompt,cfg,{signal}),'Codex director response');
}
