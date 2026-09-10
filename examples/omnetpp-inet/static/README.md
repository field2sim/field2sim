# omnetpp-inet: static

Follow [simulator installation and configuration](../README.md) first.
Set your installation paths once in [toolchains.env](../../toolchains.env.example), as explained in the [setup instructions](../../README.md). From the Field2Sim repository root:

```bash
bash examples/omnetpp-inet/static/run.sh
```

Expected final result: `PASS: omnetpp-inet/static; 3/3 checks`.
The console lists observed coordinates and position errors. Full output and
`result.json` are saved in `examples/results/omnetpp-inet/static/`.
See the parent README for native commands, scenario semantics and input files.
