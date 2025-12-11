/**
 * Tools Core Index Tests
 * Tests for server/tools/core/index.js
 */

describe('Tools Core Index', () => {
  let toolsCore;

  beforeEach(() => {
    jest.resetModules();
    // Clear require cache to get fresh instances
    delete require.cache[require.resolve('../../../tools/core/index')];
    delete require.cache[require.resolve('../../../tools/core/ToolRegistry')];
    delete require.cache[require.resolve('../../../tools/core/ToolExecutor')];
  });

  it('should export ToolRegistry class', () => {
    toolsCore = require('../../../tools/core/index');
    expect(toolsCore.ToolRegistry).toBeDefined();
    expect(typeof toolsCore.ToolRegistry).toBe('function');
  });

  it('should export ToolExecutor class', () => {
    toolsCore = require('../../../tools/core/index');
    expect(toolsCore.ToolExecutor).toBeDefined();
    expect(typeof toolsCore.ToolExecutor).toBe('function');
  });

  it('should export toolRegistry singleton instance', () => {
    toolsCore = require('../../../tools/core/index');
    expect(toolsCore.toolRegistry).toBeDefined();
    expect(toolsCore.toolRegistry).toBeInstanceOf(toolsCore.ToolRegistry);
  });

  it('should export toolExecutor singleton instance', () => {
    toolsCore = require('../../../tools/core/index');
    expect(toolsCore.toolExecutor).toBeDefined();
    expect(toolsCore.toolExecutor).toBeInstanceOf(toolsCore.ToolExecutor);
  });

  it('should return same singleton instances on multiple requires', () => {
    const firstImport = require('../../../tools/core/index');
    const secondImport = require('../../../tools/core/index');

    expect(firstImport.toolRegistry).toBe(secondImport.toolRegistry);
    expect(firstImport.toolExecutor).toBe(secondImport.toolExecutor);
  });

  it('should allow creating new instances from classes', () => {
    toolsCore = require('../../../tools/core/index');
    const newRegistry = new toolsCore.ToolRegistry();
    const newExecutor = new toolsCore.ToolExecutor();

    expect(newRegistry).toBeInstanceOf(toolsCore.ToolRegistry);
    expect(newExecutor).toBeInstanceOf(toolsCore.ToolExecutor);
    expect(newRegistry).not.toBe(toolsCore.toolRegistry);
    expect(newExecutor).not.toBe(toolsCore.toolExecutor);
  });
});
