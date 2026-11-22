import http from 'node:http';
import {localCases} from './exhibition.mjs';
import {createPayuSandbox} from './payu-sandbox.mjs';
import {awsBridge} from './aws-bridge.mjs';
import { pathToFileURL } from 'node:url';
import {newReplay,applyEvent,replayPayload,replayDecision} from '../frontend/src/replay.js';
export function createServer({ payuOptions } = {}) {
  let replay=newReplay();
  const sandbox=createPayuSandbox({
    ...payuOptions,
    record: evidence => exhibition.recordSandbox(evidence),
  });
  const exhibition=localCases({ ownsSandbox: sandbox.owns });
  return http.createServer(async (req,res)=>{
    res.setHeader('Content-Type','application/json');
    res.setHeader('Cache-Control','no-store');
    if(req.url === '/betting-demo' || req.url.startsWith('/api/payu-sandbox/'))return sandbox.handle(req,res);
    if(req.url.startsWith('/api/cases'))return exhibition(req,res);
    if(req.url.startsWith('/api/cloud'))return awsBridge(req,res);
    if(req.method==='POST' && ['/api/replay','/api/replay/reset','/api/replay/decision'].includes(req.url)){
      try {
        if(req.headers['content-type']?.split(';')[0]!=='application/json') throw new Error('JSON required');
        let body='';
        for await(const chunk of req){body+=chunk;if(body.length>10000) throw new Error('Event too large');}
        const event=JSON.parse(body);
        // Apply completed envelopes serially on the Node event loop; no await inside this state transition.
        if(req.url.endsWith('/reset')) replay=newReplay();
        else if(req.url.endsWith('/decision')) replay=replayDecision(replay,event);
        else replay=applyEvent(replay,event);
        res.end(JSON.stringify(replayPayload(replay)));
      } catch(error){res.writeHead(400);res.end(JSON.stringify({error:error.message}));}
      return;
    }
    if(req.method!=='GET'){res.writeHead(405);res.end(JSON.stringify({error:'Read-only demo API'}));return;}
    const routes={
      '/api/replay':replayPayload(replay),
      '/api/health':{status:'ok',mode:'synthetic-demo',livePayments:false,trainedModels:false},
      '/api/scenarios':{scenarios:[{id:'mixed',label:'Mixed-purpose merchant'},{id:'seasonal',label:'Diwali sales surge'},{id:'unknown',label:'Incomplete evidence'}]},
      '/api/capabilities':{graph:'browser-rendered',modelInference:'evidence rules only',reviewPersistence:false,productionServices:'not connected'}
    };
    const data=routes[req.url];res.writeHead(data?200:404);res.end(JSON.stringify(data||{error:'Not found'}));
  });
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href){
 const port=Number(process.env.PORT||3001);createServer().listen(port,'127.0.0.1',()=>console.log(`MerchantLens demo API: http://127.0.0.1:${port}`));
}
