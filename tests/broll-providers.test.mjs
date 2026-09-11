import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { assertBrollDownloadUrl, searchBroll } from '../packages/providers/src/broll.mjs';
import { assignDownloadedBroll, downloadBrollAsset, normalizeBrollSelection } from '../apps/web/src/broll-media.mjs';

test('Pexels search uses server-side authorization and normalizes the best portrait rendition',async()=>{
  let request;
  const fetchImpl=async(url,init)=>{request={url:String(url),init};return new Response(JSON.stringify({page:1,per_page:12,total_results:1,videos:[{id:42,duration:8,url:'https://www.pexels.com/video/42/',image:'https://images.pexels.com/videos/42/preview.jpeg',user:{name:'Creator',url:'https://www.pexels.com/@creator'},video_files:[{file_type:'video/mp4',width:1920,height:1080,link:'https://videos.pexels.com/video-files/42/landscape.mp4'},{file_type:'video/mp4',width:1080,height:1920,link:'https://videos.pexels.com/video-files/42/portrait.mp4'}]}]}),{status:200,headers:{'content-type':'application/json'}});};
  const result=await searchBroll({provider:'pexels',query:'quiet city',language:'en'}, {pexelsApiKey:'secret-key'},{fetchImpl});
  assert.equal(request.init.headers.Authorization,'secret-key');
  assert.doesNotMatch(request.url,/secret-key/);
  assert.equal(result.items[0].downloadUrl,'https://videos.pexels.com/video-files/42/portrait.mp4');
  assert.equal(result.items[0].attribution,'Video by Creator on Pexels');
});

test('Pixabay search normalizes video results and requests safe search',async()=>{
  let requestUrl;
  const fetchImpl=async(url)=>{requestUrl=String(url);return new Response(JSON.stringify({totalHits:1,hits:[{id:7,duration:5,pageURL:'https://pixabay.com/videos/id-7/',user:'Maker',user_id:9,videos:{large:{url:'https://cdn.pixabay.com/video/7-large.mp4',width:1920,height:1080,size:100},small:{url:'https://cdn.pixabay.com/video/7-small.mp4',width:720,height:1280,size:50,thumbnail:'https://cdn.pixabay.com/video/7.jpg'}}}]}),{status:200});};
  const result=await searchBroll({provider:'pixabay',query:'forest',language:'vi'},{pixabayApiKey:'pix-key'},{fetchImpl});
  const request=new URL(requestUrl);
  assert.equal(request.searchParams.get('key'),'pix-key');
  assert.equal(request.searchParams.get('safesearch'),'true');
  assert.equal(request.searchParams.get('lang'),'vi');
  assert.equal(result.items[0].width,720);
  assert.equal(result.items[0].creator,'Maker');
});

test('B-roll downloads enforce provider hosts, size limits, and project-local atomic paths',async()=>{
  assert.throws(()=>assertBrollDownloadUrl('pexels','https://example.com/video.mp4'),/not an allowed/);
  assert.throws(()=>normalizeBrollSelection({provider:'pixabay',id:'7',downloadUrl:'http://cdn.pixabay.com/video.mp4'}),/not an allowed/);
  const projectRoot=fs.mkdtempSync(path.join(os.tmpdir(),'vwt-broll-download-'));
  const selection={provider:'pexels',id:'42',downloadUrl:'https://videos.pexels.com/video-files/42/portrait.mp4',sourceUrl:'https://www.pexels.com/video/42/',creator:'Creator',creatorUrl:'https://www.pexels.com/@creator',attribution:'Video by Creator on Pexels'};
  let calls=0;
  const fetchImpl=async()=>{calls++;return new Response(Buffer.from('safe-video-bytes'),{status:200,headers:{'content-type':'video/mp4','content-length':'16'}});};
  const first=await downloadBrollAsset(selection,projectRoot,{fetchImpl,maxBytes:100});
  assert.match(first.path,/^assets\/broll\/pexels-42-[a-f0-9]{10}\.mp4$/);
  assert.equal(fs.readFileSync(path.join(projectRoot,first.path),'utf8'),'safe-video-bytes');
  const second=await downloadBrollAsset(selection,projectRoot,{fetchImpl,maxBytes:100});
  assert.equal(second.reused,true);assert.equal(calls,1);
  const tooLarge=downloadBrollAsset({...selection,id:'43',downloadUrl:'https://videos.pexels.com/video-files/43/huge.mp4'},projectRoot,{fetchImpl:async()=>new Response(Buffer.alloc(101),{status:200,headers:{'content-type':'video/mp4','content-length':'101'}}),maxBytes:100});
  await assert.rejects(tooLarge,/too large/);
});

test('assigning downloaded B-roll switches only the scene renderer and invalidates visual downstream state',()=>{
  const scene={id:'scene-001',cache:{voice:'voice',image:'old',video:'old',clip:'old'},artifacts:{voice:'voice.mp3',visual:'old.png',video:'old.mp4',clip:'old-clip.mp4'}};
  const project={status:'complete',artifacts:{final:'output/final.mp4'},scenes:[scene]};
  assignDownloadedBroll(project,scene,{path:'assets/broll/pexels-42.mp4',source:{provider:'pexels',id:'42',downloadUrl:'https://videos.pexels.com/video-files/42/portrait.mp4',attribution:'Video by Creator on Pexels'}},{brollStartMs:750,currentRenderer:'simple'});
  assert.equal(scene.renderer,'cinematic-broll');assert.equal(scene.brollStartMs,750);assert.equal(scene.cache.voice,'voice');assert.equal(scene.artifacts.voice,'voice.mp3');
  assert.equal(scene.cache.image,undefined);assert.equal(scene.cache.video,undefined);assert.equal(scene.cache.clip,undefined);assert.equal(project.artifacts.final,undefined);
  assert.equal(scene.brollSource.downloadUrl,undefined);assert.equal(scene.brollSource.attribution,'Video by Creator on Pexels');
});
