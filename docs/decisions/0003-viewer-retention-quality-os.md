# ADR-0003: Viewer retention and satisfaction quality loop

Status: Proposed

Date: 2026-09-13

## Context

CUTROOM currently has a strong local-first production contract. `project.json`
owns the workflow, scene-level invalidation prevents unrelated reruns, providers
and renderers are replaceable, and the offline mock + simple-renderer path can
exercise the complete pipeline.

The existing quality system is primarily technical. It checks visual crop, safe
area, unwanted text, style continuity, silence, clipping, speech rate and
pronunciation. Those checks can tell the owner whether an artifact is usable,
but they cannot yet tell whether a viewer is likely to choose the video, remain
interested, or feel that the time spent was worthwhile.

The current content path also has structural limits:

- Briefs capture a hook and promise, but title, thumbnail, opening and payoff are
  not treated as one audience-facing contract.
- Script generation asks for a strong hook and logical story, but does not return
  an inspectable retention plan.
- Semantic planning partitions an already-written script while preserving every
  word. It cannot repair a weak narrative before media generation.
- A scene normally has one visual intent. A technically valid video can therefore
  remain visually static or repetitive for too long.
- Audio QA measures average pacing, silence and peaks, but not local prosody,
  monotony, dialogue masking or semantic emphasis.
- No real YouTube retention observation is imported and mapped back to scenes.
  Channel learning therefore cannot distinguish evidence from creative opinion.

YouTube describes content performance through three related questions:

1. **Appeal:** did the viewer choose to watch?
2. **Engagement:** after starting, did the viewer continue watching?
3. **Satisfaction:** did the viewer enjoy or value the video?

The product should improve all three. Completion rate alone is not the objective:
a short misleading video can have high completion while disappointing viewers,
and a useful long video can satisfy a viewer without every viewer reaching the
last frame.

## Decision

Add a viewer-quality loop to CUTROOM based on **Promise → Progress → Payoff**.

- **Promise** binds the target viewer, idea, title, thumbnail and opening.
- **Progress** requires each narrative beat to add information, raise or resolve
  tension, supply evidence, or create a justified visual change.
- **Payoff** verifies that the video fulfills its promise before asking for a CTA.

This loop will be implemented incrementally. It will combine explainable
pre-publish checks with post-publish YouTube observations. It will not claim to
predict retention percentages before publication, fabricate performance scores,
or silently rewrite channel policy.

## Product principles

### Optimize for the viewer, not a generic algorithm

There is no universal cut frequency, hook formula or ideal duration. Defaults may
offer a starting point, but thresholds must be format-aware and later learn from
the selected channel's own audience.

### Deliver before asking

The opening must reassure the viewer that the title and thumbnail promise will be
fulfilled. The CTA should normally follow the main payoff, not interrupt the
value delivery.

### Make quality findings explainable

Preflight results are evidence-backed warnings such as "the first concrete
example appears after 42 seconds" or "this visual is unchanged for 18 seconds."
They are not opaque scores such as "predicted retention: 83%."

### Preserve owner control

Analytics create observations and hypotheses. A learning affects future videos
only after the owner explicitly adopts it into a new Channel revision.

### Preserve local-first production

Analytics availability must never be required to create, open, edit, render or
copy a project. A missing Channel, disconnected YouTube account or unavailable
analytics service must not make an existing video unrenderable.

## Proposed project contract

The exact version migration will be decided during implementation. The intended
shape is additive and provider-neutral.

```json
{
  "engagementPlan": {
    "version": 1,
    "targetViewer": "",
    "viewerQuestion": "",
    "promise": "",
    "whyNow": "",
    "curiosityGap": "",
    "proof": [],
    "hook": "",
    "payoff": "",
    "desiredEmotion": "",
    "forbiddenOpeners": [],
    "ctaAfterPayoff": true,
    "beats": [
      {
        "sceneId": "scene-001",
        "viewerQuestion": "",
        "newInformation": "",
        "tension": "",
        "payoff": "",
        "emotion": "curiosity",
        "visualChangeReason": ""
      }
    ]
  },
  "packaging": {
    "version": 1,
    "variants": [
      {
        "id": "package-a",
        "title": "",
        "thumbnailDirection": "",
        "promise": "",
        "curiosityMechanism": "",
        "targetViewer": ""
      }
    ],
    "selectedVariantId": null
  }
}
```

`engagementPlan` is planning state, not a provider request payload. Provider-
specific model names, parameters and response metadata remain inside adapters.

