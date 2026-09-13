# Geographic agricultural scenario: 120 sensors and a UAV collector

This reproducible console experiment uses an illustrative
polygon is georeferenced near Gemlik, Turkey (polygon origin 40.4030 N, 29.1710 E).
Its parcel boundaries and land use have not been surveyed or verified.

## Generate and run

Install ns-3.47 as described in [the ns-3 README](../README.md). This example
requires core, network, mobility, propagation and wifi. In a dedicated checkout:

```bash
./ns3 configure --build-profile=optimized --enable-modules=core,network,mobility,wifi,propagation
```

Node.js and Python 3 are also required. From the Field2Sim repository root:

```bash
export NS3_ROOT=/your/path/to/ns-3.47
bash examples/ns3/agriculture/run.sh
```

Alternatively set NS3_ROOT in `examples/toolchains.env`. By default the runner uses the archived **actual Field2Sim UI exports** in
`ui-export/` (the optional `--regenerate` flag regenerates a separate scenario).
The runner copies the
application into its own ns-3 scratch subdirectory, builds it, runs mobile and
stationary collector cases, and verifies raw packet logs and sampled coordinates.
See `results-ui/build.log` or the corresponding case log if a command fails.

Open the geographic map using the repository's local server:

```bash
python3 -m http.server 8766
```

Use http://127.0.0.1:8766/ to open **Field2Sim itself**. Paste the archived
`ui-export/sensors-input.txt` and `ui-export/uav-input.txt` into separate Static
and Mobile groups, enable 3D export, and select sensor 13 as the shared origin.
The copy/export path used for the recorded run is described below.

An optional replay at http://127.0.0.1:8766/examples/ns3/agriculture/map.html
is a separate illustration, not a replacement for Field2Sim. It uses the
bundled Leaflet library and OpenStreetMap tiles with visible attribution. Hover
over a sensor to see received packet counts for both cases. The route animation
is a visualization of scheduled positions, not a live connection to ns-3.

## Authoring and transfer

`generate.js` executes the actual polygon authoring functions extracted from
`index.html`, using the production WGS84 coordinate kernel. The selected polygon
produces 120 sensors with 30 m triangular-lattice spacing, and 118 waypoints for a
vertical scan. Timing is then explicitly assigned to keep horizontal speed at
5 m/s (the UI also permits explicitly edited timestamps). The route begins at
5 s, is approximately 3787 m long, and finishes at approximately 762.419 s.

The production ns-3 adapter serializes both groups into `mobility.tcl`, loaded
by the real `Ns2MobilityHelper`. Nodes 1–120 in the editor map to simulator
indices 0–119; editor node 121 is the UAV (index 120). `sensors.txt` and
`uav-route.txt` contain `node-id time latitude longitude altitude` rows for
pasting into separate static and mobile Field2Sim groups, using the stated
custom origin and experimental 3D mode. Elevations are prescribed, not fetched:
sensors Z=0, UAV Z=30 m in a flat reference plane. This constant flight level
avoids the changing-Z `Ns2MobilityHelper` limitation. It is not a terrain-following
flight plan or evidence about actual site elevation.

## Packet experiment

- 121 ns-3 nodes; 120 ground sensors broadcast 128-byte application payloads.
- One packet per sensor every 2 s, with deterministic staggered starting phases.
- UAV receives application payloads through native NetDevice callbacks.
- IEEE 802.11g ad hoc, fixed 6 Mbps, 2.4 GHz channel 1, 0 dBm TX, -85 dBm RX sensitivity.
- LogDistance propagation, exponent 2.7, reference distance 1 m, reference loss
  40.045997 dB; constant-speed propagation delay. The exponent is a prescribed
  example assumption, not an olive-grove field calibration or cited crop profile.
- Native Wi-Fi MAC and PHY determine packet reception. RSSI comes from
  `MonitorSnifferRx`, not a distance-based postprocessing approximation.
