<?xml version='1.0' encoding='utf-8'?>
<simconf version="2022112801">
  <simulation>
    <title>Field2Sim static console example</title>
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
          <pos x="0" y="0" z="0" />
        </interface_config>
        <interface_config>
          org.contikios.cooja.motes.AbstractApplicationMoteType$SimpleMoteID
          <id>1</id>
        </interface_config>
      </mote>
      <mote>
        <interface_config>
          org.contikios.cooja.interfaces.Position
          <pos x="12.5" y="-8" z="0" />
        </interface_config>
        <interface_config>
          org.contikios.cooja.motes.AbstractApplicationMoteType$SimpleMoteID
          <id>2</id>
        </interface_config>
      </mote>
      <mote>
        <interface_config>
          org.contikios.cooja.interfaces.Position
          <pos x="-4" y="-15.25" z="0" />
        </interface_config>
        <interface_config>
          org.contikios.cooja.motes.AbstractApplicationMoteType$SimpleMoteID
          <id>3</id>
        </interface_config>
      </mote>
    </motetype>
  </simulation>
  <plugin>
    org.contikios.cooja.plugins.ScriptRunner
    <plugin_config>
      <script>TIMEOUT(200,  var expected = [[0,0], [12.5,-8], [-4,-15.25]];  for (var i=0;i&lt;3;i++) {   var p=sim.getMote(i).getInterfaces().getPosition();   var error=Math.sqrt(Math.pow(p.getXCoordinate()-expected[i][0],2)+Math.pow(p.getYCoordinate()-expected[i][1],2)+Math.pow(p.getZCoordinate(),2));   log.log("EXAMPLE_CHECK static node="+i+" x="+p.getXCoordinate()+" y="+p.getYCoordinate()+" error_m="+error+"\n");   if (!(error &lt;= 1e-6)) log.testFailed();  }  log.testOK();)</script>
      <active>true</active>
    </plugin_config>
  </plugin>
</simconf>