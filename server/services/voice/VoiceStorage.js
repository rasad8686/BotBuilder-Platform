/**
 * Voice File Storage Service
 * Handles local and S3 storage for voice files
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const log = require('../../utils/logger');

class VoiceStorage {
  constructor(options = {}) {
    this.storageType = options.storageType || process.env.VOICE_STORAGE_TYPE || 'local';
    this.localPath = options.localPath || process.env.VOICE_STORAGE_PATH || './uploads/voice';
    this.s3Config = {
      bucket: options.s3Bucket || process.env.AWS_S3_VOICE_BUCKET,
      region: options.s3Region || process.env.AWS_REGION || 'us-east-1',
      accessKeyId: options.accessKeyId || process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: options.secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY
    };
    this.maxFileSize = options.maxFileSize || 50 * 1024 * 1024; // 50MB default
    this.allowedFormats = ['wav', 'mp3', 'ogg', 'webm', 'flac', 'm4a', 'aac'];
  }

  /**
   * Initialize storage (create directories, etc.)
   */
  async initialize() {
    if (this.storageType === 'local') {
      try {
        await fs.mkdir(this.localPath, { recursive: true });
        log.info('Voice storage initialized', { path: this.localPath });
      } catch (error) {
        log.error('Failed to initialize voice storage', { error: error.message });
      }
    }
  }

  /**
   * Store voice file
   * @param {Buffer} buffer - Audio buffer
   * @param {Object} options - Storage options
   * @returns {Object} Storage result
   */
  async store(buffer, options = {}) {
    const {
      organizationId,
      userId,
      botId,
      format = 'wav',
      metadata = {}
    } = options;

    // Validate
    if (buffer.length > this.maxFileSize) {
      throw new Error(`File size exceeds maximum allowed (${this.maxFileSize} bytes)`);
    }

    if (!this.allowedFormats.includes(format.toLowerCase())) {
      throw new Error(`Format not allowed: ${format}`);
    }

    // Generate unique filename
    const timestamp = Date.now();
    const hash = crypto.createHash('md5').update(buffer).digest('hex').substring(0, 8);
    const filename = `${organizationId || 'default'}/${timestamp}_${hash}.${format}`;

    try {
      if (this.storageType === 's3') {
        return await this.storeS3(buffer, filename, metadata);
      } else {
        return await this.storeLocal(buffer, filename, metadata);
      }
    } catch (error) {
      log.error('Failed to store voice file', { error: error.message, filename });
      throw error;
    }
  }

  /**
   * Store file locally
   */
  async storeLocal(buffer, filename, metadata) {
    const fullPath = path.join(this.localPath, filename);
    const directory = path.dirname(fullPath);

    // Ensure directory exists
    await fs.mkdir(directory, { recursive: true });

    // Write file
    await fs.writeFile(fullPath, buffer);

    // Write metadata
    const metadataPath = fullPath + '.json';
    await fs.writeFile(metadataPath, JSON.stringify({
      ...metadata,
      storedAt: new Date().toISOString(),
      size: buffer.length
    }));

    return {
      success: true,
      storageType: 'local',
      path: fullPath,
      filename,
      size: buffer.length,
      url: `/api/voice/files/${encodeURIComponent(filename)}`
    };
  }

  /**
   * Store file in S3
   */
  async storeS3(buffer, filename, metadata) {
    // Dynamic import for AWS SDK
    const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');

    const client = new S3Client({
      region: this.s3Config.region,
      credentials: {
        accessKeyId: this.s3Config.accessKeyId,
        secretAccessKey: this.s3Config.secretAccessKey
      }
    });

    const contentType = this.getContentType(filename);

    const command = new PutObjectCommand({
      Bucket: this.s3Config.bucket,
      Key: `voice/${filename}`,
      Body: buffer,
      ContentType: contentType,
      Metadata: {
        ...Object.fromEntries(
          Object.entries(metadata).map(([k, v]) => [k, String(v)])
        ),
        storedAt: new Date().toISOString()
      }
    });

    await client.send(command);

    const url = `https://${this.s3Config.bucket}.s3.${this.s3Config.region}.amazonaws.com/voice/${filename}`;

    return {
      success: true,
      storageType: 's3',
      bucket: this.s3Config.bucket,
      key: `voice/${filename}`,
      filename,
      size: buffer.length,
      url
    };
  }

  /**
   * Retrieve voice file
   * @param {string} filename - File path/name
   * @returns {Buffer} Audio buffer
   */
  async retrieve(filename) {
    try {
      if (this.storageType === 's3') {
        return await this.retrieveS3(filename);
      } else {
        return await this.retrieveLocal(filename);
      }
    } catch (error) {
      log.error('Failed to retrieve voice file', { error: error.message, filename });
      throw error;
    }
  }

  /**
   * Retrieve from local storage
   */
  async retrieveLocal(filename) {
    const fullPath = path.join(this.localPath, filename);
    const buffer = await fs.readFile(fullPath);

    let metadata = {};
    try {
      const metadataContent = await fs.readFile(fullPath + '.json', 'utf8');
      metadata = JSON.parse(metadataContent);
    } catch (e) {
      // No metadata file
    }

    return {
      buffer,
      metadata,
      contentType: this.getContentType(filename)
    };
  }

  /**
   * Retrieve from S3
   */
  async retrieveS3(filename) {
    const { S3Client, GetObjectCommand } = await import('@aws-sdk/client-s3');

    const client = new S3Client({
      region: this.s3Config.region,
      credentials: {
        accessKeyId: this.s3Config.accessKeyId,
        secretAccessKey: this.s3Config.secretAccessKey
      }
    });

    const command = new GetObjectCommand({
      Bucket: this.s3Config.bucket,
      Key: `voice/${filename}`
    });

    const response = await client.send(command);

    // Convert stream to buffer
    const chunks = [];
    for await (const chunk of response.Body) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    return {
      buffer,
      metadata: response.Metadata || {},
      contentType: response.ContentType
    };
  }

  /**
   * Delete voice file
   * @param {string} filename - File path/name
   * @returns {boolean} Success
   */
  async delete(filename) {
    try {
      if (this.storageType === 's3') {
        return await this.deleteS3(filename);
      } else {
        return await this.deleteLocal(filename);
      }
    } catch (error) {
      log.error('Failed to delete voice file', { error: error.message, filename });
      throw error;
    }
  }

  /**
   * Delete from local storage
   */
  async deleteLocal(filename) {
    const fullPath = path.join(this.localPath, filename);

    await fs.unlink(fullPath);

    // Try to delete metadata
    try {
      await fs.unlink(fullPath + '.json');
    } catch (e) {
      // Ignore
    }

    return true;
  }

  /**
   * Delete from S3
   */
  async deleteS3(filename) {
    const { S3Client, DeleteObjectCommand } = await import('@aws-sdk/client-s3');

    const client = new S3Client({
      region: this.s3Config.region,
      credentials: {
        accessKeyId: this.s3Config.accessKeyId,
        secretAccessKey: this.s3Config.secretAccessKey
      }
    });

    const command = new DeleteObjectCommand({
      Bucket: this.s3Config.bucket,
      Key: `voice/${filename}`
    });

    await client.send(command);
    return true;
  }

  /**
   * List files
   * @param {Object} options - List options
   * @returns {Array} File list
   */
  async list(options = {}) {
    const { prefix, limit = 100 } = options;

    try {
      if (this.storageType === 's3') {
        return await this.listS3(prefix, limit);
      } else {
        return await this.listLocal(prefix, limit);
      }
    } catch (error) {
      log.error('Failed to list voice files', { error: error.message });
      throw error;
    }
  }

  /**
   * List local files
   */
  async listLocal(prefix, limit) {
    const searchPath = prefix
      ? path.join(this.localPath, prefix)
      : this.localPath;

    const files = [];

    async function walkDir(dir) {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          if (files.length >= limit) break;

          const fullPath = path.join(dir, entry.name);

          if (entry.isDirectory()) {
            await walkDir(fullPath);
          } else if (!entry.name.endsWith('.json')) {
            const stat = await fs.stat(fullPath);
            files.push({
              filename: fullPath.replace(searchPath + path.sep, ''),
              size: stat.size,
              createdAt: stat.birthtime,
              modifiedAt: stat.mtime
            });
          }
        }
      } catch (e) {
        // Directory doesn't exist
      }
    }

    await walkDir(searchPath);
    return files;
  }

  /**
   * List S3 files
   */
  async listS3(prefix, limit) {
    const { S3Client, ListObjectsV2Command } = await import('@aws-sdk/client-s3');

    const client = new S3Client({
      region: this.s3Config.region,
      credentials: {
        accessKeyId: this.s3Config.accessKeyId,
        secretAccessKey: this.s3Config.secretAccessKey
      }
    });

    const command = new ListObjectsV2Command({
      Bucket: this.s3Config.bucket,
      Prefix: prefix ? `voice/${prefix}` : 'voice/',
      MaxKeys: limit
    });

    const response = await client.send(command);

    return (response.Contents || []).map(obj => ({
      filename: obj.Key.replace('voice/', ''),
      size: obj.Size,
      modifiedAt: obj.LastModified
    }));
  }

  /**
   * Get signed URL for file (S3 only)
   * @param {string} filename - File path
   * @param {number} expiresIn - Expiry in seconds
   * @returns {string} Signed URL
   */
  async getSignedUrl(filename, expiresIn = 3600) {
    if (this.storageType !== 's3') {
      return `/api/voice/files/${encodeURIComponent(filename)}`;
    }

    const { S3Client } = await import('@aws-sdk/client-s3');
    const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
    const { GetObjectCommand } = await import('@aws-sdk/client-s3');

    const client = new S3Client({
      region: this.s3Config.region,
      credentials: {
        accessKeyId: this.s3Config.accessKeyId,
        secretAccessKey: this.s3Config.secretAccessKey
      }
    });

    const command = new GetObjectCommand({
      Bucket: this.s3Config.bucket,
      Key: `voice/${filename}`
    });

    return await getSignedUrl(client, command, { expiresIn });
  }

  /**
   * Get content type from filename
   * @param {string} filename - Filename
   * @returns {string} Content type
   */
  getContentType(filename) {
    const ext = path.extname(filename).toLowerCase().slice(1);
    const types = {
      wav: 'audio/wav',
      mp3: 'audio/mpeg',
      ogg: 'audio/ogg',
      webm: 'audio/webm',
      flac: 'audio/flac',
      m4a: 'audio/mp4',
      aac: 'audio/aac'
    };
    return types[ext] || 'application/octet-stream';
  }

  /**
   * Get storage statistics
   * @returns {Object} Storage stats
   */
  async getStorageStats() {
    const files = await this.list({ limit: 10000 });

    const totalSize = files.reduce((sum, f) => sum + (f.size || 0), 0);
    const totalFiles = files.length;

    return {
      storageType: this.storageType,
      totalFiles,
      totalSize,
      totalSizeFormatted: this.formatBytes(totalSize),
      avgFileSize: totalFiles > 0 ? Math.round(totalSize / totalFiles) : 0
    };
  }

  /**
   * Format bytes to human readable
   * @param {number} bytes - Bytes
   * @returns {string} Formatted string
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

// Export singleton instance
module.exports = new VoiceStorage();
