/**
 * PluginDependencies - Plugin dependency resolution and management
 * Handles dependency graphs, version resolution, and conflict detection
 */

const db = require('../../db');
const log = require('../../utils/logger');
const semver = require('semver');

class PluginDependencies {
  constructor() {
    this.dependencyCache = new Map();
    this.resolutionCache = new Map();
  }

  /**
   * Resolve dependencies for a plugin
   * @param {number} pluginId - Plugin ID
   * @param {number} tenantId - Tenant ID (for checking installed plugins)
   * @returns {object} - Resolution result
   */
  async resolveDependencies(pluginId, tenantId) {
    const cacheKey = `${pluginId}_${tenantId}`;

    // Check cache
    if (this.resolutionCache.has(cacheKey)) {
      const cached = this.resolutionCache.get(cacheKey);
      if (Date.now() - cached.timestamp < 60000) { // 1 minute cache
        return cached.result;
      }
    }

    try {
      // Get plugin manifest
      const pluginResult = await db.query(
        'SELECT * FROM plugins WHERE id = $1',
        [pluginId]
      );

      if (pluginResult.rows.length === 0) {
        throw new Error('Plugin not found');
      }

      const plugin = pluginResult.rows[0];
      const manifest = typeof plugin.manifest === 'string'
        ? JSON.parse(plugin.manifest)
        : plugin.manifest || {};

      const dependencies = manifest.dependencies || {};

      // Get installed plugins for tenant
      const installedResult = await db.query(
        `SELECT pi.plugin_id, pi.version, p.slug
         FROM plugin_installations pi
         JOIN plugins p ON pi.plugin_id = p.id
         WHERE pi.tenant_id = $1 AND pi.is_active = true`,
        [tenantId]
      );

      const installed = new Map(
        installedResult.rows.map(row => [row.slug, { id: row.plugin_id, version: row.version }])
      );

      // Resolve each dependency
      const resolved = [];
      const missing = [];
      const conflicts = [];
      const toInstall = [];

      for (const [depSlug, versionRange] of Object.entries(dependencies)) {
        const installedDep = installed.get(depSlug);

        if (!installedDep) {
          // Check if available in marketplace
          const availableResult = await db.query(
            `SELECT id, version, name FROM plugins WHERE slug = $1 AND status = 'published'`,
            [depSlug]
          );

          if (availableResult.rows.length === 0) {
            missing.push({
              slug: depSlug,
              required: versionRange,
              reason: 'Not found in marketplace'
            });
          } else {
            const available = availableResult.rows[0];
            if (semver.satisfies(available.version, versionRange)) {
              toInstall.push({
                id: available.id,
                slug: depSlug,
                name: available.name,
                version: available.version,
                required: versionRange
              });
            } else {
              missing.push({
                slug: depSlug,
                required: versionRange,
                available: available.version,
                reason: 'Version mismatch'
              });
            }
          }
        } else {
          // Check version compatibility
          if (semver.satisfies(installedDep.version, versionRange)) {
            resolved.push({
              slug: depSlug,
              id: installedDep.id,
              version: installedDep.version,
              required: versionRange
            });
          } else {
            conflicts.push({
              slug: depSlug,
              installed: installedDep.version,
              required: versionRange,
              reason: 'Installed version incompatible'
            });
          }
        }
      }

      const result = {
        success: missing.length === 0 && conflicts.length === 0,
        resolved,
        missing,
        conflicts,
        toInstall,
        canAutoResolve: conflicts.length === 0 && missing.every(m => m.reason !== 'Not found in marketplace')
      };

      // Cache result
      this.resolutionCache.set(cacheKey, {
        timestamp: Date.now(),
        result
      });

      return result;
    } catch (error) {
      log.error('[PluginDependencies] Resolution failed:', error.message);
      throw error;
    }
  }

