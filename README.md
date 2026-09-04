# Field2Sim

> From field context to reproducible network-simulation scenarios.

Field2Sim is a client-side, browser-based editor that translates field context into simulator-ready WSN and IoT scenario artifacts. Here, *field context* means deployment-relevant geographic information and user-supplied or citation-backed propagation assumptions; it does not imply automated site surveying or channel-model inference. Field2Sim preserves WGS84 positions, node identifiers, waypoint timing, altitude, and the local-origin policy, then exports simulator-specific position, mobility, and propagation artifacts for Cooja, ns-2, ns-3, and INET/OMNeT++.

**Online application:** https://field2sim.github.io/

No application server is required. Leaflet, the map rendering library, is bundled locally and does not require network access. Map tiles and place search currently use external OpenStreetMap and Nominatim services, so those two functions require network access.

## What it is for

The tool connects field-oriented deployment planning with simulator setup. A user can mark exact map positions, retain stable node IDs that may later be associated with firmware or protocol roles, generate regularly spaced nodes inside a polygon, or create a mobile scan route over a selected area. The tool does not assign network roles, predict coverage, or replace the target simulator's radio, protocol, energy, or firmware models.

## Features

### Scenario authoring

- **Mobile scenario:** one node ID with ordered waypoints and increasing timestamps.
- **Static scenario:** multiple node IDs with zero-time placements.
- **Point Mode:** manually add, drag, rename, select, and delete geographic points.
- **Polygon Mode — static:** generate an approximately hexagonal regular deployment inside a user-drawn polygon using the selected metre spacing.
- **Polygon Mode — mobile:** generate a horizontal or vertical lawn-mower/scan path inside a polygon.
- **Circle guide:** display a placement guide sized from 10–50 m presets or a custom value. It is a geometric aid, not a connectivity guarantee.
- **Duplicate Node ID guard:** Static-scenario renames and conversion are blocked when a chosen ID collides with another node.
- **Session persistence:** the current scenario is saved to the browser's local storage and restored automatically on reload.
- Undo/redo, multi-selection, keyboard shortcuts, text input, and Cooja position import.

### Coordinate model

- Canonical geographic state in **WGS84 / EPSG:4326**.
- WGS84 geodetic → ECEF → local ENU transformation.
- **First input row** origin policy: the first valid waypoint becomes local `(0, 0)`.
- **Custom WGS84 origin** policy: offsets are retained from a fixed user-specified reference, set by typing coordinates or by right-clicking a placed node and choosing **Set as Origin**.
- Coordinate results are independent of map pan, zoom, and viewport state.
- Geographic altitude is retained in the canonical scenario; each export adapter enforces its supported dimensionality.

### Simulator exports

| Target | Generated file | Current evidence boundary |
|---|---|---|
| Cooja Mobility | `positions.dat` | Planar mobile trace; zero-based mote-array index; tested plugin is cyclic. Static and nonzero-Z exports are rejected. |
| ns-2 | `mobility-ns2.tcl` | Static initialization and planar `setdest` mobility statements; tested with real ns-2 2.35 (`MobileNode` CMU model). |
| ns-3 | `mobility-ns3.tcl` | Consumed through `Ns2MobilityHelper`; static and planar mobile fixtures tested with ns-3.47. |
| INET/OMNeT++ | `mobility-bonnmotion.movements` | Planar BonnMotion `t x y` triplets; tested with OMNeT++ 6.4.0 and INET 4.7.0. |

The adapter warnings shown by the application are part of the supported behavior. Format-level validation does not imply arbitrary-version simulator compatibility.

### Provenance-aware propagation initialization

The propagation layer is an initialization and documentation aid, not an automatic coverage predictor. Its simulator-neutral catalog represents five deployment-environment families plus a free-space baseline through six cited profile definitions: urban open-street LoS, urban street-canyon NLoS, 2.4-GHz agriculture, forest/vegetation, 2.4-GHz coastal over-water, and Friis free space. Every profile retains its source, frequency applicability, required context, caveats, parameter origins, and BibTeX provenance.

The shared adapters assess Cooja, ns-2, ns-3, and INET mappings before serialization. Every result is labelled `native`, `parameterized-approximation`, or `unsupported`. An unsupported result is deliberate: the tool does not invent a coefficient when a model requires rooftop geometry, foliage depth, calibration data, or other context that was not supplied. Geometry/mobility artifacts and propagation artifacts remain separate so that one geographic scenario can be studied under controlled radio assumptions without implying cross-simulator equivalence.

