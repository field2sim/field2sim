#!/usr/bin/env python3
"""Sweep flight speed on archived Field2Sim UI exports; preserve spatial geometry."""
import csv,hashlib,json,os,re,shutil,subprocess
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor,as_completed
BASE=Path(__file__).resolve().parent
ROOT=Path(os.environ['NS3_ROOT']).expanduser().resolve()
OUT=BASE/'speed-results';OUT.mkdir(exist_ok=True)
subprocess.run(['node',str(BASE/'prepare-ui.js')],check=True)
s=json.loads((BASE/'ui-export/scenario.json').read_text())
original=(BASE/'ui-export/mobility.tcl').read_text()
checkpoints=[list(map(float,l.split(','))) for l in (BASE/'ui-export/checkpoints.csv').read_text().splitlines()]
last=s['route'][-1]['time'];start=5.0
work=ROOT/'scratch/field2sim-agriculture';work.mkdir(exist_ok=True)
shutil.copy2(BASE/'field2sim-agriculture.cc',work/'field2sim-agriculture.cc')
with (OUT/'build.log').open('w') as f:
 subprocess.run([str(ROOT/'ns3'),'build','field2sim-agriculture','-j','2'],cwd=ROOT,stdout=f,stderr=subprocess.STDOUT,check=True)
# Build once; independent ns-3 processes use separate output files.
binaries=list((ROOT/'build/scratch/field2sim-agriculture').glob('ns3*-field2sim-agriculture-*'))
binaries=[p for p in binaries if p.is_file() and os.access(p,os.X_OK)]
if len(binaries)!=1:raise RuntimeError('Expected one built agriculture executable')
binary=binaries[0]
def execute(speed):
 folder=OUT/f'{speed}mps';folder.mkdir(exist_ok=True)
 factor=5/speed;finish=start+(last-start)*factor;stop=finish+2
 # The UI trace supplies every coordinate and node ID unchanged. Only scheduled
 # departure times and horizontal setdest speeds change, around the common 5 s start.
 def scale(m):return f'$ns_ at {start+(float(m[1])-start)*factor:.9f} "{m[2]} {float(m[3])/factor:.9f}"'
 pattern=r'\$ns_ at ([\d.]+) "(\$node_\(120\) setdest [-\d.]+ [-\d.]+) ([\d.]+)"'
 trace=original if speed==5 else re.sub(pattern,scale,original)
 # Verify all command destinations and initial coordinate assignments are invariant.
 dest=lambda text:re.findall(r'\$node_\(120\) setdest ([-\d.]+) ([-\d.]+)',text)
 assert dest(trace)==dest(original) and len(dest(trace))==len(s['route'])-1
 init=lambda text:[l for l in text.splitlines() if l.startswith('$node_')]
 assert init(trace)==init(original)
 (folder/'mobility.tcl').write_text(trace)
 rows=[]
 for t,node,x,y,z in checkpoints:
  if node==120:t=start+(t-start)*factor if t<=last else finish+(t-last)
  rows.append([t,int(node),x,y,z])
 (folder/'checkpoints.csv').write_text('\n'.join(','.join(map(str,r)) for r in rows)+'\n')
 # Retain equivalent geographic input for loading this speed in the Field2Sim UI.
 (folder/'uav-input.txt').write_text('\n'.join(f"121 {start+(p['time']-start)*factor:.9f} {p['lat']:.9f} {p['lng']:.9f} {p['alt']:g}" for p in s['route'])+'\n')
 args=[str(binary),f'--trace={folder/"mobility.tcl"}',f'--checkpoints={folder/"checkpoints.csv"}',f'--prefix={folder/"mobile"}',f'--stop={stop}', '--mobile=1','--run=1']
 with (folder/'run.log').open('w') as f:subprocess.run(args,cwd=ROOT,stdout=f,stderr=subprocess.STDOUT,check=True)
 def read(kind):
  with (folder/f'mobile-{kind}.csv').open() as f:return list(csv.DictReader(f))
 tx,rx,pos=read('tx'),read('rx'),read('positions')
 txids={(r['node'],r['seq']) for r in tx};rxids={(r['node'],r['seq']) for r in rx}
 assert len(txids)==len(tx) and len(rxids)==len(rx) and rxids<=txids
 assert len(pos)==238 and max(float(r['error_m']) for r in pos)<=1e-5
 assert all(abs(float(r['uav_z'])-30)<1e-7 for r in rx)
 counts={str(i):sum(r['node']==str(i) for r in rx) for i in range(1,121)}
 expectedTx=sum(1 for i in range(120) for k in range(int(stop/2)+1) if 5+2*i/120+2*k<finish)
 assert len(tx)==expectedTx
 result={'speedMps':speed,'flightTimeS':finish-start,'sent':len(tx),'received':len(rx),'deliveryRatio':len(rx)/len(tx),'sensorsReached':sum(n>0 for n in counts.values()),'meanPacketsPerSensor':len(rx)/120,'missedSensors':[int(k) for k,v in counts.items() if not v],'positionChecks':len(pos),'maxPositionErrorM':max(float(r['error_m']) for r in pos),'receivedPerSensor':counts,'traceSha256':hashlib.sha256(trace.encode()).hexdigest()}
 if speed==5:
  previous=json.loads((BASE/'results-ui/report.json').read_text())['results'][0]
  assert (result['sent'],result['received'],result['sensorsReached'])==(previous['sent'],previous['received'],previous['sensorsReached'])
 (folder/'result.json').write_text(json.dumps(result,indent=2)+'\n')
 print(f"{speed} m/s: {result['sensorsReached']}/120 sensors, {len(rx)} packets, {finish-start:.2f} s, 238 position checks passed",flush=True)
 return result
