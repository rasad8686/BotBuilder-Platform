/**
 * PluginVersioning - Plugin version management
 * Handles version tracking, updates, rollbacks, and compatibility
 */

const db = require('../../db');
const log = require('../../utils/logger');
const semver = require('semver');

class PluginVersioning {
  constructor() {
    this.updateStrategies = ['auto', 'manual', 'notify'];
  }

  /**
   * Create a new version for a plugin
   * @param {number} pluginId - Plugin ID
   * @param {object} versionData - Version information
   * @returns {object}
   */
  async createVersion(pluginId, versionData) {
    const client = await db.connect();

    try {
      await client.query('BEGIN');

      const {
        version,
        changelog,
        code,
        manifest,
        minAppVersion,
        maxAppVersion,
        breaking_changes
      } = versionData;

      // Validate version
      if (!semver.valid(version)) {
        throw new Error('Invalid version format. Use semantic versioning (e.g., 1.0.0)');
      }

      // Check version doesn't already exist
      const existingVersion = await client.query(
        'SELECT id FROM plugin_versions WHERE plugin_id = $1 AND version = $2',
        [pluginId, version]
      );

      if (existingVersion.rows.length > 0) {
        throw new Error(`Version ${version} already exists for this plugin`);
      }

      // Get current version
      const currentResult = await client.query(
        'SELECT version FROM plugins WHERE id = $1',
        [pluginId]
      );

      if (currentResult.rows.length === 0) {
        throw new Error('Plugin not found');
      }

      const currentVersion = currentResult.rows[0].version;

      // Ensure new version is greater than current
      if (semver.lte(version, currentVersion)) {
        throw new Error(`New version must be greater than current version (${currentVersion})`);
      }

      // Create version record
      const result = await client.query(
        `INSERT INTO plugin_versions
         (plugin_id, version, changelog, code, manifest, min_app_version, max_app_version,
          breaking_changes, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', NOW())
         RETURNING *`,
        [
          pluginId,
          version,
          changelog,
          code,
          JSON.stringify(manifest),
          minAppVersion || null,
          maxAppVersion || null,
          breaking_changes || false
        ]
      );

      await client.query('COMMIT');

      log.info(`[PluginVersioning] Created version ${version} for plugin ${pluginId}`);

      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      log.error('[PluginVersioning] Create version failed:', error.message);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Publish a version (make it available for updates)
   * @param {number} versionId - Version ID
   */
  async publishVersion(versionId) {
    const client = await db.connect();

    try {
      await client.query('BEGIN');

      // Get version details
      const versionResult = await client.query(
        'SELECT * FROM plugin_versions WHERE id = $1',
        [versionId]
      );

      if (versionResult.rows.length === 0) {
        throw new Error('Version not found');
      }

      const versionData = versionResult.rows[0];

      // Update version status
      await client.query(
        `UPDATE plugin_versions SET status = 'published', published_at = NOW() WHERE id = $1`,
        [versionId]
      );

      // Update plugin's current version
      await client.query(
        `UPDATE plugins
         SET version = $1, manifest = $2, updated_at = NOW()
         WHERE id = $3`,
        [versionData.version, versionData.manifest, versionData.plugin_id]
      );

      await client.query('COMMIT');

      log.info(`[PluginVersioning] Published version ${versionData.version}`);

      return { success: true };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get version history for a plugin
   * @param {number} pluginId - Plugin ID
   * @param {object} options - Query options
   */
  async getVersionHistory(pluginId, options = {}) {
    const { limit = 20, includeCode = false } = options;

    const selectFields = includeCode
      ? '*'
      : 'id, plugin_id, version, changelog, min_app_version, max_app_version, breaking_changes, status, created_at, published_at';

    const result = await db.query(
      `SELECT ${selectFields} FROM plugin_versions
       WHERE plugin_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [pluginId, limit]
    );

    return result.rows;
  }

  /**
   * Get specific version
   * @param {number} pluginId - Plugin ID
   * @param {string} version - Version string
   */
  async getVersion(pluginId, version) {
    const result = await db.query(
      'SELECT * FROM plugin_versions WHERE plugin_id = $1 AND version = $2',
      [pluginId, version]
    );

    return result.rows[0] || null;
  }

  /**
   * Check for available updates
   * @param {number} pluginId - Plugin ID
   * @param {string} currentVersion - Current installed version
   */
  async checkForUpdates(pluginId, currentVersion) {
    const result = await db.query(
      `SELECT version, changelog, breaking_changes, published_at
       FROM plugin_versions
       WHERE plugin_id = $1 AND status = 'published'
       ORDER BY published_at DESC
       LIMIT 1`,
      [pluginId]
    );

    if (result.rows.length === 0) {
      return { hasUpdate: false };
    }

    const latestVersion = result.rows[0];

    if (semver.gt(latestVersion.version, currentVersion)) {
      return {
        hasUpdate: true,
        currentVersion,
        latestVersion: latestVersion.version,
        changelog: latestVersion.changelog,
        hasBreakingChanges: latestVersion.breaking_changes,
        publishedAt: latestVersion.published_at,
        updateType: this.getUpdateType(currentVersion, latestVersion.version)
      };
    }

    return { hasUpdate: false };
  }

  /**
   * Get update type (major, minor, patch)
   * @param {string} from - Current version
   * @param {string} to - Target version
   */
  getUpdateType(from, to) {
    const fromParts = semver.parse(from);
    const toParts = semver.parse(to);

    if (toParts.major > fromParts.major) return 'major';
    if (toParts.minor > fromParts.minor) return 'minor';
    return 'patch';
  }

  /**
   * Update installed plugin to specific version
   * @param {number} pluginId - Plugin ID
   * @param {number} tenantId - Tenant ID
   * @param {string} targetVersion - Target version (optional, defaults to latest)
   */
  async updatePluginVersion(pluginId, tenantId, targetVersion = null) {
    const client = await db.connect();

    try {
      await client.query('BEGIN');

      // Get current installation
      const installResult = await client.query(
        'SELECT * FROM plugin_installations WHERE plugin_id = $1 AND tenant_id = $2',
        [pluginId, tenantId]
      );

      if (installResult.rows.length === 0) {
        throw new Error('Plugin is not installed');
      }

      const installation = installResult.rows[0];
      const currentVersion = installation.version;

      // Get target version (latest if not specified)
      let version;
      if (targetVersion) {
        const versionResult = await client.query(
          `SELECT * FROM plugin_versions
           WHERE plugin_id = $1 AND version = $2 AND status = 'published'`,
          [pluginId, targetVersion]
        );

        if (versionResult.rows.length === 0) {
          throw new Error(`Version ${targetVersion} not found or not published`);
        }

        version = versionResult.rows[0];
      } else {
        const latestResult = await client.query(
          `SELECT * FROM plugin_versions
           WHERE plugin_id = $1 AND status = 'published'
           ORDER BY published_at DESC LIMIT 1`,
          [pluginId]
        );

        if (latestResult.rows.length === 0) {
          throw new Error('No published versions available');
        }

        version = latestResult.rows[0];
      }

      // Check if already on this version
      if (currentVersion === version.version) {
        return { success: true, message: 'Already on this version' };
      }

      // Create update history record
      await client.query(
        `INSERT INTO plugin_update_history
         (plugin_id, tenant_id, from_version, to_version, status, created_at)
         VALUES ($1, $2, $3, $4, 'completed', NOW())`,
        [pluginId, tenantId, currentVersion, version.version]
      );

      // Update installation
      await client.query(
        `UPDATE plugin_installations
         SET version = $1, updated_at = NOW()
         WHERE plugin_id = $2 AND tenant_id = $3`,
        [version.version, pluginId, tenantId]
      );

      await client.query('COMMIT');

      log.info(`[PluginVersioning] Updated plugin ${pluginId} from ${currentVersion} to ${version.version}`);

      return {
        success: true,
        previousVersion: currentVersion,
        newVersion: version.version,
        changelog: version.changelog
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Rollback to a previous version
   * @param {number} pluginId - Plugin ID
   * @param {number} tenantId - Tenant ID
   * @param {string} targetVersion - Version to rollback to
   */
  async rollbackVersion(pluginId, tenantId, targetVersion) {
    const client = await db.connect();

    try {
      await client.query('BEGIN');

      // Verify target version exists
      const versionResult = await client.query(
        `SELECT * FROM plugin_versions
         WHERE plugin_id = $1 AND version = $2`,
        [pluginId, targetVersion]
      );

      if (versionResult.rows.length === 0) {
        throw new Error(`Version ${targetVersion} not found`);
      }

      // Get current installation
      const installResult = await client.query(
        'SELECT * FROM plugin_installations WHERE plugin_id = $1 AND tenant_id = $2',
        [pluginId, tenantId]
      );

      if (installResult.rows.length === 0) {
        throw new Error('Plugin is not installed');
      }

      const currentVersion = installResult.rows[0].version;

      // Create rollback record
      await client.query(
        `INSERT INTO plugin_update_history
         (plugin_id, tenant_id, from_version, to_version, status, is_rollback, created_at)
         VALUES ($1, $2, $3, $4, 'completed', true, NOW())`,
        [pluginId, tenantId, currentVersion, targetVersion]
      );

      // Update installation
      await client.query(
        `UPDATE plugin_installations
         SET version = $1, updated_at = NOW()
         WHERE plugin_id = $2 AND tenant_id = $3`,
        [targetVersion, pluginId, tenantId]
      );

      await client.query('COMMIT');

      log.info(`[PluginVersioning] Rolled back plugin ${pluginId} from ${currentVersion} to ${targetVersion}`);

      return {
        success: true,
        previousVersion: currentVersion,
        restoredVersion: targetVersion
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get update history for an installation
   * @param {number} pluginId - Plugin ID
   * @param {number} tenantId - Tenant ID
   */
  async getUpdateHistory(pluginId, tenantId) {
    const result = await db.query(
      `SELECT * FROM plugin_update_history
       WHERE plugin_id = $1 AND tenant_id = $2
       ORDER BY created_at DESC
       LIMIT 20`,
      [pluginId, tenantId]
    );

    return result.rows;
  }

  /**
   * Check version compatibility
   * @param {string} pluginVersion - Plugin version
   * @param {string} appVersion - Application version
   */
  async checkCompatibility(pluginVersion, appVersion) {
    const result = await db.query(
      `SELECT min_app_version, max_app_version FROM plugin_versions
       WHERE version = $1`,
      [pluginVersion]
    );

    if (result.rows.length === 0) {
      return { compatible: true, reason: 'No version constraints' };
    }

    const { min_app_version, max_app_version } = result.rows[0];

    if (min_app_version && semver.lt(appVersion, min_app_version)) {
      return {
        compatible: false,
        reason: `Requires app version ${min_app_version} or higher`
      };
    }

    if (max_app_version && semver.gt(appVersion, max_app_version)) {
      return {
        compatible: false,
        reason: `Not compatible with app version above ${max_app_version}`
      };
    }

    return { compatible: true };
  }

  /**
   * Get plugins with pending updates for a tenant
   * @param {number} tenantId - Tenant ID
   */
  async getPendingUpdates(tenantId) {
    const result = await db.query(
      `SELECT
        pi.plugin_id,
        p.name,
        p.icon_url,
        pi.version as installed_version,
        pv.version as latest_version,
        pv.changelog,
        pv.breaking_changes,
        pv.published_at
       FROM plugin_installations pi
       JOIN plugins p ON pi.plugin_id = p.id
       JOIN plugin_versions pv ON p.id = pv.plugin_id
       WHERE pi.tenant_id = $1
         AND pi.is_active = true
         AND pv.status = 'published'
         AND pv.published_at = (
           SELECT MAX(published_at)
           FROM plugin_versions
           WHERE plugin_id = p.id AND status = 'published'
         )
         AND pv.version != pi.version`,
      [tenantId]
    );

    return result.rows.filter(row =>
      semver.gt(row.latest_version, row.installed_version)
    );
  }

  /**
   * Deprecate a version
   * @param {number} versionId - Version ID
   * @param {string} reason - Deprecation reason
   */
  async deprecateVersion(versionId, reason) {
    await db.query(
      `UPDATE plugin_versions
       SET status = 'deprecated', deprecation_reason = $2, deprecated_at = NOW()
       WHERE id = $1`,
      [versionId, reason]
    );

    return { success: true };
  }

  /**
   * Compare two versions
   * @param {string} version1 - First version
   * @param {string} version2 - Second version
   */
  compareVersions(version1, version2) {
    return semver.compare(version1, version2);
  }

  /**
   * Get next version suggestions
   * @param {string} currentVersion - Current version
   */
  suggestNextVersions(currentVersion) {
    const current = semver.parse(currentVersion);

    return {
      patch: `${current.major}.${current.minor}.${current.patch + 1}`,
      minor: `${current.major}.${current.minor + 1}.0`,
      major: `${current.major + 1}.0.0`
    };
  }
}

module.exports = new PluginVersioning();
