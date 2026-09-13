# OMNeT++ / INET: mobile anchor RSSI WCL

Follow [OMNeT++ / INET installation](../README.md). Tested with OMNeT++ 6.4.0 and
INET 4.7.0. Set `OMNETPP_ROOT` and `INET_ROOT` in `examples/toolchains.env`.
Build INET with APSK radio support (its required dependencies must also be enabled):

```bash
# In a shell where the OMNeT++ bin directory is on PATH:
cd /your/path/to/inet-4.7.0
opp_featuretool enable -r ApskRadio
make makefiles
make -j2 MODE=release
```

Then, from the Field2Sim repository:

```bash
bash examples/omnetpp-inet/localization/run.sh --check
bash examples/omnetpp-inet/localization/run.sh
```

The runner builds the application as a shared library and starts `opp_run_release`
in Cmdenv. Host 0 follows a BonnMotion trace and broadcasts 16 packets. Each unknown
application reads `SignalPowerInd` from its received packet and computes WCL from
anchor payloads. A separate `WclEvaluator` module accesses simulator ground truth.

This is a packet-radio example: applications connect directly to ApskScalarRadio,
with no MAC/IP stack. FreeSpacePathLoss, 1 mW, 2.4 GHz, 250 kbps, RX sensitivity
-85 dBm and -100 dBm background noise are illustrative parameters. Radios start
off and are switched to transceiver in the final initialization stage, after the
medium has registered all radios. INET source code is not patched.

Output: `examples/results/omnetpp-inet/localization/run.log`.
See [algorithm, expected results and limitations](../../localization/README.md).
