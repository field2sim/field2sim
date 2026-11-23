<?xml version="1.0" encoding="UTF-8"?>
<simconf version="2023090101">
  <simulation>
    <title>Z1 UDP distance-RSSI — fixed-range-z1__urban-low-rise-nlos__rxm90__d10__s123463</title>
    <randomseed>123463</randomseed>
    <motedelay_us>1000000</motedelay_us>
    <radiomedium>
      org.contikios.cooja.radiomediums.LogisticLoss
      <!-- Field2Sim literature-informed profile: Urban low-rise / suburban NLoS; source=https://www.itu.int/rec/R-REC-P.1411. -->
      <transmitting_range>61.394586</transmitting_range>
      <success_ratio_tx>1</success_ratio_tx>
      <rx_sensitivity>-90</rx_sensitivity>
      <rssi_inflection_point>-92</rssi_inflection_point>
      <path_loss_exponent>4.52</path_loss_exponent>
      <awgn_sigma>8.02</awgn_sigma>
      <enable_time_variation>false</enable_time_variation>
    </radiomedium>
    <events>
      <logoutput>40000</logoutput>
    </events>
    <motetype>
      org.contikios.cooja.mspmote.Z1MoteType
      <description>Z1 Mote Type #1</description>
      <source>[CONFIG_DIR]/../../baseline/udp-client.c</source>
      <commands>$(MAKE) -j$(CPUS) udp-client.z1 TARGET=z1</commands>
      <firmware>[CONFIG_DIR]/../../baseline/build/z1/udp-client.z1</firmware>
      <moteinterface>org.contikios.cooja.interfaces.Position</moteinterface>
      <moteinterface>org.contikios.cooja.interfaces.IPAddress</moteinterface>
      <moteinterface>org.contikios.cooja.interfaces.Mote2MoteRelations</moteinterface>
      <moteinterface>org.contikios.cooja.interfaces.MoteAttributes</moteinterface>
      <moteinterface>org.contikios.cooja.mspmote.interfaces.MspClock</moteinterface>
      <moteinterface>org.contikios.cooja.mspmote.interfaces.MspMoteID</moteinterface>
      <moteinterface>org.contikios.cooja.mspmote.interfaces.MspButton</moteinterface>
      <moteinterface>org.contikios.cooja.mspmote.interfaces.Msp802154Radio</moteinterface>
      <moteinterface>org.contikios.cooja.mspmote.interfaces.MspDefaultSerial</moteinterface>
      <moteinterface>org.contikios.cooja.mspmote.interfaces.MspLED</moteinterface>
      <moteinterface>org.contikios.cooja.mspmote.interfaces.MspDebugOutput</moteinterface>
      <mote>
        <interface_config>
          org.contikios.cooja.interfaces.Position
          <pos x="49.54465430879008" y="30.187651112814674" />
        </interface_config>
        <interface_config>
          org.contikios.cooja.mspmote.interfaces.MspMoteID
          <id>1</id>
        </interface_config>
      </mote>
    </motetype>
    <motetype>
      org.contikios.cooja.mspmote.Z1MoteType
      <description>Z1 Mote Type #2</description>
      <source>[CONFIG_DIR]/../../baseline/udp-server.c</source>
      <commands>$(MAKE) -j$(CPUS) udp-server.z1 TARGET=z1</commands>
      <firmware>[CONFIG_DIR]/../../baseline/build/z1/udp-server.z1</firmware>
      <moteinterface>org.contikios.cooja.interfaces.Position</moteinterface>
      <moteinterface>org.contikios.cooja.interfaces.IPAddress</moteinterface>
      <moteinterface>org.contikios.cooja.interfaces.Mote2MoteRelations</moteinterface>
      <moteinterface>org.contikios.cooja.interfaces.MoteAttributes</moteinterface>
      <moteinterface>org.contikios.cooja.mspmote.interfaces.MspClock</moteinterface>
      <moteinterface>org.contikios.cooja.mspmote.interfaces.MspMoteID</moteinterface>
      <moteinterface>org.contikios.cooja.mspmote.interfaces.MspButton</moteinterface>
      <moteinterface>org.contikios.cooja.mspmote.interfaces.Msp802154Radio</moteinterface>
      <moteinterface>org.contikios.cooja.mspmote.interfaces.MspDefaultSerial</moteinterface>
      <moteinterface>org.contikios.cooja.mspmote.interfaces.MspLED</moteinterface>
      <moteinterface>org.contikios.cooja.mspmote.interfaces.MspDebugOutput</moteinterface>
      <mote>
        <interface_config>
          org.contikios.cooja.interfaces.Position
          <pos x="59.54465430879008" y="30.187651112814674" />
        </interface_config>
        <interface_config>
          org.contikios.cooja.mspmote.interfaces.MspMoteID
          <id>2</id>
        </interface_config>
      </mote>
    </motetype>
  </simulation>
  <plugin>
    org.contikios.cooja.plugins.Visualizer
    <plugin_config>
      <moterelations>true</moterelations>
      <skin>org.contikios.cooja.plugins.skins.IDVisualizerSkin</skin>
      <skin>org.contikios.cooja.plugins.skins.GridVisualizerSkin</skin>
      <skin>org.contikios.cooja.plugins.skins.TrafficVisualizerSkin</skin>
      <viewport>6.984329983802139 0.0 0.0 6.984329983802139 -165.31656257132147 62.71977410130132</viewport>
    </plugin_config>
    <bounds x="1" y="1" height="400" width="400" />
  </plugin>
  <plugin>
    org.contikios.cooja.plugins.LogListener
    <plugin_config>
      <filter />
      <formatted_time />
      <coloring />
    </plugin_config>
    <bounds x="400" y="160" height="240" width="1320" z="3" />
  </plugin>
  <plugin>
    org.contikios.cooja.plugins.TimeLine
    <plugin_config>
      <mote>0</mote>
      <mote>1</mote>
      <showRadioRXTX />
      <showRadioHW />
      <showLEDs />
      <zoomfactor>500.0</zoomfactor>
    </plugin_config>
    <bounds x="0" y="751" height="166" width="1720" z="2" />
  </plugin>
  <plugin>
    org.contikios.cooja.plugins.Notes
    <plugin_config>
      <notes>Case ID: fixed-range-z1__urban-low-rise-nlos__rxm90__d10__s123463
