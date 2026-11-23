'use strict';

// Fixed-range suite (reviewer item M4): transmitting_range is held at each profile's
// -95 dBm calibrated value while rx_sensitivity varies, repeated over independent seeds.
// Writes only to generated/fixed-range-z1/ and generated/manifest-fixed-range-z1.json.

const fs = require('node:fs');
const path = require('node:path');
const { patchCoojaCsc } = require('../../../cooja-csc-pathloss-writer.js');
const { baseScenario, calibratedRangeM, distanceDomain } = require('./generate-cases.js');

const experimentRoot = path.resolve(__dirname, '..');
const protocol = JSON.parse(fs.readFileSync(path.join(experimentRoot, 'protocol.json'), 'utf8'));
const profiles = JSON.parse(fs.readFileSync(path.join(experimentRoot, 'profiles.json'), 'utf8'));
const calibration = JSON.parse(
  fs.readFileSync(path.join(experimentRoot, 'calibration-profiles.json'), 'utf8'));

const SUITE = 'fixed-range-z1';
const DESIGN = Object.freeze({
  profileIds: ['urban-los-site-general', 'urban-high-rise-nlos', 'urban-low-rise-nlos'],
  rangeAnchorDbm: -95,
  rxSensitivityDbm: [-90, -95, -100],
  seeds: Array.from({ length: 10 }, (_, k) => 123456 + k)
});

function xmlEscape(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function fixedRangeCases() {
  return DESIGN.profileIds.flatMap(profileId => {
    const profile = profiles.find(item => item.id === profileId);
    const definition = calibration.profiles[profileId];
    if (!profile || !definition) throw new Error(`Missing profile: ${profileId}`);
    const transmittingRangeM = calibratedRangeM(profile, definition, DESIGN.rangeAnchorDbm);
    if (transmittingRangeM <= Math.max(...protocol.distancesMeters)) {
      throw new Error(`${profileId}: fixed range ${transmittingRangeM} m does not exceed all distances`);
    }
    return DESIGN.rxSensitivityDbm.flatMap(rxSensitivityDbm =>
      protocol.distancesMeters.flatMap(distanceM => DESIGN.seeds.map(seed => ({
        suite: SUITE,
        caseId: `${SUITE}__${profileId}__rxm${Math.abs(rxSensitivityDbm)}__d${distanceM}__s${seed}`,
        profile,
        definition,
        distanceM,
        transmittingRangeM,
        rxSensitivityDbm,
        awgnSigmaDb: definition.sourceSigmaDb,
        seed
      }))));
  });
}

function notes(item) {
  return [
    `Case ID: ${item.caseId}`,
    `Suite: ${SUITE} (transmitting_range fixed, rx_sensitivity varied, independent seeds)`,
    `Platform: Zolertia Z1 / TI CC2420 / 2.4 GHz / nominal TX power ${calibration.txPowerDbm} dBm`,
    `Environment: ${item.profile.family} — ${item.profile.label}`,
    `Source: ${item.profile.source}; ${item.profile.sourceUrl}`,
    `Tx-Rx distance: ${item.distanceM} m; domain status: ${distanceDomain(item.definition, item.distanceM)}`,
    `Transmitting range: ${item.transmittingRangeM} m, FIXED at the source-model range for ${DESIGN.rangeAnchorDbm} dBm and not recomputed for this case's rx_sensitivity`,
    `RX sensitivity parameter: ${item.rxSensitivityDbm} dBm (varied independently; simulator-parameter sensitivity, not a hardware calibration)`,
    `Path-loss exponent: ${item.profile.pathLossExponent}`,
    `AWGN sigma: ${item.awgnSigmaDb} dB (sampled independently per reception by Cooja)`,
    `RSSI inflection point: ${protocol.logisticLossDefaults.rssiInflectionPointDbm} dBm; TX success ratio: ${protocol.logisticLossDefaults.successRatioTx}; time variation: ${protocol.logisticLossDefaults.enableTimeVariation}`,
    `Random seed: ${item.seed}; duration: ${protocol.simulationDurationSeconds} s`,
    `Traffic: mote ${protocol.senderMoteId} sends one IPv6 link-local one-hop UDP request every ${protocol.sendIntervalMilliseconds} ms after ${protocol.warmupSeconds} s warm-up; mote ${protocol.receiverMoteId} logs RSSI`,
    'Cooja LogisticLoss semantic warning: with transmitting_range fixed, changing rx_sensitivity shifts the mean-RSSI anchor at transmitting_range and therefore the whole mean curve.'
  ].join('\n');
}

function generate() {
  const outputDir = path.join(experimentRoot, 'generated', SUITE);
  fs.mkdirSync(outputDir, { recursive: true });
  process.env.CASE_MEASUREMENT_ROOT = path.join(experimentRoot, 'results', 'runtime', SUITE, 'cases');
  const manifest = [];
  for (const item of fixedRangeCases()) {
    let text = baseScenario(item);
    text = text.replace(/<notes>[\s\S]*?<\/notes>/, `<notes>${xmlEscape(notes(item))}</notes>`);
    const artifact = patchCoojaCsc({
      filename: `${item.caseId}.csc`,
      text,
      randomSeed: item.seed,
      profileLabel: item.profile.label,
      profileUrl: item.profile.sourceUrl,
      radio: {
        transmittingRangeM: item.transmittingRangeM,
        successRatioTx: protocol.logisticLossDefaults.successRatioTx,
        rxSensitivityDbm: item.rxSensitivityDbm,
        rssiInflectionPointDbm: protocol.logisticLossDefaults.rssiInflectionPointDbm,
        pathLossExponent: item.profile.pathLossExponent,
        awgnSigmaDb: item.awgnSigmaDb,
        enableTimeVariation: protocol.logisticLossDefaults.enableTimeVariation
      }
    });
    const outputPath = path.join(outputDir, artifact.filename);
    fs.writeFileSync(outputPath, artifact.text);
    manifest.push({
      caseId: item.caseId,
      suite: SUITE,
      profileId: item.profile.id,
      family: item.profile.family,
      label: item.profile.label,
      pathLossExponent: item.profile.pathLossExponent,
      source: item.profile.source,
      sourceUrl: item.profile.sourceUrl,
      distanceM: item.distanceM,
      transmittingRangeM: item.transmittingRangeM,
      rxSensitivityDbm: item.rxSensitivityDbm,
      rssiInflectionPointDbm: protocol.logisticLossDefaults.rssiInflectionPointDbm,
      awgnSigmaDb: item.awgnSigmaDb,
      sourceModel: item.definition.model,
      sourceDomainStatus: distanceDomain(item.definition, item.distanceM),
      transmittingRangeDomainStatus: distanceDomain(item.definition, item.transmittingRangeM),
      randomSeed: item.seed,
      cscPath: path.relative(experimentRoot, outputPath)
    });
  }
  const manifestPath = path.join(experimentRoot, 'generated', `manifest-${SUITE}.json`);
  fs.writeFileSync(manifestPath, `${JSON.stringify({ design: DESIGN, cases: manifest }, null, 2)}\n`);
  return { manifest, manifestPath };
}

if (require.main === module) {
  const result = generate();
  console.log(`Generated ${result.manifest.length} ${SUITE} CSC files: ${path.relative(process.cwd(), result.manifestPath)}`);
}

module.exports = Object.freeze({ SUITE, DESIGN, fixedRangeCases });
