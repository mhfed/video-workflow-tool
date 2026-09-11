import test from 'node:test';
import assert from 'node:assert/strict';
import { getRenderer, isRendererName, rendererNames, resolveRendererName } from '../packages/renderers/src/registry.mjs';

test('renderer resolution prefers the canonical scene override and preserves legacy fallbacks',()=>{
  const cfg={renderer:'whiteboard'};
  const project={settings:{renderer:'simple'}};
  assert.equal(resolveRendererName({},project,cfg),'simple');
  assert.equal(resolveRendererName({renderer:'whiteboard'},project,cfg),'whiteboard');
  assert.equal(resolveRendererName({}, {settings:{}}, cfg),'whiteboard');
});

test('renderer registry rejects unsupported renderer names',()=>{
  assert.deepEqual(rendererNames,['simple','whiteboard','cinematic-broll','draw-reveal']);
  assert.equal(isRendererName('simple'),true);
  assert.equal(isRendererName('whiteboard'),true);
  assert.equal(isRendererName('cinematic-broll'),true);
  assert.equal(isRendererName('draw-reveal'),true);
  assert.equal(isRendererName('banana'),false);
  assert.throws(()=>getRenderer('banana'),/Unsupported VIDEO_RENDERER=banana/);
});
