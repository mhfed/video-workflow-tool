import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, ArrowRight, Check, CheckCircle2, Clock3, Image as ImageIcon, LoaderCircle,
  RefreshCw, Save, Sparkles, Target, WandSparkles,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

const EDITABLE_FIELDS = ['targetViewer', 'viewerQuestion', 'promise', 'hook', 'payoff'];

function formatTime(ms = 0) {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function PlanField({ label, name, value, onChange, multiline = false }) {
  const Field = multiline ? Textarea : Input;
  return <label className="retention-field"><span>{label}</span><Field rows={multiline ? 3 : undefined} value={value || ''} onChange={(event) => onChange(name, event.target.value)} /></label>;
}

function PackagingLab({packaging,preflight,running,working,run,onPlan,onSelect,onApply,c}) {
  if(!packaging)return null;
  return <section className="retention-section packaging-lab">
    <header><span><ImageIcon />{c.packagingLab}</span><Button variant="ghost" disabled={running||!!working} onClick={()=>run('packaging-plan',onPlan)}>{working==='packaging-plan'?<LoaderCircle className="spin"/>:<RefreshCw/>}{c.newPackagingConcepts}</Button></header>
    <p className="packaging-lab-intro">{c.packagingLabBody}</p>
    <div className="packaging-variants">{packaging.variants.map((variant,index)=>{
      const selected=packaging.selectedVariantId===variant.id;
      return <article key={variant.id} className={selected?'selected':''}>
        <div className="mobile-package-preview" aria-label={`${c.mobilePreview}: ${variant.title}`}>
          <div><i>0{index+1}</i><span>{variant.thumbnailText}</span><small>{variant.focalPoint||variant.thumbnailDirection}</small></div>
          <strong>{variant.title}</strong>
        </div>
        <header><span><strong>{variant.label}</strong><small>{variant.curiosityMechanism}</small></span>{selected&&<Badge><Check/>{c.selectedPackage}</Badge>}</header>
        <p>{variant.thumbnailDirection}</p>
        <div className="packaging-card-actions">
          <Button variant="outline" disabled={running||!!working||selected} onClick={()=>run(`package-${variant.id}`,()=>onSelect(variant.id))}>{working===`package-${variant.id}`?<LoaderCircle className="spin"/>:<Check/>}{selected?c.selectedPackage:c.selectPackage}</Button>
          {selected&&<Button disabled={running||!!working} onClick={()=>run(`apply-package-${variant.id}`,()=>onApply(variant.id))}>{working===`apply-package-${variant.id}`?<LoaderCircle className="spin"/>:<ArrowRight/>}{c.applyPackageAndHook}</Button>}
        </div>
        {selected&&preflight&&<div className="packaging-check-summary"><span className={preflight.status}>{preflight.status==='pass'?c.packagingAligned:`${preflight.summary.warnings} ${c.warnings}`}</span>{preflight.findings.filter((item)=>item.status==='warn').slice(0,2).map((item)=><small key={item.id}><AlertTriangle/>{item.note}</small>)}</div>}
      </article>;
    })}</div>
    <small className="packaging-select-note">{c.packagingSelectNote}</small>
  </section>;
}

export default function RetentionPanel({
  report, loading, error, running, onRefresh, onPlan, onSave, onSelectHook, onPlanPackaging, onSelectPackaging, onApplyPackaging, onOpenScene, c,
}) {
  const plan = report?.plan;
  const preflight = report?.preflight;
  const [draft, setDraft] = useState({});
  const [working, setWorking] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!plan) return;
    setDraft(Object.fromEntries(EDITABLE_FIELDS.map((key) => [key, plan[key] || ''])));
  }, [plan]);

  const dirty = useMemo(() => !!plan && EDITABLE_FIELDS.some((key) => (draft[key] || '') !== (plan[key] || '')), [draft, plan]);
  const run = async (kind, task) => {
    setWorking(kind);
    setMessage('');
    try {
      const result = await task();
      if (result) setMessage(kind === 'save' ? c.retentionSaved : '');
    } catch (cause) {
      setMessage(cause.message);
    } finally {
      setWorking('');
    }
  };
  const edit = (name, value) => setDraft((current) => ({ ...current, [name]: value }));

  return <div className="director-panel-body retention-panel">
    <header className="retention-head">
      <div><span><Target />{c.viewerJourney}</span><p>{c.retentionPlanBody}</p></div>
      {preflight && <Badge className={`retention-${preflight.status}`}>{preflight.status === 'pass' ? c.qaPass : `${preflight.summary.warnings} ${c.warnings}`}</Badge>}
    </header>

    {loading && !report ? <div className="retention-loading"><LoaderCircle className="spin" /><span>{c.loadingRetention}</span></div> : null}
    {!loading && !report ? <section className="retention-empty"><Sparkles /><h3>{c.retentionEmpty}</h3><p>{c.retentionEmptyBody}</p><Button disabled={running || !!working} onClick={() => run('plan', onPlan)}>{working === 'plan' ? <LoaderCircle className="spin" /> : <WandSparkles />}{c.prepareRetention}</Button></section> : null}

    {plan && <>
      <PackagingLab packaging={report.packaging} preflight={report.packagingPreflight} running={running} working={working} run={run} onPlan={onPlanPackaging} onSelect={onSelectPackaging} onApply={onApplyPackaging} c={c}/>
      <section className="retention-contract">
        <div className="retention-contract-label"><span>01</span><strong>{c.audienceContract}</strong></div>
        <PlanField label={c.targetViewer} name="targetViewer" value={draft.targetViewer} onChange={edit} />
        <PlanField label={c.viewerQuestion} name="viewerQuestion" value={draft.viewerQuestion} onChange={edit} multiline />
        <div className="retention-value-chain">
          <label><span>{c.promise}</span><Textarea rows={3} value={draft.promise || ''} onChange={(event) => edit('promise', event.target.value)} /></label>
          <ArrowRight />
          <label><span>{c.payoff}</span><Textarea rows={3} value={draft.payoff || ''} onChange={(event) => edit('payoff', event.target.value)} /></label>
        </div>
        <PlanField label={c.openingHook} name="hook" value={draft.hook} onChange={edit} multiline />
        <Button className="retention-save" disabled={running || !!working || !dirty} onClick={() => run('save', () => onSave(draft))}>{working === 'save' ? <LoaderCircle className="spin" /> : <Save />}{c.saveRetentionPlan}</Button>
      </section>

      <section className="retention-section retention-journey">
        <header><span><Clock3 />{c.viewerJourney}</span><small>{formatTime(preflight?.summary?.durationMs)}</small></header>
        <div className="retention-beat-list">{(preflight?.journey || []).map((beat, index) => <button key={beat.sceneId} className={beat.status} onClick={() => onOpenScene(beat.sceneId)}>
          <i><span>{String(index + 1).padStart(2, '0')}</span><b /></i>
          <span><small>{formatTime(beat.startMs)} · {beat.narrativeRole}</small><strong>{beat.newInformation || c.missingNewInformation}</strong>{beat.visualChangeReason && <em>{c.whyVisualChanges}: {beat.visualChangeReason}</em>}</span>
          <ArrowRight />
        </button>)}</div>
      </section>

      <section className="retention-section hook-lab">
        <header><span><Sparkles />{c.hookLab}</span><small>{c.hookLabBody}</small></header>
        <div>{(plan.hookLab?.variants || []).map((variant) => {
          const selected = plan.hookLab.selectedVariantId === variant.id;
          return <article key={variant.id} className={selected ? 'selected' : ''}>
            <header><strong>{variant.label}</strong>{selected && <Badge><Check />{c.selectedHook}</Badge>}</header>
            <p>{variant.hook}</p>
            <small>{variant.reason}</small>
            <Button variant="outline" disabled={running || !!working || selected} onClick={() => run(`hook-${variant.id}`, () => onSelectHook(variant.id))}>{working === `hook-${variant.id}` ? <LoaderCircle className="spin" /> : <Check />}{selected ? c.selectedHook : c.chooseHook}</Button>
          </article>;
        })}</div>
      </section>

      <section className="retention-section retention-checks">
        <header><span><CheckCircle2 />{c.retentionChecks}</span><small>{preflight?.summary?.checks || 0}</small></header>
        <div>{(preflight?.findings || []).map((item) => <button key={item.id} className={item.status} disabled={!item.sceneIds?.length} onClick={() => item.sceneIds?.[0] && onOpenScene(item.sceneIds[0])}>
          <i>{item.status === 'pass' ? <Check /> : <AlertTriangle />}</i>
          <span><strong>{item.label}</strong><small>{item.note}</small></span>
          {!!item.sceneIds?.length && <ArrowRight />}
        </button>)}</div>
      </section>

      <footer className="retention-actions">
        <Button variant="outline" disabled={running || !!working || loading} onClick={() => run('refresh', onRefresh)}>{working === 'refresh' || loading ? <LoaderCircle className="spin" /> : <RefreshCw />}{c.refreshRetention}</Button>
        <Button disabled={running || !!working} onClick={() => run('plan', onPlan)}>{working === 'plan' ? <LoaderCircle className="spin" /> : <WandSparkles />}{c.replanRetention}</Button>
      </footer>
    </>}

    {(error || message) && <div className={`retention-message ${error || message !== c.retentionSaved ? 'error' : 'success'}`}><AlertTriangle /><span>{error || message}</span></div>}
    <p className="retention-disclaimer">{c.retentionDisclaimer}</p>
  </div>;
}
