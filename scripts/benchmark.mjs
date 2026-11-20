// Each row specifies an expected review disposition and hidden synthetic truth separately.
import {caseInfo,initialRecords,startTime} from '../frontend/src/case-data.js';
import {reviewPolicy} from '../frontend/src/review-policy.js';
import assert from 'node:assert/strict';
const clear='clearable_supported_scope',ask='clarify_missing_evidence',alert='escalate_scoped_mismatch',unresolved='unresolved_conflict';
const cases=[
 ['Festival fulfilment',9,'OF',clear,false],['Promotion',7,'OF',clear,false],
 ['High-volume alternate',6,'X',alert,true],['Low-volume alternate',1,'X',alert,true],
 ['Conflicting explanations',2,'OFXC',alert,true],['Claim plus mismatch',1,'XC',alert,true],
 ['Seasonal orders only',8,'O',ask,false],['Sparse history',1,'',ask,false],
 ['Merchant claim only',3,'C',ask,false],['Bank-only burst',5,'B',ask,false],
 ['Missing checkout link',4,'U',unresolved,true],['Late unseen observation',1,'L',ask,true],
 ['Wrong session',2,'W',ask,false],['Unknown payment',1,'A',unresolved,false],
 ['Independent deliveries',2,'OF',clear,false],['Shared source',3,'S',ask,false]
];
const rows=cases.map(([name,volume,inputs,expected,mismatch])=>{
 const records=initialRecords();
 for(const r of records){
  if(r.id==='PAY-01')r.volume_multiple=volume;
  if(r.id==='ORD-01')r.enabled=inputs.includes('O')||inputs==='S';
  if(r.id==='FUL-01'){r.enabled=inputs.includes('F')||inputs==='S';if(inputs==='S')r.source_name='Order reconciliation ledger';}
  if(r.id==='CKT-ALT-09'){
    r.enabled=/[XULWA]/.test(inputs);if(inputs==='U')r.link_intact=false;
    if(inputs==='L')r.received_time='2026-11-20T00:00:00Z';
    if(inputs==='W')r.session_ref='other';if(inputs==='A')r.linked_payment_ids=['unknown'];
  }
  if(r.id==='CLAIM-01')r.enabled=inputs.includes('C');
  if(r.transfer)r.enabled=inputs.includes('B');
 }
 const p=reviewPolicy({records,context:caseInfo,asOf:startTime});
 assert.equal(p.recommended,expected,name);
 return {name,volume,score:p.score,mismatch,recommendation:p.recommended};
});
const budget=4;
console.log('Controlled synthetic cases | 16 | queue capacity 4 | ties retain input order');
for(const key of ['volume','score']){
 const selected=rows.toSorted((a,b)=>b[key]-a[key]).slice(0,budget);
 const hits=selected.filter(r=>r.mismatch).length;
 console.log(key,JSON.stringify({reviewed:selected.map(r=>r.name),mismatchFound:hits,genuineQueued:budget-hits,missed:rows.filter(r=>r.mismatch).length-hits}));
}
console.log('Recommendations',Object.fromEntries([clear,ask,alert,unresolved].map(k=>[k,rows.filter(r=>r.recommendation===k).length])));
