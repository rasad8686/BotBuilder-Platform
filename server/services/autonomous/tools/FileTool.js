/**
 * File Tool for Autonomous Agents
 * File operations (read, write) with security restrictions
 */

const fs = require('fs').promises;
const path = require('path');
const log = require('../../../utils/logger');

class FileTool {
  constructor() {
    this.name = 'file_operation';
    this.description = 'Read and write files within allowed directories';
    this.parameters = {
      operation: {
        type: 'string',
        required: true,
        description: 'File operation: read, write, append, list, exists, delete',
        enum: ['read', 'write', 'append', 'list', 'exists', 'delete']
      },
      path: {
        type: 'string',
        required: true,
        description: 'File or directory path (relative to workspace)'
      },
      content: {
        type: 'string',
        required: false,
        description: 'Content to write (for write/append operations)'
      },
      encoding: {
        type: 'string',
        required: false,
        description: 'File encoding',
        default: 'utf8'
      },
      maxSize: {
        type: 'number',
        required: false,
        description: 'Maximum file size to read in bytes',
        default: 1048576 // 1MB
      }
    };

    // Base workspace directory for file operations
    this.workspaceDir = process.env.AGENT_WORKSPACE_DIR ||
      path.join(process.cwd(), 'agent_workspace');

    // Blocked file extensions
    this.blockedExtensions = [
      '.exe', '.dll', '.so', '.dylib',
      '.sh', '.bat', '.cmd', '.ps1',
      '.env', '.pem', '.key', '.crt'
    ];
  }

  /**
   * Execute file operation
   */
  async execute(params, context = {}) {
    const {
      operation,
      path: filePath,
      content,
      encoding = 'utf8',
      maxSize = 1048576
    } = params;

    // Validate operation
    const validOperations = ['read', 'write', 'append', 'list', 'exists', 'delete'];
    if (!validOperations.includes(operation)) {
      return {
        success: false,
        error: `Invalid operation. Must be one of: ${validOperations.join(', ')}`
      };
    }

    // Resolve and validate path
    const resolvedPath = this.resolvePath(filePath);
    if (!resolvedPath) {
      return {
        success: false,
        error: 'Invalid or forbidden path'
      };
    }

    // Check file extension for write operations
    if (['write', 'append'].includes(operation)) {
      const ext = path.extname(resolvedPath).toLowerCase();
      if (this.blockedExtensions.includes(ext)) {
        return {
          success: false,
          error: `Writing ${ext} files is not allowed`
        };
      }
    }

    const startTime = Date.now();

    try {
      let result;

      switch (operation) {
        case 'read':
          result = await this.readFile(resolvedPath, encoding, maxSize);
          break;
        case 'write':
          result = await this.writeFile(resolvedPath, content, encoding);
          break;
        case 'append':
          result = await this.appendFile(resolvedPath, content, encoding);
          break;
        case 'list':
          result = await this.listDirectory(resolvedPath);
          break;
        case 'exists':
          result = await this.checkExists(resolvedPath);
          break;
        case 'delete':
          result = await this.deleteFile(resolvedPath);
          break;
      }

      const duration = Date.now() - startTime;

      // Log execution
      this.logExecution(context, {
        operation,
        path: filePath,
        duration,
        success: true
      });

      log.info('FileTool: Operation completed', { operation, path: filePath, duration });

      return {
        success: true,
        operation,
        path: filePath,
        ...result,
        duration
      };

    } catch (error) {
      const duration = Date.now() - startTime;

      log.error('FileTool: Operation failed', {
        operation,
        path: filePath,
        error: error.message,
        duration
      });

      // Log failed execution
      this.logExecution(context, {
        operation,
        path: filePath,
        error: error.message,
        duration,
        success: false
      });

      return {
        success: false,
        operation,
        path: filePath,
        error: error.message,
        duration
      };
    }
  }