- Packets use a custom link-layer protocol identifier; no IP routing or UDP.
- The stationary control uses identical sensor transmissions, initial collector
  position, Z, seed (123456), RNG run (1), radio settings and duration. Only the
  UAV's scheduled movement is removed.

## Outputs and verification

`results-ui/report.json` summarizes sent/received packet counts, delivery fraction,
number of distinct sensors heard, per-sensor counts and maximum position error.
Raw `*-tx.csv`, `*-rx.csv` and `*-positions.csv` support independent inspection.
120 static coordinates, every route-segment midpoint, and a terminal hold are
checked against simulator-reported positions. Received packet IDs must be unique
and present in transmission records. Input and source hashes are retained.

The two cases are a single-seed demonstration of a configured data-collection
workflow. They do not establish an optimal flight plan, field performance,
energy savings or statistical superiority. Nodes do not buffer data for later
collection; the counts concern packets received while each sensor is in radio
contact under the configured model. No manuscript files are modified by the runner.

## Actual browser authoring/export record

The scenario was loaded into two groups in the unmodified Field2Sim web app at
http://127.0.0.1:8770/. The geometry had been produced by the same app's polygon
functions; it was loaded through the geographic input editor, not by manually
clicking each polygon vertex in the browser. The map was checked to place the
example outside the town, in an area shown with tree/orchard symbols by OSM.
The crop species and parcel boundary are not established by this observation.

Sensor 13 was selected using the map's **Set as Origin (0,0)** context menu:
40.403467943 N, 29.171353402 E, altitude reference 0 m. Both groups used that fixed
origin. **Convert to ns-3** and **Copy** yielded `ui-export/sensors.tcl` and
`ui-export/uav.tcl`, preserved verbatim and concatenated for the real simulator.
The sensor coordinates are Z=0 and the UAV coordinates Z=30. The elevation API
was unavailable during this browser session; prescribed heights were explicitly
entered instead. No terrain elevation is claimed.

`prepare-ui.js` checks the exported syntax and numerical values against the
production coordinate kernel and adapter applied to the archived UI input rows.
Browser/Node.js elementary-math differences at the last decimal are allowed up
to 1e-7; the ns-3 position checks allow 1e-5 m. The raw UI exports, not regenerated
substitutes, are what ns-3 consumes. `ui-export/field2sim-screen.png` records the
application view. The initial pilot used another location; its outputs are not
the evaluated agricultural scenario and are excluded from `results-ui/`.

## Five-speed experiment and plots

No author account, laboratory server, or author-specific directory is required.
Clone the public repository and configure your own ns-3 installation:

```bash
git clone https://github.com/field2sim/field2sim.git
cd field2sim
cp -n examples/toolchains.env.example examples/toolchains.env
```

Set `NS3_ROOT` in that file to your ns-3.47 directory (containing `ns3` and
`scratch/`). Install Node.js and Python 3 and enable the Wi-Fi modules described
above. Then run from the repository root:

```bash
# One mobile traversal at 5 m/s and the stationary comparison:
bash examples/ns3/agriculture/run.sh
# Same route at 2, 5, 10, 15 and 20 m/s:
bash examples/ns3/agriculture/run-speed-sweep.sh
```

The sweep writes `speed-results/summary.csv`, `report.json` and `RESULTS.md`,
plus per-speed traces, geographic input rows and reception records. It ends with
`PASS` after checking the five runs. The bundled results can be inspected without
installing ns-3. Running again replaces the results in this example directory.

Plotting is optional and requires Matplotlib. From the repository root:

```bash
python3 -m venv .venv
. .venv/bin/activate
python3 -m pip install matplotlib
python3 examples/ns3/agriculture/plot-speed-results.py
```

PNG, SVG and PDF plots are written to `speed-results/`. Simulation itself does
not require Matplotlib, Internet access or an elevation API key after installation.
