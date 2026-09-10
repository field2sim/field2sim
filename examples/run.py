#!/usr/bin/env python3
"""Run one console-only Field2Sim example; preserve simulator logs in results/."""
import argparse
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import xml.etree.ElementTree as ET
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parent
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('simulator', choices=['cooja', 'ns2', 'ns3', 'omnetpp-inet'])
parser.add_argument('scenario', choices=['static', 'mobile'])
parser.add_argument('--check', action='store_true', help='Check installation paths without running a simulation')
a = parser.parse_args()
folder = ROOT / a.simulator
case = folder / a.scenario
out = ROOT / 'results' / a.simulator / a.scenario
env = dict(os.environ)
log = out / 'console.txt'

def run(args, cwd=out):
    print('+', ' '.join(map(str, args)), flush=True)
    with log.open('a') as f:
        f.write('\nCOMMAND '+repr([str(x) for x in args])+'\n'); f.flush()
        p = subprocess.run(list(map(str, args)), cwd=cwd, env=env,
                           stdout=f, stderr=subprocess.STDOUT, timeout=600)
    if p.returncode:
        raise RuntimeError(f'Command exited {p.returncode}; see {log}')

def required(name):
    value = env.get(name)
    if not value or not Path(value).is_dir():
        raise RuntimeError(f'Set {name} in {ROOT / "toolchains.env"} (copy toolchains.env.example first), or export it in your terminal. See {folder / "README.md"}')
    return Path(value).resolve()

