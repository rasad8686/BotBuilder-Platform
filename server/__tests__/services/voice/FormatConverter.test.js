/**
 * Format Converter Service Tests
 * Tests for server/services/voice/FormatConverter.js
 */

jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn()
}));

jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn().mockResolvedValue(undefined),
    writeFile: jest.fn().mockResolvedValue(undefined),
    readFile: jest.fn().mockResolvedValue(Buffer.from('converted audio')),
    unlink: jest.fn().mockResolvedValue(undefined)
  }
}));

jest.mock('child_process', () => ({
  spawn: jest.fn().mockImplementation(() => {
    const EventEmitter = require('events');
    const proc = new EventEmitter();
    proc.stdout = new EventEmitter();
    proc.stderr = new EventEmitter();

    setTimeout(() => {
      proc.emit('close', 0);
    }, 10);

    return proc;
  })
}));

const fs = require('fs').promises;
const FormatConverter = require('../../../services/voice/FormatConverter');

describe('FormatConverter Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('initialize()', () => {
    it('should create temp directory', async () => {
      await FormatConverter.initialize();

      expect(fs.mkdir).toHaveBeenCalledWith(
        expect.any(String),
        { recursive: true }
      );
    });
  });

  describe('getSupportedFormats()', () => {
    it('should return supported input and output formats', () => {
      const formats = FormatConverter.getSupportedFormats();

      expect(formats).toHaveProperty('input');
      expect(formats).toHaveProperty('output');
      expect(Array.isArray(formats.input)).toBe(true);
      expect(Array.isArray(formats.output)).toBe(true);
    });

    it('should include common audio formats', () => {
      const formats = FormatConverter.getSupportedFormats();

      expect(formats.input).toContain('wav');
      expect(formats.input).toContain('mp3');
      expect(formats.input).toContain('ogg');
      expect(formats.output).toContain('wav');
      expect(formats.output).toContain('mp3');
      expect(formats.output).toContain('ogg');
    });
  });

  describe('getPresets()', () => {
    it('should return array of presets', () => {
      const presets = FormatConverter.getPresets();

      expect(Array.isArray(presets)).toBe(true);
      expect(presets.length).toBeGreaterThan(0);
    });

    it('should have speech preset', () => {
      const presets = FormatConverter.getPresets();
      const speechPreset = presets.find(p => p.name === 'speech');

      expect(speechPreset).toBeDefined();
      expect(speechPreset.sampleRate).toBeDefined();
      expect(speechPreset.channels).toBe(1);
    });

    it('should have whisper preset', () => {
      const presets = FormatConverter.getPresets();
      const whisperPreset = presets.find(p => p.name === 'whisper');

      expect(whisperPreset).toBeDefined();
      expect(whisperPreset.sampleRate).toBe(16000);
      expect(whisperPreset.format).toBe('wav');
    });

    it('should have telephony preset', () => {
      const presets = FormatConverter.getPresets();
      const telephonyPreset = presets.find(p => p.name === 'telephony');

      expect(telephonyPreset).toBeDefined();
      expect(telephonyPreset.sampleRate).toBe(8000);
    });

    it('should have web preset', () => {
      const presets = FormatConverter.getPresets();
      const webPreset = presets.find(p => p.name === 'web');

      expect(webPreset).toBeDefined();
      expect(webPreset.format).toBe('webm');
    });
  });

  describe('convert()', () => {
    it('should convert audio format', async () => {
      const inputBuffer = Buffer.from('fake audio input');

      const result = await FormatConverter.convert(inputBuffer, {
        inputFormat: 'mp3',
        outputFormat: 'wav'
      });

      expect(result.success).toBe(true);
      expect(result.buffer).toBeDefined();
      expect(result.format).toBe('wav');
    });

    it('should apply preset options', async () => {
      const inputBuffer = Buffer.from('fake audio input');

      const result = await FormatConverter.convert(inputBuffer, {
        inputFormat: 'mp3',
        preset: 'whisper'
      });

      expect(result.success).toBe(true);
      expect(result.format).toBe('wav');
    });

    it('should reject unsupported output format', async () => {
      const inputBuffer = Buffer.from('fake audio input');

      await expect(FormatConverter.convert(inputBuffer, {
        inputFormat: 'mp3',
        outputFormat: 'exe'
      })).rejects.toThrow('Unsupported output format');
    });

    it('should clean up temp files', async () => {
      const inputBuffer = Buffer.from('fake audio input');

      await FormatConverter.convert(inputBuffer, {
        inputFormat: 'mp3',
        outputFormat: 'wav'
      });

      // Should have cleaned up temp files
      expect(fs.unlink).toHaveBeenCalled();
    });
  });

  describe('buildFFmpegArgs()', () => {
    it('should include input and output paths', () => {
      const args = FormatConverter.buildFFmpegArgs(
        '/tmp/input.mp3',
        '/tmp/output.wav',
        { outputFormat: 'wav' }
      );

      expect(args).toContain('-i');
      expect(args).toContain('/tmp/input.mp3');
      expect(args).toContain('/tmp/output.wav');
    });

    it('should include sample rate when specified', () => {
      const args = FormatConverter.buildFFmpegArgs(
        '/tmp/input.mp3',
        '/tmp/output.wav',
        { outputFormat: 'wav', sampleRate: 16000 }
      );

      expect(args).toContain('-ar');
      expect(args).toContain('16000');
    });

    it('should include channels when specified', () => {
      const args = FormatConverter.buildFFmpegArgs(
        '/tmp/input.mp3',
        '/tmp/output.wav',
        { outputFormat: 'wav', channels: 1 }
      );

      expect(args).toContain('-ac');
      expect(args).toContain('1');
    });

    it('should include bitrate when specified', () => {
      const args = FormatConverter.buildFFmpegArgs(
        '/tmp/input.mp3',
        '/tmp/output.mp3',
        { outputFormat: 'mp3', bitrate: '128k' }
      );

      expect(args).toContain('-b:a');
      expect(args).toContain('128k');
    });

    it('should include normalization filter', () => {
      const args = FormatConverter.buildFFmpegArgs(
        '/tmp/input.mp3',
        '/tmp/output.wav',
        { outputFormat: 'wav' },
        { normalize: true }
      );

      expect(args).toContain('-af');
      expect(args.some(arg => arg.includes('loudnorm'))).toBe(true);
    });

    it('should include noise reduction filter', () => {
      const args = FormatConverter.buildFFmpegArgs(
        '/tmp/input.mp3',
        '/tmp/output.wav',
        { outputFormat: 'wav' },
        { removeNoise: true }
      );

      expect(args).toContain('-af');
      expect(args.some(arg => arg.includes('highpass'))).toBe(true);
    });

    it('should use correct codec for mp3', () => {
      const args = FormatConverter.buildFFmpegArgs(
        '/tmp/input.wav',
        '/tmp/output.mp3',
        { outputFormat: 'mp3' }
      );

      expect(args).toContain('-codec:a');
      expect(args).toContain('libmp3lame');
    });

    it('should use correct codec for ogg', () => {
      const args = FormatConverter.buildFFmpegArgs(
        '/tmp/input.wav',
        '/tmp/output.ogg',
        { outputFormat: 'ogg' }
      );

      expect(args).toContain('-codec:a');
      expect(args).toContain('libvorbis');
    });

    it('should use correct codec for wav', () => {
      const args = FormatConverter.buildFFmpegArgs(
        '/tmp/input.mp3',
        '/tmp/output.wav',
        { outputFormat: 'wav' }
      );

      expect(args).toContain('-codec:a');
      expect(args).toContain('pcm_s16le');
    });
  });

  describe('getDuration()', () => {
    it('should get duration from buffer', async () => {
      const buffer = Buffer.from('fake audio');

      const duration = await FormatConverter.getDuration(buffer, 'wav');

      expect(typeof duration).toBe('number');
    });
  });

  describe('extractSegment()', () => {
    it('should extract segment from audio', async () => {
      const inputBuffer = Buffer.from('fake audio');

      const result = await FormatConverter.extractSegment(inputBuffer, {
        startTime: 0,
        duration: 10,
        inputFormat: 'wav'
      });

      expect(result).toBeInstanceOf(Buffer);
    });
  });

  describe('concatenate()', () => {
    it('should concatenate multiple audio buffers', async () => {
      const buffers = [
        Buffer.from('audio1'),
        Buffer.from('audio2'),
        Buffer.from('audio3')
      ];

      const result = await FormatConverter.concatenate(buffers, {
        inputFormat: 'wav',
        outputFormat: 'wav'
      });

      expect(result).toBeInstanceOf(Buffer);
    });
  });

  describe('cleanup()', () => {
    it('should delete temp files', async () => {
      await FormatConverter.cleanup(['/tmp/file1', '/tmp/file2']);

      expect(fs.unlink).toHaveBeenCalledTimes(2);
    });

    it('should handle cleanup errors gracefully', async () => {
      fs.unlink.mockRejectedValueOnce(new Error('File not found'));

      // Should not throw
      await expect(FormatConverter.cleanup(['/tmp/nonexistent']))
        .resolves.not.toThrow();
    });
  });

  describe('isAvailable()', () => {
    it('should check if ffmpeg is available', async () => {
      const result = await FormatConverter.isAvailable();

      expect(typeof result).toBe('boolean');
    });
  });

  describe('presets', () => {
    it('should have valid preset configurations', () => {
      const presets = FormatConverter.presets;

      expect(presets).toHaveProperty('speech');
      expect(presets).toHaveProperty('whisper');
      expect(presets).toHaveProperty('telephony');
      expect(presets).toHaveProperty('web');
    });

    it('should have valid sample rates in presets', () => {
      const presets = FormatConverter.presets;

      expect(presets.speech.sampleRate).toBe(16000);
      expect(presets.whisper.sampleRate).toBe(16000);
      expect(presets.telephony.sampleRate).toBe(8000);
      expect(presets.web.sampleRate).toBe(48000);
    });
  });
});
