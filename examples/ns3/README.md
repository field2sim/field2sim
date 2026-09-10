# ns-3 — static and mobile console examples

## Download/build

Install the prerequisites described in the [official installation guide](https://www.nsnam.org/docs/installation/html/index.html).
On Ubuntu, the core examples need Python 3, a C++ compiler, CMake, Ninja and wget:

```bash
sudo apt install python3 g++ cmake ninja-build wget bzip2
# In a directory for simulator installations:
wget https://www.nsnam.org/release/ns-3.47.tar.bz2
tar xjf ns-3.47.tar.bz2
cd ns-3.47
export NS3_ROOT="$PWD"
./ns3 configure --build-profile=optimized --enable-modules=core,network,mobility
./ns3 build
```

Tested version: 3.47. See [toolchains.json](../toolchains.json) for the archive checksum
and the [official build tutorial](https://www.nsnam.org/docs/tutorial/html/getting-started.html).

## Run from the Field2Sim repository root

Create the local settings file once, from the repository root (keep an existing
file if you already configured another simulator):

```bash
cp -n examples/toolchains.env.example examples/toolchains.env
```

Edit that file and set **NS3_ROOT (the directory containing the ns3 launcher and scratch/)**. Replace these placeholders with your
own absolute paths; quotes allow spaces in directory names:

```bash
export NS3_ROOT="/absolute/path/to/ns-3.47"
```

Only this simulator's settings are required. The local file is excluded from Git.
The launchers read it automatically; exported environment variables also work.

Check your paths before running (this does not compile or validate the simulator):

```bash
bash examples/ns3/static/run.sh --check
```

Then run the two scenarios:

```bash
bash examples/ns3/static/run.sh
bash examples/ns3/mobile/run.sh
```

The wrapper copies `field2sim-example.cc` to the installation's
`scratch/field2sim-console-example.cc`, builds that target, then executes it.
It refuses to overwrite a different existing file at that path.
`Ns2MobilityHelper` loads `static/mobility.tcl` or `mobile/mobility.tcl`;
observations come from the native MobilityModel. Expect three static checks
or eight mobile checks, each within 1e-6 m of its expected XYZ.

Native invocation after the first wrapper build:

```bash
cd "$NS3_ROOT"
./ns3 run --no-build 'field2sim-console-example --traceFile=/absolute/path/to/mobility.tcl --scenario=mobile'
```

The examples are planar (Z=0). ns-3 3D behavior depends on the consuming model.
Changing-Z Tcl routes were not reproduced by the tested Ns2MobilityHelper
configuration; choose and validate a suitable model for that use case.
See the [Ns2MobilityHelper API](https://www.nsnam.org/doxygen/d2/d32/classns3_1_1_ns2_mobility_helper.html).

You can also enter either scenario directory and use `bash run.sh`; paths are
resolved relative to the script, not your working directory. Missing or invalid
installation paths produce an explanatory error. Full output is saved in
`examples/results/ns3/<scenario>/console.txt`, with a `result.json` summary.
See the [shared launcher documentation](../README.md) for all options.
