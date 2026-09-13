#!/usr/bin/env python3
"""Build and run the native mobile-anchor WCL example; no fixed toolchain paths."""
import argparse, os, shutil, subprocess, sys
from pathlib import Path
from verify import verify

BASE=Path(__file__).resolve().parent
EXAMPLES=BASE.parent
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('simulator',choices=['cooja','ns2','ns3','omnetpp-inet'])
p.add_argument('--check',action='store_true',help='Check configured paths without building')
a=p.parse_args()
env=os.environ.copy()

def required(name,marker=None):
    value=env.get(name)
    if not value: raise RuntimeError(f'Set {name} in examples/toolchains.env (see localization/README.md).')
    path=Path(value).expanduser().resolve()
    if not path.exists() or (marker and not (path/marker).exists()): raise RuntimeError(f'Invalid {name}: {path}; expected {marker or "an existing path"}')
    return path

def binary(name,default):
    value=env.get(name,default); found=shutil.which(value)
    if not found: raise RuntimeError(f'Executable not found: {value}; set {name}.')
    return found

try:
    if a.simulator=='cooja':
        contiki=required('CONTIKI_NG','tools/cooja/gradlew')
        binary('MSP430_CC','msp430-gcc')
    elif a.simulator=='ns2':
        ns=binary('NS2_BIN','ns');src=required('NS2_SOURCE','autoconf.h')
        includes=[Path(x).expanduser().resolve() for x in env.get('NS2_INCLUDE_DIRS','').split(os.pathsep) if x]
        if not includes: raise RuntimeError('Set NS2_INCLUDE_DIRS to colon-separated Tcl/TclCL/OTcl header directories.')
        for directory in includes:
            if not directory.is_dir(): raise RuntimeError(f'Missing include directory: {directory}')
    elif a.simulator=='ns3':
        ns3=required('NS3_ROOT','ns3')
    else:
        omnet=required('OMNETPP_ROOT','bin/opp_makemake');inet=required('INET_ROOT','src/libINET.so')
        env['PATH']=str(omnet/'bin')+os.pathsep+env.get('PATH','')
        env['LD_LIBRARY_PATH']=os.pathsep.join([str(omnet/'lib'),str(inet/'src'),env.get('LD_LIBRARY_PATH','')])
    if a.check:
        print(f'{a.simulator}: toolchain paths found (build/API compatibility is checked by an actual run).');sys.exit(0)
    out=EXAMPLES/'results'/a.simulator/'localization';out.mkdir(parents=True,exist_ok=True)
    for f in (EXAMPLES/a.simulator/'localization').iterdir():
        if f.is_file() and f.name not in ('run.sh','README.md'): shutil.copy2(f,out/f.name)
    shutil.copy2(BASE/'wcl.h',out/'wcl.h')
    log=out/'run.log';log.write_text('')
    def run(cmd,cwd=out,allow_fail=False):
        print('+',' '.join(map(str,cmd)),flush=True)
        with log.open('a') as f:
            result=subprocess.run(list(map(str,cmd)),cwd=cwd,env=env,stdout=f,stderr=subprocess.STDOUT)
        if result.returncode and not allow_fail: raise RuntimeError(f'Command failed ({result.returncode}); see {log}')
        return result.returncode
    if a.simulator=='cooja':
        args=['--no-gui','--no-log-color',f'--logdir={out}',f'--contiki={contiki}',str(out/'simulation.csc')]
        run([contiki/'tools/cooja/gradlew','--no-daemon','run','--args='+' '.join('"'+x+'"' for x in args)],contiki/'tools/cooja')
        testlogs=list(out.glob('*.testlog'))
        with log.open('a') as f:
            for file in testlogs: f.write('\n'+file.read_text())
        if not testlogs or 'TEST OK' not in log.read_text(): raise RuntimeError('Cooja did not report TEST OK')
    elif a.simulator=='ns2':
        headers=[src,*sorted(x for x in src.iterdir() if x.is_dir()),*includes]
        run([env.get('CXX','g++'),'-std=c++17','-O2','-fPIC','-shared','-DUSE_INTERP_RESULT','-Wno-write-strings',*[f'-I{x}' for x in headers],'WclAgent.cc','-o','libField2SimWcl.so'])
        run([ns,'scenario.tcl'])
    elif a.simulator=='ns3':
        # A private scratch subdirectory avoids collisions with other examples.
        scratch=ns3/'scratch'/'field2sim-localization';scratch.mkdir(exist_ok=True)
        shutil.copy2(out/'field2sim-wcl.cc',scratch/'field2sim-anchor-wcl.cc')
        shutil.copy2(out/'wcl.h',scratch/'wcl.h')
        run([ns3/'ns3','build','field2sim-anchor-wcl','-j',env.get('BUILD_JOBS','2')],ns3)
        run([ns3/'ns3','run','--no-build','field2sim-anchor-wcl'],ns3)
    else:
        run([omnet/'bin/opp_makemake','--make-so','-f','-o','field2sim_wcl',f'-I{inet}/src',f'-L{inet}/src','-lINET'])
        run(['make','MODE=release','-j',env.get('BUILD_JOBS','2')])
        exclusions=inet/'.nedexclusions';args=[]
        if exclusions.exists(): args=['-x',';'.join(exclusions.read_text().splitlines())]
        run([omnet/'bin/opp_run_release','-u','Cmdenv','-l',inet/'src/INET','-l',out/'libfield2sim_wcl.so','-n',f'{out}:{inet}/src',*args,'-f','omnetpp.ini'])
    verify(log)
    for line in log.read_text(errors='replace').splitlines():
        if line.startswith(('EST ','ERROR ','SUMMARY ')): print(line)
    print(f'Log: {log}')
except (RuntimeError, OSError, AssertionError) as exc:
    print(f'ERROR: {exc}',file=sys.stderr);sys.exit(1)
