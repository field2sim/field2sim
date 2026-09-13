# Console examples

Run a static placement and a mobile route in Cooja, ns-2, ns-3, or
OMNeT++/INET. All examples run without a GUI and print positions read from the
simulator. Python 3 launches the native simulator and collects its results.

## Start here

Clone the public repository; no author-specific account or directory is needed:

```bash
git clone https://github.com/field2sim/field2sim.git
cd field2sim
```

1. Install/build the simulator using the linked instructions below.
2. From the repository root, create your local configuration:

```bash
cp examples/toolchains.env.example examples/toolchains.env
```

3. Edit `examples/toolchains.env`: uncomment and fill in the absolute installation
paths for the simulator(s) you use. The template explains which directory each
variable refers to. You do not need to install or configure all four simulators.
This local file is excluded from Git. Existing exported environment variables
also work; active assignments in the config file override them.
4. Check the selected installation paths, then run its example:

```bash
bash examples/cooja/static/run.sh --check
bash examples/cooja/static/run.sh
```

All eight launchers:

```bash
bash examples/cooja/static/run.sh
bash examples/cooja/mobile/run.sh
bash examples/ns2/static/run.sh
bash examples/ns2/mobile/run.sh
bash examples/ns3/static/run.sh
bash examples/ns3/mobile/run.sh
bash examples/omnetpp-inet/static/run.sh
bash examples/omnetpp-inet/mobile/run.sh
```

Every launcher accepts `--check` and works from any current directory: you can
also `cd` into a scenario folder and run `bash run.sh`. A missing or incorrect
path produces an explanation before simulation starts. `--check` checks paths
and executable availability, not simulator versions or successful compilation.
The shell launchers load the configuration; calling `run.py` directly uses only
your exported environment. Linux/WSL with Bash and Python 3 is the supported
launcher environment. To keep configuration elsewhere, export `FIELD2SIM_CONFIG`
with its absolute path.

| Simulator instructions | Required environment | Static checks | Mobile checks |
|---|---|---:|---:|
| [Cooja](cooja/README.md) | `CONTIKI_NG`, Java 21 | 3 | 5 |
| [ns-2](ns2/README.md) | `NS2_BIN` (defaults to `ns`) | 3 | 8 |
| [ns-3](ns3/README.md) | `NS3_ROOT` | 3 | 8 |
| [OMNeT++/INET](omnetpp-inet/README.md) | `OMNETPP_ROOT`, `INET_ROOT` | 3 | 8 |

A successful command ends with `PASS`; a missing installation, failed build,
or coordinate mismatch produces a nonzero exit status. Full native output is
saved to `results/<simulator>/<scenario>/console.txt`; `result.json` contains
its summary. Results and compiled files are excluded from Git. Installation
and first builds may need Internet access; the scenarios make no elevation API requests.

## What the examples demonstrate

The static case has three non-collinear nodes. The mobile case has one node
with waypoints at 0, 2, 5 and 9 seconds. Local input coordinates are in
`static-local-coordinates.json` and `mobile-local-coordinates.json` (metres;
X east, Y north). Exported Y is inverted by the adapter. All examples use Z=0.
These are deliberately small placement/mobility simulations; protocol traffic,
firmware performance, and physical propagation accuracy are separate experiments.
Cooja uses a built-in Java application mote, so no embedded compiler is required.

The included Tcl, movements and positions files match Field2Sim's exporter.
With Node.js installed, check that relationship from the repository root:

```bash
node examples/check-exports.js
```

To try your own data, prepare a static group or mobile route in Field2Sim with
experimental 3D disabled, select the target, then Convert and Save export. For
Cooja static scenarios, save matching mote IDs into a CSC. For Cooja mobile,
keep `simulation.csc` and `positions.dat` together. For other targets, replace
the corresponding `mobility.tcl` or `mobility.movements`. Adapt the expected
checkpoints in the scenario source as well: they describe these supplied
examples, so different geometry should fail the existing checks.

Cooja Mobility applies discrete cyclic waypoints; the other three examples
sample interpolated positions, including between waypoints. Their expected
outputs therefore differ. See each README for Z behavior and native entry points.
Tested versions and source revisions are in `toolchains.json`.

## RSSI-weighted localization examples

For a packet-based experiment with one mobile anchor and three static unknown
nodes, see [mobile-anchor WCL](localization/README.md). Each simulator has a
`localization/run.sh` that builds native code, runs in the console and independently
checks estimates against reception logs. Additional build requirements apply.

## Agricultural UAV collection experiment

See [the ns-3 agricultural example](ns3/agriculture/README.md) for the archived
Field2Sim geographic inputs, real Wi-Fi packet experiment, five-speed sweep,
recorded results and Matplotlib commands. Its launchers are described separately;
the static/mobile `--check` option above does not apply to this experiment.
