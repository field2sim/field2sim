'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync, spawn } = require('node:child_process');
const { parseMeasurements, writeCsv } = require('./run-experiments.js');

// Copy of run-calibrated-sequential.js for the fixed-range-z1 suite (writes only fixed-range-z1 paths).
const SUITE = 'fixed-range-z1';
const EXPECTED = 540;
const experimentRoot = path.resolve(__dirname, '..');
const repositoryRoot = path.resolve(experimentRoot, '..', '..');
const protocol = JSON.parse(fs.readFileSync(path.join(experimentRoot, 'protocol.json'), 'utf8'));
const pinned = JSON.parse(fs.readFileSync(path.join(repositoryRoot, 'integrations', 'toolchains.json'), 'utf8'));

function option(name, fallback = '') {
  const prefix = `--${name}=`;
  const argument = process.argv.find(value => value.startsWith(prefix));
  return argument ? argument.slice(prefix.length) : fallback;
}

function revision(directory) {
  return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: directory, encoding: 'utf8' }).trim();
}

function compilerVersion() {
  return execFileSync('msp430-gcc', ['--version'], { encoding: 'utf8' }).split('\n')[0];
}

function caseState(item) {
  const filename = path.join(
    experimentRoot, 'results', 'runtime', SUITE, 'cases', `${item.caseId}.log`);
  const text = fs.existsSync(filename) ? fs.readFileSync(filename, 'utf8') : '';
  return parseMeasurements(text, [item]).get(item.caseId);
}

function writeCaseCsv(item, state) {
  const common = {
    case_id: item.caseId,
    suite: item.suite,
    profile_id: item.profileId,
    family: item.family,
    label: item.label,
    path_loss_exponent: item.pathLossExponent,
    transmitting_range_m: item.transmittingRangeM,
    rx_sensitivity_dbm: item.rxSensitivityDbm,
    rssi_inflection_point_dbm: item.rssiInflectionPointDbm,
    awgn_sigma_db: item.awgnSigmaDb,
    distance_m: item.distanceM,
    random_seed: item.randomSeed
  };
  const rows = [];
  for (let index = 0; index < state.sent; index += 1) {
    rows.push({ ...common, event_index: index, event: 'tx', rssi_dbm: null });
  }
  state.rssi.forEach((rssi, index) => {
    rows.push({ ...common, event_index: index, event: 'rx', rssi_dbm: rssi });
  });
  writeCsv(path.join(
    experimentRoot, 'results', 'raw', SUITE, `${item.caseId}.csv`), rows);
}

