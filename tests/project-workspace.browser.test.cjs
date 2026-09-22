const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
(async()=>{const browser=await chromium.launch({headless:true,...(process.env.CHROME_BIN?{executablePath:process.env.CHROME_BIN}:{}),args:['--no-sandbox']});try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 let elevationCalls=0;await page.route(/^https:/,r=>{if(r.request().url().includes('/elevation/'))elevationCalls++;return r.abort();});
 await page.goto(process.env.FIELD2SIM_URL||'http://127.0.0.1:8772/');
 await page.locator('#projectMenu').evaluate(e=>e.open=true);await page.selectOption('#projectExample','central-park');await page.waitForFunction(()=>nodeGroups.length===2);
 assert.equal(await page.locator('.node-group-item').count(),2);
 const before=await page.evaluate(()=>JSON.stringify(nodeGroups));
 await page.locator('#playbackPanel').evaluate(e=>e.open=true);await page.click('#playRouteBtn');await page.waitForTimeout(150);assert.equal(await page.locator('#playRouteBtn').textContent(),'Ⅱ Pause');await page.click('#playRouteBtn');
 await page.locator('#playbackTime').fill('100');await page.locator('#playbackTime').dispatchEvent('input');assert.match(await page.locator('#playbackStatus').textContent(),/^100.0/);
 assert.equal(await page.evaluate(()=>JSON.stringify(nodeGroups)),before);await page.click('#stopRouteBtn');
 const fixture=await page.evaluate(()=>{
  const p=Field2SimWorkspace.buildProject(),s=p.state,e=s.projectExtras,c=e.controls;
  s.experimental3d=c.experimental3d=true;s.origin={mode:'custom',lat:40.781,lng:-73.9687,alt:21.25};
  Object.assign(c,{originModeSelect:'custom',originLatInput:'40.781000000',originLngInput:'-73.968700000',originAltInput:'21.25',circleRadiusSelect:'custom',circleRadiusCustomInput:'37.5',autoNodeIds:true,enablePathLossProfile:true,propagationRangeInput:'83',propagationInterferenceRangeInput:'177',propagationSuccessRatioInput:'0.85',propagationRxSensitivityInput:'-96',propagationRssiInflectionInput:'-89',propagationShadowingInput:'4.25',propagationTimeVariationSelect:'true',propagationSeedInput:'909',playbackSpeed:'5',simExportSelect:'ns3'});
  for(const g of s.nodeGroups){g.points.forEach((x,i)=>x.z=20+i*.25);g.draft=g.points.map(x=>`${x.nodeId} ${x.time} ${x.lat} ${x.lng} ${x.z}`).join('\n');}
  s.positions=s.nodeGroups[1].points;
  s.nodeGroups[0].polygons=[[[{lat:40.78,lng:-73.969},{lat:40.782,lng:-73.969},{lat:40.782,lng:-73.967}]]];
  e.mode='polygon';e.scanDirection='vertical';e.polygonDraft=[{lat:40.781,lng:-73.967},{lat:40.782,lng:-73.967}];
  e.elevations=[{key:JSON.stringify([40.781,-73.9687]),result:{status:'ok',elevation_m:20,fetched_at:'2026-01-01T00:00:00Z'},metadata:{dataset:'mapzen',units:'metres'}}];
  e.csc={name:'test.csc',text:'<simconf><simulation><randomseed>1</randomseed><radiomedium>org.contikios.cooja.radiomediums.UDGM</radiomedium></simulation></simconf>'};
  window.FIELD2SIM_MAP_CONFIG={esriApiKey:'DO-NOT-SAVE-THIS'};
  Field2SimWorkspace.applyProject(p);return Field2SimWorkspace.buildProject();
 });
 await page.waitForTimeout(500);assert.equal(elevationCalls,0);
 const downloadEvent=page.waitForEvent('download');await page.locator('#projectMenu').evaluate(e=>e.open=true);await page.click('#saveProjectBtn');const download=await downloadEvent;assert.match(download.suggestedFilename(),/\.field2sim$/);
 const text=await fs.readFile(await download.path(),'utf8');assert.ok(!text.includes('DO-NOT-SAVE-THIS'));const saved=JSON.parse(text);
 await page.locator('#projectMenu').evaluate(e=>e.open=true);await page.selectOption('#projectExample','central-park');await page.waitForFunction(()=>!document.querySelector('#experimental3d').checked);
 await page.setInputFiles('#projectFileInput',{name:'test.field2sim',mimeType:'application/json',buffer:Buffer.from(text)});await page.waitForFunction(()=>document.querySelector('#experimental3d').checked);
 const reopened=await page.evaluate(()=>Field2SimWorkspace.buildProject());assert.deepEqual(reopened,saved);
 assert.equal(await page.evaluate(()=>selectedCoojaCsc.handle),null);assert.equal(await page.locator('#output').textContent(),'');assert.equal(elevationCalls,0);
 const invalid=structuredClone(saved);invalid.state.projectExtras.controls.propagationProfileSelect='unknown';
 await page.setInputFiles('#projectFileInput',{name:'bad.field2sim',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(invalid))});await page.waitForFunction(()=>document.querySelector('#projectStatus').textContent.startsWith('Open failed'));
 assert.deepEqual(await page.evaluate(()=>Field2SimWorkspace.buildProject()),reopened);
 await page.evaluate(()=>persistSessionStateNow());await page.reload();assert.deepEqual(await page.evaluate(()=>Field2SimWorkspace.buildProject()),reopened);
 await page.locator('#projectMenu').evaluate(e=>e.open=true);await page.selectOption('#projectExample','central-park');await page.waitForFunction(()=>!document.querySelector('#experimental3d').checked);await page.click('#undoBtn');assert.equal(await page.locator('#experimental3d').isChecked(),true);assert.equal(await page.inputValue('#propagationRangeInput'),'83');
 await page.uncheck('#experimental3d');await page.click('#undoBtn');assert.equal(await page.locator('#experimental3d').isChecked(),true);
 assert.deepEqual(errors,[]);console.log('PASS: examples, playback, all settings round-trip, CSC, no credentials/elevation fetch, invalid import atomicity, reload, undo');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
