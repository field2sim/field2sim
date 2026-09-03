# Propagation Profiles and Simulator Adapters

## Scope and evidence boundary

The environment selector is a cited initialization aid, not an automatic site-survey system. A label such as *Urban* or *Forest* identifies a relevant model family and the context that must be collected; it does not uniquely determine path loss. Cooja-Positioner therefore keeps two artifacts separate:

1. `propagation-profile-<profile>.json` records the cited source, applicability, user inputs, caveats, and BibTeX.
2. `propagation-<profile>-<target>.<extension>` records one target-specific configuration and an explicit fidelity label: `native`, `parameterized-approximation`, or `unsupported`.

`native` means that the pinned target provides the same mathematical model family. It does not imply identical random processes, radio thresholds, packet outcomes, or agreement with a future physical deployment.

## Simulator-neutral numerical representation

All serializers consume the same validated intermediate representation in `propagation-adapters.js`. Frequency, Tx/Rx height, system loss, reference distance, maximum evaluation/cutoff range, shadowing sigma, and random seed are retained with source identifiers and parameter origin.

For frequency \(f\), distance \(d\), speed of light \(c\), and system loss \(L_\mathrm{dB}\) expressed in decibels, the free-space reference is

\[
PL_\mathrm{FS}(d)=20\log_{10}\!\left(\frac{4\pi d f}{c}\right)+L_\mathrm{dB}.
\]

The common calibrated proxy is

\[
PL(d)=PL(d_0)+10n\log_{10}\!\left(\frac{d}{d_0}\right)+X_\sigma,
\]

where \(n\) is the path-loss exponent and \(X_\sigma\) is an optional zero-mean Gaussian term expressed in decibels. The deterministic reference vectors use \(X_\sigma=0\).

For the idealized two-ray ground family, the crossover distance is

\[
d_c=\frac{4\pi h_t h_r}{\lambda}.
\]

The neutral evaluator uses Friis below \(d_c\) and the asymptotic \(d^{-4}\) two-ray mean above \(d_c\). A simulator's implementation details may differ around the crossover and in its surface/reflection assumptions.

## Measurement-derived agriculture conditions

The 2.4-GHz agriculture profile uses the path-loss exponents reported by Dhanavanthan, Rao, and Mahesh. The paper derives these values with a 1 m free-space reference and a zero shadowing term for the exponent fit; no single “generic agriculture” value is introduced.

| Condition | \(n\) |
|---|---:|
| Corn — growth | 4.90 |
| Corn — maturity | 5.77 |
| Paddy — growth | 4.85 |
| Paddy — maturity | 5.47 |
| Groundnut — growth | 5.08 |
| Groundnut — maturity | 5.97 |
| Coconut garden — green grass | 4.70 |
| Open lawn — dry grass | 4.90 |
| Open lawn — wet grass | 4.80 |

