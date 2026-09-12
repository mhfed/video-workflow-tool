import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { normalizePenAppearance } from '../../core/src/pen-settings.mjs';

export const blankPenAsset=fileURLToPath(new URL('../assets/drawing-hand-blank.png',import.meta.url));
const sourceSignature=crypto.createHash('sha256').update(fs.readFileSync(blankPenAsset)).digest('hex');

function escapeXml(value) {
  return String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&apos;');
}

function parseColor(value) {
  return [Number.parseInt(value.slice(1,3),16),Number.parseInt(value.slice(3,5),16),Number.parseInt(value.slice(5,7),16)];
}

function isInsideBarrel(x,y,width,height) {
  const sx=width/1068,sy=height/1473;
  const ax=370*sx,ay=275*sy,bx=842*sx,by=675*sy;
  const dx=bx-ax,dy=by-ay,lengthSquared=dx*dx+dy*dy;
  const t=Math.max(0,Math.min(1,((x-ax)*dx+(y-ay)*dy)/lengthSquared));
  const distance=Math.hypot(x-(ax+dx*t),y-(ay+dy*t));
  return t>.015&&t<.985&&distance<68*Math.min(sx,sy);
}

function labelSvg({label,color,width,height}) {
  if(!label)return null;
  const count=Math.max(1,[...label].length),fontSize=Math.max(28,Math.min(58,410/(count*.61)))*(width/1068);
  const [red,green,blue]=parseColor(color),luminance=(.2126*red+.7152*green+.0722*blue)/255;
  const ink=luminance>.53?'#171713':'#FFFFFF';
  return Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><text x="0" y="0" fill="${ink}" stroke="${ink==='white'||ink==='#FFFFFF'?'#151512':'#FFFFFF'}" stroke-opacity=".16" stroke-width="${Math.max(1,fontSize*.035)}" paint-order="stroke" text-anchor="middle" dominant-baseline="central" font-family="DejaVu Sans, sans-serif" font-size="${fontSize}" font-weight="800" letter-spacing="${fontSize*.025}" transform="translate(${615*width/1068} ${454*height/1473}) rotate(40.3)">${escapeXml(label)}</text></svg>`);
}

export function penAppearanceSignature(project) {
  const appearance=normalizePenAppearance(project?.settings?.pen);
  return crypto.createHash('sha256').update(JSON.stringify({sourceSignature,...appearance})).digest('hex');
}

export async function createPenAsset({project,outputFile}) {
  const appearance=normalizePenAppearance(project?.settings?.pen),signature=penAppearanceSignature(project);
  const target=outputFile||path.join(os.tmpdir(),`vwt-pen-${signature.slice(0,12)}.png`);
  if(fs.existsSync(target))return target;
  const source=sharp(blankPenAsset).ensureAlpha();
  const {data,info}=await source.raw().toBuffer({resolveWithObject:true});
  if(appearance.color!=='#FFFFFF'){
    const [targetRed,targetGreen,targetBlue]=parseColor(appearance.color);
    for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++){
      const index=(y*info.width+x)*info.channels,red=data[index],green=data[index+1],blue=data[index+2],alpha=data[index+3];
      const spread=Math.max(red,green,blue)-Math.min(red,green,blue),light=(red+green+blue)/3;
      if(alpha>8&&spread<42&&light>76&&isInsideBarrel(x,y,info.width,info.height)){
        const shade=.32+.68*(light/255);
        data[index]=Math.round(targetRed*shade);data[index+1]=Math.round(targetGreen*shade);data[index+2]=Math.round(targetBlue*shade);
      }
    }
  }
  const label=labelSvg({...appearance,width:info.width,height:info.height});
  const image=sharp(data,{raw:info});
  await (label?image.composite([{input:label,blend:'over'}]):image).png().toFile(target);
  return target;
}
