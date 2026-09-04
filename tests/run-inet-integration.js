'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'integrations/toolchains.json'), 'utf8'));
const requireToolchain = process.argv.includes('--require-toolchain');
const omnetppRoot = process.env.OMNETPP_ROOT ? path.resolve(process.env.OMNETPP_ROOT) : null;
const inetRoot = process.env.INET_ROOT ? path.resolve(process.env.INET_ROOT) : null;
const resultsDir = path.join(root, 'integrations/results');
const reportPath = path.join(resultsDir, 'inet-integration-report.json');
const verifierDir = path.join(root, 'integrations/inet/verifier');
const verifierSource = path.join(root, manifest.inet.executionProgram);
const tolerance = 1e-6;

const scenarios = [
  {
    id: 'mobile',
    config: 'Mobile',
    tracePath: path.join(root, 'integrations/inet/mobile/mobility-bonnmotion.movements'),
    expectedCheckCount: 8
  },
  {
    id: 'static',
    config: 'Static',
    tracePath: path.join(root, 'integrations/inet/static/mobility-bonnmotion.movements'),
    expectedCheckCount: 3
  }
];

function finish(status, message, code) {
  console.log(`[${status}] inet: ${message}`);
  process.exitCode = code;
}

function sha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function revision(directory) {
  const result = spawnSync('git', ['-C', directory, 'rev-parse', 'HEAD'], { encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trim() : null;
}

function toolchainEnvironment() {
  const paths = [path.join(omnetppRoot, 'bin'), path.join(inetRoot, 'bin'), process.env.PATH];
  const libraries = [
    path.join(omnetppRoot, 'lib'),
    path.join(inetRoot, 'src'),
    process.env.LD_LIBRARY_PATH
  ].filter(Boolean);
  return {
    ...process.env,
    PATH: paths.filter(Boolean).join(path.delimiter),
    LD_LIBRARY_PATH: libraries.join(path.delimiter),
    INET_ROOT: inetRoot,
    CI: '1'
  };
}

function execute(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: options.cwd || root,
    encoding: 'utf8',
    timeout: options.timeout || 180000,
    maxBuffer: 32 * 1024 * 1024,
    env: toolchainEnvironment()
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

function enabledInetFeatures() {
  const result = execute(path.join(omnetppRoot, 'bin', 'opp_featuretool'), ['list'], { cwd: inetRoot });
  if (result.status !== 0) return [];
  return result.stdout
    .split(/\r?\n/)
    .map(line => line.match(/^\s*\+\s+(.+?)\s*$/))
    .filter(Boolean)
    .map(match => match[1]);
}

function executeScenario(scenario, verifierLibrary, buildDir) {
  const exclusionsPath = path.join(inetRoot, '.nedexclusions');
  const exclusions = fs.existsSync(exclusionsPath)
    ? fs.readFileSync(exclusionsPath, 'utf8').trim().split(/\r?\n/).filter(Boolean).join(';')
    : '';
  const nedPath = [verifierDir, path.join(inetRoot, 'src')].join(path.delimiter);
  const args = [
    '-u', 'Cmdenv',
    '-l', path.join(inetRoot, 'src', 'INET'),
    '-l', verifierLibrary,
    '-n', nedPath
  ];
  if (exclusions) args.push('-x', exclusions);
  args.push(
    `--image-path=${path.join(inetRoot, 'images')}`,
    '-f', path.join(verifierDir, 'omnetpp.ini'),
    '-c', scenario.config,
    `--*.host[*].traceFile="${scenario.tracePath}"`,
    `--*.verifier.tolerance=${tolerance}m`,
    `--result-dir=${path.join(buildDir, `results-${scenario.id}`)}`
  );

  const result = execute(path.join(omnetppRoot, 'bin', 'opp_run_release'), args, {
    cwd: verifierDir,
    timeout: 120000
  });
  const output = `${result.stdout || ''}\n${result.stderr || ''}`;
  const checkLines = output.split(/\r?\n/).filter(line => line.startsWith('INET_CHECK '));
  const checks = checkLines.map(parseCheckLine);
  const resultLine = output.split(/\r?\n/).find(line => line.startsWith('INET_RESULT ')) || null;
  const errors = checks.map(check => check.error_m).filter(Number.isFinite);
  const maximumPositionErrorMeters = errors.length ? Math.max(...errors) : null;
  const passed =
    result.status === 0 &&
    checks.length === scenario.expectedCheckCount &&
    checks.every(check => check.status === 'PASS' && check.error_m <= tolerance) &&
    Boolean(resultLine && resultLine.includes('status=PASS'));
  const relativeTracePath = path.relative(root, scenario.tracePath);

  return {
    scenario: scenario.id,
    status: passed ? 'PASS' : 'FAIL',
    command:
      `opp_run_release -u Cmdenv -l <inet>/src/INET -l <verifier> ` +
      `-c ${scenario.config} --*.host[*].traceFile=<repository>/${relativeTracePath}`,
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

if (!omnetppRoot || !inetRoot) {
  finish(
    'SKIP',
    'OMNETPP_ROOT and INET_ROOT must point to the pinned source trees.',
    requireToolchain ? 2 : 0
  );
} else {
  const omnetppVersionPath = path.join(omnetppRoot, 'Version');
  const oppRunPath = path.join(omnetppRoot, 'bin', 'opp_run_release');
  const inetLibraryPath = path.join(inetRoot, 'src', 'libINET.so');
  const moduleSourcePath = path.join(inetRoot, manifest.inet.moduleSourcePath);
  const moduleNedPath = path.join(inetRoot, manifest.inet.moduleNedPath);

  if (
    !fs.existsSync(omnetppVersionPath) ||
    !fs.existsSync(oppRunPath) ||
    !fs.existsSync(inetLibraryPath) ||
    !fs.existsSync(moduleSourcePath) ||
    !fs.existsSync(moduleNedPath)
  ) {
    finish('SKIP', 'The requested source trees are not built OMNeT++/INET installations.', requireToolchain ? 2 : 0);
  } else {
    const actual = {
      omnetppRelease: fs.readFileSync(omnetppVersionPath, 'utf8').trim().replace(/^omnetpp-/, ''),
      omnetppRevision: revision(omnetppRoot),
      inetRevision: revision(inetRoot),
      moduleSourceSha256: sha256(moduleSourcePath),
      moduleNedSha256: sha256(moduleNedPath)
    };
    const toolchainMatches =
      actual.omnetppRelease === manifest.inet.omnetppRelease &&
      actual.omnetppRevision === manifest.inet.omnetppRevision &&
      actual.inetRevision === manifest.inet.inetRevision &&
      actual.moduleSourceSha256 === manifest.inet.moduleSourceSha256 &&
      actual.moduleNedSha256 === manifest.inet.moduleNedSha256;

    if (!toolchainMatches) {
      finish('FAIL', `Toolchain mismatch: ${JSON.stringify(actual)}.`, 1);
    } else {
      const buildDir = fs.mkdtempSync(path.join(os.tmpdir(), 'field2sim-inet-verifier-'));
      fs.copyFileSync(verifierSource, path.join(buildDir, 'PositionVerifier.cc'));
      const startedAt = new Date().toISOString();
      const makemake = execute(path.join(omnetppRoot, 'bin', 'opp_makemake'), [
        '--make-so',
        '-f',
        '-o', 'field2sim_inet',
        `-I${path.join(inetRoot, 'src')}`,
        `-L${path.join(inetRoot, 'src')}`,
        '-lINET'
      ], { cwd: buildDir });
      const build = makemake.status === 0
        ? execute('make', ['-j4', 'MODE=release'], { cwd: buildDir, timeout: 300000 })
        : { status: null, signal: null, error: null, stdout: '', stderr: '' };
      const verifierLibrary = path.join(buildDir, 'field2sim_inet');
      const executions = build.status === 0
        ? scenarios.map(scenario => executeScenario(scenario, verifierLibrary, buildDir))
        : [];
      const passed =
        makemake.status === 0 &&
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
          ...actual,
          inetRelease: manifest.inet.inetRelease,
          requiredModule: manifest.inet.requiredModule,
          enabledInetFeatures: enabledInetFeatures()
        },
        verifier: {
          path: path.relative(root, verifierSource),
          sha256: sha256(verifierSource),
          toleranceMeters: tolerance
        },
        build: {
          makemakeCommand: 'opp_makemake --make-so -f -o field2sim_inet -I<inet>/src -L<inet>/src -lINET',
          makemake: processSummary(makemake),
          buildCommand: 'make -j4 MODE=release',
          build: processSummary(build),
          diagnosticOutput: makemake.status === 0 && build.status === 0
            ? undefined
            : `${makemake.stdout || ''}\n${makemake.stderr || ''}\n${build.stdout || ''}\n${build.stderr || ''}`.trim()
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
          `real BonnMotionMobility execution passed; report: ${path.relative(root, reportPath)}`,
          0
        );
      } else {
        console.error(report.build.diagnosticOutput || executions.map(item => item.diagnosticOutput).join('\n'));
        finish('FAIL', `INET execution failed; report: ${path.relative(root, reportPath)}`, 1);
      }
    }
  }
}