results=[]
with ThreadPoolExecutor(max_workers=2) as pool:
 for f in as_completed([pool.submit(execute,v) for v in [2,5,10,15,20]]):results.append(f.result())
results.sort(key=lambda r:r['speedMps'])
report={'seed':123456,'run':1,'simulator':'ns-3.47','baseline':'Archived Field2Sim UI exports; only time and speed scaled; no new geometry','radio':json.loads((BASE/'results-ui/report.json').read_text())['radio'],'results':results,'sourceSha256':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in [BASE/'ui-export/mobility.tcl',BASE/'field2sim-agriculture.cc',Path(__file__)]}}
(OUT/'report.json').write_text(json.dumps(report,indent=2)+'\n')
fields=['speedMps','flightTimeS','sent','received','deliveryRatio','sensorsReached','meanPacketsPerSensor','positionChecks','maxPositionErrorM']
with (OUT/'summary.csv').open('w') as f:
 writer=csv.DictWriter(f,fieldnames=fields,extrasaction='ignore');writer.writeheader();writer.writerows(results)
lines=['# UAV speed sweep','', '| Speed (m/s) | Flight time (s) | Sent | Received | Sensors heard | Delivery (%) |','|---:|---:|---:|---:|---:|---:|']
for r in results:lines.append(f"| {r['speedMps']} | {r['flightTimeS']:.2f} | {r['sent']} | {r['received']} | {r['sensorsReached']}/120 | {100*r['deliveryRatio']:.3f} |")
lines+=['','The geometry, altitude (30 m), radio parameters, 2 s per-sensor transmission interval, seed and run are fixed. Only route timing changes. Each run ends after one traversal; slower runs therefore contain more transmitted packets. Sensors broadcast continuously without buffering or an acknowledged bulk-transfer protocol. Distinct sensors heard and per-sensor packet counts are the main contact-coverage measures. These are single-seed descriptive runs, not an optimal-speed or statistical-significance claim.','', 'All 238 simulator-observed position checks passed per run; the 5 m/s run reproduced the previous UI-export execution counts. Individual geographic input files can be loaded into the same mobile Field2Sim group.']
(OUT/'RESULTS.md').write_text('\n'.join(lines)+'\n')
print('PASS: five speed cases verified; speed-results/RESULTS.md',flush=True)
