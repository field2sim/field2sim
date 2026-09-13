<?xml version='1.0' encoding='utf-8'?>
<simconf version="2023090101">
  <simulation>
    <title>Field2Sim mobile anchor RSSI WCL</title>
    <randomseed>123456</randomseed>
    <motedelay_us>0</motedelay_us>
    <radiomedium>
      org.contikios.cooja.radiomediums.LogisticLoss
      
      <transmitting_range>100</transmitting_range>
      <success_ratio_tx>1</success_ratio_tx>
      <rx_sensitivity>-85</rx_sensitivity>
      <rssi_inflection_point>-82</rssi_inflection_point>
      <path_loss_exponent>2</path_loss_exponent>
      <awgn_sigma>0</awgn_sigma>
      <enable_time_variation>false</enable_time_variation>
    </radiomedium>
    <events>
      <logoutput>40000</logoutput>
    </events>
    <motetype>
      org.contikios.cooja.mspmote.Z1MoteType
      <description>Anchor and unknown WCL firmware</description>
      <source>[CONFIG_DIR]/anchor-wcl.c</source>
      <commands>make TARGET=z1</commands>
      <firmware>[CONFIG_DIR]/build/z1/anchor-wcl.z1</firmware>
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
          <pos x="10" y="10" z="0" />
        </interface_config>
        <interface_config>
          org.contikios.cooja.mspmote.interfaces.MspMoteID
          <id>1</id>
        </interface_config>
      </mote>
      <mote>
        <interface_config>
          org.contikios.cooja.interfaces.Position
          <pos x="35" y="35" z="0" />
        </interface_config>
        <interface_config>
          org.contikios.cooja.mspmote.interfaces.MspMoteID
          <id>2</id>
        </interface_config>
      </mote>
      <mote>
        <interface_config>
          org.contikios.cooja.interfaces.Position
          <pos x="65" y="35" z="0" />
        </interface_config>
        <interface_config>
          org.contikios.cooja.mspmote.interfaces.MspMoteID
          <id>3</id>
        </interface_config>
      </mote>
      <mote>
        <interface_config>
          org.contikios.cooja.interfaces.Position
          <pos x="50" y="65" z="0" />
        </interface_config>
        <interface_config>
          org.contikios.cooja.mspmote.interfaces.MspMoteID
          <id>4</id>
        </interface_config>
      </mote>
    </motetype>
  </simulation>
  <plugin>org.contikios.cooja.plugins.Mobility<plugin_config>
      <positions>[CONFIG_DIR]/positions.dat</positions>
    </plugin_config>
  </plugin>
  <plugin>org.contikios.cooja.plugins.ScriptRunner<plugin_config>
      <active>true</active>
      <script>TIMEOUT(45000, log.testFailed());
var estimates={}, completed=0, total=0, tx=0, rx=0;
while(true) {
 var line=String(msg);
 if(line.indexOf("TX seq=")&gt;=0) {
  var m=/TX seq=(\d+) site=(\d+) x_cm=(-?\d+) y_cm=(-?\d+)/.exec(line);
  if(m){var p=sim.getMote(0).getInterfaces().getPosition();if(Math.abs(p.getXCoordinate()-Number(m[3])/100)&gt;0.02 || Math.abs(p.getYCoordinate()-Number(m[4])/100)&gt;0.02) {log.log("ANCHOR_POSITION_MISMATCH\n");log.testFailed();}tx++;log.log(line+"\n");}
 }
 if(line.indexOf("RX node=")&gt;=0){rx++;log.log(line+"\n");}
 if(line.indexOf("UNLOCALIZED")&gt;=0){log.log(line+"\n");log.testFailed();}
 var m=/EST node=(\d+) sites=(\d+) received=(\d+) x_mm=(-?\d+) y_mm=(-?\d+)/.exec(line);
 if(m &amp;&amp; !estimates[m[1]]) {
  var id=Number(m[1]),x=Number(m[4])/1000,y=Number(m[5])/1000;
  var truth=sim.getMote(id-1).getInterfaces().getPosition();
  var error=Math.sqrt(Math.pow(x-truth.getXCoordinate(),2)+Math.pow(y-truth.getYCoordinate(),2));
  log.log(line+"\n");log.log("ERROR node="+id+" true_x="+truth.getXCoordinate()+" true_y="+truth.getYCoordinate()+" error_m="+error+"\n");
  estimates[m[1]]=true;completed++;total+=error;
  if(completed==3){log.log("SUMMARY localized=3 unknowns=3 mean_error_m="+(total/3)+" tx="+tx+" rx="+rx+" status=PASS\n");if(tx!=16 || rx&lt;9)log.testFailed();log.testOK();}
 }
 YIELD();
}</script>
    </plugin_config>
  </plugin>
</simconf>