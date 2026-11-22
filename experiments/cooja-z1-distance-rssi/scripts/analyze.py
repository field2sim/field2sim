#!/usr/bin/env python3
"""Aggregate the Cooja Z1 event CSVs and render the experiment figures."""

import csv
import json
import math
import statistics
from collections import defaultdict
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np


ROOT = Path(__file__).resolve().parent.parent
RESULTS = ROOT / "results"
PLOTS = RESULTS / "plots"


def read_cases():
    cases = []
    for suite in ("main", "sensitivity"):
        report = json.loads((RESULTS / f"run-report-{suite}.json").read_text())
        for case_report in report["cases"]:
            case_id = case_report["caseId"]
            raw_path = RESULTS / "raw" / suite / f"{case_id}.csv"
            rows = list(csv.DictReader(raw_path.open(newline="")))
            if not rows:
                raise RuntimeError(f"Empty raw CSV: {raw_path}")
            first = rows[0]
            rssis = [int(row["rssi_dbm"]) for row in rows if row["event"] == "rx"]
            sent = sum(row["event"] == "tx" for row in rows)
            item = {
                "caseId": case_id,
                "suite": suite,
                "profileId": first["profile_id"],
                "family": first["family"],
                "label": first["label"],
                "pathLossExponent": float(first["path_loss_exponent"]),
                "distanceM": int(float(first["distance_m"])),
                "transmittingRangeM": int(float(first["transmitting_range_m"])),
                "randomSeed": int(first["random_seed"]),
            }
            cases.append({
                **item,
                "sent": sent,
                "received": len(rssis),
                "prr": len(rssis) / sent if sent else math.nan,
                "rssi_mean_dbm": statistics.mean(rssis) if rssis else math.nan,
                "rssi_std_db": statistics.stdev(rssis) if len(rssis) > 1 else (0.0 if rssis else math.nan),
                "rssi_median_dbm": statistics.median(rssis) if rssis else math.nan,
                "rssi_min_dbm": min(rssis) if rssis else math.nan,
                "rssi_max_dbm": max(rssis) if rssis else math.nan,
            })
    return cases


def write_summary(cases):
    columns = [
        "caseId", "suite", "profileId", "family", "label", "pathLossExponent",
        "distanceM", "transmittingRangeM", "randomSeed", "sent", "received", "prr",
        "rssi_mean_dbm", "rssi_std_db", "rssi_median_dbm", "rssi_min_dbm", "rssi_max_dbm",
    ]
    with (RESULTS / "summary.csv").open("w", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=columns, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(cases)


def save_figure(figure, stem):
    PLOTS.mkdir(parents=True, exist_ok=True)
    figure.savefig(PLOTS / f"{stem}.png", dpi=220, bbox_inches="tight")
    figure.savefig(PLOTS / f"{stem}.pdf", bbox_inches="tight")
    plt.close(figure)


def plot_main(cases, metric, ylabel, stem, ylim=None):
    main = [item for item in cases if item["suite"] == "main"]
    families = ["urban", "agriculture", "forest", "reference"]
    titles = ["Urban", "Agriculture", "Forest", "Reference"]
    figure, axes = plt.subplots(2, 2, figsize=(12.2, 8.2), sharex=True)
    for axis, family, title in zip(axes.flat, families, titles):
        family_cases = [item for item in main if item["family"] == family]
        grouped = defaultdict(list)
        for item in family_cases:
            grouped[item["label"]].append(item)
        for label, values in grouped.items():
            values.sort(key=lambda item: item["distanceM"])
            axis.plot(
                [item["distanceM"] for item in values],
                [item[metric] for item in values],
                marker="o", linewidth=1.6, markersize=4.5, label=label,
            )
        axis.set_title(title)
        axis.set_xticks([10, 20, 30, 40, 50, 60])
        axis.grid(True, alpha=0.28)
        if ylim is not None:
            axis.set_ylim(*ylim)
        axis.legend(fontsize=7.5, frameon=False)
    figure.supxlabel("Tx–Rx distance (m)")
    figure.supylabel(ylabel)
    figure.suptitle("Cooja LogisticLoss — Zolertia Z1, transmitting range = 100 m")
    figure.tight_layout()
    save_figure(figure, stem)


def plot_sensitivity(cases):
    values = [item for item in cases if item["suite"] == "sensitivity"]
    distances = sorted({item["distanceM"] for item in values})
    ranges = sorted({item["transmittingRangeM"] for item in values})
    lookup = {(item["transmittingRangeM"], item["distanceM"]): item for item in values}
    matrices = [
        (np.array([[lookup[(tr, distance)]["prr"] for distance in distances] for tr in ranges]),
         "Packet reception ratio", "sensitivity-prr", 0.0, 1.0, ".2f"),
        (np.array([[lookup[(tr, distance)]["rssi_mean_dbm"] for distance in distances] for tr in ranges]),
         "Mean RSSI conditional on reception (dBm)", "sensitivity-rssi", None, None, ".1f"),
    ]
    for matrix, title, stem, vmin, vmax, fmt in matrices:
        figure, axis = plt.subplots(figsize=(8.2, 6.2))
        image = axis.imshow(matrix, origin="lower", aspect="auto", cmap="viridis", vmin=vmin, vmax=vmax)
        axis.set_xticks(range(len(distances)), distances)
        axis.set_yticks(range(len(ranges)), ranges)
        axis.set_xlabel("Tx–Rx distance (m)")
        axis.set_ylabel("Cooja transmitting range (m)")
        axis.set_title(f"Urban / suburban LoS (n=2.07) — {title}")
        for row in range(len(ranges)):
            for column in range(len(distances)):
                value = matrix[row, column]
                text = "—" if np.isnan(value) else format(value, fmt)
                axis.text(column, row, text, ha="center", va="center", fontsize=8,
                          color="white" if not np.isnan(value) and value < np.nanmean(matrix) else "black")
        figure.colorbar(image, ax=axis, shrink=0.86)
        figure.tight_layout()
        save_figure(figure, stem)


def main():
    cases = read_cases()
    if len(cases) != 144:
        raise RuntimeError(f"Expected 144 cases, found {len(cases)}")
    write_summary(cases)
    plot_main(cases, "rssi_mean_dbm", "Mean RSSI conditional on reception (dBm)", "main-rssi-vs-distance")
    plot_main(cases, "prr", "Packet reception ratio", "main-prr-vs-distance", (0, 1.05))
    plot_sensitivity(cases)
    print(f"Wrote {len(cases)} rows to {RESULTS / 'summary.csv'}")
    print(f"Wrote figures to {PLOTS}")


if __name__ == "__main__":
    main()
