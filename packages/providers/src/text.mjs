import { generateScriptCodex, planNarrativeBeatsCodex } from './codex.mjs';
import { generateScriptMock } from './mock.mjs';
import { generateScriptOpenAI, planNarrativeBeatsOpenAI } from './openai.mjs';

export const textProviderName=(cfg)=>cfg.mockMode?'mock':cfg.textProvider;

export async function generateScriptText(topic,cfg,options={}) {
  const provider=textProviderName(cfg);
  if(provider==='mock')return generateScriptMock(topic,options);
  if(provider==='openai')return generateScriptOpenAI(topic,cfg,options);
  if(provider==='codex')return generateScriptCodex(topic,cfg,options);
  throw new Error(`Unsupported TEXT_PROVIDER=${provider}`);
}

export async function planNarrativeBeatsText(script,cfg,options={}) {
  const provider=textProviderName(cfg);
  if(provider==='openai')return planNarrativeBeatsOpenAI(script,cfg,options);
  if(provider==='codex')return planNarrativeBeatsCodex(script,cfg,options);
  return null;
}
