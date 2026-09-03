(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CoojaPositionerPropagationProfiles = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const SCHEMA_VERSION = '1.0.0';

  class PropagationProfileError extends Error {
    constructor(message, errors = []) {
      super(message);
      this.name = 'PropagationProfileError';
      this.errors = errors.slice();
    }
  }

  function deepFreeze(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
    return value;
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  const references = deepFreeze({
    'itu-r-p1411-13': {
      type: 'standard',
      organization: 'ITU-R',
      designation: 'Recommendation ITU-R P.1411-13',
      title: 'Propagation data and prediction methods for the planning of short-range outdoor radiocommunication systems and radio local area networks in the frequency range 300 MHz to 300 GHz',
      year: 2025,
      url: 'https://www.itu.int/rec/R-REC-P.1411-13-202509-I/en',
      bibtex: '@techreport{itur_p1411_13_2025,\n  author = {{ITU-R}},\n  title = {Propagation data and prediction methods for the planning of short-range outdoor radiocommunication systems and radio local area networks in the frequency range 300 MHz to 300 GHz},\n  institution = {International Telecommunication Union},\n  number = {Recommendation ITU-R P.1411-13},\n  year = {2025},\n  url = {https://www.itu.int/rec/R-REC-P.1411-13-202509-I/en}\n}'
    },
    'itu-r-p833-10': {
      type: 'standard',
      organization: 'ITU-R',
      designation: 'Recommendation ITU-R P.833-10',
      title: 'Attenuation in vegetation',
      year: 2021,
      url: 'https://www.itu.int/rec/R-REC-P.833-10-202109-I/en',
      bibtex: '@techreport{itur_p833_10_2021,\n  author = {{ITU-R}},\n  title = {Attenuation in vegetation},\n  institution = {International Telecommunication Union},\n  number = {Recommendation ITU-R P.833-10},\n  year = {2021},\n  url = {https://www.itu.int/rec/R-REC-P.833-10-202109-I/en}\n}'
    },
    'dhanavanthan-2013-agriculture': {
      type: 'article',
      authors: ['Balachander Dhanavanthan', 'Thipparaju Rama Rao', 'Govindaraju Mahesh'],
      title: 'RF Propagation Experiments in Agricultural Fields and Gardens for Wireless Sensor Communications',
      venue: 'Progress In Electromagnetics Research C',
      volume: '39',
      pages: '103--118',
      year: 2013,
      doi: '10.2528/PIERC13030710',
      url: 'https://doi.org/10.2528/PIERC13030710',
      bibtex: '@article{dhanavanthan2013agriculture,\n  author = {Dhanavanthan, Balachander and Rao, Thipparaju Rama and Mahesh, Govindaraju},\n  title = {RF Propagation Experiments in Agricultural Fields and Gardens for Wireless Sensor Communications},\n  journal = {Progress In Electromagnetics Research C},\n  volume = {39},\n  pages = {103--118},\n  year = {2013},\n  doi = {10.2528/PIERC13030710}\n}'
    },
    'gaitan-2020-over-water': {
      type: 'conference-paper',
      authors: ['Miguel Gutierrez Gaitan', 'Pedro M. Santos', 'Luis R. Pinto', 'Luis Almeida'],
      title: 'Experimental Evaluation of the Two-Ray Model for Near-Shore WiFi-Based Network Systems Design',
      venue: '2020 IEEE 91st Vehicular Technology Conference (VTC2020-Spring)',
      year: 2020,
      doi: '10.1109/VTC2020-Spring48590.2020.9129548',
      url: 'https://doi.org/10.1109/VTC2020-Spring48590.2020.9129548',
      bibtex: '@inproceedings{gaitan2020overwater,\n  author = {Gaitan, Miguel Gutierrez and Santos, Pedro M. and Pinto, Luis R. and Almeida, Luis},\n  title = {Experimental Evaluation of the Two-Ray Model for Near-Shore WiFi-Based Network Systems Design},\n  booktitle = {2020 IEEE 91st Vehicular Technology Conference (VTC2020-Spring)},\n  year = {2020},\n  doi = {10.1109/VTC2020-Spring48590.2020.9129548}\n}'
    },
    'friis-1946': {
      type: 'article',
      authors: ['Harald T. Friis'],
      title: 'A Note on a Simple Transmission Formula',
      venue: 'Proceedings of the IRE',
      volume: '34',
      issue: '5',
      pages: '254--256',
      year: 1946,
      doi: '10.1109/JRPROC.1946.234568',
      url: 'https://doi.org/10.1109/JRPROC.1946.234568',
      bibtex: '@article{friis1946transmission,\n  author = {Friis, Harald T.},\n  title = {A Note on a Simple Transmission Formula},\n  journal = {Proceedings of the IRE},\n  volume = {34},\n  number = {5},\n  pages = {254--256},\n  year = {1946},\n  doi = {10.1109/JRPROC.1946.234568}\n}'
    }
  });

  const profiles = deepFreeze({
    'urban-open-street-los': {
      id: 'urban-open-street-los',
      label: 'Urban — Open Street / LoS',
      environment: 'urban',
      propagationCondition: 'line-of-sight short-range outdoor path',
      modelFamily: 'ITU-R P.1411 short-range outdoor LoS',
      summary: 'Cited starting profile for an outdoor urban path with a substantially unobstructed line of sight.',
      evidence: {
        frequencyMHz: { min: 300, max: 300000 },
        setting: 'Short-range outdoor radio systems and radio local-area networks.',
        requiredContext: ['LoS confirmation', 'link distance', 'antenna heights', 'street/building geometry where required by the selected P.1411 submodel']
      },
      sourceIds: ['itu-r-p1411-13'],
      caveat: 'P.1411 contains multiple frequency- and geometry-specific submodels; selecting this environment does not by itself determine every numerical parameter.'
    },
    'urban-street-canyon-nlos': {
      id: 'urban-street-canyon-nlos',
      label: 'Urban — Street Canyon / NLoS',
      environment: 'urban',
      propagationCondition: 'non-line-of-sight urban street-canyon path',
      modelFamily: 'ITU-R P.1411 short-range outdoor NLoS',
      summary: 'Cited starting profile for obstructed urban links where street-canyon or over-rooftop geometry is relevant.',
      evidence: {
        frequencyMHz: { min: 300, max: 300000 },
        setting: 'Short-range outdoor NLoS paths in built-up environments.',
        requiredContext: ['NLoS confirmation', 'link distance', 'antenna heights', 'street width', 'building height or rooftop geometry when required']
      },
      sourceIds: ['itu-r-p1411-13'],
      caveat: 'A generic Urban label is insufficient for a site-specific P.1411 calculation; the applicable submodel and its geometry inputs must be recorded.'
    },
    'agriculture-crop-vegetation-24ghz': {
      id: 'agriculture-crop-vegetation-24ghz',
      label: 'Agriculture — Crop / Vegetation (2.4 GHz)',
      environment: 'agriculture',
      propagationCondition: 'short-range near-ground agricultural or garden link',
      modelFamily: 'measurement-derived path-loss exponent and foliage-loss comparison',
      summary: 'Evidence profile based on 2.4-GHz measurements in corn, paddy, groundnut, coconut-garden, and lawn settings.',
      evidence: {
        frequencyMHz: { exact: 2400 },
        setting: 'Short-range, near-ground WSN links in measured agricultural fields and gardens.',
        requiredContext: ['crop or vegetation type', 'growth/foliage state', 'antenna heights', 'measurement geometry']
      },
      sourceIds: ['dhanavanthan-2013-agriculture'],
      caveat: 'The cited measurements do not define one universal agriculture parameter set; crop type and vegetation condition must remain part of the exported provenance.'
    },
    'forest-vegetation': {
      id: 'forest-vegetation',
      label: 'Forest — Vegetation Attenuation',
      environment: 'forest',
      propagationCondition: 'radio path obstructed by woodland or other vegetation',
      modelFamily: 'base propagation model plus ITU-R P.833 vegetation excess loss',
      summary: 'Standards-based starting profile for additional attenuation caused by vegetation.',
      evidence: {
        frequencyMHz: { min: 30, max: 100000 },
        setting: 'Multiple vegetation types and terrestrial or slant path geometries covered by distinct P.833 submodels.',
        requiredContext: ['vegetation type', 'foliage depth', 'leaf state or season', 'path geometry', 'base propagation model']
      },
      sourceIds: ['itu-r-p833-10'],
      caveat: 'P.833 is a family of vegetation models with narrower individual validity ranges; the broad Recommendation range is not a universal formula range.'
    },
    'coastal-over-water-24ghz': {
      id: 'coastal-over-water-24ghz',
      label: 'Coastal — Over-Water (2.4 GHz)',
      environment: 'coastal',
      propagationCondition: 'short-to-medium near-shore over-water link',
      modelFamily: 'two-ray surface reflection',
      summary: 'Evidence profile motivated by 2.4-GHz near-shore measurements with antennas a few metres above the water surface.',
      evidence: {
        frequencyMHz: { exact: 2400 },
        setting: 'Near-shore over-water links where the reflected ray and changing surface geometry may affect received power.',
        requiredContext: ['Tx antenna height above water', 'Rx antenna height above water', 'link distance', 'surface level or tide assumption', 'reflection parameters']
      },
      sourceIds: ['gaitan-2020-over-water'],
      caveat: 'The two-ray model captures major measured trends but not all fading; water level and antenna height can materially change interference geometry.'
    },
    'free-space-los-baseline': {
      id: 'free-space-los-baseline',
      label: 'Reference — Free-Space LoS Baseline',
      environment: 'reference',
      propagationCondition: 'unobstructed far-field free-space link',
      modelFamily: 'Friis free-space transmission',
      summary: 'Idealized reference profile for comparison with environment-conditioned profiles.',
      evidence: {
        frequencyMHz: null,
        setting: 'Unobstructed far-field link with known antenna gains and polarization assumptions.',
        requiredContext: ['far-field validity', 'link distance', 'antenna gains', 'frequency', 'polarization and system-loss assumptions']
      },
      sourceIds: ['friis-1946'],
      caveat: 'This baseline intentionally omits shadowing, vegetation, structures, ground/water reflection, and small-scale fading.'
    }
  });

  function getProfile(id) {
    const profile = profiles[id];
    if (!profile) throw new PropagationProfileError(`Unknown propagation environment profile: ${id}`);
    return profile;
  }

  function validateInputs(profile, input) {
    const errors = [];
    const warnings = [];
    const normalized = {
      frequencyMHz: Number(input && input.frequencyMHz),
      txHeightM: Number(input && input.txHeightM),
      rxHeightM: Number(input && input.rxHeightM)
    };

    for (const [field, label] of [
      ['frequencyMHz', 'Frequency'],
      ['txHeightM', 'Tx antenna height'],
      ['rxHeightM', 'Rx antenna height']
    ]) {
      if (!Number.isFinite(normalized[field]) || normalized[field] <= 0) {
        errors.push(`${label} must be a positive finite number.`);
      }
    }

    let withinFrequencyEvidence = null;
    const range = profile.evidence.frequencyMHz;
    if (!errors.length && range) {
      if (Number.isFinite(range.exact)) {
        withinFrequencyEvidence = Math.abs(normalized.frequencyMHz - range.exact) < 1e-9;
        if (!withinFrequencyEvidence) {
          warnings.push(`The cited evidence for this profile is at ${range.exact} MHz; ${normalized.frequencyMHz} MHz is outside that evidence frequency.`);
        }
      } else {
        withinFrequencyEvidence = normalized.frequencyMHz >= range.min && normalized.frequencyMHz <= range.max;
        if (!withinFrequencyEvidence) {
          warnings.push(`The cited source covers ${range.min}–${range.max} MHz; ${normalized.frequencyMHz} MHz is outside that range.`);
        }
      }
    }

    return { valid: errors.length === 0, errors, warnings, normalized, withinFrequencyEvidence };
  }

  function createProfileArtifact(profileId, input) {
    const profile = getProfile(profileId);
    const validation = validateInputs(profile, input);
    if (!validation.valid) {
      throw new PropagationProfileError('Propagation profile input validation failed.', validation.errors);
    }
    const payload = {
      schema: 'org.cooja-positioner.propagation-profile',
      schemaVersion: SCHEMA_VERSION,
      status: 'citation-backed-initialization-profile',
      profile: clone(profile),
      userInputs: validation.normalized,
      applicability: {
        withinSourceFrequencyEvidence: validation.withinFrequencyEvidence,
        warnings: validation.warnings
      },
      references: profile.sourceIds.map(sourceId => ({ id: sourceId, ...clone(references[sourceId]) })),
      implementation: {
        simulatorMappings: 'separate-target-artifacts',
        note: 'This catalog artifact records source and applicability metadata only. Use the separate propagation adapter layer to assess and export a target-specific Cooja, ns-2, ns-3, or INET configuration.'
      },
      notice: 'This cited profile is an initialization prior, not a site-specific measurement or a guarantee of equivalent behavior across simulators.'
    };
    return {
      profileId,
      filename: `propagation-profile-${profileId}.json`,
      mimeType: 'application/json',
      text: `${JSON.stringify(payload, null, 2)}\n`,
      payload,
      warnings: validation.warnings.slice()
    };
  }

  return Object.freeze({
    SCHEMA_VERSION,
    PropagationProfileError,
    references,
    profiles,
    getProfile,
    validateInputs,
    createProfileArtifact
  });
});
