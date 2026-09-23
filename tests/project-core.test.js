const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const core=require('../project-core');
const example=JSON.parse(fs.readFileSync(require('node:path').join(__dirname,'../examples/projects/central-park.field2sim')));
test('portable example round-trips with explicit format/version',()=>{assert.deepEqual(core.decode(core.encode(example.state)),example);for(const change of [p=>p.format='other',p=>p.version=999,p=>p.state.activeNodeGroupId='missing',p=>p.state.nodeGroups[0].points[0].lat=91]){const p=structuredClone(example);change(p);assert.throws(()=>core.validate(p));}});
test('playback handles delayed starts, interpolation, endpoint hold without mutating input',()=>{const points=[{lat:0,lng:179,z:10,time:10},{lat:2,lng:-179,z:30,time:20}];const saved=JSON.stringify(points);assert.equal(core.atTime(points,0),null);assert.deepEqual(core.atTime(points,15),{lat:1,lng:-180,z:20});assert.equal(core.atTime(points,40).lat,2);assert.equal(JSON.stringify(points),saved);assert.throws(()=>core.tracks([{type:'mobile',name:'bad',points:[points[1],points[0]]}]));});
test('average speed uses total distance / elapsed time, includes pauses and optional height',()=>{
 const p=[{lat:0,lng:0,z:0,time:5},{lat:0,lng:0,z:0,time:15},{lat:0,lng:.001,z:0,time:25}];
 assert.ok(Math.abs(core.averageSpeed(p)-core.distance(p[1],p[2])/20)<1e-10);
 assert.equal(core.averageSpeed(p.slice(0,1)),null);
 assert.equal(core.averageSpeed([{lat:0,lng:0,z:0,time:0},{lat:0,lng:0,z:10,time:2}],true),5);
 assert.throws(()=>core.averageSpeed([{lat:0,lng:0,time:1},{lat:0,lng:1,time:1}]));
});
