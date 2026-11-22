#!/usr/bin/env python3
import csv
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
SUMMARY = ROOT / "results" / "summary-calibrated-z1.csv"
PLOTS = ROOT / "results" / "plots"


def load():
    with SUMMARY.open(newline="") as handle:
        return list(csv.DictReader(handle))


def matrix(rows, field):
    profiles = []
    for row in rows:
        key = (row["profileId"], row["label"], int(row["rxSensitivityDbm"]))
        if key not in profiles:
            profiles.append(key)
    distances = sorted({int(row["distanceM"]) for row in rows})
    lookup = {
        (row["profileId"], int(row["rxSensitivityDbm"]), int(row["distanceM"])): row
        for row in rows
    }
    values = []
    labels = []
    for profile_id, label, rx in profiles:
        labels.append(f"{label} | RX {rx} dBm")
        values.append([
            float(lookup[(profile_id, rx, distance)][field])
            if lookup[(profile_id, rx, distance)][field] else np.nan
            for distance in distances
        ])
    return np.array(values), labels, distances


def plot(rows, field, title, stem, vmin=None, vmax=None, fmt=".2f"):
    values, labels, distances = matrix(rows, field)
    figure, axis = plt.subplots(figsize=(10.5, 16))
    image = axis.imshow(values, aspect="auto", cmap="viridis", vmin=vmin, vmax=vmax)
    axis.set_xticks(range(len(distances)), distances)
    axis.set_yticks(range(len(labels)), labels, fontsize=7)
    axis.set_xlabel("Tx-Rx distance (m)")
    axis.set_title(title)
    for y in range(values.shape[0]):
        for x in range(values.shape[1]):
            value = values[y, x]
            text = "—" if np.isnan(value) else format(value, fmt)
            axis.text(x, y, text, ha="center", va="center", fontsize=6,
                      color="white" if not np.isnan(value) and
                      value < np.nanmean(values) else "black")
    figure.colorbar(image, ax=axis, shrink=0.5)
    figure.tight_layout()
    PLOTS.mkdir(parents=True, exist_ok=True)
    figure.savefig(PLOTS / f"{stem}.png", dpi=180)
    figure.savefig(PLOTS / f"{stem}.pdf")
    plt.close(figure)


def main():
    rows = load()
    if len(rows) != 216:
        raise RuntimeError(f"Expected 216 summary rows, found {len(rows)}")
    plot(rows, "prr", "Calibrated Z1 — packet reception ratio",
         "calibrated-z1-prr", 0, 1, ".2f")
    plot(rows, "rssiMeanDbm", "Calibrated Z1 — mean RSSI conditional on reception",
         "calibrated-z1-rssi", None, None, ".1f")
    print(f"PLOTS_OK rows={len(rows)} output={PLOTS}")


if __name__ == "__main__":
    main()

