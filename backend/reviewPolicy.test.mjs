import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewPolicy,buildCaseRecord,caseReportHTML,revise,decide} from '../frontend/src/review-policy.js';
import {caseInfo,initialRecords,startTime} from '../frontend/src/case-data.js';

const sample=(...enabled)=>({context:caseInfo,asOf:startTime,records:initialRecords().map(r=>({...r,enabled:enabled.includes(r.id)})),verified:true,reason:'Matched independent records for the session.',outcome:'Open review',audit:[]});
test('matched independent evidence requires attestation and reasoning',()=>{
 const state=sample('ORD-01','FUL-01');
 assert.equal(reviewPolicy(state).canClear,true);
 for(const patch of [{verified:false},{reason:' '}])assert.equal(reviewPolicy({...state,...patch}).canClear,false);
});
test('missing, sparse and mismatched evidence cannot clear',()=>{
 for(const state of [sample(),sample('ORD-01'),sample('CKT-ALT-09')]){
   assert.equal(reviewPolicy(state).canClear,false);assert.equal(reviewPolicy(state).canEscalate,true);
 }
});
test('export rejects stale clearance and isolates case history',()=>{
 const state={...sample(),outcome:'Cleared',audit:[{caseId:'other',session:caseInfo.session},{caseId:caseInfo.caseId,session:caseInfo.session,text:'Matched'}]};
 const r=buildCaseRecord(state);assert.equal(r.outcome,'Open review');assert.equal(r.reviewerAttestation,false);
 assert.equal(r.audit.length,1);assert.equal(r.audit[0].text,'Matched');assert.equal(r.paymentRestrictionExecuted,false);
});
test('printable export escapes analyst input and carries demo boundaries',()=>{
 const html=caseReportHTML(buildCaseRecord({...sample(),reason:'<script>alert("x")</script>'}));
 for(const text of ['&lt;script&gt;','Unsigned browser-local','No payment restriction'])assert.ok(html.includes(text));assert.ok(!html.includes('<script>'));
});
test('scenario renames have identical policy for all initial examples',()=>{
 for(const state of [sample(),sample('CKT-ALT-09'),sample('ORD-01','FUL-01')])
   assert.deepEqual(reviewPolicy({...state,scenario:'seasonal'}),reviewPolicy({...state,scenario:'arbitrary_label_xyz'}));
});
test('same case changes with records and preserves historical evidence and analyst reason',()=>{
 const cleared=decide(sample('ORD-01','FUL-01'),'Cleared');
 const records=cleared.records.map(r=>r.id==='CKT-ALT-09'?{...r,enabled:true}:r);
 const next=revise(cleared,records,'CKT-ALT-09',startTime);
 assert.equal(next.audit.at(-1).before.outcome,'Cleared');assert.equal(next.verified,false);
 assert.equal(next.audit.at(-1).before.records.find(r=>r.id==='CKT-ALT-09').enabled,false);
 assert.equal(reviewPolicy(next).linked,18);assert.equal(reviewPolicy(next).recommended,'escalate_scoped_mismatch');
 const unlinked=revise(decide(next,'Escalated'),records.map(r=>r.id==='CKT-ALT-09'?{...r,link_intact:false}:r),'CKT-ALT-09',startTime);
 assert.equal(reviewPolicy(unlinked).recommended,'unresolved_conflict');assert.equal(reviewPolicy(unlinked).linked,0);
 assert.equal(unlinked.outcome,'Open review');assert.equal(unlinked.audit.at(-1).before.outcome,'Escalated');
});
test('bank feed visibility changes only the available transfer edges',()=>{
 const full=reviewPolicy(sample('CKT-ALT-09','BANK-101','BANK-102','BANK-103'));
 const off=reviewPolicy(sample('CKT-ALT-09'));assert.equal(full.bankEdges.length,3);assert.deepEqual({...full,bankEdges:[]},off);
});
test('merchant claim cannot override a linked checkout observation',()=>{
 assert.deepEqual(reviewPolicy(sample('CKT-ALT-09','CLAIM-01')),reviewPolicy(sample('CKT-ALT-09')));
});
test('future, wrong-session, unknown payment and same-source records cannot justify clearance',()=>{
 for(const patch of [{received_time:'2027-01-01T00:00:00Z'},{session_ref:'other'},{linked_payment_ids:['outside']},{source_name:'Order reconciliation ledger'}]){
  const state=sample('ORD-01','FUL-01');Object.assign(state.records.find(r=>r.id==='FUL-01'),patch);assert.equal(reviewPolicy(state).canClear,false);
 }
});
