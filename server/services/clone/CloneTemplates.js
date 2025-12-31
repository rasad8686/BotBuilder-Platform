/**
 * Clone Templates Service
 * Pre-built clone templates for quick start
 */

const db = require('../../db');
const log = require('../../utils/logger');

class CloneTemplates {
  constructor() {
    this.builtInTemplates = this._getBuiltInTemplates();
  }

  /**
   * Get all available templates
   * @param {Object} options - Filter options
   * @returns {Promise<Object>} Templates list
   */
  async getTemplates(options = {}) {
    try {
      const { category, type, search, includeBuiltIn = true, orgId } = options;

      let templates = [];

      // Add built-in templates
      if (includeBuiltIn) {
        templates = [...this.builtInTemplates];
      }

      // Get custom templates from database
      let query = `
        SELECT ct.*, u.name as created_by_name,
               (SELECT COUNT(*) FROM clone_template_usage WHERE template_id = ct.id) as use_count
        FROM clone_templates ct
        LEFT JOIN users u ON u.id = ct.created_by_user_id
        WHERE ct.is_active = true
      `;
      const params = [];

      if (orgId) {
        params.push(orgId);
        query += ` AND (ct.is_public = true OR ct.organization_id = $${params.length})`;
      } else {
        query += ` AND ct.is_public = true`;
      }

      if (category) {
        params.push(category);
        query += ` AND ct.category = $${params.length}`;
      }

      if (type) {
        params.push(type);
        query += ` AND ct.clone_type = $${params.length}`;
      }

      if (search) {
        params.push(`%${search}%`);
        query += ` AND (ct.name ILIKE $${params.length} OR ct.description ILIKE $${params.length})`;
      }

      query += ` ORDER BY ct.featured DESC, use_count DESC, ct.created_at DESC`;

      const result = await db.query(query, params);

      // Merge with built-in templates
      const customTemplates = result.rows.map(t => ({
        ...t,
        isBuiltIn: false,
        config: this._parseJson(t.config)
      }));

      templates = [...templates, ...customTemplates];

      // Apply category filter to built-in templates
      if (category) {
        templates = templates.filter(t => t.category === category);
      }

      if (type) {
        templates = templates.filter(t => t.cloneType === type);
      }

      if (search) {
        const searchLower = search.toLowerCase();
        templates = templates.filter(t =>
          t.name.toLowerCase().includes(searchLower) ||
          t.description.toLowerCase().includes(searchLower)
        );
      }

      return {
        success: true,
        templates,
        categories: this._getCategories(),
        types: ['voice', 'style', 'personality', 'full']
      };
    } catch (error) {
      log.error('Error getting templates', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Get single template by ID
   * @param {string} templateId - Template ID
   * @returns {Promise<Object>} Template data
   */
  async getTemplate(templateId) {
    try {
      // Check built-in templates first
      const builtIn = this.builtInTemplates.find(t => t.id === templateId);
      if (builtIn) {
        return { success: true, template: builtIn };
      }

      // Check database
      const result = await db.query(
        `SELECT * FROM clone_templates WHERE id = $1 AND is_active = true`,
        [templateId]
      );

      if (result.rows.length === 0) {
        return { success: false, error: 'Template not found' };
      }

      return {
        success: true,
        template: {
          ...result.rows[0],
          config: this._parseJson(result.rows[0].config),
          isBuiltIn: false
        }
      };
    } catch (error) {
      log.error('Error getting template', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Create clone from template
   * @param {string} templateId - Template ID
   * @param {string} userId - User ID
   * @param {string} orgId - Organization ID
   * @param {Object} customizations - Customization options
   * @returns {Promise<Object>} Created clone
   */
  async createFromTemplate(templateId, userId, orgId, customizations = {}) {
    try {
      const templateResult = await this.getTemplate(templateId);
      if (!templateResult.success) {
        return templateResult;
      }

      const template = templateResult.template;
      const config = template.config || template;

      // Create clone from template
      const result = await db.query(
        `INSERT INTO work_clones (
          organization_id, user_id, name, description,
          ai_model, temperature, max_tokens,
          base_system_prompt, personality_prompt, writing_style_prompt,
          tone_settings, settings, status, template_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING *`,
        [
          orgId,
          userId,
          customizations.name || `${template.name} Clone`,
          customizations.description || template.description,
          config.aiModel || 'gpt-4',
          config.temperature || 0.7,
          config.maxTokens || 2048,
          config.baseSystemPrompt || template.systemPrompt,
          config.personalityPrompt || template.personalityPrompt,
          config.writingStylePrompt || template.stylePrompt,
          JSON.stringify(config.toneSettings || {}),
          JSON.stringify({ ...config.settings, templateId }),
          'draft',
          template.isBuiltIn ? null : templateId
        ]
      );

      // Record template usage
      if (!template.isBuiltIn) {
        await db.query(
          `INSERT INTO clone_template_usage (template_id, user_id, clone_id)
           VALUES ($1, $2, $3)`,
          [templateId, userId, result.rows[0].id]
        );
      }

      return {
        success: true,
        clone: result.rows[0],
        message: `Clone created from template "${template.name}"`
      };
    } catch (error) {
      log.error('Error creating from template', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Create custom template from existing clone
   * @param {string} cloneId - Clone ID
   * @param {string} userId - User ID
   * @param {Object} templateData - Template metadata
   * @returns {Promise<Object>} Created template
   */
  async createTemplate(cloneId, userId, templateData) {
    try {
      // Get clone
      const cloneResult = await db.query(
        `SELECT * FROM work_clones WHERE id = $1 AND user_id = $2`,
        [cloneId, userId]
      );

      if (cloneResult.rows.length === 0) {
        return { success: false, error: 'Clone not found' };
      }

      const clone = cloneResult.rows[0];

      // Create template
      const result = await db.query(
        `INSERT INTO clone_templates (
          organization_id, created_by_user_id, name, description,
          category, clone_type, config, is_public, featured,
          thumbnail_url, tags
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *`,
        [
          clone.organization_id,
          userId,
          templateData.name || `${clone.name} Template`,
          templateData.description || clone.description,
          templateData.category || 'custom',
          templateData.cloneType || 'full',
          JSON.stringify({
            aiModel: clone.ai_model,
            temperature: clone.temperature,
            maxTokens: clone.max_tokens,
            baseSystemPrompt: clone.base_system_prompt,
            personalityPrompt: clone.personality_prompt,
            writingStylePrompt: clone.writing_style_prompt,
            styleProfile: this._parseJson(clone.style_profile),
            toneSettings: this._parseJson(clone.tone_settings),
            settings: this._parseJson(clone.settings)
          }),
          templateData.isPublic || false,
          false,
          templateData.thumbnailUrl,
          templateData.tags || []
        ]
      );

      return { success: true, template: result.rows[0] };
    } catch (error) {
      log.error('Error creating template', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Update template
   * @param {string} templateId - Template ID
   * @param {string} userId - User ID
   * @param {Object} updates - Template updates
   * @returns {Promise<Object>} Update result
   */
  async updateTemplate(templateId, userId, updates) {
    try {
      const result = await db.query(
        `UPDATE clone_templates SET
          name = COALESCE($1, name),
          description = COALESCE($2, description),
          category = COALESCE($3, category),
          config = COALESCE($4, config),
          is_public = COALESCE($5, is_public),
          thumbnail_url = COALESCE($6, thumbnail_url),
          tags = COALESCE($7, tags),
          updated_at = NOW()
        WHERE id = $8 AND created_by_user_id = $9
        RETURNING *`,
        [
          updates.name,
          updates.description,
          updates.category,
          updates.config ? JSON.stringify(updates.config) : null,
          updates.isPublic,
          updates.thumbnailUrl,
          updates.tags,
          templateId,
          userId
        ]
      );

      if (result.rows.length === 0) {
        return { success: false, error: 'Template not found or not authorized' };
      }

      return { success: true, template: result.rows[0] };
    } catch (error) {
      log.error('Error updating template', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Delete template
   * @param {string} templateId - Template ID
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Delete result
   */
  async deleteTemplate(templateId, userId) {
    try {
      const result = await db.query(
        `UPDATE clone_templates SET is_active = false
         WHERE id = $1 AND created_by_user_id = $2
         RETURNING id`,
        [templateId, userId]
      );

      if (result.rows.length === 0) {
        return { success: false, error: 'Template not found or not authorized' };
      }

      return { success: true, message: 'Template deleted' };
    } catch (error) {
      log.error('Error deleting template', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Get template categories
   * @private
   */
  _getCategories() {
    return [
      { id: 'business', name: 'Business & Professional', icon: 'briefcase' },
      { id: 'creative', name: 'Creative Writing', icon: 'edit' },
      { id: 'customer-service', name: 'Customer Service', icon: 'headphones' },
      { id: 'sales', name: 'Sales & Marketing', icon: 'trending-up' },
      { id: 'technical', name: 'Technical Support', icon: 'tool' },
      { id: 'education', name: 'Education', icon: 'book' },
      { id: 'healthcare', name: 'Healthcare', icon: 'heart' },
      { id: 'entertainment', name: 'Entertainment', icon: 'smile' },
      { id: 'custom', name: 'Custom', icon: 'star' }
    ];
  }

  /**
   * Get built-in templates
   * @private
   */
  _getBuiltInTemplates() {
    return [
      {
        id: 'professional-assistant',
        name: 'Professional Assistant',
        description: 'A polished, professional assistant suitable for business communications',
        category: 'business',
        cloneType: 'full',
        isBuiltIn: true,
        featured: true,
        config: {
          aiModel: 'gpt-4',
          temperature: 0.7,
          maxTokens: 2048,
          systemPrompt: 'You are a professional business assistant. Communicate clearly, concisely, and professionally. Use appropriate business language and maintain a helpful, solution-oriented approach.',
          personalityPrompt: 'Confident, knowledgeable, and efficient. You value clarity and precision in communication.',
          stylePrompt: 'Professional tone, clear structure, concise sentences. Use bullet points for lists. Avoid jargon unless industry-appropriate.',
          toneSettings: {
            formality: 0.8,
            friendliness: 0.6,
            assertiveness: 0.7,
            empathy: 0.6
          }
        }
      },
      {
        id: 'friendly-support',
        name: 'Friendly Support Agent',
        description: 'Warm and helpful customer support personality',
        category: 'customer-service',
        cloneType: 'personality',
        isBuiltIn: true,
        featured: true,
        config: {
          aiModel: 'gpt-4',
          temperature: 0.8,
          maxTokens: 2048,
          systemPrompt: 'You are a friendly and empathetic customer support agent. Your goal is to help customers feel heard and supported while solving their problems efficiently.',
          personalityPrompt: 'Warm, patient, and genuinely caring. You celebrate customer successes and show understanding during challenges.',
          stylePrompt: 'Conversational but professional. Use the customer\'s name. Express empathy. Provide clear step-by-step solutions.',
          toneSettings: {
            formality: 0.5,
            friendliness: 0.9,
            assertiveness: 0.5,
            empathy: 0.9
          }
        }
      },
      {
        id: 'creative-writer',
        name: 'Creative Writer',
        description: 'Imaginative and expressive writing style for content creation',
        category: 'creative',
        cloneType: 'style',
        isBuiltIn: true,
        featured: false,
        config: {
          aiModel: 'gpt-4',
          temperature: 0.9,
          maxTokens: 4096,
          systemPrompt: 'You are a creative writer with a vivid imagination and expressive style. Craft engaging content that captivates readers.',
          personalityPrompt: 'Imaginative, expressive, and thoughtful. You find unique angles and compelling narratives.',
          stylePrompt: 'Vivid descriptions, varied sentence structure, engaging hooks. Use metaphors and sensory details. Create emotional resonance.',
          toneSettings: {
            formality: 0.4,
            friendliness: 0.7,
            assertiveness: 0.6,
            empathy: 0.7
          }
        }
      },
      {
        id: 'sales-expert',
        name: 'Sales Expert',
        description: 'Persuasive and engaging sales communication style',
        category: 'sales',
        cloneType: 'full',
        isBuiltIn: true,
        featured: false,
        config: {
          aiModel: 'gpt-4',
          temperature: 0.7,
          maxTokens: 2048,
          systemPrompt: 'You are an experienced sales professional who builds relationships and provides value. Focus on understanding needs and offering genuine solutions.',
          personalityPrompt: 'Enthusiastic, trustworthy, and solution-focused. You listen actively and respond to customer needs.',
          stylePrompt: 'Engaging and persuasive. Ask thoughtful questions. Highlight benefits over features. Create urgency without pressure.',
          toneSettings: {
            formality: 0.6,
            friendliness: 0.8,
            assertiveness: 0.7,
            empathy: 0.7
          }
        }
      },
      {
        id: 'technical-expert',
        name: 'Technical Expert',
        description: 'Clear and precise technical communication',
        category: 'technical',
        cloneType: 'style',
        isBuiltIn: true,
        featured: false,
        config: {
          aiModel: 'gpt-4',
          temperature: 0.5,
          maxTokens: 4096,
          systemPrompt: 'You are a technical expert who can explain complex concepts clearly. Adapt your explanations to the audience\'s technical level.',
          personalityPrompt: 'Knowledgeable, precise, and patient. You enjoy breaking down complex topics into understandable parts.',
          stylePrompt: 'Clear and structured. Use examples and analogies. Define technical terms. Provide step-by-step explanations when needed.',
          toneSettings: {
            formality: 0.7,
            friendliness: 0.5,
            assertiveness: 0.6,
            empathy: 0.5
          }
        }
      },
      {
        id: 'educator',
        name: 'Patient Educator',
        description: 'Supportive and clear teaching style',
        category: 'education',
        cloneType: 'personality',
        isBuiltIn: true,
        featured: false,
        config: {
          aiModel: 'gpt-4',
          temperature: 0.6,
          maxTokens: 2048,
          systemPrompt: 'You are a patient and encouraging educator. Your goal is to help learners understand concepts and build confidence.',
          personalityPrompt: 'Patient, encouraging, and adaptive. You celebrate progress and provide constructive guidance.',
          stylePrompt: 'Clear explanations with examples. Break complex topics into steps. Use analogies. Encourage questions and provide positive reinforcement.',
          toneSettings: {
            formality: 0.5,
            friendliness: 0.8,
            assertiveness: 0.4,
            empathy: 0.8
          }
        }
      }
    ];
  }

  /**
   * Parse JSON safely
   * @private
   */
  _parseJson(value) {
    if (!value) return {};
    if (typeof value === 'object') return value;
    try {
      return JSON.parse(value);
    } catch {
      return {};
    }
  }
}

module.exports = CloneTemplates;
