/**
 * OIDC Provider Configurations
 * Pre-configured settings for popular identity providers
 */

const OIDCProviders = {
  /**
   * Azure Active Directory / Microsoft Entra ID
   */
  azure_ad: {
    name: 'Azure AD',
    displayName: 'Microsoft Azure AD',
    getIssuer: (tenantId) => `https://login.microsoftonline.com/${tenantId}/v2.0`,
    discoveryUrl: (tenantId) => `https://login.microsoftonline.com/${tenantId}/v2.0/.well-known/openid-configuration`,
    defaultScopes: 'openid profile email User.Read',
    tokenEndpointAuthMethod: 'client_secret_post',
    supportsCodeChallenge: true,
    supportsPKCE: true,
    supportsRefreshToken: true,
    supportsLogout: true,
    additionalParams: {
      response_mode: 'query'
    },
    userAttributeMapping: {
      sub: 'oid',
      email: 'email',
      name: 'name',
      given_name: 'given_name',
      family_name: 'family_name',
      preferred_username: 'preferred_username',
      groups: 'groups'
    },
    notes: 'Requires Azure AD app registration. Use tenant ID (GUID) or "common" for multi-tenant.'
  },

  /**
   * Google Workspace / Google Identity
   */
  google: {
    name: 'Google',
    displayName: 'Google Workspace',
    issuer: 'https://accounts.google.com',
    discoveryUrl: 'https://accounts.google.com/.well-known/openid-configuration',
    defaultScopes: 'openid profile email',
    tokenEndpointAuthMethod: 'client_secret_post',
    supportsCodeChallenge: true,
    supportsPKCE: true,
    supportsRefreshToken: true,
    supportsLogout: false, // Google doesn't support RP-initiated logout
    additionalParams: {
      access_type: 'offline', // For refresh tokens
      prompt: 'consent' // Force consent to get refresh token
    },
    userAttributeMapping: {
      sub: 'sub',
      email: 'email',
      name: 'name',
      given_name: 'given_name',
      family_name: 'family_name',
      picture: 'picture',
      locale: 'locale',
      hd: 'hd' // Hosted domain for Google Workspace
    },
    notes: 'Create credentials in Google Cloud Console. Enable Google Workspace API for organization access.'
  },

  /**
   * Okta
   */
  okta: {
    name: 'Okta',
    displayName: 'Okta',
    getIssuer: (domain) => `https://${domain}.okta.com`,
    getDiscoveryUrl: (domain) => `https://${domain}.okta.com/.well-known/openid-configuration`,
    defaultScopes: 'openid profile email groups',
    tokenEndpointAuthMethod: 'client_secret_basic',
    supportsCodeChallenge: true,
    supportsPKCE: true,
    supportsRefreshToken: true,
    supportsLogout: true,
    additionalParams: {},
    userAttributeMapping: {
      sub: 'sub',
      email: 'email',
      name: 'name',
      given_name: 'given_name',
      family_name: 'family_name',
      preferred_username: 'preferred_username',
      groups: 'groups',
      zoneinfo: 'zoneinfo',
      locale: 'locale'
    },
    notes: 'Use your Okta domain (e.g., "dev-123456" from dev-123456.okta.com). Add "groups" scope for group claims.'
  },

  /**
   * Auth0
   */
  auth0: {
    name: 'Auth0',
    displayName: 'Auth0',
    getIssuer: (domain) => `https://${domain}.auth0.com/`,
    getDiscoveryUrl: (domain) => `https://${domain}.auth0.com/.well-known/openid-configuration`,
    defaultScopes: 'openid profile email',
    tokenEndpointAuthMethod: 'client_secret_post',
    supportsCodeChallenge: true,
    supportsPKCE: true,
    supportsRefreshToken: true,
    supportsLogout: true,
    additionalParams: {
      audience: '' // Set to your API identifier for API access
    },
    userAttributeMapping: {
      sub: 'sub',
      email: 'email',
      name: 'name',
      given_name: 'given_name',
      family_name: 'family_name',
      picture: 'picture',
      nickname: 'nickname',
      email_verified: 'email_verified'
    },
    notes: 'Use your Auth0 domain (e.g., "your-tenant" from your-tenant.auth0.com). Configure API audience for access tokens.'
  },

  /**
   * OneLogin
   */
  onelogin: {
    name: 'OneLogin',
    displayName: 'OneLogin',
    getIssuer: (subdomain) => `https://${subdomain}.onelogin.com/oidc/2`,
    getDiscoveryUrl: (subdomain) => `https://${subdomain}.onelogin.com/oidc/2/.well-known/openid-configuration`,
    defaultScopes: 'openid profile email groups',
    tokenEndpointAuthMethod: 'client_secret_basic',
    supportsCodeChallenge: true,
    supportsPKCE: true,
    supportsRefreshToken: true,
    supportsLogout: true,
    additionalParams: {},
    userAttributeMapping: {
      sub: 'sub',
      email: 'email',
      name: 'name',
      given_name: 'given_name',
      family_name: 'family_name',
      preferred_username: 'preferred_username',
      groups: 'groups'
    },
    notes: 'Use your OneLogin subdomain. Enable OIDC app in OneLogin admin.'
  },

  /**
   * Keycloak
   */
  keycloak: {
    name: 'Keycloak',
    displayName: 'Keycloak',
    getIssuer: (baseUrl, realm) => `${baseUrl}/realms/${realm}`,
    getDiscoveryUrl: (baseUrl, realm) => `${baseUrl}/realms/${realm}/.well-known/openid-configuration`,
    defaultScopes: 'openid profile email',
    tokenEndpointAuthMethod: 'client_secret_basic',
    supportsCodeChallenge: true,
    supportsPKCE: true,
    supportsRefreshToken: true,
    supportsLogout: true,
    additionalParams: {},
    userAttributeMapping: {
      sub: 'sub',
      email: 'email',
      name: 'name',
      given_name: 'given_name',
      family_name: 'family_name',
      preferred_username: 'preferred_username',
      realm_access: 'realm_access',
      resource_access: 'resource_access'
    },
    notes: 'Self-hosted identity server. Provide base URL (e.g., https://keycloak.example.com) and realm name.'
  },

  /**
   * Generic OIDC Provider
   */
  oidc: {
    name: 'OIDC',
    displayName: 'Generic OIDC',
    issuer: null, // Must be configured manually
    discoveryUrl: null, // Must be configured manually
    defaultScopes: 'openid profile email',
    tokenEndpointAuthMethod: 'client_secret_basic',
    supportsCodeChallenge: true,
    supportsPKCE: true,
    supportsRefreshToken: true,
    supportsLogout: true,
    additionalParams: {},
    userAttributeMapping: {
      sub: 'sub',
      email: 'email',
      name: 'name',
      given_name: 'given_name',
      family_name: 'family_name'
    },
    notes: 'Configure manually with discovery URL or individual endpoints.'
  },

  /**
   * SAML (handled separately)
   */
  saml: {
    name: 'SAML',
    displayName: 'SAML 2.0',
    isOIDC: false,
    notes: 'SAML authentication is handled by SAMLService.'
  }
};

