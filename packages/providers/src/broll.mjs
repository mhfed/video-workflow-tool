const providers=new Set(['pexels','pixabay']);
const downloadHosts={pexels:new Set(['videos.pexels.com']),pixabay:new Set(['cdn.pixabay.com'])};

export const brollProviderNames=Object.freeze([...providers]);

const positiveInt=(value,fallback,{min=1,max=200}={})=>{const number=Number(value);return Number.isInteger(number)&&number>=min&&number<=max?number:fallback;};
const cleanQuery=(value)=>String(value||'').replace(/\s+/g,' ').trim().slice(0,100);

function renditionScore(item,{width=1080,height=1920}={}) {
  const w=Number(item.width)||0,h=Number(item.height)||0;
  if(!w||!h)return Number.MAX_SAFE_INTEGER;
  const ratioPenalty=Math.abs(w/h-width/height)*10000;
  const orientationPenalty=(height>width)!==(h>w)?100000:0;
  const resolutionPenalty=w<Math.min(width,720)?(Math.min(width,720)-w)*10:Math.abs(w-width)/10;
  return orientationPenalty+ratioPenalty+resolutionPenalty;
}

function bestPexelsFile(video,target) {
  return (video.video_files||[]).filter((item)=>item?.link&&String(item.file_type||'video/mp4').includes('mp4')).sort((a,b)=>renditionScore(a,target)-renditionScore(b,target))[0]||null;
}

function bestPixabayFile(video,target) {
  return Object.values(video.videos||{}).filter((item)=>item?.url).sort((a,b)=>renditionScore(a,target)-renditionScore(b,target))[0]||null;
}

function normalizePexels(video,target) {
  const file=bestPexelsFile(video,target);if(!file)return null;
  const creator=String(video.user?.name||'Pexels creator');
  return {provider:'pexels',id:String(video.id),durationSec:Number(video.duration)||null,width:Number(file.width)||null,height:Number(file.height)||null,thumbnailUrl:String(video.image||video.video_pictures?.[0]?.picture||''),downloadUrl:String(file.link),sourceUrl:String(video.url||''),creator,creatorUrl:String(video.user?.url||''),attribution:`Video by ${creator} on Pexels`};
}

function normalizePixabay(video,target) {
  const file=bestPixabayFile(video,target);if(!file)return null;
  const creator=String(video.user||'Pixabay creator');
  return {provider:'pixabay',id:String(video.id),durationSec:Number(video.duration)||null,width:Number(file.width)||null,height:Number(file.height)||null,thumbnailUrl:String(file.thumbnail||video.videos?.tiny?.thumbnail||''),downloadUrl:String(file.url),sourceUrl:String(video.pageURL||''),creator,creatorUrl:video.user_id?`https://pixabay.com/users/${encodeURIComponent(creator)}-${video.user_id}/`:'',attribution:`Video by ${creator} on Pixabay`};
}

async function providerResponse(response,label) {
  if(response.ok)return response.json();
  const detail=await response.text();
  throw new Error(`${label} search failed (${response.status}): ${detail.slice(0,500)}`);
}

export async function searchBroll({provider,query,page=1,perPage=12,orientation='portrait',language='en',target={width:1080,height:1920}},cfg,{fetchImpl=fetch,signal=null}={}) {
  if(!providers.has(provider))throw new Error(`Unsupported B-roll provider: ${provider}`);
  const q=cleanQuery(query);if(!q)throw new Error('B-roll search query is required.');
  const safePage=positiveInt(page,1,{max:1000}),safePerPage=positiveInt(perPage,12,{min:3,max:provider==='pexels'?80:200});
  if(provider==='pexels'){
    if(!cfg.pexelsApiKey)throw new Error('PEXELS_API_KEY is required to search Pexels.');
    const params=new URLSearchParams({query:q,orientation:['landscape','portrait','square'].includes(orientation)?orientation:'portrait',locale:language==='vi'?'vi-VN':'en-US',page:String(safePage),per_page:String(safePerPage)});
    const response=await fetchImpl(`https://api.pexels.com/v1/videos/search?${params}`,{headers:{Authorization:cfg.pexelsApiKey},signal});
    const data=await providerResponse(response,'Pexels');
    return {provider,page:Number(data.page)||safePage,perPage:Number(data.per_page)||safePerPage,total:Number(data.total_results)||0,items:(data.videos||[]).map((item)=>normalizePexels(item,target)).filter(Boolean)};
  }
  if(!cfg.pixabayApiKey)throw new Error('PIXABAY_API_KEY is required to search Pixabay.');
  const params=new URLSearchParams({key:cfg.pixabayApiKey,q,lang:language==='vi'?'vi':'en',safesearch:'true',page:String(safePage),per_page:String(safePerPage)});
  const response=await fetchImpl(`https://pixabay.com/api/videos/?${params}`,{signal});
  const data=await providerResponse(response,'Pixabay');
  return {provider,page:safePage,perPage:safePerPage,total:Number(data.totalHits||data.total)||0,items:(data.hits||[]).map((item)=>normalizePixabay(item,target)).filter(Boolean)};
}

export function assertBrollDownloadUrl(provider,value) {
  if(!providers.has(provider))throw new Error(`Unsupported B-roll provider: ${provider}`);
  let url;try{url=new URL(String(value||''));}catch{throw new Error('B-roll download URL is invalid.');}
  if(url.protocol!=='https:'||url.username||url.password||!downloadHosts[provider].has(url.hostname.toLowerCase()))throw new Error(`B-roll download URL is not an allowed ${provider} media host.`);
  return url;
}
