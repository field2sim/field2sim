# Local console verification

Executed on 10 September 2026 using the installed toolchains. All scenarios run without a GUI. Fresh simulator installations were not repeated.

| Simulator | Static | Mobile |
|---|---:|---:|
| cooja | 3/3 PASS | 5/5 PASS |
| ns2 | 3/3 PASS | 8/8 PASS |
| ns3 | 3/3 PASS | 8/8 PASS |
| omnetpp-inet | 3/3 PASS | 8/8 PASS |

The seven supplied trace files also pass `node examples/check-exports.js`, comparing them with the current adapter output. Cooja static XYZ is read from its CSC rather than a mobility trace.

Cooja: Contiki-NG `6ac4608c`, Cooja `0a518f80`, JDK 21. ns-2: 2.35. ns-3: 3.47. OMNeT++: 6.4.0; INET: 4.7.0. The scenarios check placement and mobility semantics at a 1e-6 m tolerance. They do not evaluate a radio protocol.

Raw per-scenario logs and machine-readable summaries are in the locally generated `results/` directory, which is excluded from Git.

Portable launchers: all eight passed installation-path checks from an unrelated working directory using a configuration filename containing spaces. Native ns-2 static execution also passed through the launcher. Missing configuration, missing installation variable and invalid installation path correctly returned errors.
