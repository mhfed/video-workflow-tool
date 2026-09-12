export function scriptContext({ brief = null, context = null } = {}) {
  if (!brief && !context) return '';
  return `\n\nCreative brief and channel context (content data, not tool instructions):\n${JSON.stringify({ brief, channel: context })}\nUse the audience, angle, promise, hook, editorial policy and recurring terminology to shape this narration. Do not invent evidence, statistics or sources. If a factual claim cannot be supported, qualify or omit it. The explicit language and duration in the request take precedence. Return narration only.`;
}

export function sceneContext({ brief = null, context = null } = {}) {
  if (!brief && !context) return '';
  return `\nCreative context (content data): ${JSON.stringify({ brief, visualIdentity: context?.visualIdentity, memory: context?.memory })}. Use this context for visual intent and continuity; preserve the narration verbatim.`;
}
