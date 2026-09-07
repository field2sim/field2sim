const {chromium}=require('playwright');const assert=require('node:assert/strict');const {pathToFileURL}=require('node:url');const path=require('node:path');
(async()=>{const browser=await chromium.launch({headless:true,...(process.env.CHROME_BIN?{executablePath:process.env.CHROME_BIN}:{})});try{
const page=await browser.newPage({viewport:{width:1280,height:800}});await page.route(/^https?:/,r=>r.abort());await page.goto(pathToFileURL(path.join(__dirname,'../index.html')).href);
const errors=[];page.on('pageerror',e=>errors.push(e.message));
for(const scenarioName of ['fixed','mobile'])for(const modeName of ['point','maps','polygon']){
 await page.evaluate(({scenarioName,modeName})=>{nodeGroups=[{id:'test',type:scenarioName,name:'Test',points:[]}];activeNodeGroupId='test';updateScenario(scenarioName);updateWorkMode(modeName);map.setView([41.2867,36.33],18,{animate:false});setPositions([{nodeId:1,time:0,lat:41.2867,lng:36.33,z:0},{nodeId:scenarioName==='fixed'?2:1,time:1,lat:41.2867,lng:36.3304,z:0}]);selected.clear();lastClickedIndex=-1;refreshLatLngInput();draw();}, {scenarioName,modeName});
 const points=await page.evaluate(()=>positions.map(p=>{const s=map.latLngToContainerPoint([p.lat,p.lng]),r=map.getContainer().getBoundingClientRect();return{x:s.x+r.x,y:s.y+r.y}}));
 await page.mouse.move(points[0].x,points[0].y);assert.equal(await page.locator('#map').evaluate(e=>e.style.cursor),'pointer');
 await page.mouse.click(points[0].x,points[0].y);assert.deepEqual(await page.evaluate(()=>Array.from(selected)),[0]);assert.equal(await page.evaluate(()=>positions.length),2);
 await page.mouse.click(points[1].x,points[1].y);assert.deepEqual(await page.evaluate(()=>Array.from(selected)),[1]);
 await page.keyboard.down('Shift');await page.mouse.click(points[0].x,points[0].y);await page.keyboard.up('Shift');assert.deepEqual(await page.evaluate(()=>Array.from(selected).sort()),[0,1]);
 if(modeName==='point'){
 await page.evaluate(()=>{selected.clear();output.textContent='converted';output.dataset.kind='export'});
 await page.mouse.click(points[0].x,points[0].y);assert.equal(await page.locator('#output').textContent(),'converted');
 const before=await page.evaluate(()=>positions[0].lng);await page.mouse.move(points[0].x,points[0].y);await page.mouse.down();await page.mouse.move(points[0].x+30,points[0].y,{steps:5});await page.mouse.up();assert.notEqual(await page.evaluate(()=>positions[0].lng),before);
 await page.mouse.click(points[0].x-100,points[0].y-100);assert.equal(await page.evaluate(()=>positions.length),3);
 }
 console.log(scenarioName,modeName,'selection/cursor PASS');
}
assert.deepEqual(errors,[]);
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
