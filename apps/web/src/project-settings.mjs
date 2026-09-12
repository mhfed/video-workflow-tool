import { invalidateScene } from '../../../packages/core/src/invalidation.mjs';
import { validatePenAppearance } from '../../../packages/core/src/pen-settings.mjs';
import { resolveRendererName } from '../../../packages/renderers/src/registry.mjs';

const PEN_RENDERERS=new Set(['whiteboard','draw-reveal']);

export function applyPenAppearance(project,value,cfg) {
  project.settings ||= {};
  const pen=validatePenAppearance(value),changed=pen.label!==project.settings.pen?.label||pen.color!==project.settings.pen?.color;
  if(!changed)return false;
  project.settings.pen=pen;
  for(const scene of project.scenes||[]){
    const renderer=resolveRendererName(scene,project,cfg),customHand=renderer==='draw-reveal'&&(scene.drawReveal?.handAsset||project.settings.drawReveal?.handAsset);
    if(PEN_RENDERERS.has(renderer)&&!customHand)invalidateScene(project,scene,{rendererChanged:true});
  }
  return true;
}
