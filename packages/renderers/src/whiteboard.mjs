import crypto from 'node:crypto'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { run } from '../../core/src/process.mjs'; import { ensureDir, writeJson } from '../../core/src/utils.mjs'; import { probeVideoSize } from '../../core/src/media.mjs';
const localizedHand=fileURLToPath(new URL('../assets/drawing-hand-vi.png',import.meta.url));
export function whiteboardScript(cfg) { return path.join(cfg.whiteboardEngineDir,'scripts','render_stream_whiteboard.py'); }
export function whiteboardHandAsset(cfg) { const upstream=path.join(cfg.whiteboardEngineDir,'assets','drawing-hand.png'); return fs.existsSync(localizedHand)?localizedHand:upstream; }
export function whiteboardHandSignature(cfg) { const hand=whiteboardHandAsset(cfg); return fs.existsSync(hand)?crypto.createHash('sha256').update(fs.readFileSync(hand)).digest('hex'):null; }
function prepareScript(cfg) { return path.join(cfg.whiteboardEngineDir,'scripts','prepare_env.py'); }
function parseEnvPython(output) { const match=String(output||'').match(/(?:^|\n)ENV_PY=(.+)\s*$/m); return match?.[1]?.trim() || ''; }

function managedVenvPython(cfg) {
  return process.platform === 'win32'
    ? path.join(cfg.whiteboardEngineDir, '.venv', 'Scripts', 'python.exe')
    : path.join(cfg.whiteboardEngineDir, '.venv', 'bin', 'python');
}

async function repairManagedVenvPip(cfg,signal=null) {
  const python = managedVenvPython(cfg);
  if (!fs.existsSync(python)) return false;
  try {
    await run(python, ['-m', 'pip', '--version'], { cwd: cfg.whiteboardEngineDir, capture: true,signal });
    return false;
  } catch {}
  try {
    await run(python, ['-m', 'ensurepip', '--upgrade'], { cwd: cfg.whiteboardEngineDir, capture: true,signal });
    await run(python, ['-m', 'pip', '--version'], { cwd: cfg.whiteboardEngineDir, capture: true,signal });
    return true;
  } catch (error) {
    throw new Error(`Whiteboard virtual environment is missing pip and could not be repaired with ensurepip: ${error.message}`, { cause: error });
  }
}

async function prepareUpstreamEnvironment(cfg,signal=null) {
  await repairManagedVenvPip(cfg,signal);
  try {
    await run(cfg.pythonBin, [prepareScript(cfg)], { cwd: cfg.whiteboardEngineDir,signal });
  } catch (error) {
    if (!await repairManagedVenvPip(cfg,signal)) throw error;
    await run(cfg.pythonBin, [prepareScript(cfg)], { cwd: cfg.whiteboardEngineDir,signal });
  }
}

function whiteboardCheckDetail(output) {
  const missing = [...String(output || '').matchAll(/\[miss\]\s*([^\r\n]+)/g)].map((match) => match[1].trim());
  if (missing.length) return `missing dependencies: ${missing.join(', ')}`;
  return 'prepare_env.py --check did not return a usable ENV_PY interpreter';
}

export async function inspectWhiteboardEnvironment(cfg,{signal=null}={}) {
  if (cfg.whiteboardPython) {
    return fs.existsSync(cfg.whiteboardPython)
      ? { ok: true, python: cfg.whiteboardPython, detail: cfg.whiteboardPython }
      : { ok: false, python: '', detail: `missing: ${cfg.whiteboardPython}` };
  }
  const prepare = prepareScript(cfg);
  if (!fs.existsSync(prepare)) return { ok: true, python: cfg.pythonBin, detail: `${cfg.pythonBin} (no prepare_env.py)` };
  try {
    const result = await run(cfg.pythonBin, [prepare, '--check'], { cwd: cfg.whiteboardEngineDir, capture: true,signal });
    const python = parseEnvPython(`${result.stdout}\n${result.stderr}`);
    if (python && fs.existsSync(python)) return { ok: true, python, detail: python };
    return { ok: false, python: '', detail: whiteboardCheckDetail(`${result.stdout}\n${result.stderr}`) };
  } catch (error) {
    return { ok: false, python: '', detail: whiteboardCheckDetail(`${error.stdout || ''}\n${error.stderr || ''}`) };
  }
}

async function checkedUpstreamPython(cfg,signal=null) {
  const inspection = await inspectWhiteboardEnvironment(cfg,{signal});
  if (inspection.ok) return inspection.python;
  const prepare=prepareScript(cfg); if (!fs.existsSync(prepare)) return cfg.pythonBin;
  if (!cfg.whiteboardAutoInstall) throw new Error('Whiteboard Python environment is not ready. Set WHITEBOARD_AUTO_INSTALL=1, run the upstream prepare_env.py, or set WHITEBOARD_PYTHON explicitly.');
  await prepareUpstreamEnvironment(cfg,signal);
  const prepared = await inspectWhiteboardEnvironment(cfg,{signal});
  if (!prepared.ok) throw new Error(`Whiteboard prepare_env.py completed but the environment is not ready: ${prepared.detail}`);
  return prepared.python;
}
export async function ensureWhiteboardEngine(cfg,{signal=null}={}) {
  if (!fs.existsSync(whiteboardScript(cfg))) {
    if (!cfg.whiteboardAutoInstall) throw new Error(`Whiteboard engine missing: ${cfg.whiteboardEngineDir}`);
    ensureDir(path.dirname(cfg.whiteboardEngineDir)); await run('git',['clone','--depth','1','https://github.com/geeklee/srt-whiteboard-animation.git',cfg.whiteboardEngineDir],{signal});
  }
  return checkedUpstreamPython(cfg,signal);
}
export async function renderWhiteboardScene({ scene, imageFile, outputFile, durationSec, cfg,signal }) {
  if (!imageFile || !fs.existsSync(imageFile)) throw new Error(`Whiteboard renderer requires a generated image for ${scene.id}`); const python=await ensureWhiteboardEngine(cfg,{signal});
  const {width,height}=await probeVideoSize(imageFile,cfg,{signal}); const annotationFile = path.join(path.dirname(imageFile),`${scene.id}.annotation.json`); const durationMs = Math.max(1000,Math.round(durationSec*1000));
  writeJson(annotationFile,{sceneId:scene.id,canvas:{width,height},storyBasis:scene.text,sceneDurationMs:durationMs,elements:[{id:'scene-illustration',label:'full scene illustration',sequence:1,narrativeRole:'main scene',subtitle:scene.text,type:'scene',region:{x:0,y:0,width,height},reveal:{direction:'top_to_bottom',startMs:0,durationMs:Math.max(500,durationMs-500),maskPaddingPx:0,protectedRegions:[]},handPath:{start:[Math.round(width/2),0],end:[Math.round(width/2),height],easing:'easeInOut'}}]});
  const hand=whiteboardHandAsset(cfg); const renderLongEdge=Math.min(960,Math.max(cfg.width||width,cfg.height||height)); const args=[whiteboardScript(cfg),imageFile,annotationFile,outputFile]; if (fs.existsSync(hand)) args.push(hand); args.push('--ink-path','grid','--color-fill','contour-wipe','--cap-long-edge',String(renderLongEdge),'--total-ms',String(durationMs),'--pause','off'); await run(python,args,{cwd:cfg.whiteboardEngineDir,signal}); return outputFile;
}
