import fs from 'node:fs';
import path from 'node:path';
import { run } from '../../core/src/process.mjs';
import { ensureDir, sleep } from '../../core/src/utils.mjs';

function vivibeConfig(cfg) {
  if (!cfg.vivibeApiKey) throw new Error('VIVIBE_API_KEY is required for the Vivibe voice provider');
  if (!cfg.vivibeVoiceId) throw new Error('VIVIBE_VOICE_ID is required for the Vivibe voice provider');
  return cfg;
}

const creditErrorPattern=/\b(credit|credits|quota|balance|insufficient|payment|funds|billing|usage limit|limit reached)\b/i;
const detailText=(value)=>typeof value==='string'?value:JSON.stringify(value||{});
const vivibeError=(method,status,detail)=>creditErrorPattern.test(detailText(detail))
  ? new Error(`Vivibe ${method} báo tài khoản đã hết credit hoặc chạm hạn mức sử dụng. Hãy kiểm tra số dư Vivibe rồi thử lại.`)
  : new Error(`Vivibe ${method} failed${status?` (${status})`:''}: ${detailText(detail).slice(0,1200)}`);

async function vivibeRpc(cfg, method, input, fetchImpl=fetch,signal=null) {
  if (!cfg.vivibeApiKey) throw new Error('VIVIBE_API_KEY is required for Vivibe API requests');
  const response=await fetchImpl(cfg.vivibeBaseUrl,{
    method:'POST',
    headers:{Authorization:`Bearer ${cfg.vivibeApiKey}`,'Content-Type':'application/json'},
    body:JSON.stringify({method,input}),signal
  });
  const body=await response.text();
  let data;
  try { data=body?JSON.parse(body):{}; } catch { throw new Error(`Vivibe ${method} returned invalid JSON (${response.status})`); }
  if(!response.ok)throw vivibeError(method,response.status,body);
  if(data?.error)throw vivibeError(method,null,data.error);
  if(!data?.result)throw new Error(`Vivibe ${method} returned no result`);
  return data.result;
}

export async function listVivibeVoices(cfg,{limit=100,page=1,fetchImpl=fetch,signal=null}={}) {
  const result=await vivibeRpc(cfg,'getUserVoices',{limit,page},fetchImpl,signal);
  return {items:Array.isArray(result.items)?result.items:[],total:Number(result.total||0)};
}

async function completedAudioUrl(text,cfg,{fetchImpl=fetch,sleepImpl=sleep,signal=null}={}) {
  vivibeConfig(cfg);
  const created=await vivibeRpc(cfg,'ttsLongText',{text,userVoiceId:cfg.vivibeVoiceId,speed:cfg.vivibeSpeed},fetchImpl,signal);
  const exportId=created.projectExportId;
  if(!exportId)throw new Error('Vivibe ttsLongText returned no projectExportId');
  const deadline=Date.now()+cfg.vivibeTimeoutMs;
  while(Date.now()<=deadline){
    if(signal?.aborted)throw Object.assign(new Error('Operation cancelled'),{name:'AbortError'});
    const status=await vivibeRpc(cfg,'getExportStatus',{projectExportId:exportId},fetchImpl,signal);
    if(status.state==='completed'){
      if(!status.url)throw new Error('Vivibe export completed without an audio URL');
      const url=new URL(status.url);
      if(!['http:','https:'].includes(url.protocol)||url.username||url.password)throw new Error('Vivibe returned an unsafe audio URL');
      return url.href;
    }
    if(status.state==='failed')throw vivibeError('voice export',null,status.message||status.error||status);
    // Vivibe reports `waiting` while an export is queued before processing starts.
    if(!['waiting','pending','processing','active'].includes(status.state))throw new Error(`Vivibe returned an unknown export state: ${status.state||'missing'}`);
    await sleepImpl(cfg.vivibePollIntervalMs);
  }
  throw new Error(`Vivibe voice export vẫn đang chờ sau ${cfg.vivibeTimeoutMs}ms. Hãy kiểm tra trạng thái job và số dư credit Vivibe rồi thử lại.`);
}

export async function synthesizeSpeechVivibe(text,outputFile,cfg,{fetchImpl=fetch,sleepImpl=sleep,runImpl=run,signal=null}={}) {
  ensureDir(path.dirname(outputFile));
  const audioUrl=await completedAudioUrl(text,cfg,{fetchImpl,sleepImpl,signal});
  const response=await fetchImpl(audioUrl,{signal});
  if(!response.ok)throw new Error(`Vivibe audio download failed (${response.status})`);
  const sourceFile=`${outputFile}.vivibe-source-${process.pid}`;
  try {
    fs.writeFileSync(sourceFile,Buffer.from(await response.arrayBuffer()));
    await runImpl(cfg.ffmpegBin,['-y','-i',sourceFile,'-vn','-c:a','libmp3lame','-b:a','192k',outputFile],{capture:true,signal});
  } finally {
    fs.rmSync(sourceFile,{force:true});
  }
  return outputFile;
}
