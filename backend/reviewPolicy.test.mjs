import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewPolicy,buildCaseRecord,caseReportHTML} from '../frontend/src/review-policy.js';
const base={scenario:'seasonal',evidence:true,bank:true,verified:true,reason:'Checked campaign order and delivery against PS-0921.',outcome:'Cleared',audit:[]};
test('matched seasonal evidence requires both attestation and reasoning',()=>{
 assert.equal(reviewPolicy(base).canClear,true);
 assert.equal(reviewPolicy({...base,verified:false}).canClear,false);
 assert.equal(reviewPolicy({...base,reason:'  '}).canClear,false);
});
test('missing coverage, sparse evidence and corroborated mismatch cannot be cleared',()=>{
 for(const update of [{evidence:false},{scenario:'unknown'},{scenario:'mixed'}]) assert.equal(reviewPolicy({...base,...update}).canClear,false);
 assert.equal(reviewPolicy({...base,scenario:'unknown'}).canEscalate,true);
});
test('export invalidates stale clearance and excludes unrelated scenario history',()=>{
 const r=buildCaseRecord({...base,evidence:false,audit:[{scenario:'mixed',text:'Unrelated'},{scenario:'seasonal',text:'Matched'}]});
 assert.equal(r.outcome,'Open review');assert.equal(r.reviewerAttestation,false);assert.equal(r.audit.length,1);assert.equal(r.audit[0].text,'Matched');
 assert.equal(r.paymentRestrictionExecuted,false);assert.equal(r.decisionScope,'PS-0921 / flagged checkout window only');
});
test('printable export escapes analyst input and carries demo boundaries',()=>{
 const html=caseReportHTML(buildCaseRecord({...base,reason:'<script>alert("x")</script>'}));
 assert.ok(!html.includes('<script>'));assert.ok(html.includes('&lt;script&gt;'));assert.ok(html.includes('Unsigned browser-local'));assert.ok(html.includes('No payment restriction'));
});
