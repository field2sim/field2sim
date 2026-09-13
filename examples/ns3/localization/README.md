# ns-3: mobile anchor RSSI WCL

Follow [ns-3 installation](../README.md), using ns-3 3.47. Set `NS3_ROOT` in
`examples/toolchains.env`. Enable Wi-Fi and its dependencies in your ns-3 build;
for a dedicated installation:

```bash
cd /your/path/to/ns-3.47
./ns3 configure --build-profile=optimized --enable-modules=core,network,mobility,wifi,propagation
```

This changes the enabled modules of that checkout; include other modules you need
if it is shared with other experiments. Then, from the Field2Sim repository:

```bash
bash examples/ns3/localization/run.sh --check
bash examples/ns3/localization/run.sh
```

The runner builds a dedicated `scratch/field2sim-localization/` application and
runs it without a GUI. Node 0 sends 16 broadcast Wi-Fi packets. Nodes 1–3 receive
payloads through NetDevice callbacks; `MonitorSnifferRx` supplies signal dBm for
the same packet UID. Missing reception RSSI fails the run rather than substituting
a value calculated from node ground truth.

The scenario uses 802.11g ad hoc at 6 Mbps, 0 dBm TX, RX sensitivity -85 dBm,
and a LogDistance channel (exponent 2, reference loss 40 dB). ConstantPosition
mobility objects are repositioned by scheduled site changes; broadcasts occur at
the dwell positions. Evaluation at 38 s separately reads true node coordinates.

Output: `examples/results/ns3/localization/run.log`.
See [algorithm, expected results and limitations](../../localization/README.md).
