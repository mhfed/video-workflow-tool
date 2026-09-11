import { invalidateScene } from '../../../packages/core/src/invalidation.mjs';
import { drawRevealPath } from '../../../packages/renderers/src/draw-reveal.mjs';

const rounded=(value)=>Math.round(value*100000)/100000;

export function normalizeDrawRevealPathUpdate(value) {
  if(value===null)return null;
  if(value===undefined)throw new Error('Draw Reveal path update requires "path" as an array or null.');
  return drawRevealPath({path:value}).map(([x,y])=>[rounded(x),rounded(y)]);
}

export function drawRevealPathChanged(scene,nextPath) {
  if(nextPath===null)return !Object.prototype.hasOwnProperty.call(scene?.drawReveal||{},'path')||scene.drawReveal.path!==null;
  const current=scene?.drawReveal?.path??null;
  return JSON.stringify(current)!==JSON.stringify(nextPath);
}

export function assignDrawRevealPath(project,scene,nextPath) {
  if(nextPath===null){scene.drawReveal={...(scene.drawReveal||{}),path:null};}
  else scene.drawReveal={...(scene.drawReveal||{}),path:nextPath};
  invalidateScene(project,scene,{rendererChanged:true});
  return scene;
}
