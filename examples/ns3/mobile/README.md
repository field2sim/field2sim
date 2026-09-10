# ns3: mobile

Follow [simulator installation and configuration](../README.md) first.
Set your installation paths once in [toolchains.env](../../toolchains.env.example), as explained in the [setup instructions](../../README.md). From the Field2Sim repository root:

```bash
bash examples/ns3/mobile/run.sh
```

Expected final result: `PASS: ns3/mobile; 8/8 checks`.
The console lists observed coordinates and position errors. Full output and
`result.json` are saved in `examples/results/ns3/mobile/`.
See the parent README for native commands, scenario semantics and input files.
