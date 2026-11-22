'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { selectedCases } = require('./generate-cases.js');

const experimentRoot = path.resolve(__dirname, '..');
const protocol = JSON.parse(fs.readFileSync(path.join(experimentRoot, 'protocol.json'), 'utf8'));
const outputArgument = process.argv.find(argument => argument.startsWith('--output='));
if (!outputArgument) throw new Error('Use --output=/path/to/CASE-CATALOG.md');
const outputPath = path.resolve(outputArgument.slice('--output='.length));
const cases = selectedCases('all');

const lines = [
  '# Z1 distance–RSSI case catalog',
  '',
  'No full experiment has been run from this catalog yet. Review these generated scenarios before execution.',
  '',
  '## Shared parameters',
  '',
  `- Platform: ${protocol.platform}`,
  `- Distances: ${protocol.distancesMeters.join(', ')} m`,
  `- Simulation seed: ${protocol.simulationRandomSeed}`,
  `- Firmware warm-up: ${protocol.warmupSeconds} s`,
  `- Send interval: ${protocol.sendIntervalMilliseconds} ms`,
  `- Simulation duration: ${protocol.simulationDurationSeconds} s`,
  `- RX sensitivity: ${protocol.logisticLossDefaults.rxSensitivityDbm} dBm`,
  `- RSSI inflection point: ${protocol.logisticLossDefaults.rssiInflectionPointDbm} dBm`,
  `- AWGN sigma: ${protocol.logisticLossDefaults.awgnSigmaDb} dB`,
  `- TX success ratio: ${protocol.logisticLossDefaults.successRatioTx}`,
  `- Time variation: ${protocol.logisticLossDefaults.enableTimeVariation}`,
  '',
  '## Experimental separation',
  '',
  `- Main: all profiles and distances with transmitting range fixed at ${protocol.main.transmittingRangeMeters} m (${selectedCases('main').length} cases).`,
  `- Sensitivity: ${protocol.sensitivity.profileId} with transmitting range crossed over ${protocol.sensitivity.transmittingRangeMeters.join(', ')} m (${selectedCases('sensitivity').length} cases).`,
  '- In Cooja LogisticLoss, a receiver at distance >= transmitting range is outside the candidate set.',
  '',
  `Total: ${cases.length} cases.`,
  '',
  '## Complete case list',
  '',
  '| # | Suite | Case ID | Profile | n | Distance (m) | Transmitting range (m) | Candidate? |',
  '|---:|---|---|---|---:|---:|---:|:---:|'
];

cases.forEach((item, index) => {
  lines.push(`| ${index + 1} | ${item.suite} | \`${item.caseId}\` | ${item.profile.label} | ${item.profile.pathLossExponent} | ${item.distanceM} | ${item.transmittingRangeM} | ${item.distanceM < item.transmittingRangeM ? 'yes' : 'no'} |`);
});

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${lines.join('\n')}\n`);
console.log(`Wrote ${cases.length} cases to ${outputPath}`);
