'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
  patchCoojaCsc
} = require('../../../cooja-csc-pathloss-writer.js');

const experimentRoot = path.resolve(__dirname, '..');
const protocol = JSON.parse(fs.readFileSync(path.join(experimentRoot, 'protocol.json'), 'utf8'));
const profiles = JSON.parse(fs.readFileSync(path.join(experimentRoot, 'profiles.json'), 'utf8'));
const calibration = JSON.parse(
  fs.readFileSync(path.join(experimentRoot, 'calibration-profiles.json'), 'utf8'));
const baselinePath = path.join(experimentRoot, 'baseline', 'logistic-test.csc');
const sourcePrefix = process.env.CASE_SOURCE_PREFIX || '../../baseline';

function xmlEscape(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
function round(value, digits = 6) {
  return Number(value.toFixed(digits));
}

function freeSpacePathLossDb(frequencyMHz, distanceM = 1) {
  const frequencyHz = frequencyMHz * 1e6;
  const speedOfLight = 299792458;
  return 20 * Math.log10((4 * Math.PI * distanceM * frequencyHz) / speedOfLight);
}

function calibrationDefinition(profile) {
  const definition = calibration.profiles[profile.id];
  if (!definition) throw new Error(`Missing calibration definition: ${profile.id}`);
  return definition;
}

function sourceInterceptDb(profile, definition) {
  if (definition.model === 'itu-r-p1411-alpha-beta-gamma') {
    return definition.beta + 10 * definition.gamma * Math.log10(calibration.frequencyMHz / 1000);
  }
  if (definition.model === 'log-distance-fspl-reference') {
    return freeSpacePathLossDb(calibration.frequencyMHz, 1);
  }
  throw new Error(`Unsupported calibration model: ${definition.model}`);
}

function calibratedRangeM(profile, definition, rxSensitivityDbm) {
  const interceptDb = sourceInterceptDb(profile, definition);
  return round(10 ** (
    (calibration.txPowerDbm - rxSensitivityDbm - interceptDb) /
    (10 * profile.pathLossExponent)
  ));
}

function distanceDomain(definition, distanceM) {
  if (definition.measuredDistancesM) {
    if (definition.measuredDistancesM.length === 1) {
      const match = definition.measuredDistancesM.includes(distanceM);
      return match
        ? `matches source measurement distance (${definition.measuredDistancesM[0]} m)`
        : `EXTRAPOLATION; source reports one separation at ${definition.measuredDistancesM[0]} m`;
    }
    const minimum = Math.min(...definition.measuredDistancesM);
    const maximum = Math.max(...definition.measuredDistancesM);
    return distanceM >= minimum && distanceM <= maximum
      ? `inside source measurement interval (${minimum}-${maximum} m; sampled at ${definition.measuredDistancesM.join(', ')} m)`
      : `EXTRAPOLATION; source measurement interval is ${minimum}-${maximum} m (sampled at ${definition.measuredDistancesM.join(', ')} m)`;
  }
  const range = definition.validDistanceM;
  if (!range) return 'source domain not specified';
  const inside = distanceM >= range.min && (range.max === null || distanceM <= range.max);
  const maximum = range.max === null ? 'unbounded theoretical reference' : `${range.max} m`;
  return inside
    ? `inside source domain (${range.min} m to ${maximum})`
    : `EXTRAPOLATION; source domain is ${range.min} m to ${maximum}`;
}

function sourceModelText(profile, definition) {
  if (definition.model === 'itu-r-p1411-alpha-beta-gamma') {
    return `PL(d,f)=10*alpha*log10(d)+beta+10*gamma*log10(f_GHz); alpha=${definition.alpha}, beta=${definition.beta}, gamma=${definition.gamma}`;
  }
  return `PL(d)=FSPL(1 m, 2.4 GHz)+10*n*log10(d/1 m); FSPL(1 m)=${round(freeSpacePathLossDb(calibration.frequencyMHz), 4)} dB`;
}

function caseNotes(item) {
  const senderX = 49.54465430879008;
  const senderY = 30.187651112814674;
  const receiverX = round(senderX + item.distanceM, 12);
  const definition = item.calibration;
  const selectedSensitivity = item.rxSensitivityDbm === -95
    ? 'CC2420 data-sheet substitution (-95 dBm at 1% PER); sensitivity analysis only, not PER-equivalent calibration'
    : 'legacy Cooja LogisticLoss default retained as a simulator comparison; not Z1 hardware sensitivity';
  return [
    `Case ID: ${item.caseId}`,
    `Suite: ${item.suite}`,
    `Platform: Zolertia Z1 / TI CC2420 / 2.4 GHz / nominal TX power ${calibration.txPowerDbm} dBm`,
    `Environment: ${item.profile.family} — ${item.profile.label}`,
    `Source: ${item.profile.source}; ${item.profile.sourceUrl}`,
    `Source model: ${sourceModelText(item.profile, definition)}`,
    `Sender: mote ${protocol.senderMoteId} at (${senderX}, ${senderY}) m`,
    `Receiver: mote ${protocol.receiverMoteId} at (${receiverX}, ${senderY}) m`,
    `Tx-Rx distance: ${item.distanceM} m; domain status: ${distanceDomain(definition, item.distanceM)}`,
    `Transmitting range: ${item.transmittingRangeM} m; calculated by solving the complete source mean model for mean RSSI = ${item.rxSensitivityDbm} dBm`,
    `Transmitting-range domain status: ${distanceDomain(definition, item.transmittingRangeM)}`,
    `Range equation: ${calibration.modelDocumentation[definition.model].rangeCalculation}`,
    `Path-loss exponent: ${item.profile.pathLossExponent}`,
    `AWGN sigma: ${item.awgnSigmaDb} dB, copied from the source sigma/shadowing assumption; Cooja samples it independently per reception`,
    `RX sensitivity parameter: ${item.rxSensitivityDbm} dBm — ${selectedSensitivity}`,
    `RSSI inflection point: ${protocol.logisticLossDefaults.rssiInflectionPointDbm} dBm`,
    `TX success ratio: ${protocol.logisticLossDefaults.successRatioTx}`,
    `Time variation: ${protocol.logisticLossDefaults.enableTimeVariation}`,
    `Random seed: ${protocol.simulationRandomSeed}; duration: ${protocol.simulationDurationSeconds} s`,
    `Traffic: mote ${protocol.senderMoteId} sends one IPv6 link-local one-hop UDP request every ${protocol.sendIntervalMilliseconds} ms after ${protocol.warmupSeconds} s warm-up; mote ${protocol.receiverMoteId} logs RSSI`,
    'Cooja LogisticLoss semantic warning: transmitting_range is both the strict candidate-receiver cutoff (distance must be smaller) and the d0-like distance where mean RSSI is anchored to rx_sensitivity.'
  ].join('\n');
}


function baseScenario(caseDefinition) {
  const caseId = caseDefinition.caseId;
  const measurementPath = process.env.CASE_MEASUREMENT_ROOT
    ? path.join(path.resolve(process.env.CASE_MEASUREMENT_ROOT), `${caseId}.log`)
    : null;
  const measurementFile = measurementPath ? JSON.stringify(measurementPath) : null;
  const serialCondition = process.env.DEBUG_SERIAL === '1'
    ? 'msg !== null'
    : 'msg.indexOf("Sending fixed request") !== -1 || msg.indexOf("RSSI=") !== -1';
  const timeoutLog = measurementPath
    ? `log.append(${measurementFile}, "CASE_DONE case=${caseId}\\n");`
    : `log.log("CASE_DONE case=${caseId}\\n");`;
  const eventLog = measurementPath
    ? `log.append(${measurementFile}, "MEAS case=${caseId} mote=" + mote.getID() + " " + msg + "\\n");`
    : `log.log("MEAS case=${caseId} mote=" + mote.getID() + " " + msg + "\\n");`;
  const script = [
    measurementPath ? `log.writeFile(${measurementFile}, "");` : '',
    `TIMEOUT(${protocol.simulationDurationSeconds * 1000}, ${timeoutLog} log.testOK());`,
    'while (true) {',
    '  YIELD();',
    `  if (${serialCondition}) {`,
    `    ${eventLog}`,
    '  }',
    '}'
  ].filter(Boolean).join('\n');
  let text = fs.readFileSync(baselinePath, 'utf8');
  const positions = Array.from(text.matchAll(/<pos\s+x="([^"]+)"\s+y="([^"]+)"\s*\/>/g));
  if (positions.length !== 2) throw new Error(`Expected two Z1 positions in ${baselinePath}`);
  const senderX = Number(positions[0][1]);
  const senderY = Number(positions[0][2]);
  const receiverPosition = `<pos x="${senderX + caseDefinition.distanceM}" y="${senderY}" />`;
  let positionIndex = 0;
  text = text.replace(/<pos\s+x="([^"]+)"\s+y="([^"]+)"\s*\/>/g, match => {
    positionIndex += 1;
    return positionIndex === 2 ? receiverPosition : match;
  });
  text = text
    .replace(/<title>[\s\S]*?<\/title>/, `<title>Z1 UDP distance-RSSI — ${xmlEscape(caseId)}</title>`)
    .replaceAll('[CONFIG_DIR]/udp-client.c', `[CONFIG_DIR]/${sourcePrefix}/udp-client.c`)
    .replaceAll('[CONFIG_DIR]/build/z1/udp-client.z1', `[CONFIG_DIR]/${sourcePrefix}/build/z1/udp-client.z1`)
    .replaceAll('[CONFIG_DIR]/udp-server.c', `[CONFIG_DIR]/${sourcePrefix}/udp-server.c`)
    .replaceAll('[CONFIG_DIR]/build/z1/udp-server.z1', `[CONFIG_DIR]/${sourcePrefix}/build/z1/udp-server.z1`);
  if (caseDefinition.calibration) {
    text = text.replace(/<notes>[\s\S]*?<\/notes>/, `<notes>${xmlEscape(caseNotes(caseDefinition))}</notes>`);
  }
  const scriptPlugin = [
    '  <plugin>',
    '    org.contikios.cooja.plugins.ScriptRunner',
    '    <plugin_config>',
    `      <script>${xmlEscape(script)}</script>`,
    '      <active>true</active>',
    '    </plugin_config>',
    '  </plugin>',
    ''
  ].join('\n');
  return text.replace('</simconf>', `${scriptPlugin}</simconf>`);
}

function mainCases() {
  const transmittingRangeM = protocol.main.transmittingRangeMeters;
  return profiles.flatMap(profile => protocol.distancesMeters.map(distanceM => ({
    suite: 'main',
    caseId: `main__${profile.id}__d${distanceM}__tr${transmittingRangeM}`,
    profile,
    distanceM,
    transmittingRangeM
  })));
}

function sensitivityCases() {
  const profile = profiles.find(item => item.id === protocol.sensitivity.profileId);
  if (!profile) throw new Error(`Missing sensitivity profile: ${protocol.sensitivity.profileId}`);
  return protocol.sensitivity.transmittingRangeMeters.flatMap(transmittingRangeM =>
    protocol.distancesMeters.map(distanceM => ({
      suite: 'sensitivity',
      caseId: `sensitivity__${profile.id}__d${distanceM}__tr${transmittingRangeM}`,
      profile,
      distanceM,
      transmittingRangeM
    }))
  );
}
function calibratedZ1Cases() {
  return profiles.flatMap(profile => {
    const definition = calibrationDefinition(profile);
    if (definition.model === 'itu-r-p1411-alpha-beta-gamma' &&
        Math.abs(definition.alpha - profile.pathLossExponent) > 1e-12) {
      throw new Error(`P.1411 alpha/exponent mismatch for ${profile.id}`);
    }
    return protocol.calibratedZ1.rxSensitivityDbm.flatMap(rxSensitivityDbm => {
      const transmittingRangeM = calibratedRangeM(profile, definition, rxSensitivityDbm);
      return protocol.distancesMeters.map(distanceM => ({
        suite: 'calibrated-z1',
        caseId: `calibrated-z1__${profile.id}__rxm${Math.abs(rxSensitivityDbm)}__d${distanceM}`,
        profile,
        calibration: definition,
        distanceM,
        transmittingRangeM,
        rxSensitivityDbm,
        awgnSigmaDb: definition.sourceSigmaDb
      }));
    });
  });
}


function selectedCases(suite) {
  if (suite === 'main') return mainCases();
  if (suite === 'sensitivity') return sensitivityCases();
  if (suite === 'calibrated-z1') return calibratedZ1Cases();
  if (suite === 'all') return mainCases().concat(sensitivityCases());
  throw new Error(`Unknown suite: ${suite}`);
}

function generateCases(suite = 'all') {
  const cases = selectedCases(suite);
  const generatedRoot = process.env.CASE_OUTPUT_ROOT
    ? path.resolve(process.env.CASE_OUTPUT_ROOT)
    : path.join(experimentRoot, 'generated');
  const manifest = [];

  for (const item of cases) {
    const outputDir = path.join(generatedRoot, item.suite);
    fs.mkdirSync(outputDir, { recursive: true });
    const original = baseScenario(item);
    const patchedArtifact = patchCoojaCsc({
      filename: `${item.caseId}.csc`,
      text: original,
      randomSeed: protocol.simulationRandomSeed,
      profileLabel: item.profile.label,
      profileUrl: item.profile.sourceUrl,
      radio: {
        transmittingRangeM: item.transmittingRangeM,
        successRatioTx: protocol.logisticLossDefaults.successRatioTx,
        rxSensitivityDbm: item.rxSensitivityDbm ?? protocol.logisticLossDefaults.rxSensitivityDbm,
        rssiInflectionPointDbm: protocol.logisticLossDefaults.rssiInflectionPointDbm,
        pathLossExponent: item.profile.pathLossExponent,
        awgnSigmaDb: item.awgnSigmaDb ?? protocol.logisticLossDefaults.awgnSigmaDb,
        enableTimeVariation: protocol.logisticLossDefaults.enableTimeVariation
      }
    });
    const artifact = process.env.KEEP_UDGM === '1'
      ? { filename: patchedArtifact.filename, text: original }
      : patchedArtifact;
    const outputPath = path.join(outputDir, artifact.filename);
    fs.writeFileSync(outputPath, artifact.text);
    manifest.push({
      caseId: item.caseId,
      suite: item.suite,
      profileId: item.profile.id,
      family: item.profile.family,
      label: item.profile.label,
      pathLossExponent: item.profile.pathLossExponent,
      source: item.profile.source,
      sourceUrl: item.profile.sourceUrl,
      distanceM: item.distanceM,
      transmittingRangeM: item.transmittingRangeM,
      rxSensitivityDbm: item.rxSensitivityDbm ?? protocol.logisticLossDefaults.rxSensitivityDbm,
      rssiInflectionPointDbm: protocol.logisticLossDefaults.rssiInflectionPointDbm,
      awgnSigmaDb: item.awgnSigmaDb ?? protocol.logisticLossDefaults.awgnSigmaDb,
      sourceModel: item.calibration?.model ?? 'legacy',
      sourceDomainStatus: item.calibration ? distanceDomain(item.calibration, item.distanceM) : 'legacy',
      transmittingRangeDomainStatus: item.calibration ? distanceDomain(item.calibration, item.transmittingRangeM) : 'legacy',
      randomSeed: protocol.simulationRandomSeed,
      cscPath: path.relative(experimentRoot, outputPath)
    });
  }

  const manifestPath = path.join(generatedRoot, `manifest-${suite}.json`);
  fs.mkdirSync(generatedRoot, { recursive: true });
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return { cases: manifest, manifestPath };
}

if (require.main === module) {
  const suiteArgument = process.argv.find(argument => argument.startsWith('--suite='));
  const suite = suiteArgument ? suiteArgument.slice('--suite='.length) : 'all';
  const result = generateCases(suite);
  console.log(`Generated ${result.cases.length} Cooja .csc cases: ${path.relative(process.cwd(), result.manifestPath)}`);
}

module.exports = Object.freeze({
  generateCases, selectedCases, baseScenario, calibratedRangeM,
  distanceDomain, freeSpacePathLossDb
});
