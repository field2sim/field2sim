'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const experimentRoot = path.resolve(__dirname, '..');
// Copy of inspect-calibrated-cases.js for the fixed-range-z1 suite.
const SUITE = 'fixed-range-z1';
const EXPECTED = 540;
const manifestPath = path.join(experimentRoot, 'generated', `manifest-${SUITE}.json`);
const reportPath = path.join(experimentRoot, 'generated', `inspection-${SUITE}.json`);

function one(text, pattern, label, caseId) {
  const matches = Array.from(text.matchAll(pattern));
  if (matches.length !== 1) throw new Error(`${caseId}: expected one ${label}, found ${matches.length}`);
  return matches[0][1];
}

function close(actual, expected, label, caseId) {
  if (Math.abs(Number(actual) - Number(expected)) > 1e-6) {
    throw new Error(`${caseId}: ${label}=${actual}, expected ${expected}`);
  }
}

function main() {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')).cases;
  if (manifest.length !== EXPECTED) throw new Error(`Expected ${EXPECTED} cases, found ${manifest.length}`);
  if (new Set(manifest.map(item => item.caseId)).size !== manifest.length) {
    throw new Error('Duplicate calibrated case IDs.');
  }

  const files = [];
  for (const item of manifest) {
    const filename = path.resolve(experimentRoot, item.cscPath);
    if (!filename.startsWith(path.join(experimentRoot, 'generated', SUITE) + path.sep)) {
      throw new Error(`Case path escapes calibrated suite: ${item.cscPath}`);
    }
    const text = fs.readFileSync(filename, 'utf8');
    if (!text.startsWith('<?xml') || !text.trimEnd().endsWith('</simconf>')) {
      throw new Error(`${item.caseId}: incomplete XML document`);
    }
    if (text.includes('Enter notes here')) throw new Error(`${item.caseId}: placeholder Notes remain`);
    one(text, /<notes>([\s\S]*?)<\/notes>/g, 'Notes block', item.caseId);
    one(text, /<radiomedium>([\s\S]*?)<\/radiomedium>/g, 'radio medium', item.caseId);
    if (!text.includes(`Case ID: ${item.caseId}`) ||
        !text.includes(`CASE_DONE case=${item.caseId}`)) {
      throw new Error(`${item.caseId}: case identity missing from Notes or ScriptRunner`);
    }
    close(one(text, /<transmitting_range>([^<]+)<\/transmitting_range>/g,
      'transmitting_range', item.caseId), item.transmittingRangeM, 'transmitting_range', item.caseId);
    close(one(text, /<rx_sensitivity>([^<]+)<\/rx_sensitivity>/g,
      'rx_sensitivity', item.caseId), item.rxSensitivityDbm, 'rx_sensitivity', item.caseId);
    close(one(text, /<path_loss_exponent>([^<]+)<\/path_loss_exponent>/g,
      'path_loss_exponent', item.caseId), item.pathLossExponent, 'path_loss_exponent', item.caseId);
    close(one(text, /<awgn_sigma>([^<]+)<\/awgn_sigma>/g,
      'awgn_sigma', item.caseId), item.awgnSigmaDb, 'awgn_sigma', item.caseId);
    close(one(text, /<randomseed>([^<]+)<\/randomseed>/g, 'randomseed', item.caseId), item.randomSeed, 'randomseed', item.caseId);
    const positions = Array.from(text.matchAll(/<pos\s+x="([^"]+)"\s+y="([^"]+)"\s*\/>/g));
    if (positions.length !== 2) throw new Error(`${item.caseId}: expected two positions`);
    const dx = Number(positions[1][1]) - Number(positions[0][1]);
    const dy = Number(positions[1][2]) - Number(positions[0][2]);
    close(Math.hypot(dx, dy), item.distanceM, 'Tx-Rx distance', item.caseId);
    files.push({
      caseId: item.caseId,
      cscPath: item.cscPath,
      sha256: crypto.createHash('sha256').update(text).digest('hex')
    });
  }

  const report = {
    schemaVersion: 1,
    suite: SUITE,
    inspectedAt: new Date().toISOString(),
    caseCount: files.length,
    checks: [
      'unique case IDs and confined CSC paths',
      'complete simconf envelope',
      'single non-placeholder Notes and radiomedium blocks',
      'case identity in Notes and ScriptRunner',
      'manifest-equal transmitting range, RX sensitivity, exponent, and AWGN sigma',
      'two mote positions at the declared distance',
      'manifest-equal per-case random seed',
      'SHA-256 freeze before execution'
    ],
    files
  };
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`INSPECTION_OK cases=${files.length} report=${reportPath}`);
}

if (require.main === module) main();

