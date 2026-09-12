import { createChannel, listChannels, loadChannel, updateChannel } from '../../../packages/core/src/channel.mjs';
import { createIdea, listIdeas, loadIdea, updateIdea } from '../../../packages/core/src/idea.mjs';
import { applyProjectChannelChanges, assignProjectChannel, diffProjectChannel } from '../../../packages/core/src/channel-inheritance.mjs';
import { loadProject, saveProject } from '../../../packages/core/src/project.mjs';
import { contentError } from '../../../packages/core/src/content-contract.mjs';

export async function routeContentApi({ method, parts, readBody, cfg, projectBusy = () => false }) {
  if (parts[0] !== 'api') return null;
  const result = (body, status = 200) => ({ status, body });
  if (parts[1] === 'channels') {
    const id = parts[2] ? decodeURIComponent(parts[2]) : null;
    if (!id && method === 'GET') return result(listChannels(cfg));
    if (!id && method === 'POST') return result(createChannel(await readBody(), cfg), 201);
    if (id && parts.length === 3) {
      if (method === 'GET') return result(loadChannel(id, cfg));
      if (method === 'PATCH') { const body = await readBody(); return result(updateChannel(id, body, cfg, { expectedRevision: body.expectedRevision })); }
    }
    if (id && parts[3] === 'ideas') {
      const ideaId = parts[4] ? decodeURIComponent(parts[4]) : null;
      if (!ideaId && method === 'GET') return result(listIdeas(id, cfg));
      if (!ideaId && method === 'POST') return result(createIdea(id, await readBody(), cfg), 201);
      if (ideaId && parts.length === 5) {
        if (method === 'GET') return result(loadIdea(id, ideaId, cfg));
        if (method === 'PATCH') { const body = await readBody(); return result(updateIdea(id, ideaId, body, cfg, { expectedRevision: body.expectedRevision })); }
      }
    }
    throw contentError('Unsupported channel operation.', 405);
  }
  if (parts[1] === 'projects' && parts[2] && parts[3] === 'channel' && parts.length === 4) {
    const id = decodeURIComponent(parts[2]), project = loadProject(id, cfg);
    if (method === 'GET') {
      if (!project.channelId) return result({ available: false, channelId: null, changes: [] });
      let channel;
      try { channel = loadChannel(project.channelId, cfg); }
      catch (error) { if (error.status === 404) return result({ available: false, channelId: project.channelId, changes: [] }); throw error; }
      return result({ available: true, ...diffProjectChannel(project, channel, cfg) });
    }
    if (projectBusy(id)) throw contentError('Wait for the video job before changing channel inheritance.', 409);
    const body = await readBody();
    if (method === 'PATCH') {
      if (!Object.prototype.hasOwnProperty.call(body, 'channelId')) throw contentError('channelId is required (null for Unassigned).');
      const channel = body.channelId ? loadChannel(body.channelId, cfg) : null;
      if (assignProjectChannel(project, channel)) saveProject(project, cfg);
      return result(project);
    }
    if (method === 'POST') {
      if (!project.channelId) throw contentError('Assign a channel first.');
      const channel = loadChannel(project.channelId, cfg);
      if (!Number.isSafeInteger(body.expectedRevision)) throw contentError('Review the channel revision before applying changes.');
      if (applyProjectChannelChanges(project, channel, cfg, body)) saveProject(project, cfg);
      return result(project);
    }
    throw contentError('Unsupported channel operation.', 405);
  }
  return null;
}