async function main() {
  const contikiRoot = path.resolve(process.env.CONTIKI_NG || '');
  if (!process.env.CONTIKI_NG) throw new Error('Set CONTIKI_NG to the pinned Contiki-NG checkout.');

  const manifestPath = path.join(experimentRoot, 'generated', `manifest-${SUITE}.json`);
  if (!fs.existsSync(manifestPath)) throw new Error('Generate and inspect calibrated-z1 CSC files first.');
  const allCases = JSON.parse(fs.readFileSync(manifestPath, 'utf8')).cases;
  if (allCases.length !== EXPECTED) throw new Error(`Expected ${EXPECTED} cases, found ${allCases.length}`);

  const inspectionPath = path.join(experimentRoot, 'generated', `inspection-${SUITE}.json`);
  if (!fs.existsSync(inspectionPath)) throw new Error('Inspect and hash the calibrated CSC files first.');
  const inspection = JSON.parse(fs.readFileSync(inspectionPath, 'utf8'));
  const inspectedHashes = new Map(inspection.files.map(item => [item.caseId, item.sha256]));
  if (inspection.caseCount !== EXPECTED) throw new Error('The inspection report is incomplete.');

  const requestedCase = option('case');
  const from = Number(option('from', '1'));
  const limitText = option('limit');
  const limit = limitText ? Number(limitText) : null;
  let cases = requestedCase
    ? allCases.filter(item => item.caseId === requestedCase)
    : allCases.slice(from - 1, limit ? from - 1 + limit : undefined);
  if (!cases.length) throw new Error('No cases selected.');
  if (!Number.isInteger(from) || from < 1 || (limit !== null && (!Number.isInteger(limit) || limit < 1))) {
    throw new Error('Use positive integer --from and --limit values.');
  }

  const tag = option('tag', requestedCase ? 'single' : `from${from}${limit ? `-n${limit}` : ''}`);
  for (const item of cases) {
    const cscPath = path.join(experimentRoot, item.cscPath);
    const text = fs.readFileSync(cscPath, 'utf8');
    if (!text.includes(`Case ID: ${item.caseId}`) || text.includes('Enter notes here')) {
      throw new Error(`CSC inspection metadata missing: ${item.cscPath}`);
    }
    const actualHash = crypto.createHash('sha256').update(text).digest('hex');
    if (actualHash !== inspectedHashes.get(item.caseId)) {
      throw new Error(`CSC changed after inspection: ${item.cscPath}`);
    }
  }

  const coojaRoot = path.join(contikiRoot, 'tools', 'cooja');
  const actualContikiRevision = revision(contikiRoot);
  const actualCoojaRevision = revision(coojaRoot);
  if (actualContikiRevision !== pinned.cooja.contikiNgRevision ||
      actualCoojaRevision !== pinned.cooja.coojaRevision) {
    throw new Error('Pinned Contiki-NG/Cooja revision mismatch.');
  }

  const firmwareRoot = path.join(experimentRoot, 'baseline');
  console.log(`RUN_PLAN cases=${cases.length} from=${from} compiler="${compilerVersion()}"`);
  execFileSync('make', ['TARGET=z1', `CONTIKI=${contikiRoot}`, 'clean'], {
    cwd: firmwareRoot, stdio: 'inherit'
  });
  execFileSync('make', ['-j2', 'udp-client.z1', 'udp-server.z1', 'TARGET=z1',
    `CONTIKI=${contikiRoot}`], { cwd: firmwareRoot, stdio: 'inherit' });

  const runtimeRoot = path.join(experimentRoot, 'results', 'runtime', SUITE);
  fs.mkdirSync(path.join(runtimeRoot, 'cases'), { recursive: true });
  const logPath = path.join(experimentRoot, 'results', `cooja-${SUITE}-${tag}.log`);
  const logStream = fs.createWriteStream(logPath);
  const cscPaths = cases.map(item => path.join(experimentRoot, item.cscPath));
  const args = ['--no-daemon', 'run',
    `--args=--no-gui --no-log-color --logdir=${runtimeRoot} --contiki=${contikiRoot} ${cscPaths.join(' ')}`];

  const startedAt = new Date().toISOString();
  let current = null;
  let currentIndex = -1;
  const reports = [];
  const byFilename = new Map(cases.map((item, index) => [
    path.basename(item.cscPath), { item, index }
  ]));

  function finishCurrent() {
    if (!current) return;
    const state = caseState(current);
    writeCaseCsv(current, state);
    reports.push({
      caseId: current.caseId,
      completed: state.completed,
      sent: state.sent,
      received: state.rssi.length,
      receptionRatio: state.sent ? state.rssi.length / state.sent : null
    });
    console.log(
      `CASE_RESULT ${currentIndex + 1}/${cases.length} id=${current.caseId} completed=${state.completed} sent=${state.sent} received=${state.rssi.length} prr=${state.sent ? (state.rssi.length / state.sent).toFixed(4) : 'NA'}`);
    current = null;
  }

  function consume(line) {
    logStream.write(`${line}\n`);
    const match = line.match(/Loading (.+\.csc)(?:\s|$)/);
    if (!match) return;
    const entry = byFilename.get(path.basename(match[1]));
    if (!entry) return;
    finishCurrent();
    current = entry.item;
    currentIndex = entry.index;
    console.log(
      `CASE_START ${entry.index + 1}/${cases.length} id=${current.caseId} profile=${current.profileId} distance=${current.distanceM}m tr=${current.transmittingRangeM}m rx=${current.rxSensitivityDbm}dBm seed=${current.randomSeed} sigma=${current.awgnSigmaDb}dB domain="${current.sourceDomainStatus}"`);
  }

  function streamLines(stream) {
    let pending = '';
    stream.setEncoding('utf8');
    stream.on('data', chunk => {
      pending += chunk;
      const lines = pending.split(/\r?\n/);
      pending = lines.pop();
      lines.forEach(consume);
    });
    stream.on('end', () => {
      if (pending) consume(pending);
    });
  }

  const child = spawn(path.join(coojaRoot, 'gradlew'), args, {
    cwd: coojaRoot,
    env: { ...process.env, CONTIKI: contikiRoot, CI: 'true' }
  });
  streamLines(child.stdout);
  streamLines(child.stderr);

  const exit = await new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('close', (code, signal) => resolve({ code, signal }));
  });
  finishCurrent();
  logStream.end();

  const report = {
    schemaVersion: 2,
    platform: protocol.platform,
    suite: SUITE,
    requestedFrom: from,
    requestedLimit: limit,
    startedAt,
    finishedAt: new Date().toISOString(),
    exitStatus: exit.code,
    signal: exit.signal,
    toolchain: {
      contikiNgRevision: actualContikiRevision,
      coojaRevision: actualCoojaRevision,
      compiler: compilerVersion()
    },
    cases: reports,
    logPath: path.relative(experimentRoot, logPath),
    measurementLogPath: path.relative(experimentRoot, path.join(runtimeRoot, 'cases'))
  };
  const reportPath = path.join(experimentRoot, 'results', `run-report-${SUITE}-${tag}.json`);
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

  const invalid = reports.filter(item => !item.completed || item.sent === 0);
  if (exit.code !== 0 || reports.length !== cases.length || invalid.length) {
    throw new Error(`Incomplete calibrated run: exit=${exit.code}, reports=${reports.length}, invalid=${invalid.length}`);
  }
  console.log(`RUN_COMPLETE cases=${reports.length} report=${reportPath}`);
}

if (require.main === module) {
  main().catch(error => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}