Suite: fixed-range-z1 (transmitting_range fixed, rx_sensitivity varied, independent seeds)
Platform: Zolertia Z1 / TI CC2420 / 2.4 GHz / nominal TX power 0 dBm
Environment: urban — Urban low-rise / suburban NLoS
Source: ITU-R P.1411-13; https://www.itu.int/rec/R-REC-P.1411
Tx-Rx distance: 10 m; domain status: inside source domain (10 m to 250 m)
Transmitting range: 61.394586 m, FIXED at the source-model range for -95 dBm and not recomputed for this case's rx_sensitivity
RX sensitivity parameter: -90 dBm (varied independently; simulator-parameter sensitivity, not a hardware calibration)
Path-loss exponent: 4.52
AWGN sigma: 8.02 dB (sampled independently per reception by Cooja)
RSSI inflection point: -92 dBm; TX success ratio: 1; time variation: false
Random seed: 123463; duration: 85 s
Traffic: mote 1 sends one IPv6 link-local one-hop UDP request every 1000 ms after 40 s warm-up; mote 2 logs RSSI
Cooja LogisticLoss semantic warning: with transmitting_range fixed, changing rx_sensitivity shifts the mean-RSSI anchor at transmitting_range and therefore the whole mean curve.</notes>
      <decorations>true</decorations>
    </plugin_config>
    <bounds x="400" y="0" height="160" width="1320" z="1" />
  </plugin>
  <plugin>
    org.contikios.cooja.plugins.ScriptRunner
    <plugin_config>
      <script>log.writeFile("/home/ismylhakki/cooja-positioner/experiments/cooja-z1-distance-rssi/results/runtime/fixed-range-z1/cases/fixed-range-z1__urban-low-rise-nlos__rxm90__d10__s123463.log", "");
TIMEOUT(85000, log.append("/home/ismylhakki/cooja-positioner/experiments/cooja-z1-distance-rssi/results/runtime/fixed-range-z1/cases/fixed-range-z1__urban-low-rise-nlos__rxm90__d10__s123463.log", "CASE_DONE case=fixed-range-z1__urban-low-rise-nlos__rxm90__d10__s123463\n"); log.testOK());
while (true) {
  YIELD();
  if (msg.indexOf("Sending fixed request") !== -1 || msg.indexOf("RSSI=") !== -1) {
    log.append("/home/ismylhakki/cooja-positioner/experiments/cooja-z1-distance-rssi/results/runtime/fixed-range-z1/cases/fixed-range-z1__urban-low-rise-nlos__rxm90__d10__s123463.log", "MEAS case=fixed-range-z1__urban-low-rise-nlos__rxm90__d10__s123463 mote=" + mote.getID() + " " + msg + "\n");
  }
}</script>
      <active>true</active>
    </plugin_config>
  </plugin>
</simconf>
