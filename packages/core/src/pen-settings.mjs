export const DEFAULT_PEN_APPEARANCE=Object.freeze({label:'NÉT VIỆT',color:'#FFFFFF'});

const HEX_COLOR=/^#[0-9a-f]{6}$/i;

export function normalizePenAppearance(value={}) {
  const label=typeof value?.label==='string'?[...value.label.trim()].slice(0,18).join(''):DEFAULT_PEN_APPEARANCE.label;
  const color=typeof value?.color==='string'&&HEX_COLOR.test(value.color.trim())?value.color.trim().toUpperCase():DEFAULT_PEN_APPEARANCE.color;
  return {label,color};
}

export function validatePenAppearance(value) {
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Pen settings must be an object.');
  if(typeof value.label!=='string')throw new Error('Pen label must be text.');
  if([...value.label.trim()].length>18)throw new Error('Pen label supports at most 18 characters.');
  if(typeof value.color!=='string'||!HEX_COLOR.test(value.color.trim()))throw new Error('Pen color must use the #RRGGBB format.');
  return normalizePenAppearance(value);
}
