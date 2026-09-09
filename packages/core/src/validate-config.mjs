export const SUPPORTED_IMAGE_SIZES=new Set(['1024x1024','1024x1536','1536x1024','auto']);
export const SUPPORTED_RENDERERS=new Set(['simple','whiteboard']);
const PROVIDERS=new Set(['openai','mock']);

export function validateConfig(cfg){
  const errors=[],warnings=[];
  if(!SUPPORTED_RENDERERS.has(cfg.renderer))errors.push(`VIDEO_RENDERER must be one of: ${[...SUPPORTED_RENDERERS].join(', ')}`);
  for(const [name,value] of [['TEXT_PROVIDER',cfg.textProvider],['IMAGE_PROVIDER',cfg.imageProvider],['VOICE_PROVIDER',cfg.voiceProvider]]) if(!PROVIDERS.has(value))errors.push(`${name} must be one of: ${[...PROVIDERS].join(', ')}`);
  const usesOpenAI=[cfg.textProvider,cfg.imageProvider,cfg.voiceProvider].includes('openai');
  if(!cfg.mockMode&&usesOpenAI&&!cfg.openaiApiKey)errors.push('OPENAI_API_KEY is required because at least one real provider is set to openai.');
  if(cfg.imageProvider==='openai'&&!SUPPORTED_IMAGE_SIZES.has(cfg.openaiImageSize))errors.push(`OPENAI_IMAGE_SIZE=${cfg.openaiImageSize} is unsupported. Use 1024x1024, 1024x1536, 1536x1024, or auto.`);
  if(!Number.isFinite(cfg.scriptMinutes)||cfg.scriptMinutes<=0)errors.push('SCRIPT_TARGET_MINUTES must be greater than 0.');
  for(const [name,value] of [['SCENE_MIN_SEC',cfg.sceneMinSec],['SCENE_TARGET_SEC',cfg.sceneTargetSec],['SCENE_MAX_SEC',cfg.sceneMaxSec],['WORDS_PER_MINUTE',cfg.wordsPerMinute]]) if(!Number.isFinite(value)||value<=0)errors.push(`${name} must be greater than 0.`);
  if(Number.isFinite(cfg.sceneMinSec)&&Number.isFinite(cfg.sceneTargetSec)&&Number.isFinite(cfg.sceneMaxSec)&&!(cfg.sceneMinSec<=cfg.sceneTargetSec&&cfg.sceneTargetSec<=cfg.sceneMaxSec))errors.push('Scene timing must satisfy SCENE_MIN_SEC <= SCENE_TARGET_SEC <= SCENE_MAX_SEC.');
  for(const [name,value] of [['VIDEO_WIDTH',cfg.width],['VIDEO_HEIGHT',cfg.height],['VIDEO_FPS',cfg.fps]]) if(!Number.isInteger(value)||value<=0)errors.push(`${name} must be a positive integer.`);
  if(cfg.renderer==='whiteboard'&&cfg.imageProvider==='mock'&&!cfg.mockMode)warnings.push('Whiteboard rendering requires a real visual image; IMAGE_PROVIDER=mock is only useful with MOCK_MODE/smoke workflows.');
  if(cfg.openaiImageSize==='1536x1024'&&cfg.width/cfg.height>1.6)warnings.push('Landscape image output is 3:2; the pipeline uses a centered 16:9 safe area and crops to the final video frame.');
  return {ok:errors.length===0,errors,warnings};
}

export function assertConfig(cfg){const result=validateConfig(cfg);if(!result.ok)throw new Error(`Invalid configuration:\n- ${result.errors.join('\n- ')}`);return result;}
