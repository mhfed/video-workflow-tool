import path from 'node:path';
import { ensureDir } from '../../core/src/utils.mjs';
import { run } from '../../core/src/process.mjs';
export function generateScriptMock(topic) { return `Why does ${topic} matter? It is easier to understand when we break it into a few simple ideas. First, look at what is happening and why people notice it. Next, consider the mechanism behind it and a concrete everyday example. Finally, connect those ideas to a practical takeaway. The important point is not to memorize a definition, but to understand the pattern well enough to recognize it when it appears in real life.`; }
export async function synthesizeSpeechMock(text, outputFile, cfg, durationSec) { ensureDir(path.dirname(outputFile)); const d = Math.max(1, durationSec || Math.max(2, text.split(/\s+/).length / 2.5)); await run(cfg.ffmpegBin, ['-y','-f','lavfi','-i','anullsrc=r=44100:cl=stereo','-t',String(d),'-q:a','9','-acodec','libmp3lame',outputFile], { capture:true }); return outputFile; }
