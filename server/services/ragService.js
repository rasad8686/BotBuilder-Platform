/**
 * RAG Service
 * Retrieval-Augmented Generation for AI Chat
 */

const db = require('../db');
const embeddingService = require('../knowledge/EmbeddingService');
const vectorStore = require('../knowledge/VectorStore');
const log = require('../utils/logger');

class RAGService {
  /**
   * Check if query contains a barcode pattern (4-13 digits)
   * Supports: full barcode (13), partial (5-12), short code (4)
   * @param {string} query - User's query
   * @returns {Object|null} - { barcodes, type } or null
   */
  extractBarcodeFromQuery(query) {
    // Match ALL 13-digit barcodes (full EAN-13)
    const fullBarcodeMatches = query.match(/\d{13}/g);
    if (fullBarcodeMatches && fullBarcodeMatches.length > 0) {
      const uniqueBarcodes = [...new Set(fullBarcodeMatches)];
      return { barcodes: uniqueBarcodes, isShort: false, type: 'full' };
    }

    // Match partial barcodes (5-12 digits) - could be last digits of barcode
    const partialMatches = query.match(/\b\d{5,12}\b/g);
    if (partialMatches && partialMatches.length > 0) {
      const uniquePartials = [...new Set(partialMatches)];
      return { barcodes: uniquePartials, isShort: false, type: 'partial' };
    }

    // Match 4-digit short product codes
    const shortCodeMatches = query.match(/\b\d{4}\b/g);
    if (shortCodeMatches && shortCodeMatches.length > 0) {
      const uniqueCodes = [...new Set(shortCodeMatches)];
      return { barcodes: uniqueCodes, isShort: true, type: 'short' };
    }

    return null;
  }

  /**
   * Perform exact text search for barcode in chunks
   * Supports: full (13-digit), partial (5-12 digit), short (4-digit)
   * @param {Array} kbIds - Knowledge base IDs (can be empty for global search)
   * @param {string} barcode - Barcode or partial code to search
   * @param {boolean} isShort - Is this a 4-digit short code
   * @param {number} limit - Max results
   * @returns {Promise<Array>} - Matching chunks
   */
  async exactBarcodeSearch(kbIds, barcode, isShort = false, limit = 20) {
    log.info(`[RAG] Performing barcode search for: ${barcode} (isShort: ${isShort}, length: ${barcode.length})`);
    log.info(`[RAG] Knowledge base IDs: ${JSON.stringify(kbIds)}`);

    // Build search patterns based on input length
    let searchPatterns = [];
    const barcodeLength = barcode.length;

    if (barcodeLength === 13) {
      // Full barcode - exact match
      searchPatterns.push(`%${barcode}%`);
    } else if (barcodeLength >= 5 && barcodeLength <= 12) {
      // Partial barcode - could be last N digits
      // Try with common prefix 8698686
      searchPatterns.push(`%${barcode}%`);
      searchPatterns.push(`%8698686${barcode}%`);
      // If 6 digits, might be last 6 of barcode
      if (barcodeLength === 6) {
        searchPatterns.push(`%8698686%${barcode}%`);
      }
    } else if (barcodeLength === 4 || isShort) {
      // 4-digit short product code
      // Pattern 1: Direct match anywhere
      searchPatterns.push(`%${barcode}%`);
      // Pattern 2: As part of full barcode 8698686920XXX or 8698686921XXX etc
      searchPatterns.push(`%869868692${barcode}%`);
      // Pattern 3: Product code in ROW format [Barcode: 8698686921XXX]
      searchPatterns.push(`%8698686%${barcode}%`);
    } else {
      // Fallback - just search for the digits
      searchPatterns.push(`%${barcode}%`);
    }

    // Remove duplicates
    searchPatterns = [...new Set(searchPatterns)];
    log.debug(`[RAG] Search patterns: ${JSON.stringify(searchPatterns)}`);

    // Build OR conditions for all patterns
    const patternConditions = searchPatterns.map((_, i) => `c.content ILIKE $${i + 2}`).join(' OR ');

    let query;
    let params;

    if (kbIds && kbIds.length > 0) {
      // Search in specific knowledge bases
      query = `
        SELECT
          c.id, c.content, c.chunk_index, c.document_id,
          d.name as document_name,
          kb.name as knowledge_base_name, kb.id as knowledge_base_id,
          1.0 as similarity
        FROM chunks c
        JOIN documents d ON c.document_id = d.id
        JOIN knowledge_bases kb ON d.knowledge_base_id = kb.id
        WHERE kb.id = ANY($1::int[])
          AND (${patternConditions})
        ORDER BY c.id
        LIMIT $${searchPatterns.length + 2}
      `;
      params = [kbIds, ...searchPatterns, limit];
    } else {
      // Global search across ALL chunks (fallback)
      log.info(`[RAG] No KB IDs provided, searching ALL chunks globally`);
      query = `
        SELECT
          c.id, c.content, c.chunk_index, c.document_id,
          d.name as document_name,
          kb.name as knowledge_base_name, kb.id as knowledge_base_id,
          1.0 as similarity
        FROM chunks c
        JOIN documents d ON c.document_id = d.id
        JOIN knowledge_bases kb ON d.knowledge_base_id = kb.id
        WHERE (${patternConditions.replace(/\$(\d+)/g, (_, n) => `$${parseInt(n) - 1}`)})
        ORDER BY c.id
        LIMIT $${searchPatterns.length + 1}
      `;
      params = [...searchPatterns, limit];
    }

    try {
      const result = await db.query(query, params);
      log.info(`[RAG] Exact search found ${result.rows.length} matches for barcode ${barcode}`);

      if (result.rows.length > 0) {
        result.rows.forEach((row, i) => {
          log.debug(`[RAG] Match ${i + 1}: KB="${row.knowledge_base_name}", Doc="${row.document_name}"`);
        });
      }

      return result.rows;
    } catch (err) {
      log.error(`[RAG] Exact search error: ${err.message}`);
      return [];
    }
  }

