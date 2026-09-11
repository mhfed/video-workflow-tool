import test from 'node:test';
import assert from 'node:assert/strict';
import { validateConfig } from '../packages/core/src/validate-config.mjs';

const base={uiLanguage:'vi',contentLanguage:'vi',renderer:'whiteboard',mockMode:false,textProvider:'openai',imageProvider:'openai',voiceProvider:'openai',openaiApiKey:'test',openaiImageSize:'1536x1024',scriptMinutes:6,sceneMinSec:6,sceneTargetSec:12,sceneMaxSec:18,wordsPerMinute:150,width:1920,height:1080,fps:30};

test('rejects unsupported interface or content languages',()=>{
  const result=validateConfig({...base,uiLanguage:'fr'});
  assert.equal(result.ok,false);
  assert.match(result.errors.join('\n'),/UI_LANGUAGE/);
});

test('accepts default real workflow configuration',()=>{
  const result=validateConfig(base);
  assert.equal(result.ok,true);
  assert.equal(result.errors.length,0);
});

test('accepts the cinematic B-roll renderer',()=>{
  const result=validateConfig({...base,renderer:'cinematic-broll'});
  assert.equal(result.ok,true);
});

test('requires OpenAI key for real OpenAI providers',()=>{
  const result=validateConfig({...base,openaiApiKey:''});
  assert.equal(result.ok,false);
  assert.match(result.errors.join('\n'),/OPENAI_API_KEY/);
});

test('rejects unsupported image sizes and invalid scene timing',()=>{
  const result=validateConfig({...base,openaiImageSize:'2048x1152',sceneMinSec:20,sceneTargetSec:12,sceneMaxSec:8});
  assert.equal(result.ok,false);
  assert.match(result.errors.join('\n'),/OPENAI_IMAGE_SIZE/);
  assert.match(result.errors.join('\n'),/Scene timing/);
});

test('mock mode permits missing OpenAI key',()=>{
  const result=validateConfig({...base,mockMode:true,openaiApiKey:''});
  assert.equal(result.ok,true);
});

test('accepts Vivibe as an independent voice provider',()=>{
  const result=validateConfig({...base,mockMode:false,textProvider:'mock',imageProvider:'mock',voiceProvider:'vivibe',openaiApiKey:'',vivibeApiKey:'vivibe-key',vivibeBaseUrl:'https://api.lucylab.io/json-rpc',vivibeVoiceId:'voice-1',vivibeSpeed:1,vivibePollIntervalMs:2000,vivibeTimeoutMs:120000});
  assert.equal(result.ok,true);
});

test('Vivibe voice provider requires credentials, voice, and valid speed',()=>{
  const result=validateConfig({...base,voiceProvider:'vivibe',vivibeApiKey:'',vivibeBaseUrl:'not-a-url',vivibeVoiceId:'',vivibeSpeed:3,vivibePollIntervalMs:0,vivibeTimeoutMs:0});
  assert.equal(result.ok,false);
  assert.match(result.errors.join('\n'),/VIVIBE_API_KEY/);
  assert.match(result.errors.join('\n'),/VIVIBE_VOICE_ID/);
  assert.match(result.errors.join('\n'),/VIVIBE_SPEED/);
  assert.match(result.errors.join('\n'),/VIVIBE_BASE_URL/);
});
