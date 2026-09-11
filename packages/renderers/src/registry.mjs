import { renderSimpleScene } from './simple.mjs';
import { renderWhiteboardScene, whiteboardHandSignature } from './whiteboard.mjs';
import { cinematicClipInputs, cinematicRenderInputs, mixCinematicBrollAudio, prepareCinematicVisual, renderCinematicBrollScene } from './cinematic-broll.mjs';

const adapters=new Map([
  ['simple',Object.freeze({
    name:'simple',
    render:renderSimpleScene,
    cacheSignature:()=>null
  })],
  ['whiteboard',Object.freeze({
    name:'whiteboard',
    render:renderWhiteboardScene,
    cacheSignature:whiteboardHandSignature
  })],
  ['cinematic-broll',Object.freeze({
    name:'cinematic-broll',
    render:renderCinematicBrollScene,
    cacheSignature:()=>null,
    prepareVisual:prepareCinematicVisual,
    renderCacheInputs:cinematicRenderInputs,
    clipCacheInputs:cinematicClipInputs,
    mixAudio:mixCinematicBrollAudio
  })]
]);

export const rendererNames=Object.freeze([...adapters.keys()]);

export function isRendererName(name) { return adapters.has(name); }

export function resolveRendererName(scene,project,cfg) {
  return scene?.renderer || project?.settings?.renderer || cfg?.renderer;
}

export function getRenderer(name) {
  const adapter=adapters.get(name);
  if(!adapter)throw new Error(`Unsupported VIDEO_RENDERER=${name}`);
  return adapter;
}
