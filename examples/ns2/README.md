# ns-2 — static and mobile console examples

## Download/install

On Ubuntu/Debian:

```bash
sudo apt update
sudo apt install ns2 python3
command -v ns
dpkg-query -W ns2
export NS2_BIN=ns
```

Tested locally with ns-2.35 (`2.35+dfsg-5build2`). Package revisions vary by OS.
The source archive and checksum used for the recorded toolchain are in
[toolchains.json](../toolchains.json). [Upstream ns-2 information](https://www.isi.edu/nsnam/ns/).

## Run from the Field2Sim repository root

Create the local settings file once, from the repository root (keep an existing
file if you already configured another simulator):

```bash
cp -n examples/toolchains.env.example examples/toolchains.env
```

Edit that file and set **NS2_BIN (the ns-2 executable, not its parent directory)**. Replace these placeholders with your
own absolute paths; quotes allow spaces in directory names:

```bash
export NS2_BIN="/absolute/path/to/ns"
```

Only this simulator's settings are required. The local file is excluded from Git.
The launchers read it automatically; exported environment variables also work.
For ns-2, `ns` on PATH is the default when NS2_BIN is unset.

Check your paths before running (this does not compile or validate the simulator):

```bash
bash examples/ns2/static/run.sh --check
```

Then run the two scenarios:

```bash
bash examples/ns2/static/run.sh
bash examples/ns2/mobile/run.sh
```

`scenario.tcl` constructs native wireless MobileNodes and sources the selected
`mobility.tcl`. Static: three nodes, three checks. Mobile: one node, eight
checks covering start, segment interiors and terminal hold. Each printed row
compares expected and observed XYZ, with a 1e-6 m tolerance.

ns-2 requires nonnegative XY for Topography/God bookkeeping. The wrapper adds
1000 m to every X/Y initial position and destination in a runtime copy; the
observer subtracts that translation. The supplied export is unchanged.
`log-movement` refreshes ns-2's lazily maintained position before sampling.

The native command is printed by the wrapper. Its form is:

```bash
ns examples/ns2/scenario.tcl /absolute/path/to/mobility-grid.tcl mobile 1000 1e-6
```

The final arguments are scenario, common grid translation, and tolerance.
All supplied Z values are zero. For changing-altitude scenarios, timed Z
assignments and XY motion have distinct semantics; do not assume 3D linear flight.

You can also enter either scenario directory and use `bash run.sh`; paths are
resolved relative to the script, not your working directory. Missing or invalid
installation paths produce an explanatory error. Full output is saved in
`examples/results/ns2/<scenario>/console.txt`, with a `result.json` summary.
See the [shared launcher documentation](../README.md) for all options.
