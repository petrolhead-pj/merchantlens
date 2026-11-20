import {caseInfo} from './case-data.js';

export const labels = {
  clarify_missing_evidence:'Request mapped purpose evidence',
  clearable_supported_scope:'Eligible for scoped clearance',
  escalate_scoped_mismatch:'Escalate linked checkout mismatch',
  unresolved_conflict:'Resolve contradictory evidence'
};
export function activeRecords({records, context=caseInfo, asOf=Infinity}) {
  const cutoff = typeof asOf === 'number' ? asOf : Date.parse(asOf);
  return records.filter(r => r.enabled && r.merchant_ref === context.merchant &&
    r.session_ref === context.session && Number.isFinite(Date.parse(r.observation_time)) &&
    Date.parse(r.observation_time) <= Date.parse(r.received_time) && Date.parse(r.received_time) <= cutoff);
}
export function reviewPolicy({records,context=caseInfo,asOf,verified=false,reason=''}) {
  const active = activeRecords({records,context,asOf});
  const known = new Set(context.payments);
  const purpose = active.filter(r=>r.data_source_tier === 'authorized_checkout_fulfilment');
  const mapped = r=>r.link_intact && r.linked_payment_ids.length>0 && r.linked_payment_ids.every(id=>known.has(id));
  const sources = purpose.filter(mapped);
  const matching = sources.filter(r=>r.finding==='supports_declared_purpose');
  const supported = new Set(matching.filter(r=>r.kind==='order').flatMap(order=>
    order.linked_payment_ids.filter(id=>matching.some(r=>r.kind==='fulfilment' &&
      r.source_name!==order.source_name && r.linked_payment_ids.includes(id)))));
  const conflicts = sources.filter(r=>r.finding==='conflicts_declared_purpose');
  const disputed = new Set(conflicts.flatMap(r=>r.linked_payment_ids));
  const ambiguous = purpose.filter(r=>!mapped(r) || r.finding==='ambiguous_unmatched');
  const missing = ambiguous.map(r=>'Restore or reconcile the payment mapping for '+r.id);
  let recommended, scope, explanation;
  if (disputed.size) {
    recommended='escalate_scoped_mismatch'; scope=[...disputed];
    explanation=conflicts.map(r=>r.id+' ('+r.source_name+')').join(', ')+' links an observed profile mismatch to '+scope.length+' payments.';
    const overlap=scope.filter(id=>supported.has(id)).length;
    if(overlap) explanation+=' The checkout observation contradicts order and delivery records for '+overlap+' of those same payments in session '+context.session+'. Reconcile the sources before clearance.';
  } else if (ambiguous.length) {
    recommended='unresolved_conflict'; scope=[];
    explanation='Available observations have unresolved mappings. Request identifiers before assigning an escalation or clearance scope.';
  } else if (supported.size) {
    recommended='clearable_supported_scope'; scope=[...supported];
    explanation='Order and fulfilment records from distinct sources match '+scope.length+' payments.';
  } else {
    recommended='clarify_missing_evidence'; scope=[];
    missing.push('Request independent order and delivery records or a checkout observation mapped to the payment IDs.');
    explanation='The available evidence does not establish payment purpose.';
  }
  const coverage=new Set(sources.flatMap(r=>r.linked_payment_ids));
  const spike=active.some(r=>r.data_source_tier==='payment_profile' && r.volume_multiple>=3);
  // Transparent queue points. This index is not a calibrated probability.
  const score=(spike?10:0)+(ambiguous.length?15:0)+(disputed.size?50:0)+
    (disputed.size?Math.round(25*disputed.size/known.size):0);
  return {recommended,explanation,scope,linked:scope.length,total:known.size,coverageRatio:known.size?coverage.size/known.size:0,
    missing,score,spike,sourceIds:sources.map(r=>r.id),bankEdges:active.filter(r=>r.data_source_tier==='authorized_payout_bank' && r.link_intact && r.transfer).map(r=>r.transfer),
    canClear:recommended==='clearable_supported_scope' && verified && Boolean(reason.trim()),
    canEscalate:Boolean(reason.trim()),paymentRestrictionExecuted:false};
}
export function buildCaseRecord(state) {
  const {context=caseInfo,records,verified,reason,audit=[],outcome='Open review',asOf}=state;
  const policy=reviewPolicy(state);
  return {schemaVersion:3,dataMode:'synthetic demonstration',context,asOf,records:structuredClone(records),
    policy,reviewerAttestation:Boolean(verified && policy.recommended==='clearable_supported_scope'),
    reviewerReason:reason,outcome:(outcome==='Cleared' && policy.canClear || outcome==='Escalated' && policy.canEscalate)?outcome:'Open review',
    paymentRestrictionExecuted:false,audit:audit.filter(a=>a.caseId===context.caseId && a.session===context.session)};
}
export function caseReportHTML(record) {
  const escaped=JSON.stringify(record,null,2).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  return '<!doctype html><meta charset="utf-8"><title>MerchantLens case record</title><style>body{font:16px system-ui;margin:30px}pre{white-space:pre-wrap;overflow-wrap:anywhere}</style><h1>MerchantLens case record</h1><p>Unsigned browser-local synthetic replay. No payment restriction was executed.</p><pre>'+escaped+'</pre>';
}
export function snapshot(state) {
  const {audit,...input}=state;
  return buildCaseRecord(input);
}
export function revise(state,records,changed,time=new Date().toISOString(),context=state.context) {
  const before=snapshot(state);
  const next={...state, context, records, asOf:time, verified:false,outcome:'Open review'};
  const after=snapshot(next);
  const entry={caseId:state.context.caseId,session:state.context.session,time,changed,before,after,
    text:changed+' updated. '+labels[before.policy.recommended]+' → '+labels[after.policy.recommended]+'. '+after.policy.explanation};
  return {...next,audit:[...state.audit,entry]};
}
export function decide(state,outcome,time=new Date().toISOString()) {
  const policy=reviewPolicy(state);
  if (!(outcome==='Cleared' && policy.canClear || outcome==='Escalated' && policy.canEscalate)) return state;
  const next={...state,outcome};
  return {...next,audit:[...state.audit,{caseId:state.context.caseId,session:state.context.session,time,text:outcome,after:snapshot(next)}]};
}
