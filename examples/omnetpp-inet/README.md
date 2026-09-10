# OMNeT++ / INET — static and mobile console examples

## Download/build

Tested pair: OMNeT++ 6.4.0 and INET 4.7.0. Install the OS-specific build
prerequisites from the [OMNeT++ installation guide](https://doc.omnetpp.org/omnetpp/InstallGuide.pdf).
See also the [official INET installation instructions](https://inet.omnetpp.org/Installation.html).
Use separate installation directories; these commands configure a console-only build:

```bash
git clone https://github.com/omnetpp/omnetpp.git omnetpp-6.4.0
cd omnetpp-6.4.0
git checkout 2cf25223fee7c2386f4c610f6fcb12d9585497ab
source setenv
./configure WITH_QTENV=no WITH_OSG=no
make -j2 MODE=release
export OMNETPP_ROOT="$PWD"
cd ..
git clone https://github.com/inet-framework/inet.git inet-4.7.0
cd inet-4.7.0
git checkout dfe270b21f38856874e3ba50ef964bd557e4bb99
export INET_ROOT="$PWD"
# A small feature selection sufficient for these position examples:
opp_featuretool disable -f all
opp_featuretool enable -r Mobility
make makefiles
make -j2 MODE=release
```

The `make` steps can take several minutes. Exact source revisions are recorded
in [toolchains.json](../toolchains.json). The local run uses an already-built
installation; a fresh download/build was not repeated for this example package.

## Run from the Field2Sim repository root

Create the local settings file once, from the repository root (keep an existing
file if you already configured another simulator):

```bash
cp -n examples/toolchains.env.example examples/toolchains.env
```

Edit that file and set **OMNETPP_ROOT (containing bin/opp_run_release) and INET_ROOT (the built INET source directory)**. Replace these placeholders with your
own absolute paths; quotes allow spaces in directory names:

```bash
export OMNETPP_ROOT="/absolute/path/to/omnetpp-6.4.0"
export INET_ROOT="/absolute/path/to/inet-4.7.0"
```

Only this simulator's settings are required. The local file is excluded from Git.
The launchers read it automatically; exported environment variables also work.

Check your paths before running (this does not compile or validate the simulator):

```bash
bash examples/omnetpp-inet/static/run.sh --check
```

Then run the two scenarios:

```bash
bash examples/omnetpp-inet/static/run.sh
bash examples/omnetpp-inet/mobile/run.sh
```

The wrapper builds `PositionVerifier.cc` into a small local library and launches
`opp_run_release -u Cmdenv` with the supplied NED and INI files. It honors the
installation's NED feature exclusions. The full command appears in `console.txt`.
No IDE or Qtenv is needed.

`BonnMotionValidation.ned` contains a three-host static network and a one-host
mobile network. Each host uses INET's `BonnMotionMobility`. `omnetpp.ini`
selects the duration; the runner supplies the movements-file path. Expect
three static checks or eight mobile checks. Position observations come from
INET's `IMobility` interface; a mismatch fails the simulation.

These files contain 2D triples `(time, x, y)` and the NED sets `is3D=false`.
For 3D traces the consumer requires `is3D=true` and quadruples `(time, x, y, z)`.
See [BonnMotionMobility documentation](https://doc.omnetpp.org/inet/api-current/neddoc/inet.mobility.single.BonnMotionMobility.html).

You can also enter either scenario directory and use `bash run.sh`; paths are
resolved relative to the script, not your working directory. Missing or invalid
installation paths produce an explanatory error. Full output is saved in
`examples/results/omnetpp-inet/<scenario>/console.txt`, with a `result.json` summary.
See the [shared launcher documentation](../README.md) for all options.
