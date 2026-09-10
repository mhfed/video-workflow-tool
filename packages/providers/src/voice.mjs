import { synthesizeSpeechMock } from './mock.mjs';
import { synthesizeSpeechOpenAI } from './openai.mjs';
import { synthesizeSpeechVivibe } from './vivibe.mjs';

const adapters={
  mock:{
    cache:()=>({}),
    synthesize:({text,outputFile,cfg,durationSec,signal})=>synthesizeSpeechMock(text,outputFile,cfg,durationSec,{signal})
  },
  openai:{
    cache:(cfg)=>({model:cfg.openaiTtsModel,voice:cfg.openaiTtsVoice,instructions:cfg.openaiTtsInstructions}),
    synthesize:({text,outputFile,cfg,signal})=>synthesizeSpeechOpenAI(text,outputFile,cfg,{signal})
  },
  vivibe:{
    cache:(cfg)=>({baseUrl:cfg.vivibeBaseUrl,voiceId:cfg.vivibeVoiceId,speed:cfg.vivibeSpeed}),
    synthesize:({text,outputFile,cfg,signal})=>synthesizeSpeechVivibe(text,outputFile,cfg,{signal})
  }
};

export const voiceProviderNames=Object.freeze(Object.keys(adapters));

export function voiceCacheConfig(provider,cfg) {
  const adapter=adapters[provider];
  if(!adapter)throw new Error(`Unsupported VOICE_PROVIDER=${provider}`);
  return adapter.cache(cfg);
}

export async function synthesizeVoice({provider,text,outputFile,cfg,durationSec,signal}) {
  const adapter=adapters[provider];
  if(!adapter)throw new Error(`Unsupported VOICE_PROVIDER=${provider}`);
  return adapter.synthesize({text,outputFile,cfg,durationSec,signal});
}
