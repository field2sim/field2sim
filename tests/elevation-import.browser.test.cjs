const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'/usr/bin/google-chrome'});
 try {
  const page=await browser.newPage();let queries=0;const errors=[];
  await page.route(/^https?:/,r=>{if(r.request().url().includes('/elevation/'))queries++;return r.abort()});
  page.on('pageerror',e=>errors.push(e.message));page.on('dialog',async d=>{errors.push(d.message());await d.dismiss()});
  await page.goto(pathToFileURL(path.join(__dirname,'../index.html')).href);
  await page.check('#experimental3d');
  const trace=await page.evaluate(()=>{
   restore({nodeGroups:[{id:'test',name:'Imported',type:'mobile',points:[]}],activeNodeGroupId:'test',scenario:'mobile',origin:{mode:'custom',lat:41.3,lng:36.3,alt:400}});
   const waypoints=[{lat:41.301,lng:36.301,z:369,time:0},{lat:41.302,lng:36.303,z:420,time:5}].map(p=>{
    const xy=coordinateCore.geodeticToEnu({lat:p.lat,lng:p.lng,alt:0},{lat:41.3,lng:36.3,alt:0});
    return {nodeId:1,time:p.time,x:xy.east,y:xy.north,z:p.z-400};
   });
   return createArtifact('cooja',{scenario:'mobile',waypoints}).text;
  });
  await page.locator('#uploadInput').setInputFiles({name:'positions.dat',mimeType:'text/plain',buffer:Buffer.from(trace)});
  await page.waitForFunction(()=>positions.length===2);
  await page.waitForTimeout(1500);
  const points=await page.evaluate(()=>positions);
  assert.ok(Math.abs(points[0].lat-41.301)<1e-9);assert.ok(Math.abs(points[1].lng-36.303)<1e-9);
  assert.deepEqual(points.map(p=>p.z),[369,420]);assert.equal(queries,0);
  await page.selectOption('#simExportSelect','cooja');await page.click('#convertBtn');
  const exported=(await page.locator('#output').textContent()).split('\n').filter(l=>l&&!l.startsWith('#')).map(l=>l.split(/\s+/).map(Number));
  const original=trace.split('\n').map(l=>l.split(/\s+/).map(Number));
  exported.forEach((row,i)=>row.forEach((v,j)=>assert.ok(Math.abs(v-original[i][j])<0.0001)));
  assert.deepEqual(errors,[]);console.log('PASS CSC-origin altitude, upload, no automatic overwrite, and re-export');
 } finally {await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
