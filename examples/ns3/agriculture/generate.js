#!/usr/bin/env node
// Execute the browser's actual polygon authoring functions with a minimal map stub.
const fs=require('fs'),path=require('path'),vm=require('vm'),crypto=require('crypto');
const out=__dirname,root=path.resolve(out,'../../..');
const core=require(path.join(root,'coordinate-core.js'));
const adapters=require(path.join(root,'simulator-adapters.js'));
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const names=['pointInPolygonMeters','latLngToLocalMetersAt','localMetersToLatLngAt','deployNodesInPolygon','polygonScanSegmentsAtY','polygonScanSegmentsAtX','deployMobileScanPathInPolygon'];
let code='';for(const name of names){const start=html.indexOf('    function '+name+'(');if(start<0)throw Error(name);const end=html.indexOf('\n    function ',start+1);code+=html.slice(start,end)+'\n';}
const origin={lat:40.4030,lng:29.1710,alt:0};
const polygon=[{x:0,y:0},{x:374,y:0},{x:374,y:275},{x:0,y:275}].map(p=>core.localToGeographic({...p,z:0},origin));
const ctx={...core,polygonDraft:polygon,scenario:'fixed',positions:[],getCircleRadiusMeters:()=>30,L:{polygon:()=>({addTo:()=>{}})},POLYGON_STROKE:'',POLYGON_FILL:'',map:{},deployedPolygons:[],commitHistory:()=>{},nextAvailableNodeId:()=>1,nodeInput:{value:'1'},setPositions:p=>ctx.positions=p,selected:new Set(),refreshLatLngInput:()=>{},updateOutput:()=>{},draw:()=>{},clearPolygonDraft:()=>{},mobileScanDirection:'vertical',intervalSeconds:()=>6};
vm.createContext(ctx);vm.runInContext(code,ctx);ctx.deployNodesInPolygon();
const sensors=ctx.positions.map(p=>({...p,alt:0}));
if(sensors.length!==120)throw Error('Expected 120 nodes, found '+sensors.length);
ctx.positions=[];ctx.scenario='mobile';ctx.nodeInput.value='121';ctx.deployMobileScanPathInPolygon();
let t=5,previous=null;
const toLocal=p=>{const q=core.geodeticToEnu({...p,alt:0},origin);return {x:q.east,y:q.north,z:p.alt||0}};
const route=ctx.positions.map(p=>{p={...p,alt:30};const q=toLocal(p);if(previous)t+=Math.hypot(q.x-previous.x,q.y-previous.y)/5;previous=q;return {...p,time:t}});
const staticLocal={scenario:'fixed',waypoints:sensors.map(p=>({nodeId:p.nodeId,time:0,...toLocal(p)}))};
const mobileLocal={scenario:'mobile',waypoints:route.map(p=>({nodeId:121,time:p.time,...toLocal(p)}))};
const a=adapters.createArtifact('ns3',staticLocal),b=adapters.createArtifact('ns3',mobileLocal);
fs.writeFileSync(path.join(out,'mobility.tcl'),a.text+'\n'+b.text);
fs.writeFileSync(path.join(out,'sensors.txt'),sensors.map(p=>`${p.nodeId} 0 ${p.lat.toFixed(9)} ${p.lng.toFixed(9)} 0`).join('\n')+'\n');
fs.writeFileSync(path.join(out,'uav-route.txt'),route.map(p=>`121 ${p.time.toFixed(9)} ${p.lat.toFixed(9)} ${p.lng.toFixed(9)} 30`).join('\n')+'\n');
const end=t+2;
const scenario={name:'Gemlik geographic agricultural example',siteStatus:'Illustrative georeferenced polygon; land use and parcel ownership not verified.',origin,polygon,sensors,route,staticLocal,mobileLocal,endTime:end,parameters:{spacingM:30,speedMps:5,uavZ:30,sensorZ:0,terrain:'flat reference plane; no elevation API'},sourceSha256:Object.fromEntries(['index.html','coordinate-core.js','simulator-adapters.js'].map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,f))).digest('hex')]))};
fs.writeFileSync(path.join(out,'scenario.json'),JSON.stringify(scenario,null,2)+'\n');
const rows=[];for(const p of staticLocal.waypoints)rows.push([0.1,p.nodeId-1,p.x,-p.y,p.z]);
for(let i=1;i<mobileLocal.waypoints.length;i++){const p=mobileLocal.waypoints[i-1],q=mobileLocal.waypoints[i];rows.push([(p.time+q.time)/2,120,(p.x+q.x)/2,-(p.y+q.y)/2,30]);}
const last=mobileLocal.waypoints.at(-1);rows.push([t+1,120,last.x,-last.y,30]);
fs.writeFileSync(path.join(out,'checkpoints.csv'),rows.map(r=>r.join(',')).join('\n')+'\n');
fs.writeFileSync(path.join(out,'scenario-data.js'),'window.scenario='+JSON.stringify(scenario)+';\n');
console.log(`Generated ${sensors.length} sensors, ${route.length} UAV waypoints, ${(5*(t-5)).toFixed(2)} m route, stop ${end.toFixed(3)} s`);