Source: [Dhanavanthan et al., “RF Propagation Experiments in Agricultural Fields and Gardens for Wireless Sensor Communications,” PIER C 39, 2013](https://doi.org/10.2528/PIERC13030710).

## Target mappings

### Cooja

The exporter emits a `<radiomedium>` fragment for `org.contikios.cooja.radiomediums.LogisticLoss`. The web interface initializes `transmitting_range` to the requested 50 m and preserves the Cooja defaults for `success_ratio_tx` (1.0), `rx_sensitivity` (-100 dBm), `rssi_inflection_point` (-92 dBm), `awgn_sigma` (3.0 dB), and disabled time variation. The selected cited condition replaces only `path_loss_exponent`. Source-reported spatial variation is retained in the evidence artifact and is not copied automatically into Cooja's per-reception AWGN term. The simulation-level `randomseed` is emitted as a separate placement comment because it belongs outside `<radiomedium>`.

The lower web workflow does not synthesize a simulation or write positions into a `.csc`. Instead, it accepts one existing researcher-created Cooja simulation, replaces its single `<radiomedium>` element with the selected LogisticLoss configuration, and updates or inserts `<randomseed>` under `<simulation>`. Existing mote types, firmware references, node positions, Mobility and ScriptRunner configurations, and unrelated plugins are preserved. If the former radio medium was UDGM, the incompatible `UDGMVisualizerSkin` entry is removed while the remaining Visualizer skins are retained.

### ns-2

The exporter emits Tcl using the pinned ns-2 2.35 classes `Propagation/FreeSpace`, `Propagation/Shadowing`, or `Propagation/TwoRayGround`. Log-distance parameters map to `pathlossExp_`, `std_db_`, and `dist0_`; the generated propagation instance is intended for `-propInstance`. Unequal two-ray endpoint heights must be assigned at node/antenna level because one global `Antenna/OmniAntenna Z_` cannot encode both.

### ns-3

The exporter emits a C++ factory returning one of `FriisPropagationLossModel`, `LogDistancePropagationLossModel`, `TwoRayGroundPropagationLossModel`, or `ItuR1411LosPropagationLossModel`. The standard LogDistance class reproduces the deterministic mean but has no Gaussian-shadowing sigma attribute; requesting nonzero sigma therefore downgrades the mapping to `parameterized-approximation` and the omission is written into the file. The urban NLoS exporter does not silently instantiate `ItuR1411NlosOverRooftopPropagationLossModel`, because that model needs rooftop, street, building, orientation, environment, and city-size inputs that cannot be inferred from the environment label.

### OMNeT++ / INET

The exporter emits an `omnetpp.ini` fragment using INET 4.7 `FreeSpacePathLoss`, `LogNormalShadowing`, or `TwoRayGroundReflection`. INET's LogNormalShadowing `sigma` parameter is a unitless number interpreted in decibels, while `systemLoss` carries the `dB` unit. Two-ray endpoint heights remain mobility Z coordinates above the configured `FlatGround`. Module paths may need adaptation to the user's NED hierarchy.

## Profiles that require calibration

ITU-R P.1411 contains multiple frequency- and geometry-specific urban submodels, and ITU-R P.833 contains multiple vegetation-loss submodels with foliage/path inputs. Consequently, the generic mappings for urban NLoS and forest/vegetation remain `unsupported` until the user supplies a site-measured or otherwise justified proxy exponent. After that input, a log-distance configuration can be downloaded, but it remains labelled `parameterized-approximation` and does not claim to implement the full Recommendation.

Primary sources:

- [Recommendation ITU-R P.1411-13](https://www.itu.int/rec/R-REC-P.1411-13-202509-I/en)
- [Recommendation ITU-R P.833-10](https://www.itu.int/rec/R-REC-P.833-10-202109-I/en)
- [Gaitan et al., near-shore two-ray evaluation, VTC2020-Spring](https://doi.org/10.1109/VTC2020-Spring48590.2020.9129548)
- [Friis, “A Note on a Simple Transmission Formula,” 1946](https://doi.org/10.1109/JRPROC.1946.234568)

## Verification status

`tests/propagation-adapters.test.js` pins the Friis, log-distance, crossover, and far-field two-ray reference values; all nine agricultural exponents; mapping classifications; Cooja native-field serialization; deterministic serialization; and required target syntax.

Additional checks performed against the pinned toolchains on 2026-08-23:

- Cooja loaded and ran a headless `.csc` scenario containing the generated LogisticLoss fragment (`TEST OK`).
- Real ns-2 2.35 loaded the generated Shadowing Tcl and returned class `Propagation/Shadowing`, `n=4.9`, `sigma=0`, and `d0=1`.
- ns-3.47 compiled and instantiated all four emitted native classes: Friis, LogDistance, TwoRayGround, and ITU-R P.1411 LoS.
- The INET 4.7 `.ini` keys and units were audited against the exact tagged NED/C++ sources. A pinned OMNeT++ 6.4.0/INET 4.7.0 runtime then loaded the generated FreeSpace, Agriculture, and Coastal fragments and returned the expected model classes, `alpha`, `sigma`, `systemLoss`, and `FlatGround` type. The reproducible result is stored in `integrations/results/inet-propagation-report.json`.
