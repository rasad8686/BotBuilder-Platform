/**
 * Portal Header Component
 * Header for the customer support portal
 */

import React from 'react';

const PortalHeader = ({ config, isAuthenticated, customerEmail, onLogout }) => {
  return (
    <header style={styles.header}>
      <div style={styles.container}>
        {/* Logo and Title */}
        <div style={styles.brand}>
          {config?.logo ? (
            <img
              src={config.logo}
              alt={config.name || 'Support'}
              style={styles.logo}
            />
          ) : (
            <div style={styles.defaultLogo}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
          )}
          <div style={styles.brandText}>
            <h1 style={styles.brandName}>{config?.name || 'Support Center'}</h1>
            <span style={styles.brandTagline}>Help & Support</span>
          </div>
        </div>

        {/* Right Side - Auth Status */}
        <div style={styles.rightSection}>
          {isAuthenticated && customerEmail ? (
            <div style={styles.userInfo}>
              <span style={styles.userEmail}>{customerEmail}</span>
              <button style={styles.logoutButton} onClick={onLogout}>
                Sign Out
              </button>
            </div>
          ) : (
            config?.mainSiteUrl && (
              <a
                href={config.mainSiteUrl}
                style={styles.backToSiteLink}
                target="_blank"
                rel="noopener noreferrer"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
                Back to {config.name || 'Website'}
              </a>
            )
          )}
        </div>
      </div>
    </header>
  );
};

const styles = {
  header: {
    backgroundColor: '#fff',
    borderBottom: '1px solid #e5e7eb',
    padding: '16px 24px',
    position: 'sticky',
    top: 0,
    zIndex: 100,
  },
  container: {
    maxWidth: '1200px',
    margin: '0 auto',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  logo: {
    height: '40px',
    width: 'auto',
    objectFit: 'contain',
  },
  defaultLogo: {
    width: '40px',
    height: '40px',
    backgroundColor: '#7c3aed',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
  },
  brandText: {
    display: 'flex',
    flexDirection: 'column',
  },
  brandName: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#1f2937',
    margin: 0,
    lineHeight: 1.2,
  },
  brandTagline: {
    fontSize: '12px',
    color: '#6b7280',
  },
  rightSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  userInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  userEmail: {
    fontSize: '14px',
    color: '#6b7280',
  },
  logoutButton: {
    padding: '6px 12px',
    backgroundColor: 'transparent',
    border: '1px solid #e5e7eb',
    borderRadius: '6px',
    color: '#6b7280',
    fontSize: '13px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  backToSiteLink: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    color: '#6b7280',
    fontSize: '14px',
    textDecoration: 'none',
    transition: 'color 0.2s',
  },
};

export default PortalHeader;