  /**
   * Get relevant context from Knowledge Base for a query
   * @param {number} botId - Bot ID
   * @param {string} query - User's question/message
   * @param {Object} options - Search options
   * @returns {Promise<Object>} - { context, sources, hasContext }
   */
  async getContextForQuery(botId, query, options = {}) {
    const { maxChunks = 20, threshold = 0.7 } = options;

    log.info(`[RAG] ========== RAG SEARCH START ==========`);
    log.info(`[RAG] Bot ID: ${botId}`);
    log.info(`[RAG] Query: "${query.substring(0, 100)}..."`);
    log.info(`[RAG] Options: maxChunks=${maxChunks}, threshold=${threshold}`);

    try {
      // Get bot's linked knowledge base(s)
      const knowledgeBases = await this.getBotKnowledgeBases(botId);

      if (!knowledgeBases || knowledgeBases.length === 0) {
        log.info(`[RAG] No knowledge bases found for bot ${botId}`);
        return { context: null, sources: [], hasContext: false };
      }

      log.info(`[RAG] Found ${knowledgeBases.length} KB(s):`, knowledgeBases.map(kb => kb.name));

      const kbIds = knowledgeBases.map(kb => kb.id);

      // ============ BARCODE EXACT MATCH ============
      // Check if query contains barcode patterns (4 or 13 digits)
      const barcodeInfo = this.extractBarcodeFromQuery(query);

      if (barcodeInfo) {
        const { barcodes, isShort } = barcodeInfo;
        log.info(`[RAG] Barcodes detected: ${barcodes.join(', ')} (isShort: ${isShort}), trying EXACT MATCH...`);

        // Search for ALL barcodes and combine results
        let allExactResults = [];
        for (const barcode of barcodes) {
          let exactResults = await this.exactBarcodeSearch(kbIds, barcode, isShort, maxChunks);

          // If no results in linked KBs, try global search
          if ((!exactResults || exactResults.length === 0) && kbIds.length > 0) {
            exactResults = await this.exactBarcodeSearch([], barcode, isShort, maxChunks);
          }

          if (exactResults && exactResults.length > 0) {
            log.info(`[RAG] EXACT MATCH: Found ${exactResults.length} chunks for barcode ${barcode}`);
            allExactResults.push(...exactResults);
          }
        }

        // Remove duplicates by chunk id
        const uniqueResults = allExactResults.filter((chunk, index, self) =>
          index === self.findIndex(c => c.id === chunk.id)
        );

        if (uniqueResults.length > 0) {
          log.info(`[RAG] EXACT MATCH SUCCESS: Found ${uniqueResults.length} total chunks for ${barcodes.length} barcodes`);

          uniqueResults.forEach((r, i) => {
            log.debug(`[RAG] Exact Result ${i + 1}: doc="${r.document_name}"`);
          });

          const contextParts = uniqueResults.map((chunk, index) => {
            return `[Source ${index + 1}: ${chunk.document_name}]\n${chunk.content}`;
          });

          const context = contextParts.join('\n\n---\n\n');

          const sources = uniqueResults.map(chunk => ({
            documentName: chunk.document_name,
            knowledgeBaseName: chunk.knowledge_base_name,
            similarity: 1.0,
            chunkIndex: chunk.chunk_index
          }));

          log.info(`[RAG] Context built from EXACT MATCH: ${context.length} characters`);
          log.info(`[RAG] ========== RAG SEARCH END (EXACT MATCH) ==========`);

          return { context, sources, hasContext: true };
        }

        log.info(`[RAG] No exact match found for barcodes, falling back to vector search...`);
      }
      // ============ END BARCODE EXACT MATCH ============

      // Generate embedding for the query (vector search fallback)
      log.info(`[RAG] Generating embedding for query...`);
      const queryEmbedding = await embeddingService.getEmbedding(query);
      log.info(`[RAG] Embedding generated, length: ${queryEmbedding?.length || 0}`);

      // Search across all linked knowledge bases
      log.info(`[RAG] Searching in KB IDs:`, kbIds);

      const results = await vectorStore.multiKnowledgeBaseSearch(
        kbIds,
        queryEmbedding,
        { limit: maxChunks, threshold }
      );

      log.info(`[RAG] Search returned ${results?.length || 0} results`);

      if (!results || results.length === 0) {
        log.info(`[RAG] No chunks found above threshold ${threshold}`);
        return { context: null, sources: [], hasContext: false };
      }

      // Log similarity scores and content preview
      results.forEach((r, i) => {
        log.debug(`[RAG] Result ${i + 1}: similarity=${r.similarity?.toFixed(4)}, doc="${r.document_name}"`);
        log.debug(`[RAG] Content preview: "${r.content?.substring(0, 200)}..."`);
      });

      // Format context for AI prompt
      const contextParts = results.map((chunk, index) => {
        return `[Source ${index + 1}: ${chunk.document_name}]\n${chunk.content}`;
      });

      const context = contextParts.join('\n\n---\n\n');

      // Collect sources for citation
      const sources = results.map(chunk => ({
        documentName: chunk.document_name,
        knowledgeBaseName: chunk.knowledge_base_name,
        similarity: chunk.similarity,
        chunkIndex: chunk.chunk_index
      }));

      log.info(`[RAG] Context built: ${context.length} characters`);
      log.info(`[RAG] ========== RAG SEARCH END ==========`);

      return { context, sources, hasContext: true };

    } catch (error) {
      log.error('[RAG] ========== RAG ERROR ==========');
      log.error('[RAG] Error:', error.message);
      log.error('[RAG] Stack:', error.stack);
      // Don't fail the chat, just return no context
      return { context: null, sources: [], hasContext: false, error: error.message };
    }
  }

