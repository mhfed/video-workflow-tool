import { useEffect, useState } from 'react';
import { ArrowRight, BookOpen, Clapperboard, Lightbulb, Plus, Save, Settings2, MonitorPlay as Youtube } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import './channel-workspace.css';

export const contentApi = async (url, options = {}) => {
  const response = await fetch(url, { ...options, headers: { 'content-type': 'application/json' } });
  const text = await response.text();
  let body = {};
  if (text) { try { body = JSON.parse(text); } catch { body = { error: text }; } }
  if (!response.ok) throw new Error(body.error || response.statusText);
  return body;
};
const tr = (c, vi, en) => c.language === 'en' ? en : vi;
const readPath = (object, path) => path.split('.').reduce((value, key) => value?.[key], object);
function writePath(object, path, value) {
  const keys = path.split('.'), key = keys.pop();
  let target = object;
  for (const part of keys) target = target[part] ||= {};
  target[key] = value;
}

const profileGroups = [
  ['identity', 'Nhận diện', 'Identity', [
    ['name', 'Tên kênh', 'Channel name', 'text'], ['slug', 'Slug', 'Slug', 'text'], ['description', 'Mô tả', 'Description'],
  ]],
  ['strategy', 'Chiến lược nội dung', 'Content strategy', [
    ['niche', 'Ngách nội dung', 'Niche'], ['targetAudience', 'Khán giả mục tiêu', 'Target audience'], ['targetMarkets', 'Thị trường', 'Target markets', 'list'],
    ['channelPromise', 'Giá trị kênh cam kết', 'Channel promise'], ['contentPillars', 'Trụ cột nội dung', 'Content pillars', 'list'], ['positioning', 'Định vị', 'Positioning'], ['preferredVideoTypes', 'Loại video ưu tiên', 'Preferred video types', 'list'],
  ]],
  ['editorial', 'Giọng kể & biên tập', 'Editorial direction', [
    ['narrationTone', 'Giọng điệu', 'Narration tone'], ['narratorPersona', 'Nhân cách người kể', 'Narrator persona'], ['hookStyle', 'Cách mở đầu', 'Hook style'], ['pacing', 'Nhịp kể', 'Pacing'],
    ['complexityLevel', 'Mức độ chuyên sâu', 'Complexity'], ['evidencePolicy', 'Quy tắc bằng chứng / kiểm chứng', 'Evidence / fact policy'], ['ctaStyle', 'Cách kêu gọi hành động', 'CTA style'], ['thingsToAvoid', 'Điều cần tránh', 'Things to avoid', 'list'],
  ]],
  ['visualIdentity', 'Ngôn ngữ hình ảnh', 'Visual identity', [
    ['preferredRenderer', 'Renderer ưu tiên', 'Preferred renderer', 'renderer'], ['artDirection', 'Định hướng mỹ thuật', 'Art direction'], ['palette', 'Bảng màu', 'Palette', 'list'],
    ['motifs', 'Mô-típ lặp lại', 'Recurring motifs', 'list'], ['characters', 'Nhân vật thường gặp', 'Recurring characters', 'list'], ['thumbnailDirection', 'Định hướng thumbnail', 'Thumbnail direction'],
  ]],
  ['productionDefaults', 'Mặc định sản xuất', 'Production defaults', [
    ['language', 'Ngôn ngữ', 'Language', 'language'], ['format', 'Khung hình', 'Format', 'format'], ['targetDurationSec', 'Thời lượng mục tiêu (giây)', 'Target duration (seconds)', 'number'],
    ['renderer', 'Renderer mặc định', 'Default renderer', 'renderer'], ['fps', 'FPS', 'FPS', 'number'], ['captions', 'Phụ đề', 'Captions', 'boolean'], ['captionLanguage', 'Ngôn ngữ phụ đề', 'Caption language', 'language'],
    ['voice.provider', 'Nhà cung cấp giọng', 'Voice provider', 'voice'], ['voice.voiceId', 'Voice ID', 'Voice ID', 'text'], ['music.direction', 'Định hướng nhạc nền', 'Music direction'],
  ]],
  ['memory', 'Bộ nhớ dùng chung', 'Channel memory', [
    ['characters', 'Nhân vật nhất quán', 'Consistent characters', 'list'], ['palette', 'Bảng màu nhất quán', 'Consistent palette', 'list'], ['artDirection', 'Mỹ thuật nhất quán', 'Consistent art direction'],
    ['pronunciations', 'Cách phát âm', 'Pronunciations', 'list'], ['terms', 'Thuật ngữ', 'Terms', 'list'], ['conventions', 'Quy ước', 'Conventions', 'list'],
  ]],
  ['packagingDefaults', 'Tiêu đề & thumbnail', 'Packaging defaults', [
    ['titleStyle', 'Phong cách tiêu đề', 'Title style'], ['thumbnailStyle', 'Phong cách thumbnail', 'Thumbnail style'], ['descriptionTemplate', 'Mẫu mô tả', 'Description template'], ['titleConstraints', 'Ràng buộc tiêu đề', 'Title constraints', 'list'],
  ]],
  ['youtube', 'Kênh YouTube', 'YouTube channel', [
    ['channelId', 'YouTube Channel ID', 'YouTube Channel ID', 'text'], ['handle', 'YouTube handle', 'YouTube handle', 'text'],
  ]],
];

