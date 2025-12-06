/**
 * WriterAgent - Creates content based on input
 */

const Agent = require('../core/Agent');

class WriterAgent extends Agent {
  constructor(config) {
    super({
      ...config,
      role: config.role || 'writer',
      systemPrompt: config.systemPrompt || `You are a professional writing agent specialized in creating high-quality content.

Your responsibilities:
1. Create clear, engaging, and well-structured content
2. Adapt writing style and tone to match requirements
3. Write various content types: responses, articles, emails, documentation, etc.
4. Follow brand voice and style guidelines when provided
5. Ensure content is accurate, coherent, and purposeful

When creating content, consider:
- Target audience and their needs
- Appropriate tone (formal, casual, professional, friendly)
- Content structure and readability
- Key messages to convey
- Call to action if applicable

Respond with a JSON object:
{
  "contentType": "response|article|email|documentation|other",
  "title": "Content title if applicable",
  "content": "The main written content",
  "tone": "The tone used",
  "wordCount": 123,
  "keyPoints": ["Main points covered"],
  "metadata": {
    "readingTime": "2 min",
    "targetAudience": "Description of target audience"
  }
}`
    });

    this.styleGuide = config.styleGuide || null;
    this.tone = config.tone || 'professional';
  }

  /**
   * Set style guide for writing
   * @param {Object} styleGuide - Style guide reference
   */
  setStyleGuide(styleGuide) {
    this.styleGuide = styleGuide;
  }

  /**
   * Set default tone
   * @param {string} tone - Default tone for writing
   */
  setTone(tone) {
    this.tone = tone;
  }

  /**
   * Build prompt with style context
   */
  buildPrompt(input, context) {
    const basePrompt = super.buildPrompt(input, context);

    const styleContext = [];

    if (this.tone) {
      styleContext.push(`Default tone: ${this.tone}`);
    }

    if (this.styleGuide) {
      styleContext.push(`Style guide: ${JSON.stringify(this.styleGuide)}`);
    }

    if (styleContext.length > 0) {
      basePrompt.messages.splice(1, 0, {
        role: 'system',
        content: styleContext.join('\n')
      });
    }

    // Add available writing/communication tools
    if (this.loadedTools.length > 0) {
      const writerTools = this.loadedTools.filter(t =>
        ['email'].includes(t.type)
      );

      if (writerTools.length > 0) {
        const toolsInfo = writerTools.map(t =>
          `- ${t.name}: ${t.description || t.type}`
        ).join('\n');

        basePrompt.messages.splice(1, 0, {
          role: 'system',
          content: `Communication tools available:\n${toolsInfo}\n\nUse these tools to send emails or other communications.`
        });
      }
    }

    return basePrompt;
  }

  /**
   * Parse written content from output
   * @param {Object} output - Agent output
   * @returns {Object} - Parsed content
   */
  parseContent(output) {
    try {
      const data = output.type === 'json' ? output.data : JSON.parse(output.raw);
      return {
        valid: true,
        content: data
      };
    } catch {
      // If not JSON, return raw content as text
      return {
        valid: true,
        content: {
          contentType: 'text',
          content: output.raw,
          tone: this.tone
        }
      };
    }
  }
}

module.exports = WriterAgent;
