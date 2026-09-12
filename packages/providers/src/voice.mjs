import { synthesizeSpeechMock } from './mock.mjs';
import { synthesizeSpeechOpenAI } from './openai.mjs';
import { synthesizeSpeechVivibe } from './vivibe.mjs';

const adapters={
  mock:{
    configure:(cfg)=>cfg,
    cache:()=>({}),
    synthesize:({text,outputFile,cfg,durationSec,signal})=>synthesizeSpeechMock(text,outputFile,cfg,durationSec,{signal})
  },
  openai:{
    configure:(cfg,voice)=>({...cfg,...(voice.voiceId?{openaiTtsVoice:voice.voiceId}:{})}),
    cache:(cfg)=>({model:cfg.openaiTtsModel,voice:cfg.openaiTtsVoice,instructions:cfg.openaiTtsInstructions}),
    synthesize:({text,outputFile,cfg,signal})=>synthesizeSpeechOpenAI(text,outputFile,cfg,{signal})
  },
  vivibe:{
    configure:(cfg,voice)=>({...cfg,...(voice.voiceId?{vivibeVoiceId:voice.voiceId}:{})}),
    cache:(cfg)=>({baseUrl:cfg.vivibeBaseUrl,voiceId:cfg.vivibeVoiceId,speed:cfg.vivibeSpeed}),
    synthesize:({text,outputFile,cfg,signal,jobId,onJob})=>synthesizeSpeechVivibe(text,outputFile,cfg,{signal,jobId,onJob})
  }
};

export const voiceProviderNames=Object.freeze(Object.keys(adapters));

export function projectVoiceConfig(project,cfg) {
  const voice=project.settings?.voice;
  if(!voice?.provider)return cfg;
  const adapter=adapters[voice.provider];
  if(!adapter)throw new Error(`Unsupported voice provider: ${voice.provider}`);
  return adapter.configure({...cfg,voiceProvider:voice.provider},voice);
}

export function voiceCacheConfig(provider,cfg) {
  const adapter=adapters[provider];
  if(!adapter)throw new Error(`Unsupported VOICE_PROVIDER=${provider}`);
  return adapter.cache(cfg);
}

export async function synthesizeVoice({provider,text,outputFile,cfg,durationSec,signal,jobId=null,onJob=null}) {
  const adapter=adapters[provider];
  if(!adapter)throw new Error(`Unsupported VOICE_PROVIDER=${provider}`);
  return adapter.synthesize({text,outputFile,cfg,durationSec,signal,jobId,onJob});
}
