import { spawn } from 'node:child_process';

export function run(bin, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, {
      cwd: opts.cwd,
      env: { ...process.env, ...(opts.env || {}) },
      stdio: opts.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit'
    });
    let stdout = '';
    let stderr = '';
    if (opts.capture) {
      child.stdout.on('data', (data) => stdout += data);
      child.stderr.on('data', (data) => stderr += data);
    }
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) return resolve({ code, stdout, stderr });
      const detail = stderr || stdout;
      const error = new Error(`${bin} exited ${code}${detail ? `: ${detail.slice(-1200)}` : ''}`);
      Object.assign(error, { code, stdout, stderr });
      reject(error);
    });
  });
}

export async function commandExists(bin) { for (const args of [['--version'],['-version']]) { try { await run(bin, args, { capture: true }); return true; } catch {} } return false; }
