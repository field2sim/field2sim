const {chromium}=require('playwright');const assert=require('node:assert/strict');const {pathToFileURL}=require('node:url');const path=require('node:path');
(async()=>{const b=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome'});try{
const p=await b.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));let calls=0;
await p.route(/^https?:/,async r=>{if(!r.request().url().includes('/elevation/v1/elevation'))return r.abort();calls++;const rows=r.request().postDataJSON().locations;await new Promise(ok=>setTimeout(ok,100));return r.fulfill({json:{metadata:{dataset:'mapzen',units:'metres'},results:rows.map(q=>({...q,elevation_m:q.latitude===42?100:291,status:'ok',fetched_at:new Date().toISOString()}))}})});
await p.goto(pathToFileURL(path.join(__dirname,'../index.html')).href);
await p.evaluate(()=>{commitHistory();setPositions([{nodeId:1,time:0,lat:41,lng:36,z:0}]);refreshLatLngInput();draw();updateOutput();});
await p.waitForTimeout(1500);assert.equal(calls,0,'Default 2D mode must not query elevation');
await p.check('#experimental3d');
await p.waitForFunction(()=>document.getElementById('latlngInput').value.endsWith('291'));assert.equal(calls,1);
// Undo must restore the pre-toggle points and remove the altitude column.
await p.click('#undoBtn');
assert.equal(await p.isChecked('#experimental3d'),false);
assert.equal((await p.inputValue('#latlngInput')).trim().split(/\s+/).length,4);
await p.waitForTimeout(1300);assert.equal(calls,1);
await p.click('#redoBtn');
assert.equal(await p.isChecked('#experimental3d'),true);
await p.waitForFunction(()=>document.getElementById('latlngInput').value.endsWith('291'));
assert.equal(calls,1,'Redo should reuse cached elevation');
// Moving a point triggers lookup without the fetch button.
await p.evaluate(()=>{positions[0].lat=42;refreshLatLngInput();draw();updateOutput();});
await p.waitForFunction(()=>document.getElementById('latlngInput').value.endsWith('100'));assert.equal(calls,2);
await p.evaluate(()=>{draw();updateOutput();});await p.waitForTimeout(1300);assert.equal(calls,2);
// Manual altitude edits do not trigger an automatic overwrite.
await p.fill('#latlngInput','1 0 42 36 105');await p.waitForTimeout(1400);assert.equal(calls,2);assert.ok((await p.inputValue('#latlngInput')).endsWith('105'));
await p.uncheck('#experimental3d');
assert.equal((await p.inputValue('#latlngInput')).trim().split(/\s+/).length,4,'Uncheck hides existing height');
await p.evaluate(()=>{const state=snapshot();state.nodeGroups[0].draft='1 0 42 36 105';restore(state);});
assert.equal((await p.inputValue('#latlngInput')).trim().split(/\s+/).length,4,'Restore must not revive a stale altitude draft');
await p.evaluate(()=>{positions[0].lat=43;refreshLatLngInput();updateOutput();});
await p.waitForTimeout(1500);assert.equal(calls,2,'Disabling 3D must stop automatic queries');
assert.deepEqual(errors,[]);console.log('PASS automatic placement, movement, no loop, manual height retained');
}finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});
