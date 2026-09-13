import inet.mobility.contract.IMobility;
import inet.physicallayer.wireless.apsk.packetlevel.ApskScalarRadio;
import inet.physicallayer.wireless.common.medium.ScalarRadioMedium;
simple WclApp { gates: input in; output out; }
simple WclEvaluator {}
module WclHost {
 parameters: @networkNode();
 submodules:
  mobility: <default("StationaryMobility")> like IMobility;
  radio: ApskScalarRadio;
  app: WclApp;
 connections allowunconnected:
  app.out --> radio.upperLayerIn;
  radio.upperLayerOut --> app.in;
}
network WclNetwork {
 submodules:
  radioMedium: ScalarRadioMedium;
  host[4]: WclHost;
  evaluator: WclEvaluator;
}
