import test from 'node:test';
import assert from 'node:assert/strict';
import { validateConfig } from '../packages/core/src/validate-config.mjs';

const base={renderer:'whiteboard',mockMode:false,textProvider:'openai',imageProvider:'openai',voiceProvider:'openai',openaiApiKey:'test',openaiImageSize:'1536x1024',scriptMinutes:6,sceneMinSec:6,sceneTargetSec:12,sceneMaxSec:18,wordsPerMinute:150,width:1920,height:1080,fps:30};

test('accepts default real workflow configuration',()=>{
  const result=validateConfig(base);
  assert.equal(result.ok,true);
  assert.equal(result.errors.length,0);
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
  assert.match(result.errors.join('\n'),/SCENE_MIN_SEC/);
});

test('mock mode permits missing OpenAI key',()=>{
  const result=validateConfig({...base,mockMode:true,openaiApiKey:''});
  assert.equal(result.ok,true);
});