export const briefFields = [
  ['pillar', 'Trụ cột nội dung', 'Content pillar'], ['targetViewer', 'Người xem mục tiêu', 'Target viewer'], ['viewerQuestion', 'Câu hỏi của người xem', 'Viewer question'],
  ['angle', 'Góc tiếp cận', 'Angle'], ['corePromise', 'Lời hứa của video', 'Core promise'], ['hook', 'Mở đầu', 'Hook'], ['desiredTakeaway', 'Điều người xem mang về', 'Desired takeaway'], ['narrativeDirection', 'Hướng triển khai câu chuyện', 'Narrative direction'],
];

export function BriefFields({ value = {}, onChange, c }) {
  return <div className="content-fields">{briefFields.map(([key, vi, en]) => <label key={key}>{tr(c, vi, en)}<Textarea rows={2} value={value[key] || ''} onChange={(event) => onChange({ ...value, [key]: event.target.value })}/></label>)}</div>;
}

function ProfileEditor({ channel, onSaved, c }) {
  const [draft, setDraft] = useState(() => structuredClone(channel));
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const choices = {
    renderer: ['simple', 'whiteboard', 'draw-reveal', 'cinematic-broll'], language: ['vi', 'en'], format: ['landscape', 'short'], voice: ['mock', 'openai', 'vivibe'],
    boolean: [['true', tr(c, 'Bật', 'On')], ['false', tr(c, 'Tắt', 'Off')]],
  };
  const update = (path, value) => setDraft((current) => { const next = structuredClone(current); writePath(next, path, value); return next; });
  const save = async (event) => {
    event.preventDefault(); setBusy(true); setMessage('');
    try { await contentApi(`/api/channels/${channel.id}`, { method: 'PATCH', body: JSON.stringify({ ...draft, expectedRevision: channel.revision }) }); await onSaved(); }
    catch (error) { setMessage(error.message); } finally { setBusy(false); }
  };
  return <form className="channel-profile" onSubmit={save}>
    <div className="content-note"><BookOpen size={18}/><p>{tr(c, 'Mỗi video mới nhận một bản riêng của hồ sơ này. Video đang làm giữ nguyên; bạn có thể xem và áp dụng thay đổi sau.', 'New videos receive their own copy of this profile. Existing videos keep their settings; changes can be reviewed and applied explicitly.')}</p></div>
    {profileGroups.map(([group, vi, en, fields], index) => <details key={group} open={index < 2} className="profile-group">
      <summary><span>{String(index + 1).padStart(2, '0')}</span>{tr(c, vi, en)}</summary>
      <div className="content-fields">{fields.map(([key, viLabel, enLabel, type]) => {
        const path = `${group}.${key}`, value = readPath(draft, path);
        return <label key={path}>{tr(c, viLabel, enLabel)}{choices[type] ? <select value={value == null ? '' : String(value)} onChange={(event) => update(path, type === 'boolean' ? event.target.value === '' ? null : event.target.value === 'true' : event.target.value || null)}>
          <option value="">{tr(c, 'Theo mặc định khi tạo video', 'Default at video creation')}</option>{choices[type].map((item) => <option key={Array.isArray(item) ? item[0] : item} value={Array.isArray(item) ? item[0] : item}>{Array.isArray(item) ? item[1] : item}</option>)}
        </select> : type === 'text' || type === 'number' ? <Input required={path === 'identity.name'} type={type} min={type === 'number' ? 1 : undefined} max={path.endsWith('fps') ? 120 : type === 'number' ? 14400 : undefined} value={value ?? ''} onChange={(event) => update(path, type === 'number' ? event.target.value === '' ? null : Number(event.target.value) : event.target.value)}/> : <Textarea rows={3} placeholder={type === 'list' ? tr(c, 'Mỗi mục một dòng', 'One item per line') : ''} value={Array.isArray(value) ? value.join('\n') : value || ''} onChange={(event) => update(path, type === 'list' ? event.target.value.split('\n') : event.target.value)}/>}</label>;
      })}</div>
      {group === 'youtube' && <p className="content-hint">{tr(c, 'Chỉ lưu thông tin kênh. Chưa kết nối tài khoản hay đăng video lên YouTube.', 'Channel information only. Account connection and YouTube publishing are not enabled.')}</p>}
      {group === 'productionDefaults' && <p className="content-hint">{tr(c, 'Nhạc lưu dưới dạng định hướng; chọn tệp nhạc riêng trong video. API key được quản lý trong cài đặt nhà cung cấp.', 'Music is saved as creative direction; select a local track in each video. API keys stay in provider settings.')}</p>}
    </details>)}
    <footer className="content-save">{message && <p role="alert">{message}</p>}<span>{tr(c, 'Phiên bản', 'Revision')} {channel.revision}</span><Button disabled={busy} type="submit"><Save/>{busy ? tr(c, 'Đang lưu…', 'Saving…') : tr(c, 'Lưu hồ sơ kênh', 'Save channel profile')}</Button></footer>
  </form>;
}

