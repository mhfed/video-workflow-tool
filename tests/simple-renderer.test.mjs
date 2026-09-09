import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { probeDuration } from '../packages/core/src/media.mjs';
import { renderSimpleScene } from '../packages/renderers/src/simple.mjs';

test('simple renderer creates an image-free placeholder with minimal FFmpeg builds', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vwt-simple-'));
  const outputFile = path.join(root, 'video.mp4');
  const cfg = { ffmpegBin: 'ffmpeg', ffprobeBin: 'ffprobe', width: 320, height: 180, fps: 10 };
  await renderSimpleScene({
    scene: { text: 'A placeholder scene that does not require generated media.' },
    imageFile: null,
    outputFile,
    durationSec: 1,
    cfg
  });
  assert.ok(fs.existsSync(outputFile));
  assert.ok(fs.statSync(outputFile).size > 0);
  assert.ok(await probeDuration(outputFile, cfg) >= 0.9);
});
