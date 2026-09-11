import { planDirectionOpenAI } from './openai.mjs';
import { planDirectionCodex } from './codex.mjs';

const ACTIONS=new Set(['update_scene','split_scene','regenerate_visual','regenerate_voice','regenerate_clip','noop']);
const STAGES=new Set(['script','voice','visual','clip','final']);
const clean=(value,max)=>typeof value==='string'?value.trim().slice(0,max):'';

function localProposal(instruction,scene,language='vi') {
  const input=clean(instruction,2000),lower=input.toLocaleLowerCase(language);
  const vi=language!=='en';
  if(/\b(tách|chia đôi|split)\b/.test(lower))return {summary:vi?'Tách cảnh này thành hai nhịp kể.':'Split this scene into two beats.',action:'split_scene',changes:{text:null,visualIntent:null},impact:['script','voice','visual','clip','final'],note:vi?'Hai cảnh mới sẽ được render độc lập; các cảnh khác được giữ nguyên.':'The two resulting scenes will render independently; other scenes stay untouched.'};
  if(/(tạo lại|làm lại|regenerate|another take).*(giọng|voice)|(giọng|voice).*(tạo lại|làm lại|regenerate|another take)/.test(lower))return {summary:vi?'Tạo một lượt giọng đọc mới cho cảnh này.':'Generate another voice take for this scene.',action:'regenerate_voice',changes:{text:null,visualIntent:null},impact:['voice','clip','final'],note:vi?'Hình ảnh được giữ nguyên.':'The visual stays unchanged.'};
  if(/(tạo lại|làm lại|regenerate|another take).*(clip|video)|(clip|video).*(tạo lại|làm lại|regenerate|another take)/.test(lower))return {summary:vi?'Dựng lại clip của cảnh này.':'Render this scene clip again.',action:'regenerate_clip',changes:{text:null,visualIntent:null},impact:['clip','final'],note:vi?'Giọng và hình hiện tại sẽ được tái sử dụng.':'The current voice and visual will be reused.'};
  if(/(tạo lại|làm lại|regenerate|another take).*(hình|ảnh|visual|image)|(hình|ảnh|visual|image).*(tạo lại|làm lại|regenerate|another take)/.test(lower))return {summary:vi?'Tạo một lượt hình ảnh mới cho cảnh này.':'Generate another visual for this scene.',action:'regenerate_visual',changes:{text:null,visualIntent:null},impact:['visual','clip','final'],note:vi?'Lời thoại và giọng đọc được giữ nguyên.':'Narration and voice stay unchanged.'};
  const narration=input.match(/(?:lời thoại|kịch bản|narration|script)\s*:\s*([\s\S]+)/i)?.[1]?.trim();
  if(narration)return {summary:vi?'Thay lời thoại của cảnh bằng phiên bản mới.':'Replace this scene narration.',action:'update_scene',changes:{text:narration,visualIntent:null},impact:['script','voice','clip','final'],note:vi?'Hình ảnh hiện tại được giữ lại cho đến khi bạn đổi ý đồ hình.':'The current visual stays until you change its direction.'};
  return {summary:vi?'Cập nhật ý đồ hình ảnh theo chỉ dẫn này.':'Update the visual direction with this instruction.',action:'update_scene',changes:{text:null,visualIntent:input},impact:['visual','clip','final'],note:vi?'CUTROOM sẽ tự biên dịch thành prompt kỹ thuật; bạn chỉ cần mô tả điều muốn thấy.':'CUTROOM compiles the technical prompt; describe only what you want to see.'};
}

export function normalizeDirectorProposal(value,language='vi') {
  const vi=language!=='en',action=ACTIONS.has(value?.action)?value.action:'noop';
  const text=clean(value?.changes?.text,10000)||null;
  const visualIntent=clean(value?.changes?.visualIntent,2000)||null;
  return {
    summary:clean(value?.summary,500)||(vi?'Chưa tìm thấy thay đổi an toàn.':'No safe change was found.'),
    action,
    changes:{text,visualIntent},
    impact:[...new Set(Array.isArray(value?.impact)?value.impact.filter((stage)=>STAGES.has(stage)):[])],
    note:clean(value?.note,500)||(vi?'Kiểm tra đề xuất trước khi áp dụng.':'Review the proposal before applying it.'),
  };
}

export async function planSceneDirection({instruction,scene,project,cfg}) {
  const input=clean(instruction,2000);
  if(!input)throw new Error('Director instruction is required.');
  const language=project.settings?.language||cfg.contentLanguage||'vi';
  const provider=cfg.mockMode?'mock':cfg.textProvider;
  const proposal=provider==='mock'?localProposal(input,scene,language):provider==='codex'?await planDirectionCodex({instruction:input,scene,project},cfg):await planDirectionOpenAI({instruction:input,scene,project},cfg);
  return normalizeDirectorProposal(proposal,language);
}
