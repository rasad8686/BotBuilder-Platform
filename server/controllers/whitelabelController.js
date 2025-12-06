const log = require('../utils/logger');
const db = require('../db');
const { deleteOldFile, getPublicUrl } = require('../middleware/upload');
const path = require('path');

/**
 * White-label Controller
 * Handles all white-label/custom branding operations
 */

/**
 * Get whitelabel settings for current organization
 * GET /api/whitelabel/settings
 */
async function getSettings(req, res) {
  try {
    const organizationId = req.organization?.id;

    if (!organizationId) {
      log.error('Get whitelabel settings error: Organization ID is missing', {
        organization: req.organization,
        userId: req.user?.id
      });
      return res.status(400).json({
        success: false,
        message: 'Organization context is required'
      });
    }

    const query = `
      SELECT *
      FROM whitelabel_settings
      WHERE organization_id = $1
    `;

    const result = await db.query(query, [organizationId]);

    if (result.rows.length === 0) {
      // Create default settings if none exist
      const createQuery = `
        INSERT INTO whitelabel_settings (organization_id, brand_name, show_powered_by)
        VALUES ($1, 'BotBuilder', true)
        RETURNING *
      `;
      const createResult = await db.query(createQuery, [organizationId]);

      return res.status(200).json({
        success: true,
        settings: createResult.rows[0]
      });
    }

    return res.status(200).json({
      success: true,
      settings: result.rows[0]
    });

  } catch (error) {
    log.error('Get whitelabel settings error', {
      error: error.message,
      stack: error.stack,
      organizationId: req.organization?.id,
      userId: req.user?.id,
      hasOrganization: !!req.organization
    });
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve whitelabel settings'
    });
  }
}

/**
 * Update whitelabel settings for current organization
 * PUT /api/whitelabel/settings
 */
async function updateSettings(req, res) {
  try {
    const organizationId = req.organization.id;
    const {
      brand_name,
      primary_color,
      secondary_color,
      accent_color,
      background_color,
      text_color,
      custom_domain,
      support_email,
      company_name,
      company_website,
      email_from_name,
      email_from_address,
      email_header_color,
      email_footer_text,
      privacy_policy_url,
      terms_of_service_url,
      show_powered_by,
      custom_css
    } = req.body;

    // Validate color codes (basic validation)
    const colors = [primary_color, secondary_color, accent_color, background_color, text_color, email_header_color];
    for (const color of colors) {
      if (color && !/^#[0-9A-F]{6}$/i.test(color)) {
        return res.status(400).json({
          success: false,
          message: `Invalid color format: ${color}. Must be hex color like #8b5cf6`
        });
      }
    }

    // Validate email format
    if (support_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(support_email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid support email format'
      });
    }

    if (email_from_address && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email_from_address)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email from address format'
      });
    }

    // Build update query dynamically
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (brand_name !== undefined) {
      updates.push(`brand_name = $${paramCount}`);
      values.push(brand_name);
      paramCount++;
    }

    if (primary_color !== undefined) {
      updates.push(`primary_color = $${paramCount}`);
      values.push(primary_color);
      paramCount++;
    }

    if (secondary_color !== undefined) {
      updates.push(`secondary_color = $${paramCount}`);
      values.push(secondary_color);
      paramCount++;
    }

    if (accent_color !== undefined) {
      updates.push(`accent_color = $${paramCount}`);
      values.push(accent_color);
      paramCount++;
    }

    if (background_color !== undefined) {
      updates.push(`background_color = $${paramCount}`);
      values.push(background_color);
      paramCount++;
    }

    if (text_color !== undefined) {
      updates.push(`text_color = $${paramCount}`);
      values.push(text_color);
      paramCount++;
    }

    if (custom_domain !== undefined) {
      updates.push(`custom_domain = $${paramCount}`);
      values.push(custom_domain);
      paramCount++;
      // Reset verification when domain changes
      updates.push(`custom_domain_verified = false`);
    }

    if (support_email !== undefined) {
      updates.push(`support_email = $${paramCount}`);
      values.push(support_email);
      paramCount++;
    }

    if (company_name !== undefined) {
      updates.push(`company_name = $${paramCount}`);
      values.push(company_name);
      paramCount++;
    }

    if (company_website !== undefined) {
      updates.push(`company_website = $${paramCount}`);
      values.push(company_website);
      paramCount++;
    }

    if (email_from_name !== undefined) {
      updates.push(`email_from_name = $${paramCount}`);
      values.push(email_from_name);
      paramCount++;
    }

    if (email_from_address !== undefined) {
      updates.push(`email_from_address = $${paramCount}`);
      values.push(email_from_address);
      paramCount++;
    }

    if (email_header_color !== undefined) {
      updates.push(`email_header_color = $${paramCount}`);
      values.push(email_header_color);
      paramCount++;
    }

    if (email_footer_text !== undefined) {
      updates.push(`email_footer_text = $${paramCount}`);
      values.push(email_footer_text);
      paramCount++;
    }

    if (privacy_policy_url !== undefined) {
      updates.push(`privacy_policy_url = $${paramCount}`);
      values.push(privacy_policy_url);
      paramCount++;
    }

    if (terms_of_service_url !== undefined) {
      updates.push(`terms_of_service_url = $${paramCount}`);
      values.push(terms_of_service_url);
      paramCount++;
    }

    if (show_powered_by !== undefined) {
      updates.push(`show_powered_by = $${paramCount}`);
      values.push(show_powered_by);
      paramCount++;
    }

    if (custom_css !== undefined) {
      updates.push(`custom_css = $${paramCount}`);
      values.push(custom_css);
      paramCount++;
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }

    values.push(organizationId);

    const query = `
      UPDATE whitelabel_settings
      SET ${updates.join(', ')}
      WHERE organization_id = $${paramCount}
      RETURNING *
    `;

    const result = await db.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Whitelabel settings not found'
      });
    }

    log.info('Updated whitelabel settings', { organizationId });

    return res.status(200).json({
      success: true,
      settings: result.rows[0],
      message: 'Whitelabel settings updated successfully'
    });

  } catch (error) {
    log.error('Update whitelabel settings error', { error: error.message, stack: error.stack });
    return res.status(500).json({
      success: false,
      message: 'Failed to update whitelabel settings'
    });
  }
}

