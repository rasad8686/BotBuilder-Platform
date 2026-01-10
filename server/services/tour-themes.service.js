/**
 * Tour Themes Service
 * Handles theme management and application for product tours
 */

const db = require('../config/db');
const log = require('../utils/logger');

// Default System Themes
const SYSTEM_THEMES = [
  {
    id: 'light',
    name: 'Light',
    description: 'Clean light theme with subtle shadows',
    is_system: true,
    colors: {
      primary: '#3B82F6',
      secondary: '#6366F1',
      background: '#FFFFFF',
      text: '#1F2937',
      textSecondary: '#6B7280',
      border: '#E5E7EB',
      overlay: 'rgba(0, 0, 0, 0.5)'
    },
    typography: {
      fontFamily: 'Inter, system-ui, sans-serif',
      titleSize: '18px',
      contentSize: '14px',
      buttonSize: '14px'
    },
    styling: {
      borderRadius: '8px',
      tooltipStyle: 'light',
      buttonStyle: 'filled',
      shadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
      overlayOpacity: 0.5
    },
    animation: {
      type: 'fade',
      duration: 300,
      easing: 'ease-out'
    }
  },
  {
    id: 'dark',
    name: 'Dark',
    description: 'Modern dark theme for low-light environments',
    is_system: true,
    colors: {
      primary: '#60A5FA',
      secondary: '#818CF8',
      background: '#1F2937',
      text: '#F9FAFB',
      textSecondary: '#9CA3AF',
      border: '#374151',
      overlay: 'rgba(0, 0, 0, 0.7)'
    },
    typography: {
      fontFamily: 'Inter, system-ui, sans-serif',
      titleSize: '18px',
      contentSize: '14px',
      buttonSize: '14px'
    },
    styling: {
      borderRadius: '8px',
      tooltipStyle: 'dark',
      buttonStyle: 'filled',
      shadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2)',
      overlayOpacity: 0.7
    },
    animation: {
      type: 'fade',
      duration: 300,
      easing: 'ease-out'
    }
  },
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Simple and clean with minimal styling',
    is_system: true,
    colors: {
      primary: '#000000',
      secondary: '#4B5563',
      background: '#FFFFFF',
      text: '#111827',
      textSecondary: '#6B7280',
      border: '#E5E7EB',
      overlay: 'rgba(255, 255, 255, 0.9)'
    },
    typography: {
      fontFamily: 'system-ui, sans-serif',
      titleSize: '16px',
      contentSize: '14px',
      buttonSize: '13px'
    },
    styling: {
      borderRadius: '4px',
      tooltipStyle: 'light',
      buttonStyle: 'outline',
      shadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
      overlayOpacity: 0.9
    },
    animation: {
      type: 'slide',
      duration: 200,
      easing: 'ease-in-out'
    }
  },
  {
    id: 'playful',
    name: 'Playful',
    description: 'Fun and colorful with bouncy animations',
    is_system: true,
    colors: {
      primary: '#EC4899',
      secondary: '#8B5CF6',
      background: '#FFFFFF',
      text: '#1F2937',
      textSecondary: '#6B7280',
      border: '#FDE68A',
      overlay: 'rgba(139, 92, 246, 0.3)'
    },
    typography: {
      fontFamily: 'Poppins, system-ui, sans-serif',
      titleSize: '20px',
      contentSize: '15px',
      buttonSize: '14px'
    },
    styling: {
      borderRadius: '16px',
      tooltipStyle: 'custom',
      buttonStyle: 'filled',
      shadow: '0 10px 15px -3px rgba(236, 72, 153, 0.2), 0 4px 6px -2px rgba(139, 92, 246, 0.1)',
      overlayOpacity: 0.3
    },
    animation: {
      type: 'bounce',
      duration: 400,
      easing: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)'
    }
  },
  {
    id: 'corporate',
    name: 'Corporate',
    description: 'Professional theme for business applications',
    is_system: true,
    colors: {
      primary: '#2563EB',
      secondary: '#1E40AF',
      background: '#F8FAFC',
      text: '#0F172A',
      textSecondary: '#475569',
      border: '#CBD5E1',
      overlay: 'rgba(15, 23, 42, 0.6)'
    },
    typography: {
      fontFamily: 'Roboto, system-ui, sans-serif',
      titleSize: '18px',
      contentSize: '14px',
      buttonSize: '14px'
    },
    styling: {
      borderRadius: '6px',
      tooltipStyle: 'light',
      buttonStyle: 'filled',
      shadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
      overlayOpacity: 0.6
    },
    animation: {
      type: 'fade',
      duration: 250,
      easing: 'ease-out'
    }
  },
  {
    id: 'nature',
    name: 'Nature',
    description: 'Earthy tones inspired by nature',
    is_system: true,
    colors: {
      primary: '#059669',
      secondary: '#10B981',
      background: '#ECFDF5',
      text: '#064E3B',
      textSecondary: '#047857',
      border: '#A7F3D0',
      overlay: 'rgba(6, 78, 59, 0.5)'
    },
    typography: {
      fontFamily: 'Nunito, system-ui, sans-serif',
      titleSize: '18px',
      contentSize: '14px',
      buttonSize: '14px'
    },
    styling: {
      borderRadius: '12px',
      tooltipStyle: 'custom',
      buttonStyle: 'filled',
      shadow: '0 4px 14px -3px rgba(5, 150, 105, 0.25)',
      overlayOpacity: 0.5
    },
    animation: {
      type: 'slide',
      duration: 350,
      easing: 'ease-out'
    }
  }
];

