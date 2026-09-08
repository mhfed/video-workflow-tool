import fs from 'node:fs';
import path from 'node:path';
import { config } from '../packages/core/src/env.mjs';
import { assertConfig } from '../packages/core/src/validate-config.mjs';
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
const validation=assertConfig(cfg);
for(const warning of validation.warnings)console.warn(`WARN: ${warning}`);
ensureDir(cfg.workspaceDir);
for (const bin of [cfg.ffmpegBin, cfg.ffprobeBin]) {
  if (!await commandExists(bin)) throw new Error(`${bin} is required and was not found in PATH`);
}
if (cfg.renderer === 'whiteboard') {
  try { await run('git', ['--version'], { capture: true }); } catch { throw new Error('git is required for WHITEBOARD_AUTO_INSTALL=1'); }
  if(cfg.whiteboardPython){if(!fs.existsSync(cfg.whiteboardPython))throw new Error(`WHITEBOARD_PYTHON does not exist: ${cfg.whiteboardPython}`);}
  else { try { await run(cfg.pythonBin, ['--version'], { capture: true }); } catch { throw new Error(`${cfg.pythonBin} is required for whiteboard rendering`); } }
  await ensureWhiteboardEngine(cfg);
}
console.log('Setup complete.');
console.log(`Workspace: ${cfg.workspaceDir}`);
console.log(`Renderer: ${cfg.renderer}`);
console.log(`Text provider: ${cfg.textProvider}`);
console.log(`Image provider: ${cfg.imageProvider}`);
console.log(`Voice provider: ${cfg.voiceProvider}`);
console.log(`Mock mode: ${cfg.mockMode}`);
console.log('Next: npm run doctor');
