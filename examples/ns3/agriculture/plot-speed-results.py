#!/usr/bin/env python3
"""Plot the recorded UAV speed sweep; no simulator execution required."""
import csv
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

base = Path(__file__).resolve().parent
with (base / 'speed-results/summary.csv').open() as stream:
    rows = list(csv.DictReader(stream))
speed = [float(r['speedMps']) for r in rows]
minutes = [float(r['flightTimeS']) / 60 for r in rows]
coverage = [100 * int(r['sensorsReached']) / 120 for r in rows]
packets = [int(r['received']) for r in rows]
# Match the style of cooja-example-folder/3.localization-process/plotter.py.
plt.rcdefaults()
plt.rcParams.update({'font.size': 21, 'lines.linewidth': 3,
                     'pdf.fonttype': 42, 'ps.fonttype': 42})
series = [(minutes, 'Traversal Time (min)', 'Flight duration', 'blue', '^', 'duration'),
          (coverage, 'Sensors Heard (%)', 'Sensor contact coverage', 'green', '*', 'coverage'),
          (packets, 'Received Packets', 'Packet reception', 'red', 's', 'packets')]

def draw(ax, item, index):
    values, ylabel, title, color, marker, name = item
    ax.plot(speed, values, marker=marker, color=color, markersize=15)
    ax.set_xlabel('UAV Speed (m/s)', fontsize=23)
    ax.set_ylabel(ylabel, fontsize=23)
    ax.set_xticks(speed)
    ax.set_xlim(0, 22)
    ax.set_ylim(0, max(values)*1.20)
    for x, y in zip(speed, values):
        label = f'{y:.2f}' if index == 0 else (f'{y:.1f}%' if index == 1 else str(int(y)))
        ax.annotate(label, (x, y), xytext=(0, 12), textcoords='offset points', ha='center', fontsize=21)
    if index == 1:
        ax.set_ylim(0, 118)
        ax.set_yticks([0, 25, 50, 75, 100])

out = base / 'speed-results'
def save(fig, name):
    for extension in ('png', 'pdf', 'svg'):
        fig.savefig(out / f'{name}.{extension}', dpi=150, bbox_inches='tight')

fig, axes = plt.subplots(1, 3, figsize=(30, 8))
for index, (ax, item) in enumerate(zip(axes, series)):
    draw(ax, item, index)
    ax.text(.5, -.20, f'({chr(97+index)}) {item[2]}', transform=ax.transAxes, ha='center', fontsize=21)
fig.tight_layout(w_pad=2)
save(fig, 'fig-uav-speed-results')
plt.close(fig)
for index, item in enumerate(series):
    fig, ax = plt.subplots(figsize=(10, 8))
    draw(ax, item, index)
    fig.tight_layout()
    save(fig, f'fig-uav-speed-{item[5]}')
    plt.close(fig)
print(out / 'fig-uav-speed-results.png')