class TourThemesService {
  /**
   * Get all themes
   */
  async getThemes(organizationId = null) {
    try {
      // Get system themes
      const systemThemes = [...SYSTEM_THEMES];

      // Get custom themes from database
      let query = db('tour_themes').where({ is_system: false });

      if (organizationId) {
        query = query.where({ organization_id: organizationId });
      }

      const customThemes = await query.orderBy('created_at', 'desc');

      // Parse JSON fields
      const parsedCustomThemes = customThemes.map(t => this.parseTheme(t));

      return {
        system: systemThemes,
        custom: parsedCustomThemes,
        total: systemThemes.length + parsedCustomThemes.length
      };
    } catch (error) {
      log.error('Get themes error', { error: error.message });
      throw error;
    }
  }

  /**
   * Get theme by ID
   */
  async getThemeById(themeId) {
    try {
      // Check if system theme
      const systemTheme = SYSTEM_THEMES.find(t => t.id === themeId);
      if (systemTheme) {
        return { ...systemTheme, isSystem: true };
      }

      // Get from database
      const theme = await db('tour_themes')
        .where({ id: themeId })
        .first();

      if (!theme) {
        throw new Error('Theme not found');
      }

      return { ...this.parseTheme(theme), isSystem: false };
    } catch (error) {
      log.error('Get theme by ID error', { themeId, error: error.message });
      throw error;
    }
  }

  /**
   * Create custom theme
   */
  async createTheme(themeData, organizationId) {
    try {
      const [theme] = await db('tour_themes')
        .insert({
          organization_id: organizationId,
          name: themeData.name,
          description: themeData.description || null,
          is_system: false,
          colors: JSON.stringify(themeData.colors || {}),
          typography: JSON.stringify(themeData.typography || {}),
          styling: JSON.stringify(themeData.styling || {}),
          animation: JSON.stringify(themeData.animation || {}),
          created_at: new Date(),
          updated_at: new Date()
        })
        .returning('*');

      return this.parseTheme(theme);
    } catch (error) {
      log.error('Create theme error', { error: error.message });
      throw error;
    }
  }

  /**
   * Update theme
   */
  async updateTheme(themeId, data) {
    try {
      const updates = {
        updated_at: new Date()
      };

      if (data.name) updates.name = data.name;
      if (data.description !== undefined) updates.description = data.description;
      if (data.colors) updates.colors = JSON.stringify(data.colors);
      if (data.typography) updates.typography = JSON.stringify(data.typography);
      if (data.styling) updates.styling = JSON.stringify(data.styling);
      if (data.animation) updates.animation = JSON.stringify(data.animation);

      const [theme] = await db('tour_themes')
        .where({ id: themeId, is_system: false })
        .update(updates)
        .returning('*');

      if (!theme) {
        throw new Error('Theme not found or cannot be updated');
      }

      return this.parseTheme(theme);
    } catch (error) {
      log.error('Update theme error', { themeId, error: error.message });
      throw error;
    }
  }

  /**
   * Delete theme
   */
  async deleteTheme(themeId) {
    try {
      const deleted = await db('tour_themes')
        .where({ id: themeId, is_system: false })
        .delete();

      if (!deleted) {
        throw new Error('Theme not found or cannot be deleted');
      }

      return { success: true };
    } catch (error) {
      log.error('Delete theme error', { themeId, error: error.message });
      throw error;
    }
  }

