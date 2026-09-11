import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough, Writable } from 'node:stream';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { generateImageCodex, parseCodexJsonl, runCodexPrompt } from '../packages/providers/src/codex.mjs';
import { CodexAccountClient, safeCodexAccountStatus } from '../apps/web/src/codex-account.mjs';

test('Codex JSONL parser returns the final agent message and reports failures',()=>{
  const output=[
    JSON.stringify({type:'thread.started',thread_id:'thread-1'}),
    JSON.stringify({type:'item.completed',item:{type:'agent_message',text:'First draft'}}),
    JSON.stringify({type:'item.completed',item:{type:'agent_message',text:'Final answer'}}),
    JSON.stringify({type:'turn.completed'})
  ].join('\n');
  assert.equal(parseCodexJsonl(output),'Final answer');
  assert.throws(()=>parseCodexJsonl(JSON.stringify({type:'turn.failed',error:{message:'quota reached'}})),/quota reached/);
});

test('Codex provider sends prompts over stdin in a read-only ephemeral run',async()=>{
  let invocation,prompt='';
  const spawnImpl=(bin,args,options)=>{
    invocation={bin,args,options};
    const child=new EventEmitter(),stdout=new PassThrough(),stderr=new PassThrough();
    child.stdout=stdout;child.stderr=stderr;child.kill=()=>{};
    child.stdin=new Writable({write(chunk,_encoding,done){prompt+=chunk.toString();done();},final(done){
      queueMicrotask(()=>{stdout.end(`${JSON.stringify({type:'item.completed',item:{type:'agent_message',text:'Provider ready'}})}\n`);child.emit('close',0);});done();
    }});
    return child;
  };
  const result=await runCodexPrompt('Write a test',{codexBin:'codex-test',codexModel:'model-test',codexTimeoutMs:1000},{spawnImpl});
  assert.equal(result,'Provider ready');
  assert.equal(invocation.bin,'codex-test');
  assert.ok(invocation.args.includes('--json'));
  assert.ok(invocation.args.includes('read-only'));
  assert.ok(invocation.args.includes('--ephemeral'));
  assert.deepEqual(invocation.args.slice(-3),['--model','model-test','-']);
  assert.equal(prompt,'Write a test\n');
});

test('Codex ImageGen runs in an isolated writable directory and promotes a validated PNG',async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'cutroom-codex-image-'));
  const outputFile=path.join(root,'visual-take.png');
  let invocation,prompt='';
  const spawnImpl=(bin,args,options)=>{
    invocation={bin,args,options};
    const child=new EventEmitter(),stdout=new PassThrough(),stderr=new PassThrough();
    child.stdout=stdout;child.stderr=stderr;child.kill=()=>{};
    child.stdin=new Writable({write(chunk,_encoding,done){prompt+=chunk.toString();done();},final(done){
      fs.writeFileSync(path.join(options.cwd,'generated.png'),Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]));
      queueMicrotask(()=>{stdout.end(`${JSON.stringify({type:'item.completed',item:{type:'agent_message',text:'generated.png'}})}\n`);child.emit('close',0);});done();
    }});
    return child;
  };
  const cfg={codexBin:'codex-test',codexModel:'',codexTimeoutMs:1000,openaiImageSize:'1536x1024',openaiImageQuality:'medium'};
  await generateImageCodex('A paper boat on calm water',outputFile,cfg,{spawnImpl});
  assert.ok(fs.existsSync(outputFile));
  assert.ok(invocation.args.includes('workspace-write'));
  assert.match(path.basename(invocation.options.cwd),/^cutroom-codex-imagegen-/);
  assert.match(prompt,/\$imagegen/);
  assert.match(prompt,/not the OpenAI API or any API key/);
  assert.deepEqual(fs.readdirSync(root),['visual-take.png']);
});

test('Codex App Server client completes the handshake and exposes safe ChatGPT status',async()=>{
  const requests=[];
  const spawnImpl=()=>{
    const child=new EventEmitter(),stdout=new PassThrough(),stderr=new PassThrough();
    child.stdout=stdout;child.stderr=stderr;
    child.stdin=new Writable({write(chunk,_encoding,done){
      for(const line of chunk.toString().split('\n').filter(Boolean)){
        const request=JSON.parse(line);requests.push(request);
        if(request.id!==undefined){
          const result=request.method==='account/read'?{account:{type:'chatgpt',email:'owner@example.test',planType:'plus'},requiresOpenaiAuth:true}:{};
          queueMicrotask(()=>stdout.write(`${JSON.stringify({id:request.id,result})}\n`));
        }
      }
      done();
    }});
    child.kill=()=>queueMicrotask(()=>child.emit('exit',0));
    return child;
  };
  const client=new CodexAccountClient({spawnImpl});
  const status=await client.status();client.close();
  assert.equal(requests[0].method,'initialize');
  assert.equal(requests[1].method,'initialized');
  assert.equal(requests[2].method,'account/read');
  assert.deepEqual(safeCodexAccountStatus(status),{available:true,connected:true,authType:'chatgpt',email:'owner@example.test',planType:'plus',error:null});
});
