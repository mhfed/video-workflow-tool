import fs from 'node:fs';
import path from 'node:path';
import { config } from '../packages/core/src/env.mjs';
import { ensureDir } from '../packages/core/src/utils.mjs';
import { commandExists } from '../packages/core/src/process.mjs';
import { ensureWhiteboardEngine } from '../packages/renderers/src/whiteboard.mjs';

const cfg = config();
ensureDir(cfg.workspaceDir);
for (const bin of [cfg.ffmpegBin, cfg.ffprobeBin]) {
  if (!await commandExists(bin)) throw new Error(`${bin} is required and was not found in PATH`);
}
if (!fs.existsSync(path.resolve('.env')) && fs.existsSync(path.resolve('.env.example'))) {
  fs.copyFileSync('.env.example', '.env');
}
if (cfg.renderer === 'whiteboard') await ensureWhiteboardEngine(cfg);
console.log('Setup complete.');
console.log(`Workspace: ${cfg.workspaceDir}`);
console.log(`Renderer: ${cfg.renderer}`);
console.log(`Mock mode: ${cfg.mockMode}`);
