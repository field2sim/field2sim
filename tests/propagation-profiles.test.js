'use strict';

const assert = require('node:assert/strict');
const {
  PropagationProfileError,
  references,
  profiles,
  getProfile,
  validateInputs,
  createProfileArtifact
} = require('../propagation-profiles.js');

function testCatalogStructureAndProvenance() {
  assert.deepEqual(Object.keys(profiles), [
    'urban-open-street-los',
    'urban-street-canyon-nlos',
    'agriculture-crop-vegetation-24ghz',
    'forest-vegetation',
    'coastal-over-water-24ghz',
    'free-space-los-baseline'
  ]);

  for (const profile of Object.values(profiles)) {
    assert.equal(profile.id.length > 0, true);
    assert.equal(profile.label.length > 0, true);
    assert.equal(profile.modelFamily.length > 0, true);
    assert.equal(profile.caveat.length > 0, true);
    assert.equal(profile.sourceIds.length > 0, true);
    assert.equal(profile.evidence.requiredContext.length > 0, true);
    profile.sourceIds.forEach(sourceId => {
      assert.ok(references[sourceId], `${profile.id} references unknown source ${sourceId}`);
      assert.match(references[sourceId].url, /^https:\/\//);
      assert.match(references[sourceId].bibtex, /^@/);
    });
  }
}

function testFrequencyEvidenceBoundary() {
  const agriculture = getProfile('agriculture-crop-vegetation-24ghz');
  const supported = validateInputs(agriculture, {
    frequencyMHz: 2400,
    txHeightM: 1.5,
    rxHeightM: 1.0
  });
  assert.equal(supported.valid, true);
  assert.equal(supported.withinFrequencyEvidence, true);
  assert.deepEqual(supported.warnings, []);

  const unsupported = validateInputs(agriculture, {
    frequencyMHz: 868,
    txHeightM: 1.5,
    rxHeightM: 1.0
  });
  assert.equal(unsupported.valid, true);
  assert.equal(unsupported.withinFrequencyEvidence, false);
  assert.match(unsupported.warnings[0], /outside that evidence frequency/i);
}

function testInvalidInputsAndUnknownProfile() {
  const coastal = getProfile('coastal-over-water-24ghz');
  const report = validateInputs(coastal, {
    frequencyMHz: 0,
    txHeightM: -1,
    rxHeightM: Number.NaN
  });
  assert.equal(report.valid, false);
  assert.equal(report.errors.length, 3);

  assert.throws(
    () => createProfileArtifact('coastal-over-water-24ghz', {
      frequencyMHz: 2400,
      txHeightM: 0,
      rxHeightM: 1
    }),
    error => error instanceof PropagationProfileError && error.errors.length === 1
  );
  assert.throws(() => getProfile('unknown-profile'), PropagationProfileError);
}

function testDeterministicArtifactAndSourceIsolation() {
  const input = { frequencyMHz: 2400, txHeightM: 2.5, rxHeightM: 1.5 };
  const first = createProfileArtifact('coastal-over-water-24ghz', input);
  const second = createProfileArtifact('coastal-over-water-24ghz', input);
  assert.equal(first.text, second.text);
  assert.equal(first.filename, 'propagation-profile-coastal-over-water-24ghz.json');
  assert.equal(first.mimeType, 'application/json');
  assert.equal(first.payload.applicability.withinSourceFrequencyEvidence, true);
  assert.equal(first.payload.references[0].doi, '10.1109/VTC2020-Spring48590.2020.9129548');
  assert.equal(first.payload.implementation.simulatorMappings, 'separate-target-artifacts');

  first.payload.profile.label = 'mutated copy';
  assert.equal(getProfile('coastal-over-water-24ghz').label, 'Coastal — Over-Water (2.4 GHz)');
}

testCatalogStructureAndProvenance();
testFrequencyEvidenceBoundary();
testInvalidInputsAndUnknownProfile();
testDeterministicArtifactAndSourceIsolation();

console.log('propagation-profiles: catalog, provenance, applicability, and artifact tests passed');
