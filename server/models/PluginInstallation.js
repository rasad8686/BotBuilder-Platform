/**
 * Plugin Installation Model - Database operations for plugin installations
 */

const db = require('../db');

const PluginInstallation = {
  /**
   * Install a plugin for a tenant
   */
  async install(pluginId, tenantId, version, settings = {}) {
    const result = await db.query(
      `INSERT INTO plugin_installations (plugin_id, tenant_id, installed_version, status, settings)
       VALUES ($1, $2, $3, 'active', $4)
       ON CONFLICT (plugin_id, tenant_id)
       DO UPDATE SET
         installed_version = $3,
         status = 'active',
         settings = $4,
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [pluginId, tenantId, version, JSON.stringify(settings)]
    );

    return result.rows[0];
  },

  /**
   * Uninstall a plugin for a tenant
   */
  async uninstall(pluginId, tenantId) {
    const result = await db.query(
      `DELETE FROM plugin_installations
       WHERE plugin_id = $1 AND tenant_id = $2
       RETURNING *`,
      [pluginId, tenantId]
    );

    return result.rows[0] || null;
  },

  /**
   * Get all installations for a tenant
   */
  async getByTenant(tenantId, options = {}) {
    const { status } = options;

    let sql = `
      SELECT pi.*, p.name as plugin_name, p.slug as plugin_slug,
             p.icon_url, p.version as latest_version, p.description
      FROM plugin_installations pi
      JOIN plugins p ON pi.plugin_id = p.id
      WHERE pi.tenant_id = $1
    `;
    const params = [tenantId];

    if (status) {
      sql += ` AND pi.status = $2`;
      params.push(status);
    }

    sql += ` ORDER BY pi.installed_at DESC`;

    const result = await db.query(sql, params);
    return result.rows.map(row => ({
      ...row,
      settings: typeof row.settings === 'string' ? JSON.parse(row.settings) : row.settings
    }));
  },

  /**
   * Get all installations for a plugin
   */
  async getByPlugin(pluginId) {
    const result = await db.query(
      `SELECT pi.*, u.email as user_email
       FROM plugin_installations pi
       LEFT JOIN users u ON pi.tenant_id = u.id
       WHERE pi.plugin_id = $1
       ORDER BY pi.installed_at DESC`,
      [pluginId]
    );

    return result.rows.map(row => ({
      ...row,
      settings: typeof row.settings === 'string' ? JSON.parse(row.settings) : row.settings
    }));
  },

  /**
   * Update installation settings
   */
  async updateSettings(pluginId, tenantId, settings) {
    const result = await db.query(
      `UPDATE plugin_installations
       SET settings = $3, updated_at = CURRENT_TIMESTAMP
       WHERE plugin_id = $1 AND tenant_id = $2
       RETURNING *`,
      [pluginId, tenantId, JSON.stringify(settings)]
    );

    if (result.rows[0]) {
      result.rows[0].settings = typeof result.rows[0].settings === 'string'
        ? JSON.parse(result.rows[0].settings)
        : result.rows[0].settings;
    }

    return result.rows[0] || null;
  },

  /**
   * Update installation status
   */
  async updateStatus(pluginId, tenantId, status) {
    const validStatuses = ['active', 'disabled', 'pending_update'];
    if (!validStatuses.includes(status)) {
      throw new Error(`Invalid status: ${status}`);
    }

    const result = await db.query(
      `UPDATE plugin_installations
       SET status = $3, updated_at = CURRENT_TIMESTAMP
       WHERE plugin_id = $1 AND tenant_id = $2
       RETURNING *`,
      [pluginId, tenantId, status]
    );

    return result.rows[0] || null;
  },

  /**
   * Check if plugin is installed for tenant
   */
  async isInstalled(pluginId, tenantId) {
    const result = await db.query(
      `SELECT EXISTS(
        SELECT 1 FROM plugin_installations
        WHERE plugin_id = $1 AND tenant_id = $2
      ) as installed`,
      [pluginId, tenantId]
    );

    return result.rows[0].installed;
  },

  /**
   * Get installation by plugin and tenant
   */
  async getInstallation(pluginId, tenantId) {
    const result = await db.query(
      `SELECT pi.*, p.name as plugin_name, p.slug as plugin_slug,
              p.version as latest_version
       FROM plugin_installations pi
       JOIN plugins p ON pi.plugin_id = p.id
       WHERE pi.plugin_id = $1 AND pi.tenant_id = $2`,
      [pluginId, tenantId]
    );

    if (result.rows[0]) {
      result.rows[0].settings = typeof result.rows[0].settings === 'string'
        ? JSON.parse(result.rows[0].settings)
        : result.rows[0].settings;
    }

    return result.rows[0] || null;
  },

  /**
   * Get installation count for a plugin
   */
  async getInstallCount(pluginId) {
    const result = await db.query(
      `SELECT COUNT(*) as count FROM plugin_installations WHERE plugin_id = $1`,
      [pluginId]
    );

    return parseInt(result.rows[0].count, 10);
  },

  /**
   * Get active installations count for tenant
   */
  async getActiveCount(tenantId) {
    const result = await db.query(
      `SELECT COUNT(*) as count FROM plugin_installations
       WHERE tenant_id = $1 AND status = 'active'`,
      [tenantId]
    );

    return parseInt(result.rows[0].count, 10);
  },

  /**
   * Update installed version
   */
  async updateVersion(pluginId, tenantId, newVersion) {
    const result = await db.query(
      `UPDATE plugin_installations
       SET installed_version = $3, status = 'active', updated_at = CURRENT_TIMESTAMP
       WHERE plugin_id = $1 AND tenant_id = $2
       RETURNING *`,
      [pluginId, tenantId, newVersion]
    );

    return result.rows[0] || null;
  },

  /**
   * Get installations needing update
   */
  async getNeedingUpdate(tenantId) {
    const result = await db.query(
      `SELECT pi.*, p.name as plugin_name, p.version as latest_version
       FROM plugin_installations pi
       JOIN plugins p ON pi.plugin_id = p.id
       WHERE pi.tenant_id = $1 AND pi.installed_version != p.version`,
      [tenantId]
    );

    return result.rows;
  }
};

module.exports = PluginInstallation;