  /**
   * Get knowledge bases linked to a bot
   * @param {number} botId - Bot ID
   * @returns {Promise<Array>} - Array of knowledge bases
   */
  async getBotKnowledgeBases(botId) {
    try {
      log.info(`[RAG] Getting knowledge bases for bot ${botId}`);

      // First check if bot has a direct knowledge_base_id in ai_configurations
      const configResult = await db.query(
        `SELECT knowledge_base_id FROM ai_configurations WHERE bot_id = $1`,
        [botId]
      );

      log.debug(`[RAG] AI config result:`, configResult.rows);

      if (configResult.rows.length > 0 && configResult.rows[0].knowledge_base_id) {
        const kbId = configResult.rows[0].knowledge_base_id;
        log.info(`[RAG] Bot has linked KB: ${kbId}`);

        const kbResult = await db.query(
          `SELECT * FROM knowledge_bases WHERE id = $1`,
          [kbId]
        );
        log.debug(`[RAG] KB lookup result:`, kbResult.rows);
        return kbResult.rows;
      }

      log.info(`[RAG] No linked KB, trying global fallback...`);

      // Fallback: Get ALL knowledge bases (since org_id doesn't exist on kb table)
      const globalKbResult = await db.query(
        `SELECT * FROM knowledge_bases ORDER BY created_at DESC LIMIT 3`
      );

      log.debug(`[RAG] Global fallback result:`, globalKbResult.rows.map(r => ({ id: r.id, name: r.name })));
      return globalKbResult.rows;

    } catch (error) {
      log.error('[RAG] Error getting bot knowledge bases:', error.message);
      return [];
    }
  }

