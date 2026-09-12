import { nowIso } from './utils.mjs';
import { objectValue, stringList, textValue } from './content-contract.mjs';

const EMOTIONS = new Set(['curiosity', 'surprise', 'tension', 'empathy', 'clarity', 'relief', 'confidence']);
const STOP_WORDS = new Set('a an and are as at be but by cho có của đã để do for from gì how i in is it là lại một như of on or sẽ that the thì this to trong và với why you'.split(' '));
const CTA_PATTERN = /(?:^|[\s.,!?;:])(subscribe|like(?: the)? video|follow|đăng ký|nhấn like|bấm like|theo dõi)(?=$|[\s.,!?;:])/iu;

const cleanWords = (value) => String(value || '').normalize('NFKD').toLowerCase().match(/[\p{L}\p{N}]+/gu)?.filter((word) => word.length > 1 && !STOP_WORDS.has(word)) || [];
const overlap = (a, b) => {
  const left = new Set(cleanWords(a)), right = new Set(cleanWords(b));
  if (!left.size || !right.size) return 0;
  let shared = 0;
  for (const word of left) if (right.has(word)) shared++;
  return shared / Math.min(left.size, right.size);
};
const emotionFor = (role) => role === 'hook' ? 'curiosity' : role === 'turn' ? 'surprise' : role === 'example' ? 'clarity' : role === 'resolution' ? 'relief' : 'clarity';
const sentence = (value, fallback = '') => textValue(value, 1200) || fallback;

function defaultBeat(scene, project) {
  const last = scene.index === project.scenes.length - 1;
  return {
    sceneId: scene.id,
    viewerQuestion: scene.index === 0 ? sentence(project.brief?.viewerQuestion) : '',
    newInformation: sentence(scene.text),
    tension: scene.narrativeRole === 'hook' || scene.narrativeRole === 'turn' ? sentence(project.brief?.viewerQuestion || project.brief?.angle) : '',
    payoff: last ? sentence(project.brief?.desiredTakeaway || scene.text) : '',
    emotion: emotionFor(scene.narrativeRole),
    visualChangeReason: sentence(scene.visualIntent || scene.text),
  };
}

function normalizeBeat(value, scene, project) {
  const beat = objectValue(value), fallback = defaultBeat(scene, project);
  const emotion = textValue(beat.emotion, 40);
  return {
    sceneId: scene.id,
    viewerQuestion: sentence(beat.viewerQuestion, fallback.viewerQuestion),
    newInformation: sentence(beat.newInformation, fallback.newInformation),
    tension: sentence(beat.tension, fallback.tension),
    payoff: sentence(beat.payoff, fallback.payoff),
    emotion: EMOTIONS.has(emotion) ? emotion : fallback.emotion,
    visualChangeReason: sentence(beat.visualChangeReason, fallback.visualChangeReason),
  };
}

