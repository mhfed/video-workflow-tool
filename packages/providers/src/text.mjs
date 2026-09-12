import { generateScriptCodex, planEngagementCodex, planNarrativeBeatsCodex, planPackagingCodex } from './codex.mjs';
import { generateScriptMock } from './mock.mjs';
import { generateScriptOpenAI, planEngagementOpenAI, planNarrativeBeatsOpenAI, planPackagingOpenAI } from './openai.mjs';
import { draftHookVariants } from '../../core/src/engagement.mjs';
import { draftPackagingVariants } from '../../core/src/packaging.mjs';

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

export async function planEngagementText(project,cfg,options={}) {
  const provider=textProviderName(cfg);
  if(provider==='openai')return planEngagementOpenAI(project,cfg,options);
  if(provider==='codex')return planEngagementCodex(project,cfg,options);
  const plan=project.engagementPlan||{};
  return {...plan,hookVariants:draftHookVariants(project)};
}

export async function planPackagingText(project,cfg,options={}) {
  const provider=textProviderName(cfg);
  if(provider==='openai')return planPackagingOpenAI(project,cfg,options);
  if(provider==='codex')return planPackagingCodex(project,cfg,options);
  return {variants:draftPackagingVariants(project)};
}
