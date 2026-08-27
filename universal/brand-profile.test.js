'use strict';

const assert = require('node:assert/strict');
const api = require('./brand-profile.js');

const registeredResult = api.validateRegisteredProfiles();
const yanmarDocument = {
  documentElement: {
    dataset: {
      configuratorBrand: ' yanmar '
    }
  }
};

const unknownBrandDocument = {
  documentElement: {
    dataset: {
      configuratorBrand: 'future-brand'
    }
  }
};

assert.equal(api.getActiveBrandId(), 'YANMAR');
assert.equal(
  api.getActiveBrandId(yanmarDocument),
  'YANMAR'
);
assert.equal(
  api.getActiveBrandProfile(yanmarDocument)?.id,
  'YANMAR'
);
assert.equal(
  api.getActiveBrandId(unknownBrandDocument),
  'FUTURE-BRAND'
);
assert.equal(
  api.getActiveBrandProfile(unknownBrandDocument),
  null
);

assert.equal(
  registeredResult.valid,
  true,
  registeredResult.errors.join('\n')
);

assert.equal(api.getBrandProfile('yanmar')?.id, 'YANMAR');
assert.equal(api.getBrandProfile(' YANMAR ')?.id, 'YANMAR');
assert.equal(api.getBrandProfile('unknown'), null);

assert.throws(
  () => api.requireBrandProfile('unknown'),
  /Unknown configurator brand: UNKNOWN/
);

const invalidProfile = {
  schemaVersion: api.SCHEMA_VERSION,
  id: 'test',
  name: '',
  role: 'brand',
  appearance: {
    baseline: 'yanmar',
    colors: {},
    layout: {}
  },
  data: {
    files: {}
  },
  freight: {
    packageComponentGroups: [],
    ruleIdPrefixes: []
  },
  capabilities: {}
};

const invalidResult = api.validateBrandProfile(invalidProfile);

assert.equal(invalidResult.valid, false);
assert.ok(invalidResult.errors.length > 0);
assert.ok(
  invalidResult.errors.includes(
    'profile.id must be uppercase and trimmed.'
  )
);
assert.ok(
  invalidResult.errors.includes(
    'profile.data.files.products must be a non-empty string.'
  )
);
assert.ok(
  invalidResult.errors.includes(
    'profile.capabilities.financing must be boolean.'
  )
);

const templateApi =
  require('./brand-profile-template.js');

const temporaryProfile =
  templateApi.createBrandProfileTemplate({
    id: 'testbrand',
    name: 'Test Brand',
    dataRoot: 'brands/testbrand/data'
  });

const registeredTemporaryProfile =
  api.registerBrandProfile(
    temporaryProfile
  );

assert.equal(
  registeredTemporaryProfile.id,
  'TESTBRAND'
);
assert.equal(
  api.getBrandProfile('testbrand')?.name,
  'Test Brand'
);
assert.equal(
  api.getActiveBrandProfile({
    documentElement: {
      dataset: {
        configuratorBrand: 'testbrand'
      }
    }
  })?.id,
  'TESTBRAND'
);
assert.equal(
  api.getRegisteredProfiles()
    .TESTBRAND
    ?.data
    ?.files
    ?.products,
  'brands/testbrand/data/products.csv'
);
assert.equal(
  api.validateRegisteredProfiles().valid,
  true
);

assert.throws(
  () => api.registerBrandProfile(
    temporaryProfile
  ),
  /already registered/
);

assert.throws(
  () => api.registerBrandProfile(
    api.getBrandProfile('YANMAR'),
    { replace: true }
  ),
  /baseline brand profile cannot be replaced/
);

assert.equal(
  api.unregisterBrandProfile('testbrand'),
  true
);
assert.equal(
  api.getBrandProfile('testbrand'),
  null
);
assert.equal(
  api.unregisterBrandProfile('testbrand'),
  false
);

assert.throws(
  () => api.unregisterBrandProfile('YANMAR'),
  /baseline brand profile cannot be removed/
);

console.log('Brand-profile validator tests passed.');