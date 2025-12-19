/**
 * Voice Format Converter Service
 * Uses ffmpeg for audio format conversion
 */

const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const log = require('../../utils/logger');

// Try to use ffmpeg-static if available
let ffmpegPath;
try {
  ffmpegPath = require('ffmpeg-static');
} catch (e) {
  ffmpegPath = 'ffmpeg'; // Use system ffmpeg
}

class FormatConverter {
  constructor() {
    this.tempDir = path.join(os.tmpdir(), 'voice-converter');
    this.supportedFormats = {
      input: ['wav', 'mp3', 'ogg', 'webm', 'flac', 'm4a', 'aac', 'amr', 'opus', 'wma'],
      output: ['wav', 'mp3', 'ogg', 'webm', 'flac', 'm4a', 'aac', 'opus']
    };
    this.presets = {
      'speech': {
        sampleRate: 16000,
        channels: 1,
        bitrate: '64k',
        format: 'wav'
      },
      'hq-speech': {
        sampleRate: 44100,
        channels: 1,
        bitrate: '128k',
        format: 'mp3'
      },
      'music': {
        sampleRate: 44100,
        channels: 2,
        bitrate: '192k',
        format: 'mp3'
      },
      'telephony': {
        sampleRate: 8000,
        channels: 1,
        bitrate: '32k',
        format: 'wav'
      },
      'whisper': {
        sampleRate: 16000,
        channels: 1,
        format: 'wav'
      },
      'web': {
        sampleRate: 48000,
        channels: 2,
        bitrate: '128k',
        format: 'webm'
      }
    };
  }

  /**
   * Initialize converter (create temp directory)
   */
  async initialize() {
    try {
      await fs.mkdir(this.tempDir, { recursive: true });
    } catch (error) {
      log.error('Failed to create temp directory', { error: error.message });
    }
  }

