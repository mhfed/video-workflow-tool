import test from 'node:test';
import assert from 'node:assert/strict';
import { containVideoFilter } from '../packages/core/src/video-fit.mjs';

test('video fit preserves the full image and pads to the target frame',()=>{
  const filter=containVideoFilter(1920,1080);
  assert.match(filter,/force_original_aspect_ratio=decrease/);
  assert.match(filter,/pad=1920:1080:\(ow-iw\)\/2:\(oh-ih\)\/2/);
  assert.doesNotMatch(filter,/crop=/);
  assert.doesNotMatch(filter,/zoompan=/);
});

test('video fit rejects invalid target dimensions',()=>{
  assert.throws(()=>containVideoFilter(0,1080),/positive integers/);
});
