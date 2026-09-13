# UAV speed sweep

| Speed (m/s) | Flight time (s) | Sent | Received | Sensors heard | Delivery (%) |
|---:|---:|---:|---:|---:|---:|
| 2 | 1893.55 | 113613 | 1399 | 120/120 | 1.231 |
| 5 | 757.42 | 45446 | 545 | 120/120 | 1.199 |
| 10 | 378.71 | 22723 | 281 | 120/120 | 1.237 |
| 15 | 252.47 | 15149 | 191 | 119/120 | 1.261 |
| 20 | 189.35 | 11362 | 131 | 109/120 | 1.153 |

The geometry, altitude (30 m), radio parameters, 2 s per-sensor transmission interval, seed and run are fixed. Only route timing changes. Each run ends after one traversal; slower runs therefore contain more transmitted packets. Sensors broadcast continuously without buffering or an acknowledged bulk-transfer protocol. Distinct sensors heard and per-sensor packet counts are the main contact-coverage measures. These are single-seed descriptive runs, not an optimal-speed or statistical-significance claim.

All 238 simulator-observed position checks passed per run; the 5 m/s run reproduced the previous UI-export execution counts. Individual geographic input files can be loaded into the same mobile Field2Sim group.