  /**
   * Resolve path and ensure it's within workspace
   */
  resolvePath(inputPath) {
    try {
      // Ensure workspace exists
      this.ensureWorkspace();

      // Normalize and resolve path
      const normalized = path.normalize(inputPath);

      // Prevent path traversal
      if (normalized.includes('..')) {
        return null;
      }

      // Resolve to absolute path within workspace
      const resolved = path.resolve(this.workspaceDir, normalized);

      // Verify path is within workspace
      if (!resolved.startsWith(this.workspaceDir)) {
        return null;
      }

      return resolved;
    } catch {
      return null;
    }
  }

  /**
   * Ensure workspace directory exists
   */
  async ensureWorkspace() {
    try {
      await fs.access(this.workspaceDir);
    } catch {
      await fs.mkdir(this.workspaceDir, { recursive: true });
    }
  }

  /**
   * Read file content
   */
  async readFile(filePath, encoding, maxSize) {
    // Check file exists
    const stats = await fs.stat(filePath);

    if (!stats.isFile()) {
      throw new Error('Path is not a file');
    }

    // Check file size
    if (stats.size > maxSize) {
      throw new Error(`File too large (${stats.size} bytes). Maximum: ${maxSize} bytes`);
    }

    const content = await fs.readFile(filePath, encoding);

    return {
      content,
      size: stats.size,
      modified: stats.mtime.toISOString()
    };
  }

  /**
   * Write file content
   */
  async writeFile(filePath, content, encoding) {
    if (content === undefined || content === null) {
      throw new Error('Content is required for write operation');
    }

    // Ensure directory exists
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });

    await fs.writeFile(filePath, content, encoding);

    const stats = await fs.stat(filePath);

    return {
      written: true,
      size: stats.size
    };
  }

  /**
   * Append to file
   */
  async appendFile(filePath, content, encoding) {
    if (content === undefined || content === null) {
      throw new Error('Content is required for append operation');
    }

    // Ensure directory exists
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });

    await fs.appendFile(filePath, content, encoding);

    const stats = await fs.stat(filePath);

    return {
      appended: true,
      size: stats.size
    };
  }

  /**
   * List directory contents
   */
  async listDirectory(dirPath) {
    const stats = await fs.stat(dirPath);

    if (!stats.isDirectory()) {
      throw new Error('Path is not a directory');
    }

    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    const items = await Promise.all(
      entries.map(async (entry) => {
        const itemPath = path.join(dirPath, entry.name);
        try {
          const itemStats = await fs.stat(itemPath);
          return {
            name: entry.name,
            type: entry.isDirectory() ? 'directory' : 'file',
            size: itemStats.size,
            modified: itemStats.mtime.toISOString()
          };
        } catch {
          return {
            name: entry.name,
            type: entry.isDirectory() ? 'directory' : 'file',
            error: 'Unable to read stats'
          };
        }
      })
    );

    return {
      directory: dirPath,
      count: items.length,
      items
    };
  }

  /**
   * Check if path exists
   */
  async checkExists(filePath) {
    try {
      const stats = await fs.stat(filePath);
      return {
        exists: true,
        type: stats.isDirectory() ? 'directory' : 'file',
        size: stats.size,
        modified: stats.mtime.toISOString()
      };
    } catch (error) {
      if (error.code === 'ENOENT') {
        return {
          exists: false
        };
      }
      throw error;
    }
  }

  /**
   * Delete file
   */
  async deleteFile(filePath) {
    const stats = await fs.stat(filePath);

    if (stats.isDirectory()) {
      throw new Error('Cannot delete directories. Use file paths only.');
    }

    await fs.unlink(filePath);

    return {
      deleted: true
    };
  }

  /**
   * Log tool execution
   */
  logExecution(context, details) {
    if (!context.toolLogs) {
      context.toolLogs = [];
    }

    context.toolLogs.push({
      tool: this.name,
      timestamp: new Date().toISOString(),
      ...details
    });
  }

  /**
   * Get tool definition for registry
   */
  getDefinition() {
    return {
      name: this.name,
      description: this.description,
      parameters: this.parameters,
      execute: this.execute.bind(this)
    };
  }
}

module.exports = FileTool;
