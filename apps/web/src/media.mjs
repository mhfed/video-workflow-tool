import fs from 'node:fs';

export function parseByteRange(header,size){
  if(!header||!String(header).startsWith('bytes='))return null;
  const [a,b]=String(header).slice(6).split('-',2);
  let start=a===''?null:Number(a),end=b===''?null:Number(b);
  if(start===null){const suffix=Number(b);if(!Number.isFinite(suffix)||suffix<=0)return null;start=Math.max(0,size-suffix);end=size-1;}
  else {if(!Number.isInteger(start)||start<0||start>=size)return null;end=end===null?size-1:Math.min(Number(end),size-1);if(!Number.isInteger(end)||end<start)return null;}
  return {start,end,length:end-start+1};
}

export function serveMedia(req,res,file,type){
  if(!fs.existsSync(file)){res.writeHead(404);res.end('Missing media');return;}
  const size=fs.statSync(file).size;
  const range=parseByteRange(req.headers.range,size);
  const base={'content-type':type,'accept-ranges':'bytes','cache-control':'no-store'};
  if(req.headers.range&&!range){res.writeHead(416,{...base,'content-range':`bytes */${size}`});res.end();return;}
  if(range){res.writeHead(206,{...base,'content-range':`bytes ${range.start}-${range.end}/${size}`,'content-length':range.length});fs.createReadStream(file,{start:range.start,end:range.end}).pipe(res);return;}
  res.writeHead(200,{...base,'content-length':size});fs.createReadStream(file).pipe(res);
}

export const mediaTypeFor=(kind)=>({visual:'image/png',voice:'audio/mpeg',video:'video/mp4',clip:'video/mp4',final:'video/mp4',captions:'text/vtt; charset=utf-8'}[kind]||'application/octet-stream');
