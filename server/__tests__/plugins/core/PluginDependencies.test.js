/**
 * PluginDependencies Tests
 * Tests for plugin dependency resolution and management
 */

jest.mock('../../../db', () => ({
  query: jest.fn()
}));

jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

const db = require('../../../db');
const PluginDependencies = require('../../../plugins/core/PluginDependencies');

describe('PluginDependencies', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    PluginDependencies.clearCache();
  });

  describe('resolveDependencies', () => {
    it('should return cached result if within cache window', async () => {
      // First call to populate cache
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, manifest: JSON.stringify({ dependencies: {} }) }] })
        .mockResolvedValueOnce({ rows: [] });

      const result1 = await PluginDependencies.resolveDependencies(1, 100);

      // Second call should use cache
      const result2 = await PluginDependencies.resolveDependencies(1, 100);

      expect(result1).toEqual(result2);
      // DB should only be called once for each unique query in the first call
      expect(db.query).toHaveBeenCalledTimes(2);
    });

    it('should throw error if plugin not found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await expect(PluginDependencies.resolveDependencies(999, 100))
        .rejects.toThrow('Plugin not found');
    });

    it('should resolve dependencies with all installed', async () => {
      const manifest = { dependencies: { 'helper-plugin': '^1.0.0' } };

      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, manifest: JSON.stringify(manifest) }] })
        .mockResolvedValueOnce({ rows: [{ plugin_id: 2, version: '1.2.0', slug: 'helper-plugin' }] });

      const result = await PluginDependencies.resolveDependencies(1, 100);

      expect(result.success).toBe(true);
      expect(result.resolved).toHaveLength(1);
      expect(result.resolved[0].slug).toBe('helper-plugin');
      expect(result.missing).toHaveLength(0);
      expect(result.conflicts).toHaveLength(0);
    });

    it('should detect missing dependencies available in marketplace', async () => {
      const manifest = { dependencies: { 'new-plugin': '^2.0.0' } };

      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, manifest: JSON.stringify(manifest) }] })
        .mockResolvedValueOnce({ rows: [] }) // No installed plugins
        .mockResolvedValueOnce({ rows: [{ id: 3, version: '2.1.0', name: 'New Plugin' }] }); // Available in marketplace

      const result = await PluginDependencies.resolveDependencies(1, 100);

      expect(result.success).toBe(true);
      expect(result.toInstall).toHaveLength(1);
      expect(result.toInstall[0].slug).toBe('new-plugin');
      expect(result.canAutoResolve).toBe(true);
    });

    it('should detect missing dependencies not in marketplace', async () => {
      const manifest = { dependencies: { 'unknown-plugin': '^1.0.0' } };

      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, manifest }] })
        .mockResolvedValueOnce({ rows: [] }) // No installed plugins
        .mockResolvedValueOnce({ rows: [] }); // Not in marketplace

      const result = await PluginDependencies.resolveDependencies(1, 100);

      expect(result.success).toBe(false);
      expect(result.missing).toHaveLength(1);
      expect(result.missing[0].reason).toBe('Not found in marketplace');
      expect(result.canAutoResolve).toBe(false);
    });

    it('should detect version mismatch in marketplace', async () => {
      const manifest = { dependencies: { 'old-plugin': '^3.0.0' } };

      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, manifest: JSON.stringify(manifest) }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: 4, version: '2.0.0', name: 'Old Plugin' }] }); // Version too old

      const result = await PluginDependencies.resolveDependencies(1, 100);

      expect(result.success).toBe(false);
      expect(result.missing).toHaveLength(1);
      expect(result.missing[0].reason).toBe('Version mismatch');
    });

    it('should detect version conflicts with installed plugins', async () => {
      const manifest = { dependencies: { 'helper-plugin': '^2.0.0' } };

      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, manifest: JSON.stringify(manifest) }] })
        .mockResolvedValueOnce({ rows: [{ plugin_id: 2, version: '1.0.0', slug: 'helper-plugin' }] }); // Installed but wrong version

      const result = await PluginDependencies.resolveDependencies(1, 100);

      expect(result.success).toBe(false);
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].reason).toBe('Installed version incompatible');
    });

    it('should handle manifest as object', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, manifest: { dependencies: {} } }] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await PluginDependencies.resolveDependencies(1, 100);

      expect(result.success).toBe(true);
    });

    it('should handle null manifest', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, manifest: null }] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await PluginDependencies.resolveDependencies(1, 100);

      expect(result.success).toBe(true);
      expect(result.resolved).toHaveLength(0);
    });
  });

  describe('buildDependencyGraph', () => {
    it('should build graph for plugin with no dependencies', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, name: 'Test Plugin', slug: 'test-plugin', version: '1.0.0', manifest: '{}' }]
      });

      const graph = await PluginDependencies.buildDependencyGraph(1);

      expect(graph.root).toBe(1);
      expect(graph.nodes).toHaveLength(1);
      expect(graph.edges).toHaveLength(0);
    });

    it('should build graph with dependencies', async () => {
      const mainManifest = { dependencies: { 'helper': '^1.0.0' } };

      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Main', slug: 'main', version: '1.0.0', manifest: JSON.stringify(mainManifest) }] })
        .mockResolvedValueOnce({ rows: [{ id: 2 }] }) // Find helper by slug
        .mockResolvedValueOnce({ rows: [{ id: 2, name: 'Helper', slug: 'helper', version: '1.0.0', manifest: '{}' }] });

      const graph = await PluginDependencies.buildDependencyGraph(1);

      expect(graph.nodes).toHaveLength(2);
      expect(graph.edges).toHaveLength(1);
      expect(graph.edges[0]).toEqual({ from: 1, to: 2, version: '^1.0.0' });
    });

    it('should handle missing plugins in graph', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const graph = await PluginDependencies.buildDependencyGraph(999);

      expect(graph.nodes).toHaveLength(0);
      expect(graph.edges).toHaveLength(0);
    });

    it('should not revisit already visited nodes', async () => {
      const manifest = { dependencies: { 'shared': '^1.0.0' } };

      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Main', slug: 'main', version: '1.0.0', manifest: JSON.stringify(manifest) }] })
        .mockResolvedValueOnce({ rows: [{ id: 2 }] })
        .mockResolvedValueOnce({ rows: [{ id: 2, name: 'Shared', slug: 'shared', version: '1.0.0', manifest: '{}' }] });

      const graph = await PluginDependencies.buildDependencyGraph(1);

      expect(graph.nodes).toHaveLength(2);
    });
  });

  describe('getDependents', () => {
    it('should return empty array if plugin not found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const result = await PluginDependencies.getDependents(999);

      expect(result).toEqual([]);
    });

    it('should find plugins that depend on target', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ slug: 'helper-plugin' }] }) // Get target slug
        .mockResolvedValueOnce({
          rows: [
            { id: 1, name: 'Main Plugin', slug: 'main', version: '1.0.0', manifest: JSON.stringify({ dependencies: { 'helper-plugin': '^1.0.0' } }) },
            { id: 2, name: 'Other Plugin', slug: 'other', version: '2.0.0', manifest: '{}' }
          ]
        });

      const result = await PluginDependencies.getDependents(10);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Main Plugin');
      expect(result[0].requiredVersion).toBe('^1.0.0');
    });

    it('should handle manifest as object', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ slug: 'target' }] })
        .mockResolvedValueOnce({
          rows: [
            { id: 1, name: 'Dependent', slug: 'dependent', version: '1.0.0', manifest: { dependencies: { 'target': '^1.0.0' } } }
          ]
        });

      const result = await PluginDependencies.getDependents(1);

      expect(result).toHaveLength(1);
    });
  });

  describe('checkUninstallImpact', () => {
    it('should allow uninstall when no dependents', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ slug: 'safe-plugin' }] })
        .mockResolvedValueOnce({ rows: [] }) // No plugins depend on it
        .mockResolvedValueOnce({ rows: [] }); // No installations

      const result = await PluginDependencies.checkUninstallImpact(1, 100);

      expect(result.canUninstall).toBe(true);
      expect(result.affectedPlugins).toHaveLength(0);
      expect(result.message).toBe('Safe to uninstall');
    });

    it('should block uninstall when dependents are installed', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ slug: 'core-plugin' }] })
        .mockResolvedValueOnce({
          rows: [
            { id: 2, name: 'Dependent Plugin', slug: 'dependent', version: '1.0.0', manifest: JSON.stringify({ dependencies: { 'core-plugin': '^1.0.0' } }) }
          ]
        })
        .mockResolvedValueOnce({ rows: [{ plugin_id: 2 }] }); // Dependent is installed

      const result = await PluginDependencies.checkUninstallImpact(1, 100);

      expect(result.canUninstall).toBe(false);
      expect(result.affectedPlugins).toHaveLength(1);
      expect(result.message).toContain('Dependent Plugin');
    });
  });

  describe('autoInstallDependencies', () => {
    it('should throw error if missing plugins exist', async () => {
      const manifest = { dependencies: { 'missing': '^1.0.0' } };

      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, manifest: JSON.stringify(manifest) }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] }); // Not in marketplace

      await expect(PluginDependencies.autoInstallDependencies(1, 100))
        .rejects.toThrow('Cannot auto-resolve');
    });

    it('should throw error if conflicts exist', async () => {
      const manifest = { dependencies: { 'helper': '^2.0.0' } };

      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, manifest: JSON.stringify(manifest) }] })
        .mockResolvedValueOnce({ rows: [{ plugin_id: 2, version: '1.0.0', slug: 'helper' }] }); // Wrong version

      await expect(PluginDependencies.autoInstallDependencies(1, 100))
        .rejects.toThrow('Cannot auto-resolve');
    });

    it('should install available dependencies', async () => {
      const manifest = { dependencies: { 'new-dep': '^1.0.0' } };

      // First resolution
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, manifest: JSON.stringify(manifest) }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: 3, version: '1.0.0', name: 'New Dep' }] })
        // Recursive resolution for dep (no deps)
        .mockResolvedValueOnce({ rows: [{ id: 3, manifest: '{}' }] })
        .mockResolvedValueOnce({ rows: [] })
        // Install
        .mockResolvedValueOnce({ rows: [] });

      const result = await PluginDependencies.autoInstallDependencies(1, 100);

      expect(result.success).toBe(true);
      expect(result.installed).toHaveLength(1);
    });
  });

  describe('findBestVersion', () => {
    it('should return null if no versions available', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const result = await PluginDependencies.findBestVersion('plugin', ['^1.0.0']);

      expect(result).toBeNull();
    });

    it('should return null if no version satisfies constraints', async () => {
      db.query.mockResolvedValue({
        rows: [{ version: '1.0.0', status: 'published' }, { version: '1.1.0', status: 'published' }]
      });

      const result = await PluginDependencies.findBestVersion('plugin', ['^2.0.0']);

      expect(result).toBeNull();
    });

    it('should return highest version satisfying all constraints', async () => {
      db.query.mockResolvedValue({
        rows: [
          { version: '2.0.0', status: 'published' },
          { version: '1.5.0', status: 'published' },
          { version: '1.0.0', status: 'published' }
        ]
      });

      const result = await PluginDependencies.findBestVersion('plugin', ['^1.0.0', '<2.0.0']);

      expect(result).toBe('1.5.0');
    });
  });

  describe('detectCircularDependencies', () => {
    it('should detect no cycle for independent plugins', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ manifest: '{}', slug: 'plugin-a' }] });

      const result = await PluginDependencies.detectCircularDependencies(1);

      expect(result.hasCycle).toBe(false);
      expect(result.cyclePath).toBeNull();
    });

    it('should detect self-reference cycle', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ manifest: JSON.stringify({ dependencies: { 'plugin-a': '^1.0.0' } }), slug: 'plugin-a' }] })
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }); // Self-reference

      const result = await PluginDependencies.detectCircularDependencies(1);

      expect(result.hasCycle).toBe(true);
    });

    it('should detect cycle in chain A -> B -> A', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ manifest: JSON.stringify({ dependencies: { 'plugin-b': '^1.0.0' } }), slug: 'plugin-a' }] })
        .mockResolvedValueOnce({ rows: [{ id: 2 }] }) // Find B
        .mockResolvedValueOnce({ rows: [{ manifest: JSON.stringify({ dependencies: { 'plugin-a': '^1.0.0' } }), slug: 'plugin-b' }] })
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // Find A (back to start)
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Plugin A' }, { id: 2, name: 'Plugin B' }] }); // Get names

      const result = await PluginDependencies.detectCircularDependencies(1);

      expect(result.hasCycle).toBe(true);
    });

    it('should handle plugin not found during DFS', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ manifest: JSON.stringify({ dependencies: { 'missing': '^1.0.0' } }), slug: 'plugin-a' }] })
        .mockResolvedValueOnce({ rows: [] }); // Missing plugin

      const result = await PluginDependencies.detectCircularDependencies(1);

      expect(result.hasCycle).toBe(false);
    });
  });

  describe('getPluginNames', () => {
    it('should return plugin names', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, name: 'Plugin A' }, { id: 2, name: 'Plugin B' }]
      });

      const result = await PluginDependencies.getPluginNames([1, 2]);

      expect(result).toEqual(['Plugin A', 'Plugin B']);
    });

    it('should handle unknown IDs', async () => {
      db.query.mockResolvedValue({ rows: [{ id: 1, name: 'Plugin A' }] });

      const result = await PluginDependencies.getPluginNames([1, 999]);

      expect(result).toEqual(['Plugin A', 'Unknown (999)']);
    });
  });

  describe('clearCache', () => {
    it('should clear both caches', () => {
      PluginDependencies.dependencyCache.set('key', 'value');
      PluginDependencies.resolutionCache.set('key', 'value');

      PluginDependencies.clearCache();

      expect(PluginDependencies.dependencyCache.size).toBe(0);
      expect(PluginDependencies.resolutionCache.size).toBe(0);
    });
  });

  describe('getDependencyTree', () => {
    it('should return null for non-existent plugin', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const result = await PluginDependencies.getDependencyTree(999);

      expect(result).toBeNull();
    });

    it('should build tree for plugin with no dependencies', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, name: 'Root', slug: 'root', version: '1.0.0', manifest: '{}' }]
      });

      const tree = await PluginDependencies.getDependencyTree(1);

      expect(tree.id).toBe(1);
      expect(tree.name).toBe('Root');
      expect(tree.dependencies).toHaveLength(0);
    });

    it('should build tree with nested dependencies', async () => {
      const rootManifest = { dependencies: { 'child': '^1.0.0' } };

      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Root', slug: 'root', version: '1.0.0', manifest: JSON.stringify(rootManifest) }] })
        .mockResolvedValueOnce({ rows: [{ id: 2 }] })
        .mockResolvedValueOnce({ rows: [{ id: 2, name: 'Child', slug: 'child', version: '1.0.0', manifest: '{}' }] });

      const tree = await PluginDependencies.getDependencyTree(1);

      expect(tree.dependencies).toHaveLength(1);
      expect(tree.dependencies[0].name).toBe('Child');
      expect(tree.dependencies[0].requiredVersion).toBe('^1.0.0');
    });

    it('should truncate at max depth', async () => {
      const manifest = { dependencies: { 'deep': '^1.0.0' } };

      // Build deep chain
      db.query.mockImplementation((query, params) => {
        if (query.includes('SELECT id FROM plugins WHERE slug')) {
          return Promise.resolve({ rows: [{ id: params[0] === 'deep' ? 2 : 3 }] });
        }
        return Promise.resolve({
          rows: [{ id: 1, name: 'Plugin', slug: 'plugin', version: '1.0.0', manifest: JSON.stringify(manifest) }]
        });
      });

      const tree = await PluginDependencies.getDependencyTree(1, 1);

      expect(tree.dependencies[0].truncated).toBe(true);
    });

    it('should mark not found dependencies', async () => {
      const manifest = { dependencies: { 'missing': '^1.0.0' } };

      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Root', slug: 'root', version: '1.0.0', manifest: JSON.stringify(manifest) }] })
        .mockResolvedValueOnce({ rows: [] }); // Missing dependency

      const tree = await PluginDependencies.getDependencyTree(1);

      expect(tree.dependencies).toHaveLength(1);
      expect(tree.dependencies[0].slug).toBe('missing');
      expect(tree.dependencies[0].notFound).toBe(true);
    });
  });
});
