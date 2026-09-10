'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  AdapterValidationError,
  createArtifact,
  validateNs2FamilyOutput
} = require('../simulator-adapters.js');

const root = path.resolve(__dirname, '..');

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
}

function readFixture(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8').trimEnd();
}

function canonicalScenario(document) {
  return { scenario: document.scenario, waypoints: document.waypoints };
}

const mobile = readJson('integrations/scenarios/mobile-waypoints.json');
const fixed = readJson('integrations/scenarios/static-three-nodes.json');
const mobileArtifact = createArtifact('ns3', canonicalScenario(mobile));
const staticArtifact = createArtifact('ns3', canonicalScenario(fixed));

assert.equal(
  mobileArtifact.text,
  readFixture('integrations/ns3/mobile/mobility-ns3.tcl'),
  'The mobile trace executed by ns-3 must be byte-equivalent to current adapter output.'
);
assert.equal(
  staticArtifact.text,
  readFixture('integrations/ns3/static/mobility-ns3.tcl'),
  'The static trace executed by ns-3 must be byte-equivalent to current adapter output.'
);

assert.equal(mobileArtifact.conformance.initialized.size, 1);
assert.equal(mobileArtifact.conformance.movements.length, 3);
assert.deepEqual(
  mobileArtifact.conformance.movements.map(move => move.speed),
  [2.5, 1.666666667, 2.5]
);
assert.equal(staticArtifact.conformance.initialized.size, 3);
assert.equal(staticArtifact.conformance.movements.length, 0);

assert.equal(
  validateNs2FamilyOutput('$node_(0) set X_ 0\n$node_(0) set Y_ 0\n$node_(0) set Q_ 0').valid,
  false,
  'A trace with an unsupported axis and missing Z initialization must fail closed.'
);
assert.match(createArtifact('ns3', {
  scenario: 'mobile',
  waypoints: [
    { nodeId: 1, time: 0, x: 0, y: 0, z: 0 },
    { nodeId: 1, time: 1, x: 1, y: 1, z: 1 }
  ]
}).text, /set Z_ 1\.000000000"/); // Format retention, not a consumer-execution claim.


console.log('ns3-integration-fixtures: mobile/static chains and negative guards passed');
