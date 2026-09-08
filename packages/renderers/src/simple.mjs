import path from 'node:path';
import { run } from '../../core/src/process.mjs';
import { ensureDir, fileExists } from '../../core/src/utils.mjs';
function escapeDrawtext(s) { return String(s).replaceAll('\\','\\\\').replaceAll(':','\\:').replaceAll("'","\\'").replaceAll('%','\\%').replaceAll('\n',' '); }
export async function renderSimpleScene({ scene, imageFile, outputFile, durationSec, cfg }) {
  ensureDir(path.dirname(outputFile));
  if (imageFile && fileExists(imageFile)) {
    const frames = Math.max(1, Math.round(durationSec * cfg.fps));
    const vf = `scale=${cfg.width}:${cfg.height}:force_original_aspect_ratio=increase,crop=${cfg.width}:${cfg.height},zoompan=z='min(zoom+0.0004,1.06)':d=${frames}:s=${cfg.width}x${cfg.height}:fps=${cfg.fps},format=yuv420p`;
    await run(cfg.ffmpegBin, ['-y','-loop','1','-i',imageFile,'-vf',vf,'-t',String(durationSec),'-r',String(cfg.fps),'-c:v','libx264','-pix_fmt','yuv420p',outputFile], { capture:true });
  } else {
    const label = escapeDrawtext(scene.text.slice(0,180));
    const filter = `drawtext=font='Sans':text='${label}':fontcolor=0x333333:fontsize=44:line_spacing=12:x=(w-text_w)/2:y=(h-text_h)/2:box=1:boxcolor=0xF5EBD7@0.92:boxborderw=30,format=yuv420p`;
    await run(cfg.ffmpegBin, ['-y','-f','lavfi','-i',`color=c=0xF5EBD7:s=${cfg.width}x${cfg.height}:r=${cfg.fps}`,'-vf',filter,'-t',String(durationSec),'-c:v','libx264','-pix_fmt','yuv420p',outputFile], { capture:true });
  }
  return outputFile;
}
