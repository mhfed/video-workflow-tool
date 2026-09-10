import { isRendererName } from '../../../packages/renderers/src/registry.mjs';

export function rendererInputError(body) {
  return typeof body?.renderer==='string'&&!isRendererName(body.renderer)
    ? 'Unsupported video renderer.'
    : null;
}
