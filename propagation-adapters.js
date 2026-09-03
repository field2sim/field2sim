(function (root, factory) {
  const profileApi = typeof module === 'object' && module.exports
    ? require('./propagation-profiles.js')
    : root.CoojaPositionerPropagationProfiles;
  const api = factory(profileApi);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CoojaPositionerPropagationAdapters = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (profileApi) {
  'use strict';

  if (!profileApi) throw new Error('propagation-profiles.js must be loaded before propagation-adapters.js');

  const SCHEMA_VERSION = '1.0.0';
  const SPEED_OF_LIGHT_M_S = 299792458;
  const TARGETS = Object.freeze({
    cooja: Object.freeze({ id: 'cooja', label: 'Cooja', extension: 'csc-fragment', mimeType: 'application/xml' }),
    ns2: Object.freeze({ id: 'ns2', label: 'ns-2', extension: 'tcl', mimeType: 'text/plain' }),
    ns3: Object.freeze({ id: 'ns3', label: 'ns-3', extension: 'cc', mimeType: 'text/x-c++src' }),
    omnetpp: Object.freeze({ id: 'omnetpp', label: 'OMNeT++ / INET', extension: 'ini', mimeType: 'text/plain' })
  });

  const MAPPING_QUALITY = Object.freeze({
    NATIVE: 'native',
    APPROXIMATION: 'parameterized-approximation',
    UNSUPPORTED: 'unsupported'
  });

  const AGRICULTURE_CONDITIONS = Object.freeze({
    'corn-growth': Object.freeze({ id: 'corn-growth', label: 'Corn — growth', pathLossExponent: 4.90 }),
    'corn-maturity': Object.freeze({ id: 'corn-maturity', label: 'Corn — maturity', pathLossExponent: 5.77 }),
    'paddy-growth': Object.freeze({ id: 'paddy-growth', label: 'Paddy — growth', pathLossExponent: 4.85 }),
    'paddy-maturity': Object.freeze({ id: 'paddy-maturity', label: 'Paddy — maturity', pathLossExponent: 5.47 }),
    'groundnut-growth': Object.freeze({ id: 'groundnut-growth', label: 'Groundnut — growth', pathLossExponent: 5.08 }),
    'groundnut-maturity': Object.freeze({ id: 'groundnut-maturity', label: 'Groundnut — maturity', pathLossExponent: 5.97 }),
    'coconut-green-grass': Object.freeze({ id: 'coconut-green-grass', label: 'Coconut garden — green grass', pathLossExponent: 4.70 }),
    'lawn-dry-grass': Object.freeze({ id: 'lawn-dry-grass', label: 'Open lawn — dry grass', pathLossExponent: 4.90 }),
    'lawn-wet-grass': Object.freeze({ id: 'lawn-wet-grass', label: 'Open lawn — wet grass', pathLossExponent: 4.80 })
  });

  class PropagationAdapterError extends Error {
    constructor(message, errors = []) {
      super(message);
      this.name = 'PropagationAdapterError';
      this.errors = errors.slice();
    }
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function finite(value) {
    return typeof value === 'number' && Number.isFinite(value);
  }

  function optionalNumber(value) {
    if (value === '' || value === null || value === undefined) return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : NaN;
  }

  function formatNumber(value, digits = 9) {
    if (!finite(value)) throw new PropagationAdapterError('Cannot serialize a non-finite propagation parameter.');
    const fixed = value.toFixed(digits);
    const trimmed = fixed.includes('.') ? fixed.replace(/0+$/, '').replace(/\.$/, '') : fixed;
    return trimmed === '-0' ? '0' : trimmed;
  }

  function formatScientific(value) {
    if (!finite(value)) throw new PropagationAdapterError('Cannot serialize a non-finite propagation parameter.');
    return value.toExponential(9).replace(/\.0+e/, 'e').replace(/(\.\d*?)0+e/, '$1e');
  }

  function dbToLinear(db) {
    return Math.pow(10, db / 10);
  }

  function freeSpacePathLossDb(frequencyMHz, distanceM, systemLossDb = 0) {
    if (![frequencyMHz, distanceM, systemLossDb].every(finite) || frequencyMHz <= 0 || distanceM <= 0) {
      throw new PropagationAdapterError('Friis path loss requires positive frequency and distance and a finite system loss.');
    }
    const frequencyHz = frequencyMHz * 1e6;
    return 20 * Math.log10((4 * Math.PI * distanceM * frequencyHz) / SPEED_OF_LIGHT_M_S) + systemLossDb;
  }

  function logDistancePathLossDb(referenceLossDb, exponent, referenceDistanceM, distanceM) {
    if (![referenceLossDb, exponent, referenceDistanceM, distanceM].every(finite) || exponent <= 0 || referenceDistanceM <= 0 || distanceM <= 0) {
      throw new PropagationAdapterError('Log-distance path loss requires finite parameters and positive exponent and distances.');
    }
    return referenceLossDb + 10 * exponent * Math.log10(distanceM / referenceDistanceM);
  }

  function twoRayCrossoverDistanceM(frequencyMHz, txHeightM, rxHeightM) {
    if (![frequencyMHz, txHeightM, rxHeightM].every(finite) || frequencyMHz <= 0 || txHeightM <= 0 || rxHeightM <= 0) {
      throw new PropagationAdapterError('Two-ray crossover distance requires positive frequency and antenna heights.');
    }
    const wavelengthM = SPEED_OF_LIGHT_M_S / (frequencyMHz * 1e6);
    return (4 * Math.PI * txHeightM * rxHeightM) / wavelengthM;
  }

  function twoRayGroundPathLossDb(frequencyMHz, distanceM, txHeightM, rxHeightM, systemLossDb = 0) {
    if (![distanceM, systemLossDb].every(finite) || distanceM <= 0) {
      throw new PropagationAdapterError('Two-ray path loss requires a positive distance and finite system loss.');
    }
    const crossoverM = twoRayCrossoverDistanceM(frequencyMHz, txHeightM, rxHeightM);
    if (distanceM <= crossoverM) return freeSpacePathLossDb(frequencyMHz, distanceM, systemLossDb);
    return 40 * Math.log10(distanceM) - 20 * Math.log10(txHeightM) - 20 * Math.log10(rxHeightM) + systemLossDb;
  }

  function normalizeInputs(profileId, input = {}) {
    const profile = profileApi.getProfile(profileId);
    const basic = profileApi.validateInputs(profile, input);
    const errors = basic.errors.slice();
    const normalized = {
      frequencyMHz: basic.normalized.frequencyMHz,
      txHeightM: basic.normalized.txHeightM,
      rxHeightM: basic.normalized.rxHeightM,
      referenceDistanceM: optionalNumber(input.referenceDistanceM == null ? 1 : input.referenceDistanceM),
      maximumRangeM: optionalNumber(input.maximumRangeM == null ? 100 : input.maximumRangeM),
      shadowingSigmaDb: optionalNumber(input.shadowingSigmaDb == null ? 0 : input.shadowingSigmaDb),
      systemLossDb: optionalNumber(input.systemLossDb == null ? 0 : input.systemLossDb),
      randomSeed: optionalNumber(input.randomSeed == null ? 1 : input.randomSeed),
      successRatioTx: optionalNumber(input.successRatioTx == null ? 1 : input.successRatioTx),
      rxSensitivityDbm: optionalNumber(input.rxSensitivityDbm == null ? -100 : input.rxSensitivityDbm),
      rssiInflectionPointDbm: optionalNumber(input.rssiInflectionPointDbm == null ? -92 : input.rssiInflectionPointDbm),
      enableTimeVariation: input.enableTimeVariation === true || input.enableTimeVariation === 'true',
      approximationPathLossExponent: optionalNumber(input.approximationPathLossExponent),
      agricultureConditionId: input.agricultureConditionId || 'corn-growth'
    };

    for (const [field, label] of [
      ['referenceDistanceM', 'Reference distance'],
      ['maximumRangeM', 'Maximum evaluation/cutoff range']
    ]) {
      if (!finite(normalized[field]) || normalized[field] <= 0) errors.push(`${label} must be a positive finite number.`);
    }
    if (finite(normalized.referenceDistanceM) && finite(normalized.maximumRangeM) && normalized.maximumRangeM < normalized.referenceDistanceM) {
      errors.push('Maximum evaluation/cutoff range must not be shorter than the reference distance.');
    }
    if (!finite(normalized.shadowingSigmaDb) || normalized.shadowingSigmaDb < 0) {
      errors.push('Shadowing sigma must be a non-negative finite number.');
    }
    if (!finite(normalized.systemLossDb) || normalized.systemLossDb < 0) {
      errors.push('System loss must be a non-negative finite dB value.');
    }
    if (!Number.isSafeInteger(normalized.randomSeed) || normalized.randomSeed < 0) {
      errors.push('Random seed must be a non-negative safe integer.');
    }
    if (!finite(normalized.successRatioTx) || normalized.successRatioTx < 0 || normalized.successRatioTx > 1) {
      errors.push('TX success ratio must be a finite number from 0 to 1.');
    }
    if (!finite(normalized.rxSensitivityDbm)) {
      errors.push('RX sensitivity must be a finite dBm value.');
    }
    if (!finite(normalized.rssiInflectionPointDbm)) {
      errors.push('RSSI inflection point must be a finite dBm value.');
    }
    if (normalized.approximationPathLossExponent !== null &&
        (!finite(normalized.approximationPathLossExponent) || normalized.approximationPathLossExponent <= 0)) {
      errors.push('The calibrated proxy path-loss exponent must be a positive finite number when supplied.');
    }
    if (profileId === 'agriculture-crop-vegetation-24ghz' && !AGRICULTURE_CONDITIONS[normalized.agricultureConditionId]) {
      errors.push(`Unknown agriculture condition: ${normalized.agricultureConditionId}.`);
    }

    if (errors.length) throw new PropagationAdapterError('Propagation intermediate-representation validation failed.', errors);
    return { normalized, warnings: basic.warnings.slice(), withinFrequencyEvidence: basic.withinFrequencyEvidence };
  }

  function logDistanceModel(normalized, exponent, parameterOrigin, conditionId = null) {
    return {
      kind: 'log-distance',
      pathLossExponent: exponent,
      referenceDistanceM: normalized.referenceDistanceM,
      referenceLossDb: freeSpacePathLossDb(
        normalized.frequencyMHz,
        normalized.referenceDistanceM,
        normalized.systemLossDb
      ),
      shadowingSigmaDb: normalized.shadowingSigmaDb,
      parameterOrigin,
      conditionId
    };
  }

  function buildPrimaryModel(profileId, normalized) {
    if (profileId === 'free-space-los-baseline') {
      return {
        kind: 'friis-free-space',
        frequencyMHz: normalized.frequencyMHz,
        systemLossDb: normalized.systemLossDb
      };
    }
    if (profileId === 'agriculture-crop-vegetation-24ghz') {
      const condition = AGRICULTURE_CONDITIONS[normalized.agricultureConditionId];
      return logDistanceModel(normalized, condition.pathLossExponent, 'cited-measurement-condition', condition.id);
    }
    if (profileId === 'coastal-over-water-24ghz') {
      return {
        kind: 'two-ray-ground',
        frequencyMHz: normalized.frequencyMHz,
        txHeightM: normalized.txHeightM,
        rxHeightM: normalized.rxHeightM,
        systemLossDb: normalized.systemLossDb,
        crossoverDistanceM: twoRayCrossoverDistanceM(normalized.frequencyMHz, normalized.txHeightM, normalized.rxHeightM)
      };
    }
    if (profileId === 'urban-open-street-los') {
      return {
        kind: 'itu-r-p1411-los-family',
        frequencyMHz: normalized.frequencyMHz,
        geometryRequired: true
      };
    }
    if (profileId === 'urban-street-canyon-nlos') {
      return {
        kind: 'itu-r-p1411-nlos-family',
        frequencyMHz: normalized.frequencyMHz,
        geometryRequired: true
      };
    }
    if (profileId === 'forest-vegetation') {
      return {
        kind: 'itu-r-p833-vegetation-family',
        frequencyMHz: normalized.frequencyMHz,
        foliageInputsRequired: true
      };
    }
    throw new PropagationAdapterError(`No propagation model is registered for ${profileId}.`);
  }

  function buildPropagationIr(profileId, input = {}) {
    const profile = profileApi.getProfile(profileId);
    const validation = normalizeInputs(profileId, input);
    const normalized = validation.normalized;
    const primaryModel = buildPrimaryModel(profileId, normalized);
    const calibratedProxyModel = normalized.approximationPathLossExponent === null
      ? null
      : logDistanceModel(normalized, normalized.approximationPathLossExponent, 'user-supplied-calibration');

    return {
      schema: 'org.cooja-positioner.propagation-ir',
      schemaVersion: SCHEMA_VERSION,
      profile: {
        id: profile.id,
        label: profile.label,
        sourceIds: profile.sourceIds.slice()
      },
      inputs: clone(normalized),
      applicability: {
        withinSourceFrequencyEvidence: validation.withinFrequencyEvidence,
        warnings: validation.warnings
      },
      primaryModel,
      calibratedProxyModel,
      references: profile.sourceIds.map(sourceId => ({ id: sourceId, ...clone(profileApi.references[sourceId]) })),
      notice: 'The environment profile initializes a cited model family. It is not a site measurement and does not establish cross-simulator equivalence.'
    };
  }

  function proxyForMapping(ir, exponent, origin) {
    return logDistanceModel(ir.inputs, exponent, origin);
  }

  function missingProxyAssessment(target, ir, reason) {
    return {
      target,
      supported: false,
      quality: MAPPING_QUALITY.UNSUPPORTED,
      model: null,
      warnings: ir.applicability.warnings.slice(),
      requirements: [reason, 'Supply a site-measured or otherwise justified proxy path-loss exponent n to enable an explicitly labelled log-distance approximation.']
    };
  }

  function resolveMapping(ir, targetId) {
    const target = TARGETS[targetId];
    if (!target) throw new PropagationAdapterError(`Unknown propagation target: ${targetId}.`);
    const profileId = ir.profile.id;
    const warnings = ir.applicability.warnings.slice();
    const requirements = [];
    let model = ir.primaryModel;
    let quality = MAPPING_QUALITY.NATIVE;

    if (targetId === 'cooja') {
      quality = MAPPING_QUALITY.APPROXIMATION;
      if (profileId === 'free-space-los-baseline') {
        model = proxyForMapping(ir, 2, 'Friis-equivalent-log-distance-mean');
      } else if (profileId === 'coastal-over-water-24ghz') {
        model = proxyForMapping(ir, 4, 'two-ray-far-field-slope-proxy');
      } else if (ir.primaryModel.kind !== 'log-distance') {
        if (!ir.calibratedProxyModel) {
          return missingProxyAssessment(target, ir, 'Cooja LogisticLoss does not natively implement the selected ITU-R model family.');
        }
        model = ir.calibratedProxyModel;
      }
      warnings.push('Cooja LogisticLoss is a log-distance/packet-reception approximation, not the cited environmental model itself.');
      warnings.push('transmitting_range is both a hard receiver-candidate cutoff and the distance at which LogisticLoss anchors mean RSSI to the configured rx_sensitivity.');
      requirements.push(`Set the enclosing Cooja simulation randomseed to ${ir.inputs.randomSeed}; this radio-medium fragment cannot replace the simulation-level seed element.`);
      if (model.shadowingSigmaDb > 0) {
        warnings.push('Cooja awgn_sigma is sampled per reception and is not spatially correlated log-normal shadowing.');
      }
    } else if (targetId === 'ns2') {
      if (ir.inputs.randomSeed > 63) {
        return {
          target,
          supported: false,
          quality: MAPPING_QUALITY.UNSUPPORTED,
          model: null,
          warnings,
          requirements: ['The ns-2 predefined-seed serializer requires an integer random seed from 0 to 63.']
        };
      }
      if (profileId === 'urban-open-street-los' || profileId === 'urban-street-canyon-nlos' || profileId === 'forest-vegetation') {
        if (!ir.calibratedProxyModel) {
          return missingProxyAssessment(target, ir, 'The pinned ns-2 distribution has no native implementation of the selected ITU-R family.');
        }
        model = ir.calibratedProxyModel;
        quality = MAPPING_QUALITY.APPROXIMATION;
      }
      if (profileId === 'coastal-over-water-24ghz') {
        requirements.push('Apply the entered Tx/Rx heights to the corresponding node antenna or mobility Z values; one global OmniAntenna Z value cannot encode unequal endpoint heights.');
        warnings.push('TwoRayGround is a smooth two-ray family model; it does not reproduce all measured over-water fading or time-varying tide/surface effects.');
      }
    } else if (targetId === 'ns3') {
      if (profileId === 'urban-open-street-los') {
        requirements.push('Set positive node MobilityModel Z coordinates consistent with the entered antenna heights.');
      } else if (profileId === 'urban-street-canyon-nlos' || profileId === 'forest-vegetation') {
        if (!ir.calibratedProxyModel) {
          const reason = profileId === 'urban-street-canyon-nlos'
            ? 'The native ns-3 ItuR1411NlosOverRooftop model needs rooftop, street, building, orientation, environment, and city-size inputs not inferred by this environment label.'
            : 'The pinned ns-3 propagation module has no native ITU-R P.833 vegetation-loss implementation.';
          return missingProxyAssessment(target, ir, reason);
        }
        model = ir.calibratedProxyModel;
        quality = MAPPING_QUALITY.APPROXIMATION;
      }
      if (model.kind === 'log-distance' && model.shadowingSigmaDb > 0) {
        quality = MAPPING_QUALITY.APPROXIMATION;
        warnings.push('ns-3 LogDistancePropagationLossModel reproduces the deterministic mean only; the requested Gaussian shadowing sigma is not emitted.');
      }
      if (profileId === 'coastal-over-water-24ghz') {
        requirements.push('For equal endpoint heights, the generated model stores their common value in HeightAboveZ. If the heights differ, HeightAboveZ remains zero and both values must be encoded in the corresponding MobilityModel Z coordinates.');
        warnings.push('TwoRayGroundPropagationLossModel is a family-level approximation to the cited near-shore measurements.');
      }
    } else if (targetId === 'omnetpp') {
      if (profileId === 'urban-open-street-los' || profileId === 'urban-street-canyon-nlos' || profileId === 'forest-vegetation') {
        if (!ir.calibratedProxyModel) {
          return missingProxyAssessment(target, ir, 'INET 4.7 does not natively implement the selected ITU-R model family in its standard path-loss modules.');
        }
        model = ir.calibratedProxyModel;
        quality = MAPPING_QUALITY.APPROXIMATION;
      }
      if (model.kind === 'log-distance' && Math.abs(model.referenceDistanceM - 1) > 1e-12) {
        quality = MAPPING_QUALITY.APPROXIMATION;
        warnings.push('INET LogNormalShadowing uses a 1 m internal reference; systemLoss is adjusted to preserve the requested mean curve.');
      }
      if (profileId === 'coastal-over-water-24ghz') {
        requirements.push('Set the corresponding mobility Z coordinates to the entered antenna heights above the FlatGround elevation.');
        warnings.push('TwoRayGroundReflection is a family-level approximation and does not include dynamic water-surface fading.');
      }
    }

    return { target, supported: true, quality, model, warnings, requirements };
  }

  function assessPropagationMapping(targetId, profileId, input = {}) {
    try {
      const ir = buildPropagationIr(profileId, input);
      return { ir, ...resolveMapping(ir, targetId), errors: [] };
    } catch (error) {
      if (!(error instanceof PropagationAdapterError) && !(error instanceof profileApi.PropagationProfileError)) throw error;
      return {
        target: TARGETS[targetId] || { id: targetId, label: targetId },
        supported: false,
        quality: MAPPING_QUALITY.UNSUPPORTED,
        model: null,
        warnings: [],
        requirements: [],
        errors: error.errors && error.errors.length ? error.errors.slice() : [error.message]
      };
    }
  }

  function meanPathLossDb(ir, distanceM, model = ir.primaryModel) {
    if (!finite(distanceM) || distanceM <= 0) throw new PropagationAdapterError('Reference-vector distance must be positive.');
    if (model.kind === 'friis-free-space') {
      return freeSpacePathLossDb(ir.inputs.frequencyMHz, distanceM, ir.inputs.systemLossDb);
    }
    if (model.kind === 'log-distance') {
      return logDistancePathLossDb(model.referenceLossDb, model.pathLossExponent, model.referenceDistanceM, distanceM);
    }
    if (model.kind === 'two-ray-ground') {
      return twoRayGroundPathLossDb(
        ir.inputs.frequencyMHz,
        distanceM,
        ir.inputs.txHeightM,
        ir.inputs.rxHeightM,
        ir.inputs.systemLossDb
      );
    }
    throw new PropagationAdapterError(`No simulator-neutral numerical evaluator is defined for ${model.kind}.`);
  }

  function referenceVector(ir, model) {
    const distances = [ir.inputs.referenceDistanceM, 10, 50, ir.inputs.maximumRangeM]
      .filter(distance => distance > 0)
      .filter((distance, index, array) => array.findIndex(item => Math.abs(item - distance) < 1e-12) === index)
      .sort((a, b) => a - b);
    try {
      return distances.map(distanceM => ({
        distanceM,
        meanPathLossDb: meanPathLossDb(ir, distanceM, model)
      }));
    } catch (error) {
      if (error instanceof PropagationAdapterError && error.message.startsWith('No simulator-neutral numerical evaluator')) return [];
      throw error;
    }
  }

  function metadataLines(ir, assessment, prefix) {
    const sourceIds = ir.profile.sourceIds.join(', ');
    const lines = [
      `${prefix} Generated by Cooja-Positioner propagation adapter schema ${SCHEMA_VERSION}.`,
      `${prefix} Profile: ${ir.profile.label} [${ir.profile.id}]`,
      `${prefix} Mapping quality: ${assessment.quality}`,
      `${prefix} Source identifiers: ${sourceIds}`,
      `${prefix} This is an initialization/configuration artifact, not a site-calibrated guarantee.`
    ];
    assessment.warnings.forEach(warning => lines.push(`${prefix} WARNING: ${warning}`));
    assessment.requirements.forEach(requirement => lines.push(`${prefix} REQUIRED: ${requirement}`));
    return lines;
  }

  function serializeCooja(ir, assessment) {
    const model = assessment.model;
    if (model.kind !== 'log-distance') throw new PropagationAdapterError('Cooja LogisticLoss serialization requires a log-distance proxy.');
    const rangeM = ir.inputs.maximumRangeM;
    const comments = metadataLines(ir, assessment, '  ').map(line => `<!--${line.trimEnd()} -->`).join('\n');
    return `${comments}\n<!-- Simulation-level setting (place outside radiomedium): <randomseed>${ir.inputs.randomSeed}</randomseed> -->\n<radiomedium>\n  org.contikios.cooja.radiomediums.LogisticLoss\n  <transmitting_range>${formatNumber(rangeM)}</transmitting_range>\n  <success_ratio_tx>${formatNumber(ir.inputs.successRatioTx)}</success_ratio_tx>\n  <rx_sensitivity>${formatNumber(ir.inputs.rxSensitivityDbm)}</rx_sensitivity>\n  <rssi_inflection_point>${formatNumber(ir.inputs.rssiInflectionPointDbm)}</rssi_inflection_point>\n  <path_loss_exponent>${formatNumber(model.pathLossExponent)}</path_loss_exponent>\n  <awgn_sigma>${formatNumber(model.shadowingSigmaDb)}</awgn_sigma>\n  <enable_time_variation>${ir.inputs.enableTimeVariation}</enable_time_variation>\n</radiomedium>\n`;
  }

  function serializeNs2(ir, assessment) {
    const model = assessment.model;
    const lines = metadataLines(ir, assessment, '#');
    lines.push('');
    lines.push(`Phy/WirelessPhy set freq_ ${formatScientific(ir.inputs.frequencyMHz * 1e6)}`);
    lines.push(`Phy/WirelessPhy set L_ ${formatNumber(dbToLinear(ir.inputs.systemLossDb))}`);
    if (model.kind === 'friis-free-space') {
      lines.push('set cpx_propagation [new Propagation/FreeSpace]');
    } else if (model.kind === 'two-ray-ground') {
      lines.push('set cpx_propagation [new Propagation/TwoRayGround]');
      lines.push(`# Entered endpoint heights: Tx=${formatNumber(ir.inputs.txHeightM)} m; Rx=${formatNumber(ir.inputs.rxHeightM)} m.`);
      if (Math.abs(ir.inputs.txHeightM - ir.inputs.rxHeightM) < 1e-12) {
        lines.push(`Antenna/OmniAntenna set Z_ ${formatNumber(ir.inputs.txHeightM)}`);
      } else {
        lines.push('# Heights differ: do not replace them with one global Antenna/OmniAntenna Z_ value.');
      }
    } else if (model.kind === 'log-distance') {
      lines.push('set cpx_propagation [new Propagation/Shadowing]');
      lines.push(`$cpx_propagation set pathlossExp_ ${formatNumber(model.pathLossExponent)}`);
      lines.push(`$cpx_propagation set std_db_ ${formatNumber(model.shadowingSigmaDb)}`);
      lines.push(`$cpx_propagation set dist0_ ${formatNumber(model.referenceDistanceM)}`);
      lines.push(`$cpx_propagation seed predef ${ir.inputs.randomSeed}`);
    } else {
      throw new PropagationAdapterError(`ns-2 cannot serialize ${model.kind}.`);
    }
    lines.push('');
    lines.push('# Use the configured instance in the scenario node configuration:');
    lines.push('# $ns_ node-config -propInstance $cpx_propagation ...');
    return `${lines.join('\n')}\n`;
  }

  function serializeNs3(ir, assessment) {
    const model = assessment.model;
    const lines = metadataLines(ir, assessment, '//');
    lines.push('#include "ns3/core-module.h"');
    lines.push('#include "ns3/propagation-module.h"');
    lines.push('');
    lines.push('ns3::Ptr<ns3::PropagationLossModel>');
    lines.push('CreateCpxPropagationModel()');
    lines.push('{');
    if (model.kind === 'friis-free-space') {
      lines.push('  auto model = ns3::CreateObject<ns3::FriisPropagationLossModel>();');
      lines.push(`  model->SetAttribute("Frequency", ns3::DoubleValue(${formatScientific(ir.inputs.frequencyMHz * 1e6)}));`);
      lines.push(`  model->SetAttribute("SystemLoss", ns3::DoubleValue(${formatNumber(dbToLinear(ir.inputs.systemLossDb))}));`);
    } else if (model.kind === 'two-ray-ground') {
      lines.push('  auto model = ns3::CreateObject<ns3::TwoRayGroundPropagationLossModel>();');
      lines.push(`  model->SetAttribute("Frequency", ns3::DoubleValue(${formatScientific(ir.inputs.frequencyMHz * 1e6)}));`);
      lines.push(`  model->SetAttribute("SystemLoss", ns3::DoubleValue(${formatNumber(dbToLinear(ir.inputs.systemLossDb))}));`);
      const commonHeight = Math.abs(ir.inputs.txHeightM - ir.inputs.rxHeightM) < 1e-12 ? ir.inputs.txHeightM : 0;
      lines.push(`  model->SetAttribute("HeightAboveZ", ns3::DoubleValue(${formatNumber(commonHeight)}));`);
    } else if (model.kind === 'log-distance') {
      lines.push('  auto model = ns3::CreateObject<ns3::LogDistancePropagationLossModel>();');
      lines.push(`  model->SetAttribute("Exponent", ns3::DoubleValue(${formatNumber(model.pathLossExponent)}));`);
      lines.push(`  model->SetAttribute("ReferenceDistance", ns3::DoubleValue(${formatNumber(model.referenceDistanceM)}));`);
      lines.push(`  model->SetAttribute("ReferenceLoss", ns3::DoubleValue(${formatNumber(model.referenceLossDb)}));`);
    } else if (model.kind === 'itu-r-p1411-los-family') {
      lines.push('  auto model = ns3::CreateObject<ns3::ItuR1411LosPropagationLossModel>();');
      lines.push(`  model->SetAttribute("Frequency", ns3::DoubleValue(${formatScientific(ir.inputs.frequencyMHz * 1e6)}));`);
    } else {
      throw new PropagationAdapterError(`ns-3 cannot serialize ${model.kind}.`);
    }
    lines.push('  return model;');
    lines.push('}');
    return `${lines.join('\n')}\n`;
  }

  function inetEffectiveSystemLossDb(model, requestedSystemLossDb) {
    if (model.kind !== 'log-distance') return requestedSystemLossDb;
    return requestedSystemLossDb + (20 - 10 * model.pathLossExponent) * Math.log10(model.referenceDistanceM);
  }

  function serializeInet(ir, assessment) {
    const model = assessment.model;
    const lines = metadataLines(ir, assessment, '#');
    lines.push('# Merge this fragment into omnetpp.ini and adapt module paths to the network NED hierarchy.');
    lines.push(`seed-set = ${ir.inputs.randomSeed}`);
    lines.push('');
    if (model.kind === 'friis-free-space') {
      lines.push('*.radioMedium.pathLoss.typename = "FreeSpacePathLoss"');
      lines.push('*.radioMedium.pathLoss.alpha = 2');
      lines.push(`*.radioMedium.pathLoss.systemLoss = ${formatNumber(ir.inputs.systemLossDb)}dB`);
    } else if (model.kind === 'log-distance') {
      const effectiveLossDb = inetEffectiveSystemLossDb(model, ir.inputs.systemLossDb);
      lines.push('*.radioMedium.pathLoss.typename = "LogNormalShadowing"');
      lines.push(`*.radioMedium.pathLoss.alpha = ${formatNumber(model.pathLossExponent)}`);
      lines.push(`*.radioMedium.pathLoss.sigma = ${formatNumber(model.shadowingSigmaDb)}`);
      lines.push(`*.radioMedium.pathLoss.systemLoss = ${formatNumber(effectiveLossDb)}dB`);
    } else if (model.kind === 'two-ray-ground') {
      lines.push('*.physicalEnvironment.ground.typename = "FlatGround"');
      lines.push('*.physicalEnvironment.ground.elevation = 0m');
      lines.push('*.radioMedium.pathLoss.typename = "TwoRayGroundReflection"');
      lines.push(`# Entered endpoint heights above ground: Tx=${formatNumber(ir.inputs.txHeightM)}m; Rx=${formatNumber(ir.inputs.rxHeightM)}m.`);
    } else {
      throw new PropagationAdapterError(`INET cannot serialize ${model.kind}.`);
    }
    return `${lines.join('\n')}\n`;
  }

  function serializeForTarget(ir, assessment) {
    if (assessment.target.id === 'cooja') return serializeCooja(ir, assessment);
    if (assessment.target.id === 'ns2') return serializeNs2(ir, assessment);
    if (assessment.target.id === 'ns3') return serializeNs3(ir, assessment);
    if (assessment.target.id === 'omnetpp') return serializeInet(ir, assessment);
    throw new PropagationAdapterError(`No serializer for ${assessment.target.id}.`);
  }

  function createPropagationArtifact(targetId, profileId, input = {}) {
    const ir = buildPropagationIr(profileId, input);
    const assessment = resolveMapping(ir, targetId);
    if (!assessment.supported) {
      throw new PropagationAdapterError(
        `No defensible ${assessment.target.label} mapping can be generated from the supplied context.`,
        assessment.requirements
      );
    }
    const text = serializeForTarget(ir, assessment);
    return {
      targetId,
      profileId,
      filename: `propagation-${profileId}-${targetId}.${assessment.target.extension}`,
      mimeType: assessment.target.mimeType,
      text,
      mapping: {
        quality: assessment.quality,
        modelKind: assessment.model.kind,
        warnings: assessment.warnings.slice(),
        requirements: assessment.requirements.slice()
      },
      ir,
      referenceVector: referenceVector(ir, assessment.model)
    };
  }

  return Object.freeze({
    SCHEMA_VERSION,
    SPEED_OF_LIGHT_M_S,
    TARGETS,
    MAPPING_QUALITY,
    AGRICULTURE_CONDITIONS,
    PropagationAdapterError,
    freeSpacePathLossDb,
    logDistancePathLossDb,
    twoRayCrossoverDistanceM,
    twoRayGroundPathLossDb,
    buildPropagationIr,
    assessPropagationMapping,
    meanPathLossDb,
    createPropagationArtifact
  });
});
