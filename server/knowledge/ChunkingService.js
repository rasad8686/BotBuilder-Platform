class ChunkingService {
  /**
   * Split text into chunks with sentence-aware boundaries
   * @param {string} text - Text to split
   * @param {number} chunkSize - Target chunk size in characters
   * @param {number} overlap - Overlap between chunks in characters
   * @returns {Array<{content: string, startChar: number, endChar: number}>} - Array of chunks
   */
  splitIntoChunks(text, chunkSize = 1000, overlap = 200) {
    if (!text || text.trim().length === 0) {
      return [];
    }

    // Normalize whitespace
    const normalizedText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // If text is smaller than chunk size, return as single chunk
    if (normalizedText.length <= chunkSize) {
      return [{
        content: normalizedText.trim(),
        startChar: 0,
        endChar: normalizedText.length
      }];
    }

    const chunks = [];
    let currentPosition = 0;

    while (currentPosition < normalizedText.length) {
      // Calculate end position
      let endPosition = Math.min(currentPosition + chunkSize, normalizedText.length);

      // If not at the end, find a good breaking point
      if (endPosition < normalizedText.length) {
        endPosition = this.findBreakPoint(normalizedText, currentPosition, endPosition);
      }

      // Extract chunk
      const chunkContent = normalizedText.substring(currentPosition, endPosition).trim();

      if (chunkContent.length > 0) {
        chunks.push({
          content: chunkContent,
          startChar: currentPosition,
          endChar: endPosition
        });
      }

      // Move to next position with overlap
      currentPosition = endPosition - overlap;

      // Ensure we make progress
      if (currentPosition <= chunks[chunks.length - 1]?.startChar) {
        currentPosition = endPosition;
      }
    }

    return chunks;
  }

  /**
   * Find the best breaking point for a chunk (sentence-aware)
   * @param {string} text - Full text
   * @param {number} start - Start position
   * @param {number} idealEnd - Ideal end position
   * @returns {number} - Best break position
   */
  findBreakPoint(text, start, idealEnd) {
    const searchWindow = Math.min(200, idealEnd - start);
    const searchStart = idealEnd - searchWindow;

    // Priority 1: Look for paragraph break (\n\n)
    const paragraphBreak = text.lastIndexOf('\n\n', idealEnd);
    if (paragraphBreak > searchStart && paragraphBreak > start) {
      return paragraphBreak + 2; // Include the newlines
    }

    // Priority 2: Look for sentence endings
    const sentenceEndings = ['. ', '! ', '? ', '.\n', '!\n', '?\n'];
    let bestSentenceBreak = -1;

    for (const ending of sentenceEndings) {
      const pos = text.lastIndexOf(ending, idealEnd);
      if (pos > searchStart && pos > start && pos > bestSentenceBreak) {
        bestSentenceBreak = pos + ending.length;
      }
    }

    if (bestSentenceBreak > 0) {
      return bestSentenceBreak;
    }

    // Priority 3: Look for line break
    const lineBreak = text.lastIndexOf('\n', idealEnd);
    if (lineBreak > searchStart && lineBreak > start) {
      return lineBreak + 1;
    }

    // Priority 4: Look for semicolon or colon
    const punctuation = ['; ', ': '];
    for (const punct of punctuation) {
      const pos = text.lastIndexOf(punct, idealEnd);
      if (pos > searchStart && pos > start) {
        return pos + punct.length;
      }
    }

    // Priority 5: Look for comma
    const comma = text.lastIndexOf(', ', idealEnd);
    if (comma > searchStart && comma > start) {
      return comma + 2;
    }

    // Priority 6: Look for space (word boundary)
    const space = text.lastIndexOf(' ', idealEnd);
    if (space > searchStart && space > start) {
      return space + 1;
    }

    // Fallback: Use ideal end position
    return idealEnd;
  }

  /**
   * Split text by paragraphs first, then by sentences if needed
   * @param {string} text - Text to split
   * @param {number} chunkSize - Target chunk size
   * @param {number} overlap - Overlap between chunks
   * @returns {Array<{content: string, startChar: number, endChar: number}>}
   */
  splitByParagraphs(text, chunkSize = 1000, overlap = 200) {
    if (!text || text.trim().length === 0) {
      return [];
    }

    const normalizedText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const paragraphs = normalizedText.split(/\n\n+/);

    const chunks = [];
    let currentChunk = '';
    let chunkStartChar = 0;
    let currentPosition = 0;

    for (const paragraph of paragraphs) {
      const trimmedParagraph = paragraph.trim();
      if (trimmedParagraph.length === 0) {
        currentPosition += paragraph.length + 2; // Account for \n\n
        continue;
      }

      // If adding this paragraph exceeds chunk size
      if (currentChunk.length + trimmedParagraph.length + 2 > chunkSize) {
        // Save current chunk if not empty
        if (currentChunk.trim().length > 0) {
          chunks.push({
            content: currentChunk.trim(),
            startChar: chunkStartChar,
            endChar: currentPosition
          });
        }

        // If single paragraph is larger than chunk size, split it
        if (trimmedParagraph.length > chunkSize) {
          const subChunks = this.splitIntoChunks(trimmedParagraph, chunkSize, overlap);
          for (const subChunk of subChunks) {
            chunks.push({
              content: subChunk.content,
              startChar: currentPosition + subChunk.startChar,
              endChar: currentPosition + subChunk.endChar
            });
          }
          currentChunk = '';
          chunkStartChar = currentPosition + trimmedParagraph.length;
        } else {
          // Start new chunk with overlap from previous
          const overlapText = this.getOverlapText(currentChunk, overlap);
          currentChunk = overlapText + (overlapText ? '\n\n' : '') + trimmedParagraph;
          chunkStartChar = currentPosition - overlapText.length;
        }
      } else {
        // Add paragraph to current chunk
        if (currentChunk.length > 0) {
          currentChunk += '\n\n' + trimmedParagraph;
        } else {
          currentChunk = trimmedParagraph;
          chunkStartChar = currentPosition;
        }
      }

      currentPosition += paragraph.length + 2;
    }

    // Add remaining chunk
    if (currentChunk.trim().length > 0) {
      chunks.push({
        content: currentChunk.trim(),
        startChar: chunkStartChar,
        endChar: normalizedText.length
      });
    }

    return chunks;
  }

  /**
   * Get overlap text from the end of a chunk
   * @param {string} text - Source text
   * @param {number} overlapSize - Desired overlap size
   * @returns {string} - Overlap text
   */
  getOverlapText(text, overlapSize) {
    if (!text || text.length <= overlapSize) {
      return text || '';
    }

    // Try to break at sentence boundary
    const start = text.length - overlapSize;
    const searchText = text.substring(start);

    // Find first sentence start
    const sentenceStarts = ['. ', '! ', '? '];
    let bestStart = -1;

    for (const marker of sentenceStarts) {
      const pos = searchText.indexOf(marker);
      if (pos >= 0 && (bestStart === -1 || pos < bestStart)) {
        bestStart = pos + marker.length;
      }
    }

    if (bestStart > 0 && bestStart < searchText.length) {
      return searchText.substring(bestStart).trim();
    }

    return searchText.trim();
  }

  /**
   * Estimate token count (rough approximation)
   * @param {string} text - Text to estimate
   * @returns {number} - Estimated token count
   */
  estimateTokenCount(text) {
    if (!text) return 0;
    // Rough estimate: ~4 characters per token for English
    return Math.ceil(text.length / 4);
  }
}

module.exports = new ChunkingService();
