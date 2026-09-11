import { spawn } from 'node:child_process';
import readline from 'node:readline';

export class CodexAccountClient {
  constructor({bin='codex',spawnImpl=spawn,cwd=process.cwd()}={}){this.bin=bin;this.spawnImpl=spawnImpl;this.cwd=cwd;this.child=null;this.pending=new Map();this.nextId=1;this.starting=null;this.lastNotification=null;this.stderr='';}

  async start(){
    if(this.starting)return this.starting;
    if(this.child)return;
    this.starting=new Promise((resolve,reject)=>{
      const child=this.spawnImpl(this.bin,['app-server','--stdio'],{cwd:this.cwd,env:process.env,stdio:['pipe','pipe','pipe']});
      this.child=child;
      const fail=(error)=>{this.rejectAll(error);this.child=null;reject(error);};
      child.once('error',(error)=>fail(new Error(error.code==='ENOENT'?`Codex CLI was not found at ${this.bin}.`:error.message)));
      child.stderr.on('data',(chunk)=>{this.stderr=(this.stderr+chunk).slice(-12000);});
      readline.createInterface({input:child.stdout}).on('line',(line)=>this.handleLine(line));
      child.once('exit',(code)=>{const error=new Error(`Codex App Server stopped (${code??'signal'}): ${this.stderr.trim().slice(-1000)}`);this.rejectAll(error);this.child=null;});
      this.requestRaw('initialize',{clientInfo:{name:'cutroom_local',title:'CUTROOM Local Video Workflow',version:'0.1.0'}},15000)
        .then(()=>{this.send({method:'initialized',params:{}});resolve();})
        .catch(fail);
    }).finally(()=>{this.starting=null;});
    return this.starting;
  }

  send(message){if(!this.child?.stdin?.writable)throw new Error('Codex App Server is not available.');this.child.stdin.write(`${JSON.stringify(message)}\n`);}
  requestRaw(method,params={},timeoutMs=15000){
    const id=this.nextId++;
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{this.pending.delete(id);reject(new Error(`Codex App Server timed out while calling ${method}.`));},timeoutMs);
      this.pending.set(id,{resolve,reject,timer});
      try{this.send({method,id,params});}catch(error){clearTimeout(timer);this.pending.delete(id);reject(error);}
    });
  }
  async request(method,params={},timeoutMs=15000){await this.start();return this.requestRaw(method,params,timeoutMs);}
  handleLine(line){
    let message;try{message=JSON.parse(line);}catch{return;}
    if(message.id!==undefined&&this.pending.has(message.id)){
      const item=this.pending.get(message.id);clearTimeout(item.timer);this.pending.delete(message.id);
      if(message.error)item.reject(new Error(message.error.message||'Codex App Server request failed.'));else item.resolve(message.result);
      return;
    }
    if(message.method?.startsWith('account/'))this.lastNotification={method:message.method,params:message.params,at:new Date().toISOString()};
  }
  rejectAll(error){for(const item of this.pending.values()){clearTimeout(item.timer);item.reject(error);}this.pending.clear();}
  async status({refresh=false}={}){
    const result=await this.request('account/read',{refreshToken:refresh});
    const account=result?.account||null;
    return {available:true,connected:account?.type==='chatgpt',authType:account?.type||null,email:account?.email||null,planType:account?.planType||null,requiresOpenaiAuth:!!result?.requiresOpenaiAuth,lastNotification:this.lastNotification};
  }
  async login(){
    const result=await this.request('account/login/start',{type:'chatgpt',useHostedLoginSuccessPage:true,appBrand:'chatgpt'},30000);
    return {loginId:result?.loginId||null,authUrl:result?.authUrl||null,type:result?.type||'chatgpt'};
  }
  async logout(){await this.request('account/logout',{});return this.status();}
  close(){if(this.child){this.child.kill('SIGTERM');this.child=null;}this.rejectAll(new Error('Codex App Server closed.'));}
}

export const safeCodexAccountStatus=(value)=>({available:value?.available!==false,connected:!!value?.connected,authType:value?.authType||null,email:value?.email||null,planType:value?.planType||null,error:value?.error||null});
