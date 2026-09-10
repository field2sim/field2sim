const {chromium}=require('playwright');const assert=require('node:assert/strict');const path=require('node:path');const {pathToFileURL}=require('node:url');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome'});try{
const page=await browser.newPage();await page.route(/^https?:/,r=>r.abort());const errors=[];page.on('pageerror',e=>errors.push(e.message));let dialogs=[];page.on('dialog',async d=>{dialogs.push(d.message());await d.accept()});
await page.goto(pathToFileURL(path.join(__dirname,'../index.html')).href);
assert.equal(await page.locator('#elevationPanel').count(),0);
// Isolate conversion from network scheduling; use explicit canonical input fixtures.
await page.evaluate(()=>{clearTimeout(elevationAutoTimer);scheduleElevation=()=>{};});
const report=[];
for(const enabled of [false,true])for(const reference of ['manual','mapzen-surface'])for(const type of ['fixed','mobile'])for(const target of ['cooja','ns2','ns3','omnetpp']){
 await page.evaluate(({reference,type})=>{
  const points=[{nodeId:1,time:0,lat:41.3,lng:36.3,z:reference==='manual'?0:33},{nodeId:type==='fixed'?2:1,time:type==='fixed'?0:5,lat:41.301,lng:36.301,z:reference==='manual'?0:34}];
  restore({nodeGroups:[{id:'test',name:'Test',type,points,...(reference==='manual'?{}:{altitudeReference:reference})}],activeNodeGroupId:'test',scenario:type,origin:{mode:'first',lat:null,lng:null,alt:0}});
 },{reference,type});
 await page.locator('#experimental3d').setChecked(enabled);
 dialogs=[];await page.selectOption('#simExportSelect',target);await page.click('#convertBtn');
 const output=await page.locator('#output').textContent();
 assert.deepEqual(dialogs,[],`${reference}/${type}/${target}`);assert.ok(output.trim(),`${type}/${target}`);assert.equal(await page.locator('#output').getAttribute('data-kind'),'export');
 if(enabled && reference==='mapzen-surface') {
   if(target==='ns2'||target==='ns3') assert.match(output,type==='mobile'?/set Z_ 1(?:\.0+)?"/:/set Z_ 1(?:\.0+)?(?:\n|$)/);
   else assert.match(output, / 1(?:\.0+)?(?:\n|$)/);
 }
 if(!enabled) {
  if(target==='ns2'||target==='ns3') {
   const heights=[...output.matchAll(/set Z_ ([^\s"]+)/g)].map(m=>Number(m[1]));
   assert.ok(heights.length);assert.ok(heights.every(z=>z===0));assert.doesNotMatch(output,/at .*set Z_/);
  } else if(target==='cooja') {
   const rows=output.split('\n').filter(l=>l.trim()&&!l.startsWith('#'));
   assert.ok(rows.every(l=>Number(l.trim().split(/\s+/).at(-1))===0));
  } else assert.equal(await page.evaluate(()=>Field2SimSimulatorAdapters.getAdapter('omnetpp').validateOutput(document.getElementById('output').textContent).valid),true);
 }
 report.push(`${enabled?'3D':'2D'} ${reference} ${type} ${target}: PASS export`);
}
assert.deepEqual(errors,[]);console.log(report.join('\n'));
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
