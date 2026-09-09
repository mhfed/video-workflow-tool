import test from 'node:test';
import assert from 'node:assert/strict';
import { parseByteRange, mediaTypeFor } from '../apps/web/src/media.mjs';

test('parses explicit and open-ended byte ranges',()=>{
  assert.deepEqual(parseByteRange('bytes=0-99',1000),{start:0,end:99,length:100});
  assert.deepEqual(parseByteRange('bytes=900-',1000),{start:900,end:999,length:100});
});

test('parses suffix ranges and rejects invalid ranges',()=>{
  assert.deepEqual(parseByteRange('bytes=-100',1000),{start:900,end:999,length:100});
  assert.equal(parseByteRange('bytes=1000-',1000),null);
  assert.equal(parseByteRange('bytes=200-100',1000),null);
});

test('maps review artifact media types',()=>{
  assert.equal(mediaTypeFor('visual'),'image/png');
  assert.equal(mediaTypeFor('voice'),'audio/mpeg');
  assert.equal(mediaTypeFor('clip'),'video/mp4');
  assert.equal(mediaTypeFor('captions'),'text/vtt; charset=utf-8');
});
