import fs from 'node:fs'; import path from 'node:path'; import { run } from '../../core/src/process.mjs'; import { ensureDir, writeJson } from '../../core/src/utils.mjs'; import { probeVideoSize } from '../../core/src/media.mjs';
export function whiteboardScript(cfg) { return path.join(cfg.whiteboardEngineDir,'scripts','render_stream_whiteboard.py'); }
function prepareScript(cfg) { return path.join(cfg.whiteboardEngineDir,'scripts','prepare_env.py'); }
function parseEnvPython(output) { const match=String(output||'').match(/(?:^|\n)ENV_PY=(.+)\s*$/m); return match?.[1]?.trim() || ''; }
async function checkedUpstreamPython(cfg) {
  if (cfg.whiteboardPython) { if (!fs.existsSync(cfg.whiteboardPython)) throw new Error(`WHITEBOARD_PYTHON does not exist: ${cfg.whiteboardPython}`); return cfg.whiteboardPython; }
  const prepare=prepareScript(cfg); if (!fs.existsSync(prepare)) return cfg.pythonBin;
  try { const r=await run(cfg.pythonBin,[prepare,'--check'],{cwd:cfg.whiteboardEngineDir,capture:true}); const py=parseEnvPython(`${r.stdout}\n${r.stderr}`); if(py && fs.existsSync(py)) return py; } catch {}
  if (!cfg.whiteboardAutoInstall) throw new Error('Whiteboard Python environment is not ready. Set WHITEBOARD_AUTO_INSTALL=1, run the upstream prepare_env.py, or set WHITEBOARD_PYTHON explicitly.');
  await run(cfg.pythonBin,[prepare],{cwd:cfg.whiteboardEngineDir});
  const r=await run(cfg.pythonBin,[prepare,'--check'],{cwd:cfg.whiteboardEngineDir,capture:true}); const py=parseEnvPython(`${r.stdout}\n${r.stderr}`);
  if (!py || !fs.existsSync(py)) throw new Error('Whiteboard prepare_env.py completed but did not return a usable ENV_PY interpreter.');
  return py;
}
export async function ensureWhiteboardEngine(cfg) {
  if (!fs.existsSync(whiteboardScript(cfg))) {
    if (!cfg.whiteboardAutoInstall) throw new Error(`Whiteboard engine missing: ${cfg.whiteboardEngineDir}`);
    ensureDir(path.dirname(cfg.whiteboardEngineDir)); await run('git',['clone','--depth','1','https://github.com/geeklee/srt-whiteboard-animation.git',cfg.whiteboardEngineDir]);
  }
  return checkedUpstreamPython(cfg);
}
export async function renderWhiteboardScene({ scene, imageFile, outputFile, durationSec, cfg }) {
  if (!imageFile || !fs.existsSync(imageFile)) throw new Error(`Whiteboard renderer requires a generated image for ${scene.id}`); const python=await ensureWhiteboardEngine(cfg);
  const {width,height}=await probeVideoSize(imageFile,cfg); const annotationFile = path.join(path.dirname(imageFile),`${scene.id}.annotation.json`); const durationMs = Math.max(1000,Math.round(durationSec*1000));
  writeJson(annotationFile,{sceneId:scene.id,canvas:{width,height},storyBasis:scene.text,sceneDurationMs:durationMs,elements:[{id:'scene-illustration',label:'full scene illustration',sequence:1,narrativeRole:'main scene',subtitle:scene.text,type:'scene',region:{x:0,y:0,width,height},reveal:{direction:'top_to_bottom',startMs:0,durationMs:Math.max(500,durationMs-500),maskPaddingPx:0,protectedRegions:[]},handPath:{start:[Math.round(width/2),0],end:[Math.round(width/2),height],easing:'easeInOut'}}]});
  const hand = path.join(cfg.whiteboardEngineDir,'assets','drawing-hand.png'); const args=[whiteboardScript(cfg),imageFile,annotationFile,outputFile]; if (fs.existsSync(hand)) args.push(hand); args.push('--ink-path','grid','--color-fill','contour-wipe','--total-ms',String(durationMs),'--pause','off'); await run(python,args,{cwd:cfg.whiteboardEngineDir}); return outputFile;
}
