import test from 'node:test';
import assert from 'node:assert/strict';
import { buildWebVtt } from '../packages/core/src/captions.mjs';

test('builds readable WebVTT cues from the canonical scene timeline',()=>{
  const project={scenes:[
    {id:'scene-001',startMs:0,endMs:4000,durationMs:4000,text:'Một hành động nhỏ giúp chúng ta bắt đầu dễ dàng hơn mỗi ngày.'},
    {id:'scene-002',startMs:4000,endMs:6500,durationMs:2500,text:'Sau đó hãy tiếp tục.'}
  ]};
  const vtt=buildWebVtt(project,{maxWords:6});
  assert.match(vtt,/^WEBVTT\n\n/);
  assert.match(vtt,/00:00:00\.000 --> 00:00:01\.429/);
  assert.match(vtt,/00:00:04\.000 --> 00:00:06\.500/);
  assert.match(vtt,/Một hành động nhỏ giúp/);
  assert.match(vtt,/chúng ta bắt đầu dễ/);
  assert.match(vtt,/Sau đó hãy tiếp tục\./);
});
