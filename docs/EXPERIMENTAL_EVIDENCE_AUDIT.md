# Experimental evidence audit

This audit separates retained experimental evidence from proposed or
unavailable evidence before the IEEE Access submission.

## Setup-time and user-effort claim

The statement that Field2Sim reduces setup time by a factor of 13 is
not supported by an executed user study in the supplied materials. The only
source is `softwarex_feedback.txt`, which explicitly introduces a study with
ten graduate researchers as a study that *could be designed* and labels the
following timing table as hypothetical. No participant records, task script,
timing log, consent procedure, counterbalancing scheme, or analysis file is
present.

Consequently, the factor-of-13 claim and the phrase "as shown in our user
evaluations" must not appear as results. The defensible operational claim is
narrower: the application automates coordinate transformation and
simulator-specific serialization, and executable validators reject defined
classes of malformed artifacts. The magnitude of any reduction in human time
or error remains a future empirical question.

## Port-area localization sweep

The archived manuscript documents a Cartesian product of five communication
ranges (10--50 m) and five beacon step distances (10--50 m), yielding 25
configurations. It also reports Contiki-NG, a Zolertia platform, CSMA, a
100-node deployment, and a 100 m by 100 m area. Three raster summary plots are
retained.

The supplied materials do not contain the corresponding Cooja configuration
files, firmware revision, radio-medium parameters, random seeds, per-run
logs, tabular observations, or a plot-generation program. There is also no
evidence of repeated runs within a configuration. Therefore:

- the 25 items are described as configurations in a single illustrative
  parameter sweep, not as independent replications;
- plot trends are reported descriptively;
- no confidence interval, variance estimate, hypothesis test, causal claim,
  energy-saving claim, or statistically established threshold is inferred;
- full statistical validation requires rerunning a versioned experiment with
  archived configurations, seeds, raw observations, and analysis code.

## Legacy L-shaped screenshots

The two retained screenshots contain 33 correspondingly numbered node
markers but no source coordinate table. Their geometric comparison is
therefore performed as a retrospective raster registration, not as a
metre-level coordinate-accuracy experiment. Marker centres are digitized in
integer image pixels and tied to the source images by SHA-256. A least-squares
2-D similarity transform removes screenshot translation, rotation, and zoom.
Residual node displacement, adjacent-segment length distortion, and turning
angle error then quantify the shape preservation visible in the figure.

This image-level result complements, but does not replace, the metre-level
coordinate-kernel regression tests and simulator parser-execution tests.
