# Recorded Field2Sim → ns-3 execution

Inputs: `ui-export/sensors.tcl` and `ui-export/uav.tcl`, copied from the
Field2Sim application's ns-3 Output preview. See README.md for the authoring record.

| Collector | Sent by sensors | Received | Distinct sensors heard | Position checks |
|---|---:|---:|---:|---:|
| Mobile UAV | 45,446 | 545 | 120 / 120 | 238 passed |
| Parked at the route start | 45,446 | 0 | 0 / 120 | 238 passed |

The route lasts 757.419 seconds (5–762.419 s), at a prescribed constant Z=30 m.
The maximum observed position error in the mobile run is 1.23133107253e-8 m.
The low overall packet delivery fraction (1.1992%) reflects short radio contact
windows and continuous unbuffered transmissions. Hearing all sensors does not
mean collecting every transmitted packet. The parked control is at the route
start, not at an optimized stationary collector location. The 0-packet result
is specific to that location and the selected radio model/settings.

These are single-seed modeled results. No manuscript edits, LaTeX compilation,
commit, or push were performed for this experiment.