  /**
   * Build system prompt with RAG context
   * @param {string} originalPrompt - Original system prompt
   * @param {string} context - RAG context from knowledge base
   * @returns {string} - Enhanced system prompt
   */
  buildRAGPrompt(originalPrompt, context) {
    // NO CONTEXT - Anti-hallucination prompt
    if (!context) {
      return `${originalPrompt || 'You are a helpful assistant.'}

⚠️ CRITICAL RULE - NO HALLUCINATION:
You do NOT have access to any knowledge base or product database right now.
If the user asks about prices, barcodes, products, or specific data:
- Say: "Bu məlumat hazırda mənim bazamda yoxdur." (This information is not in my database)
- Do NOT make up prices, barcodes, or product information
- Do NOT guess or estimate values
- Suggest the user to check if a Knowledge Base is linked to this bot`;
    }

    const ragInstructions = `
You have access to the following knowledge base content. Use ONLY this information to answer questions.

⚠️ CRITICAL RULES - NO HALLUCINATION:
1. ONLY use information from the KNOWLEDGE BASE CONTENT below
2. If the requested barcode/product is NOT in the content below, say: "Bu barkod/məhsul bazamda tapılmadı."
3. Do NOT make up prices, products, or any data
4. Do NOT guess or estimate - only use EXACT values from the content
5. If user mentions a number like "1591" - this is a BARCODE, not a year!

HOW TO FIND BARCODE AND PRICE:
1. Search for the 13-digit barcode (like 8698686923236) in the text - it may be embedded in longer numbers
2. On the SAME LINE, find the caliber-price pattern at the END: [XXX-YYY][PRICE]
   - Caliber codes: 201-230, 231-260, 261-290, 291-320, 321-350, 351-380
   - Price follows immediately after caliber (no space)

EXAMPLES:
- "261-29011,00" = Caliber 261-290, Price 11,00 USD
- "291-3209,55" = Caliber 291-320, Price 9,55 USD
- "231-2608,45" = Caliber 231-260, Price 8,45 USD

REAL DATA EXAMPLE:
Line: "436386986869243632,0002,1002,35010,000433X33X174872291-3209,55 | 15/1 TIN"
- Barcode 8698686924363 is INSIDE "436386986869243632" (short code 4363 + barcode 8698686924363 + extra digit)
- Price is "291-3209,55" at the end = Caliber 291-320, Price 9,55 USD
- Product: 15/1 TIN (and more after |)

HOW TO FIND ANY BARCODE:
1. Search for "8698686924363" - it will appear INSIDE longer numbers
2. Look at THAT LINE and find the caliber-price pattern (like 291-3209,55)
3. Extract: caliber=291-320, price=9,55 USD

=== KNOWLEDGE BASE CONTENT ===
${context}
=== END KNOWLEDGE BASE ===

When answering:
1. Find the barcode (13 digits like 8698686923236) in the content
2. Look at the SAME LINE where the barcode appears
3. Find the LAST number on that line - format is [CALIBER]-[PRICE] like "261-29011,00"
4. The price is after the caliber code: "261-290" + "11,00" = 11,00 USD
5. If barcode not found, say "Bu barkod bazamda tapılmadı"

`;

    return ragInstructions + (originalPrompt || 'You are a helpful assistant.');
  }

  /**
   * Link a knowledge base to a bot
   * @param {number} botId - Bot ID
   * @param {number} knowledgeBaseId - Knowledge Base ID
   */
  async linkKnowledgeBase(botId, knowledgeBaseId) {
    await db.query(
      `UPDATE ai_configurations
       SET knowledge_base_id = $1, updated_at = NOW()
       WHERE bot_id = $2`,
      [knowledgeBaseId, botId]
    );
  }

  /**
   * Unlink knowledge base from a bot
   * @param {number} botId - Bot ID
   */
  async unlinkKnowledgeBase(botId) {
    await db.query(
      `UPDATE ai_configurations
       SET knowledge_base_id = NULL, updated_at = NOW()
       WHERE bot_id = $1`,
      [botId]
    );
  }
}

module.exports = new RAGService();
