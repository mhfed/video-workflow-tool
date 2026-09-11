import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, LoaderCircle, Pause, Play, RefreshCw, Repeat2, Save, Trash2, X } from 'lucide-react';
import { pointAtProgress, movePathPoint, partialPath } from './draw-path-model.mjs';
import { Button } from '@/components/ui/button';

const clamp=(value)=>Math.max(0,Math.min(1,value));
const keyFor=(points)=>JSON.stringify(points||[]);

export default function DrawRevealPathEditor({project,scene,running,onLoad,onSave,onClose,c}) {
  const svgRef=useRef(null),[points,setPoints]=useState([]),[baseline,setBaseline]=useState('[]'),[mode,setMode]=useState('contour-v1'),[selected,setSelected]=useState(0),[dragging,setDragging]=useState(null),[progress,setProgress]=useState(0),[playing,setPlaying]=useState(false),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[message,setMessage]=useState('');
  const width=Number(project.settings?.width)||1080,height=Number(project.settings?.height)||1920,duration=Math.max(800,(Number(scene.durationMs)||3000)*(Number(scene.drawReveal?.revealPortion??project.settings?.drawReveal?.revealPortion)||.88));

  const load=async()=>{setLoading(true);setMessage('');try{const result=await onLoad(scene.id),next=result.path||[];setPoints(next);setBaseline(keyFor(next));setMode(result.mode);setSelected(0);setProgress(0);}catch(error){setMessage(error.message);}finally{setLoading(false);}};
  useEffect(()=>{load();},[scene.id,scene.artwork]);
  useEffect(()=>{if(!playing)return;const started=performance.now()-progress*duration;let frame;const tick=(now)=>{const next=Math.min(1,(now-started)/duration);setProgress(next);if(next>=1)setPlaying(false);else frame=requestAnimationFrame(tick);};frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame);},[playing,duration]);

  const marker=useMemo(()=>pointAtProgress(points,progress),[points,progress]),traced=useMemo(()=>partialPath(points,progress),[points,progress]),dirty=keyFor(points)!==baseline;
  const svgPoint=(event)=>{const box=svgRef.current.getBoundingClientRect();return [clamp((event.clientX-box.left)/box.width),clamp((event.clientY-box.top)/box.height)];};
  const updatePoint=(index,point)=>{setPoints((value)=>value.map((item,itemIndex)=>itemIndex===index?point:item));setMode('explicit');setPlaying(false);};
  const addPoint=(event)=>{if(event.target!==svgRef.current||points.length>=64)return;const point=svgPoint(event);setPoints((value)=>[...value,point]);setSelected(points.length);setMode('explicit');setPlaying(false);};
  const move=(event)=>{if(dragging===null)return;updatePoint(dragging,svgPoint(event));};
  const finishDrag=(event)=>{if(dragging===null)return;try{svgRef.current.releasePointerCapture(event.pointerId);}catch{}setDragging(null);};
  const save=async()=>{if(points.length<2)return;setSaving(true);setMessage('');try{const result=await onSave(scene.id,points);const next=result.path||points;setPoints(next);setBaseline(keyFor(next));setMode('explicit');setMessage(c.drawPathSaved);}catch(error){setMessage(error.message);}finally{setSaving(false);}};
  const reset=async()=>{setSaving(true);setMessage('');try{await onSave(scene.id,null);const result=await onLoad(scene.id),next=result.path||[];setPoints(next);setBaseline(keyFor(next));setMode(result.mode);setSelected(0);setProgress(0);setMessage(c.drawPathReset);}catch(error){setMessage(error.message);}finally{setSaving(false);}};
  const reorder=(direction)=>{const next=movePathPoint(points,selected,direction);if(next!==points){setPoints(next);setSelected(selected+direction);setMode('explicit');}};
  const remove=()=>{if(points.length<=2)return;setPoints((value)=>value.filter((_,index)=>index!==selected));setSelected(Math.max(0,Math.min(selected,points.length-2)));setMode('explicit');};
  const reverse=()=>{setPoints((value)=>[...value].reverse());setSelected(points.length-1-selected);setMode('explicit');};
  const full=points.map(([x,y])=>`${x*width},${y*height}`).join(' '),partial=traced.map(([x,y])=>`${x*width},${y*height}`).join(' ');

  return <section className="draw-path-editor">
    <header><div><strong>{c.drawPathEditor}</strong><small>{mode==='explicit'?c.explicitPath:c.autoContourPath} · {points.length}/64 {c.points}</small></div><button type="button" onClick={onClose} aria-label={c.close}><X/></button></header>
    {loading?<div className="draw-path-loading"><LoaderCircle className="spin"/>{c.loadingDrawPath}</div>:<>
      <div className="draw-path-canvas" style={{aspectRatio:`${width}/${height}`,maxWidth:height>width?`min(100%, ${Math.round(390*width/height)}px)`:'100%'}}>
        <img src={`/media/${encodeURIComponent(project.id)}/scenes/${encodeURIComponent(scene.id)}/artwork?v=${encodeURIComponent(project.updatedAt||'current')}`} alt="" draggable="false"/>
        <svg ref={svgRef} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" onPointerDown={addPoint} onPointerMove={move} onPointerUp={finishDrag} onPointerCancel={finishDrag}>
          <polyline className="draw-path-full" points={full}/><polyline className="draw-path-traced" points={partial}/>
          {points.map(([x,y],index)=><g key={index} data-point="true" className={selected===index?'selected':''} transform={`translate(${x*width} ${y*height})`} onPointerDown={(event)=>{event.stopPropagation();svgRef.current.setPointerCapture(event.pointerId);setSelected(index);setDragging(index);setPlaying(false);}}><circle r={Math.max(width,height)*.012}/><text y={Math.max(width,height)*-.018}>{index+1}</text></g>)}
          {marker&&<g className="draw-path-marker" transform={`translate(${marker[0]*width} ${marker[1]*height})`}><circle r={Math.max(width,height)*.015}/><path d={`M 0 0 L ${Math.max(width,height)*.04} ${Math.max(width,height)*.04}`}/></g>}
        </svg>
      </div>
      <div className="draw-path-timeline"><button type="button" onClick={()=>{if(progress>=1)setProgress(0);setPlaying((value)=>!value);}} aria-label={playing?c.pause:c.play}>{playing?<Pause/>:<Play/>}</button><input type="range" min="0" max="1" step="0.001" value={progress} onChange={(event)=>{setPlaying(false);setProgress(Number(event.target.value));}} aria-label={c.pathPreview}/><span>{Math.round(progress*100)}%</span></div>
      <p className="draw-path-help">{c.drawPathHelp}</p>
      <div className="draw-path-point-tools"><span>{c.point} {selected+1} · {points[selected]?.map((value)=>value.toFixed(3)).join(', ')}</span><button type="button" disabled={selected===0} onClick={()=>reorder(-1)} title={c.moveEarlier}><ArrowUp/></button><button type="button" disabled={selected>=points.length-1} onClick={()=>reorder(1)} title={c.moveLater}><ArrowDown/></button><button type="button" disabled={points.length<=2} onClick={remove} title={c.deletePoint}><Trash2/></button><button type="button" onClick={reverse} title={c.reversePath}><Repeat2/></button></div>
      <footer><Button type="button" variant="ghost" disabled={running||saving} onClick={reset}>{saving?<LoaderCircle className="spin"/>:<RefreshCw/>}{c.resetAutoPath}</Button><Button type="button" disabled={running||saving||!dirty||points.length<2} onClick={save}>{saving?<LoaderCircle className="spin"/>:<Save/>}{c.saveDrawPath}</Button></footer>
    </>}
    {message&&<small className="draw-path-message">{message}</small>}
  </section>;
}