const ideaStatusLabels = {
  idea: ['Ý tưởng', 'Idea'], shortlisted: ['Đã chọn', 'Shortlisted'], developing: ['Đang phát triển', 'Developing'], 'converted-to-video': ['Đã tạo video', 'Converted to video'], archived: ['Lưu trữ', 'Archived'],
};

function IdeaEditor({ idea, channel, onSaved, onClose, c }) {
  const [draft, setDraft] = useState(idea || { title: '', topic: '', status: 'idea', pillar: '', notes: '', brief: {} });
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const update = (key, value) => setDraft((current) => ({ ...current, [key]: value }));
  const submit = async (event) => {
    event.preventDefault(); setBusy(true); setError('');
    try { await contentApi(`/api/channels/${channel.id}/ideas${idea ? `/${idea.id}` : ''}`, { method: idea ? 'PATCH' : 'POST', body: JSON.stringify({ ...draft, expectedRevision: idea?.revision }) }); await onSaved(); onClose(); }
    catch (error) { setError(error.message); } finally { setBusy(false); }
  };
  return <form onSubmit={submit} className="content-editor">
    <label>{tr(c, 'Tên ý tưởng', 'Idea title')}<Input required value={draft.title} onChange={(event) => update('title', event.target.value)}/></label>
    <div className="content-fields"><label>{tr(c, 'Chủ đề', 'Topic')}<Input value={draft.topic || ''} onChange={(event) => update('topic', event.target.value)}/></label><label>{tr(c, 'Trạng thái', 'Status')}<select value={draft.status} onChange={(event) => update('status', event.target.value)}>{Object.entries(ideaStatusLabels).filter(([key]) => key !== 'converted-to-video' || idea?.videoIds?.length).map(([key, labels]) => <option key={key} value={key}>{tr(c, ...labels)}</option>)}</select></label></div>
    <BriefFields value={{ ...draft.brief, ...Object.fromEntries(['pillar', 'angle', 'viewerQuestion', 'hook', 'corePromise'].map((key) => [key, draft[key] || ''])) }} onChange={(value) => setDraft((current) => ({ ...current, ...Object.fromEntries(['pillar', 'angle', 'viewerQuestion', 'hook', 'corePromise'].map((key) => [key, value[key]])), brief: value }))} c={c}/>
    <label>{tr(c, 'Ghi chú', 'Notes')}<Textarea rows={3} value={draft.notes || ''} onChange={(event) => update('notes', event.target.value)}/></label>
    {error && <p role="alert" className="content-error">{error}</p>}<footer><Button type="button" variant="ghost" onClick={onClose}>{c.cancel}</Button><Button disabled={busy} type="submit"><Save/>{tr(c, 'Lưu ý tưởng', 'Save idea')}</Button></footer>
  </form>;
}

