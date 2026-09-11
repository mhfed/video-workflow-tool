import { generateImageCodex } from './codex.mjs';
import { generateImageOpenAI } from './openai.mjs';

const adapters={
  mock:{cache:()=>({})},
  openai:{
    cache:(cfg)=>({model:cfg.openaiImageModel,size:cfg.openaiImageSize,quality:cfg.openaiImageQuality}),
    generate:({prompt,outputFile,cfg,signal})=>generateImageOpenAI(prompt,outputFile,cfg,{signal})
  },
  codex:{
    cache:(cfg)=>({workflow:'imagegen-v1',model:'gpt-image-2',agentModel:cfg.codexModel||'account-default',size:cfg.openaiImageSize,quality:cfg.openaiImageQuality}),
    generate:({prompt,outputFile,cfg,signal})=>generateImageCodex(prompt,outputFile,cfg,{signal})
  }
};

export const imageProviderNames=Object.freeze(Object.keys(adapters));

export function imageCacheConfig(provider,cfg) {
  const adapter=adapters[provider];
  if(!adapter)throw new Error(`Unsupported IMAGE_PROVIDER=${provider}`);
  return adapter.cache(cfg);
}

export async function generateImage({provider,prompt,outputFile,cfg,signal}) {
  const adapter=adapters[provider];
  if(!adapter)throw new Error(`Unsupported IMAGE_PROVIDER=${provider}`);
  if(!adapter.generate)throw new Error(`IMAGE_PROVIDER=${provider} does not generate a file`);
  return adapter.generate({prompt,outputFile,cfg,signal});
}