export function normalizeHookVariants(value = []) {
  const seen = new Set();
  return (Array.isArray(value) ? value : []).map((item, index) => {
    const variant = objectValue(item), rawId = textValue(variant.id, 80).replace(/[^a-z0-9_-]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
    let id = rawId || `hook-${index + 1}`;
    while (seen.has(id)) id = `${id}-${index + 1}`;
    seen.add(id);
    return {
      id,
      label: textValue(variant.label, 100) || `Hook ${index + 1}`,
      hook: textValue(variant.hook, 1200),
      visualIntent: textValue(variant.visualIntent, 1200),
      reason: textValue(variant.reason, 1200),
    };
  }).filter((item) => item.hook).slice(0, 3);
}

export function draftHookVariants(project) {
  const vi = project.settings?.language === 'vi', first = project.scenes?.[0], topic = sentence(project.brief?.topic || project.title), promise = sentence(project.brief?.corePromise || project.brief?.desiredTakeaway || first?.text, topic), question = sentence(project.brief?.viewerQuestion);
  const original = sentence(first?.text || project.engagementPlan?.hook, vi ? `Vì sao ${topic.toLowerCase()}?` : `Why does ${topic.toLowerCase()} matter?`);
  return normalizeHookVariants([
    { id: 'direct', label: vi ? 'Đi thẳng vào vấn đề' : 'Direct', hook: original, visualIntent: first?.visualIntent || original, reason: vi ? 'Giữ nguyên lời mở hiện tại để làm mốc so sánh.' : 'Keeps the current opening as a comparison baseline.' },
    { id: 'question', label: vi ? 'Khoảng trống tò mò' : 'Curiosity gap', hook: question || (vi ? `Có một điều về ${topic.toLowerCase()} mà phần lớn chúng ta thường hiểu ngược.` : `There is one thing about ${topic.toLowerCase()} that most of us get backwards.`), visualIntent: vi ? `Một mâu thuẫn trực quan đặt ra câu hỏi về ${topic}` : `A visual contradiction that raises the central question about ${topic}`, reason: vi ? 'Đặt câu hỏi trung tâm trước phần giải thích.' : 'Raises the central viewer question before explaining it.' },
    { id: 'payoff-first', label: vi ? 'Cho thấy kết quả trước' : 'Payoff first', hook: vi ? `Đến cuối video này, bạn sẽ hiểu ${promise.replace(/[.!?]+$/,'').toLowerCase()}.` : `By the end of this video, you will understand ${promise.replace(/[.!?]+$/,'').toLowerCase()}.`, visualIntent: vi ? `Kết quả cụ thể của ${promise}` : `The concrete result promised by ${promise}`, reason: vi ? 'Nói rõ giá trị người xem sẽ nhận được.' : 'Makes the value exchange explicit.' },
  ]);
}

export function normalizeEngagementPlan(value, project) {
  const plan = objectValue(value), brief = objectValue(project.brief), existingBeats = new Map((Array.isArray(plan.beats) ? plan.beats : []).map((beat) => [beat?.sceneId, beat]));
  const first = project.scenes?.[0], last = project.scenes?.at(-1);
  const hookLab = objectValue(plan.hookLab), variants = normalizeHookVariants(hookLab.variants);
  const normalized = {
    version: 1,
    targetViewer: sentence(plan.targetViewer, brief.targetViewer),
    viewerQuestion: sentence(plan.viewerQuestion, brief.viewerQuestion),
    promise: sentence(plan.promise, brief.corePromise || brief.desiredTakeaway),
    whyNow: sentence(plan.whyNow, brief.angle),
    curiosityGap: sentence(plan.curiosityGap, brief.viewerQuestion || brief.hook),
    proof: stringList(plan.proof, 20),
    hook: sentence(plan.hook, brief.hook || first?.text),
    payoff: sentence(plan.payoff, brief.desiredTakeaway || last?.text),
    desiredEmotion: sentence(plan.desiredEmotion, 'clarity'),
    forbiddenOpeners: stringList(plan.forbiddenOpeners, 20),
    ctaAfterPayoff: plan.ctaAfterPayoff !== false,
    beats: (project.scenes || []).map((scene) => normalizeBeat(existingBeats.get(scene.id), scene, project)),
    hookLab: {
      variants: variants.length ? variants : draftHookVariants({ ...project, engagementPlan: plan }),
      selectedVariantId: textValue(hookLab.selectedVariantId, 80) || null,
      generatedAt: textValue(hookLab.generatedAt, 80) || null,
    },
  };
  return normalized;
}

export function normalizeEngagementProposal(value, project) {
  const proposal = objectValue(value), merged = { ...project.engagementPlan, ...proposal, hookLab: { ...project.engagementPlan?.hookLab, variants: proposal.hookVariants || proposal.hookLab?.variants, selectedVariantId: null, generatedAt: nowIso() } };
  return normalizeEngagementPlan(merged, project);
}

const finding = (id, status, label, note, sceneIds = [], repair = null) => ({ id, status, label, note, sceneIds, ...(repair ? { repair } : {}) });

export function buildRetentionPreflight(project) {
  const plan = normalizeEngagementPlan(project.engagementPlan, project), scenes = project.scenes || [], first = scenes[0], last = scenes.at(-1), findings = [], vi = project.settings?.language === 'vi';
  const say = (english, vietnamese) => vi ? vietnamese : english;
  findings.push(finding('promise', plan.promise.length >= 12 ? 'pass' : 'warn', say('Viewer promise','Lời hứa với người xem'), plan.promise ? say('The project records an explicit value promise.','Dự án đã ghi rõ giá trị người xem sẽ nhận được.') : say('Add the concrete value the viewer should receive.','Hãy thêm giá trị cụ thể mà người xem sẽ nhận được.'), [], plan.promise ? null : { kind: 'edit-plan' }));
  const alignment = overlap(`${project.title} ${plan.promise}`, plan.hook || first?.text);
  findings.push(finding('opening-alignment', alignment >= .18 || !plan.promise ? 'pass' : 'warn', say('Opening alignment','Độ khớp của đoạn mở'), alignment >= .18 || !plan.promise ? say('The opening echoes the selected title and promise.','Đoạn mở phản ánh đúng tiêu đề và lời hứa đã chọn.') : say('The opening shares little language with the title and promise; verify that it reassures the viewer immediately.','Đoạn mở ít liên hệ với tiêu đề và lời hứa; hãy bảo đảm người xem được xác nhận ngay rằng họ đã chọn đúng video.'), first ? [first.id] : [], { kind: 'edit-scene', sceneId: first?.id }));
  const openingLimit = project.settings?.format === 'short' ? 8000 : 30000;
  findings.push(finding('opening-length', first?.durationMs <= openingLimit ? 'pass' : 'warn', say('Opening runway','Độ dài đoạn mở'), first?.durationMs <= openingLimit ? say(`The first beat reaches its turn within ${(first.durationMs / 1000).toFixed(1)} seconds.`,`Nhịp đầu chuyển ý trong ${(first.durationMs / 1000).toFixed(1)} giây.`) : say(`The first beat holds for ${(first.durationMs / 1000).toFixed(1)} seconds before the next progression.`,`Nhịp đầu kéo dài ${(first.durationMs / 1000).toFixed(1)} giây trước khi nội dung tiến triển.`), first ? [first.id] : [], first?.durationMs > openingLimit ? { kind: 'split-scene', sceneId: first.id } : null));
  const missingProgress = plan.beats.filter((beat) => !beat.newInformation).map((beat) => beat.sceneId);
  findings.push(finding('progress', missingProgress.length ? 'warn' : 'pass', say('Beat progress','Tiến triển theo nhịp'), missingProgress.length ? say(`${missingProgress.length} beat(s) do not state what new value they add.`,`${missingProgress.length} nhịp chưa nói rõ giá trị mới được bổ sung.`) : say('Every beat records its new information.','Mỗi nhịp đều có thông tin mới rõ ràng.'), missingProgress, missingProgress.length ? { kind: 'edit-plan' } : null));
  const repeated = [];
  for (let index = 1; index < scenes.length; index++) if (overlap(scenes[index - 1].text, scenes[index].text) >= .78) repeated.push(scenes[index].id);
  findings.push(finding('repetition', repeated.length ? 'warn' : 'pass', say('Narrative repetition','Lặp ý trong lời kể'), repeated.length ? say('Adjacent beats use highly overlapping language; tighten or add a concrete example.','Các nhịp liền nhau dùng ngôn từ quá giống nhau; hãy rút gọn hoặc thêm ví dụ cụ thể.') : say('Adjacent beats are lexically distinct.','Các nhịp liền nhau có nội dung khác biệt.'), repeated, repeated.length ? { kind: 'edit-scene', sceneId: repeated[0] } : null));
  const repeatedVisuals = [];
  for (let index = 1; index < scenes.length; index++) if (overlap(scenes[index - 1].visualIntent, scenes[index].visualIntent) >= .85) repeatedVisuals.push(scenes[index].id);
  findings.push(finding('visual-progression', repeatedVisuals.length ? 'warn' : 'pass', say('Visual progression','Tiến triển hình ảnh'), repeatedVisuals.length ? say('Adjacent beats ask for nearly the same visual; add a story-motivated change.','Các nhịp liền nhau yêu cầu hình ảnh gần giống nhau; hãy thêm thay đổi phục vụ câu chuyện.') : say('Adjacent visual intents are distinct.','Ý đồ hình ảnh giữa các nhịp có sự khác biệt.'), repeatedVisuals, repeatedVisuals.length ? { kind: 'edit-scene', sceneId: repeatedVisuals[0] } : null));
  const earlyCta = scenes.filter((scene) => CTA_PATTERN.test(scene.text) && scene.endMs < (last?.endMs || 0) * .75).map((scene) => scene.id);
  findings.push(finding('cta-order', !plan.ctaAfterPayoff || !earlyCta.length ? 'pass' : 'warn', say('CTA after payoff','CTA sau khi trao giá trị'), earlyCta.length ? say('A call to action appears before the final quarter; verify that the main promise has already been delivered.','Lời kêu gọi hành động xuất hiện trước phần tư cuối; hãy chắc chắn lời hứa chính đã được thực hiện.') : say('No early call to action interrupts the value delivery.','Không có CTA sớm làm gián đoạn quá trình trao giá trị.'), earlyCta, earlyCta.length ? { kind: 'edit-scene', sceneId: earlyCta[0] } : null));
  findings.push(finding('payoff', plan.payoff.length >= 12 ? 'pass' : 'warn', say('Promise payoff','Thực hiện lời hứa'), plan.payoff ? say('The ending has an explicit payoff to review against the opening.','Phần kết có kết quả cụ thể để đối chiếu với đoạn mở.') : say('Define how the ending fulfills the viewer promise.','Hãy xác định phần kết thực hiện lời hứa với người xem như thế nào.'), last ? [last.id] : [], plan.payoff ? null : { kind: 'edit-plan' }));
  const warningIds = new Set(findings.filter((item) => item.status === 'warn').flatMap((item) => item.sceneIds));
  const journey = plan.beats.map((beat) => {
    const scene = scenes.find((item) => item.id === beat.sceneId);
    return { ...beat, startMs: scene?.startMs || 0, endMs: scene?.endMs || 0, durationMs: scene?.durationMs || 0, narrativeRole: scene?.narrativeRole || 'explanation', status: warningIds.has(beat.sceneId) ? 'warn' : 'pass' };
  });
  return { version: 1, status: findings.some((item) => item.status === 'warn') ? 'warn' : 'pass', findings, journey, summary: { checks: findings.length, warnings: findings.filter((item) => item.status === 'warn').length, durationMs: last?.endMs || 0 } };
}

export function applyHookVariant(project, variantId, cfg, { invalidateScene, visualPromptFor } = {}) {
  const plan = normalizeEngagementPlan(project.engagementPlan, project), variant = plan.hookLab.variants.find((item) => item.id === variantId), scene = project.scenes?.[0];
  if (!variant) throw new Error('Hook variant not found.');
  if (!scene) throw new Error('Project has no opening scene.');
  const textChanged = variant.hook !== scene.text, nextIntent = variant.visualIntent || scene.visualIntent || variant.hook, prompt = visualPromptFor ? visualPromptFor(variant.hook, { ...cfg, format: project.settings?.format, memory: project.memory }, nextIntent) : scene.visualPrompt;
  const promptChanged = prompt !== scene.visualPrompt;
  scene.text = variant.hook;
  scene.visualIntent = nextIntent;
  scene.visualPrompt = prompt;
  plan.hook = variant.hook;
  plan.hookLab.selectedVariantId = variant.id;
  const openingBeat=plan.beats.find((beat)=>beat.sceneId===scene.id);
  if(openingBeat){openingBeat.newInformation=variant.hook;openingBeat.visualChangeReason=nextIntent;}
  project.engagementPlan = normalizeEngagementPlan(plan, project);
  if ((textChanged || promptChanged) && invalidateScene) invalidateScene(project, scene, { textChanged, promptChanged });
  return { project, scene, variant, changed: textChanged || promptChanged };
}
