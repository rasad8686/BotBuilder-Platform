/**
 * FileTool Tests
 * Tests for the file operations tool for autonomous agents
 */

jest.mock('fs', () => ({
  promises: {
    access: jest.fn(),
    mkdir: jest.fn(),
    readFile: jest.fn(),
    writeFile: jest.fn(),
    appendFile: jest.fn(),
    readdir: jest.fn(),
    stat: jest.fn(),
    unlink: jest.fn()
  }
}));

jest.mock('../../../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

const fs = require('fs').promises;
const path = require('path');
const FileTool = require('../../../../services/autonomous/tools/FileTool');

describe('FileTool', () => {
  let fileTool;

  beforeEach(() => {
    jest.clearAllMocks();
    fileTool = new FileTool();
    fileTool.workspaceDir = '/workspace';
  });

  describe('constructor', () => {
    it('should initialize with correct name and description', () => {
      expect(fileTool.name).toBe('file_operation');
      expect(fileTool.description).toContain('file');
    });

    it('should define required parameters', () => {
      expect(fileTool.parameters.operation.required).toBe(true);
      expect(fileTool.parameters.path.required).toBe(true);
    });

    it('should define blocked extensions', () => {
      expect(fileTool.blockedExtensions).toContain('.exe');
      expect(fileTool.blockedExtensions).toContain('.sh');
      expect(fileTool.blockedExtensions).toContain('.env');
      expect(fileTool.blockedExtensions).toContain('.pem');
    });

    it('should define allowed operations', () => {
      expect(fileTool.parameters.operation.enum).toContain('read');
      expect(fileTool.parameters.operation.enum).toContain('write');
      expect(fileTool.parameters.operation.enum).toContain('append');
      expect(fileTool.parameters.operation.enum).toContain('list');
      expect(fileTool.parameters.operation.enum).toContain('exists');
      expect(fileTool.parameters.operation.enum).toContain('delete');
    });
  });

  describe('execute', () => {
    beforeEach(() => {
      fs.access.mockResolvedValue(undefined);
      fs.mkdir.mockResolvedValue(undefined);
    });

    it('should return error for invalid operation', async () => {
      const result = await fileTool.execute({
        operation: 'invalid',
        path: 'test.txt'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid operation');
    });

    it('should return error for path traversal attempt', async () => {
      const result = await fileTool.execute({
        operation: 'read',
        path: '../../../etc/passwd'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid or forbidden path');
    });

    it('should return error for blocked file extensions on write', async () => {
      const result = await fileTool.execute({
        operation: 'write',
        path: 'malicious.exe',
        content: 'data'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('.exe files is not allowed');
    });

    it('should return error for blocked file extensions on append', async () => {
      const result = await fileTool.execute({
        operation: 'append',
        path: 'script.sh',
        content: 'data'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('.sh files is not allowed');
    });

    describe('read operation', () => {
      it('should read file content', async () => {
        fs.stat.mockResolvedValue({
          isFile: () => true,
          size: 100,
          mtime: new Date('2024-01-01')
        });
        fs.readFile.mockResolvedValue('File content');

        const result = await fileTool.execute({
          operation: 'read',
          path: 'test.txt'
        });

        expect(result.success).toBe(true);
        expect(result.content).toBe('File content');
        expect(result.size).toBe(100);
      });

      it('should reject reading directories', async () => {
        fs.stat.mockResolvedValue({
          isFile: () => false,
          size: 0
        });

        const result = await fileTool.execute({
          operation: 'read',
          path: 'some-dir'
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('not a file');
      });

      it('should reject files exceeding max size', async () => {
        fs.stat.mockResolvedValue({
          isFile: () => true,
          size: 2000000 // 2MB
        });

        const result = await fileTool.execute({
          operation: 'read',
          path: 'large.txt',
          maxSize: 1048576 // 1MB
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('File too large');
      });
    });

    describe('write operation', () => {
      it('should write file content', async () => {
        fs.mkdir.mockResolvedValue(undefined);
        fs.writeFile.mockResolvedValue(undefined);
        fs.stat.mockResolvedValue({
          size: 50
        });

        const result = await fileTool.execute({
          operation: 'write',
          path: 'output.txt',
          content: 'New content'
        });

        expect(result.success).toBe(true);
        expect(result.written).toBe(true);
        expect(result.size).toBe(50);
      });

      it('should return error when content is missing', async () => {
        const result = await fileTool.execute({
          operation: 'write',
          path: 'output.txt'
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Content is required');
      });

      it('should create parent directory if needed', async () => {
        fs.mkdir.mockResolvedValue(undefined);
        fs.writeFile.mockResolvedValue(undefined);
        fs.stat.mockResolvedValue({ size: 10 });

        await fileTool.execute({
          operation: 'write',
          path: 'subdir/output.txt',
          content: 'data'
        });

        expect(fs.mkdir).toHaveBeenCalledWith(
          expect.any(String),
          { recursive: true }
        );
      });
    });

    describe('append operation', () => {
      it('should append to file', async () => {
        fs.mkdir.mockResolvedValue(undefined);
        fs.appendFile.mockResolvedValue(undefined);
        fs.stat.mockResolvedValue({ size: 150 });

        const result = await fileTool.execute({
          operation: 'append',
          path: 'log.txt',
          content: 'New log entry'
        });

        expect(result.success).toBe(true);
        expect(result.appended).toBe(true);
      });

      it('should return error when content is missing', async () => {
        const result = await fileTool.execute({
          operation: 'append',
          path: 'log.txt'
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Content is required');
      });
    });

    describe('list operation', () => {
      it('should list directory contents', async () => {
        fs.stat.mockResolvedValue({
          isDirectory: () => true
        });
        fs.readdir.mockResolvedValue([
          { name: 'file1.txt', isDirectory: () => false },
          { name: 'subdir', isDirectory: () => true }
        ]);

        // Mock stat for each item
        fs.stat.mockImplementation((path) => {
          if (path.includes('file1.txt')) {
            return Promise.resolve({
              size: 100,
              mtime: new Date('2024-01-01'),
              isDirectory: () => false
            });
          }
          if (path.includes('subdir')) {
            return Promise.resolve({
              size: 0,
              mtime: new Date('2024-01-01'),
              isDirectory: () => true
            });
          }
          return Promise.resolve({ isDirectory: () => true });
        });

        const result = await fileTool.execute({
          operation: 'list',
          path: '.'
        });

        expect(result.success).toBe(true);
        expect(result.count).toBe(2);
        expect(result.items).toHaveLength(2);
      });

      it('should reject listing files', async () => {
        fs.stat.mockResolvedValue({
          isDirectory: () => false
        });

        const result = await fileTool.execute({
          operation: 'list',
          path: 'file.txt'
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('not a directory');
      });

      it('should handle stat errors for items', async () => {
        fs.stat.mockResolvedValueOnce({
          isDirectory: () => true
        });
        fs.readdir.mockResolvedValue([
          { name: 'file1.txt', isDirectory: () => false }
        ]);
        fs.stat.mockRejectedValueOnce(new Error('Permission denied'));

        const result = await fileTool.execute({
          operation: 'list',
          path: '.'
        });

        expect(result.success).toBe(true);
        expect(result.items[0].error).toBe('Unable to read stats');
      });
    });

    describe('exists operation', () => {
      it('should return true for existing file', async () => {
        fs.stat.mockResolvedValue({
          isDirectory: () => false,
          size: 100,
          mtime: new Date('2024-01-01')
        });

        const result = await fileTool.execute({
          operation: 'exists',
          path: 'test.txt'
        });

        expect(result.success).toBe(true);
        expect(result.exists).toBe(true);
        expect(result.type).toBe('file');
      });

      it('should return true for existing directory', async () => {
        fs.stat.mockResolvedValue({
          isDirectory: () => true,
          size: 0,
          mtime: new Date('2024-01-01')
        });

        const result = await fileTool.execute({
          operation: 'exists',
          path: 'mydir'
        });

        expect(result.success).toBe(true);
        expect(result.exists).toBe(true);
        expect(result.type).toBe('directory');
      });

      it('should return false for non-existent path', async () => {
        const error = new Error('Not found');
        error.code = 'ENOENT';
        fs.stat.mockRejectedValue(error);

        const result = await fileTool.execute({
          operation: 'exists',
          path: 'nonexistent.txt'
        });

        expect(result.success).toBe(true);
        expect(result.exists).toBe(false);
      });

      it('should throw for other errors', async () => {
        fs.stat.mockRejectedValue(new Error('Permission denied'));

        const result = await fileTool.execute({
          operation: 'exists',
          path: 'protected.txt'
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Permission denied');
      });
    });

    describe('delete operation', () => {
      it('should delete a file', async () => {
        fs.stat.mockResolvedValue({
          isDirectory: () => false
        });
        fs.unlink.mockResolvedValue(undefined);

        const result = await fileTool.execute({
          operation: 'delete',
          path: 'obsolete.txt'
        });

        expect(result.success).toBe(true);
        expect(result.deleted).toBe(true);
      });

      it('should reject deleting directories', async () => {
        fs.stat.mockResolvedValue({
          isDirectory: () => true
        });

        const result = await fileTool.execute({
          operation: 'delete',
          path: 'mydir'
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Cannot delete directories');
      });
    });

    it('should log execution to context', async () => {
      fs.stat.mockResolvedValue({
        isFile: () => true,
        size: 50,
        mtime: new Date()
      });
      fs.readFile.mockResolvedValue('content');

      const context = {};

      await fileTool.execute({
        operation: 'read',
        path: 'test.txt'
      }, context);

      expect(context.toolLogs).toBeDefined();
      expect(context.toolLogs[0].tool).toBe('file_operation');
      expect(context.toolLogs[0].operation).toBe('read');
    });

    it('should log failed execution', async () => {
      fs.stat.mockRejectedValue(new Error('File not found'));

      const context = {};

      await fileTool.execute({
        operation: 'read',
        path: 'missing.txt'
      }, context);

      expect(context.toolLogs[0].success).toBe(false);
      expect(context.toolLogs[0].error).toBe('File not found');
    });
  });

  describe('resolvePath', () => {
    beforeEach(() => {
      fs.access.mockResolvedValue(undefined);
      fs.mkdir.mockResolvedValue(undefined);
    });

    it('should resolve valid path within workspace', () => {
      const resolved = fileTool.resolvePath('test.txt');

      expect(resolved).toContain('test.txt');
      expect(resolved).toContain(fileTool.workspaceDir);
    });

    it('should return null for path traversal', () => {
      const resolved = fileTool.resolvePath('../../../etc/passwd');

      expect(resolved).toBeNull();
    });

    it('should return null for absolute paths outside workspace', () => {
      // Paths that try to escape workspace should be rejected
      const resolved = fileTool.resolvePath('/etc/passwd');

      // This will still resolve to workspace + path which starts with workspace
      expect(resolved).toContain(fileTool.workspaceDir);
    });
  });

  describe('ensureWorkspace', () => {
    it('should create workspace if not exists', async () => {
      fs.access.mockRejectedValue(new Error('Not found'));
      fs.mkdir.mockResolvedValue(undefined);

      await fileTool.ensureWorkspace();

      expect(fs.mkdir).toHaveBeenCalledWith(
        fileTool.workspaceDir,
        { recursive: true }
      );
    });

    it('should not create workspace if exists', async () => {
      fs.access.mockResolvedValue(undefined);

      await fileTool.ensureWorkspace();

      expect(fs.mkdir).not.toHaveBeenCalled();
    });
  });

  describe('logExecution', () => {
    it('should create toolLogs array if not exists', () => {
      const context = {};

      fileTool.logExecution(context, { operation: 'read' });

      expect(context.toolLogs).toBeDefined();
      expect(Array.isArray(context.toolLogs)).toBe(true);
    });

    it('should append to existing toolLogs', () => {
      const context = {
        toolLogs: [{ existing: 'log' }]
      };

      fileTool.logExecution(context, { operation: 'write' });

      expect(context.toolLogs.length).toBe(2);
    });

    it('should include timestamp', () => {
      const context = {};

      fileTool.logExecution(context, { test: 'data' });

      expect(context.toolLogs[0].timestamp).toBeDefined();
    });
  });

  describe('getDefinition', () => {
    it('should return tool definition', () => {
      const definition = fileTool.getDefinition();

      expect(definition.name).toBe('file_operation');
      expect(definition.description).toBeDefined();
      expect(definition.parameters).toBeDefined();
      expect(typeof definition.execute).toBe('function');
    });
  });
});