Changing only preflight notes, analytics or an unadopted hypothesis must not
invalidate media. Applying a narration change invalidates only the affected
scene's voice and downstream artifacts. Applying a visual or motion change keeps
the existing scene-scoped invalidation rules.

## Retention preflight

Add a viewer-oriented preflight before expensive media generation and again on
the assembled rough cut.

### Story checks

- Opening and selected packaging make the same honest promise.
- The video reaches useful, concrete material without unnecessary greeting,
  channel introduction or repeated setup.
- Every beat contributes new information, tension, evidence, an example, a turn
  or a payoff.
- Repeated claims and abstract sections without examples are identified.
- Open loops are resolved rather than forgotten.
- The main payoff fulfills the original promise.
- CTA placement does not interrupt the promised value.

### Temporal visual checks

- Longest period without a meaningful visual change.
- Repeated composition, subject or B-roll across adjacent scenes.
- Visual transitions aligned with semantic turns rather than arbitrary timers.
- Important subjects and captions remain inside format-specific safe areas.
- Caption coverage, timing, contrast and semantic line breaking.
- Mobile-size preview for both landscape packaging and vertical Shorts.

### Audio checks

- Local speech rate and pauses in short windows, not only one scene-wide WPM.
- Excessively flat energy or pitch across consecutive beats.
- Integrated loudness and true-peak consistency.
- Dialogue masking from background music or effects.
- Emphasis and pause instructions aligned with hook, turn, proof and payoff.

The preflight should return small, scene-addressable repair proposals. It must not
force a full project rerun when one finding affects one scene.

## Hook Lab

For generated narration, produce several genuinely different opening approaches,
for example result-first, tension-first and counterintuitive-observation-first.
The approaches are options, not universal formulas.

The UI should let the owner compare:

- Title and thumbnail direction.
- Exact viewer promise.
- Opening narration.
- First visual beat.
- A short rendered preview when media is available.
- Which scenes and cached artifacts would be invalidated by selection.

Imported scripts and SRT files remain authoritative. The Hook Lab may suggest a
revision but must not silently rewrite them.

## Retention-aware story map

Extend narrative roles beyond `hook`, `example`, `turn`, `explanation` and
`resolution` with neutral beat metadata rather than renderer-specific commands.
The authoring provider may propose tension, reveal, evidence, reset and payoff
roles, while the canonical scene remains valid when optional metadata is absent.

The story planner should operate in two passes:

1. Plan and review the complete viewer journey.
2. Partition the approved narration into renderable semantic scenes.

This avoids using the scene partitioner to compensate for a weak script after it
has already been written.

## Motion and visual progression

Introduce a provider- and renderer-neutral `motionPlan` only after the retention
plan is stable. Candidate actions include punch-in, reframe, reveal, highlight,
diagram step, B-roll cut, kinetic keyword and semantic transition.

Motion must be motivated by the story. CUTROOM will not impose a rule such as
"change the frame every two seconds." Unmotivated motion can increase cognitive
load and make every output look like the same template.

Renderer adapters decide how to realize the plan. Unsupported actions must fall
back safely. The simple renderer and mock providers must retain a deterministic,
offline smoke-test path.

## Captions and voice

Move toward word- or phrase-level caption timing while continuing to export a
standard subtitle artifact such as WebVTT or SRT. Burned-in captions remain an
optional renderer treatment rather than the only accessibility path.

Caption rendering should support:

- Semantic phrase grouping.
- Channel-specific typography and color.
- Selective keyword emphasis.
- Format-specific safe areas.
- Transcription comparison before publication.

Voice planning should allow beat-level direction such as energy, emphasis, pause
and speed without leaking provider-specific fields into `project.json`.

## Packaging Lab

Generate and compare up to three materially different title/thumbnail/hook
concepts. Each variant records the intended viewer, promise and curiosity
mechanism so that a visually different thumbnail cannot silently change what the
video claims to deliver.

Packaging QA should check:

- Legibility at mobile thumbnail size.
- Clear focal point and visual hierarchy.
- Excessive or duplicated text.
- Redundancy between title and thumbnail.
- Semantic alignment with the opening and payoff.
- Misleading or unsupported claims.

For eligible long-form videos, the product may later assist with YouTube's native
title and thumbnail A/B testing. Native A/B testing currently selects a winner by
watch time and is not available for Shorts. CUTROOM must not simulate a causal A/B
result by sequentially comparing unrelated upload periods.

