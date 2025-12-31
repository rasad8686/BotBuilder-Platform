/**
 * OIDC Providers Tests
 * Tests for server/services/oidcProviders.js
 */

const {
  OIDCProviders,
  getProviderConfig,
  getIssuerUrl,
  getDiscoveryUrl,
  getAllProviders,
  isValidProvider,
  getDefaultScopes,
  getTokenEndpointAuthMethod,
  mapUserAttributes
} = require('../../services/oidcProviders');

describe('OIDC Providers', () => {
  describe('OIDCProviders', () => {
    it('should have Azure AD configuration', () => {
      expect(OIDCProviders.azure_ad).toBeDefined();
      expect(OIDCProviders.azure_ad.name).toBe('Azure AD');
      expect(OIDCProviders.azure_ad.supportsPKCE).toBe(true);
    });

    it('should have Google configuration', () => {
      expect(OIDCProviders.google).toBeDefined();
      expect(OIDCProviders.google.issuer).toBe('https://accounts.google.com');
      expect(OIDCProviders.google.supportsRefreshToken).toBe(true);
    });

    it('should have Okta configuration', () => {
      expect(OIDCProviders.okta).toBeDefined();
      expect(OIDCProviders.okta.defaultScopes).toContain('groups');
    });

    it('should have Auth0 configuration', () => {
      expect(OIDCProviders.auth0).toBeDefined();
      expect(OIDCProviders.auth0.supportsLogout).toBe(true);
    });

    it('should have OneLogin configuration', () => {
      expect(OIDCProviders.onelogin).toBeDefined();
    });

    it('should have Keycloak configuration', () => {
      expect(OIDCProviders.keycloak).toBeDefined();
    });

    it('should have generic OIDC configuration', () => {
      expect(OIDCProviders.oidc).toBeDefined();
      expect(OIDCProviders.oidc.issuer).toBeNull();
    });

    it('should have SAML configuration', () => {
      expect(OIDCProviders.saml).toBeDefined();
      expect(OIDCProviders.saml.isOIDC).toBe(false);
    });
  });

  describe('getProviderConfig', () => {
    it('should return provider config', () => {
      const config = getProviderConfig('google');

      expect(config).not.toBeNull();
      expect(config.name).toBe('Google');
    });

    it('should return null for unknown provider', () => {
      const config = getProviderConfig('unknown');

      expect(config).toBeNull();
    });
  });

  describe('getIssuerUrl', () => {
    it('should return static issuer for Google', () => {
      const url = getIssuerUrl('google');

      expect(url).toBe('https://accounts.google.com');
    });

    it('should return dynamic issuer for Azure AD', () => {
      const url = getIssuerUrl('azure_ad', { tenantId: 'my-tenant' });

      expect(url).toBe('https://login.microsoftonline.com/my-tenant/v2.0');
    });

    it('should use common for Azure AD without tenant', () => {
      const url = getIssuerUrl('azure_ad', {});

      expect(url).toBe('https://login.microsoftonline.com/common/v2.0');
    });

    it('should return dynamic issuer for Okta', () => {
      const url = getIssuerUrl('okta', { domain: 'dev-123456' });

      expect(url).toBe('https://dev-123456.okta.com');
    });

    it('should return dynamic issuer for Auth0', () => {
      const url = getIssuerUrl('auth0', { domain: 'my-tenant' });

      expect(url).toBe('https://my-tenant.auth0.com/');
    });

    it('should return dynamic issuer for OneLogin', () => {
      const url = getIssuerUrl('onelogin', { domain: 'my-company' });

      expect(url).toBe('https://my-company.onelogin.com/oidc/2');
    });

    it('should return dynamic issuer for Keycloak', () => {
      const url = getIssuerUrl('keycloak', {
        baseUrl: 'https://keycloak.example.com',
        realm: 'my-realm'
      });

      expect(url).toBe('https://keycloak.example.com/realms/my-realm');
    });

    it('should return null for unknown provider', () => {
      const url = getIssuerUrl('unknown');

      expect(url).toBeNull();
    });

    it('should return null for generic OIDC', () => {
      const url = getIssuerUrl('oidc');

      expect(url).toBeNull();
    });
  });

  describe('getDiscoveryUrl', () => {
    it('should return static discovery URL for Google', () => {
      const url = getDiscoveryUrl('google');

      expect(url).toBe('https://accounts.google.com/.well-known/openid-configuration');
    });

    it('should return dynamic discovery URL for Azure AD', () => {
      const url = getDiscoveryUrl('azure_ad', { tenantId: 'my-tenant' });

      expect(url).toBe('https://login.microsoftonline.com/my-tenant/v2.0/.well-known/openid-configuration');
    });

    it('should return dynamic discovery URL for Okta', () => {
      const url = getDiscoveryUrl('okta', { domain: 'dev-123456' });

      expect(url).toBe('https://dev-123456.okta.com/.well-known/openid-configuration');
    });

    it('should return dynamic discovery URL for Auth0', () => {
      const url = getDiscoveryUrl('auth0', { domain: 'my-tenant' });

      expect(url).toBe('https://my-tenant.auth0.com/.well-known/openid-configuration');
    });

    it('should return dynamic discovery URL for OneLogin', () => {
      const url = getDiscoveryUrl('onelogin', { domain: 'my-company' });

      expect(url).toBe('https://my-company.onelogin.com/oidc/2/.well-known/openid-configuration');
    });

    it('should return dynamic discovery URL for Keycloak', () => {
      const url = getDiscoveryUrl('keycloak', {
        baseUrl: 'https://keycloak.example.com',
        realm: 'my-realm'
      });

      expect(url).toBe('https://keycloak.example.com/realms/my-realm/.well-known/openid-configuration');
    });

    it('should return null for unknown provider', () => {
      const url = getDiscoveryUrl('unknown');

      expect(url).toBeNull();
    });
  });

  describe('getAllProviders', () => {
    it('should return OIDC providers by default', () => {
      const providers = getAllProviders();

      expect(providers.length).toBeGreaterThan(0);
      expect(providers.find(p => p.type === 'google')).toBeDefined();
      expect(providers.find(p => p.type === 'saml')).toBeUndefined();
    });

    it('should include non-OIDC providers when specified', () => {
      const providers = getAllProviders(true);

      expect(providers.find(p => p.type === 'saml')).toBeDefined();
    });

    it('should include type, name, displayName, and notes', () => {
      const providers = getAllProviders();
      const google = providers.find(p => p.type === 'google');

      expect(google.type).toBe('google');
      expect(google.name).toBe('Google');
      expect(google.displayName).toBe('Google Workspace');
      expect(google.notes).toBeDefined();
    });
  });

  describe('isValidProvider', () => {
    it('should return true for valid providers', () => {
      expect(isValidProvider('google')).toBe(true);
      expect(isValidProvider('azure_ad')).toBe(true);
      expect(isValidProvider('okta')).toBe(true);
      expect(isValidProvider('auth0')).toBe(true);
      expect(isValidProvider('saml')).toBe(true);
    });

    it('should return false for invalid providers', () => {
      expect(isValidProvider('unknown')).toBe(false);
      expect(isValidProvider('')).toBe(false);
      expect(isValidProvider(null)).toBe(false);
    });
  });

  describe('getDefaultScopes', () => {
    it('should return default scopes for provider', () => {
      const googleScopes = getDefaultScopes('google');
      expect(googleScopes).toBe('openid profile email');

      const azureScopes = getDefaultScopes('azure_ad');
      expect(azureScopes).toContain('User.Read');

      const oktaScopes = getDefaultScopes('okta');
      expect(oktaScopes).toContain('groups');
    });

    it('should return default scopes for unknown provider', () => {
      const scopes = getDefaultScopes('unknown');
      expect(scopes).toBe('openid profile email');
    });
  });

  describe('getTokenEndpointAuthMethod', () => {
    it('should return auth method for provider', () => {
      expect(getTokenEndpointAuthMethod('google')).toBe('client_secret_post');
      expect(getTokenEndpointAuthMethod('okta')).toBe('client_secret_basic');
      expect(getTokenEndpointAuthMethod('azure_ad')).toBe('client_secret_post');
    });

    it('should return default for unknown provider', () => {
      expect(getTokenEndpointAuthMethod('unknown')).toBe('client_secret_basic');
    });
  });

  describe('mapUserAttributes', () => {
    it('should map Google claims', () => {
      const claims = {
        sub: 'user-123',
        email: 'user@gmail.com',
        name: 'Test User',
        given_name: 'Test',
        family_name: 'User',
        picture: 'https://lh3.googleusercontent.com/photo.jpg',
        hd: 'example.com'
      };

      const result = mapUserAttributes('google', claims);

      expect(result.sub).toBe('user-123');
      expect(result.email).toBe('user@gmail.com');
      expect(result.name).toBe('Test User');
      expect(result.hd).toBe('example.com');
    });

    it('should map Azure AD claims', () => {
      const claims = {
        oid: 'azure-oid-123',
        email: 'user@company.com',
        name: 'Test User',
        preferred_username: 'user@company.com',
        groups: ['group1', 'group2']
      };

      const result = mapUserAttributes('azure_ad', claims);

      expect(result.sub).toBe('azure-oid-123');
      expect(result.groups).toEqual(['group1', 'group2']);
    });

    it('should map Keycloak claims', () => {
      const claims = {
        sub: 'kc-user-123',
        email: 'user@keycloak.com',
        realm_access: { roles: ['admin'] },
        resource_access: {}
      };

      const result = mapUserAttributes('keycloak', claims);

      expect(result.sub).toBe('kc-user-123');
      expect(result.realm_access).toEqual({ roles: ['admin'] });
    });

    it('should handle missing claims', () => {
      const claims = { sub: 'user-123' };

      const result = mapUserAttributes('google', claims);

      expect(result.sub).toBe('user-123');
      expect(result.email).toBeUndefined();
    });

    it('should fallback to standard claims if provider mapping fails', () => {
      const claims = {
        sub: 'user-123',
        email: 'user@test.com',
        name: 'Test User'
      };

      const result = mapUserAttributes('oidc', claims);

      expect(result.sub).toBe('user-123');
      expect(result.email).toBe('user@test.com');
    });

    it('should return empty object for unknown provider', () => {
      const claims = { sub: 'user-123' };

      const result = mapUserAttributes('unknown', claims);

      expect(result).toEqual({});
    });
  });

  describe('Provider Feature Support', () => {
    it('Google should not support logout', () => {
      expect(OIDCProviders.google.supportsLogout).toBe(false);
    });

    it('Azure AD should support logout', () => {
      expect(OIDCProviders.azure_ad.supportsLogout).toBe(true);
    });

    it('All OIDC providers should support PKCE', () => {
      const oidcProviders = ['azure_ad', 'google', 'okta', 'auth0', 'onelogin', 'keycloak', 'oidc'];

      for (const provider of oidcProviders) {
        expect(OIDCProviders[provider].supportsPKCE).toBe(true);
      }
    });

    it('All OIDC providers should support refresh tokens', () => {
      const oidcProviders = ['azure_ad', 'google', 'okta', 'auth0', 'onelogin', 'keycloak', 'oidc'];

      for (const provider of oidcProviders) {
        expect(OIDCProviders[provider].supportsRefreshToken).toBe(true);
      }
    });
  });

  describe('Provider Additional Parameters', () => {
    it('Azure AD should include response_mode', () => {
      expect(OIDCProviders.azure_ad.additionalParams.response_mode).toBe('query');
    });

    it('Google should include access_type and prompt', () => {
      expect(OIDCProviders.google.additionalParams.access_type).toBe('offline');
      expect(OIDCProviders.google.additionalParams.prompt).toBe('consent');
    });

    it('Auth0 should include audience placeholder', () => {
      expect(OIDCProviders.auth0.additionalParams.audience).toBeDefined();
    });
  });
});