/**
 * Upload logo file
 * POST /api/whitelabel/upload-logo
 */
async function uploadLogo(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    const organizationId = req.organization.id;
    const filename = req.file.filename;
    const logoUrl = getPublicUrl(req, filename);

    // Get old logo URL to delete old file
    const oldQuery = `SELECT logo_url FROM whitelabel_settings WHERE organization_id = $1`;
    const oldResult = await db.query(oldQuery, [organizationId]);

    if (oldResult.rows.length > 0 && oldResult.rows[0].logo_url) {
      const oldFilename = path.basename(oldResult.rows[0].logo_url);
      const oldFilePath = path.join(__dirname, '../../uploads/whitelabel', oldFilename);
      deleteOldFile(oldFilePath);
    }

    // Update database with new logo URL
    const query = `
      UPDATE whitelabel_settings
      SET logo_url = $1
      WHERE organization_id = $2
      RETURNING *
    `;

    const result = await db.query(query, [logoUrl, organizationId]);

    log.info('Uploaded logo for organization', { organizationId, filename });

    return res.status(200).json({
      success: true,
      logo_url: logoUrl,
      settings: result.rows[0],
      message: 'Logo uploaded successfully'
    });

  } catch (error) {
    log.error('Upload logo error', { error: error.message, stack: error.stack });
    return res.status(500).json({
      success: false,
      message: 'Failed to upload logo'
    });
  }
}

/**
 * Upload favicon file
 * POST /api/whitelabel/upload-favicon
 */
async function uploadFavicon(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    const organizationId = req.organization.id;
    const filename = req.file.filename;
    const faviconUrl = getPublicUrl(req, filename);

    // Get old favicon URL to delete old file
    const oldQuery = `SELECT favicon_url FROM whitelabel_settings WHERE organization_id = $1`;
    const oldResult = await db.query(oldQuery, [organizationId]);

    if (oldResult.rows.length > 0 && oldResult.rows[0].favicon_url) {
      const oldFilename = path.basename(oldResult.rows[0].favicon_url);
      const oldFilePath = path.join(__dirname, '../../uploads/whitelabel', oldFilename);
      deleteOldFile(oldFilePath);
    }

    // Update database with new favicon URL
    const query = `
      UPDATE whitelabel_settings
      SET favicon_url = $1
      WHERE organization_id = $2
      RETURNING *
    `;

    const result = await db.query(query, [faviconUrl, organizationId]);

    log.info('Uploaded favicon for organization', { organizationId, filename });

    return res.status(200).json({
      success: true,
      favicon_url: faviconUrl,
      settings: result.rows[0],
      message: 'Favicon uploaded successfully'
    });

  } catch (error) {
    log.error('Upload favicon error', { error: error.message, stack: error.stack });
    return res.status(500).json({
      success: false,
      message: 'Failed to upload favicon'
    });
  }
}

/**
 * Get public whitelabel settings by domain (no auth required)
 * GET /api/whitelabel/public/:domain
 */
async function getPublicSettings(req, res) {
  try {
    const { domain } = req.params;

    const query = `
      SELECT
        brand_name,
        logo_url,
        logo_dark_url,
        favicon_url,
        primary_color,
        secondary_color,
        accent_color,
        background_color,
        text_color,
        company_name,
        privacy_policy_url,
        terms_of_service_url,
        show_powered_by,
        custom_css
      FROM whitelabel_settings
      WHERE custom_domain = $1 AND custom_domain_verified = true
    `;

    const result = await db.query(query, [domain]);

    if (result.rows.length === 0) {
      // Return default branding
      return res.status(200).json({
        success: true,
        settings: {
          brand_name: 'BotBuilder',
          primary_color: '#8b5cf6',
          secondary_color: '#6366f1',
          accent_color: '#ec4899',
          background_color: '#ffffff',
          text_color: '#1f2937',
          show_powered_by: true
        }
      });
    }

    return res.status(200).json({
      success: true,
      settings: result.rows[0]
    });

  } catch (error) {
    log.error('Get public whitelabel settings error', { error: error.message, stack: error.stack });
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve public whitelabel settings'
    });
  }
}

module.exports = {
  getSettings,
  updateSettings,
  uploadLogo,
  uploadFavicon,
  getPublicSettings
};
