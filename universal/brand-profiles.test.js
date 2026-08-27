'use strict';

const assert = require('node:assert/strict');
const brandApi = require('./brand-profile.js');
const profiles =
  require('./brand-profiles.js');

const hondaProfile =
  brandApi.getBrandProfile('HONDA');

assert.ok(hondaProfile);
assert.deepEqual(
  profiles.HONDA,
  hondaProfile
);
assert.notEqual(
  profiles.HONDA,
  hondaProfile
);
assert.equal(hondaProfile.id, 'HONDA');
assert.equal(hondaProfile.name, 'HONDA');
assert.equal(
  hondaProfile.appearance.colors.accent,
  '#cc0000'
);
assert.equal(
  hondaProfile.data.files.products,
  'data/products.csv'
);
assert.deepEqual(
  hondaProfile.freight.ruleIdPrefixes,
  ['FRT-HONDA']
);
assert.equal(
  hondaProfile.capabilities.dealerMode,
  true
);
assert.equal(
  hondaProfile.capabilities.financing,
  true
);
assert.equal(
  hondaProfile.capabilities.onlineOrders,
  false
);

assert.deepEqual(
  hondaProfile.freight.packageComponentGroups,
  [
    'HONDA-PACKAGE-ATTACHMENT',
    'HONDA-PACKAGE-ACCESSORY'
  ]
);

assert.equal(
  brandApi.validateRegisteredProfiles().valid,
  true
);

const hondaDocument = {
  documentElement: {
    dataset: {
      configuratorBrand: 'HONDA'
    }
  }
};

assert.equal(
  brandApi.getActiveBrandId(hondaDocument),
  'HONDA'
);
assert.equal(
  brandApi.getActiveBrandProfile(
    hondaDocument
  ),
  hondaProfile
);

console.log(
  'HONDA brand-profile tests passed.'
);