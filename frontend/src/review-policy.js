// Demo evidence attestations are analyst actions, not cryptographic verification.
export const evidenceFor = (scenario) => ({
  id: scenario === 'seasonal' ? 'EV-DIWALI-582' : scenario === 'mixed' ? 'EV-CHECKOUT-0921' : 'EV-MISSING-0921',
  merchant: 'SRB-2041', session: 'PS-0921', interval: 'Synthetic replay / flagged checkout window',
  source: 'Synthetic checkout observation + order/fulfilment fixture',
  finding: scenario === 'seasonal' ? 'Campaign orders and deliveries support bakery activity.' : scenario === 'mixed' ? 'Alternate checkout observation conflicts with the declared bakery purpose.' : 'Independent checkout purpose evidence is unavailable.',
});
export function reviewPolicy({ scenario, evidence, verified, reason }) {
  const hasReason = Boolean(reason?.trim());
  const covered = evidence && scenario !== 'unknown';
  return {
    canClear: hasReason && covered && verified && scenario === 'seasonal',
    canEscalate: hasReason,
    recommended: !covered ? 'Request clarification' : scenario === 'mixed' ? 'Escalate checkout mismatch' : 'Verify evidence, then clear',
    explanation: !covered ? 'Missing evidence keeps this case unresolved. Escalation can request further investigation; it does not establish betting activity.' : scenario === 'mixed' ? 'The synthetic checkout observation supports escalation of this session. A generic catering reply does not resolve the mismatch.' : !verified ? 'Confirm the merchant, session, interval and source before clearing.' : 'Matched seasonal evidence supports clearance with reviewer reasoning.',
  };
}
export function buildCaseRecord({scenario,evidence,bank,verified,outcome,reason,audit,requested,response}) {
  const policy=reviewPolicy({scenario,evidence,verified,reason});
  const applicable=outcome === 'Cleared' ? policy.canClear : outcome === 'Escalated' ? policy.canEscalate : false;
  return {schemaVersion:2,project:'MerchantLens',team:['Shreyas Naik','Paarth Jain','Anshul Vaibhav'],dataMode:'synthetic demonstration',exportedAt:new Date().toISOString(),scenario,merchant:'SRB-2041',scoreType:'illustrative fixture, not trained inference',evidenceAvailable:evidence,bankFeedAvailable:bank,evidenceRecord:evidenceFor(scenario),reviewerAttestation:verified && evidence && scenario !== 'unknown',clarificationRequested:requested,simulatedResponseLoaded:response,outcome:applicable?outcome:'Open review',reviewerReason:reason,recommendation:policy.recommended,decisionScope:'PS-0921 / flagged checkout window only',paymentRestrictionExecuted:false,limitations:['Synthetic fixtures; no trained inference or live feeds.','Browser-local records are editable and unsigned.','Transfer sequence does not prove allocation of commingled funds.'],audit:audit.filter(a=>a.scenario===scenario)};
}
export function caseReportHTML(record) {
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fields=[['Scenario',record.scenario],['Merchant / session',record.merchant+' / '+record.evidenceRecord.session],['Scope',record.decisionScope],['Evidence',record.evidenceRecord.id],['Finding',record.evidenceRecord.finding],['Checkout / bank coverage',`${record.evidenceAvailable} / ${record.bankFeedAvailable}`],['Reviewer attestation',record.reviewerAttestation],['Current outcome',record.outcome],['Reviewer reasoning',record.reviewerReason||'Not recorded'],['Next step',record.recommendation]];
  return '<!doctype html><html lang="en"><meta charset="utf-8"><title>MerchantLens case report</title><style>body{font:15px system-ui;color:#142638;max-width:850px;margin:40px auto;padding:20px}h1{color:#1262b3}td,th{padding:10px;border-bottom:1px solid #ddd;text-align:left;vertical-align:top}table{border-collapse:collapse;width:100%}p,td{overflow-wrap:anywhere}button{padding:12px}@media print{button{display:none}body{margin:0}}</style><h1>MerchantLens / Case record</h1><p>SYNTHETIC DEMONSTRATION | Unsigned browser-local export</p><p>'+esc(record.team.join(' · '))+'</p><p>Exported '+esc(record.exportedAt)+'</p><button onclick="window.print()">Print / Save as PDF</button><table>'+fields.map(([k,v])=>'<tr><th>'+esc(k)+'</th><td>'+esc(v)+'</td></tr>').join('')+'</table><h2>Scenario history</h2>'+record.audit.map(a=>'<p>'+esc(a.time)+' · '+esc(a.text)+'<br>'+esc(a.reason)+'</p>').join('')+'<h2>Boundaries</h2>'+record.limitations.map(x=>'<p>'+esc(x)+'</p>').join('')+'<p>No payment restriction was executed.</p></html>';
}
