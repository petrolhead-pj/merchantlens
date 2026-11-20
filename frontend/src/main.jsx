import React,{lazy,Suspense,useState,useEffect,useRef} from 'react';
import {createRoot} from 'react-dom/client';
import MoneyTrail from './MoneyTrail.jsx';
import {caseInfo,initialRecords,startTime} from './case-data.js';
import {labels,reviewPolicy,decide,revise,buildCaseRecord,caseReportHTML} from './review-policy.js';
import {newReplay,applyEvent,paymentExample,lateExample,replayPayload,replayDecision} from './replay.js';
import './style.css';
import './stall.css';

const Graph=lazy(()=>import('./Graph.jsx'));
const key='merchantlens-finale-v3';
const fresh=()=>({context:caseInfo,records:initialRecords(),asOf:startTime,audit:[],reason:'',verified:false,outcome:'Open review'});
function restore(){
  try {
    const previous=JSON.parse(localStorage.getItem(key));
    if(previous?.context.caseId===caseInfo.caseId && previous.context.session===caseInfo.session &&
      Array.isArray(previous.audit) && Array.isArray(previous.records)){
      reviewPolicy(previous);
      return {...previous,verified:false,outcome:'Open review'};
    }
  } catch {}
  return fresh();
}
function download(name,content,type){
  const url=URL.createObjectURL(new Blob([content],{type}));
  const link=document.createElement('a');link.href=url;link.download=name;link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function api(path,body){
  const response=await fetch(path,{...(body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(2500)});
  if(!response.ok) throw Object.assign(new Error('Replay service returned '+response.status),{status:response.status});
  return response.json();
}
function App(){
  const [state,setState]=useState(restore),[selection,select]=useState('bakery'),[search,setSearch]=useState('');
  const [replay,setReplay]=useState(()=>replayPayload(newReplay())),[transport,setTransport]=useState('Checking'),[message,setMessage]=useState('');
  const [busy,setBusy]=useState(false),lock=useRef(false),[showGraph,setShowGraph]=useState(false),[epoch,setEpoch]=useState(0);
  useEffect(()=>{let active=true;api('/api/replay').then(result=>{
    if(active){setReplay(result);setTransport('Local Node API');}
  }).catch(()=>{if(active)setTransport('Browser replay');});return ()=>{active=false;};},[]);
  useEffect(()=>{try{if(state.audit.length || state.reason || state.verified) localStorage.setItem(key,JSON.stringify(state));else localStorage.removeItem(key);}catch{setMessage('Browser storage unavailable. Export this case before closing.');}},[state]);
  const policy=reviewPolicy(state);
  function change(id,patch){
    setState(old=>revise(old,old.records.map(r=>r.id===id?{...r,...patch}:r),id,
      new Date(Math.max(Date.now(),Date.parse(old.asOf))).toISOString()));
  }
  async function replayAction(event,reset=false,decision=false){
    if(lock.current)return;
    lock.current=true;setBusy(true);setMessage('');
    try{
      let result;
      if(transport==='Local Node API'){
        try{result=await api(reset?'/api/replay/reset':decision?'/api/replay/decision':'/api/replay',event);}
        catch(error){
          if(error.status && error.status<500) throw error;
          setTransport('Browser replay');
          setMessage('Local API unavailable. Continuing on this page from the last acknowledged replay.');
        }
      }
      if(!result) result=replayPayload(reset?newReplay():decision?replayDecision(replay.state,event):applyEvent(replay.state,event));
      setReplay(result);
      if(reset){
        for(const item of Object.keys(localStorage)) if(item.startsWith('merchantlens-')) localStorage.removeItem(item);
        setState(fresh());select('bakery');setShowGraph(false);setSearch('');setEpoch(v=>v+1);setMessage('Stall reset. Ready for the next review.');
      }
    }catch(error){setMessage(error.message+'. Retry when the local service is available.');}
    finally{lock.current=false;setBusy(false);}
  }
  const graphNodes=['customers','bakery',...policy.bankEdges.flatMap(e=>[e.from,e.to])];
  if(policy.sourceIds.includes('CKT-ALT-09'))graphNodes.push('other');
  if(policy.sourceIds.includes('ORD-01'))graphNodes.push('cake','orders');
  const editReview=patch=>setState(s=>({...s,...patch,outcome:'Open review'}));
  const record=()=>buildCaseRecord(state);
  return <main className="stall"><header><div><small>MERCHANT RISK OPERATIONS</small><h1>MerchantLens</h1></div><button disabled={busy||transport==='Checking'} onClick={()=>replayAction({},true)}>Reset Stall Demo State</button></header>
  <section className="intro"><div><small>CASE ML-2041 · MERCHANT SRB-2041 · SESSION PS-0921</small><h2>Sunrise Bakery</h2><p>248 payments of ₹500 · Synthetic investigation · Local replay</p></div><div className="volume">{policy.spike?'6× collections':'Profile unavailable'}</div></section>
  <div key={epoch}><div className="columns"><section className="card"><h2>Evidence &amp; Data Availability Controls</h2><p>Enable a source, inspect its observation, or sever its payment mapping.</p>
  {state.records.map(r=><article className="source" key={r.id}><label><input type="checkbox" checked={r.enabled} onChange={e=>change(r.id,{enabled:e.target.checked})}/><strong>{r.id}</strong> · {r.source_name}</label>
  {r.enabled && r.id==='CKT-ALT-09' && <button className="mapping-action" aria-pressed={!r.link_intact} onClick={()=>change(r.id,{link_intact:!r.link_intact})}>{r.link_intact?'Sever':'Restore'} CKT-ALT-09 payment mapping</button>}
  {r.enabled && <details><summary>Inspect observation</summary><p>{r.detail||r.transfer?.evidence||r.finding.replaceAll('_',' ')}</p><p>{r.data_source_tier} · {r.merchant_ref} / {r.session_ref}</p><p>Observed {r.observation_time}<br/>Received {r.received_time}</p>
  {r.linked_payment_ids.length>0 && <>{r.id!=='CKT-ALT-09' && <label><input type="checkbox" checked={r.link_intact} onChange={e=>change(r.id,{link_intact:e.target.checked})}/>Payment mapping intact</label>}<p className="ids">{r.link_intact?r.linked_payment_ids.join(', '):'Unmatched observation'}</p></>}</details>}</article>)}
  <button onClick={()=>setState(s=>revise(s,s.records.map(r=>r.data_source_tier==='authorized_payout_bank'?{...r,enabled:!policy.bankEdges.length}:r),'Bank visibility'))}>{policy.bankEdges.length?'Hide':'Show'} downstream bank feed</button></section>
  <section className="card decision" aria-live="polite"><small>ANALYST REVIEW</small><h2>{labels[policy.recommended]}</h2><p>{policy.explanation}</p><div className="numbers"><strong>{policy.linked} / {policy.total}</strong><span>payments in review scope · {(policy.linked/policy.total*100).toFixed(1)}%</span></div>
  <p>{policy.total-policy.linked} outside this scope remain unverified. Independent purpose evidence covers {(policy.coverageRatio*100).toFixed(1)}% of payments.</p>
  <p>Queue points <b>{policy.score}</b> · {policy.sourceIds.join(', ')||'No mapped purpose sources'}</p>
  {state.records.some(r=>r.enabled&&r.data_source_tier==='merchant_claim')&&<p>Merchant claim · {policy.sourceIds.length?'Compare against '+policy.sourceIds.join(', '):'No independent purpose evidence available'}. A catering explanation alone cannot clear the case.</p>}
  {policy.missing.map(m=><p key={m} className="callout">{m}</p>)}
  <details><summary>Inspect scoped payment IDs</summary><p className="ids">{policy.scope.join(', ')||'No assigned scope'}</p></details>
  <label>Reviewer reasoning<textarea value={state.reason} onChange={e=>editReview({reason:e.target.value})}/></label>
  <label><input type="checkbox" checked={state.verified} disabled={policy.recommended!=='clearable_supported_scope'} onChange={e=>editReview({verified:e.target.checked})}/>I verified the records and the payment scope.</label>
  <div className="actions">{['Cleared','Escalated'].map((v,i)=><button key={v} disabled={!(i?policy.canEscalate:policy.canClear)} onClick={()=>setState(s=>decide(s,v))}>{i?'Escalate for review':'Clear supported scope'}</button>)}</div><p>Disposition · {state.outcome}</p>
  </section></div>
  <section className="card"><h2>Live Webhook Replay (Synthetic PayU Event)</h2><p>{transport} · Isolated one-payment example · Payment and checkout evidence arrive separately.</p>
  <div className="actions">{[['Send Payment Event',paymentExample],['Replay Duplicate Event',paymentExample],['Deliver Late Conflicting Record',lateExample]].map(([name,event],i)=><button key={name} disabled={busy||transport==='Checking'||(i>0&&!replay.payments)} onClick={()=>replayAction(event)}>{name}</button>)}</div>
  <p role="status">{replay.receipt||'Awaiting event'} · {replay.payments} payment(s) · {replay.cases} case(s) · ₹{replay.state.exposurePaise/100}</p><p>{labels[replay.decision.recommended]} · {replay.decision.explanation}</p>
  <details><summary>Record analyst disposition before late delivery</summary><form onSubmit={e=>{e.preventDefault();replayAction({reason:new FormData(e.currentTarget).get('reason'),outcome:'Escalated'},false,true);}}>
  <label>Replay analyst reason <input name="reason" required maxLength={2000}/></label><button disabled={busy||!replay.payments}>Request analyst investigation</button></form><p>{replay.state.outcome}</p></details>
  <details><summary>Raw events and decision trace</summary><pre>{JSON.stringify({sample:paymentExample,events:replay.state.events,activeSources:replay.activeSources,history:replay.state.audit},null,2)}</pre></details></section>
  <MoneyTrail key={policy.bankEdges.map(e=>e.id).join()} edges={policy.bankEdges} incoming={caseInfo.payments.length*50000} onSelect={id=>{select(id);setShowGraph(true);}} onReview={()=>document.querySelector('textarea').focus()}/>
  <section className="card"><button onClick={()=>setShowGraph(!showGraph)}>{showGraph?'Close':'Open'} typed temporal transaction &amp; evidence graph</button>{showGraph&&<><p>Selected entity · {graphNodes.includes(selection)?selection:'bakery'}</p><div className="graph-stage"><Suspense fallback={<p>Loading local graph…</p>}><Graph bankEdges={policy.bankEdges} activeNodes={graphNodes} selected={selection} onSelect={select} playing={false} filter="all"/></Suspense></div></>}</section>
  <details className="card"><summary>Payment explorer</summary><input aria-label="Find payment" placeholder="Find payment ID" value={search} onChange={e=>setSearch(e.target.value)}/><ul className="ids">{caseInfo.payments.filter(id=>id.includes(search.toUpperCase())).map(id=><li key={id}>{id} · ₹500 · {policy.scope.includes(id)?'In review scope':'Outside scope'}</li>)}</ul></details>
  <section className="card"><h2>Decision history</h2>{state.audit.slice().reverse().map((a,i)=><details key={i}><summary>{a.time} · {a.text}</summary><pre>{JSON.stringify(a,null,2)}</pre></details>)}<div className="actions"><button onClick={()=>download('MerchantLens-case.json',JSON.stringify(record(),null,2),'application/json')}>Export JSON</button><button onClick={()=>download('MerchantLens-case.html',caseReportHTML(record()),'text/html')}>Export printable report</button></div></section>
  <footer>Implemented locally today · Evidence rules, synthetic replay, analyst review. Proposed shadow pilot · Authorized partner feeds and shared case storage. Payment authorization is separate.</footer></div><p role="status">{message}</p></main>;
}
createRoot(document.getElementById('root')).render(<App/>);
