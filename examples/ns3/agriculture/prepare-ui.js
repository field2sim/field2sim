// Validate the archived UI exports against independently projected UI input rows.
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'../../..'),dir=path.join(__dirname,'ui-export');
const core=require(path.join(root,'coordinate-core.js')),adapters=require(path.join(root,'simulator-adapters.js'));
const parse=file=>fs.readFileSync(path.join(dir,file),'utf8').trim().split('\n').map(l=>{const [nodeId,time,lat,lng,alt=0]=l.trim().split(/\s+/).map(Number);return {nodeId,time,lat,lng,alt}});
const sensors=parse('sensors-input.txt'),route=parse('uav-input.txt');
// Sensor 13 was selected with the actual map's Set as Origin menu.
const origin={lat:sensors[12].lat,lng:sensors[12].lng,alt:0};
const local=p=>{const q=core.geodeticToEnu({...p,alt:0},{...origin,alt:0});return {nodeId:p.nodeId,time:p.time,x:q.east,y:q.north,z:p.alt-origin.alt}};
const staticLocal={scenario:'fixed',waypoints:sensors.map(local)},mobileLocal={scenario:'mobile',waypoints:route.map(local)};
for(const [file,scenario] of [['sensors.tcl',staticLocal],['uav.tcl',mobileLocal]]){
 const actual=fs.readFileSync(path.join(dir,file),'utf8');const expected=adapters.createArtifact('ns3',scenario).text;
 const numbers=/[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g;
 const av=actual.match(numbers).map(Number),bv=expected.match(numbers).map(Number);
 if(actual.trim().replace(numbers,'#')!==expected.trim().replace(numbers,'#')||av.length!==bv.length||av.some((v,i)=>Math.abs(v-bv[i])>1e-7))throw Error('UI export differs from source projection: '+file);
 // Browser and Node.js elementary math can differ at the final decimal (~1 nm).

}
fs.writeFileSync(path.join(dir,'mobility.tcl'),fs.readFileSync(path.join(dir,'sensors.tcl'),'utf8')+'\n'+fs.readFileSync(path.join(dir,'uav.tcl'),'utf8'));
const rows=staticLocal.waypoints.map(p=>[0.1,p.nodeId-1,p.x,-p.y,p.z]);
for(let i=1;i<route.length;i++){const p=mobileLocal.waypoints[i-1],q=mobileLocal.waypoints[i];rows.push([(p.time+q.time)/2,120,(p.x+q.x)/2,-(p.y+q.y)/2,30]);}
const last=mobileLocal.waypoints.at(-1);rows.push([last.time+1,120,last.x,-last.y,30]);
fs.writeFileSync(path.join(dir,'checkpoints.csv'),rows.map(r=>r.join(',')).join('\n')+'\n');
const original=JSON.parse(fs.readFileSync(path.join(__dirname,'scenario.json'),'utf8'));
const s={...original,origin,sensors,route,staticLocal,mobileLocal,endTime:last.time+2,authoring:'Field2Sim browser groups; Convert to ns-3 and Copy; fixed origin selected on sensor 13'};
fs.writeFileSync(path.join(dir,'scenario.json'),JSON.stringify(s,null,2)+'\n');
console.log('UI exports agree with production adapters within 1e-7; 120 sensors + '+route.length+' UAV waypoints.');
