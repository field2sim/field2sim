# Simulator integration validation

The automated `simulator-adapters.test.js` suite performs deterministic
golden-output, independent grammar parsing, and semantic validation for:

- Cooja Mobility rows (`node time x y z`);
- ns-2 Tcl mobility statements and the ns-3 `Ns2MobilityHelper` grammar;
- INET `BonnMotionMobility` lines containing ordered `t x y` triplets.

These checks remain format-level conformance tests. Simulator execution is
reported separately so that the availability of an external toolchain cannot
be confused with serialization correctness.

## Executed Cooja parser experiment

The first simulator-execution layer now connects the current adapter to the
actual `org.contikios.cooja.plugins.Mobility` implementation. The experiment
used the following pinned inputs:

| Component | Revision or digest |
|---|---|
| Contiki-NG | `6ac4608cdd8e007ae328905687db9a326dd09304` |
| Cooja | `0a518f80c4a6c79a0cfda332f3d6bc6d7684bc7a` |
| `Mobility.java` | SHA-256 `634bfd55e79a067ce6a3614a1dda6b5b57da00747e30da6710cbf7dcdb50ccef` |
| Cooja Java toolchain | Java 21 |

The committed mobile `positions.dat` is compared byte-for-byte with the output
of the current Cooja adapter before simulator execution. Cooja is then launched
without a graphical interface. Five independent simulation checkpoints read
the mote position from Cooja's `Position` interface rather than re-parsing the
input file externally.

| Checkpoint | Simulation time | Expected `(x,y,z)` m | Observed `(x,y,z)` m | Error |
|---|---:|---:|---:|---:|
| Initial waypoint | 0.2 s | `(0,0,0)` | `(0,0,0)` | 0 m |
| Waypoint at 2 s | 2.2 s | `(3,-4,0)` | `(3,-4,0)` | 0 m |
| Waypoint at 5 s | 5.2 s | `(-2,-4,0)` | `(-2,-4,0)` | 0 m |
| Hold before 9 s | 8.8 s | `(-2,-4,0)` | `(-2,-4,0)` | 0 m |
| State after wrap | 9.2 s | `(0,0,0)` | `(0,0,0)` | 0 m |

All five headless simulations returned `TEST OK`; the maximum measured
position error was 0 m. The executable report is stored in
`integrations/results/cooja-mobile-report.json`.

## Compatibility limits discovered

The execution result supports planar mobile traces, but the pinned plugin has
three material semantic constraints:

1. The first field selects a zero-based mote-array index, not the mote ID.
2. The plugin consumes only the first four fields. The exported Z value is
   ignored and the mote's previous Z coordinate is retained.
3. `WRAP_MOVES` is enabled. At the final timestamp, the terminal waypoint is
   applied and the first waypoint is immediately scheduled at the same
   simulation time. The terminal waypoint is therefore not a stable final
   state.

The wrap behavior also makes an all-zero-time static export unsafe for this
consumer: after the last row, the plugin starts another zero-duration period,
which can prevent simulation time from advancing. The static fixture is kept
as an exact negative compatibility case and was deliberately not reported as a
passing execution.

Therefore, the evidence justifies the claim that the tested adapter artifact
was loaded and executed by the pinned Cooja Mobility parser for a planar cyclic
mobile scenario. It does not justify general static, three-dimensional, or
version-independent Cooja interoperability.

Following this result, the Cooja adapter applies fail-closed compatibility
guards before serialization. A fixed scenario is rejected because the tested
consumer cannot safely execute an all-zero-time trace. A mobile scenario with
any nonzero local Z coordinate is also rejected because the consumer would
silently retain its previous Z coordinate. Successful planar mobile artifacts
carry explicit warnings that mobility is cyclic and that exported node numbers
select zero-based mote-array indices rather than mote IDs. These warnings are
displayed in the application output panel and are also returned in the
programmatic artifact metadata.

## Executed ns-3 parser experiment

