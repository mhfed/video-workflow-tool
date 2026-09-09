function vttTime(ms) {
  const value=Math.max(0,Math.round(ms));
  const hours=Math.floor(value/3600000);
  const minutes=Math.floor((value%3600000)/60000);
  const seconds=Math.floor((value%60000)/1000);
  const millis=value%1000;
  return `${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}.${String(millis).padStart(3,'0')}`;
}

function chunksFor(text,maxWords=10) {
  const words=String(text||'').replace(/\s+/g,' ').trim().split(' ').filter(Boolean);
  if(!words.length)return [];
  const count=Math.ceil(words.length/maxWords);
  const size=Math.ceil(words.length/count);
  const chunks=[];
  for(let index=0;index<words.length;index+=size)chunks.push(words.slice(index,index+size));
  return chunks;
}

export function buildWebVtt(project,{maxWords=10}={}) {
  const cues=[];
  for(const scene of project.scenes||[]) {
    const chunks=chunksFor(scene.text,maxWords);
    const words=chunks.reduce((total,chunk)=>total+chunk.length,0);
    if(!words)continue;
    const startMs=Number(scene.startMs)||0;
    const durationMs=Math.max(1,(Number(scene.endMs)||startMs+(Number(scene.durationMs)||1))-startMs);
    let consumed=0;
    chunks.forEach((chunk,index)=>{
      const cueStart=startMs+Math.round(durationMs*(consumed/words));
      consumed+=chunk.length;
      const cueEnd=index===chunks.length-1?startMs+durationMs:startMs+Math.round(durationMs*(consumed/words));
      cues.push(`${scene.id}-${String(index+1).padStart(2,'0')}\n${vttTime(cueStart)} --> ${vttTime(cueEnd)}\n${chunk.join(' ').replaceAll('-->','→')}`);
    });
  }
  return `WEBVTT\n\n${cues.join('\n\n')}\n`;
}
