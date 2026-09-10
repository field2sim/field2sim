'use strict';
// Reuse the pinned planar harnesses in an isolated workspace; historical reports stay intact.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const { createArtifact } = require('../simulator-adapters');
const root = path.resolve(__dirname, '..');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'field2sim-elevation-'));
const output = path.join(root, 'integrations/elevation');
fs.mkdirSync(path.join(scratch, 'tests'), { recursive: true });
fs.cpSync(path.join(root, 'integrations'), path.join(scratch, 'integrations'), {
  recursive: true, filter: p => !['results', 'elevation'].includes(path.basename(p))
});
const cases = [['mobile', 'mobile-waypoints.json', [33, 34, 29, 31]],
               ['static', 'static-three-nodes.json', [33, 34, 29]]];
for (const [scenario, name, heights] of cases) {
  const document = JSON.parse(fs.readFileSync(path.join(root, 'integrations/scenarios', name)));
  document.description = 'Controlled elevated adapter-consumer fixture; not a field elevation measurement.';
  document.waypoints.forEach((p, i) => { p.z = heights[i]; });
  fs.writeFileSync(path.join(output, name), JSON.stringify(document, null, 2) + '\n');
  for (const [target, file] of [['ns2', 'mobility-ns2.tcl'], ['ns3', 'mobility-ns3.tcl'], ['inet', 'mobility-bonnmotion.movements']]) {
    const text = createArtifact(target === 'inet' ? 'omnetpp' : target, document).text + '\n';
    fs.writeFileSync(path.join(scratch, 'integrations', target, scenario, file), text);
    fs.writeFileSync(path.join(output, `${scenario}-${file}`), text);
  }
}
const labels = ['initial', 'segment-1-quarter', 'segment-1-midpoint', 'segment-2-early', 'segment-2-midpoint', 'segment-3-early', 'segment-3-midpoint', 'terminal-hold', 'static-node-0', 'static-node-1', 'static-node-2'];
const stepped = [33,33,33,34,34,29,29,31,33,34,29];
const interpolated = [33,33.25,33.5,33.16666666666667,31.5,29.25,30,31,33,34,29];
for (const [target, file] of [['ns2','ns2/verifier/verify-mobility.tcl'], ['ns3','ns3/field2sim-ns3.cc'], ['inet','inet/verifier/PositionVerifier.cc']]) {
  const source = path.join(scratch, 'integrations', file);
  const values = target === 'inet' ? interpolated : stepped;
  const lines = fs.readFileSync(source, 'utf8').split('\n').map(line => {
    const i = labels.findIndex(label => line.includes(target === 'ns2' ? `{${label} ` : `{"${label}"`));
    if (i < 0) return line;
    return target === 'ns2' ? line.replace(/0\.0\}$/, `${values[i]}}`) : line.replace(/0\.0\)\},$/, `${values[i]})},`);
  });
  fs.writeFileSync(source, lines.join('\n'));
  fs.copyFileSync(source, path.join(output, path.basename(file)));
  let runner = fs.readFileSync(path.join(root, 'tests', `run-${target}-integration.js`), 'utf8');
  // The verifier was explicitly built already; avoid building unrelated scratch programs.
  if (target === 'ns3') runner = runner.replace("    'run',", "    'run', '--no-build',");
  // Local release archives have no .git directory. Retain release and exact consumer-source
  // hash checks, and report unavailable revisions as null rather than claiming a git pin.
  if (target === 'inet') runner = runner
    .replace('actual.omnetppRevision === manifest.inet.omnetppRevision &&', '')
    .replace('actual.inetRevision === manifest.inet.inetRevision &&', '');
  fs.writeFileSync(path.join(scratch, 'tests', `run-${target}-integration.js`), runner);
}
const ned = path.join(scratch, 'integrations/inet/verifier/BonnMotionValidation.ned');
fs.writeFileSync(ned, fs.readFileSync(ned, 'utf8').replace('is3D = false', 'is3D = true'));
fs.copyFileSync(ned, path.join(output, 'BonnMotionValidation.ned'));
console.log(`Isolated workspace: ${scratch}`);
let failed = false;
for (const target of ['ns2', 'ns3', 'inet']) {
  const result = spawnSync(process.execPath, [path.join(scratch, 'tests', `run-${target}-integration.js`), '--require-toolchain'], { encoding: 'utf8', timeout: 600000 });
  console.log(result.stdout, result.stderr);
  failed ||= result.status !== 0;
  const report = path.join(scratch, 'integrations/results', `${target}-integration-report.json`);
  if (fs.existsSync(report)) fs.copyFileSync(report, path.join(output, `${target}-integration-report.json`));
}
process.exitCode = failed ? 1 : 0;
