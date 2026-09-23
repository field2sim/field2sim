const assert=require('node:assert/strict');
const {lookup}=require('../elevation-client.js');
(async()=>{
 let calls=0;
 const fetchImpl=async(_url,opts)=>{
  calls++;const rows=JSON.parse(opts.body).locations;
  assert.ok(rows.length<=100);
  return {ok:true,json:async()=>({metadata:{dataset:'mapzen',units:'metres'},results:rows.map(p=>({...p,elevation_m:p.latitude===0?null:-12,status:p.latitude===0?'no_data':'ok',fetched_at:new Date().toISOString()}))})};
 };
 const points=Array.from({length:101},(_,i)=>({lat:i/2,lng:10}));
 const r=await lookup([...points,points[0]],{fetchImpl});
 assert.equal(calls,2);assert.equal(r.length,101);assert.equal(r[0].result.elevation_m,null);assert.equal(r[1].result.elevation_m,-12);
 await assert.rejects(lookup([{lat:NaN,lng:0}],{fetchImpl}),/Invalid geographic/);
 await assert.rejects(lookup([points[0]],{fetchImpl:async()=>({ok:false,status:429,headers:new Headers({'Retry-After':'60'}),json:async()=>({})})}),/60 seconds/);
 await assert.rejects(lookup([points[0]],{fetchImpl:async()=>({ok:true,json:async()=>({results:[],metadata:{dataset:'mapzen',units:'metres'}})})}),/Invalid elevation/);
 await assert.rejects(lookup([points[0]],{fetchImpl:async()=>({ok:false,status:502,headers:new Headers(),json:async()=>({error:{code:'upstream_unavailable'}})})}),/could not obtain data from its provider.*Coordinates are unchanged/);
 const controller=new AbortController();controller.abort();
 await assert.rejects(lookup(points,{fetchImpl,signal:controller.signal}),{name:'AbortError'});
 console.log('PASS elevation batching, deduplication, negative/NoData, validation, rate-limit, cancellation');
})().catch(e=>{console.error(e);process.exitCode=1});
