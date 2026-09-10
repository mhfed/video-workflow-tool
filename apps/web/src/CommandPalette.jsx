import { useEffect, useMemo, useRef, useState } from 'react';
import { Command, Search, X } from 'lucide-react';

const normalize=(value)=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();

export default function CommandPalette({open,onOpenChange,items,c}){
  const [query,setQuery]=useState(''),[active,setActive]=useState(0);const inputRef=useRef(null),resultsRef=useRef(null);
  const filtered=useMemo(()=>{const needle=normalize(query);return needle?items.filter((item)=>normalize(`${item.label} ${item.meta||''} ${item.group||''}`).includes(needle)):items;},[items,query]);
  useEffect(()=>{if(!open){setQuery('');return;}setActive(0);const previous=document.body.style.overflow;document.body.style.overflow='hidden';const timer=setTimeout(()=>inputRef.current?.focus(),20);return()=>{clearTimeout(timer);document.body.style.overflow=previous;};},[open]);
  useEffect(()=>setActive((value)=>Math.min(value,Math.max(0,filtered.length-1))),[filtered.length]);
  useEffect(()=>{resultsRef.current?.querySelector('.active')?.scrollIntoView({block:'nearest'});},[active]);
  useEffect(()=>{if(!open)return;const keydown=(event)=>{if(event.key==='Escape'){event.preventDefault();onOpenChange(false);}else if(event.key==='ArrowDown'){event.preventDefault();setActive((value)=>Math.min(Math.max(0,filtered.length-1),value+1));}else if(event.key==='ArrowUp'){event.preventDefault();setActive((value)=>Math.max(0,value-1));}else if(event.key==='Enter'&&filtered[active]){event.preventDefault();onOpenChange(false);filtered[active].run();}};window.addEventListener('keydown',keydown);return()=>window.removeEventListener('keydown',keydown);},[open,filtered,active,onOpenChange]);
  if(!open)return null;
  let previousGroup='';
  return <div className="command-layer" role="presentation" onMouseDown={(event)=>{if(event.target===event.currentTarget)onOpenChange(false);}}><section className="command-palette" role="dialog" aria-modal="true" aria-label={c.commandPalette}>
    <header><Command/><input ref={inputRef} value={query} onChange={(event)=>{setQuery(event.target.value);setActive(0);}} placeholder={c.commandSearch}/><kbd>⌘ K</kbd><button aria-label={c.close} onClick={()=>onOpenChange(false)}><X/></button></header>
    <div ref={resultsRef} className="command-results" role="listbox">{filtered.length?filtered.map((item,index)=>{const Icon=item.icon;const showGroup=item.group!==previousGroup;previousGroup=item.group;return <div key={item.id} className="command-row-wrap">{showGroup&&<span className="command-group">{item.group}</span>}<button role="option" aria-selected={index===active} className={index===active?'active':''} onMouseEnter={()=>setActive(index)} onClick={()=>{onOpenChange(false);item.run();}}><i><Icon/></i><span><strong>{item.label}</strong>{item.meta&&<small>{item.meta}</small>}</span>{item.shortcut&&<kbd>{item.shortcut}</kbd>}</button></div>}):<div className="command-empty"><Search/><strong>{c.noCommands}</strong><span>{c.noCommandsBody}</span></div>}</div>
    <footer><span><kbd>↑↓</kbd> {c.navigate}</span><span><kbd>↵</kbd> {c.runCommand}</span><span><kbd>esc</kbd> {c.close}</span></footer>
  </section></div>;
}