started = False
try:
    # Validate only the selected simulator; no machine-specific search paths.
    entries = {
        'cooja': [('CONTIKI_NG', 'tools/cooja/gradlew')],
        'ns3': [('NS3_ROOT', 'ns3')],
        'omnetpp-inet': [('OMNETPP_ROOT', 'bin/opp_run_release'),
                         ('OMNETPP_ROOT', 'bin/opp_makemake'), ('INET_ROOT', 'src/inet/common/INETDefs.h')],
        'ns2': []
    }
    for variable, relative in entries[a.simulator]:
        directory = required(variable)
        if not (directory / relative).is_file():
            raise RuntimeError(f'{variable}={directory} does not contain {relative}. See {folder / "README.md"}')
    if a.simulator == 'ns2' and not shutil.which(env.get('NS2_BIN','ns')):
        raise RuntimeError('ns-2 executable not found. Set NS2_BIN in examples/toolchains.env or install ns on PATH.')
    if a.simulator == 'cooja':
        java = str(Path(env['JAVA_HOME'])/'bin/java') if env.get('JAVA_HOME') else 'java'
        if not shutil.which(java):
            raise RuntimeError('Java not found. Set JAVA_HOME to your JDK 21 installation.')
    if a.check:
        print(f'Installation paths OK: {a.simulator}. This does not verify the build or runtime version.')
        sys.exit(0)
    out.mkdir(parents=True, exist_ok=True)
    log.write_text('')
    started = True
    if a.simulator == 'cooja':
        contiki = required('CONTIKI_NG')
        # Gradle's application argument splitter supports quoted paths.
        scenarios = [case/'simulation.csc']
        if a.scenario == 'mobile':
            scenarios = []
            observations=out/'observations.txt'; observations.write_text('')
            for ms,x,y in [(200,0,0),(2200,3,-4),(5200,-2,-4),(8800,-2,-4),(9200,0,0)]:
                tree = ET.parse(case/'simulation.csc')
                tree.find('.//positions').text = str(case/'positions.dat')
                script = tree.find('.//script')
                script.text = script.text.replace('TIMEOUT(9200,', f'TIMEOUT({ms},').replace('Math.pow(p.getXCoordinate(),2)',f'Math.pow(p.getXCoordinate()-({x}),2)').replace('Math.pow(p.getYCoordinate(),2)',f'Math.pow(p.getYCoordinate()-({y}),2)')
                script.text = script.text.replace('log.log(', 'log.append('+json.dumps(str(observations))+',')
                scenario = out/f'checkpoint-{ms}.csc'
                tree.write(scenario,encoding='utf-8',xml_declaration=True)
                scenarios.append(scenario)
        args = ['--no-gui', '--no-log-color', f'--logdir={out}',
                f'--contiki={contiki}', *map(str,scenarios)]
        run([contiki/'tools/cooja/gradlew', '--no-daemon', 'run',
             '--args='+' '.join('"'+s+'"' for s in args)], contiki/'tools/cooja')
        text = log.read_text()
        # Cooja persists script output in its test log with headless execution.
        for p in list(out.glob('*.testlog')) + ([out/'observations.txt'] if a.scenario=='mobile' else []):
            text += '\n'+p.read_text(errors='replace')
        expected = 3 if a.scenario == 'static' else 5
        lines = set(x[x.index('EXAMPLE_CHECK '):] for x in text.splitlines() if 'EXAMPLE_CHECK ' in x)
        passed = 'TEST OK' in text and len(lines) == expected and 'TEST FAILED' not in text
    elif a.simulator == 'ns2':
        # ns-2 Topography requires nonnegative XY. Translate every point and
        # destination equally; the observer subtracts the same 1000 m offset.
        trace = (case/'mobility.tcl').read_text()
        trace = re.sub(r'(\$node_\(\d+\) set [XY]_ )(-?[\d.]+)',
                       lambda m:m[1]+f'{float(m[2])+1000:.9f}', trace)
        trace = re.sub(r'(setdest )(-?[\d.]+) (-?[\d.]+)',
                       lambda m:m[1]+f'{float(m[2])+1000:.9f} {float(m[3])+1000:.9f}', trace)
        shifted = out/'mobility-grid.tcl'; shifted.write_text(trace)
        run([env.get('NS2_BIN','ns'), folder/'scenario.tcl', shifted, a.scenario, '1000', '1e-6'])
        text = log.read_text(); expected = 3 if a.scenario == 'static' else 8
        lines = [x for x in text.splitlines() if x.startswith('NS2_CHECK ')]
        passed = len(lines)==expected and all('status=PASS' in x for x in lines)
    elif a.simulator == 'ns3':
        ns3 = required('NS3_ROOT')
        source = folder/'field2sim-example.cc'; target = ns3/'scratch/field2sim-console-example.cc'
        if target.exists() and target.read_bytes()!=source.read_bytes():
            raise RuntimeError(f'{target} already exists with different content; preserve or rename it first.')
        shutil.copy2(source,target)
        # Configure the installation once as described in README; run builds
        # this scratch example without changing the user's module selection.
        run([ns3/'ns3','build','field2sim-console-example'],ns3)
        run([ns3/'ns3','run','--no-build',f'field2sim-console-example --traceFile={case / "mobility.tcl"} --scenario={a.scenario}'],ns3)
        text = log.read_text(); expected = 3 if a.scenario=='static' else 8
        lines=[x for x in text.splitlines() if x.startswith('NS3_CHECK ')]
        passed=len(lines)==expected and all('status=PASS' in x for x in lines)
    else:
        omnet = required('OMNETPP_ROOT'); inet = required('INET_ROOT')
        env['PATH']=str(omnet/'bin')+os.pathsep+env.get('PATH','')
        env['LD_LIBRARY_PATH']=os.pathsep.join([str(omnet/'lib'),str(inet/'src'),env.get('LD_LIBRARY_PATH','')])
        build = out/'build'; build.mkdir(exist_ok=True)
        shutil.copy2(folder/'PositionVerifier.cc',build/'PositionVerifier.cc')
        run([omnet/'bin/opp_makemake','--make-so','-f','-o','field2sim_example',
             '-I'+str(inet/'src'),'-L'+str(inet/'src'),'-lINET'],build)
        run(['make','-j2','MODE=release'],build)
        args=[omnet/'bin/opp_run_release','-u','Cmdenv','-l',inet/'src/INET',
              '-l',build/'field2sim_example','-n',str(folder)+os.pathsep+str(inet/'src')]
        exclusions=inet/'.nedexclusions'
        if exclusions.exists(): args += ['-x',';'.join(exclusions.read_text().split())]
        args += ['-f',folder/'omnetpp.ini','-c',a.scenario.capitalize(),
                 '--*.host[*].traceFile="'+str(case/'mobility.movements')+'"',
                 '--result-dir='+str(out)]
        run(args)
        text=log.read_text();expected=3 if a.scenario=='static' else 8
        lines=[x for x in text.splitlines() if x.startswith('INET_CHECK ')]
        passed=len(lines)==expected and all('status=PASS' in x for x in lines)
    for line in sorted(lines) if isinstance(lines,set) else lines: print(line)
    status='PASS' if passed else 'FAIL'
    (out/'result.json').write_text(json.dumps({'simulator':a.simulator,'scenario':a.scenario,
        'status':status,'checks':len(lines),'expectedChecks':expected,
        'completedAt':datetime.now(timezone.utc).isoformat()},indent=2)+'\n')
    print(f'{status}: {a.simulator}/{a.scenario}; {len(lines)}/{expected} checks. Log: {log}')
    sys.exit(0 if passed else 1)
except (RuntimeError,OSError,subprocess.TimeoutExpired) as e:
    if started:
        (out/'result.json').write_text(json.dumps({'simulator':a.simulator,'scenario':a.scenario,'status':'FAIL','error':str(e)},indent=2)+'\n')
    print(str(e),file=sys.stderr)
    sys.exit(1)
