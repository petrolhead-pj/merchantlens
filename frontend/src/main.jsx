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
function Study({onExit}){
  const storageKey='ml-usability-trials-v1';
  const [rows,setRows]=useState(()=>JSON.parse(localStorage.getItem(storageKey)||'[]'));
  const [start,setStart]=useState(null);
  const [selected,setSelected]=useState([]);
  const participant=Math.floor(rows.length/2)+1, round=rows.length%2;
  const assisted=(participant-1+round)%2===1;
  const secondCase=(Math.floor((participant-1)/2)+round)%2===1;
  const ids=caseInfo.payments.slice(secondCase?20:0,secondCase?28:8);
  const linked=secondCase?[ids[1],ids[5]]:[ids[2],ids[6]];
  const records=initialRecords().filter(r=>['ORD-01','FUL-01','CKT-ALT-09'].includes(r.id)).map(r=>({...r,enabled:true,
    linked_payment_ids:r.id==='CKT-ALT-09'?linked:ids.filter(id=>!linked.includes(id))}));
  const policy=reviewPolicy({context:{...caseInfo,payments:ids},records});
  const differences=[];
  for(let i=0;i+1<rows.length;i+=2){
    const pair=rows.slice(i,i+2);
    differences.push(pair.find(r=>!r.assisted).seconds-pair.find(r=>r.assisted).seconds);
  }
  differences.sort((a,b)=>a-b);
  const mid=Math.floor(differences.length/2);
  const median=differences.length?(differences[mid]+differences[Math.floor((differences.length-1)/2)])/2:null;
  function finish(e){
    e.preventDefault();
    const form=new FormData(e.currentTarget);
    const result={participant,round:round+1,case:secondCase?'B':'A',assisted,seconds:Math.round((performance.now()-start)/100)/10,
      selected,expected:policy.scope,correctScope:selected.length===policy.linked&&selected.every(id=>policy.scope.includes(id)),
      requestedExtraContact:form.get('contact')==='yes'};
    const next=[...rows,result];localStorage.setItem(storageKey,JSON.stringify(next));setRows(next);setStart(null);setSelected([]);
  }
  return <main className="stall"><header><h1>Timed usability study</h1><button onClick={onExit}>Back to investigation</button></header>
    <section className="card"><h2>Participant {participant} · Task {round+1} of 2</h2>
    <p>Choose the payments linked to an observed purpose mismatch. Decide whether an additional merchant contact is needed to identify that scope.</p>
    {start===null?<button onClick={()=>setStart(performance.now())}>Start timed task</button>:<form onSubmit={finish}>
    <h3>{assisted?'MerchantLens review':'Raw ledger and source records'}</h3>
    {assisted&&<p className="callout">{policy.explanation} Scoped IDs: {policy.scope.join(', ')}</p>}
    {records.map(r=><p key={r.id}><b>{r.source_name}</b> · {r.finding.replaceAll('_',' ')} · {r.linked_payment_ids.join(', ')}</p>)}
    <fieldset><legend>Payment ledger · select the review scope</legend>{ids.map(id=><label key={id} style={{display:'block'}}><input type="checkbox" checked={selected.includes(id)} onChange={e=>setSelected(e.target.checked?[...selected,id]:selected.filter(x=>x!==id))}/>{id} · ₹500</label>)}</fieldset>
    <label>Request additional merchant contact? <select name="contact" required defaultValue=""><option value="">Choose</option><option value="yes">Yes</option><option value="no">No</option></select></label>
    <button>Submit and stop timer</button></form>}</section>
    {start===null&&<section className="card"><h2>Session results</h2><p>{differences.length} completed participant pairs · {rows.length} submitted attempts</p>
    {median!==null&&<p>Median paired difference (raw minus assisted): {median.toFixed(1)} seconds</p>}
    {[false,true].map(mode=>{const group=rows.filter(r=>r.assisted===mode);return <p key={String(mode)}>{mode?'MerchantLens':'Raw ledger'} · {group.filter(r=>r.correctScope).length}/{group.length} exact scopes · {group.filter(r=>r.requestedExtraContact).length} extra contacts requested</p>;})}
    <p>Both tasks contain enough evidence to identify the scope. Results stay in this browser. Export before clearing browser data.</p><button disabled={!rows.length} onClick={()=>download('MerchantLens-usability.json',JSON.stringify(rows,null,2),'application/json')}>Export trial results</button></section>}</main>;
}
function HistoricalReplay({onExit}){
  const [data,setData]=useState(null),[index,setIndex]=useState(0),[cutoff,setCutoff]=useState(''),[error,setError]=useState('');
  function selectOrder(batch,i){
    setIndex(i);setCutoff(batch.orders[i].purchase);
  }
  async function open(file){
    if(!file)return;
    try{
      const batch=JSON.parse(await file.text());
      if(batch.format!=='merchantlens-olist-v1'||typeof batch.seller!=='string'||!Array.isArray(batch.orders)||!batch.orders.length||
        !batch.orders.every(r=>typeof r.id==='string'&&typeof r.purchase==='string'&&Number.isFinite(Date.parse(r.purchase.replace(' ','T')))&&
          (r.delivery===null||typeof r.delivery==='string')&&Number.isFinite(Number(r.amount))&&typeof r.method==='string'))throw Error();
      setData(batch);selectOrder(batch,0);setError('');
    }catch{setData(null);setError('Choose the JSON produced by scripts/import_olist.py.');}
  }
  const order=data?.orders[index];
  return <main className="stall"><header><h1>Historical order replay</h1><button onClick={onExit}>Back to investigation</button></header>
    <section className="card"><h2>Olist · Brazilian commerce</h2><p>Choose a locally prepared replay. Payment rows are linked retrospectively by order ID. The cutoff controls delivery evidence using the recorded event time.</p>
    <label>Open Olist replay JSON <input type="file" accept=".json" onChange={e=>open(e.target.files[0])}/></label><p role="alert">{error}</p></section>
    {order&&<section className="card"><p>Input payment rows: {data.inputPaymentRows} · Eligible orders across sellers: {data.eligibleOrders} · Selected seller: {data.orders.length} orders</p>
    <p>Seller {data.seller}</p><label>Order <select value={index} onChange={e=>selectOrder(data,Number(e.target.value))}>{data.orders.map((r,i)=><option key={r.id} value={i}>{r.purchase.slice(0,10)} · {r.id}</option>)}</select></label>
    <p>Purchased {order.purchase} · R$ {order.amount} · {order.method}</p>
    <label>Evidence cutoff <input type="datetime-local" step="1" value={cutoff.replace(' ','T')} min={order.purchase.replace(' ','T')} onChange={e=>{if(e.target.value)setCutoff(e.target.value.replace('T',' '));}}/></label>
    <div className="actions"><button onClick={()=>setCutoff(order.purchase)}>At purchase</button><button onClick={()=>setCutoff('2019-01-01 00:00:00')}>End of dataset window</button></div>
    <p aria-live="polite">{cutoff<order.purchase?'Cutoff precedes this purchase.':order.delivery&&order.delivery<=cutoff?'Delivery recorded on '+order.delivery:'No delivery recorded by this cutoff.'}</p>
    </section>}<footer>Source: Olist Brazilian E-Commerce Public Dataset · CC BY-NC-SA 4.0 · Single-seller, single-payment subset. Order fulfilment alone cannot establish merchant-wide legitimacy.</footer></main>;
}
function App(){
  const [state,setState]=useState(restore),[selection,select]=useState('bakery'),[search,setSearch]=useState('');
  const [replay,setReplay]=useState(()=>replayPayload(newReplay())),[transport,setTransport]=useState('Checking'),[message,setMessage]=useState('');
  const [busy,setBusy]=useState(false),lock=useRef(false),[showGraph,setShowGraph]=useState(false),[epoch,setEpoch]=useState(0);
  useEffect(()=>{let active=true;api('/api/replay').then(result=>{
    if(active){setReplay(result);setTransport('Local Node API');}
  }).catch(()=>{if(active)setTransport('Browser replay');});return ()=>{active=false;};},[]);
  useEffect(()=>{try{if(state.audit.length || state.reason || state.verified) localStorage.setItem(key,JSON.stringify(state));else localStorage.removeItem(key);}catch{setMessage('Browser storage unavailable. Export this case before closing.');}},[state]);
  const [study,setStudy]=useState(false);
  const policy=reviewPolicy(state);
  const revision=state.audit.at(-1);
  const changed=state.records.find(r=>r.id===revision?.changed);
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
  if(study==="olist")return <HistoricalReplay onExit={()=>setStudy(false)}/>;
  if(study)return <Study onExit={()=>setStudy(false)}/>;
  return <main className="stall"><header><div><small>MERCHANT RISK OPERATIONS</small><h1>MerchantLens</h1></div><button onClick={()=>setStudy("olist")}>Historical order replay</button><button onClick={()=>setStudy(true)}>Timed usability study</button><button disabled={busy||transport==='Checking'} onClick={()=>replayAction({},true)}>Reset Stall Demo State</button></header>
  <section className="intro"><div><small>CASE ML-2041 · MERCHANT SRB-2041 · SESSION PS-0921</small><h2>Sunrise Bakery</h2><p>248 payments of ₹500 · Synthetic investigation · Local replay</p></div><div className="volume">{policy.spike?'6× collections':'Profile unavailable'}</div></section>
  <div key={epoch}><div className="columns"><section className="card"><h2>Evidence &amp; Data Availability Controls</h2><p>Enable a source, inspect its observation, or sever its payment mapping.</p>
  {state.records.map(r=><article className="source" key={r.id}><label><input type="checkbox" checked={r.enabled} onChange={e=>change(r.id,{enabled:e.target.checked})}/><strong>{r.id}</strong> · {r.source_name}</label>
  {r.enabled && r.id==='CKT-ALT-09' && <button className="mapping-action" aria-pressed={!r.link_intact} onClick={()=>change(r.id,{link_intact:!r.link_intact})}>{r.link_intact?'Sever':'Restore'} CKT-ALT-09 payment mapping</button>}
  {r.enabled && <details><summary>Inspect observation</summary><p>{r.detail||r.transfer?.evidence||r.finding.replaceAll('_',' ')}</p><p>{r.data_source_tier} · {r.merchant_ref} / {r.session_ref}</p><p>Observed {r.observation_time}<br/>Received {r.received_time}</p>
  {r.linked_payment_ids.length>0 && <>{r.id!=='CKT-ALT-09' && <label><input type="checkbox" checked={r.link_intact} onChange={e=>change(r.id,{link_intact:e.target.checked})}/>Payment mapping intact</label>}<p className="ids">{r.link_intact?r.linked_payment_ids.join(', '):'Unmatched observation'}</p></>}</details>}</article>)}
  <button onClick={()=>setState(s=>revise(s,s.records.map(r=>r.data_source_tier==='authorized_payout_bank'?{...r,enabled:!policy.bankEdges.length}:r),'Bank visibility'))}>{policy.bankEdges.length?'Hide':'Show'} downstream bank feed</button></section>
  <section className="card decision" aria-live="polite"><small>ANALYST REVIEW</small><h2>{labels[policy.recommended]}</h2>{revision?.before?.outcome==='Cleared'&&state.outcome==='Open review'&&<h3 className="callout">Clearance reopened · {revision.before.policy.linked} previously cleared payments</h3>}
  {changed?.enabled&&!changed.link_intact&&<p className="callout">Payment mapping removed from {changed.id}. The observation remains available, but it can no longer identify specific payments.</p>}
  <p>{policy.explanation}</p><div className="numbers"><strong>{policy.linked} / {policy.total}</strong><span>payments in review scope · {(policy.linked/policy.total*100).toFixed(1)}%</span></div>
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
