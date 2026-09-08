import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { run } from '../packages/core/src/process.mjs';
import { ensureWhiteboardEngine, renderWhiteboardScene } from '../packages/renderers/src/whiteboard.mjs';

test('whiteboard adapter writes annotation and uses valid pause enum', async () => {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'vwt-wb-'));
  const engine=path.join(root,'engine');
  fs.mkdirSync(path.join(engine,'scripts'),{recursive:true});
  fs.mkdirSync(path.join(engine,'assets'),{recursive:true});
  const fake=path.join(engine,'scripts','render_stream_whiteboard.py');
  fs.writeFileSync(fake, `import json,sys,subprocess\nassert '--pause' in sys.argv and sys.argv[sys.argv.index('--pause')+1]=='off'\nann=json.load(open(sys.argv[2]))\nassert ann['elements'][0]['region']['width']>0\nout=sys.argv[3]\nsubprocess.run(['ffmpeg','-loglevel','error','-y','-f','lavfi','-i','color=c=white:s=320x180:r=10','-t','1','-c:v','libx264','-pix_fmt','yuv420p',out],check=True)\n`);
  const image=path.join(root,'scene-001','visual.png');
  const out=path.join(root,'scene-001','video.mp4');
  fs.mkdirSync(path.dirname(image),{recursive:true});
  await run('ffmpeg',['-loglevel','error','-y','-f','lavfi','-i','color=c=white:s=320x180','-frames:v','1',image],{capture:true});
  const python=(await run('which',['python3'],{capture:true})).stdout.trim();
  const cfg={whiteboardEngineDir:engine,whiteboardAutoInstall:false,whiteboardPython:python,pythonBin:'python3',ffprobeBin:'ffprobe'};
  const scene={id:'scene-001',text:'A simple test scene.'};
  await renderWhiteboardScene({scene,imageFile:image,outputFile:out,durationSec:2,cfg});
  assert.ok(fs.existsSync(out));
  const ann=JSON.parse(fs.readFileSync(path.join(path.dirname(image),'scene-001.annotation.json'),'utf8'));
  assert.equal(ann.sceneDurationMs,2000);
  assert.equal(ann.elements[0].region.width,320);
  assert.equal(ann.elements[0].region.height,180);
});

test('whiteboard engine honors explicit interpreter override', async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'vwt-wb-py-')); const engine=path.join(root,'engine'); fs.mkdirSync(path.join(engine,'scripts'),{recursive:true}); fs.writeFileSync(path.join(engine,'scripts','render_stream_whiteboard.py'),'# fake');
  const py=await ensureWhiteboardEngine({whiteboardEngineDir:engine,whiteboardAutoInstall:false,whiteboardPython:process.execPath,pythonBin:'python3'}); assert.equal(py,process.execPath);
});
