'use strict';

const fs = require('node:fs');
const path = require('node:path');

const experimentRoot = path.resolve(__dirname, '..');
const manifestPath = path.join(experimentRoot, 'generated', 'manifest-calibrated-z1.json');
const outputPath = path.join(experimentRoot, 'generated', 'CALIBRATED-Z1-CASE-LIST.md');
const cases = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

const lines = [
  '# Calibrated Z1 CSC case list',
  '',
  'Execution order is top to bottom. Every row points to one authoritative, inspectable CSC file.',
  '',
  `Total: ${cases.length} cases (18 profiles × 2 RX sensitivity assumptions × 6 distances).`,
  '',
  '| # | Case ID | Profile | d (m) | TR (m) | RX (dBm) | sigma (dB) | Candidate? | Case source domain | TR source domain | CSC |',
  '|---:|---|---|---:|---:|---:|---:|:---:|---|---|---|'
];

cases.forEach((item, index) => {
  const candidate = item.distanceM < item.transmittingRangeM ? 'yes' : 'no';
  const link = path.basename(item.cscPath);
  lines.push(
    `| ${index + 1} | \`${item.caseId}\` | ${item.label} | ${item.distanceM} | ${item.transmittingRangeM} | ${item.rxSensitivityDbm} | ${item.awgnSigmaDb} | ${candidate} | ${item.sourceDomainStatus} | ${item.transmittingRangeDomainStatus} | [${link}](calibrated-z1/${link}) |`);
});

fs.writeFileSync(outputPath, `${lines.join('\n')}\n`);
console.log(`CATALOG_OK cases=${cases.length} output=${outputPath}`);

