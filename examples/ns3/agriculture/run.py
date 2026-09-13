#!/usr/bin/env python3
import os,subprocess,json,shutil,csv,hashlib,sys
from pathlib import Path
base=Path(__file__).resolve().parent
root=Path(os.environ['NS3_ROOT']).expanduser().resolve()
if not (root/'ns3').is_file():raise SystemExit('NS3_ROOT does not contain ns3')
ui='--regenerate' not in sys.argv
subprocess.run(['node',str(base/('prepare-ui.js' if ui else 'generate.js'))],check=True)
data=base/'ui-export' if ui else base
s=json.loads((data/'scenario.json').read_text())
work=root/'scratch/field2sim-agriculture';work.mkdir(exist_ok=True)
shutil.copy2(base/'field2sim-agriculture.cc',work/'field2sim-agriculture.cc')
out=base/('results-ui' if ui else 'results');out.mkdir(exist_ok=True)
with (out/'build.log').open('w') as f:subprocess.run([str(root/'ns3'),'build','field2sim-agriculture','-j','2'],cwd=root,stdout=f,stderr=subprocess.STDOUT,check=True)
trace=(data/'mobility.tcl').read_text()
(out/'stationary.tcl').write_text('\n'.join(l for l in trace.splitlines() if not l.startswith('$ns_ at'))+'\n')
results=[]
for mode in ['mobile','stationary']:
 args=[f'--trace={data/"mobility.tcl" if mode=="mobile" else out/"stationary.tcl"}',f'--checkpoints={data/"checkpoints.csv"}',f'--prefix={out/mode}',f'--stop={s["endTime"]}',f'--mobile={int(mode=="mobile")}']
 with (out/f'{mode}.log').open('w') as f:subprocess.run([str(root/'ns3'),'run','--no-build','field2sim-agriculture','--',*args],cwd=root,stdout=f,stderr=subprocess.STDOUT,check=True)
 def rows(kind):
  with (out/f'{mode}-{kind}.csv').open() as f:return list(csv.DictReader(f))
 tx,rx,pos=rows('tx'),rows('rx'),rows('positions');txids={(r['node'],r['seq']) for r in tx};rxids={(r['node'],r['seq']) for r in rx}
 assert len(rxids)==len(rx) and rxids<=txids
 assert len(pos)==120+len(s['route']) and max(float(r['error_m']) for r in pos)<=1e-5
 assert all(abs(float(r['uav_z'])-30)<1e-7 for r in rx)
 counts={str(i):sum(r['node']==str(i) for r in rx) for i in range(1,121)}
 result={'mode':mode,'sent':len(tx),'received':len(rx),'deliveryRatio':len(rx)/len(tx),'sensorsReached':sum(v>0 for v in counts.values()),'sensors':120,'positionChecks':len(pos),'maximumPositionErrorM':max(float(r['error_m']) for r in pos),'receivedPerSensor':counts}
 results.append(result);print(json.dumps({k:v for k,v in result.items() if k!='receivedPerSensor'}))
report={'simulator':'ns-3.47','seed':123456,'run':1,'parameters':s['parameters'],'radio':{'standard':'802.11g ad hoc','rateMbps':6,'txDbm':0,'sensitivityDbm':-85,'pathLoss':'LogDistance','exponent':2.7,'referenceLossDb':40.045997,'payloadBytes':128,'packetIntervalS':2},'results':results,'sha256':{str(p.relative_to(base)):hashlib.sha256(p.read_bytes()).hexdigest() for p in [data/'scenario.json',data/'mobility.tcl',base/'field2sim-agriculture.cc',data/'checkpoints.csv']}}
(out/'report.json').write_text(json.dumps(report,indent=2)+'\n')
print(f'PASS: packet records and simulator-observed coordinates verified; {out}/report.json')
