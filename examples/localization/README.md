# Mobile anchor, RSSI-weighted centroid localization

One mobile anchor broadcasts its known XY position. Three static unknown nodes
estimate their own position exclusively from received anchor coordinates and
receiver-reported RSSI. The simulator separately reads ground truth and prints
per-node Euclidean errors and their arithmetic mean. All examples run in a console.
These are small runnable demonstrations, not an accuracy benchmark or a comparison
of radio implementations. No external elevation service is called; all Z values are zero.

## Scenario and estimator

- Unknown positions: `(35,35)`, `(65,35)`, `(50,65)` metres.
- Anchor sites: `(10,10)`, `(50,10)`, `(90,10)`, `(90,50)`, `(90,90)`,
  `(50,90)`, `(10,90)`, `(10,50)`.
- Eight distinct sites, two position broadcasts per site: 16 beacons total.
- Site changes at simulation seconds `5,9,13,17,21,25,29,33`.
  Broadcasts are scheduled at `6,7,10,11,...,34,35` (Cooja uses firmware uptime).
- Cooja/ns-2/ns-3 move by discrete position changes; INET interpolates its trace
  between dwell periods. Every broadcast occurs while the anchor is stationary
  at the corresponding site. This example does not evaluate motion between sites.
- The anchor knows its position, as a GPS-equipped robot would. In Cooja its
  firmware contains the known anchor route; the script checks it against simulated
  anchor position on every broadcast. Unknown truth is absent from that firmware.
- A beacon contains magic, sequence number, site number, X and Y in centimetres.
  The compact C structure is used within each simulator; it is not an interoperable
  wire protocol for mixed hardware architectures.

For each received beacon, linear power is proportional to `10^((RSSI_dBm+60)/10)`.
Repeated receptions at the same site are averaged in linear power. With site weight
`w_i` and anchor coordinates `(x_i,y_i)`, the estimate is
`(sum(w_i*x_i)/sum(w_i), sum(w_i*y_i)/sum(w_i))`.
The common `+60` scale cancels. Duplicate sequence numbers are ignored. At least
three distinct sites are required; otherwise the node reports `UNLOCALIZED`.
No RSSI-to-distance calibration or unknown ground-truth input is used by WCL.
Z1 uses single-precision `powf` and prints millimetre-rounded estimates.

## Setup and execution

Start with [the common toolchain instructions](../README.md), copy
`examples/toolchains.env.example` to `examples/toolchains.env`, and set your paths.
See each simulator's localization README for additional build requirements:

- [Cooja / Contiki-NG Z1](../cooja/localization/README.md)
- [ns-2](../ns2/localization/README.md)
- [ns-3](../ns3/localization/README.md)
- [OMNeT++ / INET](../omnetpp-inet/localization/README.md)

From the repository root, run each command separately:

```bash
bash examples/cooja/localization/run.sh --check
bash examples/cooja/localization/run.sh

bash examples/ns2/localization/run.sh --check
bash examples/ns2/localization/run.sh

bash examples/ns3/localization/run.sh --check
bash examples/ns3/localization/run.sh

bash examples/omnetpp-inet/localization/run.sh --check
bash examples/omnetpp-inet/localization/run.sh
```

`--check` only checks configured paths. Actual runs compile native code and check
results. They write to `examples/results/<simulator>/localization/`; ns-3 also
builds a dedicated `scratch/field2sim-localization/` example in your ns-3 checkout.
Existing static/mobile smoke tests are separate and unchanged.

`RX` lines contain only received beacon data and measured/modelled RSSI.
`EST` lines contain node estimates; `ERROR` lines add simulator-side truth.
`SUMMARY` reports localized nodes and mean error over localized nodes.
The supplied scenario requires all three nodes to localize for `PASS`; there is no
maximum-error acceptance threshold. `verify.py` independently recomputes estimates
and errors from RX logs, checks payload/broadcast agreement and reception counts.

## Tested console runs (seed 123456)

| Simulator | Native radio path | RX total / 48 | Localized | Mean error (m) |
|---|---|---:|---:|---:|
| Cooja, Contiki-NG Z1 | CSMA/NullNet, emulated CC2420, LogisticLoss | 44 | 3/3 | 1.480603 |
| ns-2 2.35 | IEEE 802.11, WirelessPhy, FreeSpace | 48 | 3/3 | 1.801429 |
| ns-3 3.47 | 802.11g ad hoc, YansWifiPhy, LogDistance exponent 2 | 48 | 3/3 | 1.801429 |
| OMNeT++ 6.4.0 / INET 4.7.0 | APSK scalar packet radio, FreeSpacePathLoss | 48 | 3/3 | 1.814395 |

Cooja uses integer RSSI and probabilistic reception; the other radios and protocol
stacks differ. The numeric differences are not evidence that one simulator or
localization method is better. INET deliberately connects the application directly
to its radio, without an IP/MAC stack. The first three use their stated MAC paths.
ns-2/ns-3/INET read RSSI from the delivered packet's radio reception metadata.
Cooja reads `PACKETBUF_ATTR_RSSI` inside the actual Contiki receive callback.

These fixed local-coordinate scenarios illustrate localization experiment code.
They do not automatically import an arbitrary Field2Sim project. To use your own
export, replace the topology/mobility inputs and keep beacon positions/timing and
simulator evaluation consistent. Do not give unknown coordinates to the estimator.
