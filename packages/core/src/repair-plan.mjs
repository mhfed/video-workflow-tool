const failing=(check)=>check&&check.status!=='pass'&&check.status!=='unchecked';

export function buildRepairPlan(project) {
  const actions=[];
  for(const scene of project.scenes||[]){
    const visual=scene.quality?.visual?.checks||{};
    const audio=scene.quality?.audio?.checks||{};
    const visualIssues=Object.entries(visual).filter(([,check])=>failing(check)).map(([key,check])=>check.label||key);
    const audioIssues=Object.entries(audio).filter(([,check])=>failing(check)).map(([key,check])=>check.label||key);
    if(visualIssues.length)actions.push({sceneId:scene.id,stage:'visual',action:'regenerate_visual',reason:visualIssues.join(', '),cost:{imageRequests:1,voiceRequests:0,renders:1}});
    if(audioIssues.length)actions.push({sceneId:scene.id,stage:'voice',action:'regenerate_voice',reason:audioIssues.join(', '),cost:{imageRequests:0,voiceRequests:1,renders:1}});
  }
  const cost=actions.reduce((sum,item)=>({imageRequests:sum.imageRequests+item.cost.imageRequests,voiceRequests:sum.voiceRequests+item.cost.voiceRequests,renders:sum.renders+item.cost.renders}),{imageRequests:0,voiceRequests:0,renders:0});
  return {createdAt:new Date().toISOString(),actions,cost,sceneCount:new Set(actions.map((item)=>item.sceneId)).size};
}
