import {transfers} from './money-trail-data.js';

export const merchant = 'SRB-2041';
export const session = 'PS-0921';
export const startTime = '2026-11-19T05:10:00.000Z';
const ids = Array.from({length:248}, (_,i) => 'TXN-' + String(801+i).padStart(4,'0'));
export const caseInfo = {caseId:'ML-2041', merchant, session, payments:ids};
export function evidence(id, tier, source, finding, linked, extra={}) {
  return {id, data_source_tier:tier, source_name:source, observation_time:'2026-11-19T05:00:00.000Z',
    received_time:startTime, merchant_ref:merchant, session_ref:session, linked_payment_ids:linked,
    finding, enabled:false, link_intact:true, ...extra};
}
export function initialRecords() {
  const batch = ids.slice(0,18);
  return [
    evidence('PAY-01','payment_profile','Bakery collections ledger','ambiguous_unmatched',ids,{enabled:true,volume_multiple:6}),
    evidence('ORD-01','authorized_checkout_fulfilment','Order reconciliation ledger','supports_declared_purpose',batch,{kind:'order'}),
    evidence('FUL-01','authorized_checkout_fulfilment','Delivery partner manifest','supports_declared_purpose',batch,{kind:'fulfilment'}),
    evidence('CKT-ALT-09','authorized_checkout_fulfilment','Checkout observer','conflicts_declared_purpose',batch,{detail:'Session observation describes a wager deposit outside the bakery profile.'}),
    evidence('CLAIM-01','merchant_claim','Sunrise Bakery manager','uncorroborated_claim',batch,{detail:'Merchant attributes the receipts to catering.'}),
    ...transfers.map((row,i)=>evidence(row.id,'authorized_payout_bank','Settlement partner statement',i?'unverified_onward_transfer':'operating_expense_supported',[],{transfer:row}))
  ];
}
