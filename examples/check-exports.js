// Verify that the included simulator traces match the current Field2Sim adapter.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {createArtifact} = require('../simulator-adapters.js');
for (const [folder,target,filename] of [['ns2','ns2','mobility.tcl'],['ns3','ns3','mobility.tcl'],['omnetpp-inet','omnetpp','mobility.movements'],['cooja','cooja','positions.dat']]) {
  for (const scenario of ['static','mobile']) {
    if(folder==='cooja' && scenario==='static') continue; // Static positions live in CSC.
    const data=JSON.parse(fs.readFileSync(path.join(__dirname,`${scenario}-local-coordinates.json`),'utf8'));
    const actual=createArtifact(target,{scenario:data.scenario,waypoints:data.waypoints}).text.trimEnd();
    const file=path.join(__dirname,folder,scenario,filename);
    assert.equal(fs.readFileSync(file,'utf8').trimEnd(),actual,`${folder}/${scenario} differs from current export`);
    console.log(`PASS ${folder}/${scenario}: exact adapter output`);
  }
}
