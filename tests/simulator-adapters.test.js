'use strict';

const assert = require('node:assert/strict');
const {
  AdapterValidationError,
  adapters,
  getAdapter,
  createArtifact,
  validateCoojaOutput,
  validateNs2FamilyOutput,
  validateInetBonnMotionOutput
} = require('../simulator-adapters.js');

const mobileScenario = Object.freeze({
  scenario: 'mobile',
  waypoints: Object.freeze([
    Object.freeze({ nodeId: 1, time: 0, x: 0, y: 0, z: 0 }),
    Object.freeze({ nodeId: 1, time: 2, x: 3, y: 4, z: 0 })
  ])
});

const staticScenario = Object.freeze({
  scenario: 'fixed',
  waypoints: Object.freeze([
    Object.freeze({ nodeId: 1, time: 7, x: 10, y: 20, z: 0 }),
    Object.freeze({ nodeId: 2, time: 9, x: 30, y: 40, z: 0 })
  ])
});

function expectAdapterError(fn, pattern) {
  assert.throws(fn, error => {
    assert.ok(error instanceof AdapterValidationError);
    assert.match(error.message, pattern);
    return true;
  });
}

function testRegistryAndMetadata() {
  assert.deepEqual(Object.keys(adapters), ['cooja', 'ns2', 'ns3', 'omnetpp']);
  assert.equal(getAdapter('cooja').filename, 'positions.dat');
  assert.equal(getAdapter('ns3').filename, 'mobility-ns3.tcl');
  assert.equal(getAdapter('omnetpp').filename, 'mobility-bonnmotion.movements');
  assert.notEqual(getAdapter('ns2'), getAdapter('ns3'));
}

function testCoojaGoldenOutputAndInverseAxis() {
  const expected = [
    '0 0.000000000 0.000000000 0.000000000 0.000000000',
    '0 2.000000000 3.000000000 -4.000000000 0.000000000'
  ].join('\n');
  const artifact = createArtifact('cooja', mobileScenario);
  assert.equal(artifact.text, expected);
  assert.equal(artifact.conformance.valid, true);
  assert.equal(artifact.warnings.length, 2);
  assert.match(artifact.warnings[0], /cyclic mobility/i);
  assert.match(artifact.warnings[1], /mote-array indices/i);
  const parsed = adapters.cooja.parse(artifact.text, { scenario: 'mobile' });
  assert.deepEqual(parsed.waypoints, mobileScenario.waypoints.map(point => ({ ...point })));
  assert.equal(validateCoojaOutput('0 0 1 2', mobileScenario).valid, false);
}

function testNs3GoldenGrammarAndSpeed() {
  const text = adapters.ns3.serialize(mobileScenario);
  const report = validateNs2FamilyOutput(text);
  assert.equal(report.valid, true, report.errors.join(' '));
  assert.equal(report.initialized.get(0).get('X'), 0);
  assert.equal(report.initialized.get(0).get('Y'), 0);
  assert.equal(report.movements.length, 1);
  assert.deepEqual(report.movements[0], {
    time: 0,
    nodeIndex: 0,
    x: 3,
    y: -4,
    speed: 2.5,
    line: 6
  });
  assert.match(text, /^# ns-3 Ns2MobilityHelper mobility trace/m);
  assert.equal(validateNs2FamilyOutput('$node_(0) set X_ 0').valid, false);
}

function testNs2AndNs3HaveIndependentArtifacts() {
  const ns2 = createArtifact('ns2', staticScenario);
  const ns3 = createArtifact('ns3', staticScenario);
  assert.equal(ns2.filename, 'mobility-ns2.tcl');
  assert.equal(ns3.filename, 'mobility-ns3.tcl');
  assert.notEqual(ns2.text.split('\n')[0], ns3.text.split('\n')[0]);
  assert.equal(ns2.conformance.valid, true);
  assert.equal(ns3.conformance.valid, true);
}

function testInetBonnMotionGoldenOutput() {
  const expected = [
    '0.000000000 10.000000000 -20.000000000',
    '0.000000000 30.000000000 -40.000000000'
  ].join('\n');
  const artifact = createArtifact('omnetpp', staticScenario);
  assert.equal(artifact.text, expected);
  assert.equal(artifact.conformance.valid, true);
  assert.equal(artifact.conformance.paths.length, 2);
  assert.equal(validateInetBonnMotionOutput('# comment\n0 0 0').valid, false);
  assert.equal(validateInetBonnMotionOutput('0 0\n').valid, false);
}

function testSemanticRejections() {
  expectAdapterError(() => adapters.cooja.serialize(staticScenario), /static Cooja export is disabled/i);



  expectAdapterError(() => adapters.cooja.serialize({
    scenario: 'mobile',
    waypoints: [
      { nodeId: 1, time: 1, x: 0, y: 0, z: 0 },
      { nodeId: 1, time: 1, x: 1, y: 1, z: 0 }
    ]
  }), /strictly increasing/i);



  expectAdapterError(() => adapters.omnetpp.serialize({
    scenario: 'fixed',
    waypoints: [{ nodeId: 2, time: 0, x: 0, y: 0, z: 0 }]
  }), /contiguous editor nodeIds/i);



  expectAdapterError(() => adapters.cooja.serialize({
    scenario: 'fixed',
    waypoints: [
      { nodeId: 1, time: 0, x: 0, y: 0, z: 0 },
      { nodeId: 1, time: 0, x: 1, y: 1, z: 0 }
    ]
  }), /occurs more than once/i);
}

testRegistryAndMetadata();
testCoojaGoldenOutputAndInverseAxis();
testNs3GoldenGrammarAndSpeed();
testNs2AndNs3HaveIndependentArtifacts();
testInetBonnMotionGoldenOutput();
testSemanticRejections();

console.log('simulator-adapters: all format and semantic tests passed');

const elevated = {scenario:'mobile',waypoints:[{nodeId:1,time:0,x:0,y:0,z:33},{nodeId:1,time:5,x:5,y:5,z:34},{nodeId:1,time:10,x:10,y:10,z:-2}]};
assert.deepEqual(adapters.cooja.serialize(elevated).split('\n').at(-1).split(/\s+/).map(Number),[0,10,10,-10,-2]);
for(const id of ['ns2','ns3']) {
 const report=validateNs2FamilyOutput(adapters[id].serialize(elevated));
 assert.equal(report.valid,true);
 assert.deepEqual(report.altitudeUpdates,[{time:5,nodeIndex:0,z:34},{time:10,nodeIndex:0,z:-2}]);
}
const inetText=adapters.omnetpp.serialize(elevated);
assert.deepEqual(inetText.split(/\s+/).map(Number),[0,0,0,33,5,5,-5,34,10,10,-10,-2]);
assert.deepEqual(validateInetBonnMotionOutput(inetText,elevated).paths[0].map(p=>p.z),[33,34,-2]);
