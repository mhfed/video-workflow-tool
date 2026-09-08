import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { generateImageOpenAI, synthesizeSpeechOpenAI } from '../packages/providers/src/openai.mjs';

const cfg = {
  openaiApiKey: 'test-key',
  openaiBaseUrl: 'https://api.openai.com/v1',
  openaiImageModel: 'gpt-image-2',
  openaiImageSize: '2048x1152',
  openaiImageQuality: 'medium',
  openaiTtsModel: 'gpt-4o-mini-tts',
  openaiTtsVoice: 'marin',
  openaiTtsInstructions: 'Narrate naturally.'
};

test('OpenAI image provider sends configured image request and decodes base64', async () => {
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
    assert.equal(request.body.size, '2048x1152');
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