  /**
   * Build dependency graph for a plugin
   * @param {number} pluginId - Plugin ID
   * @returns {object} - Dependency graph
   */
  async buildDependencyGraph(pluginId) {
    const graph = {
      nodes: [],
      edges: [],
      root: pluginId
    };

    const visited = new Set();
    const queue = [pluginId];

    while (queue.length > 0) {
      const currentId = queue.shift();

      if (visited.has(currentId)) {
        continue;
      }
      visited.add(currentId);

      const pluginResult = await db.query(
        'SELECT id, name, slug, version, manifest FROM plugins WHERE id = $1',
        [currentId]
      );

      if (pluginResult.rows.length === 0) {
        continue;
      }

      const plugin = pluginResult.rows[0];
      const manifest = typeof plugin.manifest === 'string'
        ? JSON.parse(plugin.manifest)
        : plugin.manifest || {};

      graph.nodes.push({
        id: plugin.id,
        name: plugin.name,
        slug: plugin.slug,
        version: plugin.version
      });

      const dependencies = manifest.dependencies || {};

      for (const [depSlug, versionRange] of Object.entries(dependencies)) {
        const depResult = await db.query(
          'SELECT id FROM plugins WHERE slug = $1',
          [depSlug]
        );

        if (depResult.rows.length > 0) {
          const depId = depResult.rows[0].id;

          graph.edges.push({
            from: currentId,
            to: depId,
            version: versionRange
          });

          if (!visited.has(depId)) {
            queue.push(depId);
          }
        }
      }
    }

    return graph;
  }

  /**
   * Get plugins that depend on a specific plugin
   * @param {number} pluginId - Plugin ID
   * @returns {Array} - Dependent plugins
   */
  async getDependents(pluginId) {
    const pluginResult = await db.query(
      'SELECT slug FROM plugins WHERE id = $1',
      [pluginId]
    );

    if (pluginResult.rows.length === 0) {
      return [];
    }

    const pluginSlug = pluginResult.rows[0].slug;

    // Find all plugins that have this plugin as a dependency
    const result = await db.query(
      `SELECT id, name, slug, version, manifest
       FROM plugins
       WHERE status = 'published'`
    );

    const dependents = [];

    for (const plugin of result.rows) {
      const manifest = typeof plugin.manifest === 'string'
        ? JSON.parse(plugin.manifest)
        : plugin.manifest || {};

      const dependencies = manifest.dependencies || {};

      if (dependencies[pluginSlug]) {
        dependents.push({
          id: plugin.id,
          name: plugin.name,
          slug: plugin.slug,
          version: plugin.version,
          requiredVersion: dependencies[pluginSlug]
        });
      }
    }

    return dependents;
  }

  /**
   * Check if uninstalling a plugin would break dependencies
   * @param {number} pluginId - Plugin ID
   * @param {number} tenantId - Tenant ID
   * @returns {object} - Impact analysis
   */
  async checkUninstallImpact(pluginId, tenantId) {
    const dependents = await this.getDependents(pluginId);

    // Check which dependents are installed for this tenant
    const installedResult = await db.query(
      `SELECT plugin_id FROM plugin_installations
       WHERE tenant_id = $1 AND is_active = true`,
      [tenantId]
    );

    const installedIds = new Set(installedResult.rows.map(r => r.plugin_id));

    const affectedPlugins = dependents.filter(d => installedIds.has(d.id));

    return {
      canUninstall: affectedPlugins.length === 0,
      affectedPlugins,
      message: affectedPlugins.length > 0
        ? `Uninstalling will break ${affectedPlugins.length} dependent plugin(s): ${affectedPlugins.map(p => p.name).join(', ')}`
        : 'Safe to uninstall'
    };
  }

  /**
   * Auto-install missing dependencies
   * @param {number} pluginId - Plugin ID
   * @param {number} tenantId - Tenant ID
   * @param {object} options - Installation options
   */
  async autoInstallDependencies(pluginId, tenantId, options = {}) {
    const resolution = await this.resolveDependencies(pluginId, tenantId);

    if (resolution.missing.length > 0 || resolution.conflicts.length > 0) {
      throw new Error('Cannot auto-resolve: missing plugins or conflicts exist');
    }

    const installed = [];

    for (const dep of resolution.toInstall) {
      try {
        // Recursively resolve dependencies first
        await this.autoInstallDependencies(dep.id, tenantId, options);

        // Install the dependency
        await db.query(
          `INSERT INTO plugin_installations (plugin_id, tenant_id, version, is_active, installed_at)
           VALUES ($1, $2, $3, true, NOW())
           ON CONFLICT (plugin_id, tenant_id) DO UPDATE SET is_active = true`,
          [dep.id, tenantId, dep.version]
        );

        installed.push(dep);

        log.info(`[PluginDependencies] Auto-installed dependency: ${dep.name}`);
      } catch (error) {
        log.error(`[PluginDependencies] Failed to install dependency ${dep.name}:`, error.message);
        throw error;
      }
    }

    return {
      success: true,
      installed
    };
  }

