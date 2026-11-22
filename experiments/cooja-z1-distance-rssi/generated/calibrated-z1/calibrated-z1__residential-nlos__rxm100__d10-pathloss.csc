<?xml version="1.0" encoding="UTF-8"?>
<simconf version="2023090101">
  <simulation>
    <title>Z1 UDP distance-RSSI — calibrated-z1__residential-nlos__rxm100__d10</title>
    <randomseed>123456</randomseed>
    <motedelay_us>1000000</motedelay_us>
    <radiomedium>
      org.contikios.cooja.radiomediums.LogisticLoss
      <!-- Cooja-Positioner literature-informed profile: Residential NLoS; source=https://www.itu.int/rec/R-REC-P.1411. -->
      <transmitting_range>273.023634</transmitting_range>
      <success_ratio_tx>1</success_ratio_tx>
      <rx_sensitivity>-100</rx_sensitivity>
      <rssi_inflection_point>-92</rssi_inflection_point>
      <path_loss_exponent>3.01</path_loss_exponent>
      <awgn_sigma>3.07</awgn_sigma>
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
      <notes>Case ID: calibrated-z1__residential-nlos__rxm100__d10
Suite: calibrated-z1
Platform: Zolertia Z1 / TI CC2420 / 2.4 GHz / nominal TX power 0 dBm
Environment: urban — Residential NLoS
Source: ITU-R P.1411-13; https://www.itu.int/rec/R-REC-P.1411
Source model: PL(d,f)=10*alpha*log10(d)+beta+10*gamma*log10(f_GHz); alpha=3.01, beta=18.8, gamma=2.07
Sender: mote 1 at (49.54465430879008, 30.187651112814674) m
Receiver: mote 2 at (59.54465430879, 30.187651112814674) m
Tx-Rx distance: 10 m; domain status: EXTRAPOLATION; source domain is 30 m to 170 m
Transmitting range: 273.023634 m; calculated by solving the complete source mean model for mean RSSI = -100 dBm
Transmitting-range domain status: EXTRAPOLATION; source domain is 30 m to 170 m
Range equation: TR=10^((txPowerDbm-rxSensitivityDbm-beta-10*gamma*log10(f_GHz))/(10*alpha))
Path-loss exponent: 3.01
AWGN sigma: 3.07 dB, copied from the source sigma/shadowing assumption; Cooja samples it independently per reception
RX sensitivity parameter: -100 dBm — legacy Cooja LogisticLoss default retained as a simulator comparison; not Z1 hardware sensitivity
RSSI inflection point: -92 dBm
TX success ratio: 1
Time variation: false
Random seed: 123456; duration: 85 s
Traffic: mote 1 sends one IPv6 link-local one-hop UDP request every 1000 ms after 40 s warm-up; mote 2 logs RSSI
Cooja LogisticLoss semantic warning: transmitting_range is both the strict candidate-receiver cutoff (distance must be smaller) and the d0-like distance where mean RSSI is anchored to rx_sensitivity.</notes>
      <decorations>true</decorations>
    </plugin_config>
    <bounds x="400" y="0" height="160" width="1320" z="1" />
  </plugin>
  <plugin>
    org.contikios.cooja.plugins.ScriptRunner
    <plugin_config>
      <script>log.writeFile("/home/ismylhakki/cooja-positioner/experiments/cooja-z1-distance-rssi/results/runtime/calibrated-z1/cases/calibrated-z1__residential-nlos__rxm100__d10.log", "");
TIMEOUT(85000, log.append("/home/ismylhakki/cooja-positioner/experiments/cooja-z1-distance-rssi/results/runtime/calibrated-z1/cases/calibrated-z1__residential-nlos__rxm100__d10.log", "CASE_DONE case=calibrated-z1__residential-nlos__rxm100__d10\n"); log.testOK());
while (true) {
  YIELD();
  if (msg.indexOf("Sending fixed request") !== -1 || msg.indexOf("RSSI=") !== -1) {
    log.append("/home/ismylhakki/cooja-positioner/experiments/cooja-z1-distance-rssi/results/runtime/calibrated-z1/cases/calibrated-z1__residential-nlos__rxm100__d10.log", "MEAS case=calibrated-z1__residential-nlos__rxm100__d10 mote=" + mote.getID() + " " + msg + "\n");
  }
}</script>
      <active>true</active>
    </plugin_config>
  </plugin>
</simconf>
