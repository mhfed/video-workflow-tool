import { spawn } from 'node:child_process';

export function run(bin, args, opts = {}) {
  return new Promise((resolve, reject) => {
    if (opts.signal?.aborted) return reject(Object.assign(new Error('Operation cancelled'), { name: 'AbortError' }));
    const child = spawn(bin, args, {
      cwd: opts.cwd,
      env: { ...process.env, ...(opts.env || {}) },
      stdio: opts.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
      detached: process.platform !== 'win32'
    });
    let stdout = '';
    let stderr = '';
    let settled = false;
    let killTimer;
    const abortError = () => Object.assign(new Error('Operation cancelled'), { name: 'AbortError' });
    const terminate = () => {
      if (child.exitCode !== null) return;
      try { process.platform === 'win32' ? child.kill('SIGTERM') : process.kill(-child.pid, 'SIGTERM'); }
      catch { try { child.kill('SIGTERM'); } catch {} }
      killTimer=setTimeout(()=>{ try { process.platform === 'win32' ? child.kill('SIGKILL') : process.kill(-child.pid, 'SIGKILL'); } catch {} },2500);
      killTimer.unref?.();
    };
    const onAbort=()=>terminate();
    opts.signal?.addEventListener('abort',onAbort,{once:true});
    if (opts.capture) {
      child.stdout.on('data', (data) => stdout += data);
      child.stderr.on('data', (data) => stderr += data);
    }
    child.on('error', (error) => {
      if(settled)return;
      settled=true;
      opts.signal?.removeEventListener('abort',onAbort);
      reject(opts.signal?.aborted?abortError():error);
    });
    child.on('close', (code) => {
      clearTimeout(killTimer);
      opts.signal?.removeEventListener('abort',onAbort);
      if(settled)return;
      settled=true;
      if(opts.signal?.aborted)return reject(abortError());
      if (code === 0) return resolve({ code, stdout, stderr });
      const detail = stderr || stdout;
      const error = new Error(`${bin} exited ${code}${detail ? `: ${detail.slice(-1200)}` : ''}`);
      Object.assign(error, { code, stdout, stderr });
      reject(error);
    });
  });
}

export async function commandExists(bin) { for (const args of [['--version'],['-version']]) { try { await run(bin, args, { capture: true }); return true; } catch {} } return false; }
