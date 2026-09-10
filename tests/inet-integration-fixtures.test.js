'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  AdapterValidationError,
  createArtifact,
  validateInetBonnMotionOutput
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
const mobileArtifact = createArtifact('omnetpp', canonicalScenario(mobile));
const staticArtifact = createArtifact('omnetpp', canonicalScenario(fixed));

assert.equal(
  mobileArtifact.text,
  readFixture('integrations/inet/mobile/mobility-bonnmotion.movements'),
  'The mobile file executed by INET must be byte-equivalent to current adapter output.'
);
assert.equal(
  staticArtifact.text,
  readFixture('integrations/inet/static/mobility-bonnmotion.movements'),
  'The static file executed by INET must be byte-equivalent to current adapter output.'
);

assert.equal(mobileArtifact.conformance.paths.length, 1);
assert.equal(mobileArtifact.conformance.paths[0].length, 4);
assert.deepEqual(mobileArtifact.conformance.paths[0][3], { time: 9, x: -2, y: 6 });
assert.equal(staticArtifact.conformance.paths.length, 3);
assert.ok(staticArtifact.conformance.paths.every(hostPath => hostPath.length === 1));

assert.equal(validateInetBonnMotionOutput('0 0 0\n\n1 1 1').valid, false);
assert.equal(validateInetBonnMotionOutput('# unsupported comment\n0 0 0').valid, false);
assert.throws(
  () => createArtifact('omnetpp', {
    scenario: 'fixed',
    waypoints: [{ nodeId: 2, time: 0, x: 0, y: 0, z: 0 }]
  }),
  error => error instanceof AdapterValidationError && /contiguous editor nodeIds/i.test(error.message)
);
assert.equal(createArtifact('omnetpp', {
  scenario: 'mobile',
  waypoints: [
    { nodeId: 1, time: 0, x: 0, y: 0, z: 0 },
    { nodeId: 1, time: 1, x: 1, y: 1, z: 1 }
  ]
}).text.trim(), '0.000000000 0.000000000 0.000000000 0.000000000 1.000000000 1.000000000 -1.000000000 1.000000000');


console.log('inet-integration-fixtures: mobile/static chains and negative guards passed');