  /**
   * Find the best version that satisfies all constraints
   * @param {string} pluginSlug - Plugin slug
   * @param {Array} constraints - Version constraints from different sources
   */
  async findBestVersion(pluginSlug, constraints) {
    // Get all available versions
    const result = await db.query(
      `SELECT pv.version, pv.status
       FROM plugin_versions pv
       JOIN plugins p ON pv.plugin_id = p.id
       WHERE p.slug = $1 AND pv.status = 'published'
       ORDER BY pv.published_at DESC`,
      [pluginSlug]
    );

    const versions = result.rows.map(r => r.version);

    // Find versions that satisfy all constraints
    const satisfying = versions.filter(v =>
      constraints.every(c => semver.satisfies(v, c))
    );

    if (satisfying.length === 0) {
      return null;
    }

    // Return the highest satisfying version
    return satisfying.sort(semver.rcompare)[0];
  }

  /**
   * Detect circular dependencies
   * @param {number} pluginId - Plugin ID
   * @returns {object} - Circular dependency detection result
   */
  async detectCircularDependencies(pluginId) {
    const visited = new Set();
    const recursionStack = new Set();
    const path = [];
    let hasCycle = false;
    let cyclePath = null;

    const dfs = async (currentId) => {
      visited.add(currentId);
      recursionStack.add(currentId);
      path.push(currentId);

      const pluginResult = await db.query(
        'SELECT manifest, slug FROM plugins WHERE id = $1',
        [currentId]
      );

      if (pluginResult.rows.length === 0) {
        path.pop();
        recursionStack.delete(currentId);
        return;
      }

      const manifest = typeof pluginResult.rows[0].manifest === 'string'
        ? JSON.parse(pluginResult.rows[0].manifest)
        : pluginResult.rows[0].manifest || {};

      const dependencies = Object.keys(manifest.dependencies || {});

      for (const depSlug of dependencies) {
        const depResult = await db.query(
          'SELECT id FROM plugins WHERE slug = $1',
          [depSlug]
        );

        if (depResult.rows.length > 0) {
          const depId = depResult.rows[0].id;

          if (recursionStack.has(depId)) {
            hasCycle = true;
            const cycleStart = path.indexOf(depId);
            cyclePath = path.slice(cycleStart);
            cyclePath.push(depId);
            return;
          }

          if (!visited.has(depId)) {
            await dfs(depId);
            if (hasCycle) return;
          }
        }
      }

      path.pop();
      recursionStack.delete(currentId);
    };

    await dfs(pluginId);

    return {
      hasCycle,
      cyclePath: cyclePath ? await this.getPluginNames(cyclePath) : null
    };
  }

  /**
   * Get plugin names from IDs
   * @param {Array} ids - Plugin IDs
   */
  async getPluginNames(ids) {
    const result = await db.query(
      'SELECT id, name FROM plugins WHERE id = ANY($1)',
      [ids]
    );

    const nameMap = new Map(result.rows.map(r => [r.id, r.name]));
    return ids.map(id => nameMap.get(id) || `Unknown (${id})`);
  }

  /**
   * Clear resolution cache
   */
  clearCache() {
    this.dependencyCache.clear();
    this.resolutionCache.clear();
  }

  /**
   * Get dependency tree as hierarchical structure
   * @param {number} pluginId - Plugin ID
   * @param {number} depth - Maximum depth (default: 5)
   */
  async getDependencyTree(pluginId, depth = 5) {
    const buildTree = async (id, currentDepth) => {
      if (currentDepth >= depth) {
        return { truncated: true };
      }

      const pluginResult = await db.query(
        'SELECT id, name, slug, version, manifest FROM plugins WHERE id = $1',
        [id]
      );

      if (pluginResult.rows.length === 0) {
        return null;
      }

      const plugin = pluginResult.rows[0];
      const manifest = typeof plugin.manifest === 'string'
        ? JSON.parse(plugin.manifest)
        : plugin.manifest || {};

      const dependencies = manifest.dependencies || {};
      const children = [];

      for (const [depSlug, versionRange] of Object.entries(dependencies)) {
        const depResult = await db.query(
          'SELECT id FROM plugins WHERE slug = $1',
          [depSlug]
        );

        if (depResult.rows.length > 0) {
          const child = await buildTree(depResult.rows[0].id, currentDepth + 1);
          if (child) {
            child.requiredVersion = versionRange;
            children.push(child);
          }
        } else {
          children.push({
            slug: depSlug,
            requiredVersion: versionRange,
            notFound: true
          });
        }
      }

      return {
        id: plugin.id,
        name: plugin.name,
        slug: plugin.slug,
        version: plugin.version,
        dependencies: children
      };
    };

    return buildTree(pluginId, 0);
  }
}

module.exports = new PluginDependencies();
