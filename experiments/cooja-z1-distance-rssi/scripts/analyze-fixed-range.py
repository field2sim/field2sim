#!/usr/bin/env python3
"""Analyze the fixed-range-z1 suite: transmitting_range fixed, rx_sensitivity varied, 10 seeds.

Outputs:
  results/summary-fixed-range-z1.csv            one row per case
  results/summary-fixed-range-z1-by-seed.csv    profile x S_r x distance aggregated over seeds
  results/run-report-fixed-range-z1.json        combined run report (merges batch reports)
  results/plots/fixed-range-z1.{png,pdf}        mean RSSI and PRR vs distance
"""
import csv
import json
import math
import statistics as st
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

ROOT = Path(__file__).resolve().parents[1]
RESULTS = ROOT / "results"
SUITE = "fixed-range-z1"
MANIFEST = ROOT / "generated" / f"manifest-{SUITE}.json"


def expected_mean(sr, n, rt, d):
    # Pinned Cooja LogisticLoss mean: S_r - 10 n log10(d / R_t)
    return sr - 10 * n * math.log10(d / rt)


def main():
    manifest = json.loads(MANIFEST.read_text())
    cases = manifest["cases"]
    batch_reports = sorted(RESULTS.glob(f"run-report-{SUITE}-batch*.json"))
    report_cases = {}
    batches = []
    for path in batch_reports:
        rep = json.loads(path.read_text())
        batches.append({"report": str(path.relative_to(ROOT)), "startedAt": rep["startedAt"],
                        "finishedAt": rep["finishedAt"], "exitStatus": rep["exitStatus"],
                        "cases": len(rep["cases"])})
        for c in rep["cases"]:
            report_cases[c["caseId"]] = c

    rows = []
    for item in cases:
        raw = RESULTS / "raw" / SUITE / f"{item['caseId']}.csv"
        with raw.open(newline="") as handle:
            events = list(csv.DictReader(handle))
        sent = sum(1 for e in events if e["event"] == "tx")
        rssi = [float(e["rssi_dbm"]) for e in events if e["event"] == "rx"]
        rows.append({
            **{k: item[k] for k in ("caseId", "profileId", "label", "pathLossExponent", "distanceM",
                                    "transmittingRangeM", "rxSensitivityDbm", "awgnSigmaDb", "randomSeed")},
            "sent": sent,
            "received": len(rssi),
            "prr": len(rssi) / sent if sent else None,
            "rssiMeanDbm": st.mean(rssi) if rssi else None,
            "rssiStdDb": st.pstdev(rssi) if len(rssi) > 1 else None,
            "expectedMeanDbm": expected_mean(item["rxSensitivityDbm"], item["pathLossExponent"],
                                             item["transmittingRangeM"], item["distanceM"]),
            "completed": report_cases.get(item["caseId"], {}).get("completed"),
            "cscPath": item["cscPath"],
        })

    with (RESULTS / f"summary-{SUITE}.csv").open("w", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)

    groups = {}
    for r in rows:
        groups.setdefault((r["profileId"], r["rxSensitivityDbm"], r["distanceM"]), []).append(r)
    agg = []
    for (pid, sr, d), g in groups.items():
        prr = [x["prr"] for x in g]
        means = [x["rssiMeanDbm"] for x in g if x["rssiMeanDbm"] is not None]
        agg.append({
            "profileId": pid, "label": g[0]["label"], "pathLossExponent": g[0]["pathLossExponent"],
            "transmittingRangeM": g[0]["transmittingRangeM"], "awgnSigmaDb": g[0]["awgnSigmaDb"],
            "rxSensitivityDbm": sr, "distanceM": d, "seeds": len(g),
            "prrMean": st.mean(prr), "prrStd": st.pstdev(prr), "prrMin": min(prr), "prrMax": max(prr),
            "rssiMeanOfMeansDbm": st.mean(means) if means else None,
            "rssiMeanStdAcrossSeedsDb": st.pstdev(means) if len(means) > 1 else None,
            "rssiMeanMinDbm": min(means) if means else None,
            "rssiMeanMaxDbm": max(means) if means else None,
            "expectedMeanDbm": g[0]["expectedMeanDbm"],
            "seedsWithReception": len(means),
        })
    agg.sort(key=lambda a: (a["profileId"], -a["rxSensitivityDbm"], a["distanceM"]))
    with (RESULTS / f"summary-{SUITE}-by-seed.csv").open("w", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(agg[0]))
        writer.writeheader()
        writer.writerows(agg)

    incomplete = [r["caseId"] for r in rows if r["completed"] is not True or not r["sent"]]
    report = {
        "schemaVersion": 1,
        "suite": SUITE,
        "design": manifest["design"],
        "caseCount": len(rows),
        "batches": batches,
        "incompleteCases": incomplete,
        "transmissions": sum(r["sent"] for r in rows),
        "receptions": sum(r["received"] for r in rows),
        "summary": str((RESULTS / f"summary-{SUITE}.csv").relative_to(ROOT)),
        "aggregate": str((RESULTS / f"summary-{SUITE}-by-seed.csv").relative_to(ROOT)),
    }
    (RESULTS / f"run-report-{SUITE}.json").write_text(json.dumps(report, indent=2) + "\n")

    # Plot: one column per profile; top = mean RSSI (mean ± std over seeds) with expected line; bottom = PRR.
    profiles = list(dict.fromkeys(a["profileId"] for a in agg))
    colors = {-90: "#1f77b4", -95: "#ff7f0e", -100: "#2ca02c"}
    fig, axes = plt.subplots(2, len(profiles), figsize=(3.4 * len(profiles), 5.2), sharex=True)
    for j, pid in enumerate(profiles):
        sub = [a for a in agg if a["profileId"] == pid]
        title = f"{sub[0]['label']}\n(n={sub[0]['pathLossExponent']}, $R_t$={sub[0]['transmittingRangeM']:.1f} m)"
        axes[0][j].set_title(title, fontsize=9)
        for sr in sorted({a["rxSensitivityDbm"] for a in sub}, reverse=True):
            s = [a for a in sub if a["rxSensitivityDbm"] == sr]
            d = [a["distanceM"] for a in s]
            m = [a["rssiMeanOfMeansDbm"] for a in s]
            e = [a["rssiMeanStdAcrossSeedsDb"] or 0 for a in s]
            axes[0][j].errorbar(d, m, yerr=e, marker="o", ms=3, capsize=2, color=colors[sr],
                                label=f"$S_r$={sr} dBm")
            axes[0][j].plot(d, [a["expectedMeanDbm"] for a in s], ls="--", lw=0.8, color=colors[sr])
            axes[1][j].errorbar(d, [a["prrMean"] for a in s], yerr=[a["prrStd"] for a in s],
                                marker="o", ms=3, capsize=2, color=colors[sr])
        axes[1][j].set_xlabel("Tx–Rx distance (m)")
        axes[1][j].set_ylim(-0.05, 1.05)
    axes[0][0].set_ylabel("Conditional mean RSSI (dBm)")
    axes[1][0].set_ylabel("PRR")
    axes[0][0].legend(fontsize=7)
    fig.tight_layout()
    (RESULTS / "plots").mkdir(exist_ok=True)
    for ext in ("png", "pdf"):
        fig.savefig(RESULTS / "plots" / f"{SUITE}.{ext}", dpi=150)
    print(json.dumps({k: report[k] for k in ("caseCount", "transmissions", "receptions")}),
          "incomplete:", len(incomplete))


if __name__ == "__main__":
    main()
