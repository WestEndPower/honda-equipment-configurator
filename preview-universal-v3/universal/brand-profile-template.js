(function attachBrandProfileTemplate(
  root,
  factory
) {
  const brandApi =
    root?.WestEndConfiguratorBrand ||
    (
      typeof module === 'object' &&
      module.exports
        ? require('./brand-profile.js')
        : null
    );

  const api = factory(brandApi);

  if(
    typeof module === 'object' &&
    module.exports
  ){
    module.exports = api;
  }

  if(root){
    root.WestEndConfiguratorBrandTemplate =
      api;
  }
})(
  typeof globalThis !== 'undefined'
    ? globalThis
    : this,
  function createBrandProfileTemplateApi(
    brandApi
  ) {
    'use strict';

    if(
      !brandApi ||
      typeof brandApi.validateBrandProfile !==
        'function'
    ){
      throw new Error(
        'Brand-profile API is required.'
      );
    }

const STANDARD_DATA_FILES = Object.freeze({
  products: 'products.csv',
  packages: 'packages.csv',
  compatibility: 'compatibility-runtime.csv',
  batteries: 'batteries.csv',
  chargers: 'chargers.csv',
  attachments: 'attachments.csv',
  accessories: 'accessories.csv',
  parts: 'parts.csv',
  promotions: 'promotions.csv',
  delivery: 'delivery-zones.csv',
  financePrograms: 'finance-programs.csv',
  bidFleet: 'bid-fleet-programs.csv',
  freightRules: 'freight-rules.csv'
});

const DEFAULT_COLORS = Object.freeze({
  accent: '#333333',
  dark: '#111111',
  surface: '#f5f5f5',
  border: '#dddddd',
  success: '#1f7a3a',
  danger: '#b00020'
});

const DEFAULT_CAPABILITIES = Object.freeze({
  publicConfigurator: true,
  dealerMode: true,
  quotes: true,
  salesOrders: true,
  onlineOrders: false,
  financing: false,
  freightRules: true,
  promotions: true,
  inventory: true
});

function normalizeBrandId(value) {
  return String(value || '')
    .trim()
    .toUpperCase();
}

function normalizeDataRoot(value) {
  return String(value || 'data')
    .trim()
    .replace(/[\\/]+$/, '');
}

function createDataFiles(dataRoot) {
  const root = normalizeDataRoot(dataRoot);

  return Object.freeze(
    Object.fromEntries(
      Object.entries(STANDARD_DATA_FILES)
        .map(([key, filename]) => [
          key,
          root + '/' + filename
        ])
    )
  );
}

function deepFreeze(value) {
  if(
    !value ||
    typeof value !== 'object' ||
    Object.isFrozen(value)
  ){
    return value;
  }

  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function createBrandProfileTemplate(options) {
  const settings =
    options && typeof options === 'object'
      ? options
      : {};

  const id = normalizeBrandId(settings.id);

  if(!id){
    throw new Error(
      'Brand profile template requires an id.'
    );
  }

  const name =
    String(settings.name || id).trim();

  const colors = {
    ...DEFAULT_COLORS,
    ...(settings.colors || {})
  };

  const capabilities = {
    ...DEFAULT_CAPABILITIES,
    ...(settings.capabilities || {})
  };

  const profile = {
    schemaVersion: brandApi.SCHEMA_VERSION,
    id,
    name,
    role: String(settings.role || 'brand').trim(),
    appearance: {
      baseline: String(
        settings.baseline || 'yanmar'
      ).trim(),
      colors,
      layout: {
        maxWidth: String(
          settings.maxWidth || '1180px'
        ).trim()
      },
      preserveCurrentLayout: true,
      preserveCurrentQuoteLayout: true,
      preserveCurrentDealerControls: true
    },
    data: {
      files: createDataFiles(settings.dataRoot)
    },
    freight: {
      packageComponentGroups:
        settings.packageComponentGroups || [
          id + 'ATTACHMENT',
          id + 'ACCESSORY'
        ],
      ruleIdPrefixes:
        settings.ruleIdPrefixes || [id]
    },
    capabilities
  };

  const validation =
    brandApi.validateBrandProfile(profile);

  if(!validation.valid){
    throw new Error(
      'Generated profile is invalid: ' +
      validation.errors.join(' ')
    );
  }

  return deepFreeze(profile);
}

return Object.freeze({
      STANDARD_DATA_FILES,
      DEFAULT_COLORS,
      DEFAULT_CAPABILITIES,
      createBrandProfileTemplate
    });
  }
);