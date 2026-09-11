import test from 'node:test';
import assert from 'node:assert/strict';
import { rendererInputError } from '../apps/web/src/renderer-input.mjs';

test('scene update API validation rejects unsupported renderer names cleanly',()=>{
  assert.equal(rendererInputError({renderer:'banana'}),'Unsupported video renderer.');
  assert.equal(rendererInputError({renderer:'simple'}),null);
  assert.equal(rendererInputError({renderer:'whiteboard'}),null);
  assert.equal(rendererInputError({renderer:'cinematic-broll'}),null);
  assert.equal(rendererInputError({text:'unchanged renderer'}),null);
});
