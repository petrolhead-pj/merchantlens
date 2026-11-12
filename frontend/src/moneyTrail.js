// Synthetic ledger. Amounts are integer paise to avoid rounding errors.
export const accounts={bakery:'Sunrise Bakery',supplier:'Flour supplier',receiver:'Receiver R',endpoint:'Account Z'};
export const transfers=[
 {id:'BANK-101',from:'bakery',to:'supplier',paise:3600000,minute:10,time:'10:10',evidence:'INV-204 • flour delivery matched',purpose:'Supported operating expense'},
 {id:'BANK-102',from:'bakery',to:'receiver',paise:1800000,minute:18,time:'10:18',evidence:'Authorized bank transfer record • no invoice',purpose:'Purpose unresolved'},
 {id:'BANK-103',from:'receiver',to:'endpoint',paise:1500000,minute:24,time:'10:24',evidence:'Authorized bank transfer record • receiver identity unverified',purpose:'Purpose unresolved'},
];
export function trace(start,rows,maxHops=4){
 const result=[],queue=[{account:start,depth:0,after:-Infinity,path:[start]}];
 while(queue.length){const cur=queue.shift();if(cur.depth>=maxHops)continue;
 for(const row of rows.filter(r=>r.from===cur.account&&r.minute>=cur.after)){
 const cycle=cur.path.includes(row.to);result.push({...row,depth:cur.depth+1,cycle});
 if(!cycle)queue.push({account:row.to,depth:cur.depth+1,after:row.minute,path:[...cur.path,row.to]});
 }}return result;
}
export function balance(account,opening,incoming,rows){return opening+incoming+rows.filter(r=>r.to===account).reduce((s,r)=>s+r.paise,0)-rows.filter(r=>r.from===account).reduce((s,r)=>s+r.paise,0);}
