/*
 * West End Power universal configurator brand profile.
 *
 * The current Yanmar configurator is the visual and functional baseline.
 * Brand profiles extend that baseline without changing its default behavior.
 */
(function attachBrandProfile(root, factory) {
  const api = factory();

  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.WestEndConfiguratorBrand = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function createBrandProfileApi() {
  'use strict';

  const SCHEMA_VERSION = 1;
  const DEFAULT_BRAND_ID = 'YANMAR';

  const YANMAR_BASELINE = Object.freeze({
    schemaVersion: SCHEMA_VERSION,
    id: 'YANMAR',
    name: 'Yanmar',
    role: 'baseline',
    appearance: Object.freeze({
      baseline: 'yanmar',
      colors: Object.freeze({
        accent: '#cc0000',
        dark: '#111111',
        surface: '#f5f5f5',
        border: '#dddddd',
        success: '#1f7a3a',
        danger: '#b00020'
      }),
      layout: Object.freeze({
        maxWidth: '1180px'
      }),
      preserveCurrentLayout: true,
      preserveCurrentQuoteLayout: true,
      preserveCurrentDealerControls: true
    }),
    data: Object.freeze({
      files: Object.freeze({
        products: 'data/products.csv',
        packages: 'data/packages.csv',
        compatibility: 'data/compatibility-runtime.csv',
        batteries: 'data/batteries.csv',
        chargers: 'data/chargers.csv',
        attachments: 'data/attachments.csv',
        accessories: 'data/accessories.csv',
        parts: 'data/parts.csv',
        promotions: 'data/promotions.csv',
        delivery: 'data/delivery-zones.csv',
        financePrograms: 'data/finance-programs.csv',
        bidFleet: 'data/bid-fleet-programs.csv',
        freightRules: 'data/freight-rules.csv'
      })
    }),
    freight: Object.freeze({
      packageComponentGroups: Object.freeze([
        'YANMARATTACHMENT',
        'YANMARACCESSORY'
      ]),
      ruleIdPrefixes: Object.freeze([
        'YANMAR'
      ])
    }),
    capabilities: Object.freeze({
      publicConfigurator: true,
      dealerMode: true,
      quotes: true,
      salesOrders: true,
      onlineOrders: true,
      financing: true,
      freightRules: true,
      promotions: true,
      inventory: true
    })
  });

  const profileRegistry = {
    YANMAR: YANMAR_BASELINE
  };

  function normalizeBrandId(value) {
    return String(value || '').trim().toUpperCase();
  }

    function getActiveBrandId(targetDocument) {
    const documentRef =
      targetDocument ||
      (
        typeof document === 'object'
          ? document
          : null
      );

    const configuredBrandId =
      normalizeBrandId(
        documentRef
          ?.documentElement
          ?.dataset
          ?.configuratorBrand
      );

    return configuredBrandId ||
      DEFAULT_BRAND_ID;
  }

  function getActiveBrandProfile(targetDocument) {
    return getBrandProfile(
      getActiveBrandId(targetDocument)
    );
  }
    const REQUIRED_DATA_FILES = Object.freeze([
    'products',
    'packages',
    'compatibility'
  ]);

  const REQUIRED_CAPABILITIES = Object.freeze([
    'publicConfigurator',
    'dealerMode',
    'quotes',
    'salesOrders',
    'onlineOrders',
    'financing',
    'freightRules',
    'promotions',
    'inventory'
  ]);

    function cloneAndFreeze(value) {
    if(Array.isArray(value)){
      return Object.freeze(
        value.map(cloneAndFreeze)
      );
    }

    if(value && typeof value === 'object'){
      const clone = {};

      Object.entries(value).forEach(
        ([key, item]) => {
          clone[key] = cloneAndFreeze(item);
        }
      );

      return Object.freeze(clone);
    }

    return value;
  }

  function getRegisteredProfiles() {
    return Object.freeze({
      ...profileRegistry
    });
  }

  function registerBrandProfile(
    profile,
    options
  ) {
    const validation =
      validateBrandProfile(profile);

    if(!validation.valid){
      throw new Error(
        'Cannot register invalid brand profile: ' +
        validation.errors.join(' ')
      );
    }

    const id = normalizeBrandId(profile.id);
    const replaceExisting =
      options?.replace === true;

    if(
      profileRegistry[id] &&
      !replaceExisting
    ){
      throw new Error(
        'Configurator brand is already registered: ' +
        id
      );
    }

    if(
      id === DEFAULT_BRAND_ID &&
      replaceExisting
    ){
      throw new Error(
        'The baseline brand profile cannot be replaced.'
      );
    }

    const storedProfile =
      cloneAndFreeze(profile);

    profileRegistry[id] = storedProfile;

    return storedProfile;
  }

  function unregisterBrandProfile(brandId) {
    const id = normalizeBrandId(brandId);

    if(id === DEFAULT_BRAND_ID){
      throw new Error(
        'The baseline brand profile cannot be removed.'
      );
    }

    if(!profileRegistry[id]){
      return false;
    }

    delete profileRegistry[id];
    return true;
  }

  function validateBrandProfile(profile) {
    const errors = [];

    function requireObject(value, path) {
      if(!value || typeof value !== 'object' || Array.isArray(value)){
        errors.push(path + ' must be an object.');
        return false;
      }

      return true;
    }

    function requireString(value, path) {
      if(typeof value !== 'string' || !value.trim()){
        errors.push(path + ' must be a non-empty string.');
        return false;
      }

      return true;
    }

    function requireStringArray(value, path) {
      if(!Array.isArray(value)){
        errors.push(path + ' must be an array.');
        return;
      }

      if(!value.length){
        errors.push(path + ' must contain at least one value.');
      }

      value.forEach((item, index) => {
        requireString(item, path + '[' + index + ']');
      });
    }

    if(!requireObject(profile, 'profile')){
      return Object.freeze({
        valid: false,
        errors: Object.freeze(errors)
      });
    }

    if(profile.schemaVersion !== SCHEMA_VERSION){
      errors.push(
        'profile.schemaVersion must equal ' + SCHEMA_VERSION + '.'
      );
    }

    if(requireString(profile.id, 'profile.id')){
      const normalizedId = normalizeBrandId(profile.id);

      if(profile.id !== normalizedId){
        errors.push('profile.id must be uppercase and trimmed.');
      }
    }

    requireString(profile.name, 'profile.name');
    requireString(profile.role, 'profile.role');

    if(requireObject(profile.appearance, 'profile.appearance')){
      requireString(
        profile.appearance.baseline,
        'profile.appearance.baseline'
      );

      if(requireObject(
        profile.appearance.colors,
        'profile.appearance.colors'
      )){
        [
          'accent',
          'dark',
          'surface',
          'border',
          'success',
          'danger'
        ].forEach((key) => {
          requireString(
            profile.appearance.colors[key],
            'profile.appearance.colors.' + key
          );
        });
      }

      if(requireObject(
        profile.appearance.layout,
        'profile.appearance.layout'
      )){
        requireString(
          profile.appearance.layout.maxWidth,
          'profile.appearance.layout.maxWidth'
        );
      }
    }

    if(requireObject(profile.data, 'profile.data') &&
      requireObject(profile.data.files, 'profile.data.files')){
      REQUIRED_DATA_FILES.forEach((key) => {
        requireString(
          profile.data.files[key],
          'profile.data.files.' + key
        );
      });

      if(profile.capabilities?.financing === true){
        requireString(
          profile.data.files.financePrograms,
          'profile.data.files.financePrograms'
        );
      }

      if(profile.capabilities?.freightRules === true){
        requireString(
          profile.data.files.freightRules,
          'profile.data.files.freightRules'
        );
      }

      if(profile.capabilities?.promotions === true){
        requireString(
          profile.data.files.promotions,
          'profile.data.files.promotions'
        );
      }
    }

    if(requireObject(profile.freight, 'profile.freight')){
      requireStringArray(
        profile.freight.packageComponentGroups,
        'profile.freight.packageComponentGroups'
      );
      requireStringArray(
        profile.freight.ruleIdPrefixes,
        'profile.freight.ruleIdPrefixes'
      );
    }

    if(requireObject(profile.capabilities, 'profile.capabilities')){
      REQUIRED_CAPABILITIES.forEach((key) => {
        if(typeof profile.capabilities[key] !== 'boolean'){
          errors.push(
            'profile.capabilities.' + key + ' must be boolean.'
          );
        }
      });
    }

    return Object.freeze({
      valid: errors.length === 0,
      errors: Object.freeze(errors)
    });
  }

  function validateRegisteredProfiles() {
    const results = {};
    const errors = [];

    Object.entries(profileRegistry).forEach(([key, profile]) => {
      const result = validateBrandProfile(profile);
      results[key] = result;

      if(profile?.id !== key){
        errors.push(
          key + ': profile.id must match its registry key.'
        );
      }

      result.errors.forEach((message) => {
        errors.push(key + ': ' + message);
      });
    });

    return Object.freeze({
      valid: errors.length === 0,
      errors: Object.freeze(errors),
      profiles: Object.freeze(results)
    });
  }

  function getBrandProfile(brandId) {
    const key = normalizeBrandId(brandId);
    return profileRegistry[key] || null;
  }

  function requireBrandProfile(brandId) {
    const profile = getBrandProfile(brandId);

    if (!profile) {
      throw new Error('Unknown configurator brand: ' + normalizeBrandId(brandId));
    }

    return profile;
  }

  function hasCapability(brandId, capability, fallbackValue) {
    const profile = getBrandProfile(brandId);
    const key = String(capability || '').trim();

    if(
      !profile ||
      !key ||
      !Object.prototype.hasOwnProperty.call(profile.capabilities, key)
    ){
      return fallbackValue !== false;
    }

    return profile.capabilities[key] === true;
  }

  function applyAppearance(brandId, targetDocument) {
    const profile = getBrandProfile(brandId);
    const documentRef = targetDocument ||
      (typeof document === 'object' ? document : null);
    const rootElement = documentRef?.documentElement;

    if(!profile || !rootElement){
      return null;
    }

    const colors = profile.appearance?.colors || {};
    const layout = profile.appearance?.layout || {};
    const variables = {
      '--config-accent': colors.accent,
      '--config-dark': colors.dark,
      '--config-surface': colors.surface,
      '--config-border': colors.border,
      '--config-success': colors.success,
      '--config-danger': colors.danger,
      '--config-max-width': layout.maxWidth,
      '--stihl-orange': colors.accent,
      '--stihl-dark': colors.dark,
      '--stihl-gray': colors.surface,
      '--stihl-border': colors.border,
      '--stihl-green': colors.success,
      '--stihl-red': colors.danger,
      '--max-width': layout.maxWidth
    };

    Object.entries(variables).forEach(([name, value]) => {
      const normalizedValue = String(value || '').trim();

      if(normalizedValue){
        rootElement.style.setProperty(name, normalizedValue);
      }
    });

    rootElement.dataset.configuratorBrand = profile.id.toLowerCase();
    return profile.appearance;
  }

  function getDataFiles(brandId, fallbackFiles) {
    const profile = getBrandProfile(brandId || DEFAULT_BRAND_ID);
    const fallback = fallbackFiles && typeof fallbackFiles === 'object'
      ? fallbackFiles
      : {};
    const configuredFiles = profile?.data?.files || {};

    return Object.freeze({
      ...fallback,
      ...configuredFiles
    });
  }

  function getFreightPolicy(brandId, fallbackPolicy) {
    const profile = getBrandProfile(brandId || DEFAULT_BRAND_ID);
    const fallback = fallbackPolicy && typeof fallbackPolicy === 'object'
      ? fallbackPolicy
      : {};
    const configured = profile?.freight || {};

    const packageComponentGroups =
      configured.packageComponentGroups ||
      fallback.packageComponentGroups ||
      [];

    const ruleIdPrefixes =
      configured.ruleIdPrefixes ||
      fallback.ruleIdPrefixes ||
      [];

    return Object.freeze({
      packageComponentGroups: Object.freeze([
        ...packageComponentGroups
      ]),
      ruleIdPrefixes: Object.freeze([
        ...ruleIdPrefixes
      ])
    });
  }

  return Object.freeze({
    SCHEMA_VERSION,
    DEFAULT_BRAND_ID,
    profiles: getRegisteredProfiles(),
    getRegisteredProfiles,
    registerBrandProfile,
    unregisterBrandProfile,
    getActiveBrandId,
    getActiveBrandProfile,
    validateBrandProfile,
    validateRegisteredProfiles,
    getBrandProfile,
    requireBrandProfile,
    hasCapability,
    applyAppearance,
    getDataFiles,
    getFreightPolicy
  });
});
