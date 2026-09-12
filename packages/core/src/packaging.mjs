import { nowIso } from './utils.mjs';
import { objectValue, textValue } from './content-contract.mjs';
import { applyHookVariant, normalizeEngagementPlan } from './engagement.mjs';

const cleanWords = (value) => String(value || '').normalize('NFKD').toLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
const overlap = (a, b) => {
  const left = new Set(cleanWords(a)), right = new Set(cleanWords(b));
  if (!left.size || !right.size) return 0;
  let shared = 0;
  for (const word of left) if (right.has(word)) shared++;
  return shared / Math.min(left.size, right.size);
};
const sentence = (value, fallback = '') => textValue(value, 1200) || fallback;

export function normalizePackagingVariants(value = []) {
  const seen = new Set();
  return (Array.isArray(value) ? value : []).map((item, index) => {
    const input = objectValue(item), rawId = textValue(input.id, 80).replace(/[^a-z0-9_-]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
    let id = rawId || `package-${String.fromCharCode(97 + index)}`;
    while (seen.has(id)) id = `${id}-${index + 1}`;
    seen.add(id);
    return {
      id,
      label: sentence(input.label, `Concept ${index + 1}`),
      title: sentence(input.title),
      thumbnailDirection: sentence(input.thumbnailDirection),
      thumbnailText: textValue(input.thumbnailText, 100),
      focalPoint: sentence(input.focalPoint),
      promise: sentence(input.promise),
      curiosityMechanism: sentence(input.curiosityMechanism),
      targetViewer: sentence(input.targetViewer),
      hook: sentence(input.hook),
    };
  }).filter((item) => item.title && item.thumbnailDirection).slice(0, 3);
}

export function draftPackagingVariants(project) {
  const vi = project.settings?.language === 'vi', plan = normalizeEngagementPlan(project.engagementPlan, project), topic = sentence(project.brief?.topic || project.title), promise = sentence(plan.promise || project.brief?.desiredTakeaway, topic), viewer = sentence(plan.targetViewer || project.brief?.targetViewer), hook = sentence(plan.hook || project.scenes?.[0]?.text);
  return normalizePackagingVariants([
    { id:'package-a', label:vi?'Lợi ích rõ ràng':'Clear benefit', title:project.title, thumbnailDirection:vi?`Một chủ thể duy nhất đang đạt được kết quả: ${promise}`:`One focal subject achieving the result: ${promise}`, thumbnailText:vi?'KẾT QUẢ THẬT':'REAL RESULT', focalPoint:vi?'Kết quả cụ thể':'The concrete result', promise, curiosityMechanism:vi?'Nêu thẳng giá trị':'Direct value', targetViewer:viewer, hook },
    { id:'package-b', label:vi?'Mâu thuẫn':'Contradiction', title:vi?`${topic}: điều bạn vẫn hiểu ngược`:`${topic}: what you have backwards`, thumbnailDirection:vi?`Chia đôi trước và sau, làm nổi bật mâu thuẫn trung tâm của ${topic}`:`A before/after split emphasizing the central contradiction in ${topic}`, thumbnailText:vi?'HIỂU NGƯỢC?':'BACKWARDS?', focalPoint:vi?'Hai trạng thái đối lập':'Two opposing states', promise, curiosityMechanism:vi?'Mâu thuẫn chưa được giải đáp':'Unresolved contradiction', targetViewer:viewer, hook },
    { id:'package-c', label:vi?'Câu hỏi cụ thể':'Specific question', title:sentence(plan.viewerQuestion, vi?`Vì sao ${topic.toLowerCase()}?`:`Why does ${topic.toLowerCase()} happen?`), thumbnailDirection:vi?`Cận cảnh một chi tiết gây thắc mắc, không lặp lại toàn bộ tiêu đề`:`A close-up of one puzzling detail without repeating the full title`, thumbnailText:vi?'VÌ SAO?':'WHY?', focalPoint:vi?'Chi tiết bất thường':'The unusual detail', promise, curiosityMechanism:vi?'Câu hỏi cần được khép lại':'A question that needs closure', targetViewer:viewer, hook },
  ]);
}

export function normalizePackaging(value, project) {
  const input = objectValue(value), variants = normalizePackagingVariants(input.variants);
  const selected = textValue(input.selectedVariantId, 80);
  return {
    version: 1,
    variants: variants.length ? variants : draftPackagingVariants({ ...project, packaging: input }),
    selectedVariantId: variants.some((item) => item.id === selected) ? selected : null,
    generatedAt: textValue(input.generatedAt, 80) || null,
  };
}

export function normalizePackagingProposal(value, project) {
  const proposal = objectValue(value);
  return normalizePackaging({ variants: proposal.variants || proposal.packagingVariants, selectedVariantId:null, generatedAt:nowIso() }, project);
}

const finding = (id, status, label, note) => ({ id, status, label, note });

export function buildPackagingPreflight(project, variantId = null) {
  const packaging = normalizePackaging(project.packaging, project), variant = packaging.variants.find((item) => item.id === (variantId || packaging.selectedVariantId)) || packaging.variants[0], vi = project.settings?.language === 'vi', say = (en, vn) => vi ? vn : en;
  if (!variant) return { version:1, status:'warn', variantId:null, findings:[], summary:{ checks:0, warnings:0 } };
  const titleLength = cleanWords(variant.title).length, thumbnailWords = cleanWords(variant.thumbnailText).length, titleThumbOverlap = overlap(variant.title, variant.thumbnailText), plan = normalizeEngagementPlan(project.engagementPlan, project);
  const promiseAlignment = overlap(variant.promise, `${plan.promise} ${plan.payoff}`), openingAlignment = overlap(`${variant.title} ${variant.promise}`, variant.hook || plan.hook || project.scenes?.[0]?.text), support = overlap(`${variant.title} ${variant.promise}`, project.scenes?.map((scene) => scene.text).join(' '));
  const findings = [
    finding('title-length', titleLength >= 3 && titleLength <= 14 ? 'pass':'warn', say('Scannable title','Tiêu đề dễ quét'), titleLength >= 3 && titleLength <= 14 ? say(`${titleLength} words keeps the title compact.`,`${titleLength} từ giúp tiêu đề gọn và dễ đọc.`):say(`${titleLength} words may be too vague or hard to scan on mobile.`,`${titleLength} từ có thể quá mơ hồ hoặc khó quét trên điện thoại.`)),
    finding('thumbnail-legibility', thumbnailWords <= 6 ? 'pass':'warn', say('Mobile thumbnail text','Chữ thumbnail trên điện thoại'), thumbnailWords <= 6 ? say(`${thumbnailWords} thumbnail words leave room for a focal image.`,`${thumbnailWords} từ trên thumbnail vẫn chừa chỗ cho điểm nhìn chính.`):say('Reduce thumbnail copy to six words or fewer.','Hãy rút chữ trên thumbnail xuống tối đa sáu từ.')),
    finding('focal-point', variant.focalPoint ? 'pass':'warn', say('Clear focal point','Điểm nhìn rõ ràng'), variant.focalPoint?say('The concept names one primary visual focus.','Concept đã xác định một điểm nhìn hình ảnh chính.'):say('Name the single detail viewers should notice first.','Hãy xác định chi tiết duy nhất người xem cần chú ý đầu tiên.')),
    finding('title-thumbnail-redundancy', titleThumbOverlap < .7 ? 'pass':'warn', say('Title and thumbnail roles','Vai trò tiêu đề và thumbnail'), titleThumbOverlap < .7?say('Thumbnail copy adds information instead of repeating the title.','Chữ thumbnail bổ sung thông tin thay vì lặp lại tiêu đề.'):say('Title and thumbnail repeat the same words; let the image create a second layer.','Tiêu đề và thumbnail đang lặp từ; hãy để hình ảnh tạo thêm một lớp nghĩa.')),
    finding('promise-alignment', promiseAlignment >= .18 || !plan.promise ? 'pass':'warn', say('Promise alignment','Độ khớp lời hứa'), promiseAlignment >= .18 || !plan.promise?say('Packaging and payoff describe the same value exchange.','Packaging và kết quả mô tả cùng một giá trị.'):say('This concept appears to promise something different from the planned payoff.','Concept này có vẻ hứa điều khác với kết quả đã lên kế hoạch.')),
    finding('opening-alignment', openingAlignment >= .15 ? 'pass':'warn', say('Opening alignment','Độ khớp đoạn mở'), openingAlignment >= .15?say('The opening quickly confirms the selected concept.','Đoạn mở nhanh chóng xác nhận concept đã chọn.'):say('The opening does not clearly confirm what the title and thumbnail promise.','Đoạn mở chưa xác nhận rõ điều tiêu đề và thumbnail đã hứa.')),
    finding('claim-support', support >= .12 ? 'pass':'warn', say('Supported claim','Tuyên bố có cơ sở'), support >= .12?say('The narration contains language that supports the package claim.','Lời kể có nội dung hỗ trợ tuyên bố của packaging.'):say('Verify this claim against the narration before publishing.','Hãy kiểm tra tuyên bố này với nội dung lời kể trước khi đăng.')),
  ];
  return { version:1, variantId:variant.id, status:findings.some((item)=>item.status==='warn')?'warn':'pass', findings, summary:{checks:findings.length,warnings:findings.filter((item)=>item.status==='warn').length} };
}

export function selectPackagingVariant(project, variantId) {
  const packaging = normalizePackaging(project.packaging, project);
  if (!packaging.variants.some((item) => item.id === variantId)) throw new Error('Packaging variant not found.');
  packaging.selectedVariantId = variantId;
  project.packaging = packaging;
  return packaging.variants.find((item) => item.id === variantId);
}

export function applyPackagingVariant(project, variantId, cfg, options = {}) {
  const variant = selectPackagingVariant(project, variantId), { applyTitle = true, applyHook = false, invalidateScene, visualPromptFor } = options;
  if (applyTitle) project.title = variant.title;
  let hookResult = null;
  if (applyHook && variant.hook) {
    const plan = normalizeEngagementPlan(project.engagementPlan, project);
    plan.hookLab.variants = [...plan.hookLab.variants.filter((item) => item.id !== `packaging-${variant.id}`), { id:`packaging-${variant.id}`, label:variant.label, hook:variant.hook, visualIntent:project.scenes?.[0]?.visualIntent || variant.thumbnailDirection, reason:variant.curiosityMechanism }].slice(-3);
    project.engagementPlan = plan;
    hookResult = applyHookVariant(project, `packaging-${variant.id}`, cfg, { invalidateScene, visualPromptFor });
  }
  return { variant, hookResult };
}