The ns-3 execution layer uses the official ns-3.47 source archive, whose
published SHA-1 digest (`897c3f2db2c6de6a8291e46b3020dbeb1af75269`)
is recorded in `integrations/toolchains.json`. Before execution, the mobile and
static fixture files are compared byte-for-byte with the current ns-3 adapter
output. The dedicated C++ verifier then loads those exact files through
`ns3::Ns2MobilityHelper` and reads positions from the resulting
`MobilityModel` objects.

The mobile fixture contains four waypoints at 0, 2, 5, and 9 s with unequal
segment durations and speeds. Eight checks cover the initial state, six
interior segment positions, and the terminal hold. The static fixture contains
three non-collinear nodes and checks all three node indices at 0.1 s. All 11
checks passed with a maximum Euclidean position error of `1e-9` m against an
acceptance tolerance of `1e-6` m. The machine-readable evidence, including
the trace and verifier SHA-256 values, is stored in
`integrations/results/ns3-integration-report.json`.

This result establishes parser-level execution for planar static traces and
planar, constant-altitude mobile traces in the pinned release. It does not
establish changing-altitude `setdest` behavior, version-independent
compatibility, radio/channel fidelity, or protocol-level correctness.

## Executed INET/OMNeT++ parser experiment

The INET execution layer uses OMNeT++ 6.4.0 and INET 4.7.0. The exact Git
revisions and the SHA-256 digests of the tested `BonnMotionMobility` C++ and
NED sources are recorded in `integrations/toolchains.json`.

| Component | Revision or digest |
|---|---|
| OMNeT++ 6.4.0 | `2cf25223fee7c2386f4c610f6fcb12d9585497ab` |
| INET 4.7.0 | `dfe270b21f38856874e3ba50ef964bd557e4bb99` |
| `BonnMotionMobility.cc` | SHA-256 `3225dfca00792f11361de0eb3597cfdcdef17cba1c43a50da209a01cac72f620` |
| `BonnMotionMobility.ned` | SHA-256 `b9010fc0b15cc9e0190654ab654a4097714f7241ddb43f5bda032db35b5968a3` |

Before execution, the committed mobile and static BonnMotion files are
compared byte-for-byte with current adapter output. Each tested mobility
module is placed inside an INET `@networkNode` host, and the trace line is
selected through `nodeId`. A dedicated OMNeT++ module samples positions via
INET's `IMobility` interface; it therefore observes simulator state instead
of parsing the fixture independently.

The same eight mobile checkpoints and three non-collinear static positions
used for the ns-3 test all passed. The maximum reported Euclidean error was
0 m at the verifier's nine-decimal output resolution, with an acceptance
tolerance of `1e-6` m. The machine-readable evidence is stored in
`integrations/results/inet-integration-report.json`.

This result establishes parser-level execution for planar static traces and
planar mobile traces in the pinned releases. It does not establish 3-D
BonnMotion input, compatibility with arbitrary simulator releases,
radio/channel fidelity, or protocol-level correctness.

## Executed INET propagation-configuration experiment

The propagation runner is independent from the BonnMotion mobility experiment.
It exact-hashes ten NED/C++ contracts from INET 4.7.0 and requires the
`PhysicalEnvironment`, `PhysicalLayerCommon`, and
`PhysicalLayerWirelessCommon` features. A temporary OMNeT++ verifier loads
three files generated by the current propagation adapter and reads parameters
from the instantiated modules.

| Generated profile | Observed INET type | Observed parameters | Status |
|---|---|---|---|
| Free-space baseline | `FreeSpacePathLoss` | `alpha=2`, `systemLoss=0 dB` | PASS |
| Agriculture, corn growth | `LogNormalShadowing` | `alpha=4.9`, `sigma=0`, `systemLoss=0 dB` | PASS |
| Coastal over-water | `TwoRayGroundReflection` | `alpha=2`, `FlatGround`, `systemLoss=0 dB` | PASS |

The exact source hashes, generated-artifact hashes, neutral numerical reference
vectors, expected values, and observed runtime values are stored in
`integrations/results/inet-propagation-report.json`.

This evidence supports syntax, class selection, and parameter transfer for the
three INET model families in the pinned releases. It does not show that a
family-level two-ray or log-normal model reproduces a specific deployment, nor
does it imply cross-simulator packet or fading equivalence.
