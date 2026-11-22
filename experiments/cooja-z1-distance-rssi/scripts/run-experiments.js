'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');
const { generateCases } = require('./generate-cases.js');

const experimentRoot = path.resolve(__dirname, '..');
const repositoryRoot = path.resolve(experimentRoot, '..', '..');
const protocol = JSON.parse(fs.readFileSync(path.join(experimentRoot, 'protocol.json'), 'utf8'));
const pinned = JSON.parse(fs.readFileSync(path.join(repositoryRoot, 'integrations', 'toolchains.json'), 'utf8'));

function option(name, fallback) {
  const prefix = `--${name}=`;
  const argument = process.argv.find(value => value.startsWith(prefix));
  return argument ? argument.slice(prefix.length) : fallback;
}

function revision(directory) {
  return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: directory, encoding: 'utf8' }).trim();
}

function compilerVersion() {
  try {
    return execFileSync('msp430-gcc', ['--version'], { encoding: 'utf8' }).split('\n')[0];
  } catch (error) {
    return `unavailable: ${error.message}`;
  }
}

function csv(value) {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function writeCsv(filename, rows) {
  const columns = [
    'case_id', 'suite', 'profile_id', 'family', 'label', 'path_loss_exponent',
    'transmitting_range_m', 'rx_sensitivity_dbm', 'rssi_inflection_point_dbm',
    'awgn_sigma_db', 'distance_m', 'random_seed', 'event_index', 'event', 'rssi_dbm'
  ];
  const contents = [columns.join(','), ...rows.map(row => columns.map(column => csv(row[column])).join(','))].join('\n');
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  fs.writeFileSync(filename, `${contents}\n`);
}

function parseMeasurements(output, cases) {
  const states = new Map(cases.map(item => [item.caseId, { sent: 0, rssi: [], completed: false }]));
  const measurement = /MEAS case=(\S+) mote=(\d+) (.*)$/;
  const completion = /CASE_DONE case=(\S+)/;

  for (const line of output.split(/\r?\n/)) {
    const sample = line.match(measurement);
    if (sample && states.has(sample[1])) {
      const state = states.get(sample[1]);
      const moteId = Number(sample[2]);
      const message = sample[3];
      if (moteId === protocol.senderMoteId && message.includes('Sending fixed request')) state.sent += 1;
      const rssiMatch = message.match(/RSSI=(-?\d+) dBm/);
      if (moteId === protocol.receiverMoteId && rssiMatch) state.rssi.push(Number(rssiMatch[1]));
    }
    const done = line.match(completion);
    if (done && states.has(done[1])) states.get(done[1]).completed = true;
  }
  return states;
}

function main() {
  const suite = option('suite', 'main');
  const limitText = option('limit', '');
  const limit = limitText ? Number(limitText) : null;
  if (!['main', 'sensitivity', 'all'].includes(suite)) throw new Error(`Invalid suite: ${suite}`);
  if (limit !== null && (!Number.isInteger(limit) || limit < 1)) throw new Error(`Invalid limit: ${limitText}`);

  const contikiRoot = path.resolve(process.env.CONTIKI_NG || '');
  if (!process.env.CONTIKI_NG) throw new Error('Set CONTIKI_NG to the pinned Contiki-NG checkout.');
  const coojaRoot = path.join(contikiRoot, 'tools', 'cooja');
  const gradlew = path.join(coojaRoot, 'gradlew');
  if (!fs.existsSync(gradlew)) throw new Error(`Cooja Gradle wrapper not found: ${gradlew}`);

  const actualContikiRevision = revision(contikiRoot);
  const actualCoojaRevision = revision(coojaRoot);
  if (actualContikiRevision !== pinned.cooja.contikiNgRevision) {
    throw new Error(`Contiki-NG revision mismatch: ${actualContikiRevision}`);
  }
  if (actualCoojaRevision !== pinned.cooja.coojaRevision) {
    throw new Error(`Cooja revision mismatch: ${actualCoojaRevision}`);
  }

  const tag = `${suite}${limit ? `-limit${limit}` : ''}`;
  const runtimeRoot = path.join(experimentRoot, 'results', 'runtime', tag);
  const measurementRoot = path.join(runtimeRoot, 'cases');
  fs.mkdirSync(measurementRoot, { recursive: true });
  const previousMeasurementRoot = process.env.CASE_MEASUREMENT_ROOT;
  process.env.CASE_MEASUREMENT_ROOT = measurementRoot;
  const generated = generateCases(suite);
  if (previousMeasurementRoot === undefined) delete process.env.CASE_MEASUREMENT_ROOT;
  else process.env.CASE_MEASUREMENT_ROOT = previousMeasurementRoot;
  const cases = limit === null ? generated.cases : generated.cases.slice(0, limit);
  const firmwareRoot = process.env.EXPERIMENT_FIRMWARE_ROOT
    ? path.resolve(process.env.EXPERIMENT_FIRMWARE_ROOT)
    : path.join(experimentRoot, 'baseline');
  console.log(`Compiling Z1 firmware with ${compilerVersion()}`);
  execFileSync('make', ['TARGET=z1', `CONTIKI=${contikiRoot}`, 'clean'], {
    cwd: firmwareRoot,
    stdio: 'inherit'
  });
  execFileSync('make', ['-j2', 'udp-client.z1', 'udp-server.z1', 'TARGET=z1', `CONTIKI=${contikiRoot}`], {
    cwd: firmwareRoot,
    stdio: 'inherit'
  });

  const cscPaths = cases.map(item => path.join(experimentRoot, item.cscPath));
  const coojaArguments = [
    '--no-daemon', 'run',
    `--args=--no-gui --no-log-color --logdir=${runtimeRoot} --contiki=${contikiRoot} ${cscPaths.join(' ')}`
  ];
  console.log(`Running ${cases.length} Z1 Cooja case(s) from the ${suite} suite...`);
  const startedAt = new Date().toISOString();
  const result = spawnSync(gradlew, coojaArguments, {
    cwd: coojaRoot,
    env: { ...process.env, CONTIKI: contikiRoot, CI: 'true' },
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
    timeout: suite === 'main' && limit === null ? 45 * 60 * 1000 : 20 * 60 * 1000
  });
  const output = `${result.stdout || ''}${result.stderr || ''}`;
  const logPath = path.join(experimentRoot, 'results', `cooja-${tag}.log`);
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  fs.writeFileSync(logPath, output);

  const measurementFiles = cases.map(item => path.join(measurementRoot, `${item.caseId}.log`));
  const measurementOutput = measurementFiles
    .filter(filename => fs.existsSync(filename))
    .map(filename => fs.readFileSync(filename, 'utf8'))
    .join('\n');
  const states = parseMeasurements(measurementOutput, cases);
  const caseReports = [];
  for (const item of cases) {
    const state = states.get(item.caseId);
    const common = {
      case_id: item.caseId,
      suite: item.suite,
      profile_id: item.profileId,
      family: item.family,
      label: item.label,
      path_loss_exponent: item.pathLossExponent,
      transmitting_range_m: item.transmittingRangeM,
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
    writeCsv(path.join(experimentRoot, 'results', 'raw', item.suite, `${item.caseId}.csv`), rows);
    caseReports.push({
      caseId: item.caseId,
      completed: state.completed,
      sent: state.sent,
      received: state.rssi.length,
      receptionRatio: state.sent ? state.rssi.length / state.sent : null
    });
  }

  const report = {
    schemaVersion: 1,
    platform: protocol.platform,
    suite,
    limit,
    startedAt,
    finishedAt: new Date().toISOString(),
    exitStatus: result.status,
    signal: result.signal,
    error: result.error ? result.error.message : null,
    toolchain: {
      contikiNgRevision: actualContikiRevision,
      coojaRevision: actualCoojaRevision,
      compiler: compilerVersion()
    },
    cases: caseReports,
    logPath: path.relative(experimentRoot, logPath),
    measurementLogPath: path.relative(experimentRoot, measurementRoot)
  };
  const reportPath = path.join(experimentRoot, 'results', `run-report-${tag}.json`);
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

  const invalid = caseReports.filter(item => !item.completed || item.sent === 0);
  if (result.status !== 0 || result.error || invalid.length) {
    throw new Error(`Cooja run failed or produced incomplete cases; inspect ${logPath} and ${reportPath}`);
  }
  console.log(`Completed ${cases.length} case(s); report: ${reportPath}`);
}

if (require.main === module) main();

module.exports = Object.freeze({ parseMeasurements, writeCsv });
