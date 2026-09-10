const drop = (object, key) => { if (object && Object.prototype.hasOwnProperty.call(object,key)) delete object[key]; };

export function invalidateFinal(project) {
  project.artifacts ||= {};
  drop(project.artifacts,'final');
  drop(project.artifacts,'captions');
  project.status='planned';
  return project;
}

export function invalidateScene(project, scene, { textChanged=false, promptChanged=false, rendererChanged=false }={}) {
  if (!textChanged && !promptChanged && !rendererChanged) return project;
  scene.cache ||= {};
  scene.artifacts ||= {};

  if (textChanged) {
    drop(scene.cache,'voice');
    drop(scene.artifacts,'voice');
    scene.review ||= {};
    scene.review.script='pending';
    scene.review.voice='stale';
  }
  if (promptChanged) {
    drop(scene.cache,'image');
    drop(scene.artifacts,'visual');
    scene.review ||= {};
    scene.review.visual='stale';
  }
  if (textChanged || promptChanged || rendererChanged) {
    for (const key of ['video','clip']) drop(scene.cache,key);
    for (const key of ['video','clip']) drop(scene.artifacts,key);
    scene.status=rendererChanged&&!textChanged&&!promptChanged?(scene.artifacts.visual?'visual-ready':scene.artifacts.voice?'voice-ready':'planned'):'planned';
    scene.review ||= {};
    scene.review.clip='stale';
    invalidateFinal(project);
  }
  return project;
}

export function invalidateRenderedMedia(project) {
  for (const scene of project.scenes || []) {
    scene.cache ||= {};
    scene.artifacts ||= {};
    for (const key of ['video','clip']) drop(scene.cache,key);
    for (const key of ['video','clip']) drop(scene.artifacts,key);
    scene.status=scene.artifacts.visual?'visual-ready':scene.artifacts.voice?'voice-ready':'planned';
    scene.review ||= {};
    scene.review.clip='stale';
  }
  return invalidateFinal(project);
}
