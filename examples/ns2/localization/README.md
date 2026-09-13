# ns-2: mobile anchor RSSI WCL

Follow [ns-2 installation](../README.md). This example additionally builds a
loadable C++ Agent because Tcl's ordinary UDP sink does not expose per-packet
WirelessPhy received power. It does not patch or rebuild the installed ns binary.

Use a configured ns-2 2.35 source tree matching your installed binary, a C++17
compiler, and Tcl/OTcl/TclCL development headers. On Debian/Ubuntu the development
packages are typically `g++ tcl8.6-dev libotcl1-dev libtclcl1-dev`. Obtain the
matching distribution source (`apt source ns2`, with source repositories enabled),
or use the source tree from which you built ns-2. Run that source tree's documented
`./configure` procedure so `autoconf.h` exists; it may require explicit `--with-tcl`,
`--with-otcl` and `--with-tclcl` paths on your installation.

Set these in `examples/toolchains.env`:

```bash
export NS2_BIN="/your/path/to/ns"
export NS2_SOURCE="/your/path/to/configured/ns-2.35"
export NS2_INCLUDE_DIRS="/usr/include/tcl8.6:/usr/include/tclcl:/usr/include"
```

Adjust the header directories to your machine. The runner checks paths, compiles
`libField2SimWcl.so`, then loads it into ns-2:

```bash
bash examples/ns2/localization/run.sh --check
bash examples/ns2/localization/run.sh
```

Node 0 broadcasts on port 42; nodes 1–3 collect received anchor positions and
`p->txinfo_.RxPr` from WirelessPhy (watts converted to dBm). A simulator-side Tcl
procedure compares the WCL result with each MobileNode's true position at 38 s.
Radio: 1 mW, 2.4 GHz, FreeSpace, RX threshold -85 dBm, omnidirectional antennas
1.5 m above node Z. The custom Agent uses IP broadcast and the native 802.11 MAC.
It consumes anchor packets, not distances or ground truth.

If loading fails with unresolved symbols, verify that source headers and binary
are ABI-compatible and that the binary exports the ns-2 classes used by an
extension. Do not interpret a failed extension load as a successful localization run.

Outputs: `examples/results/ns2/localization/run.log` and `packets.tr`.
See [algorithm, expected results and limitations](../../localization/README.md).