export default function ChannelWorkspace({ channels, channelId, section, onSectionChange, onChannelChange, projects, onSelect, onCreate, onRefresh, onManageVideo, c }) {
  const channel = channels.find((item) => item.id === channelId), missing = !!channelId && !channel;
  const tab = channel ? section : 'videos', setTab = onSectionChange;
  const [ideas, setIdeas] = useState([]), [ideaEditor, setIdeaEditor] = useState(null), [creating, setCreating] = useState(false), [error, setError] = useState('');
  const [channelName, setChannelName] = useState(''), [savingChannel, setSavingChannel] = useState(false);
  const refreshIdeas = async () => { if (channel) setIdeas(await contentApi(`/api/channels/${channel.id}/ideas`)); };
  useEffect(() => { let active = true; if (channel) contentApi(`/api/channels/${channel.id}/ideas`).then((items) => { if (active) setIdeas(items); }).catch((error) => { if (active) setError(error.message); }); return () => { active = false; }; }, [channel?.id]);
  const createChannel = async (event) => {
    event.preventDefault(); setSavingChannel(true); setError('');
    try { const saved = await contentApi('/api/channels', { method: 'POST', body: JSON.stringify({ identity: { name: channelName } }) }); await onRefresh(); setCreating(false); onChannelChange(saved.id); }
    catch (error) { setError(error.message); } finally { setSavingChannel(false); }
  };
  const videoList = <div className="content-video-list">{projects.length ? projects.map((video) => <article key={video.id}>
    <button className="content-video-open" onClick={() => onSelect(video.id)}><span className="content-video-icon"><Clapperboard/></span><span><strong>{video.title}</strong><small>{video.scenes.length} {c.scenes} · {video.settings?.format === 'short' ? '9:16' : '16:9'} · {c.status[video.status] || video.status}</small></span><ArrowRight size={18}/></button>
    <Button variant="ghost" size="sm" onClick={() => onManageVideo(video)}><Settings2/>{tr(c, 'Kênh & Brief', 'Channel & Brief')}</Button>
  </article>) : <div className="content-empty"><Clapperboard/><h3>{tr(c, 'Video tiếp theo bắt đầu ở đây.', 'Your next video starts here.')}</h3><p>{tr(c, 'Bắt đầu từ chủ đề, Brief, kịch bản hoặc SRT.', 'Start with a topic, brief, script or SRT.')}</p><Button onClick={() => onCreate()}><Plus/>{tr(c, 'Video mới', 'New video')}</Button></div>}</div>;
  return <section className="channel-workspace">
    <div className="channel-toolbar"><label><Youtube size={18}/><select aria-label={tr(c, 'Chọn kênh', 'Choose channel')} value={channelId || ''} onChange={(event) => onChannelChange(event.target.value || null)}><option value="">{tr(c, 'Chưa phân kênh', 'Unassigned')}</option>{channels.map((item) => <option key={item.id} value={item.id}>{item.identity.name}</option>)}{missing && <option value={channelId}>{tr(c, 'Kênh không khả dụng', 'Channel unavailable')}</option>}</select></label><Button variant="outline" onClick={() => setCreating(true)}><Plus/>{tr(c, 'Tạo kênh', 'New channel')}</Button></div>
    <header className="channel-masthead"><div><span className="content-eyebrow">YOUTUBE CONTENT OS / {channel ? `REV ${String(channel.revision).padStart(2, '0')}` : 'LOCAL STUDIO'}</span><h1>{channel?.identity.name || (missing ? tr(c, 'Kênh không khả dụng', 'Channel unavailable') : tr(c, 'Chưa phân kênh', 'Unassigned'))}</h1><p>{channel?.strategy.channelPromise || channel?.identity.description || (channel ? tr(c, 'Từ một ý tưởng tốt đến những video mang dấu ấn của bạn.', 'From a good idea to videos with a voice of their own.') : tr(c, 'Các video độc lập của bạn. Gán kênh khi sẵn sàng; cấu hình hiện tại được giữ nguyên.', 'Your independent videos. Assign a channel when ready; current settings are preserved.'))}</p></div><Button onClick={() => onCreate()}><Plus/>{tr(c, 'Video mới', 'New video')}</Button></header>
    {error && <p role="alert" className="content-error">{error}</p>}
    {tab === 'overview' && channel ? <><div className="channel-overview"><section className="channel-strategy-card"><span className="content-eyebrow">{tr(c, 'ĐỊNH HƯỚNG KÊNH', 'CHANNEL DIRECTION')}</span><h2>{channel.strategy.niche || tr(c, 'Xây nền cho câu chuyện của bạn.', 'Give your stories a foundation.')}</h2><p>{channel.strategy.targetAudience || tr(c, 'Xác định khán giả và lời hứa của kênh để mỗi video có một điểm xuất phát rõ ràng.', 'Define the audience and channel promise to give every video a clear starting point.')}</p><div className="content-pillars">{channel.strategy.contentPillars.map((pillar) => <span key={pillar}>{pillar}</span>)}</div><button onClick={() => setTab('profile')}>{tr(c, 'Chỉnh hồ sơ kênh', 'Edit channel profile')}<ArrowRight size={16}/></button></section><section className="channel-idea-card"><Lightbulb/><span className="content-eyebrow">IDEA BANK</span><strong>{ideas.filter((idea) => !['converted-to-video', 'archived'].includes(idea.status)).length}</strong><p>{tr(c, 'ý tưởng đang chờ phát triển', 'ideas waiting to become stories')}</p><Button variant="outline" onClick={() => { setTab('ideas'); setIdeaEditor({}); }}><Plus/>{tr(c, 'Ghi lại ý tưởng', 'Capture an idea')}</Button></section></div><div className="content-section-heading"><h2>{tr(c, 'Video trong kênh', 'Channel videos')}</h2><span>{projects.length}</span></div>{videoList}</> : tab === 'profile' && channel ? <ProfileEditor key={`${channel.id}-${channel.revision}`} channel={channel} onSaved={onRefresh} c={c}/> : tab === 'ideas' && channel ? <>
      <div className="content-section-heading"><p>{tr(c, 'Ghi lại góc nhìn. Phát triển Brief. Đưa ý tưởng vào phòng dựng.', 'Capture an angle. Develop a brief. Bring the idea into production.')}</p><Button onClick={() => setIdeaEditor({})}><Plus/>{tr(c, 'Thêm ý tưởng', 'New idea')}</Button></div>
      <div className="idea-bank">{ideas.map((idea) => <article key={idea.id}><header><span>{tr(c, ...ideaStatusLabels[idea.status])}</span><small>{idea.pillar}</small></header><h2>{idea.title}</h2><p>{idea.angle || idea.viewerQuestion || idea.corePromise || idea.notes}</p><footer><button onClick={() => setIdeaEditor(idea)}>{tr(c, 'Phát triển Brief', 'Develop brief')}</button><Button size="sm" variant="outline" onClick={() => onCreate(idea)}>{tr(c, 'Tạo video', 'Create video')}<ArrowRight/></Button></footer>{idea.videoIds?.length > 0 && <small className="idea-linked">{idea.videoIds.length} {tr(c, 'video đã tạo', 'videos created')}</small>}</article>)}{!ideas.length && <div className="content-empty"><Lightbulb/><h3>{tr(c, 'Một câu hỏi cũng đủ để bắt đầu.', 'A question is enough to start.')}</h3><p>{tr(c, 'Lưu ý tưởng trước khi viết kịch bản.', 'Save an idea before writing a script.')}</p><Button onClick={() => setIdeaEditor({})}><Plus/>{tr(c, 'Thêm ý tưởng đầu tiên', 'Add your first idea')}</Button></div>}</div>
    </> : videoList}
    <Dialog open={creating} onOpenChange={setCreating}><DialogContent className="content-dialog"><DialogHeader><DialogTitle>{tr(c, 'Một kênh, một định hướng.', 'A channel with a point of view.')}</DialogTitle><DialogDescription>{tr(c, 'Đặt tên trước, sau đó xây dựng chiến lược và nhận diện trong hồ sơ kênh.', 'Start with a name, then shape the strategy and identity in the channel profile.')}</DialogDescription></DialogHeader><form onSubmit={createChannel} className="content-editor"><label>{tr(c, 'Tên kênh', 'Channel name')}<Input autoFocus required value={channelName} onChange={(event) => setChannelName(event.target.value)}/></label>{error && <p role="alert">{error}</p>}<footer><Button disabled={savingChannel} type="submit"><Plus/>{tr(c, 'Tạo kênh', 'Create channel')}</Button></footer></form></DialogContent></Dialog>
    <Dialog open={!!ideaEditor} onOpenChange={(open) => { if (!open) setIdeaEditor(null); }}><DialogContent className="content-dialog content-wide-dialog"><DialogHeader><DialogTitle>{ideaEditor?.id ? tr(c, 'Phát triển ý tưởng', 'Develop idea') : tr(c, 'Ghi lại ý tưởng', 'Capture an idea')}</DialogTitle><DialogDescription>{channel?.identity.name}</DialogDescription></DialogHeader>{ideaEditor && <IdeaEditor idea={ideaEditor.id ? ideaEditor : null} channel={channel} onSaved={refreshIdeas} onClose={() => setIdeaEditor(null)} c={c}/>}</DialogContent></Dialog>
  </section>;
}