  /**
   * Apply theme to tour
   */
  async applyTheme(tourId, themeId) {
    try {
      const theme = await this.getThemeById(themeId);

      // Prepare theme data for tour
      const themeConfig = {
        themeId: theme.id,
        themeName: theme.name,
        colors: theme.colors,
        typography: theme.typography,
        styling: theme.styling,
        animation: theme.animation
      };

      // Update tour with theme
      const [updatedTour] = await db('tours')
        .where({ id: tourId })
        .update({
          theme: JSON.stringify(themeConfig),
          updated_at: new Date()
        })
        .returning('*');

      if (!updatedTour) {
        throw new Error('Tour not found');
      }

      return {
        tour: {
          ...updatedTour,
          theme: themeConfig
        },
        appliedTheme: theme
      };
    } catch (error) {
      log.error('Apply theme error', { tourId, themeId, error: error.message });
      throw error;
    }
  }

  /**
   * Get theme CSS variables
   */
  getThemeCSS(theme) {
    return `
      :root {
        --tour-primary: ${theme.colors?.primary || '#3B82F6'};
        --tour-secondary: ${theme.colors?.secondary || '#6366F1'};
        --tour-background: ${theme.colors?.background || '#FFFFFF'};
        --tour-text: ${theme.colors?.text || '#1F2937'};
        --tour-text-secondary: ${theme.colors?.textSecondary || '#6B7280'};
        --tour-border: ${theme.colors?.border || '#E5E7EB'};
        --tour-overlay: ${theme.colors?.overlay || 'rgba(0, 0, 0, 0.5)'};
        --tour-font-family: ${theme.typography?.fontFamily || 'system-ui, sans-serif'};
        --tour-title-size: ${theme.typography?.titleSize || '18px'};
        --tour-content-size: ${theme.typography?.contentSize || '14px'};
        --tour-button-size: ${theme.typography?.buttonSize || '14px'};
        --tour-border-radius: ${theme.styling?.borderRadius || '8px'};
        --tour-shadow: ${theme.styling?.shadow || '0 4px 6px -1px rgba(0, 0, 0, 0.1)'};
        --tour-overlay-opacity: ${theme.styling?.overlayOpacity || 0.5};
        --tour-animation-duration: ${theme.animation?.duration || 300}ms;
        --tour-animation-easing: ${theme.animation?.easing || 'ease-out'};
      }
    `;
  }

  /**
   * Clone theme
   */
  async cloneTheme(themeId, newName, organizationId) {
    try {
      const sourceTheme = await this.getThemeById(themeId);

      const clonedTheme = await this.createTheme({
        name: newName || `${sourceTheme.name} (Copy)`,
        description: sourceTheme.description,
        colors: sourceTheme.colors,
        typography: sourceTheme.typography,
        styling: sourceTheme.styling,
        animation: sourceTheme.animation
      }, organizationId);

      return clonedTheme;
    } catch (error) {
      log.error('Clone theme error', { themeId, error: error.message });
      throw error;
    }
  }

  /**
   * Get animation types
   */
  getAnimationTypes() {
    return [
      { id: 'fade', name: 'Fade', description: 'Smooth fade in/out' },
      { id: 'slide', name: 'Slide', description: 'Slide from direction' },
      { id: 'bounce', name: 'Bounce', description: 'Bouncy entrance' },
      { id: 'scale', name: 'Scale', description: 'Scale up/down' },
      { id: 'none', name: 'None', description: 'No animation' }
    ];
  }

  /**
   * Get tooltip styles
   */
  getTooltipStyles() {
    return [
      { id: 'light', name: 'Light', description: 'Light background with dark text' },
      { id: 'dark', name: 'Dark', description: 'Dark background with light text' },
      { id: 'custom', name: 'Custom', description: 'Use custom colors' }
    ];
  }

  /**
   * Get button styles
   */
  getButtonStyles() {
    return [
      { id: 'filled', name: 'Filled', description: 'Solid background color' },
      { id: 'outline', name: 'Outline', description: 'Border only, transparent background' },
      { id: 'ghost', name: 'Ghost', description: 'No border or background' },
      { id: 'link', name: 'Link', description: 'Text only, underlined' }
    ];
  }

  /**
   * Parse theme from database
   */
  parseTheme(theme) {
    return {
      ...theme,
      colors: typeof theme.colors === 'string' ? JSON.parse(theme.colors) : theme.colors || {},
      typography: typeof theme.typography === 'string' ? JSON.parse(theme.typography) : theme.typography || {},
      styling: typeof theme.styling === 'string' ? JSON.parse(theme.styling) : theme.styling || {},
      animation: typeof theme.animation === 'string' ? JSON.parse(theme.animation) : theme.animation || {}
    };
  }
}

module.exports = new TourThemesService();
