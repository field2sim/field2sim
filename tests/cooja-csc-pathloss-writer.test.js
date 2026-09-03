'use strict';

const assert = require('node:assert/strict');
const {
  CoojaCscWriteError,
  inspectCoojaCsc,
  patchCoojaCsc
} = require('../cooja-csc-pathloss-writer.js');

const original = `<?xml version="1.0" encoding="UTF-8"?>
<simconf version="2023090101">
  <simulation>
    <title>Existing research scenario</title>
    <randomseed>7</randomseed>
    <motedelay_us>1000000</motedelay_us>
    <radiomedium>
      org.contikios.cooja.radiomediums.UDGM
      <transmitting_range>50.0</transmitting_range>
      <interference_range>100.0</interference_range>
      <success_ratio_tx>1.0</success_ratio_tx>
      <success_ratio_rx>1.0</success_ratio_rx>
    </radiomedium>
    <motetype>
      org.contikios.cooja.mspmote.Z1MoteType
      <mote>
        <interface_config>
          org.contikios.cooja.interfaces.Position
          <pos x="12.5" y="-4.25" />
        </interface_config>
      </mote>
    </motetype>
  </simulation>
  <plugin>
    org.contikios.cooja.plugins.Visualizer
    <plugin_config>
      <skin>org.contikios.cooja.plugins.skins.IDVisualizerSkin</skin>
      <skin>org.contikios.cooja.plugins.skins.UDGMVisualizerSkin</skin>
    </plugin_config>
  </plugin>
  <plugin>
    org.contikios.cooja.plugins.Mobility
    <plugin_config>
      <positions>[CONFIG_DIR]/positions.dat</positions>
    </plugin_config>
  </plugin>
</simconf>
`;

const input = {
  filename: 'research.csc',
  text: original,
  randomSeed: 123456,
  profileLabel: 'Urban LoS',
  profileUrl: 'https://example.org/evidence',
  radio: {
    transmittingRangeM: 50,
    successRatioTx: 1,
    rxSensitivityDbm: -100,
    rssiInflectionPointDbm: -92,
    pathLossExponent: 2.07,
    awgnSigmaDb: 3,
    enableTimeVariation: false
  }
};

const inspected = inspectCoojaCsc(original, 'research.csc');
assert.equal(inspected.radioMediumClass, 'org.contikios.cooja.radiomediums.UDGM');
assert.equal(inspected.hasRandomSeed, true);
assert.equal(inspected.hasMobilityPlugin, true);
assert.equal(inspected.moteCount, 1);

const artifact = patchCoojaCsc(input);
assert.equal(artifact.filename, 'research-pathloss.csc');
assert.equal(artifact.previousRadioMediumClass, 'org.contikios.cooja.radiomediums.UDGM');
assert.equal(artifact.removedUdgmVisualizerSkins, 1);
assert.match(artifact.text, /<randomseed>123456<\/randomseed>/);
assert.match(artifact.text, /org\.contikios\.cooja\.radiomediums\.LogisticLoss/);
assert.match(artifact.text, /<transmitting_range>50<\/transmitting_range>/);
assert.match(artifact.text, /<success_ratio_tx>1<\/success_ratio_tx>/);
assert.match(artifact.text, /<rx_sensitivity>-100<\/rx_sensitivity>/);
assert.match(artifact.text, /<rssi_inflection_point>-92<\/rssi_inflection_point>/);
assert.match(artifact.text, /<path_loss_exponent>2\.07<\/path_loss_exponent>/);
assert.match(artifact.text, /<awgn_sigma>3<\/awgn_sigma>/);
assert.match(artifact.text, /<enable_time_variation>false<\/enable_time_variation>/);
assert.doesNotMatch(artifact.text, /radiomediums\.UDGM/);
assert.doesNotMatch(artifact.text, /UDGMVisualizerSkin/);
assert.doesNotMatch(artifact.text, /<success_ratio_rx>/);
assert.doesNotMatch(artifact.text, /<interference_range>/);
assert.match(artifact.text, /<pos x="12\.5" y="-4\.25" \/>/);
assert.match(artifact.text, /<positions>\[CONFIG_DIR\]\/positions\.dat<\/positions>/);
assert.match(artifact.text, /IDVisualizerSkin/);
assert.equal((artifact.text.match(/<radiomedium>/g) || []).length, 1);
assert.equal((artifact.text.match(/Cooja-Positioner literature-informed profile/g) || []).length, 1);

const patchedAgain = patchCoojaCsc({ ...input, text: artifact.text, filename: artifact.filename });
assert.equal((patchedAgain.text.match(/<radiomedium>/g) || []).length, 1);
assert.equal((patchedAgain.text.match(/Cooja-Positioner literature-informed profile/g) || []).length, 1);
assert.match(patchedAgain.text, /<pos x="12\.5" y="-4\.25" \/>/);

const withoutSeedOrRadio = `<simconf><simulation>
  <title>Minimal</title>
  <mote><interface_config><pos x="1" y="2" /></interface_config></mote>
</simulation></simconf>`;
const inserted = patchCoojaCsc({ ...input, filename: 'minimal.csc', text: withoutSeedOrRadio });
assert.match(inserted.text, /<randomseed>123456<\/randomseed>/);
assert.match(inserted.text, /<radiomedium>[\s\S]*LogisticLoss[\s\S]*<\/radiomedium>/);
assert.match(inserted.text, /<pos x="1" y="2" \/>/);

assert.throws(
  () => inspectCoojaCsc('<simconf></simconf>', 'bad.csc'),
  error => error instanceof CoojaCscWriteError && /simulation/.test(error.message)
);
assert.throws(
  () => patchCoojaCsc({ ...input, filename: 'not-xml.txt' }),
  error => error instanceof CoojaCscWriteError && error.errors.some(item => /extension/.test(item))
);
assert.throws(
  () => patchCoojaCsc({ ...input, text: original.replace('</radiomedium>', '</radiomedium><radiomedium>x</radiomedium>') }),
  error => error instanceof CoojaCscWriteError && /multiple radio-medium/.test(error.message)
);

console.log('cooja-csc-pathloss-writer: existing scenario preservation and LogisticLoss patch tests passed');
