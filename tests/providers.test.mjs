import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { generateScriptOpenAI, generateImageOpenAI, synthesizeSpeechOpenAI } from '../packages/providers/src/openai.mjs';
import { listVivibeVoices, synthesizeSpeechVivibe } from '../packages/providers/src/vivibe.mjs';

const cfg = {
  openaiApiKey: 'test-key',
  openaiBaseUrl: 'https://api.openai.com/v1',
  openaiTextModel: 'gpt-5.6-luna',
  scriptMinutes: 6,
  openaiImageModel: 'gpt-image-2',
  openaiImageSize: '1536x1024',
  openaiImageQuality: 'medium',
  openaiTtsModel: 'gpt-4o-mini-tts',
  openaiTtsVoice: 'marin',
  openaiTtsInstructions: 'Narrate naturally.'
};

test('OpenAI script provider uses Responses API and returns narration text', async () => {
  const oldFetch = globalThis.fetch;
  let request;
  globalThis.fetch = async (url, init) => {
    request = { url, init, body: JSON.parse(init.body) };
    return new Response(JSON.stringify({ output_text: 'A complete narration.' }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  try {
    const text = await generateScriptOpenAI('Why habits work', cfg, { minutes: 4 });
    assert.equal(text, 'A complete narration.');
    assert.equal(request.url, 'https://api.openai.com/v1/responses');
    assert.equal(request.body.model, 'gpt-5.6-luna');
    assert.match(request.body.input, /4 minutes/);
  } finally { globalThis.fetch = oldFetch; }
});

test('OpenAI image provider sends supported landscape request and decodes base64', async () => {
  const oldFetch = globalThis.fetch;
  let request;
  globalThis.fetch = async (url, init) => {
    request = { url, init, body: JSON.parse(init.body) };
    return new Response(JSON.stringify({ data: [{ b64_json: Buffer.from('png-bytes').toString('base64') }] }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  try {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vwt-provider-'));
    const out = path.join(dir, 'visual.png');
    await generateImageOpenAI('draw a brain', out, cfg);
    assert.equal(request.url, 'https://api.openai.com/v1/images/generations');
    assert.equal(request.body.model, 'gpt-image-2');
    assert.equal(request.body.size, '1536x1024');
    assert.equal(request.body.output_format, 'png');
    assert.equal(fs.readFileSync(out, 'utf8'), 'png-bytes');
  } finally { globalThis.fetch = oldFetch; }
});

test('OpenAI speech provider sends configured TTS request and writes audio bytes', async () => {
  const oldFetch = globalThis.fetch;
  let request;
  globalThis.fetch = async (url, init) => {
    request = { url, init, body: JSON.parse(init.body) };
    return new Response(Buffer.from('mp3-bytes'), { status: 200, headers: { 'content-type': 'audio/mpeg' } });
  };
  try {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vwt-provider-'));
    const out = path.join(dir, 'voice.mp3');
    await synthesizeSpeechOpenAI('Hello world', out, cfg);
    assert.equal(request.url, 'https://api.openai.com/v1/audio/speech');
    assert.equal(request.body.model, 'gpt-4o-mini-tts');
    assert.equal(request.body.voice, 'marin');
    assert.equal(request.body.response_format, 'mp3');
    assert.equal(fs.readFileSync(out, 'utf8'), 'mp3-bytes');
  } finally { globalThis.fetch = oldFetch; }
});

test('Vivibe lists active user voices through JSON-RPC',async()=>{
  let request;
  const fetchImpl=async(url,init)=>{
    request={url,headers:init.headers,body:JSON.parse(init.body)};
    return new Response(JSON.stringify({result:{items:[{id:'voice-1',name:'Vietnamese voice',isActive:true}],total:1}}),{status:200});
  };
  const result=await listVivibeVoices({vivibeApiKey:'vivibe-key',vivibeBaseUrl:'https://api.lucylab.io/json-rpc'},{fetchImpl});
  assert.equal(request.url,'https://api.lucylab.io/json-rpc');
  assert.equal(request.headers.Authorization,'Bearer vivibe-key');
  assert.deepEqual(request.body,{method:'getUserVoices',input:{limit:100,page:1}});
  assert.equal(result.items[0].id,'voice-1');
});

test('Vivibe creates, polls, downloads, and normalizes narration audio',async()=>{
  const requests=[];
  let statusCalls=0;
  const fetchImpl=async(url,init={})=>{
    if(url==='https://cdn.example.test/voice.wav')return new Response(Buffer.from('source-audio'),{status:200});
    const body=JSON.parse(init.body);requests.push(body);
    if(body.method==='ttsLongText')return new Response(JSON.stringify({result:{projectExportId:'export-1'}}),{status:200});
    statusCalls++;
    return new Response(JSON.stringify({result:statusCalls===1?{state:'processing'}:{state:'completed',url:'https://cdn.example.test/voice.wav'}}),{status:200});
  };
  const waits=[];
  const runImpl=async(bin,args)=>{
    assert.equal(bin,'ffmpeg-test');
    assert.equal(fs.readFileSync(args[2],'utf8'),'source-audio');
    fs.writeFileSync(args.at(-1),'normalized-mp3');
  };
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'vwt-vivibe-'));
  const output=path.join(dir,'voice.mp3');
  await synthesizeSpeechVivibe('Xin chào',output,{vivibeApiKey:'vivibe-key',vivibeBaseUrl:'https://api.lucylab.io/json-rpc',vivibeVoiceId:'voice-1',vivibeSpeed:1.2,vivibePollIntervalMs:2000,vivibeTimeoutMs:30000,ffmpegBin:'ffmpeg-test'},{fetchImpl,sleepImpl:async(ms)=>waits.push(ms),runImpl});
  assert.deepEqual(requests[0],{method:'ttsLongText',input:{text:'Xin chào',userVoiceId:'voice-1',speed:1.2}});
  assert.deepEqual(requests[1],{method:'getExportStatus',input:{projectExportId:'export-1'}});
  assert.equal(requests.length,3);
  assert.deepEqual(waits,[2000]);
  assert.equal(fs.readFileSync(output,'utf8'),'normalized-mp3');
  assert.equal(fs.readdirSync(dir).some((name)=>name.includes('vivibe-source')),false);
});
