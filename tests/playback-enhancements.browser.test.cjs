const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{const b=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',args:['--no-sandbox']});try{
 const p=await b.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.route(/^https:/,r=>r.abort());await p.goto(process.env.FIELD2SIM_URL||'http://127.0.0.1:8772/');
 await p.locator('#projectMenu').evaluate(e=>e.open=true);await p.selectOption('#projectExample','central-park');await p.waitForFunction(()=>nodeGroups.length===2);await p.locator('#projectMenu').evaluate(e=>e.open=false);
 await p.locator('#playbackPanel').evaluate(e=>e.open=true);const before=await p.evaluate(()=>JSON.stringify(nodeGroups));await p.click('#nextWaypointBtn');
 const target=await p.evaluate(()=>nodeGroups[1].points[1].time);assert.ok(Math.abs(Number(await p.inputValue('#playbackTime'))-target)<.11);assert.match(await p.locator('.playback-tag').textContent(),/ID 7/);assert.match(await p.locator('.playback-tag').textContent(),/m\/s/);
 assert.ok(await p.evaluate(()=>Object.values(map._layers).some(l=>l.options?.weight===5&&l.options?.opacity===.9&&l.getLatLngs().length>=2)));
 await p.click('#previousWaypointBtn');assert.equal(Number(await p.inputValue('#playbackTime')),0);assert.equal(await p.evaluate(()=>JSON.stringify(nodeGroups)),before);
 await p.check('#playbackLoop');await p.selectOption('#playbackSpeed','60');const duration=await p.evaluate(()=>nodeGroups[1].points.at(-1).time);
 await p.locator('#playbackTime').fill((duration-.2).toFixed(1));await p.locator('#playbackTime').dispatchEvent('input');await p.click('#playRouteBtn');await p.waitForTimeout(120);assert.ok(Number(await p.inputValue('#playbackTime'))<duration/2);assert.equal(await p.locator('#playRouteBtn').textContent(),'Ⅱ Pause');await p.click('#stopRouteBtn');
 assert.deepEqual(errors,[]);console.log('PASS tags/trails, waypoint jumps and looping');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exit(1)});
