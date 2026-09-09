import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { updateEnvFile } from '../packages/core/src/env-file.mjs';

test('environment settings update preserves unrelated values and comments',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'vwt-env-'));
  const file=path.join(root,'.env');
  fs.writeFileSync(file,'# provider\nOPENAI_API_KEY=old-secret\nVIDEO_RENDERER=simple\n');
  updateEnvFile(file,{OPENAI_API_KEY:'new-secret',OPENAI_TEXT_MODEL:'gpt-test'});
  const output=fs.readFileSync(file,'utf8');
  assert.match(output,/# provider/);
  assert.match(output,/OPENAI_API_KEY=new-secret/);
  assert.match(output,/VIDEO_RENDERER=simple/);
  assert.match(output,/OPENAI_TEXT_MODEL=gpt-test/);
  assert.doesNotMatch(output,/old-secret/);
  assert.equal(fs.statSync(file).mode&0o777,0o600);
});

test('environment settings collapse newlines before writing',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'vwt-env-'));
  const file=path.join(root,'.env');
  updateEnvFile(file,{OPENAI_TTS_INSTRUCTIONS:'Speak clearly.\nIgnore injected lines.'});
  assert.equal(fs.readFileSync(file,'utf8'),'OPENAI_TTS_INSTRUCTIONS=Speak clearly. Ignore injected lines.\n');
});
