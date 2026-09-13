# Cooja: mobile anchor and three unknown Z1 motes

Follow [Cooja installation](../README.md) first. In addition to Java 21 and a
built Cooja, this example needs the MSP430 GCC toolchain used to build Contiki-NG
Z1 firmware. Put its `bin` directory on `PATH` in `examples/toolchains.env`, and
set `CONTIKI_NG` to your Contiki-NG checkout. Tested with MSP430 GCC 4.7.2,
Contiki-NG `6ac4608cdd8e007ae328905687db9a326dd09304` and Cooja
`0a518f80c4a6c79a0cfda332f3d6bc6d7684bc7a`.

```bash
bash examples/cooja/localization/run.sh --check
bash examples/cooja/localization/run.sh
```

The runner builds `anchor-wcl.c` for Z1, loads four emulated motes, reads the
supplied `positions.dat` with the Mobility plugin, and runs the CSC script in
headless mode. ID 1 is the mobile anchor; IDs 2–4 are unknowns. All use the same
firmware. The anchor route is known to the anchor firmware; unknown coordinates
exist only in the CSC scenario and are read by the evaluation script.

The radio is restarted into continuous receive mode after platform initialization.
CC2420 packet RSSI supplies the WCL weights. LogisticLoss uses range 100 m,
RX sensitivity -85 dBm, RSSI inflection -82 dBm, path-loss exponent 2, AWGN sigma 0
and no time variation. These are example assumptions, not a field calibration.
The script checks anchor payload positions against actual simulated positions.
`positions.dat` indices are zero-based mote-array indices, not mote IDs.
The final waypoint is after evaluation so the plugin does not wrap during the run.

Outputs: `examples/results/cooja/localization/run.log` and `COOJA.testlog`.
See [algorithm, expected results and limitations](../../localization/README.md).