  /**
   * Convert audio format
   * @param {Buffer} inputBuffer - Input audio buffer
   * @param {Object} options - Conversion options
   * @returns {Object} Conversion result with buffer
   */
  async convert(inputBuffer, options = {}) {
    const {
      inputFormat,
      outputFormat = 'wav',
      sampleRate,
      channels,
      bitrate,
      preset,
      normalize = false,
      removeNoise = false
    } = options;

    // Apply preset if specified
    const presetOptions = preset ? this.presets[preset] : {};
    const finalOptions = {
      outputFormat: presetOptions.format || outputFormat,
      sampleRate: sampleRate || presetOptions.sampleRate,
      channels: channels || presetOptions.channels,
      bitrate: bitrate || presetOptions.bitrate
    };

    // Validate output format
    if (!this.supportedFormats.output.includes(finalOptions.outputFormat)) {
      throw new Error(`Unsupported output format: ${finalOptions.outputFormat}`);
    }

    // Generate temp filenames
    const tempId = crypto.randomBytes(8).toString('hex');
    const inputPath = path.join(this.tempDir, `input_${tempId}.${inputFormat || 'bin'}`);
    const outputPath = path.join(this.tempDir, `output_${tempId}.${finalOptions.outputFormat}`);

    try {
      // Write input buffer to temp file
      await fs.writeFile(inputPath, inputBuffer);

      // Build ffmpeg arguments
      const args = this.buildFFmpegArgs(inputPath, outputPath, finalOptions, {
        normalize,
        removeNoise
      });

      // Run ffmpeg
      await this.runFFmpeg(args);

      // Read output file
      const outputBuffer = await fs.readFile(outputPath);

      // Get audio info
      const info = await this.getAudioInfo(outputPath);

      // Cleanup
      await this.cleanup([inputPath, outputPath]);

      return {
        success: true,
        buffer: outputBuffer,
        format: finalOptions.outputFormat,
        size: outputBuffer.length,
        duration: info.duration,
        sampleRate: info.sampleRate,
        channels: info.channels
      };

    } catch (error) {
      // Cleanup on error
      await this.cleanup([inputPath, outputPath]);
      log.error('Audio conversion failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Build ffmpeg arguments
   */
  buildFFmpegArgs(inputPath, outputPath, options, filters = {}) {
    const args = ['-y', '-i', inputPath];

    // Audio filters
    const audioFilters = [];

    // Sample rate
    if (options.sampleRate) {
      args.push('-ar', String(options.sampleRate));
    }

    // Channels
    if (options.channels) {
      args.push('-ac', String(options.channels));
    }

    // Bitrate
    if (options.bitrate) {
      args.push('-b:a', options.bitrate);
    }

    // Normalization
    if (filters.normalize) {
      audioFilters.push('loudnorm=I=-16:TP=-1.5:LRA=11');
    }

    // Noise reduction (basic high-pass filter)
    if (filters.removeNoise) {
      audioFilters.push('highpass=f=80', 'lowpass=f=8000', 'afftdn=nf=-25');
    }

    // Apply audio filters
    if (audioFilters.length > 0) {
      args.push('-af', audioFilters.join(','));
    }

    // Output format specific options
    switch (options.outputFormat) {
      case 'mp3':
        args.push('-codec:a', 'libmp3lame');
        break;
      case 'ogg':
        args.push('-codec:a', 'libvorbis');
        break;
      case 'opus':
        args.push('-codec:a', 'libopus');
        break;
      case 'webm':
        args.push('-codec:a', 'libopus', '-f', 'webm');
        break;
      case 'aac':
      case 'm4a':
        args.push('-codec:a', 'aac');
        break;
      case 'flac':
        args.push('-codec:a', 'flac');
        break;
      case 'wav':
        args.push('-codec:a', 'pcm_s16le');
        break;
    }

    args.push(outputPath);

    return args;
  }

  /**
   * Run ffmpeg command
   */
  runFFmpeg(args) {
    return new Promise((resolve, reject) => {
      const process = spawn(ffmpegPath, args);

      let stderr = '';

      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`FFmpeg failed with code ${code}: ${stderr}`));
        }
      });

      process.on('error', (error) => {
        reject(new Error(`FFmpeg error: ${error.message}`));
      });
    });
  }

  /**
   * Get audio file information
   * @param {string} filePath - Path to audio file
   * @returns {Object} Audio information
   */
  async getAudioInfo(filePath) {
    return new Promise((resolve, reject) => {
      const args = [
        '-v', 'quiet',
        '-print_format', 'json',
        '-show_format',
        '-show_streams',
        filePath
      ];

      // Use ffprobe
      let ffprobePath;
      try {
        ffprobePath = require('ffprobe-static').path;
      } catch (e) {
        ffprobePath = 'ffprobe';
      }

      const process = spawn(ffprobePath, args);

      let stdout = '';
      let stderr = '';

      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0) {
          try {
            const info = JSON.parse(stdout);
            const audioStream = info.streams?.find(s => s.codec_type === 'audio');

            resolve({
              duration: parseFloat(info.format?.duration) || 0,
              sampleRate: parseInt(audioStream?.sample_rate) || 0,
              channels: parseInt(audioStream?.channels) || 0,
              bitrate: parseInt(info.format?.bit_rate) || 0,
              codec: audioStream?.codec_name || 'unknown',
              format: info.format?.format_name || 'unknown'
            });
          } catch (e) {
            resolve({
              duration: 0,
              sampleRate: 0,
              channels: 0
            });
          }
        } else {
          resolve({
            duration: 0,
            sampleRate: 0,
            channels: 0
          });
        }
      });

      process.on('error', () => {
        resolve({
          duration: 0,
          sampleRate: 0,
          channels: 0
        });
      });
    });
  }

  /**
   * Get audio duration from buffer
   * @param {Buffer} buffer - Audio buffer
   * @param {string} format - Audio format
   * @returns {number} Duration in seconds
   */
  async getDuration(buffer, format = 'wav') {
    const tempId = crypto.randomBytes(8).toString('hex');
    const tempPath = path.join(this.tempDir, `duration_${tempId}.${format}`);

    try {
      await fs.writeFile(tempPath, buffer);
      const info = await this.getAudioInfo(tempPath);
      await this.cleanup([tempPath]);
      return info.duration;
    } catch (error) {
      await this.cleanup([tempPath]);
      return 0;
    }
  }

  /**
   * Extract audio segment
   * @param {Buffer} inputBuffer - Input audio buffer
   * @param {Object} options - Extraction options
   * @returns {Buffer} Extracted segment
   */
  async extractSegment(inputBuffer, options = {}) {
    const {
      startTime = 0,
      endTime,
      duration,
      inputFormat = 'wav',
      outputFormat = 'wav'
    } = options;

    const tempId = crypto.randomBytes(8).toString('hex');
    const inputPath = path.join(this.tempDir, `seg_in_${tempId}.${inputFormat}`);
    const outputPath = path.join(this.tempDir, `seg_out_${tempId}.${outputFormat}`);

    try {
      await fs.writeFile(inputPath, inputBuffer);

      const args = ['-y', '-i', inputPath];

      // Start time
      args.push('-ss', String(startTime));

      // Duration or end time
      if (duration) {
        args.push('-t', String(duration));
      } else if (endTime) {
        args.push('-to', String(endTime));
      }

      args.push('-c', 'copy', outputPath);

      await this.runFFmpeg(args);

      const outputBuffer = await fs.readFile(outputPath);
      await this.cleanup([inputPath, outputPath]);

      return outputBuffer;

    } catch (error) {
      await this.cleanup([inputPath, outputPath]);
      throw error;
    }
  }

  /**
   * Concatenate audio files
   * @param {Array<Buffer>} buffers - Audio buffers to concatenate
   * @param {Object} options - Concatenation options
   * @returns {Buffer} Concatenated audio
   */
  async concatenate(buffers, options = {}) {
    const {
      inputFormat = 'wav',
      outputFormat = 'wav'
    } = options;

    const tempId = crypto.randomBytes(8).toString('hex');
    const tempFiles = [];
    const listPath = path.join(this.tempDir, `concat_list_${tempId}.txt`);
    const outputPath = path.join(this.tempDir, `concat_out_${tempId}.${outputFormat}`);

    try {
      // Write input files and create list
      const listContent = [];
      for (let i = 0; i < buffers.length; i++) {
        const filePath = path.join(this.tempDir, `concat_${tempId}_${i}.${inputFormat}`);
        await fs.writeFile(filePath, buffers[i]);
        tempFiles.push(filePath);
        listContent.push(`file '${filePath}'`);
      }

      await fs.writeFile(listPath, listContent.join('\n'));
      tempFiles.push(listPath);

      // Run ffmpeg concat
      const args = [
        '-y',
        '-f', 'concat',
        '-safe', '0',
        '-i', listPath,
        '-c', 'copy',
        outputPath
      ];

      await this.runFFmpeg(args);

      const outputBuffer = await fs.readFile(outputPath);
      tempFiles.push(outputPath);

      await this.cleanup(tempFiles);

      return outputBuffer;

    } catch (error) {
      tempFiles.push(outputPath);
      await this.cleanup(tempFiles);
      throw error;
    }
  }

  /**
   * Cleanup temp files
   */
  async cleanup(files) {
    for (const file of files) {
      try {
        await fs.unlink(file);
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  }

  /**
   * Get supported formats
   * @returns {Object} Supported formats
   */
  getSupportedFormats() {
    return this.supportedFormats;
  }

  /**
   * Get available presets
   * @returns {Object} Presets
   */
  getPresets() {
    return Object.keys(this.presets).map(name => ({
      name,
      ...this.presets[name]
    }));
  }

  /**
   * Check if ffmpeg is available
   * @returns {boolean} Is available
   */
  async isAvailable() {
    return new Promise((resolve) => {
      const process = spawn(ffmpegPath, ['-version']);
      process.on('close', (code) => resolve(code === 0));
      process.on('error', () => resolve(false));
    });
  }
}

// Export singleton instance
module.exports = new FormatConverter();