/**
 * Get provider configuration by type
 * @param {string} providerType - Provider type identifier
 * @returns {Object|null} Provider configuration
 */
function getProviderConfig(providerType) {
  return OIDCProviders[providerType] || null;
}

/**
 * Get issuer URL for provider
 * @param {string} providerType - Provider type
 * @param {Object} params - Provider-specific parameters
 * @returns {string|null} Issuer URL
 */
function getIssuerUrl(providerType, params = {}) {
  const provider = OIDCProviders[providerType];
  if (!provider) return null;

  if (provider.issuer) {
    return provider.issuer;
  }

  if (provider.getIssuer) {
    switch (providerType) {
      case 'azure_ad':
        return provider.getIssuer(params.tenantId || 'common');
      case 'okta':
      case 'auth0':
      case 'onelogin':
        return provider.getIssuer(params.domain);
      case 'keycloak':
        return provider.getIssuer(params.baseUrl, params.realm);
      default:
        return null;
    }
  }

  return null;
}

/**
 * Get discovery URL for provider
 * @param {string} providerType - Provider type
 * @param {Object} params - Provider-specific parameters
 * @returns {string|null} Discovery URL
 */
function getDiscoveryUrl(providerType, params = {}) {
  const provider = OIDCProviders[providerType];
  if (!provider) return null;

  if (provider.discoveryUrl && typeof provider.discoveryUrl === 'string') {
    return provider.discoveryUrl;
  }

  if (provider.discoveryUrl && typeof provider.discoveryUrl === 'function') {
    return provider.discoveryUrl(params.tenantId);
  }

  if (provider.getDiscoveryUrl) {
    switch (providerType) {
      case 'okta':
      case 'auth0':
      case 'onelogin':
        return provider.getDiscoveryUrl(params.domain);
      case 'keycloak':
        return provider.getDiscoveryUrl(params.baseUrl, params.realm);
      default:
        return null;
    }
  }

  return null;
}

/**
 * Get all supported providers
 * @param {boolean} includeNonOIDC - Include non-OIDC providers like SAML
 * @returns {Array} List of providers
 */
function getAllProviders(includeNonOIDC = false) {
  return Object.entries(OIDCProviders)
    .filter(([_, config]) => includeNonOIDC || config.isOIDC !== false)
    .map(([type, config]) => ({
      type,
      name: config.name,
      displayName: config.displayName,
      notes: config.notes
    }));
}

/**
 * Validate provider type
 * @param {string} providerType - Provider type to validate
 * @returns {boolean} Is valid
 */
function isValidProvider(providerType) {
  return providerType in OIDCProviders;
}

/**
 * Get default scopes for provider
 * @param {string} providerType - Provider type
 * @returns {string} Default scopes
 */
function getDefaultScopes(providerType) {
  const provider = OIDCProviders[providerType];
  return provider?.defaultScopes || 'openid profile email';
}

/**
 * Get token endpoint auth method for provider
 * @param {string} providerType - Provider type
 * @returns {string} Auth method
 */
function getTokenEndpointAuthMethod(providerType) {
  const provider = OIDCProviders[providerType];
  return provider?.tokenEndpointAuthMethod || 'client_secret_basic';
}

/**
 * Map user attributes from provider claims
 * @param {string} providerType - Provider type
 * @param {Object} claims - Claims from ID token or userinfo
 * @returns {Object} Mapped user attributes
 */
function mapUserAttributes(providerType, claims) {
  const provider = OIDCProviders[providerType];
  const mapping = provider?.userAttributeMapping || {};

  const mapped = {};
  for (const [standardClaim, providerClaim] of Object.entries(mapping)) {
    if (claims[providerClaim] !== undefined) {
      mapped[standardClaim] = claims[providerClaim];
    } else if (claims[standardClaim] !== undefined) {
      mapped[standardClaim] = claims[standardClaim];
    }
  }

  return mapped;
}

module.exports = {
  OIDCProviders,
  getProviderConfig,
  getIssuerUrl,
  getDiscoveryUrl,
  getAllProviders,
  isValidProvider,
  getDefaultScopes,
  getTokenEndpointAuthMethod,
  mapUserAttributes
};
