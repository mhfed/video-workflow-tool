import fs from 'node:fs';
import path from 'node:path';

function envLine(key, value) {
  const normalized=String(value??'').replace(/[\r\n]+/g,' ').trim();
  return `${key}=${normalized}`;
}

export function updateEnvFile(file, updates) {
  const existing=fs.existsSync(file)?fs.readFileSync(file,'utf8'):'';
  const pending=new Map(Object.entries(updates));
  const lines=existing.split(/\r?\n/).map((line)=>{
    const match=line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=/);
    if(!match||!pending.has(match[1]))return line;
    const next=envLine(match[1],pending.get(match[1]));
    pending.delete(match[1]);
    return next;
  });
  while(lines.length&&lines.at(-1)==='')lines.pop();
  if(pending.size&&lines.length)lines.push('');
  for(const [key,value] of pending)lines.push(envLine(key,value));
  const output=`${lines.join('\n')}\n`;
  fs.mkdirSync(path.dirname(file),{recursive:true});
  const temporary=`${file}.tmp-${process.pid}`;
  fs.writeFileSync(temporary,output,{mode:0o600});
  fs.renameSync(temporary,file);
  fs.chmodSync(file,0o600);
}
