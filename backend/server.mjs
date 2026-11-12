import http from 'node:http';
import { pathToFileURL } from 'node:url';
export function createServer() {
  return http.createServer((req,res)=>{
    res.setHeader('Content-Type','application/json');
    res.setHeader('Cache-Control','no-store');
    if(req.method!=='GET'){res.writeHead(405);res.end(JSON.stringify({error:'Read-only demo API'}));return;}
    const routes={
      '/api/health':{status:'ok',mode:'synthetic-demo',livePayments:false,trainedModels:false},
      '/api/scenarios':{scenarios:[{id:'mixed',label:'Mixed-purpose merchant'},{id:'seasonal',label:'Diwali sales surge'},{id:'unknown',label:'Incomplete evidence'}]},
      '/api/capabilities':{graph:'browser-rendered',modelInference:'illustrative fixtures',reviewPersistence:false,productionServices:'not connected'}
    };
    const data=routes[req.url];res.writeHead(data?200:404);res.end(JSON.stringify(data||{error:'Not found'}));
  });
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href){
 const port=Number(process.env.PORT||3001);createServer().listen(port,'127.0.0.1',()=>console.log(`MerchantLens demo API: http://127.0.0.1:${port}`));
}
