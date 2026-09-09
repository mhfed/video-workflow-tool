const drop = (object, key) => { if (object && Object.prototype.hasOwnProperty.call(object,key)) delete object[key]; };

export function invalidateFinal(project) {
  project.artifacts ||= {};
  drop(project.artifacts,'final');
  drop(project.artifacts,'captions');
  project.status='planned';
  return project;
}

export function invalidateScene(project, scene, { textChanged=false, promptChanged=false }={}) {
  if (!textChanged && !promptChanged) return project;
  scene.cache ||= {};
  scene.artifacts ||= {};

  if (textChanged) {
    drop(scene.cache,'voice');
    drop(scene.artifacts,'voice');
  }
  if (promptChanged) {
    drop(scene.cache,'image');
    drop(scene.artifacts,'visual');
  }
  if (textChanged || promptChanged) {
    for (const key of ['video','clip']) drop(scene.cache,key);
    for (const key of ['video','clip']) drop(scene.artifacts,key);
    scene.status='planned';
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
  }
  return invalidateFinal(project);
}
