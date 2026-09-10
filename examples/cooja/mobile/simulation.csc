<?xml version='1.0' encoding='utf-8'?>
<simconf version="2022112801">
  <simulation>
    <title>Field2Sim mobile console example</title>
    <randomseed>123456</randomseed>
    <motedelay_us>0</motedelay_us>
    <radiomedium>
      org.contikios.cooja.radiomediums.UDGM
      <transmitting_range>50.0</transmitting_range>
      <interference_range>100.0</interference_range>
      <success_ratio_tx>1.0</success_ratio_tx>
      <success_ratio_rx>1.0</success_ratio_rx>
    </radiomedium>
    <events>
      <logoutput>40000</logoutput>
    </events>
    <motetype>
      org.contikios.cooja.motes.DisturberMoteType
      <identifier>apptype-positioner-integration</identifier>
      <description>Built-in application mote for position demonstration</description>
      <mote>
        <interface_config>
          org.contikios.cooja.interfaces.Position
          <pos x="999.0" y="999.0" />
        </interface_config>
        <interface_config>
          org.contikios.cooja.motes.AbstractApplicationMoteType$SimpleMoteID
          <id>41</id>
        </interface_config>
      </mote>
    </motetype>
  </simulation>
  <plugin>
    org.contikios.cooja.plugins.Mobility
    <plugin_config>
      <positions>[CONFIG_DIR]/positions.dat</positions>
    </plugin_config>
  </plugin>
  <plugin>
    org.contikios.cooja.plugins.ScriptRunner
    <plugin_config>
      <script>TIMEOUT(9200, var p=sim.getMote(0).getInterfaces().getPosition(); var error=Math.sqrt(Math.pow(p.getXCoordinate(),2)+Math.pow(p.getYCoordinate(),2)+Math.pow(p.getZCoordinate(),2)); log.log("EXAMPLE_CHECK mobile time_ms="+sim.getSimulationTimeMillis()+" x="+p.getXCoordinate()+" y="+p.getYCoordinate()+" error_m="+error+"\n"); if(error &lt;= 1e-6) {log.testOK();} else {log.testFailed();})</script>
      <active>true</active>
    </plugin_config>
  </plugin>
</simconf>