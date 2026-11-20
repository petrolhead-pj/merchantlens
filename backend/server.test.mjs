import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from './server.mjs';
test('demo API discloses fixture mode and rejects mutations',async()=>{
 const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{const base=`http://127.0.0.1:${server.address().port}`;
 const health=await (await fetch(base+'/api/health')).json();assert.equal(health.livePayments,false);assert.equal(health.trainedModels,false);
 assert.equal((await fetch(base+'/api/scenarios')).status,200);
 assert.equal((await fetch(base+'/api/health',{method:'POST'})).status,405);
 assert.equal((await fetch(base+'/missing')).status,404);
 }finally{await new Promise(r=>server.close(r));}
});

import {paymentExample,lateExample} from '../frontend/src/replay.js';
test('local HTTP replay validates, deduplicates concurrent deliveries and snapshots late evidence',async()=>{
 const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try {
  const path='http://127.0.0.1:'+server.address().port+'/api/replay';
  const send=(event,url=path)=>fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(event)});
  assert.equal((await send(lateExample)).status,400);
  assert.equal((await send({...paymentExample,amount:'-1'})).status,400);
  const receipts=await Promise.all([send(paymentExample),send(paymentExample)].map(async p=>(await p).json()));
  assert.deepEqual(receipts.map(r=>r.receipt).sort(),['duplicate_ignored','payment_accepted']);
  assert.equal((await (await send({...paymentExample,event_id:'alias'})).json()).receipt,'duplicate_ignored');
  assert.equal((await send({...paymentExample,amount:'42'})).status,400);
  const decision=await (await send({reason:'Ask for mapped checkout details',outcome:'Escalated'},path+'/decision')).json();
  assert.equal(decision.state.outcome,'Escalated');
  const late=await (await send(lateExample)).json();assert.equal(late.payments,1);assert.equal(late.cases,1);assert.equal(late.state.exposurePaise,50000);
  assert.equal(late.state.audit.at(-1).before.policy.recommended,'clarify_missing_evidence');assert.equal(late.decision.recommended,'escalate_scoped_mismatch');
  assert.equal(late.state.audit.at(-1).before.outcome,'Escalated');assert.equal(late.state.outcome,'Open review');
  assert.ok(late.state.audit.at(-1).before.asOf<late.state.audit.at(-1).after.asOf);
  const reset=await (await send({},path+'/reset')).json();assert.equal(reset.cases,0);assert.equal(reset.state.audit.length,0);
 }finally{await new Promise(r=>server.close(r));}
});
