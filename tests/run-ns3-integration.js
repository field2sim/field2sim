'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'integrations/toolchains.json'), 'utf8'));
const requireToolchain = process.argv.includes('--require-toolchain');
const ns3Root = process.env.NS3_ROOT ? path.resolve(process.env.NS3_ROOT) : null;
const resultsDir = path.join(root, 'integrations/results');
const reportPath = path.join(resultsDir, 'ns3-integration-report.json');
const programPath = path.join(root, manifest.ns3.executionProgram);
const tolerance = 1e-6;

const scenarios = [
  {
    id: 'mobile',
    tracePath: path.join(root, 'integrations/ns3/mobile/mobility-ns3.tcl'),
    expectedCheckCount: 8
  },
  {
    id: 'static',
    tracePath: path.join(root, 'integrations/ns3/static/mobility-ns3.tcl'),
    expectedCheckCount: 3
  }
];

function finish(status, message, code) {
  console.log(`[${status}] ns3: ${message}`);
  process.exitCode = code;
}

function sha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function execute(args, timeout = 600000) {
  return spawnSync('./ns3', args, {
    cwd: ns3Root,
    encoding: 'utf8',
    timeout,
    maxBuffer: 32 * 1024 * 1024,
    env: { ...process.env, CI: '1' }
  });
}

function processSummary(result) {
  return {
    exitCode: result.status,
    signal: result.signal,
    timedOut: Boolean(result.error && result.error.code === 'ETIMEDOUT')
  };
}

function parseCheckLine(line) {
  const fields = {};
  for (const token of line.trim().split(/\s+/).slice(1)) {
    const separator = token.indexOf('=');
    if (separator === -1) continue;
    fields[token.slice(0, separator)] = token.slice(separator + 1);
  }
  for (const key of [
    'node', 'time_s', 'expected_x', 'expected_y', 'expected_z',
    'actual_x', 'actual_y', 'actual_z', 'error_m'
  ]) {
    if (key in fields) fields[key] = Number(fields[key]);
  }
  return fields;
}

function executeScenario(scenario) {
  const relativeTracePath = path.relative(root, scenario.tracePath);
  const command = [
    'run',
    `field2sim-ns3 --traceFile=${scenario.tracePath} --scenario=${scenario.id} --tolerance=${tolerance}`
  ];
  const result = execute(command, 120000);
  const output = `${result.stdout || ''}\n${result.stderr || ''}`;
  const checkLines = output.split(/\r?\n/).filter(line => line.startsWith('NS3_CHECK '));
  const checks = checkLines.map(parseCheckLine);
  const resultLine = output.split(/\r?\n/).find(line => line.startsWith('NS3_RESULT ')) || null;
  const maximumPositionErrorMeters = checks.length
    ? Math.max(...checks.map(check => check.error_m).filter(Number.isFinite))
    : null;
  const passed =
    result.status === 0 &&
    checks.length === scenario.expectedCheckCount &&
    checks.every(check => check.status === 'PASS' && check.error_m <= tolerance) &&
    Boolean(resultLine && resultLine.includes('status=PASS'));

  return {
    scenario: scenario.id,
    status: passed ? 'PASS' : 'FAIL',
    command: `./ns3 run "field2sim-ns3 --traceFile=<repository>/${relativeTracePath} --scenario=${scenario.id} --tolerance=${tolerance}"`,
    trace: {
      path: relativeTracePath,
      sha256: sha256(scenario.tracePath)
    },
    observations: {
      expectedCheckCount: scenario.expectedCheckCount,
      observedCheckCount: checks.length,
      maximumPositionErrorMeters,
      checks,
      resultLine
    },
    process: processSummary(result),
    diagnosticOutput: passed ? undefined : output.trim()
  };
}

if (!ns3Root) {
  finish(
    'SKIP',
    'NS3_ROOT is not set; point it to the pinned ns-3 checkout to execute Ns2MobilityHelper.',
    requireToolchain ? 2 : 0
  );
} else {
  const wrapperPath = path.join(ns3Root, 'ns3');
  const versionPath = path.join(ns3Root, 'VERSION');
  const scratchDir = path.join(ns3Root, 'scratch');
  const scratchProgramPath = path.join(scratchDir, 'field2sim-ns3.cc');

  if (!fs.existsSync(wrapperPath) || !fs.existsSync(versionPath) || !fs.existsSync(scratchDir)) {
    finish('SKIP', 'NS3_ROOT is not an ns-3 source tree.', requireToolchain ? 2 : 0);
  } else {
    const actualVersion = fs.readFileSync(versionPath, 'utf8').trim();
    if (actualVersion !== manifest.ns3.release) {
      finish('FAIL', `Expected ns-${manifest.ns3.release}, found ns-${actualVersion}.`, 1);
    } else {
      fs.copyFileSync(programPath, scratchProgramPath);
      const startedAt = new Date().toISOString();
      const configure = execute([
        'configure',
        '--build-profile=optimized',
        '--disable-examples',
        '--disable-tests',
        '--enable-modules=core;network;mobility'
      ]);
      const build = configure.status === 0
        ? execute(['build', 'field2sim-ns3'])
        : { status: null, signal: null, error: null, stdout: '', stderr: '' };
      const executions = build.status === 0 ? scenarios.map(executeScenario) : [];
      const passed =
        configure.status === 0 &&
        build.status === 0 &&
        executions.length === scenarios.length &&
        executions.every(execution => execution.status === 'PASS');
      const errors = executions
        .map(execution => execution.observations.maximumPositionErrorMeters)
        .filter(Number.isFinite);
      const report = {
        schemaVersion: 1,
        status: passed ? 'PASS' : 'FAIL',
        startedAt,
        completedAt: new Date().toISOString(),
        toolchain: {
          release: actualVersion,
          archiveUrl: manifest.ns3.archiveUrl,
          archiveSha1: manifest.ns3.archiveSha1,
          requiredParser: manifest.ns3.requiredParser
        },
        verifier: {
          path: path.relative(root, programPath),
          sha256: sha256(programPath),
          toleranceMeters: tolerance
        },
        build: {
          configureCommand: './ns3 configure --build-profile=optimized --disable-examples --disable-tests --enable-modules="core;network;mobility"',
          configure: processSummary(configure),
          buildCommand: './ns3 build field2sim-ns3',
          build: processSummary(build),
          diagnosticOutput: passed
            ? undefined
            : `${configure.stdout || ''}\n${configure.stderr || ''}\n${build.stdout || ''}\n${build.stderr || ''}`.trim()
        },
        observations: {
          scenarioCount: executions.length,
          checkpointCount: executions.reduce(
            (sum, execution) => sum + execution.observations.observedCheckCount,
            0
          ),
          maximumPositionErrorMeters: errors.length ? Math.max(...errors) : null,
          executions
        }
      };

      fs.mkdirSync(resultsDir, { recursive: true });
      fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

      if (passed) {
        finish(
          'PASS',
          `real Ns2MobilityHelper execution passed; report: ${path.relative(root, reportPath)}`,
          0
        );
      } else {
        console.error(report.build.diagnosticOutput || executions.map(item => item.diagnosticOutput).join('\n'));
        finish('FAIL', `ns-3 execution failed; report: ${path.relative(root, reportPath)}`, 1);
      }
    }
  }
}
