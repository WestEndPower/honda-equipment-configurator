(function attachConfiguratorProfiles(
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

  const templateApi =
    root?.WestEndConfiguratorBrandTemplate ||
    (
      typeof module === 'object' &&
      module.exports
        ? require('./brand-profile-template.js')
        : null
    );

  const api = factory(
    brandApi,
    templateApi
  );

  if(
    typeof module === 'object' &&
    module.exports
  ){
    module.exports = api;
  }

  if(root){
    root.WestEndConfiguratorProfiles = api;
  }
})(
  typeof globalThis !== 'undefined'
    ? globalThis
    : this,
  function createConfiguratorProfiles(
    brandApi,
    templateApi
  ) {
    'use strict';

    if(
      !brandApi ||
      !templateApi
    ){
      throw new Error(
        'Universal brand APIs are required.'
      );
    }

    const HONDA_PROFILE =
      templateApi.createBrandProfileTemplate({
        id: 'HONDA',
        name: 'HONDA',
        baseline: 'yanmar',
        colors: {
          accent: '#cc0000',
          dark: '#111111',
          surface: '#f5f5f5',
          border: '#dddddd',
          success: '#1f7a3a',
          danger: '#b00020'
        },
        packageComponentGroups: [
          'HONDA-PACKAGE-ATTACHMENT',
          'HONDA-PACKAGE-ACCESSORY'
        ],
        ruleIdPrefixes: [
          'FRT-HONDA'
        ],
        capabilities: {
          publicConfigurator: true,
          dealerMode: true,
          quotes: true,
          salesOrders: true,
          onlineOrders: false,
          financing: true,
          freightRules: true,
          promotions: true,
          inventory: true
        }
      });

    if(!brandApi.getBrandProfile('HONDA')){
      brandApi.registerBrandProfile(
        HONDA_PROFILE
      );
    }

    return Object.freeze({
      HONDA: HONDA_PROFILE
    });
  }
);