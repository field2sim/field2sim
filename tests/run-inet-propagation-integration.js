'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'integrations/toolchains.json'), 'utf8'));
const propagation = require(path.join(root, 'propagation-adapters.js'));
const requireToolchain = process.argv.includes('--require-toolchain');
const omnetppRoot = process.env.OMNETPP_ROOT ? path.resolve(process.env.OMNETPP_ROOT) : null;
const inetRoot = process.env.INET_ROOT ? path.resolve(process.env.INET_ROOT) : null;
const verifierDir = path.join(root, 'integrations/inet/propagation');
const verifierSource = path.join(root, manifest.inet.propagationVerifier);
const resultsDir = path.join(root, 'integrations/results');
const reportPath = path.join(resultsDir, 'inet-propagation-report.json');

const input = Object.freeze({
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

const cases = [
  {
    id: 'free-space',
    config: 'FreeSpace',
    profileId: 'free-space-los-baseline',
    expected: {
      type: 'inet.physicallayer.wireless.common.pathloss.FreeSpacePathLoss',
      alpha: 2,
      sigma: null,
      systemLossDb: 0,
      ground: 'NONE'
    }
  },
  {
    id: 'agriculture',
    config: 'Agriculture',
    profileId: 'agriculture-crop-vegetation-24ghz',
    expected: {
      type: 'inet.physicallayer.wireless.common.pathloss.LogNormalShadowing',
      alpha: 4.9,
      sigma: 0,
      systemLossDb: 0,
      ground: 'NONE'
    }
  },
  {
    id: 'coastal',
    config: 'Coastal',
    profileId: 'coastal-over-water-24ghz',
    expected: {
      type: 'inet.physicallayer.wireless.common.pathloss.TwoRayGroundReflection',
      alpha: 2,
      sigma: null,
      systemLossDb: 0,
      ground: 'inet.environment.ground.FlatGround'
    }
  }
];

const contractPaths = {
  'FreeSpacePathLoss.ned': 'src/inet/physicallayer/wireless/common/pathloss/FreeSpacePathLoss.ned',
  'FreeSpacePathLoss.cc': 'src/inet/physicallayer/wireless/common/pathloss/FreeSpacePathLoss.cc',
  'LogNormalShadowing.ned': 'src/inet/physicallayer/wireless/common/pathloss/LogNormalShadowing.ned',
  'LogNormalShadowing.cc': 'src/inet/physicallayer/wireless/common/pathloss/LogNormalShadowing.cc',
  'TwoRayGroundReflection.ned': 'src/inet/physicallayer/wireless/common/pathloss/TwoRayGroundReflection.ned',
  'TwoRayGroundReflection.cc': 'src/inet/physicallayer/wireless/common/pathloss/TwoRayGroundReflection.cc',
  'PhysicalEnvironment.ned': 'src/inet/environment/common/PhysicalEnvironment.ned',
  'PhysicalEnvironment.cc': 'src/inet/environment/common/PhysicalEnvironment.cc',
  'FlatGround.ned': 'src/inet/environment/ground/FlatGround.ned',
  'FlatGround.cc': 'src/inet/environment/ground/FlatGround.cc'
};

function finish(status, message, code) {
  console.log(`[${status}] inet-propagation: ${message}`);
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
  return {
    ...process.env,
    PATH: [path.join(omnetppRoot, 'bin'), path.join(inetRoot, 'bin'), process.env.PATH]
      .filter(Boolean)
      .join(path.delimiter),
    LD_LIBRARY_PATH: [path.join(omnetppRoot, 'lib'), path.join(inetRoot, 'src'), process.env.LD_LIBRARY_PATH]
      .filter(Boolean)
      .join(path.delimiter),
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

function enabledFeatures() {
  const result = execute(path.join(omnetppRoot, 'bin', 'opp_featuretool'), ['list'], { cwd: inetRoot });
  if (result.status !== 0) return [];
  return result.stdout
    .split(/\r?\n/)
    .map(line => line.match(/^\s*\+\s+(.+?)\s*$/))
    .filter(Boolean)
    .map(match => match[1]);
}

function sourceAudit() {
  const observed = {};
  let matches = true;
  for (const [name, relativePath] of Object.entries(contractPaths)) {
    const filePath = path.join(inetRoot, relativePath);
    const actual = fs.existsSync(filePath) ? sha256(filePath) : null;
    const expected = manifest.inet.propagationContracts[name];
    observed[name] = { path: relativePath, expectedSha256: expected, actualSha256: actual };
    if (actual !== expected) matches = false;
  }
  return { matches, observed };
}

function generatedIni(artifacts) {
  const general = [
    '[General]',
    'network = CpxPropagationVerifier',
    'cmdenv-express-mode = true',
    '**.scalar-recording = false',
    '**.vector-recording = false',
    ''
  ].join('\n');
  const sections = cases.map(testCase => {
    const artifact = artifacts[testCase.id];
    return `[Config ${testCase.config}]\n${artifact.text}`;
  });
  return `${general}${sections.join('\n')}`;
}

function parseObservation(output) {
  const line = output.split(/\r?\n/).find(item => item.startsWith('INET_PROPAGATION_CHECK '));
  if (!line) return { line: null };
  const fields = {};
  for (const token of line.trim().split(/\s+/).slice(1)) {
    const separator = token.indexOf('=');
    if (separator === -1) continue;
    fields[token.slice(0, separator)] = token.slice(separator + 1);
  }
  return {
    line,
    type: fields.type,
    alpha: Number(fields.alpha),
    sigma: fields.sigma === 'NA' ? null : Number(fields.sigma),
    systemLossDb: Number(fields.system_loss_db),
    ground: fields.ground
  };
}

function close(actual, expected, tolerance = 1e-9) {
  return Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance;
}

function validateObservation(observation, expected) {
  return Boolean(
    observation.line &&
    observation.type === expected.type &&
    close(observation.alpha, expected.alpha) &&
    observation.sigma === expected.sigma &&
    close(observation.systemLossDb, expected.systemLossDb) &&
    observation.ground === expected.ground
  );
}

if (!omnetppRoot || !inetRoot) {
  finish(
    'SKIP',
    'OMNETPP_ROOT and INET_ROOT must point to built OMNeT++ 6.4.0 and INET 4.7.0 trees.',
    requireToolchain ? 2 : 0
  );
} else {
  const versionPath = path.join(omnetppRoot, 'Version');
  const runtimePath = path.join(omnetppRoot, 'bin', 'opp_run_release');
  const inetLibraryPath = path.join(inetRoot, 'src', 'libINET.so');
  const exclusionsPath = path.join(inetRoot, '.nedexclusions');

  if (![versionPath, runtimePath, inetLibraryPath, exclusionsPath, verifierSource].every(fs.existsSync)) {
    finish('SKIP', 'The requested trees are not built propagation-capable OMNeT++/INET installations.', requireToolchain ? 2 : 0);
  } else {
    const actualRelease = fs.readFileSync(versionPath, 'utf8').trim().replace(/^omnetpp-/, '');
    const audit = sourceAudit();
    const features = enabledFeatures();
    const requiredFeatures = ['PhysicalEnvironment', 'PhysicalLayerCommon', 'PhysicalLayerWirelessCommon'];
    const toolchainMatches =
      actualRelease === manifest.inet.omnetppRelease &&
      audit.matches &&
      requiredFeatures.every(feature => features.includes(feature));

    if (!toolchainMatches) {
      finish(
        'FAIL',
        `Toolchain contract mismatch: release=${actualRelease}, sourceMatch=${audit.matches}, features=${features.join(',')}.`,
        1
      );
    } else {
      const artifacts = Object.fromEntries(cases.map(testCase => [
        testCase.id,
        propagation.createPropagationArtifact('omnetpp', testCase.profileId, input)
      ]));
      const allNative = Object.values(artifacts).every(artifact => artifact.mapping.quality === 'native');
      const buildDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cooja-positioner-inet-propagation-'));
      const iniPath = path.join(buildDir, 'omnetpp.ini');
      fs.copyFileSync(verifierSource, path.join(buildDir, 'PropagationParameterVerifier.cc'));
      fs.writeFileSync(iniPath, generatedIni(artifacts));

      const startedAt = new Date().toISOString();
      const makemake = execute(path.join(omnetppRoot, 'bin', 'opp_makemake'), [
        '--make-so',
        '-f',
        '-o', 'cpx_inet_propagation_verifier'
      ], { cwd: buildDir });
      const build = makemake.status === 0
        ? execute('make', ['-j4', 'MODE=release'], { cwd: buildDir, timeout: 300000 })
        : { status: null, signal: null, error: null, stdout: '', stderr: '' };
      const verifierLibrary = path.join(buildDir, 'cpx_inet_propagation_verifier');
      const exclusions = fs.readFileSync(exclusionsPath, 'utf8')
        .trim()
        .split(/\r?\n/)
        .filter(Boolean)
        .join(';');

      const executions = build.status === 0 ? cases.map(testCase => {
        const args = [
          '-u', 'Cmdenv',
          '-l', path.join(inetRoot, 'src', 'INET'),
          '-l', verifierLibrary,
          '-n', [verifierDir, path.join(inetRoot, 'src')].join(path.delimiter),
          '-x', exclusions,
          `--image-path=${path.join(inetRoot, 'images')}`,
          '-f', iniPath,
          '-c', testCase.config,
          `--result-dir=${path.join(buildDir, `results-${testCase.id}`)}`
        ];
        const run = execute(runtimePath, args, { cwd: buildDir, timeout: 120000 });
        const output = `${run.stdout || ''}\n${run.stderr || ''}`;
        const observation = parseObservation(output);
        const passed = run.status === 0 && validateObservation(observation, testCase.expected);
        return {
          id: testCase.id,
          profileId: testCase.profileId,
          status: passed ? 'PASS' : 'FAIL',
          artifact: {
            filename: artifacts[testCase.id].filename,
            sha256: crypto.createHash('sha256').update(artifacts[testCase.id].text).digest('hex'),
            mapping: artifacts[testCase.id].mapping,
            referenceVector: artifacts[testCase.id].referenceVector
          },
          expected: testCase.expected,
          observed: observation,
          process: processSummary(run),
          diagnosticOutput: passed ? undefined : output.trim()
        };
      }) : [];

      const passed =
        allNative &&
        makemake.status === 0 &&
        build.status === 0 &&
        executions.length === cases.length &&
        executions.every(execution => execution.status === 'PASS');
      const report = {
        schemaVersion: 1,
        status: passed ? 'PASS' : 'FAIL',
        startedAt,
        completedAt: new Date().toISOString(),
        toolchain: {
          omnetppRelease: actualRelease,
          omnetppRevision: revision(omnetppRoot),
          inetRelease: manifest.inet.inetRelease,
          inetRevision: revision(inetRoot),
          requiredFeatures,
          enabledFeatures: features,
          sourceAudit: audit
        },
        verifier: {
          sourcePath: path.relative(root, verifierSource),
          sourceSha256: sha256(verifierSource),
          nedPath: path.relative(root, path.join(verifierDir, 'CpxPropagationVerifier.ned')),
          nedSha256: sha256(path.join(verifierDir, 'CpxPropagationVerifier.ned'))
        },
        build: {
          makemake: processSummary(makemake),
          make: processSummary(build),
          diagnosticOutput: makemake.status === 0 && build.status === 0
            ? undefined
            : `${makemake.stdout || ''}\n${makemake.stderr || ''}\n${build.stdout || ''}\n${build.stderr || ''}`.trim()
        },
        executions
      };

      fs.mkdirSync(resultsDir, { recursive: true });
      fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

      if (passed) {
        finish('PASS', `three generated INET propagation configurations loaded with exact parameters; report: ${path.relative(root, reportPath)}`, 0);
      } else {
        console.error(report.build.diagnosticOutput || executions.map(item => item.diagnosticOutput).filter(Boolean).join('\n'));
        finish('FAIL', `INET propagation verification failed; report: ${path.relative(root, reportPath)}`, 1);
      }
    }
  }
}
