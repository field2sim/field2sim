#!/usr/bin/env python3
"""Independently recompute WCL and Euclidean errors from native reception logs."""
import math, re, sys
from collections import defaultdict
from pathlib import Path

def verify(path):
    text=Path(path).read_text(errors='replace')
    rx=defaultdict(dict); estimates={}; truths={}; summary=None; tx={}
    for line in text.splitlines():
        if line.startswith('DBG '): continue
        m=re.search(r'\b(TX|RX|EST|ERROR|SUMMARY)\s+(.*)',line)
        if not m: continue
        kind,tail=m.groups(); d=dict(re.findall(r'(\w+)=([^\s]+)',tail))
        def xy(prefix=''):
            if prefix+'x_cm' in d: return float(d[prefix+'x_cm'])/100,float(d[prefix+'y_cm'])/100
            if prefix+'x_mm' in d: return float(d[prefix+'x_mm'])/1000,float(d[prefix+'y_mm'])/1000
            return float(d[prefix+'x']),float(d[prefix+'y'])
        if kind=='TX': tx[int(d['seq'])]=xy()
        if kind=='RX':
            node=int(d['node']);seq=int(d['seq']);assert seq not in rx[node], 'Duplicate RX'
            rx[node][seq]=(int(d['site']),*xy('a'),float(d['rssi_dbm']))
        if kind=='EST': estimates[int(d['node'])]=(*xy(),int(d['sites']),int(d['received']))
        if kind=='ERROR': truths[int(d['node'])]=(float(d['true_x']),float(d['true_y']),float(d['error_m']))
        if kind=='SUMMARY': summary=d
    assert len(tx)==16 and len(estimates)==3 and len(truths)==3
    errs=[]
    for node,(x,y,sites,count) in estimates.items():
        groups=defaultdict(list)
        for seq,(site,ax,ay,rssi) in rx[node].items():
            assert math.dist((ax,ay),tx[seq])<0.02,'Payload disagrees with broadcast'
            groups[site].append((ax,ay,10**((rssi+60)/10)))
        assert len(groups)==sites and len(rx[node])==count
        w=[(v[0][0],v[0][1],sum(p[2] for p in v)/len(v)) for v in groups.values()]
        sx=sum(a*c for a,b,c in w)/sum(c for a,b,c in w)
        sy=sum(b*c for a,b,c in w)/sum(c for a,b,c in w)
        assert math.dist((x,y),(sx,sy))<0.002,(node,(x,y),(sx,sy))
        tx_,ty_,err=truths[node];actual=math.hypot(x-tx_,y-ty_)
        assert abs(actual-err)<0.002
        errs.append(actual)
    assert summary and summary['status']=='PASS'
    assert abs(sum(errs)/len(errs)-float(summary['mean_error_m']))<0.002
    print(f'{path}: verified {len(rx)} unknowns, {sum(map(len,rx.values()))} RX, mean {sum(errs)/len(errs):.6f} m')
if __name__=='__main__':
    for path in sys.argv[1:]: verify(path)
