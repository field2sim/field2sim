'use strict';

const assert = require('node:assert/strict');
const {
  TARGETS,
  AGRICULTURE_CONDITIONS,
  PropagationAdapterError,
  freeSpacePathLossDb,
  logDistancePathLossDb,
  twoRayCrossoverDistanceM,
  twoRayGroundPathLossDb,
  buildPropagationIr,
  assessPropagationMapping,
  createPropagationArtifact
} = require('../propagation-adapters.js');

function close(actual, expected, tolerance = 1e-9) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} differs from ${expected}`);
}

const base = Object.freeze({
  frequencyMHz: 2400,
  txHeightM: 1.5,
  rxHeightM: 1.5,
  referenceDistanceM: 1,
  maximumRangeM: 100,
  shadowingSigmaDb: 0,
  systemLossDb: 0,
  randomSeed: 1,
  agricultureConditionId: 'corn-growth'
});

// Independent reference values from the published Friis and log-distance equations.
close(freeSpacePathLossDb(2400, 1), 40.0520080561155, 1e-12);
close(freeSpacePathLossDb(2400, 10), 60.0520080561155, 1e-12);
close(logDistancePathLossDb(40.0520080561155, 4.9, 1, 10), 89.0520080561155, 1e-12);

const crossover = twoRayCrossoverDistanceM(2400, 1.5, 1.5);
close(crossover, 226.35126237078163, 1e-9);
close(twoRayGroundPathLossDb(2400, 10, 1.5, 1.5), freeSpacePathLossDb(2400, 10), 1e-12);
close(twoRayGroundPathLossDb(2400, 1000, 1.5, 1.5), 112.95634963777275, 1e-9);

assert.equal(Object.keys(AGRICULTURE_CONDITIONS).length, 9);
assert.deepEqual(
  Object.values(AGRICULTURE_CONDITIONS).map(item => item.pathLossExponent),
  [4.90, 5.77, 4.85, 5.47, 5.08, 5.97, 4.70, 4.90, 4.80]
);

const agricultureIr = buildPropagationIr('agriculture-crop-vegetation-24ghz', base);
assert.equal(agricultureIr.schema, 'org.field2sim.propagation-ir');
assert.equal(agricultureIr.primaryModel.kind, 'log-distance');
assert.equal(agricultureIr.primaryModel.pathLossExponent, 4.9);
assert.equal(agricultureIr.primaryModel.parameterOrigin, 'cited-measurement-condition');
assert.equal(agricultureIr.primaryModel.conditionId, 'corn-growth');
assert.deepEqual(agricultureIr.profile.sourceIds, ['dhanavanthan-2013-agriculture']);

const expectedQuality = {
  cooja: 'parameterized-approximation',
  ns2: 'native',
  ns3: 'native',
  omnetpp: 'native'
};
for (const targetId of Object.keys(TARGETS)) {
  const assessment = assessPropagationMapping(targetId, 'agriculture-crop-vegetation-24ghz', base);
  assert.equal(assessment.supported, true);
  assert.equal(assessment.quality, expectedQuality[targetId]);
}

const urbanNs3 = assessPropagationMapping('ns3', 'urban-open-street-los', base);
assert.equal(urbanNs3.supported, true);
assert.equal(urbanNs3.quality, 'native');
assert.equal(urbanNs3.model.kind, 'itu-r-p1411-los-family');

for (const targetId of ['cooja', 'ns2', 'omnetpp']) {
  const assessment = assessPropagationMapping(targetId, 'urban-open-street-los', base);
  assert.equal(assessment.supported, false);
  assert.equal(assessment.quality, 'unsupported');
  assert.match(assessment.requirements.join(' '), /path-loss exponent/i);
}

for (const profileId of ['urban-street-canyon-nlos', 'forest-vegetation']) {
  for (const targetId of Object.keys(TARGETS)) {
    assert.equal(assessPropagationMapping(targetId, profileId, base).supported, false);
    const assessment = assessPropagationMapping(targetId, profileId, {
      ...base,
      approximationPathLossExponent: 3.4
    });
    assert.equal(assessment.supported, true);
    assert.equal(assessment.quality, 'parameterized-approximation');
    assert.equal(assessment.model.parameterOrigin, 'user-supplied-calibration');
  }
}

const cooja = createPropagationArtifact('cooja', 'agriculture-crop-vegetation-24ghz', base);
assert.equal(cooja.filename, 'propagation-agriculture-crop-vegetation-24ghz-cooja.csc-fragment');
assert.match(cooja.text, /org\.contikios\.cooja\.radiomediums\.LogisticLoss/);
assert.match(cooja.text, /<transmitting_range>100<\/transmitting_range>/);
assert.match(cooja.text, /<path_loss_exponent>4\.9<\/path_loss_exponent>/);
assert.match(cooja.text, /Mapping quality: parameterized-approximation/);
assert.match(cooja.text, /<success_ratio_tx>1<\/success_ratio_tx>/);
assert.match(cooja.text, /<rx_sensitivity>-100<\/rx_sensitivity>/);
assert.match(cooja.text, /<rssi_inflection_point>-92<\/rssi_inflection_point>/);
assert.match(cooja.text, /<awgn_sigma>0<\/awgn_sigma>/);
assert.match(cooja.text, /<enable_time_variation>false<\/enable_time_variation>/);
assert.match(cooja.text, /<randomseed>1<\/randomseed>/);

const coojaNativeFields = createPropagationArtifact('cooja', 'agriculture-crop-vegetation-24ghz', {
  ...base,
  maximumRangeM: 50,
  shadowingSigmaDb: 3,
  randomSeed: 123456,
  successRatioTx: 0.8,
  rxSensitivityDbm: -95,
  rssiInflectionPointDbm: -88,
  enableTimeVariation: true
});
assert.match(coojaNativeFields.text, /<transmitting_range>50<\/transmitting_range>/);
assert.match(coojaNativeFields.text, /<success_ratio_tx>0\.8<\/success_ratio_tx>/);
assert.match(coojaNativeFields.text, /<rx_sensitivity>-95<\/rx_sensitivity>/);
assert.match(coojaNativeFields.text, /<rssi_inflection_point>-88<\/rssi_inflection_point>/);
assert.match(coojaNativeFields.text, /<awgn_sigma>3<\/awgn_sigma>/);
assert.match(coojaNativeFields.text, /<enable_time_variation>true<\/enable_time_variation>/);
assert.match(coojaNativeFields.text, /<randomseed>123456<\/randomseed>/);

const ns2 = createPropagationArtifact('ns2', 'agriculture-crop-vegetation-24ghz', base);
assert.match(ns2.text, /new Propagation\/Shadowing/);
assert.match(ns2.text, /pathlossExp_ 4\.9/);
assert.match(ns2.text, /std_db_ 0/);
assert.match(ns2.text, /dist0_ 1/);
assert.match(ns2.text, /-propInstance \$cpx_propagation/);

const ns3 = createPropagationArtifact('ns3', 'agriculture-crop-vegetation-24ghz', base);
assert.match(ns3.text, /CreateObject<ns3::LogDistancePropagationLossModel>/);
assert.match(ns3.text, /"Exponent", ns3::DoubleValue\(4\.9\)/);
assert.match(ns3.text, /"ReferenceLoss", ns3::DoubleValue\(40\.052008056\)/);

const inet = createPropagationArtifact('omnetpp', 'agriculture-crop-vegetation-24ghz', base);
assert.match(inet.text, /pathLoss\.typename = "LogNormalShadowing"/);
assert.match(inet.text, /pathLoss\.alpha = 4\.9/);
assert.match(inet.text, /^seed-set = 1$/m);
assert.match(inet.text, /pathLoss\.sigma = 0$/m);
assert.doesNotMatch(inet.text, /pathLoss\.sigma = 0dB/);

const freeSpace = Object.fromEntries(Object.keys(TARGETS).map(targetId => [
  targetId,
  createPropagationArtifact(targetId, 'free-space-los-baseline', base)
]));
assert.equal(freeSpace.cooja.mapping.quality, 'parameterized-approximation');
assert.match(freeSpace.ns2.text, /Propagation\/FreeSpace/);
assert.match(freeSpace.ns3.text, /FriisPropagationLossModel/);
assert.match(freeSpace.omnetpp.text, /FreeSpacePathLoss/);

const coastal = Object.fromEntries(Object.keys(TARGETS).map(targetId => [
  targetId,
  createPropagationArtifact(targetId, 'coastal-over-water-24ghz', base)
]));
assert.match(coastal.cooja.text, /<path_loss_exponent>4<\/path_loss_exponent>/);
assert.match(coastal.ns2.text, /Propagation\/TwoRayGround/);
assert.match(coastal.ns3.text, /TwoRayGroundPropagationLossModel/);
assert.match(coastal.omnetpp.text, /TwoRayGroundReflection/);

const stochasticNs3 = createPropagationArtifact('ns3', 'agriculture-crop-vegetation-24ghz', {
  ...base,
  shadowingSigmaDb: 3
});
assert.equal(stochasticNs3.mapping.quality, 'parameterized-approximation');
assert.match(stochasticNs3.mapping.warnings.join(' '), /deterministic mean only/);

assert.deepEqual(
  createPropagationArtifact('ns3', 'agriculture-crop-vegetation-24ghz', base),
  createPropagationArtifact('ns3', 'agriculture-crop-vegetation-24ghz', base),
  'Artifacts must be deterministic.'
);

assert.throws(
  () => createPropagationArtifact('cooja', 'forest-vegetation', base),
  error => error instanceof PropagationAdapterError && /No defensible/.test(error.message)
);
assert.equal(buildPropagationIr('agriculture-crop-vegetation-24ghz', { ...base, randomSeed: 64 }).inputs.randomSeed, 64);
assert.equal(assessPropagationMapping('ns2', 'agriculture-crop-vegetation-24ghz', { ...base, randomSeed: 64 }).supported, false);
assert.throws(
  () => buildPropagationIr('agriculture-crop-vegetation-24ghz', { ...base, agricultureConditionId: 'generic-farm' }),
  error => error instanceof PropagationAdapterError && error.errors.some(item => /Unknown agriculture condition/.test(item))
);

console.log('propagation-adapters: numerical IR, mapping classifications, and four target serializers passed');
