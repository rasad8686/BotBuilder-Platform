/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect } from 'react';
import { getSettings } from '../api/whitelabel';

/**
 * Brand Context
 * Provides white-label branding settings to all components
 * Applies custom colors, logos, and CSS dynamically
 */

const BrandContext = createContext();

export function BrandProvider({ children }) {
  const [brand, setBrand] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBrandSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadBrandSettings = async () => {
    try {
      const token = localStorage.getItem('token');

      if (!token) {
        // Use default branding if not authenticated
        applyDefaultBranding();
        setLoading(false);
        return;
      }

      const response = await getSettings();

      if (response.success && response.settings) {
        setBrand(response.settings);
        applyBranding(response.settings);
      } else {
        applyDefaultBranding();
      }
    } catch (error) {
      applyDefaultBranding();
    } finally {
      setLoading(false);
    }
  };

  const applyBranding = (settings) => {
    // Apply CSS variables for colors
    const root = document.documentElement;

    if (settings.primary_color) {
      root.style.setProperty('--color-primary', settings.primary_color);
    }

    if (settings.secondary_color) {
      root.style.setProperty('--color-secondary', settings.secondary_color);
    }

    if (settings.accent_color) {
      root.style.setProperty('--color-accent', settings.accent_color);
    }

    if (settings.background_color) {
      root.style.setProperty('--color-background', settings.background_color);
    }

    if (settings.text_color) {
      root.style.setProperty('--color-text', settings.text_color);
    }

    // Update page title
    if (settings.brand_name) {
      document.title = settings.brand_name;
    }

    // Update favicon
    if (settings.favicon_url) {
      updateFavicon(settings.favicon_url);
    }

    // Inject custom CSS
    if (settings.custom_css) {
      injectCustomCSS(settings.custom_css);
    }

  };

  const applyDefaultBranding = () => {
    const defaultBrand = {
      brand_name: 'BotBuilder',
      primary_color: '#8b5cf6',
      secondary_color: '#6366f1',
      accent_color: '#ec4899',
      background_color: '#ffffff',
      text_color: '#1f2937',
      show_powered_by: true
    };

    setBrand(defaultBrand);
    applyBranding(defaultBrand);
  };

  const updateFavicon = (url) => {
    // Remove existing favicon
    const existingFavicon = document.querySelector('link[rel="icon"]');
    if (existingFavicon) {
      existingFavicon.remove();
    }

    // Add new favicon
    const link = document.createElement('link');
    link.rel = 'icon';
    link.href = url;
    document.head.appendChild(link);
  };

  const injectCustomCSS = (css) => {
    // Remove existing custom CSS
    const existingStyle = document.getElementById('custom-brand-css');
    if (existingStyle) {
      existingStyle.remove();
    }

    // Inject new custom CSS
    const style = document.createElement('style');
    style.id = 'custom-brand-css';
    style.textContent = css;
    document.head.appendChild(style);
  };

  const refreshBrand = async () => {
    setLoading(true);
    await loadBrandSettings();
  };

  const value = {
    brand,
    loading,
    refreshBrand
  };

  return (
    <BrandContext.Provider value={value}>
      {children}
    </BrandContext.Provider>
  );
}

export function useBrand() {
  const context = useContext(BrandContext);
  if (context === undefined) {
    throw new Error('useBrand must be used within a BrandProvider');
  }
  return context;
}
