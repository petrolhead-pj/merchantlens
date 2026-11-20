import {caseInfo,evidence,startTime} from './case-data.js';
import {revise,reviewPolicy,decide} from './review-policy.js';

export const paymentExample={synthetic:true,source_feed:'payment',event_id:'evt-101',txnid:'RP-001',
  mihpayid:'900001',merchant_id:caseInfo.merchant,amount:'500.00',status:'success',addedon:'2026-11-19T05:00:00Z',
  udf_checkout_ref:'CKT-ALT-09',session_ref:caseInfo.session,received_time:startTime};
export const lateExample={synthetic:true,source_feed:'checkout',event_id:'evt-102',merchant_id:caseInfo.merchant,
  session_ref:caseInfo.session,txnid:'RP-001',checkout_ref:'CKT-ALT-09',received_time:'2026-11-19T05:15:00Z',
  observation_time:'2026-11-19T05:01:00Z',finding:'conflicts_declared_purpose',source_name:'Checkout observer'};

export function newReplay() {
  return {events:[],exposurePaise:0,context:{...caseInfo,caseId:'ML-REPLAY',payments:[]},
    records:[],audit:[],reason:'',verified:false,outcome:'Open review',asOf:startTime};
}
function requireValue(test,message) {if(!test) throw new Error(message);}
export function applyEvent(previous,event) {
  const string=k=>typeof event[k]==='string' && event[k].trim().length>0;
  requireValue(event && event.synthetic===true && ['payment','checkout'].includes(event.source_feed),'Expected a synthetic payment or checkout event');
  requireValue(['event_id','txnid','received_time'].every(string) && event.merchant_id===caseInfo.merchant &&
    event.session_ref===caseInfo.session,'Invalid identifier, merchant or session');
  const payment=event.source_feed==='payment';
  const observed=Date.parse(payment?event.addedon:event.observation_time);
  const received=Date.parse(event.received_time);
  requireValue(Number.isFinite(observed) && Number.isFinite(received) && observed<=received,'Invalid event timestamps');
  if(payment) requireValue(['mihpayid','udf_checkout_ref','amount'].every(string) && /^\d{1,9}(\.\d{1,2})?$/.test(event.amount) && Number(event.amount)>0 && event.status==='success','Invalid successful payment schema');
  else requireValue(string('source_name') && string('checkout_ref') && event.finding==='conflicts_declared_purpose','Invalid checkout observation');
  const existing=previous.events.find(e=>e.event_id===event.event_id || payment && e.source_feed==='payment' && (e.mihpayid===event.mihpayid || e.txnid===event.txnid));
  if(existing) {
    const keys=new Set([...Object.keys(existing),...Object.keys(event)]);
    requireValue([...keys].every(k=>k==='event_id' || existing[k]===event[k]),'Conflicting duplicate identifiers');
    return {...previous,receipt:'duplicate_ignored'};
  }
  if(!payment) requireValue(previous.events.some(e=>e.source_feed==='payment' && e.txnid===event.txnid && e.udf_checkout_ref===event.checkout_ref),'Missing mapped payment');
  const context=payment?{...previous.context,payments:[...previous.context.payments,event.txnid]}:previous.context;
  const record=evidence(event.event_id,payment?'payment_profile':'authorized_checkout_fulfilment',
    payment?'Local PayU-shaped payment replay':event.source_name,payment?'ambiguous_unmatched':event.finding,[event.txnid],
    {enabled:true,received_time:event.received_time,observation_time:payment?event.addedon:event.observation_time});
  const time=new Date(Math.max(received,previous.events.length?Date.parse(previous.asOf):received)).toISOString();
  const next=revise(previous,[...previous.records,record],record.id,time,context);
  return {...next,events:[...previous.events,event],exposurePaise:previous.exposurePaise+(payment?Math.round(Number(event.amount)*100):0),
    receipt:payment?'payment_accepted':'late_evidence_applied'};
}
export function replayPayload(state) {
  return {state,receipt:state.receipt,payments:state.context.payments.length,cases:Number(state.context.payments.length>0),
    activeSources:[...new Set(state.records.map(r=>r.data_source_tier))],decision:reviewPolicy(state)};
}

export function replayDecision(state,input){
  requireValue(state.context.payments.length>0 && input && typeof input.reason==='string' &&
    input.reason.trim() && input.reason.length<=2000,'A replay payment and analyst reason are required');
  const review={...state,reason:input.reason,verified:input.verified===true};
  const next=decide(review,input.outcome,state.asOf);
  requireValue(next!==review,'Decision unavailable on current evidence');
  return {...next,receipt:'analyst_decision_recorded'};
}
