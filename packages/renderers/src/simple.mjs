import path from 'node:path';
import { run } from '../../core/src/process.mjs';
import { ensureDir, fileExists } from '../../core/src/utils.mjs';
import { containVideoFilter } from '../../core/src/video-fit.mjs';

const drawtextSupport = new Map();

function escapeDrawtext(s) { return String(s).replaceAll('\\','\\\\').replaceAll(':','\\:').replaceAll("'","\\'").replaceAll('%','\\%').replaceAll('\n',' '); }

async function supportsDrawtext(ffmpegBin) {
  if (!drawtextSupport.has(ffmpegBin)) {
    drawtextSupport.set(ffmpegBin, (async () => {
      try {
        const result = await run(ffmpegBin, ['-hide_banner', '-filters'], { capture: true });
        return /(?:^|\n)\s*[.A-Z]{3}\s+drawtext\s/m.test(`${result.stdout}\n${result.stderr}`);
      } catch {
        return false;
      }
    })());
  }
  return drawtextSupport.get(ffmpegBin);
}

export async function renderSimpleScene({ scene, imageFile, outputFile, durationSec, cfg,signal }) {
  ensureDir(path.dirname(outputFile));
  if (imageFile && fileExists(imageFile)) {
    const vf = containVideoFilter(cfg.width,cfg.height);
    await run(cfg.ffmpegBin, ['-y','-loop','1','-i',imageFile,'-vf',vf,'-t',String(durationSec),'-r',String(cfg.fps),'-c:v','libx264','-pix_fmt','yuv420p',outputFile], { capture:true,signal });
  } else {
    const args = ['-y','-f','lavfi','-i',`color=c=0xF5EBD7:s=${cfg.width}x${cfg.height}:r=${cfg.fps}`];
    if (await supportsDrawtext(cfg.ffmpegBin)) {
      const label = escapeDrawtext(scene.text.slice(0,180));
      args.push('-vf', `drawtext=font='Sans':text='${label}':fontcolor=0x333333:fontsize=44:line_spacing=12:x=(w-text_w)/2:y=(h-text_h)/2:box=1:boxcolor=0xF5EBD7@0.92:boxborderw=30,format=yuv420p`);
    }
    args.push('-t',String(durationSec),'-c:v','libx264','-pix_fmt','yuv420p',outputFile);
    await run(cfg.ffmpegBin, args, { capture:true,signal });
  }
  return outputFile;
}