The current browser's lower propagation workflow specializes this approach for Cooja. It exposes 18 cited condition-level choices across urban, agriculture, forest/plantation, and free-space reference groups, together with the LogisticLoss fields `transmitting_range`, `success_ratio_tx`, `rx_sensitivity`, `rssi_inflection_point`, `path_loss_exponent`, `awgn_sigma`, `enable_time_variation`, and the simulation-level `randomseed`.

The browser does not create a new simulation or reposition motes. It accepts an existing researcher-created `.csc`, replaces its single `<radiomedium>` block with the configured LogisticLoss block, and updates or inserts the simulation-level `randomseed`. Mote types, firmware references, node positions, Mobility and ScriptRunner configurations, and unrelated plugins are preserved; an incompatible `UDGMVisualizerSkin` entry is removed when present. Browser permissions require the result to be downloaded as `*-pathloss.csc` rather than silently overwriting the selected file.

In Cooja LogisticLoss, `transmitting_range` is not a simple antenna range: it is both the strict candidate-receiver cutoff (`distance < transmitting_range`) and the distance at which mean RSSI is anchored to `rx_sensitivity`. Source-reported spatial shadowing is also not automatically equivalent to Cooja's independent per-reception AWGN term. The interface therefore presents these values as inspectable starting assumptions, not as site calibration or guaranteed packet reception.

## Quick start

1. Open https://field2sim.github.io/ or open `index.html` locally in a modern browser.
2. Search for the target area and choose **Mobile** or **Static**.
3. Select **Point Mode** for manual placement or **Polygon Mode** for generated deployment/scan paths.
4. Choose the **XY Origin** policy.
5. Add points, draw a polygon, or paste rows in this form:

   ```text
   node_id time_s latitude_deg longitude_deg [altitude_m]
   ```

6. Select the target simulator and press **Convert**.
7. Review compatibility warnings, then use **Copy** or **Save export**.
8. Optionally enable the lower Cooja propagation panel, select a cited condition, review the mapping and warnings, choose an existing researcher-created `.csc`, and download the preserved simulation with its radio medium rewritten as LogisticLoss.

Polygon drawing is completed with **Enter** or a double-click and cancelled with **Esc**.

## Important identifier convention

Editor node IDs are one-based. The tested Cooja Mobility plugin selects motes by zero-based simulation-array index. Therefore, editor node ID 101 is exported as Cooja mote index 100. This is an array position, not the firmware mote ID field stored in a `.csc` file.

## Keyboard shortcuts

| Action | Shortcut |
|---|---|
| Select all | Ctrl+A |
| Multiple selection | Ctrl+Shift+Click |
| Delete selected | Del / Backspace |
| Undo | Ctrl+Z |
| Redo | Ctrl+Y or Ctrl+Shift+Z |
| Show shortcut overlay | Ctrl+? |
| Finish polygon | Enter |
| Cancel polygon | Esc |

## Case-study dataset

[`artifacts/case-study-dataset/`](artifacts/case-study-dataset/) contains a deployment-to-Cooja case-study artifact:

- `geo_coordinates.csv` — five geographic mobile-anchor trajectories with nominal steps of 10, 20, 30, 40, and 50 m.
- `cooja_positions.csv` — corresponding local Cooja positions.
- `packet_receptions.csv` — receiver/anchor positions and RSSI for 25 radio-range/trajectory-step configurations.
- `scenario_summary.csv` — packet-observation counts derived from the 25 cleaned traces.

The deployment contained 100 stationary unknown nodes and one mobile anchor. The experiment observer excluded mote ID 100, so packet-derived summaries use the 99 retained stationary-node traces and are not extrapolated to 100. The packet traces depend on the configured Cooja radio and scenario model; they are reproducibility material, not universal wireless measurements or a localization benchmark.

## Propagation validation and Cooja characterization

Thirteen pinned target configurations were loaded successfully: three Cooja LogisticLoss proxy cases, three ns-2.35 propagation classes, four ns-3.47 propagation classes, and three OMNeT++ 6.4/INET 4.7 path-loss configurations. This verifies configuration loading and model instantiation in those releases; it does not establish field accuracy or numerical equivalence between simulators.

A separate deterministic Zolertia Z1 characterization executed 216 Cooja scenarios: 18 condition-level profiles × two RX anchors (`-95` and `-100` dBm) × six distances (10–60 m). All cases completed with 9,504 transmissions and 3,754 receptions. Of the 108 paired RX-anchor comparisons, 107 produced identical PRR and conditional RSSI. The only difference—Forest Guava at 20 m—was caused by LogisticLoss's strict candidate cutoff. Recomputing `transmitting_range` for each RX anchor cancels the anchor change in the mean-RSSI expression, so that design is not an independent receiver-sensitivity experiment.

