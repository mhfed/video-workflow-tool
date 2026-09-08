import path from 'node:path';
import { ensureDir } from '../../core/src/utils.mjs';
import { run } from '../../core/src/process.mjs';
export async function synthesizeSpeechMock(text, outputFile, cfg, durationSec) { ensureDir(path.dirname(outputFile)); const d = Math.max(1, durationSec || Math.max(2, text.split(/\s+/).length / 2.5)); await run(cfg.ffmpegBin, ['-y','-f','lavfi','-i','anullsrc=r=44100:cl=stereo','-t',String(d),'-q:a','9','-acodec','libmp3lame',outputFile], { capture:true }); return outputFile; }