## YouTube observation loop

### Initial local-first path

Begin with manual JSON/CSV import or explicit metric entry. This lets the data
contract and UI mature without making OAuth a prerequisite.

### Read-only connection

Later add YouTube OAuth with the narrowest read-only scopes required for channel
identity and analytics. Tokens are secrets and must never be written to
`project.json`, `channel.json`, logs or version control.

The connector should collect available observations such as:

- Views and impressions.
- Click-through rate where available.
- Average view duration and average percentage viewed.
- `audienceWatchRatio` over `elapsedVideoTimeRatio`.
- `relativeRetentionPerformance` compared with videos of similar length.
- Likes, shares and subscriber gain where available.
- Shorts-specific viewed-versus-swiped and engaged-view metrics where available.

Analytics typically arrive after publication rather than synchronously. Imports
are timestamped observations, never live truth inferred from missing data.

### Scene mapping

Map each retention bucket onto the canonical project timeline and scene IDs. The
UI can then distinguish:

- Dips: likely skips or exits that need review.
- Flat sections: stable attention.
- Spikes: possible interest, sharing, replay or confusion.
- Retention changes near hook, example, reveal, payoff and CTA boundaries.

Retention above 100 percent can be valid when viewers replay a segment. A spike
must not automatically be labeled "good" without reviewing whether the section
was compelling or unclear.

## Channel learning

A learning record is a dated, reviewable hypothesis with evidence:

```json
{
  "status": "hypothesis",
  "statement": "Concrete examples introduced early retain this audience better than abstract setup.",
  "supportingVideoIds": [],
  "observationIds": [],
  "comparisonContext": {
    "format": "landscape",
    "durationBand": "4-8m",
    "traffic": "organic"
  },
  "confidence": "low",
  "createdAt": ""
}
```

Do not infer a durable rule from one upload. Comparisons should control for format,
duration and traffic source when possible. An adopted learning creates an explicit
Channel revision and applies only to future videos unless the owner deliberately
applies it to an existing project.

Learning and raw analytics must never participate in render cache signatures.

## Metrics

No single metric is the north star for every format.

### Long-form

- Appeal: impressions and CTR.
- Engagement: average view duration, average percentage viewed, intro retention,
  audience watch ratio and relative retention.
- Satisfaction: likes, shares, subscriber gain, returning-viewer trends and owner
  review of comments or survey signals when available.
- Packaging experiment outcome: native watch-time winner rather than CTR-only
  winner.

### Shorts

- Appeal: percentage who chose to view versus swiped away.
- Engagement: engaged views, average view duration, average percentage viewed and
  replay patterns when available.
- Satisfaction: likes, shares, subscriber gain and repeat audience behavior.

Metrics from Shorts and long-form must not be compared as if they have identical
view definitions or discovery surfaces.

## Delivery phases

### Phase 1 — Retention OS v1

- Add the additive engagement-plan contract.
- Add Hook Lab and Promise → Progress → Payoff story preflight.
- Show an explainable viewer-journey timeline in the Director.
- Produce scene-addressable repair proposals.
- Keep imported scripts and SRT authoritative.

### Phase 2 — Packaging Lab

- Generate three distinct packaging concepts.
- Add mobile preview and packaging/opening/payoff alignment checks.
- Record the selected variant without invalidating media unless its hook or visual
  content is explicitly applied.

### Phase 3 — Observation ingestion

- Define versioned observation records.
- Support manual import first.
- Add read-only YouTube OAuth and Analytics API retrieval afterward.
- Map retention buckets to scenes without changing render state.

### Phase 4 — Temporal QA

- Analyze the assembled rough cut for static visuals and repetition.
- Add phrase-level caption timing and transcription review.
- Add local prosody, loudness, peak and dialogue-masking checks.

### Phase 5 — Renderer motion plan

- Add neutral motion-plan actions.
- Implement adapter-specific realization incrementally.
- Preserve deterministic fallbacks and scene-level cache identities.

### Phase 6 — Evidence-backed Channel learning

- Create hypothesis records from comparable observations.
- Require explicit owner adoption.
- Revise Channel policy only through the existing revision flow.

## Architecture constraints

- `project.json` remains the canonical workflow state.
- Editing one beat or scene must not require a full rerun.
- Analytics, preflight results and unadopted learning do not enter render cache
  keys.
