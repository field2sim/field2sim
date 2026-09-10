# Cooja — static and mobile console examples

## Download and build

Linux/Ubuntu prerequisites: Python 3, Git and JDK 21. For example:

```bash
sudo apt install git openjdk-21-jdk python3
# In a directory for simulator installations (not inside this repository):
git clone https://github.com/contiki-ng/contiki-ng.git field2sim-contiki-ng
cd field2sim-contiki-ng
git checkout 6ac4608cdd8e007ae328905687db9a326dd09304
git submodule update --init tools/cooja
export CONTIKI_NG="$PWD"
export JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64
cd tools/cooja
git checkout 0a518f80c4a6c79a0cfda332f3d6bc6d7684bc7a
./gradlew build
```

Adjust `JAVA_HOME` for your platform. These revisions are recorded in
[toolchains.json](../toolchains.json). See the [official Cooja build instructions](https://github.com/contiki-ng/cooja#building).

## Run from the Field2Sim repository root

Create the local settings file once, from the repository root (keep an existing
file if you already configured another simulator):

```bash
cp -n examples/toolchains.env.example examples/toolchains.env
```

Edit that file and set **CONTIKI_NG (the directory containing tools/cooja/gradlew) and, if needed, JAVA_HOME (the JDK 21 directory)**. Replace these placeholders with your
own absolute paths; quotes allow spaces in directory names:

```bash
export CONTIKI_NG="/absolute/path/to/contiki-ng"
export JAVA_HOME="/absolute/path/to/jdk-21"
```

Only this simulator's settings are required. The local file is excluded from Git.
The launchers read it automatically; exported environment variables also work.

Check your paths before running (this does not compile or validate the simulator):

```bash
bash examples/cooja/static/run.sh --check
```

Then run the two scenarios:

```bash
bash examples/cooja/static/run.sh
bash examples/cooja/mobile/run.sh
```

`static/simulation.csc` contains three motes with IDs 1–3 and XYZ positions.
At 200 ms it reads their actual Position interfaces and checks three points.
Expected result: `PASS: cooja/static; 3/3 checks`.

`mobile/simulation.csc` references `[CONFIG_DIR]/positions.dat`. One mote has
ID 41; the trace refers to mote-array index 0. The runner uses that CSC to
create five checkpoint copies in the results folder and invokes them in one
headless Cooja command. Expected observations (ms, X, Y):

```text
200    0   0
2200   3  -4
5200  -2  -4
8800  -2  -4
9200   0   0
```

Expected result: `PASS: cooja/mobile; 5/5 checks`. The final observation verifies
wraparound: the tested Mobility plugin immediately restarts at the first
waypoint after the timestamp at 9 s. It does not interpolate between waypoints.
Five copies allow independent timed observations without application log events.
The committed mobile CSC can also run directly and checks the last observation.

Native launch pattern (use absolute paths and keep the mobile files together):

```bash
cd "$CONTIKI_NG/tools/cooja"
./gradlew --no-daemon run --args="--no-gui --contiki=$CONTIKI_NG /absolute/path/to/simulation.csc"
```

The wrapper prints the exact native command and collects Cooja's `COOJA.testlog`.
Both examples use the built-in `DisturberMoteType` to demonstrate placement;
they require no application firmware. Static XYZ is stored in CSC. The tested
Mobility plugin ignores the fifth Z column; these examples intentionally use 2D.

You can also enter either scenario directory and use `bash run.sh`; paths are
resolved relative to the script, not your working directory. Missing or invalid
installation paths produce an explanatory error. Full output is saved in
`examples/results/cooja/<scenario>/console.txt`, with a `result.json` summary.
See the [shared launcher documentation](../README.md) for all options.
