import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from './server.mjs';
test('demo API discloses fixture mode and rejects mutations',async()=>{
 const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{const base=`http://127.0.0.1:${server.address().port}`;
 const health=await (await fetch(base+'/api/health')).json();assert.equal(health.livePayments,false);assert.equal(health.trainedModels,false);
 assert.equal((await fetch(base+'/api/scenarios')).status,200);
 assert.equal((await fetch(base+'/api/health',{method:'POST'})).status,405);
 assert.equal((await fetch(base+'/missing')).status,404);
 }finally{await new Promise(r=>server.close(r));}
});
