(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CoojaPositionerCscPathLossWriter = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  class CoojaCscWriteError extends Error {
    constructor(message, errors = []) {
      super(message);
      this.name = 'CoojaCscWriteError';
      this.errors = errors.slice();
    }
  }

  function finite(value) {
    return typeof value === 'number' && Number.isFinite(value);
  }

  function formatNumber(value) {
    if (!finite(value)) throw new CoojaCscWriteError('Cannot serialize a non-finite number.');
    const fixed = value.toFixed(9).replace(/0+$/, '').replace(/\.$/, '');
    return fixed === '-0' || fixed === '' ? '0' : fixed;
  }

  function commentText(value) {
    return String(value || '').replace(/--/g, '—').replace(/[\r\n]+/g, ' ').trim();
  }

  function validateSettings(input) {
    const errors = [];
    if (!input || typeof input.text !== 'string' || !input.text.trim()) errors.push('Select a non-empty Cooja .csc file.');
    if (input && input.filename && !/\.csc$/i.test(input.filename)) errors.push('The selected file must use the .csc extension.');
    if (!Number.isSafeInteger(input && input.randomSeed) || input.randomSeed < 0) {
      errors.push('Simulation random seed must be a non-negative safe integer.');
    }
    const radio = input && input.radio;
    if (!radio) {
      errors.push('Cooja LogisticLoss settings are required.');
    } else {
      if (!finite(radio.transmittingRangeM) || radio.transmittingRangeM <= 0) errors.push('Transmitting range must be positive.');
      if (!finite(radio.successRatioTx) || radio.successRatioTx < 0 || radio.successRatioTx > 1) errors.push('TX success ratio must be from 0 to 1.');
      if (!finite(radio.rxSensitivityDbm)) errors.push('RX sensitivity must be finite.');
      if (!finite(radio.rssiInflectionPointDbm)) errors.push('RSSI inflection point must be finite.');
      if (!finite(radio.pathLossExponent) || radio.pathLossExponent <= 0) errors.push('Path-loss exponent must be positive.');
      if (!finite(radio.awgnSigmaDb) || radio.awgnSigmaDb < 0) errors.push('AWGN sigma must be non-negative.');
      if (typeof radio.enableTimeVariation !== 'boolean') errors.push('Time variation must be true or false.');
    }
    if (errors.length) throw new CoojaCscWriteError('Cooja path-loss write validation failed.', errors);
  }

  function tagMatches(text, tag) {
    return Array.from(text.matchAll(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`, 'gi')));
  }

  function simulationParts(text) {
    const openings = Array.from(text.matchAll(/<simulation\b[^>]*>/gi));
    const closings = Array.from(text.matchAll(/<\/simulation>/gi));
    if (openings.length !== 1 || closings.length !== 1 || closings[0].index <= openings[0].index) {
      throw new CoojaCscWriteError('The selected file is not an unambiguous Cooja simulation.', [
        'Expected exactly one <simulation> element in the .csc file.'
      ]);
    }
    const openEnd = openings[0].index + openings[0][0].length;
    const closeStart = closings[0].index;
    return {
      before: text.slice(0, openEnd),
      body: text.slice(openEnd, closeStart),
      after: text.slice(closeStart)
    };
  }

  function lineIndent(text, index, fallback = '    ') {
    const lineStart = text.lastIndexOf('\n', index - 1) + 1;
    const prefix = text.slice(lineStart, index);
    return /^[ \t]*$/.test(prefix) ? prefix : fallback;
  }

  function replaceWholeLineBlock(text, match, replacement) {
    const lineStart = text.lastIndexOf('\n', match.index - 1) + 1;
    const prefix = text.slice(lineStart, match.index);
    const start = /^[ \t]*$/.test(prefix) ? lineStart : match.index;
    return text.slice(0, start) + replacement + text.slice(match.index + match[0].length);
  }

  function logisticLossBlock(indent, newline, input) {
    const child = indent + '  ';
    const radio = input.radio;
    const profile = commentText(input.profileLabel || 'user-selected cited profile');
    const source = commentText(input.profileUrl);
    const provenance = source ? `${profile}; source=${source}` : profile;
    return [
      `${indent}<radiomedium>`,
      `${child}org.contikios.cooja.radiomediums.LogisticLoss`,
      `${child}<!-- Cooja-Positioner literature-informed profile: ${provenance}. -->`,
      `${child}<transmitting_range>${formatNumber(radio.transmittingRangeM)}</transmitting_range>`,
      `${child}<success_ratio_tx>${formatNumber(radio.successRatioTx)}</success_ratio_tx>`,
      `${child}<rx_sensitivity>${formatNumber(radio.rxSensitivityDbm)}</rx_sensitivity>`,
      `${child}<rssi_inflection_point>${formatNumber(radio.rssiInflectionPointDbm)}</rssi_inflection_point>`,
      `${child}<path_loss_exponent>${formatNumber(radio.pathLossExponent)}</path_loss_exponent>`,
      `${child}<awgn_sigma>${formatNumber(radio.awgnSigmaDb)}</awgn_sigma>`,
      `${child}<enable_time_variation>${radio.enableTimeVariation}</enable_time_variation>`,
      `${indent}</radiomedium>`
    ].join(newline);
  }

  function inferChildIndent(body) {
    for (const tag of ['title', 'randomseed', 'motedelay_us', 'radiomedium', 'events', 'motetype', 'mote']) {
      const match = new RegExp(`<${tag}\\b`, 'i').exec(body);
      if (match) return lineIndent(body, match.index);
    }
    return '    ';
  }

  function replaceOrInsertSeed(body, newline, randomSeed) {
    const matches = tagMatches(body, 'randomseed');
    if (matches.length > 1) {
      throw new CoojaCscWriteError('The simulation contains multiple random seeds.', [
        'Expected at most one <randomseed> element.'
      ]);
    }
    if (matches.length === 1) {
      const indent = lineIndent(body, matches[0].index);
      return replaceWholeLineBlock(body, matches[0], `${indent}<randomseed>${randomSeed}</randomseed>`);
    }
    const indent = inferChildIndent(body);
    const title = tagMatches(body, 'title');
    const seedLine = `${indent}<randomseed>${randomSeed}</randomseed>`;
    if (title.length === 1) {
      const end = title[0].index + title[0][0].length;
      return body.slice(0, end) + newline + seedLine + body.slice(end);
    }
    return newline + seedLine + body;
  }

  function replaceOrInsertRadio(body, newline, input) {
    const matches = tagMatches(body, 'radiomedium');
    if (matches.length > 1) {
      throw new CoojaCscWriteError('The simulation contains multiple radio-medium blocks.', [
        'Expected at most one <radiomedium> element.'
      ]);
    }
    if (matches.length === 1) {
      const indent = lineIndent(body, matches[0].index);
      return replaceWholeLineBlock(body, matches[0], logisticLossBlock(indent, newline, input));
    }
    const indent = inferChildIndent(body);
    const anchors = ['motedelay_us', 'randomseed', 'title'];
    for (const tag of anchors) {
      const matchesForTag = tagMatches(body, tag);
      if (matchesForTag.length === 1) {
        const end = matchesForTag[0].index + matchesForTag[0][0].length;
        return body.slice(0, end) + newline + logisticLossBlock(indent, newline, input) + body.slice(end);
      }
    }
    return newline + logisticLossBlock(indent, newline, input) + body;
  }

  function radioMediumClass(body) {
    const matches = tagMatches(body, 'radiomedium');
    if (matches.length !== 1) return null;
    const inner = matches[0][0]
      .replace(/^<radiomedium\b[^>]*>/i, '')
      .replace(/<\/radiomedium>$/i, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .trim();
    const first = inner.split(/\r?\n/).map(line => line.trim()).find(Boolean);
    return first && !first.startsWith('<') ? first : null;
  }

  function inspectCoojaCsc(text, filename = '') {
    if (typeof text !== 'string' || !text.trim()) {
      throw new CoojaCscWriteError('Select a non-empty Cooja .csc file.');
    }
    if (filename && !/\.csc$/i.test(filename)) {
      throw new CoojaCscWriteError('The selected file must use the .csc extension.');
    }
    if (typeof DOMParser === 'function') {
      const document = new DOMParser().parseFromString(text, 'application/xml');
      if (document.querySelector('parsererror')) {
        throw new CoojaCscWriteError('The selected .csc file is not well-formed XML.');
      }
    }
    const parts = simulationParts(text);
    const radioCount = tagMatches(parts.body, 'radiomedium').length;
    if (radioCount > 1) {
      throw new CoojaCscWriteError('The simulation contains multiple radio-medium blocks.');
    }
    return Object.freeze({
      filename,
      radioMediumClass: radioMediumClass(parts.body),
      hasRandomSeed: tagMatches(parts.body, 'randomseed').length === 1,
      hasMobilityPlugin: /org\.contikios\.cooja\.plugins\.Mobility/.test(text),
      moteCount: tagMatches(parts.body, 'mote').length
    });
  }

  function patchCoojaCsc(input) {
    validateSettings(input);
    const original = String(input.text);
    const inspection = inspectCoojaCsc(original, input.filename || '');
    const newline = original.includes('\r\n') ? '\r\n' : '\n';
    const parts = simulationParts(original);
    let body = replaceOrInsertSeed(parts.body, newline, input.randomSeed);
    body = replaceOrInsertRadio(body, newline, input);
    let text = parts.before + body + parts.after;
    let removedUdgmVisualizerSkins = 0;
    text = text.replace(/^[ \t]*<skin>\s*org\.contikios\.cooja\.plugins\.skins\.UDGMVisualizerSkin\s*<\/skin>[ \t]*(?:\r?\n)?/gim, () => {
      removedUdgmVisualizerSkins += 1;
      return '';
    });
    const sourceName = input.filename || 'simulation.csc';
    const filename = sourceName.replace(/\.csc$/i, '') + '-pathloss.csc';
    return Object.freeze({
      filename,
      mimeType: 'application/xml',
      text,
      previousRadioMediumClass: inspection.radioMediumClass,
      removedUdgmVisualizerSkins
    });
  }

  return Object.freeze({ CoojaCscWriteError, inspectCoojaCsc, patchCoojaCsc });
});
