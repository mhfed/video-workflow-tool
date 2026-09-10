export const WORKFLOW_STAGES=['script','voice','visual','clip'];

export const artifactReady=(scene,stage)=>stage==='script'
  ||stage==='voice'&&!!scene.cache?.voice
  ||stage==='visual'&&!!scene.cache?.image
  ||stage==='clip'&&!!scene.artifacts?.clip;

export const bestAvailableView=(scene)=>scene.artifacts?.clip?'clip'
  :scene.artifacts?.visual||scene.cache?.image?'visual'
    :scene.artifacts?.voice||scene.cache?.voice?'voice':'script';

export function getSceneHealth(scene,c,hasFinal=false){
  const decisions=WORKFLOW_STAGES.map((stage)=>scene.review?.[stage]||'pending');
  if(scene.quality?.status==='fail'||decisions.includes('changes-requested'))return {label:c.needsAttention,tone:'danger'};
  if(scene.quality?.status==='warn'||decisions.includes('stale'))return {label:c.outOfDate,tone:'warning'};
  if(scene.review?.clip==='approved'||hasFinal&&scene.artifacts?.clip)return {label:c.sceneReady,tone:'success'};
  if(scene.artifacts?.clip)return {label:c.needsReview,tone:'accent'};
  if(scene.cache?.voice||scene.cache?.image)return {label:c.inProgress,tone:'progress'};
  return {label:c.sceneDraft,tone:'muted'};
}

export function getNextAction(scene,c,hasFinal=false){
  const decision=(stage)=>scene.review?.[stage]||'pending';
  if(decision('script')==='changes-requested')return {kind:'edit',stage:'script',title:c.reviseNarration,body:c.reviseNarrationBody};
  if(decision('visual')==='changes-requested')return {kind:'edit',stage:'visual',title:c.reviseVisual,titleAction:c.open,body:c.reviseVisualBody};
  if(decision('voice')==='changes-requested')return {kind:'run',stage:'voice',title:c.generateVoice,titleAction:c.regenerate,body:c.generateVoiceBody};
  if(decision('clip')==='changes-requested')return {kind:'run',stage:'clip',title:c.renderClip,titleAction:c.regenerate,body:c.renderClipBody};
  if(['fail','warn'].includes(scene.quality?.status))return {kind:'quality',stage:'clip',title:c.qualityNeedsReview,titleAction:c.open,body:c.qualityNeedsReviewBody};
  if(artifactReady(scene,'clip'))return decision('clip')==='approved'||hasFinal?null:{kind:'review',stage:'clip',title:c.reviewClip,titleAction:c.approve,body:c.reviewClipBody};
  if(artifactReady(scene,'visual')&&decision('visual')!=='approved')return {kind:'review',stage:'visual',title:c.reviewVisual,titleAction:c.approve,body:c.reviewVisualBody};
  if(artifactReady(scene,'voice')&&decision('voice')!=='approved')return {kind:'review',stage:'voice',title:c.reviewVoice,titleAction:c.approve,body:c.reviewVoiceBody};
  if(decision('script')!=='approved')return {kind:'review',stage:'script',title:c.approveNarration,titleAction:c.approve,body:c.approveNarrationBody};
  if(!artifactReady(scene,'visual'))return {kind:'run',stage:'visual',title:c.generateVisual,titleAction:c.generate,body:c.generateVisualBody};
  if(!artifactReady(scene,'voice'))return {kind:'run',stage:'voice',title:c.generateVoice,titleAction:c.generate,body:c.generateVoiceBody};
  if(!artifactReady(scene,'clip'))return {kind:'run',stage:'clip',title:c.renderClip,titleAction:c.render,body:c.renderClipBody};
  return null;
}

export function estimateAction(action,c){
  if(['edit','review','quality'].includes(action.kind))return {time:c.underMinute,cost:c.noProviderCost};
  if(action.stage==='visual')return {time:'~30s',cost:c.oneImageRequest};
  if(action.stage==='voice')return {time:'~20s',cost:c.oneVoiceRequest};
  return {time:'~15s',cost:c.oneLocalRender};
}

export function buildActionInbox(project,c){
  const hasFinal=!!project.artifacts?.final;
  return project.scenes.map((scene,index)=>{
    const action=getNextAction(scene,c,hasFinal);
    return action?{...action,sceneId:scene.id,index,health:getSceneHealth(scene,c,hasFinal),estimate:estimateAction(action,c)}:null;
  }).filter(Boolean);
}