const changeLabel = (path, c) => {
  const [group, key] = path.split('.');
  const profileGroup = profileGroups.find(([name]) => name === (group === 'settings' ? 'productionDefaults' : group));
  const field = profileGroup?.[3].find(([name]) => name === key);
  if (field) return tr(c, field[1], field[2]);
  if (group === 'creativeContext') { const section = profileGroups.find(([name]) => name === key); return section ? tr(c, section[1], section[2]) : tr(c, 'Định hướng nhạc', 'Music direction'); }
  return key === 'voice' ? tr(c, 'Giọng đọc', 'Voice') : path;
};
const readableValue = (value, c) => value == null ? '—' : typeof value === 'object' ? Array.isArray(value) ? value.join(', ') || '—' : Object.entries(value).filter(([, entry]) => entry != null && entry !== '' && (!Array.isArray(entry) || entry.length)).map(([key, entry]) => {
  const field = profileGroups.flatMap((group) => group[3]).find((field) => field[0] === key || field[0].split('.').at(-1) === key);
  return `${field ? tr(c, field[1], field[2]) : key}: ${readableValue(entry, c)}`;
}).join('\n') || '—' : String(value);

export function VideoContextDialog({ video, channels, onClose, onSaved, c }) {
  const [project, setProject] = useState(video), [channelId, setChannelId] = useState(video.channelId || ''), [diff, setDiff] = useState(null), [selected, setSelected] = useState([]), [brief, setBrief] = useState(video.brief || {}), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const reloadDiff = async () => { const result = await contentApi(`/api/projects/${video.id}/channel`); setDiff(result); setSelected([]); };
  useEffect(() => { reloadDiff().catch((error) => setError(error.message)); }, [video.id]);
  const run = async (fn) => { setBusy(true); setError(''); try { const saved = await fn(); setProject(saved); await onSaved(saved); await reloadDiff(); } catch (error) { setError(error.message); } finally { setBusy(false); } };
  const blocked = busy || (project.jobs || []).some((job) => ['queued', 'running', 'cancelling'].includes(job.status));
  const apply = (paths) => run(() => contentApi(`/api/projects/${video.id}/channel`, { method: 'POST', body: JSON.stringify({ paths, expectedRevision: diff.currentRevision }) }));
  return <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose(); }}><DialogContent className="content-dialog content-wide-dialog"><DialogHeader><DialogTitle>{tr(c, 'Kênh & Brief của video', 'Video channel & brief')}</DialogTitle><DialogDescription>{video.title}</DialogDescription></DialogHeader><div className="content-editor">
    <div className="content-assignment"><label>{tr(c, 'Kênh của video', 'Video channel')}<select value={channelId} onChange={(event) => setChannelId(event.target.value)}><option value="">{tr(c, 'Chưa phân kênh', 'Unassigned')}</option>{channels.map((channel) => <option key={channel.id} value={channel.id}>{channel.identity.name}</option>)}{project.channelId && !channels.some((channel) => channel.id === project.channelId) && <option value={project.channelId}>{tr(c, 'Kênh không khả dụng', 'Channel unavailable')}</option>}</select></label><Button disabled={blocked || channelId === (project.channelId || '')} variant="outline" onClick={() => run(() => contentApi(`/api/projects/${video.id}/channel`, { method: 'PATCH', body: JSON.stringify({ channelId: channelId || null }) }))}>{tr(c, 'Gán kênh, giữ cấu hình', 'Assign, keep settings')}</Button></div>
    {diff?.available ? <section className="channel-diff"><h3>{tr(c, 'Phiên bản đã nhận', 'Inherited revision')}: {project.channelRevision ?? '—'} → {diff.currentRevision}</h3><p>{tr(c, 'Chọn thay đổi muốn áp dụng. Mọi sửa đổi đều có thể hoàn tác trong phòng dựng.', 'Choose changes to apply. Every change can be undone in the production workspace.')}</p>{diff.lastAppliedRevision && <small>{tr(c, 'Lần áp dụng gần nhất từ phiên bản', 'Last applied from revision')} {diff.lastAppliedRevision}</small>}
      <div className="channel-diff-list">{diff.changes.map((change) => <label key={change.path}><input type="checkbox" checked={selected.includes(change.path)} onChange={(event) => setSelected((items) => event.target.checked ? [...items, change.path] : items.filter((path) => path !== change.path))}/><span><strong>{changeLabel(change.path, c)}{change.locallyModified && <em>{tr(c, 'Đã chỉnh riêng trong video', 'Edited in this video')}</em>}</strong><span className="channel-diff-values"><small>{tr(c, 'Hiện tại', 'Current')}: {readableValue(change.current, c)}</small><small>{tr(c, 'Từ kênh', 'From channel')}: {readableValue(change.proposed, c)}</small></span><small>{change.impact.length ? `${tr(c, 'Cần tạo lại', 'Regeneration needed')}: ${change.impact.join(' → ')}` : tr(c, 'Không ảnh hưởng bản dựng', 'No render impact')}</small></span></label>)}</div>
      {diff.changes.length ? <footer><Button variant="ghost" onClick={onClose}>{tr(c, 'Giữ cấu hình hiện tại', 'Keep current settings')}</Button><Button variant="outline" disabled={blocked} onClick={() => apply(diff.changes.map((change) => change.path))}>{tr(c, 'Áp dụng tất cả', 'Apply all')}</Button><Button disabled={blocked || !selected.length} onClick={() => apply(selected)}>{tr(c, 'Áp dụng đã chọn', 'Apply selected')} ({selected.length})</Button></footer> : <p>{tr(c, 'Không có thay đổi mới từ hồ sơ kênh.', 'No new channel profile changes.')}</p>}
    </section> : project.channelId && <p className="content-note">{tr(c, 'Không tìm thấy hồ sơ kênh. Video vẫn hoạt động với dữ liệu riêng đã lưu.', 'Channel profile unavailable. The video still works with its saved production state.')}</p>}
    <details className="profile-group"><summary><BookOpen size={17}/>{tr(c, 'Brief của video', 'Video brief')}</summary><p className="content-hint">{tr(c, 'Sửa Brief không tự viết lại kịch bản hay tạo lại media.', 'Editing the brief does not rewrite the script or regenerate media.')}</p><label>{tr(c, 'Chủ đề', 'Topic')}<Input value={brief.topic || ''} onChange={(event) => setBrief({ ...brief, topic: event.target.value })}/></label><BriefFields value={brief} onChange={setBrief} c={c}/><div className="content-fields"><label>{tr(c, 'Thời lượng mục tiêu (giây)', 'Target duration (seconds)')}<Input type="number" min="1" max="14400" value={brief.targetDurationSec || ''} onChange={(event) => setBrief({ ...brief, targetDurationSec: event.target.value ? Number(event.target.value) : null })}/></label><label>{tr(c, 'Định dạng mong muốn', 'Desired format')}<select value={brief.format || ''} onChange={(event) => setBrief({ ...brief, format: event.target.value || null })}><option value="">—</option><option value="landscape">16:9</option><option value="short">9:16</option></select></label></div><Button disabled={blocked} onClick={() => run(() => contentApi(`/api/projects/${video.id}`, { method: 'PATCH', body: JSON.stringify({ brief }) }))}><Save/>{tr(c, 'Lưu Brief', 'Save brief')}</Button></details>
    {error && <p className="content-error" role="alert">{error}</p>}
  </div></DialogContent></Dialog>;
}
