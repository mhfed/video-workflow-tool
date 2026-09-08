import fs from 'node:fs';
import path from 'node:path';
import { config } from '../packages/core/src/env.mjs';
import { ensureDir } from '../packages/core/src/utils.mjs';
import { commandExists, run } from '../packages/core/src/process.mjs';
import { ensureWhiteboardEngine } from '../packages/renderers/src/whiteboard.mjs';

const envPath = path.resolve('.env');
const examplePath = path.resolve('.env.example');
if (!fs.existsSync(envPath) && fs.existsSync(examplePath)) {
  fs.copyFileSync(examplePath, envPath);
  console.log('Created .env from .env.example. Review OPENAI_API_KEY and settings before a real run.');
}

const cfg = config();
ensureDir(cfg.workspaceDir);

for (const bin of [cfg.ffmpegBin, cfg.ffprobeBin]) {
  if (!await commandExists(bin)) throw new Error(`${bin} is required and was not found in PATH`);
}

if (!cfg.mockMode && (cfg.imageProvider === 'openai' || cfg.voiceProvider === 'openai') && !cfg.openaiApiKey) {
  throw new Error('OPENAI_API_KEY is empty. Add it to .env, or set MOCK_MODE=1 for a zero-cost smoke run.');
}

if (cfg.renderer === 'whiteboard') {
  try { await run('git', ['--version'], { capture: true }); } catch { throw new Error('git is required for WHITEBOARD_AUTO_INSTALL=1'); }
  try { await run(cfg.pythonBin, ['--version'], { capture: true }); } catch { throw new Error(`${cfg.pythonBin} is required for whiteboard rendering`); }
  await ensureWhiteboardEngine(cfg);
}

console.log('Setup complete.');
console.log(`Workspace: ${cfg.workspaceDir}`);
console.log(`Renderer: ${cfg.renderer}`);
console.log(`Image provider: ${cfg.imageProvider}`);
console.log(`Voice provider: ${cfg.voiceProvider}`);
console.log(`Mock mode: ${cfg.mockMode}`);
