// Single loopback server for the built frontend and synthetic API; no npm dependencies.
import http from 'node:http';
import {readFile,access} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,extname,sep} from 'node:path';
import {createServer} from '../backend/server.mjs';
const root=process.env.STALL_DIST || fileURLToPath(new URL('../frontend/dist/',import.meta.url));
const port=Number(process.env.STALL_PORT || 4173);
try{await access(resolve(root,'index.html'));}catch{console.error('Build first with npm run setup and npm run build.');process.exit(1);}
const api=createServer();
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'};
http.createServer(async(req,res)=>{
  if(req.url.startsWith('/api/')){api.emit('request',req,res);return;}
  try{
    const path=new URL(req.url,'http://localhost').pathname;
    const file=resolve(root,'.'+(path==='/'?'/index.html':decodeURIComponent(path)));
    if(!file.startsWith(resolve(root)+sep))throw new Error('outside');
    const body=await readFile(file);res.setHeader('Content-Type',types[extname(file)]||'application/octet-stream');res.end(body);
  }catch{res.writeHead(404);res.end('Unavailable');}
}).listen(port,'127.0.0.1',()=>console.log('Open http://127.0.0.1:'+port+' on this laptop.'));
