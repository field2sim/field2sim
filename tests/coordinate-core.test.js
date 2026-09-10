'use strict';

const assert = require('node:assert/strict');
const {
  WGS84_A,
  WGS84_E2,
  geodeticToEcef,
  ecefToGeodetic,
  geodeticToEnu,
  enuToGeodetic
} = require('../coordinate-core.js');

function close(actual, expected, tolerance, label) {
  assert.ok(Math.abs(actual - expected) <= tolerance,
    `${label}: expected ${expected} +/- ${tolerance}, got ${actual}`);
}

function testOriginIsZero() {
  const origin = { lat: 41.2867, lng: 36.33, alt: 17 };
  const enu = geodeticToEnu(origin, origin);
  close(enu.east, 0, 1e-9, 'origin east');
  close(enu.north, 0, 1e-9, 'origin north');
  close(enu.up, 0, 1e-9, 'origin up');
}

function testKnownEastDisplacementAcrossLatitudes() {
  for (const lat of [0, 41, 60]) {
    const latRad = lat * Math.PI / 180;
    const n = WGS84_A / Math.sqrt(1 - WGS84_E2 * Math.sin(latRad) ** 2);
    const lngDeltaDeg = (100 / (n * Math.cos(latRad))) * 180 / Math.PI;
    const enu = geodeticToEnu(
      { lat, lng: 30 + lngDeltaDeg, alt: 0 },
      { lat, lng: 30, alt: 0 }
    );
    close(enu.east, 100, 0.002, `100 m east at latitude ${lat}`);
    close(enu.north, 0, 0.002, `east displacement north residual at latitude ${lat}`);
  }
}

function testEcefRoundTrip() {
  const points = [
    { lat: 0, lng: 0, alt: 0 },
    { lat: 41.2867, lng: 36.33, alt: 23.5 },
    { lat: -33.8688, lng: 151.2093, alt: 130 },
    { lat: 80, lng: -170, alt: 5 }
  ];
  for (const point of points) {
    const restored = ecefToGeodetic(geodeticToEcef(point));
    close(restored.lat, point.lat, 1e-9, 'ECEF round-trip latitude');
    close(restored.lng, point.lng, 1e-9, 'ECEF round-trip longitude');
    close(restored.alt, point.alt, 1e-5, 'ECEF round-trip altitude');
  }
}

function testEnuRoundTrip() {
  const origin = { lat: 41.2867, lng: 36.33, alt: 0 };
  const point = { lat: 41.2912, lng: 36.3375, alt: 14 };
  const enu = geodeticToEnu(point, origin);
  const restored = enuToGeodetic(enu, origin);
  close(restored.lat, point.lat, 1e-9, 'ENU round-trip latitude');
  close(restored.lng, point.lng, 1e-9, 'ENU round-trip longitude');
  close(restored.alt, point.alt, 1e-5, 'ENU round-trip altitude');
}

function testInputValidation() {
  assert.throws(() => geodeticToEnu({ lat: 91, lng: 0 }, { lat: 0, lng: 0 }), /latitude|lat/i);
  assert.throws(() => enuToGeodetic({ east: NaN, north: 0 }, { lat: 0, lng: 0 }), /finite/i);
}

function testCoojaYAxisConventionRoundTrip() {
  const origin = { lat: 41.2867, lng: 36.33, alt: 0 };
  const point = { lat: 41.2876, lng: 36.33, alt: 0 };
  const local = geodeticToEnu(point, origin);
  assert.ok(local.north > 0, 'a northern point must have positive ENU north');
  const coojaY = -local.north;
  assert.ok(coojaY < 0, 'Cooja export convention must encode north as negative Y');
  const restored = enuToGeodetic({ east: local.east, north: -coojaY, up: local.up }, origin);
  close(restored.lat, point.lat, 1e-9, 'Cooja Y round-trip latitude');
  close(restored.lng, point.lng, 1e-9, 'Cooja Y round-trip longitude');
}

function testExplicitOriginChangesCoordinatesDeterministically() {
  const point = { lat: 41.2867, lng: 36.33, alt: 0 };
  const firstRowOrigin = { ...point };
  const customOrigin = { lat: 41.28, lng: 36.32, alt: 0 };
  const atFirstOrigin = geodeticToEnu(point, firstRowOrigin);
  const atCustomOriginA = geodeticToEnu(point, customOrigin);
  const atCustomOriginB = geodeticToEnu(point, customOrigin);
  close(atFirstOrigin.east, 0, 1e-9, 'first-row origin east');
  assert.ok(Math.hypot(atCustomOriginA.east, atCustomOriginA.north) > 100,
    'custom origin should retain a non-zero geographic offset');
  assert.deepEqual(atCustomOriginA, atCustomOriginB,
    'same WGS84 point and origin must always produce identical local coordinates');
}

testOriginIsZero();
testKnownEastDisplacementAcrossLatitudes();
testEcefRoundTrip();
testEnuRoundTrip();
testCoojaYAxisConventionRoundTrip();
testExplicitOriginChangesCoordinatesDeterministically();
testInputValidation();

console.log('coordinate-core: all tests passed');

// Inverse of the application's XY-at-zero / separate-altitude export convention.
const {localToGeographic} = require('../coordinate-core.js');
for(const origin of [{lat:41.3,lng:36.3,alt:400},{lat:-33,lng:151,alt:-20},{lat:80,lng:-170,alt:1500},{lat:0,lng:179.99,alt:0}]) {
  for(const offset of [0,0.001,0.1]) {
    const point={lat:origin.lat+offset,lng:((origin.lng+offset+540)%360)-180,alt:origin.alt-31};
    const xy=geodeticToEnu({...point,alt:0},{...origin,alt:0});
    const restored=localToGeographic({x:xy.east,y:xy.north,z:point.alt-origin.alt},origin);
    close(restored.lat,point.lat,1e-9,'export/import latitude');
    close(restored.lng,point.lng,1e-9,'export/import longitude');
    close(restored.alt,point.alt,1e-9,'export/import altitude');
  }
}
assert.throws(()=>localToGeographic({x:1e8,y:0,z:0},{lat:0,lng:0,alt:0}),/outside/);
console.log('PASS horizontal inverse and separate altitude: 12 round trips');
