#!/usr/bin/env python3
import csv
import json
import math
import statistics
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RESULTS = ROOT / "results"
MANIFEST = ROOT / "generated" / "manifest-calibrated-z1.json"
SUMMARY = RESULTS / "summary-calibrated-z1.csv"
FULL_REPORT = RESULTS / "run-report-calibrated-z1-full.json"


def main():
    manifest = json.loads(MANIFEST.read_text())
    pilot = json.loads((RESULTS / "run-report-calibrated-z1-pilot.json").read_text())
    remainder = json.loads((RESULTS / "run-report-calibrated-z1.json").read_text())
    run_reports = {item["caseId"]: item for item in pilot["cases"] + remainder["cases"]}
    if len(manifest) != 216 or len(run_reports) != 216:
        raise RuntimeError(f"Expected 216 unique cases; manifest={len(manifest)} reports={len(run_reports)}")

    rows = []
    for item in manifest:
        case_id = item["caseId"]
        raw_path = RESULTS / "raw" / "calibrated-z1" / f"{case_id}.csv"
        log_path = RESULTS / "runtime" / "calibrated-z1" / "cases" / f"{case_id}.log"
        raw = list(csv.DictReader(raw_path.open(newline="")))
        sent = sum(row["event"] == "tx" for row in raw)
        rssi = [float(row["rssi_dbm"]) for row in raw if row["event"] == "rx"]
        report = run_reports[case_id]
        if "CASE_DONE" not in log_path.read_text():
            raise RuntimeError(f"Missing CASE_DONE: {case_id}")
        if not report["completed"] or sent != 44 or report["sent"] != sent or report["received"] != len(rssi):
            raise RuntimeError(f"Inconsistent run artifacts: {case_id}")
        rows.append({
            **item,
            "candidate": item["distanceM"] < item["transmittingRangeM"],
            "sent": sent,
            "received": len(rssi),
            "prr": len(rssi) / sent,
            "rssiMeanDbm": statistics.fmean(rssi) if rssi else None,
            "rssiStdDb": statistics.stdev(rssi) if len(rssi) > 1 else (0.0 if rssi else None),
            "rssiMedianDbm": statistics.median(rssi) if rssi else None,
            "rssiMinDbm": min(rssi) if rssi else None,
            "rssiMaxDbm": max(rssi) if rssi else None,
        })

    columns = [
        "caseId", "suite", "profileId", "family", "label", "pathLossExponent",
        "distanceM", "transmittingRangeM", "rxSensitivityDbm",
        "rssiInflectionPointDbm", "awgnSigmaDb", "candidate",
        "sourceModel", "sourceDomainStatus", "transmittingRangeDomainStatus",
        "randomSeed", "sent", "received", "prr", "rssiMeanDbm", "rssiStdDb",
        "rssiMedianDbm", "rssiMinDbm", "rssiMaxDbm", "cscPath"
    ]
    with SUMMARY.open("w", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=columns, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)

    family_rx = defaultdict(lambda: {"cases": 0, "sent": 0, "received": 0})
    for row in rows:
        key = f'{row["family"]}|rx{row["rxSensitivityDbm"]}'
        family_rx[key]["cases"] += 1
        family_rx[key]["sent"] += row["sent"]
        family_rx[key]["received"] += row["received"]
    for value in family_rx.values():
        value["prr"] = value["received"] / value["sent"]

    full_report = {
        "schemaVersion": 2,
        "suite": "calibrated-z1",
        "caseCount": len(rows),
        "startedAt": pilot["startedAt"],
        "finishedAt": remainder["finishedAt"],
        "toolchain": remainder["toolchain"],
        "allCompleted": all(run_reports[row["caseId"]]["completed"] for row in rows),
        "totalSent": sum(row["sent"] for row in rows),
        "totalReceived": sum(row["received"] for row in rows),
        "zeroReceptionCases": sum(row["received"] == 0 for row in rows),
        "partialReceptionCases": sum(0 < row["received"] < row["sent"] for row in rows),
        "fullReceptionCases": sum(row["received"] == row["sent"] for row in rows),
        "candidateCases": sum(row["candidate"] for row in rows),
        "nonCandidateCases": sum(not row["candidate"] for row in rows),
        "familyRxAggregates": dict(sorted(family_rx.items())),
        "cases": [run_reports[row["caseId"]] for row in rows],
        "summaryCsv": str(SUMMARY.relative_to(ROOT)),
        "pilotReport": str((RESULTS / "run-report-calibrated-z1-pilot.json").relative_to(ROOT)),
        "remainderReport": str((RESULTS / "run-report-calibrated-z1.json").relative_to(ROOT))
    }
    FULL_REPORT.write_text(json.dumps(full_report, indent=2) + "\n")
    print(
        f'ANALYSIS_OK cases={len(rows)} sent={full_report["totalSent"]} '
        f'received={full_report["totalReceived"]} full={full_report["fullReceptionCases"]} '
        f'partial={full_report["partialReceptionCases"]} zero={full_report["zeroReceptionCases"]}'
    )
    print(f"SUMMARY={SUMMARY}")
    print(f"REPORT={FULL_REPORT}")


if __name__ == "__main__":
    main()

