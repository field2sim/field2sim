const {chromium}=require('playwright');const assert=require('node:assert/strict');const {pathToFileURL}=require('node:url');const path=require('node:path');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome'});try{
 const page=await browser.newPage({viewport:{width:1400,height:950}});const errors=[];page.on('pageerror',e=>errors.push(e.message));let calls=0;
 await page.route(/^https?:/,async route=>{
  if(!route.request().url().includes('/elevation/v1/elevation'))return route.abort();
  calls++;const rows=route.request().postDataJSON().locations;
  return route.fulfill({json:{metadata:{dataset:'mapzen',units:'metres'},results:rows.map(p=>({...p,elevation_m:33,status:'ok',fetched_at:new Date().toISOString()}))}});
 });
 await page.goto(pathToFileURL(path.join(__dirname,'../index.html')).href);
  await page.check('#experimental3d');
 await page.fill('#latlngInput','7 0 41.3 36.3\n7 2 41.301 36.301');
 await page.waitForFunction(()=>document.getElementById('elevationStatus').textContent.includes('Altitude added'));
 assert.equal(await page.inputValue('#latlngInput'),'7 0.000000000 41.300000000 36.300000000 33\n7 2.000000000 41.301000000 36.301000000 33');assert.equal(calls,1);
 await page.selectOption('#newNodeGroupType','fixed');await page.click('#addNodeGroupBtn');await page.fill('#latlngInput','8 0 41.3 36.3');
 await page.waitForFunction(()=>document.getElementById('latlngInput').value.trim().endsWith(' 33'));assert.equal(calls,1);
 assert.equal(await page.inputValue('#latlngInput'),'8 0.000000000 41.300000000 36.300000000 33');
 await page.evaluate(()=>persistSessionStateNow());await page.reload();
 assert.equal((await page.inputValue('#latlngInput')).trim(),'8 0.000000000 41.300000000 36.300000000 33');
 assert.equal(await page.evaluate(()=>nodeGroups.every(g=>g.altitudeReference==='mapzen-surface')),true);
 await page.selectOption('#simExportSelect','ns2');let dialog='';page.once('dialog',async d=>{dialog=d.message();await d.accept()});await page.click('#convertBtn');assert.equal(dialog,'');assert.ok((await page.locator('#output').textContent()).includes('set Z_'));
 assert.equal(await page.locator('#useMapCenterOriginBtn').count(),0);assert.deepEqual(errors,[]);assert.equal(await page.locator('#elevationPanel').count(),0);
 console.log('PASS: fifth-column fill, all groups, cache, persistence, elevation export, no script errors');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