The sweep uses one deterministic seed and includes source-domain extrapolations. It is reported as simulator-model characterization, not inferential statistics, hardware-PER calibration, or a universal distance–RSSI law.

## Validation and tests

The repository separates the coordinate core from simulator adapters:

- `coordinate-core.js` — WGS84/ECEF/ENU transformations.
- `simulator-adapters.js` — target-specific serialization, parsing, guards, and warnings.
- `propagation-profiles.js` — cited environment-profile catalog, applicability checks, and deterministic JSON artifacts.
- `propagation-adapters.js` — numerical intermediate representation, reference equations, mapping assessment, and four target serializers.
- `cooja-csc-pathloss-writer.js` — structure-preserving Cooja `.csc` inspection and LogisticLoss patching.
- `tests/` — coordinate, adapter, fixture, and integration runners.
- `integrations/` — pinned fixtures, verifier sources, toolchain metadata, and machine-readable reports.

Run dependency-free checks with Node.js:

```bash
node tests/coordinate-core.test.js
node tests/simulator-adapters.test.js
node tests/propagation-profiles.test.js
node tests/propagation-adapters.test.js
node tests/cooja-csc-pathloss-writer.test.js
node tests/cooja-integration-fixtures.test.js
node tests/ns2-integration-fixtures.test.js
node tests/ns3-integration-fixtures.test.js
node tests/inet-integration-fixtures.test.js
node tests/l-shaped-geometry-validation.test.js
```

The real simulator runners require separately installed, pinned toolchains. See [`tests/SIMULATOR_INTEGRATION.md`](tests/SIMULATOR_INTEGRATION.md) and the target-specific README files under [`integrations/`](integrations/).

The pinned INET propagation runner separately loads generated FreeSpace, Agriculture, and Coastal `.ini` fragments and checks the instantiated classes and parameters. Run it with:

```bash
OMNETPP_ROOT=/path/to/omnetpp-6.4.0 INET_ROOT=/path/to/inet-4.7.0 \
  node tests/run-inet-propagation-integration.js --require-toolchain
```

Its machine-readable evidence is `integrations/results/inet-propagation-report.json`; the equations and cross-simulator evidence boundary are documented in [`docs/PROPAGATION_ADAPTERS.md`](docs/PROPAGATION_ADAPTERS.md).

## Repository layout

```text
index.html                         Browser application
coordinate-core.js                 Coordinate transformation core
simulator-adapters.js              Simulator adapter registry
propagation-profiles.js            Cited propagation-profile catalog
propagation-adapters.js             Numerical IR and target propagation serializers
cooja-csc-pathloss-writer.js        Structure-preserving Cooja CSC patcher
keyboard_shortcuts.html            Standalone shortcut reference
vendor/leaflet/                    Locally bundled Leaflet (no CDN dependency)
tests/                             Automated checks and runners
integrations/                      Fixtures, verifier code, and reports
artifacts/case-study-dataset/      Geographic, Cooja, packet, and summary CSVs
docs/                              Evidence and documentation notes
media/                             Images used by validation/documentation
```

## Video and screenshots

The currently committed demonstration video and screenshots show an earlier interface revision. They remain available for historical orientation, but do not yet demonstrate polygon deployment, custom-origin selection, or all simulator exports. A new video will replace them.

- [Earlier-version demonstration video](field2sim-legacy-cooja-demonstration.mp4)
- [Earlier main-interface screenshot](preview.png)

## Citation

The final author list, article title, venue, DOI, and publication year will be added after peer review. For the anonymous software and reproducibility artifact, use the following interim citation:

> Field2Sim Project, “Field2Sim: A provenance-aware web-based scenario synthesizer for geo-grounded WSN simulations,” software and reproducibility artifact, 2026. [Online]. Available: https://github.com/field2sim/field2sim. Live application: https://field2sim.github.io/

BibTeX:

```bibtex
@misc{field2sim_2026,
  author       = {{Field2Sim Project}},
  title        = {Field2Sim: A Provenance-Aware Web-Based Scenario Synthesizer for Geo-Grounded WSN Simulations},
  year         = {2026},
  howpublished = {\url{https://github.com/field2sim/field2sim}},
  note         = {Software and reproducibility artifact. Live application: \url{https://field2sim.github.io/}}
}
```

## License

See [`LICENSE`](LICENSE).
