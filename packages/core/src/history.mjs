import crypto from 'node:crypto';
import { nowIso } from './utils.mjs';

const SNAPSHOT_KEYS=['title','source','settings','scenes','artifacts','status','error','memory','quality'];

function snapshot(project) {
  return Object.fromEntries(SNAPSHOT_KEYS.filter((key)=>Object.prototype.hasOwnProperty.call(project,key)).map((key)=>[key,structuredClone(project[key])]));
}

function restore(project,state) {
  for(const key of SNAPSHOT_KEYS)delete project[key];
  Object.assign(project,structuredClone(state));
  return project;
}

export function normalizeHistory(project) {
  project.history ||= {undo:[],redo:[]};
  if(!Array.isArray(project.history.undo))project.history.undo=[];
  if(!Array.isArray(project.history.redo))project.history.redo=[];
  return project.history;
}

export function recordHistory(project,label='Project change') {
  const history=normalizeHistory(project);
  history.undo.push({id:`edit-${crypto.randomBytes(5).toString('hex')}`,label:String(label),at:nowIso(),state:snapshot(project)});
  if(history.undo.length>60)history.undo.splice(0,history.undo.length-60);
  history.redo=[];
  return project;
}

export function undoProject(project) {
  const history=normalizeHistory(project),entry=history.undo.pop();
  if(!entry)return false;
  history.redo.push({id:entry.id,label:entry.label,at:nowIso(),state:snapshot(project)});
  restore(project,entry.state);
  project.history=history;
  return true;
}

export function redoProject(project) {
  const history=normalizeHistory(project),entry=history.redo.pop();
  if(!entry)return false;
  history.undo.push({id:entry.id,label:entry.label,at:nowIso(),state:snapshot(project)});
  restore(project,entry.state);
  project.history=history;
  return true;
}