- Provider-specific fields stay inside provider adapters.
- Renderer-specific implementation details stay inside renderer adapters.
- OAuth tokens and credentials are local secrets and are never committed.
- A copied project remains renderable without its Channel or analytics history.
- The simple renderer and mock providers remain an offline smoke-test path.
- Generated thumbnails, previews and videos remain ignored media artifacts.
- Legacy projects normalize additively and do not rewrite merely by being read.

## Risks and mitigations

### Clickbait optimization

High CTR can conflict with satisfaction. Packaging must be checked against the
actual opening and payoff, and experiments should prefer watch-time/satisfaction
outcomes over CTR alone.

### Fabricated precision

An LLM cannot reliably predict an exact retention percentage. Use explainable
rubrics and real post-publish observations; do not invent a synthetic probability.

### Noisy or confounded data

Early viewers, traffic sources, topics and formats can differ. Store observation
context, compare similar videos and retain uncertainty instead of declaring a
rule after one result.

### Over-editing

Forced cuts and constant motion can reduce clarity. Visual change recommendations
must refer to a semantic event or measured static section.

### Analytics dependency

OAuth or API failure must degrade to manual/local operation and never block the
production pipeline.

### State and cache coupling

Keep observation/learning records outside artifact cache identities. Only an
explicitly adopted creative or production change triggers normal scoped
invalidation.

## Non-goals

- Guarantee that every viewer watches to the final frame.
- Reverse engineer or claim knowledge of a fixed YouTube algorithm.
- Auto-publish, auto-change titles or silently alter Channel DNA in the first
  implementation.
- Generate fake analytics, retention curves or confidence scores.
- Force one hook style, duration, caption style or cut frequency on every channel.
- Require cloud services for the offline mock + simple-renderer workflow.

## Research basis

- YouTube frames performance as appeal, engagement and satisfaction, and advises
  creators to align the opening with the title/thumbnail promise:
  <https://support.google.com/youtube/answer/16559650?hl=en>
- YouTube's audience-retention report describes intro retention, top moments,
  spikes and dips, and notes that retention data usually takes time to process:
  <https://support.google.com/youtube/answer/9314415?hl=en>
- YouTube explains that recommendations use clicks, watch time, survey responses,
  sharing, likes and dislikes as satisfaction signals:
  <https://blog.youtube/inside-youtube/on-youtubes-recommendation-system/>
- YouTube's native long-form A/B testing supports up to three title/thumbnail
  alternatives and determines the winner by watch time rather than CTR alone:
  <https://support.google.com/youtube/answer/16391400?hl=en>
- The YouTube Analytics API exposes `audienceWatchRatio`,
  `relativeRetentionPerformance` and `elapsedVideoTimeRatio` reports:
  <https://developers.google.com/youtube/analytics/metrics>
  <https://developers.google.com/youtube/analytics/sample-requests>
- YouTube Analytics and Reporting APIs use OAuth 2.0 and support read-only
  analytics scopes:
  <https://developers.google.com/youtube/reporting/guides/authorization>
- YouTube recommends reviewing automatic captions because speech recognition can
  misrepresent accents, dialects, pronunciation or noisy audio:
  <https://support.google.com/youtube/answer/6373554?hl=en>
- Guo, Kim and Rubin studied 6.9 million MOOC viewing sessions and found strong
  engagement differences associated with duration and production style. This is
  evidence for educational explainers, not a universal YouTube rule:
  <https://pure.kaist.ac.kr/en/publications/how-video-production-affects-student-engagement-an-empirical-stud/>
- Kim et al. analyzed second-by-second behavior in 862 lecture videos and observed
  that many sampled interaction peaks accompanied visual transitions. This is a
  hypothesis source for semantic visual changes, not justification for arbitrary
  high-frequency cuts:
  <https://www.eecs.harvard.edu/~kgajos/papers/2014/kim14understanding.shtml>

## Open questions before implementation

- Should raw observations live beside each project or in a workspace-level
  analytics store referenced by project ID?
- What minimum evidence and comparison rules are required before a Channel
  learning can be marked ready for adoption?
- Which renderer should receive the first motion-plan implementation?
- Which phrase-level timing path preserves a fully offline fallback?
- Which preflight findings should block export versus remain advisory?
- Should Packaging Lab ship before or together with manual analytics import?

## Recommended first implementation

Start with **Phase 1: Retention OS v1**, while reserving stable IDs for later
packaging variants and analytics observations. It improves decisions before media
generation, preserves the current local-first and scene-scoped architecture, and
creates the structure needed to learn from real retention rather than intuition.
