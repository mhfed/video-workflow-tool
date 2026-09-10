import { renderSimpleScene } from './simple.mjs';
import { renderWhiteboardScene, whiteboardHandSignature } from './whiteboard.mjs';

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
  })]
]);

export const rendererNames=Object.freeze([...adapters.keys()]);

export function getRenderer(name) {
  const adapter=adapters.get(name);
  if(!adapter)throw new Error(`Unsupported VIDEO_RENDERER=${name}`);
  return adapter;
}
