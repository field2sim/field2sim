# Z1 range-characterization package (Cooja LogisticLoss)

This folder contains the 216-case Zolertia Z1 experiment reported as Scenario III of the Field2Sim paper. Two Z1 motes exchange one-hop link-local UDP packets over CSMA, with no routed DODAG. Every case is a separately configured Cooja simulation whose LogisticLoss radio medium was written by the repository's `cooja-csc-pathloss-writer.js`.

Design: 18 profile conditions × two RX anchors (`-95` and `-100` dBm) × six Tx–Rx distances (10–60 m) = 216 cases. Warm-up 40 s, duration 85 s, 44 completed sends per case, deterministic seed 123456. For each profile/RX pair, `transmitting_range` is solved from the source mean model so that the source mean RSSI equals the selected RX anchor at that range.

## Contents

| Path | Content |
|---|---|
| `calibration-profiles.json`, `profiles.json`, `protocol.json` | Profile coefficients, sources, and caveats; experiment protocol |
| `baseline/`, `firmware/` | Two-mote baseline CSC and Z1 UDP firmware sources (build output excluded) |
| `generated/manifest-calibrated-z1.json` | 216-row case manifest |
| `generated/CALIBRATED-Z1-CASE-LIST.md` | Case catalog in execution order |
| `generated/calibrated-z1/*.csc` | The 216 executed CSC files |
| `generated/inspection-calibrated-z1.json` | Pre-execution structural/manifest checks and SHA-256 digest of every CSC |
| `results/raw/calibrated-z1/*.csv` | One raw CSV per case (one row per transmitted sequence number; lost packets have an empty `rssi_dbm`) |
| `results/runtime/calibrated-z1/` | Per-case ScriptRunner logs and the Cooja test log |
| `results/cooja-calibrated-z1.log` | Combined Cooja console log |
| `results/run-report-calibrated-z1-full.json` | Combined run report |
| `results/summary-calibrated-z1.csv` | Per-case PRR and conditional RSSI statistics |
| `results/plots/calibrated-z1-*` | PRR and RSSI plots |
| `scripts/` | Case generation, inspection, sequential execution, analysis, and plotting scripts |

The CSC files are published byte-for-byte as executed, so their SHA-256 digests can be checked against `generated/inspection-calibrated-z1.json`. They therefore contain the absolute log paths of the original execution machine. Regenerating the cases elsewhere writes local paths and produces different digests while leaving the radio parameters unchanged.

## Condition provenance

The agricultural conditions use the catalog exponents directly. The catalog's urban NLoS and forest profiles need street or vegetation geometry that a two-mote link does not define, so the urban and forest/plantation conditions enter through the researcher-supplied proxy-exponent path (see the paper's propagation-mapping table).

| Condition | Family | Source | n (urban: α) | σ (dB) | Source distance range |
|---|---|---|---|---|---|
| Urban/suburban LoS | Urban | ITU-R P.1411-13 site-general | 2.07 | 4.91 | 5–660 m |
| Urban high-rise NLoS | Urban | ITU-R P.1411-13 site-general | 3.73 | 7.62 | 20–715 m |
| Urban low-rise/suburban NLoS | Urban | ITU-R P.1411-13 site-general | 4.52 | 8.02 | 10–250 m |
| Residential NLoS | Urban | ITU-R P.1411-13 site-general | 3.01 | 3.07 | 30–170 m |
| Corn, growth | Agriculture | Dhanavanthan et al. 2013 | 4.90 | n.r. | 5–20 m |
| Corn, maturity | Agriculture | Dhanavanthan et al. 2013 | 5.77 | n.r. | 5–20 m |
| Paddy, growth | Agriculture | Dhanavanthan et al. 2013 | 4.85 | n.r. | 5–20 m |
| Paddy, maturity | Agriculture | Dhanavanthan et al. 2013 | 5.47 | n.r. | 5–20 m |
| Groundnut, growth | Agriculture | Dhanavanthan et al. 2013 | 5.08 | n.r. | 5–20 m |
| Groundnut, maturity | Agriculture | Dhanavanthan et al. 2013 | 5.97 | n.r. | 5–20 m |
| Coconut garden, green grass | Agriculture | Dhanavanthan et al. 2013 | 4.70 | n.r. | 5–20 m |
| Open lawn, dry grass | Agriculture | Dhanavanthan et al. 2013 | 4.90 | n.r. | 5–20 m |
| Open lawn, wet grass | Agriculture | Dhanavanthan et al. 2013 | 4.80 | n.r. | 5–20 m |
| Mango plantation | Forest/plantation | Rama Rao et al. 2012 | 4.19 | 10* | single separation, 20 m |
| Guava plantation | Forest/plantation | Rama Rao et al. 2012 | 4.32 | 10* | single separation, 16 m |
| Tropical scrub forest, position 1 | Forest/plantation | Rama Rao et al. 2012 | 5.24 | 10* | single separation, 15 m |
| Tropical scrub forest, position 2 | Forest/plantation | Rama Rao et al. 2012 | 4.15 | 10* | single separation, 23 m |
| Free space | Reference | Friis | 2.00 | 0 | ≥1 m (theoretical) |

- Urban rows use the ITU-R P.1411 model `PL = 10α log10(d) + β + 10γ log10(f_GHz)`; the table lists α (β and γ are in `calibration-profiles.json`). The other rows use `PL(d) = FSPL(1 m, 2.4 GHz) + 10 n log10(d)`.
- n.r.: no shadowing sigma reported by the source; `awgn_sigma = 0` was used.
- \*: the 10-dB sigma for the forest/plantation conditions is an experiment assumption, not a value taken from the source.
- Cases beyond a source's distance range are labelled `EXTRAPOLATION` in every CSC and in `summary-calibrated-z1.csv`.

Sources: ITU-R P.1411-13 (2025); B. Dhanavanthan, T. R. Rao, G. Mahesh, *PIER C* 39, 103–118, 2013, doi:10.2528/PIERC13030710; T. Rama Rao, D. Balachander, N. Tiwari, *Proc. IEEE ICCS 2012*, 194–198, doi:10.1109/ICCS.2012.6406137.

## Reproduction

Requires Node.js, Python 3 with matplotlib, and a Contiki-NG checkout with Cooja. From this folder:

```bash
CONTIKI_NG=/path/to/contiki-ng node scripts/generate-cases.js --suite=calibrated-z1
node scripts/inspect-calibrated-cases.js
CONTIKI_NG=/path/to/contiki-ng node scripts/run-calibrated-sequential.js
python3 scripts/analyze-calibrated.py
python3 scripts/plot-calibrated.py
```

Set `CONTIKI` in `firmware/Makefile` and `baseline/Makefile` to your Contiki-NG path if it differs from the default.

## Evidence boundary

This is a simulator-level characterization of Cooja LogisticLoss as consumed by Z1 motes. Recomputing `transmitting_range` for each RX anchor cancels the anchor change in the mean-RSSI expression, so the design is not an independent receiver-sensitivity experiment. The `-95` dBm CC2420 data-sheet value is specified at 1% PER; using it as the LogisticLoss threshold is a sensitivity-analysis assumption, not a PER-equivalent calibration. `awgn_sigma` is sampled per reception and is not spatially correlated shadowing. The suite uses one seed and is not an inferential comparison, a field calibration, or a universal distance–RSSI law.
