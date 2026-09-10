export function buildRoughCutManifest(project) {
  const scenes=(project.scenes||[]).map((scene,index)=>({
    id:scene.id,index,text:scene.text,durationMs:scene.durationMs,
    clip:scene.artifacts?.clip?`/media/${encodeURIComponent(project.id)}/scenes/${encodeURIComponent(scene.id)}/clip`:null,
    visual:scene.artifacts?.visual?`/media/${encodeURIComponent(project.id)}/scenes/${encodeURIComponent(scene.id)}/visual`:null,
    voice:scene.artifacts?.voice?`/media/${encodeURIComponent(project.id)}/scenes/${encodeURIComponent(scene.id)}/voice`:null
  }));
  return {version:1,projectId:project.id,title:project.title,updatedAt:project.updatedAt,totalDurationMs:scenes.reduce((sum,scene)=>sum+scene.durationMs,0),readyScenes:scenes.filter((scene)=>scene.clip).length,scenes};
}
