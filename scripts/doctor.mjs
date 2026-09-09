import fs from 'node:fs';
import { config } from '../packages/core/src/env.mjs';
import { validateConfig } from '../packages/core/src/validate-config.mjs';
import { commandExists } from '../packages/core/src/process.mjs';
import { inspectWhiteboardEnvironment, whiteboardScript } from '../packages/renderers/src/whiteboard.mjs';

const cfg=config();
const validation=validateConfig(cfg);
const checks=[];
const add=(name,ok,detail='')=>checks.push({name,ok,detail});

add('Node.js >= 20',Number(process.versions.node.split('.')[0])>=20,process.version);
add('FFmpeg',await commandExists(cfg.ffmpegBin),cfg.ffmpegBin);
add('ffprobe',await commandExists(cfg.ffprobeBin),cfg.ffprobeBin);
if(cfg.renderer==='whiteboard'){
  add('Git',await commandExists('git'),'required for whiteboard auto-install');
  if(cfg.whiteboardPython) add('WHITEBOARD_PYTHON',fs.existsSync(cfg.whiteboardPython),cfg.whiteboardPython);
  else add('Python',await commandExists(cfg.pythonBin),cfg.pythonBin);
  const installed=fs.existsSync(whiteboardScript(cfg));
  add('Whiteboard engine',installed,installed?'installed':(cfg.whiteboardAutoInstall?'missing; run npm run setup':'missing'));
  if(installed){
    const environment=await inspectWhiteboardEnvironment(cfg);
    add('Whiteboard Python environment',environment.ok,environment.detail);
  }
}
add('Configuration',validation.ok,validation.ok?'valid':validation.errors.join(' | '));

console.log('Video Workflow Tool doctor\n');
for(const c of checks)console.log(`${c.ok?'OK':'FAIL'}  ${c.name}${c.detail?` — ${c.detail}`:''}`);
for(const w of validation.warnings)console.log(`WARN  ${w}`);
console.log('\nRuntime summary');
console.log(`Mode: ${cfg.mockMode?'mock':'real'}`);
console.log(`Renderer: ${cfg.renderer}`);
console.log(`Providers: text=${cfg.textProvider}, image=${cfg.imageProvider}, voice=${cfg.voiceProvider}`);
console.log(`Image: ${cfg.openaiImageModel} ${cfg.openaiImageSize} ${cfg.openaiImageQuality}`);
console.log(`Voice: ${cfg.openaiTtsModel} / ${cfg.openaiTtsVoice}`);
console.log(`OpenAI key: ${cfg.openaiApiKey?'configured':'missing'}`);
if(checks.some(c=>!c.ok))process.exitCode=1;
