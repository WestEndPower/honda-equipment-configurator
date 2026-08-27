'use strict';

const assert = require('node:assert/strict');
const brandApi = require('./brand-profile.js');
const templateApi =
  require('./brand-profile-template.js');

const stihlProfile =
  templateApi.createBrandProfileTemplate({
    id: 'stihl',
    name: 'STIHL',
    colors: {
      accent: '#f37a1f',
      dark: '#000000'
    },
    capabilities: {
      onlineOrders: true,
      financing: false
    }
  });

const validation =
  brandApi.validateBrandProfile(stihlProfile);

assert.equal(
  validation.valid,
  true,
  validation.errors.join('\n')
);

assert.equal(stihlProfile.id, 'STIHL');
assert.equal(stihlProfile.name, 'STIHL');
assert.equal(
  stihlProfile.appearance.colors.accent,
  '#f37a1f'
);
assert.equal(
  stihlProfile.data.files.products,
  'data/products.csv'
);
assert.equal(
  stihlProfile.data.files.compatibility,
  'data/compatibility-runtime.csv'
);
assert.deepEqual(
  stihlProfile.freight.packageComponentGroups,
  [
    'STIHLATTACHMENT',
    'STIHLACCESSORY'
  ]
);
assert.deepEqual(
  stihlProfile.freight.ruleIdPrefixes,
  ['STIHL']
);
assert.equal(
  stihlProfile.capabilities.onlineOrders,
  true
);
assert.equal(
  stihlProfile.capabilities.financing,
  false
);
assert.equal(Object.isFrozen(stihlProfile), true);
assert.equal(
  Object.isFrozen(stihlProfile.appearance.colors),
  true
);

const customDataProfile =
  templateApi.createBrandProfileTemplate({
    id: 'honda',
    name: 'Honda',
    dataRoot: 'brands/honda/data'
  });

assert.equal(
  customDataProfile.data.files.products,
  'brands/honda/data/products.csv'
);

assert.throws(
  () => templateApi.createBrandProfileTemplate({}),
  /requires an id/
);

assert.throws(
  () => templateApi.createBrandProfileTemplate({
    id: 'broken',
    colors: {
      accent: ''
    }
  }),
  /Generated profile is invalid/
);

console.log(
  'Brand-profile template tests passed.'
);