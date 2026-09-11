const clamp=(value)=>Math.max(0,Math.min(1,Number(value)||0));

export function pointAtProgress(points,progress) {
  if(!Array.isArray(points)||!points.length)return null;
  if(points.length===1)return points[0];
  const segments=[];let total=0;
  for(let index=0;index<points.length-1;index++){const from=points[index],to=points[index+1],length=Math.hypot(to[0]-from[0],to[1]-from[1]);if(length>0){segments.push({from,to,length,start:total});total+=length;}}
  if(!total)return points[0];
  const distance=clamp(progress)*total,segment=segments.find((item)=>distance<=item.start+item.length)||segments.at(-1),amount=Math.max(0,Math.min(1,(distance-segment.start)/segment.length));
  return [segment.from[0]+(segment.to[0]-segment.from[0])*amount,segment.from[1]+(segment.to[1]-segment.from[1])*amount];
}

export function partialPath(points,progress) {
  if(!Array.isArray(points)||!points.length)return [];
  const marker=pointAtProgress(points,progress);if(!marker)return [];
  if(progress>=1)return [...points];
  const segments=[];let total=0;
  for(let index=0;index<points.length-1;index++){const length=Math.hypot(points[index+1][0]-points[index][0],points[index+1][1]-points[index][1]);segments.push(length);total+=length;}
  const target=clamp(progress)*total,result=[points[0]];let travelled=0;
  for(let index=0;index<segments.length;index++){if(travelled+segments[index]>=target)break;travelled+=segments[index];result.push(points[index+1]);}
  result.push(marker);return result;
}

export function movePathPoint(points,index,direction) {
  const target=index+direction;if(!Array.isArray(points)||index<0||index>=points.length||target<0||target>=points.length)return points;
  const next=[...points];[next[index],next[target]]=[next[target],next[index]];return next;
}
