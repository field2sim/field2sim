# Elevated consumer checks

Independent of historical planar reports and field case studies. Fixtures are generated
with the current adapters by `tests/run-elevation-integration.js`, which copies the
existing harnesses into a fresh temporary workspace. This folder records the modified
verifiers, artifacts and resulting reports. Report paths refer to that temporary layout.

Run from the repository with NS3_ROOT, OMNETPP_ROOT and INET_ROOT set to built installations:

    node tests/run-elevation-integration.js

Expected heights are prescribed test data, not DEM measurements. ns-2/ns-3 expectations
are stepwise Z with planar interpolation; INET expectations use 3D interpolation.

2026-09-10 observations:
- ns-2: 11/11 PASS (eight mobile, three static).
- ns-3.47: three static PASS; eight mobile FAIL. Scheduled Z assignments in
  Ns2MobilityHelper::SetSchedPosition mutate initial state and reset X/Y.
  This is an unresolved consumer compatibility issue, not a successful validation.
- INET: 11/11 PASS (eight mobile, three static) after enabling and building the
  Mobility feature. With is3D=true, the trace reproduces XYZ positions, including
  interpolated Z between waypoints. Maximum reported position error: 0 m at the
  report's nine-decimal output precision (acceptance tolerance 1e-6 m).
  Module source hashes match the pinned manifest. Local release archives lack Git
  metadata, so their revision values are recorded as null.

Historical reports are not overwritten. The new runner exits nonzero while failures
remain. No claim of field accuracy or radio behavior follows from these checks.
