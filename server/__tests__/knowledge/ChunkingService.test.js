/**
 * ChunkingService Tests
 * Tests for server/knowledge/ChunkingService.js
 */

const chunkingService = require('../../knowledge/ChunkingService');

describe('ChunkingService', () => {
  describe('splitIntoChunks', () => {
    it('should return empty array for empty text', () => {
      expect(chunkingService.splitIntoChunks('')).toEqual([]);
      expect(chunkingService.splitIntoChunks('   ')).toEqual([]);
      expect(chunkingService.splitIntoChunks(null)).toEqual([]);
    });

    it('should return single chunk for small text', () => {
      const text = 'This is a small text.';
      const chunks = chunkingService.splitIntoChunks(text, 1000);

      expect(chunks).toHaveLength(1);
      expect(chunks[0].content).toBe(text);
      expect(chunks[0].startChar).toBe(0);
    });

    it('should split large text into multiple chunks', () => {
      const text = 'A'.repeat(500) + '. ' + 'B'.repeat(500) + '. ' + 'C'.repeat(500);
      const chunks = chunkingService.splitIntoChunks(text, 600, 100);

      expect(chunks.length).toBeGreaterThan(1);
    });

    it('should preserve content across chunks', () => {
      const sentences = [];
      for (let i = 0; i < 20; i++) {
        sentences.push(`This is sentence number ${i}.`);
      }
      const text = sentences.join(' ');

      const chunks = chunkingService.splitIntoChunks(text, 200, 50);

      // All chunks should have content
      chunks.forEach(chunk => {
        expect(chunk.content.length).toBeGreaterThan(0);
      });
    });

    it('should track start and end positions', () => {
      const text = 'First sentence. Second sentence. Third sentence.';
      const chunks = chunkingService.splitIntoChunks(text, 30, 5);

      chunks.forEach(chunk => {
        expect(chunk.startChar).toBeDefined();
        expect(chunk.endChar).toBeDefined();
        expect(chunk.endChar).toBeGreaterThan(chunk.startChar);
      });
    });

    it('should normalize line endings', () => {
      const text = 'Line 1.\r\nLine 2.\rLine 3.\nLine 4.';
      const chunks = chunkingService.splitIntoChunks(text, 1000);

      expect(chunks[0].content).not.toContain('\r');
    });
  });

  describe('findBreakPoint', () => {
    it('should break at paragraph boundary', () => {
      const text = 'First paragraph.\n\nSecond paragraph.';
      const breakPoint = chunkingService.findBreakPoint(text, 0, 20);

      expect(breakPoint).toBe(18); // After \n\n
    });

    it('should break at sentence end', () => {
      const text = 'First sentence. Second sentence. Third.';
      const breakPoint = chunkingService.findBreakPoint(text, 0, 25);

      expect(text.substring(0, breakPoint).trim()).toMatch(/\.$/);
    });

    it('should break at word boundary as fallback', () => {
      const text = 'one two three four five';
      const breakPoint = chunkingService.findBreakPoint(text, 0, 12);

      expect(text.charAt(breakPoint - 1)).toBe(' ');
    });

    it('should use ideal end if no good break found', () => {
      const text = 'abcdefghijklmnop';
      const breakPoint = chunkingService.findBreakPoint(text, 0, 10);

      expect(breakPoint).toBe(10);
    });
  });

  describe('splitByParagraphs', () => {
    it('should return empty array for empty text', () => {
      expect(chunkingService.splitByParagraphs('')).toEqual([]);
      expect(chunkingService.splitByParagraphs(null)).toEqual([]);
    });

    it('should split by paragraphs', () => {
      const text = 'Paragraph one.\n\nParagraph two.\n\nParagraph three.';
      const chunks = chunkingService.splitByParagraphs(text, 1000);

      expect(chunks).toHaveLength(1); // All fit in one chunk
      expect(chunks[0].content).toContain('Paragraph one');
      expect(chunks[0].content).toContain('Paragraph two');
    });

    it('should create new chunk when paragraph exceeds size', () => {
      const text = 'Short para.\n\n' + 'A'.repeat(500) + '\n\nAnother para.';
      const chunks = chunkingService.splitByParagraphs(text, 100);

      expect(chunks.length).toBeGreaterThan(1);
    });

    it('should handle large single paragraph', () => {
      const text = 'A'.repeat(2000);
      const chunks = chunkingService.splitByParagraphs(text, 500, 100);

      expect(chunks.length).toBeGreaterThan(1);
    });

    it('should skip empty paragraphs', () => {
      const text = 'Para one.\n\n\n\n\nPara two.';
      const chunks = chunkingService.splitByParagraphs(text, 1000);

      expect(chunks).toHaveLength(1);
      expect(chunks[0].content).toContain('Para one');
      expect(chunks[0].content).toContain('Para two');
    });
  });

  describe('getOverlapText', () => {
    it('should return full text if shorter than overlap', () => {
      expect(chunkingService.getOverlapText('short', 100)).toBe('short');
    });

    it('should return empty string for null/empty text', () => {
      expect(chunkingService.getOverlapText(null, 100)).toBe('');
      expect(chunkingService.getOverlapText('', 100)).toBe('');
    });

    it('should extract overlap from end', () => {
      const text = 'First sentence. Second sentence. Third sentence.';
      const overlap = chunkingService.getOverlapText(text, 30);

      expect(overlap.length).toBeLessThanOrEqual(30);
    });

    it('should try to break at sentence boundary', () => {
      const text = 'First part. This is the second part of the text.';
      const overlap = chunkingService.getOverlapText(text, 35);

      // Should extract from end, trying to find sentence boundary
      expect(overlap.length).toBeLessThanOrEqual(35);
      expect(overlap.length).toBeGreaterThan(0);
    });
  });

  describe('estimateTokenCount', () => {
    it('should return 0 for empty text', () => {
      expect(chunkingService.estimateTokenCount('')).toBe(0);
      expect(chunkingService.estimateTokenCount(null)).toBe(0);
    });

    it('should estimate tokens (~4 chars per token)', () => {
      const text = 'A'.repeat(100);
      const tokens = chunkingService.estimateTokenCount(text);

      expect(tokens).toBe(25); // 100 / 4 = 25
    });

    it('should round up', () => {
      const text = 'AB'; // 2 chars = 0.5 tokens -> rounds to 1
      expect(chunkingService.estimateTokenCount(text)).toBe(1);
    });
  });
});
