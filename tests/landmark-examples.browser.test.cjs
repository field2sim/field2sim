const {chromium}=require('playwright'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),core=require('../project-core');
const cases=[['great-wall-mutianyu',6,35,49.11314828620152],['saint-emilion-vineyard',12,10,1.5],['giza-plateau',8,13,3]];
(async()=>{
 for(const [id,n,w,speed] of cases){
  const project=core.decode(fs.readFileSync(path.join(__dirname,'../examples/projects',id+'.field2sim'),'utf8'));
  const groups=project.state.nodeGroups;assert.equal(groups.length,2);assert.equal(groups[0].points.length,n);assert.equal(groups[1].points.length,w);
  assert.ok(Math.abs(core.averageSpeed(groups[1].points)-speed)<.001);assert.equal(core.tracks(groups).length,1);
  assert.equal(new Set(groups.flatMap(g=>g.type==='mobile'?[g.points[0].nodeId]:g.points.map(p=>p.nodeId))).size,n+1);
 }
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',args:['--no-sandbox']});
 try{
  const page=await browser.newPage();const errors=[],dialogs=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',async d=>{dialogs.push(d.message());await d.dismiss();});
  await page.route(/^https:/,r=>r.abort());await page.goto(process.env.FIELD2SIM_URL||'http://127.0.0.1:8772/');
  for(const [id,n,w,speed] of cases){
   await page.locator('#projectMenu').evaluate(e=>e.open=true);await page.selectOption('#projectExample',id);
   await page.waitForFunction(id=>activeNodeGroupId===id+'-mobile',id);
   assert.equal(await page.evaluate(()=>nodeGroups.length),2);assert.equal(await page.locator('#output').textContent(),'');
   assert.equal(await page.locator('#averageSpeed').textContent(),`Average Speed: ${speed.toFixed(2)} m/s (${(speed*3.6).toFixed(2)} km/h)`);
   await page.locator('#projectMenu').evaluate(e=>e.open=false);
   await page.locator('#playbackPanel').evaluate(e=>e.open=true);await page.click('#playRouteBtn');
   await page.waitForFunction(()=>Number(document.querySelector('#playbackTime').value)>0);await page.click('#stopRouteBtn');
   for(const target of ['cooja','ns2','ns3','omnetpp']){
    await page.selectOption('#simExportSelect',target);await page.click('#convertBtn');
    const output=await page.locator('#output').textContent();assert.ok(output.trim().length>30,`${id}/${target}: empty export`);assert.ok(!/\bNaN\b/.test(output));
   }
   const state=await page.evaluate(()=>Field2SimWorkspace.buildProject());assert.equal(state.state.nodeGroups[0].points.length,n);assert.equal(state.state.nodeGroups[1].points.length,w);
   console.log(`PASS ${id}: project, speed, playback, four export adapters, save state`);
  }
  assert.deepEqual(errors,[]);assert.deepEqual(dialogs,[]);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
