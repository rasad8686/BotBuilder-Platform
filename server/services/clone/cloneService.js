/**
 * Clone Service
 * Orchestrates all clone operations - voice, style, personality
 */

const db = require('../../db');
const log = require('../../utils/logger');
const VoiceCloneEngine = require('./VoiceCloneEngine');
const StyleCloneEngine = require('./StyleCloneEngine');
const PersonalityEngine = require('./PersonalityEngine');
const CloneEngine = require('./CloneEngine');
const TrainingService = require('./TrainingService');

class CloneService {
  constructor() {
    this.voiceEngine = new VoiceCloneEngine();
    this.styleEngine = new StyleCloneEngine();
    this.personalityEngine = new PersonalityEngine();
    this.cloneEngine = new CloneEngine();
    this.trainingService = new TrainingService();
  }

  // ==========================================
  // CLONE JOB MANAGEMENT
  // ==========================================

  /**
   * Create a new clone job
   */
  async createCloneJob(params) {
    const {
      organizationId,
      userId,
      botId,
      name,
      description,
      type, // 'voice', 'style', 'personality', 'full'
      config = {}
    } = params;

    try {
      const result = await db.query(
        `INSERT INTO clone_jobs (
          organization_id, user_id, bot_id, name, description,
          type, status, config, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7, NOW())
        RETURNING *`,
        [organizationId, userId, botId, name, description, type, JSON.stringify(config)]
      );

      const job = result.rows[0];

      // Create type-specific profile
      await this.createTypeProfile(job.id, type, config);

      log.info('Clone job created', { jobId: job.id, type });
      return { success: true, job };
    } catch (error) {
      log.error('Error creating clone job', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Create type-specific profile for clone job
   */
  async createTypeProfile(cloneJobId, type, config = {}) {
    try {
      switch (type) {
        case 'voice':
          await db.query(
            `INSERT INTO voice_clone_profiles (clone_job_id, language, voice_provider)
             VALUES ($1, $2, $3)`,
            [cloneJobId, config.language || 'en', config.voiceProvider || 'elevenlabs']
          );
          break;

        case 'style':
          await db.query(
            `INSERT INTO style_clone_profiles (clone_job_id, formality_level, tone)
             VALUES ($1, $2, $3)`,
            [cloneJobId, config.formalityLevel || 'neutral', config.tone || 'professional']
          );
          break;

        case 'personality':
          await db.query(
            `INSERT INTO personality_clone_profiles (clone_job_id, personality_name)
             VALUES ($1, $2)`,
            [cloneJobId, config.personalityName || 'Custom Personality']
          );
          break;

        case 'full':
          // Create all three profiles
          await db.query(
            `INSERT INTO voice_clone_profiles (clone_job_id) VALUES ($1)`,
            [cloneJobId]
          );
          await db.query(
            `INSERT INTO style_clone_profiles (clone_job_id) VALUES ($1)`,
            [cloneJobId]
          );
          await db.query(
            `INSERT INTO personality_clone_profiles (clone_job_id) VALUES ($1)`,
            [cloneJobId]
          );
          break;
      }
    } catch (error) {
      log.error('Error creating type profile', { error: error.message, cloneJobId, type });
      throw error;
    }
  }

  /**
   * Get clone job by ID
   */
  async getCloneJob(jobId, userId = null) {
    try {
      let query = `
        SELECT cj.*,
          vcp.voice_id, vcp.voice_name, vcp.language, vcp.voice_provider,
          scp.formality_level, scp.tone, scp.vocabulary_complexity,
          pcp.personality_name, pcp.traits, pcp.system_prompt
        FROM clone_jobs cj
        LEFT JOIN voice_clone_profiles vcp ON vcp.clone_job_id = cj.id
        LEFT JOIN style_clone_profiles scp ON scp.clone_job_id = cj.id
        LEFT JOIN personality_clone_profiles pcp ON pcp.clone_job_id = cj.id
        WHERE cj.id = $1
      `;
      const params = [jobId];

      if (userId) {
        query += ' AND cj.user_id = $2';
        params.push(userId);
      }

      const result = await db.query(query, params);

      if (result.rows.length === 0) {
        return { success: false, error: 'Clone job not found' };
      }

      return { success: true, job: result.rows[0] };
    } catch (error) {
      log.error('Error getting clone job', { error: error.message, jobId });
      return { success: false, error: error.message };
    }
  }

  /**
   * Get all clone jobs for organization
   */
  async getCloneJobs(organizationId, options = {}) {
    const { type, status, limit = 50, offset = 0 } = options;

    try {
      let query = `
        SELECT cj.*,
          (SELECT COUNT(*) FROM clone_samples WHERE clone_job_id = cj.id) as sample_count,
          (SELECT COUNT(*) FROM clone_versions WHERE clone_job_id = cj.id) as version_count
        FROM clone_jobs cj
        WHERE cj.organization_id = $1
      `;
      const params = [organizationId];
      let paramIndex = 2;

      if (type) {
        query += ` AND cj.type = $${paramIndex}`;
        params.push(type);
        paramIndex++;
      }

      if (status) {
        query += ` AND cj.status = $${paramIndex}`;
        params.push(status);
        paramIndex++;
      }

      query += ` ORDER BY cj.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);

      const result = await db.query(query, params);

      return { success: true, jobs: result.rows };
    } catch (error) {
      log.error('Error getting clone jobs', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Update clone job status
   */
  async updateJobStatus(jobId, status, additionalData = {}) {
    try {
      const updates = ['status = $2', 'updated_at = NOW()'];
      const params = [jobId, status];
      let paramIndex = 3;

      if (additionalData.trainingProgress !== undefined) {
        updates.push(`training_progress = $${paramIndex}`);
        params.push(additionalData.trainingProgress);
        paramIndex++;
      }

      if (additionalData.errorMessage) {
        updates.push(`error_message = $${paramIndex}`);
        params.push(additionalData.errorMessage);
        paramIndex++;
      }

      if (additionalData.modelPath) {
        updates.push(`model_path = $${paramIndex}`);
        params.push(additionalData.modelPath);
        paramIndex++;
      }

      if (additionalData.metrics) {
        updates.push(`metrics = $${paramIndex}`);
        params.push(JSON.stringify(additionalData.metrics));
        paramIndex++;
      }

      if (status === 'training' && !additionalData.skipTimestamp) {
        updates.push('training_started_at = NOW()');
      }

      if (status === 'ready') {
        updates.push('training_completed_at = NOW()');
      }

      const result = await db.query(
        `UPDATE clone_jobs SET ${updates.join(', ')} WHERE id = $1 RETURNING *`,
        params
      );

      return { success: true, job: result.rows[0] };
    } catch (error) {
      log.error('Error updating job status', { error: error.message, jobId });
      return { success: false, error: error.message };
    }
  }

  // ==========================================
  // SAMPLE MANAGEMENT
  // ==========================================

  /**
   * Add sample to clone job
   */
  async addSample(params) {
    const {
      cloneJobId,
      type, // 'audio', 'text', 'chat_history', 'document', 'email'
      filePath,
      fileName,
      fileSize,
      mimeType,
      content,
      durationSeconds,
      metadata = {}
    } = params;

    try {
      const result = await db.query(
        `INSERT INTO clone_samples (
          clone_job_id, type, file_path, file_name, file_size,
          mime_type, content, duration_seconds, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *`,
        [
          cloneJobId, type, filePath, fileName, fileSize,
          mimeType, content, durationSeconds, JSON.stringify(metadata)
        ]
      );

      return { success: true, sample: result.rows[0] };
    } catch (error) {
      log.error('Error adding sample', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Get samples for clone job
   */
  async getSamples(cloneJobId, type = null) {
    try {
      let query = 'SELECT * FROM clone_samples WHERE clone_job_id = $1';
      const params = [cloneJobId];

      if (type) {
        query += ' AND type = $2';
        params.push(type);
      }

      query += ' ORDER BY created_at DESC';

      const result = await db.query(query, params);
      return { success: true, samples: result.rows };
    } catch (error) {
      log.error('Error getting samples', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Delete sample
   */
  async deleteSample(sampleId, cloneJobId) {
    try {
      const result = await db.query(
        'DELETE FROM clone_samples WHERE id = $1 AND clone_job_id = $2 RETURNING id',
        [sampleId, cloneJobId]
      );

      if (result.rows.length === 0) {
        return { success: false, error: 'Sample not found' };
      }

      return { success: true };
    } catch (error) {
      log.error('Error deleting sample', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  // ==========================================
  // VOICE CLONING
  // ==========================================

  /**
   * Start voice clone training
   */
  async trainVoiceClone(jobId, userId) {
    try {
      const jobResult = await this.getCloneJob(jobId, userId);
      if (!jobResult.success) return jobResult;

      const job = jobResult.job;
      if (job.type !== 'voice' && job.type !== 'full') {
        return { success: false, error: 'Invalid job type for voice cloning' };
      }

      // Get audio samples
      const samplesResult = await this.getSamples(jobId, 'audio');
      if (!samplesResult.success) return samplesResult;

      if (samplesResult.samples.length < 1) {
        return { success: false, error: 'At least 1 audio sample required for voice cloning' };
      }

      // Update status
      await this.updateJobStatus(jobId, 'processing');

      // Process samples
      const processedSamples = [];
      for (const sample of samplesResult.samples) {
        const processed = await this.voiceEngine.processAudioSample(sample.file_path, {
          sampleId: sample.id,
          targetDuration: 30
        });

        if (processed.success) {
          processedSamples.push(processed);

          // Update sample with processed data
          await db.query(
            `UPDATE clone_samples SET
              processed = true,
              processed_data = $1,
              quality_score = $2
            WHERE id = $3`,
            [JSON.stringify(processed.features), processed.qualityScore, sample.id]
          );
        }
      }

      if (processedSamples.length === 0) {
        await this.updateJobStatus(jobId, 'failed', { errorMessage: 'Failed to process audio samples' });
        return { success: false, error: 'Failed to process audio samples' };
      }

      // Update to training status
      await this.updateJobStatus(jobId, 'training', { trainingProgress: 10 });

      // Train voice clone
      const trainingResult = await this.voiceEngine.trainVoiceClone(
        processedSamples.map(s => s.processedPath || s.originalPath),
        {
          cloneJobId: jobId,
          name: job.name,
          onProgress: async (progress) => {
            await this.updateJobStatus(jobId, 'training', {
              trainingProgress: progress,
              skipTimestamp: true
            });
          }
        }
      );

      if (!trainingResult.success) {
        await this.updateJobStatus(jobId, 'failed', { errorMessage: trainingResult.error });
        return trainingResult;
      }

      // Update voice profile
      await db.query(
        `UPDATE voice_clone_profiles SET
          voice_id = $1,
          voice_name = $2,
          provider_voice_id = $3,
          audio_settings = $4,
          updated_at = NOW()
        WHERE clone_job_id = $5`,
        [
          trainingResult.voiceId,
          job.name,
          trainingResult.providerVoiceId,
          JSON.stringify(trainingResult.settings || {}),
          jobId
        ]
      );

      // Create version
      await this.createVersion(jobId, {
        modelPath: trainingResult.modelPath,
        config: trainingResult.settings,
        metrics: trainingResult.metrics,
        samplesCount: processedSamples.length
      });

      // Update job status to ready
      await this.updateJobStatus(jobId, 'ready', {
        modelPath: trainingResult.modelPath,
        metrics: trainingResult.metrics,
        trainingProgress: 100
      });

      return { success: true, voiceId: trainingResult.voiceId };
    } catch (error) {
      log.error('Error training voice clone', { error: error.message, jobId });
      await this.updateJobStatus(jobId, 'failed', { errorMessage: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Synthesize speech using voice clone
   */
  async synthesizeVoice(jobId, text, options = {}) {
    try {
      const jobResult = await this.getCloneJob(jobId);
      if (!jobResult.success) return jobResult;

      const job = jobResult.job;
      if (job.status !== 'ready') {
        return { success: false, error: 'Voice clone is not ready' };
      }

      const result = await this.voiceEngine.synthesize(text, {
        voiceId: job.voice_id || job.provider_voice_id,
        ...options
      });

      // Log usage
      await this.logUsage(jobId, {
        userInput: text,
        outputType: 'audio',
        latencyMs: result.latencyMs
      });

      return result;
    } catch (error) {
      log.error('Error synthesizing voice', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  // ==========================================
  // STYLE CLONING
  // ==========================================

  /**
   * Start style clone training
   */
  async trainStyleClone(jobId, userId) {
    try {
      const jobResult = await this.getCloneJob(jobId, userId);
      if (!jobResult.success) return jobResult;

      const job = jobResult.job;
      if (job.type !== 'style' && job.type !== 'full') {
        return { success: false, error: 'Invalid job type for style cloning' };
      }

      // Get text samples
      const samplesResult = await this.getSamples(jobId);
      if (!samplesResult.success) return samplesResult;

      const textSamples = samplesResult.samples.filter(s =>
        ['text', 'email', 'document', 'chat_history'].includes(s.type)
      );

      if (textSamples.length < 3) {
        return { success: false, error: 'At least 3 text samples required for style cloning' };
      }

      // Update status
      await this.updateJobStatus(jobId, 'processing');

      // Analyze samples
      const analyzedSamples = [];
      for (const sample of textSamples) {
        const content = sample.content || sample.file_path;
        if (!content) continue;

        const analysis = await this.styleEngine.analyzeText(content);
        if (analysis.success) {
          analyzedSamples.push({
            ...sample,
            analysis: analysis.analysis
          });

          // Update sample
          await db.query(
            `UPDATE clone_samples SET
              processed = true,
              processed_data = $1,
              quality_score = $2
            WHERE id = $3`,
            [JSON.stringify(analysis.analysis), analysis.qualityScore || 0.8, sample.id]
          );
        }
      }

      // Update to training status
      await this.updateJobStatus(jobId, 'training', { trainingProgress: 20 });

      // Train style clone
      const trainingResult = await this.styleEngine.trainStyleClone(
        analyzedSamples.map(s => s.content || ''),
        {
          cloneJobId: jobId,
          onProgress: async (progress) => {
            await this.updateJobStatus(jobId, 'training', {
              trainingProgress: progress,
              skipTimestamp: true
            });
          }
        }
      );

      if (!trainingResult.success) {
        await this.updateJobStatus(jobId, 'failed', { errorMessage: trainingResult.error });
        return trainingResult;
      }

      // Update style profile
      const profile = trainingResult.styleProfile;
      await db.query(
        `UPDATE style_clone_profiles SET
          formality_level = $1,
          tone = $2,
          vocabulary_complexity = $3,
          avg_sentence_length = $4,
          avg_paragraph_length = $5,
          use_contractions = $6,
          use_emoji = $7,
          common_phrases = $8,
          signature_patterns = $9,
          style_vector = $10,
          updated_at = NOW()
        WHERE clone_job_id = $11`,
        [
          profile.formalityLevel || 'neutral',
          profile.tone || 'professional',
          profile.vocabularyComplexity || 'medium',
          profile.avgSentenceLength || 15,
          profile.avgParagraphLength || 4,
          profile.useContractions !== false,
          profile.useEmoji || false,
          JSON.stringify(profile.commonPhrases || []),
          JSON.stringify(profile.signaturePatterns || []),
          JSON.stringify(profile.styleVector || {}),
          jobId
        ]
      );

      // Create version
      await this.createVersion(jobId, {
        config: profile,
        metrics: trainingResult.metrics,
        samplesCount: analyzedSamples.length
      });

      // Update job status to ready
      await this.updateJobStatus(jobId, 'ready', {
        metrics: trainingResult.metrics,
        trainingProgress: 100
      });

      return { success: true, styleProfile: profile };
    } catch (error) {
      log.error('Error training style clone', { error: error.message, jobId });
      await this.updateJobStatus(jobId, 'failed', { errorMessage: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Generate text using style clone
   */
  async generateWithStyle(jobId, prompt, options = {}) {
    try {
      const jobResult = await this.getCloneJob(jobId);
      if (!jobResult.success) return jobResult;

      const job = jobResult.job;
      if (job.status !== 'ready') {
        return { success: false, error: 'Style clone is not ready' };
      }

      // Get style profile
      const profileResult = await db.query(
        'SELECT * FROM style_clone_profiles WHERE clone_job_id = $1',
        [jobId]
      );

      if (profileResult.rows.length === 0) {
        return { success: false, error: 'Style profile not found' };
      }

      const result = await this.styleEngine.generateWithStyle(prompt, {
        styleProfile: profileResult.rows[0],
        ...options
      });

      // Log usage
      if (result.success) {
        await this.logUsage(jobId, {
          userInput: prompt,
          generatedOutput: result.text,
          outputType: 'text',
          tokensUsed: result.tokensUsed,
          latencyMs: result.latencyMs
        });
      }

      return result;
    } catch (error) {
      log.error('Error generating with style', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  // ==========================================
  // PERSONALITY CLONING
  // ==========================================

  /**
   * Start personality clone training
   */
  async trainPersonalityClone(jobId, userId) {
    try {
      const jobResult = await this.getCloneJob(jobId, userId);
      if (!jobResult.success) return jobResult;

      const job = jobResult.job;
      if (job.type !== 'personality' && job.type !== 'full') {
        return { success: false, error: 'Invalid job type for personality cloning' };
      }

      // Get samples
      const samplesResult = await this.getSamples(jobId);
      if (!samplesResult.success) return samplesResult;

      const conversationSamples = samplesResult.samples.filter(s =>
        ['chat_history', 'text', 'email'].includes(s.type)
      );

      if (conversationSamples.length < 5) {
        return { success: false, error: 'At least 5 conversation samples required' };
      }

      // Update status
      await this.updateJobStatus(jobId, 'processing');

      // Analyze conversations
      const conversations = conversationSamples.map(s => {
        try {
          return s.content ? JSON.parse(s.content) : [];
        } catch {
          return [{ role: 'user', content: s.content }];
        }
      });

      const analysisResult = await this.personalityEngine.analyzeConversations(conversations);
      if (!analysisResult.success) {
        await this.updateJobStatus(jobId, 'failed', { errorMessage: analysisResult.error });
        return analysisResult;
      }

      // Update to training status
      await this.updateJobStatus(jobId, 'training', { trainingProgress: 30 });

      // Create personality profile
      const profileResult = await this.personalityEngine.createPersonalityProfile(
        analysisResult.analysis,
        {
          name: job.name,
          onProgress: async (progress) => {
            await this.updateJobStatus(jobId, 'training', {
              trainingProgress: 30 + Math.floor(progress * 0.7),
              skipTimestamp: true
            });
          }
        }
      );

      if (!profileResult.success) {
        await this.updateJobStatus(jobId, 'failed', { errorMessage: profileResult.error });
        return profileResult;
      }

      const profile = profileResult.profile;

      // Update personality profile in DB
      await db.query(
        `UPDATE personality_clone_profiles SET
          personality_name = $1,
          traits = $2,
          tone_settings = $3,
          response_patterns = $4,
          greeting_templates = $5,
          farewell_templates = $6,
          humor_level = $7,
          empathy_level = $8,
          formality_level = $9,
          enthusiasm_level = $10,
          directness_level = $11,
          system_prompt = $12,
          personality_prompt = $13,
          example_conversations = $14,
          updated_at = NOW()
        WHERE clone_job_id = $15`,
        [
          job.name,
          JSON.stringify(profile.traits || {}),
          JSON.stringify(profile.toneSettings || {}),
          JSON.stringify(profile.responsePatterns || {}),
          JSON.stringify(profile.greetingTemplates || []),
          JSON.stringify(profile.farewellTemplates || []),
          profile.humorLevel || 5,
          profile.empathyLevel || 5,
          profile.formalityLevel || 5,
          profile.enthusiasmLevel || 5,
          profile.directnessLevel || 5,
          profile.systemPrompt || '',
          profile.personalityPrompt || '',
          JSON.stringify(profile.exampleConversations || []),
          jobId
        ]
      );

      // Create version
      await this.createVersion(jobId, {
        config: profile,
        metrics: profileResult.metrics,
        samplesCount: conversationSamples.length
      });

      // Update job status to ready
      await this.updateJobStatus(jobId, 'ready', {
        metrics: profileResult.metrics,
        trainingProgress: 100
      });

      return { success: true, profile };
    } catch (error) {
      log.error('Error training personality clone', { error: error.message, jobId });
      await this.updateJobStatus(jobId, 'failed', { errorMessage: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Generate response using personality clone
   */
  async generateWithPersonality(jobId, message, conversationHistory = []) {
    try {
      const jobResult = await this.getCloneJob(jobId);
      if (!jobResult.success) return jobResult;

      const job = jobResult.job;
      if (job.status !== 'ready') {
        return { success: false, error: 'Personality clone is not ready' };
      }

      // Get personality profile
      const profileResult = await db.query(
        'SELECT * FROM personality_clone_profiles WHERE clone_job_id = $1',
        [jobId]
      );

      if (profileResult.rows.length === 0) {
        return { success: false, error: 'Personality profile not found' };
      }

      const profile = profileResult.rows[0];

      const result = await this.personalityEngine.generateResponse(message, {
        systemPrompt: profile.system_prompt,
        traits: profile.traits,
        responsePatterns: profile.response_patterns,
        conversationHistory
      });

      // Log usage
      if (result.success) {
        await this.logUsage(jobId, {
          userInput: message,
          generatedOutput: result.response,
          outputType: 'chat',
          tokensUsed: result.tokensUsed,
          latencyMs: result.latencyMs
        });
      }

      return result;
    } catch (error) {
      log.error('Error generating with personality', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  // ==========================================
  // VERSION MANAGEMENT
  // ==========================================

  /**
   * Create a new version for clone job
   */
  async createVersion(cloneJobId, data = {}) {
    try {
      // Get current version number
      const versionResult = await db.query(
        'SELECT MAX(version) as max_version FROM clone_versions WHERE clone_job_id = $1',
        [cloneJobId]
      );

      const nextVersion = (versionResult.rows[0].max_version || 0) + 1;

      const result = await db.query(
        `INSERT INTO clone_versions (
          clone_job_id, version, model_path, config, metrics,
          training_samples_count, is_active
        ) VALUES ($1, $2, $3, $4, $5, $6, true)
        RETURNING *`,
        [
          cloneJobId,
          nextVersion,
          data.modelPath || null,
          JSON.stringify(data.config || {}),
          JSON.stringify(data.metrics || {}),
          data.samplesCount || 0
        ]
      );

      // Deactivate previous versions
      await db.query(
        'UPDATE clone_versions SET is_active = false WHERE clone_job_id = $1 AND id != $2',
        [cloneJobId, result.rows[0].id]
      );

      return { success: true, version: result.rows[0] };
    } catch (error) {
      log.error('Error creating version', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Get versions for clone job
   */
  async getVersions(cloneJobId) {
    try {
      const result = await db.query(
        'SELECT * FROM clone_versions WHERE clone_job_id = $1 ORDER BY version DESC',
        [cloneJobId]
      );

      return { success: true, versions: result.rows };
    } catch (error) {
      log.error('Error getting versions', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Activate a specific version
   */
  async activateVersion(cloneJobId, versionId) {
    try {
      // Deactivate all versions
      await db.query(
        'UPDATE clone_versions SET is_active = false WHERE clone_job_id = $1',
        [cloneJobId]
      );

      // Activate specified version
      const result = await db.query(
        'UPDATE clone_versions SET is_active = true WHERE id = $1 AND clone_job_id = $2 RETURNING *',
        [versionId, cloneJobId]
      );

      if (result.rows.length === 0) {
        return { success: false, error: 'Version not found' };
      }

      return { success: true, version: result.rows[0] };
    } catch (error) {
      log.error('Error activating version', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  // ==========================================
  // APPLICATION MANAGEMENT
  // ==========================================

  /**
   * Apply clone to bot
   */
  async applyToBot(cloneJobId, botId, userId) {
    try {
      const jobResult = await this.getCloneJob(cloneJobId);
      if (!jobResult.success) return jobResult;

      if (jobResult.job.status !== 'ready') {
        return { success: false, error: 'Clone is not ready to be applied' };
      }

      // Get active version
      const versionResult = await db.query(
        'SELECT id, config FROM clone_versions WHERE clone_job_id = $1 AND is_active = true',
        [cloneJobId]
      );

      const versionId = versionResult.rows[0]?.id || null;
      const configSnapshot = versionResult.rows[0]?.config || {};

      // Create application record
      const result = await db.query(
        `INSERT INTO clone_applications (
          clone_job_id, clone_version_id, bot_id, applied_by, config_snapshot
        ) VALUES ($1, $2, $3, $4, $5)
        RETURNING *`,
        [cloneJobId, versionId, botId, userId, configSnapshot]
      );

      // Update bot with clone settings
      await this.applyCloneToBot(botId, jobResult.job);

      log.info('Clone applied to bot', { cloneJobId, botId });
      return { success: true, application: result.rows[0] };
    } catch (error) {
      log.error('Error applying clone to bot', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Apply clone settings to bot
   */
  async applyCloneToBot(botId, cloneJob) {
    try {
      const updates = [];
      const params = [botId];
      let paramIndex = 2;

      // Get personality profile if exists
      if (cloneJob.type === 'personality' || cloneJob.type === 'full') {
        const profileResult = await db.query(
          'SELECT system_prompt, personality_prompt FROM personality_clone_profiles WHERE clone_job_id = $1',
          [cloneJob.id]
        );

        if (profileResult.rows.length > 0) {
          const profile = profileResult.rows[0];
          if (profile.system_prompt) {
            updates.push(`system_prompt = $${paramIndex}`);
            params.push(profile.system_prompt);
            paramIndex++;
          }
          if (profile.personality_prompt) {
            updates.push(`personality_prompt = $${paramIndex}`);
            params.push(profile.personality_prompt);
            paramIndex++;
          }
        }
      }

      // Get voice profile if exists
      if (cloneJob.type === 'voice' || cloneJob.type === 'full') {
        const voiceResult = await db.query(
          'SELECT voice_id, voice_provider FROM voice_clone_profiles WHERE clone_job_id = $1',
          [cloneJob.id]
        );

        if (voiceResult.rows.length > 0) {
          const voice = voiceResult.rows[0];
          if (voice.voice_id) {
            updates.push(`voice_id = $${paramIndex}`);
            params.push(voice.voice_id);
            paramIndex++;
          }
        }
      }

      if (updates.length > 0) {
        await db.query(
          `UPDATE bots SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $1`,
          params
        );
      }

      return { success: true };
    } catch (error) {
      log.error('Error applying clone to bot', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Remove clone from bot
   */
  async removeFromBot(applicationId, userId) {
    try {
      const result = await db.query(
        `UPDATE clone_applications SET
          is_active = false,
          removed_at = NOW(),
          removed_by = $1
        WHERE id = $2
        RETURNING *`,
        [userId, applicationId]
      );

      if (result.rows.length === 0) {
        return { success: false, error: 'Application not found' };
      }

      return { success: true };
    } catch (error) {
      log.error('Error removing clone from bot', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  // ==========================================
  // USAGE LOGGING & ANALYTICS
  // ==========================================

  /**
   * Log clone usage
   */
  async logUsage(cloneJobId, data = {}) {
    try {
      await db.query(
        `INSERT INTO clone_usage_logs (
          clone_job_id, user_input, generated_output, output_type,
          tokens_used, latency_ms, session_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          cloneJobId,
          data.userInput,
          data.generatedOutput,
          data.outputType,
          data.tokensUsed,
          data.latencyMs,
          data.sessionId
        ]
      );
    } catch (error) {
      log.error('Error logging usage', { error: error.message });
    }
  }

  /**
   * Get usage statistics
   */
  async getUsageStats(cloneJobId, options = {}) {
    const { startDate, endDate, groupBy = 'day' } = options;

    try {
      let query = `
        SELECT
          COUNT(*) as total_uses,
          SUM(tokens_used) as total_tokens,
          AVG(latency_ms)::int as avg_latency,
          AVG(similarity_score)::decimal(3,2) as avg_similarity,
          COUNT(DISTINCT session_id) as unique_sessions
        FROM clone_usage_logs
        WHERE clone_job_id = $1
      `;
      const params = [cloneJobId];
      let paramIndex = 2;

      if (startDate) {
        query += ` AND created_at >= $${paramIndex}`;
        params.push(startDate);
        paramIndex++;
      }

      if (endDate) {
        query += ` AND created_at <= $${paramIndex}`;
        params.push(endDate);
        paramIndex++;
      }

      const result = await db.query(query, params);

      return { success: true, stats: result.rows[0] };
    } catch (error) {
      log.error('Error getting usage stats', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  // ==========================================
  // A/B TESTING
  // ==========================================

  /**
   * Create A/B test
   */
  async createABTest(params) {
    const {
      organizationId,
      name,
      description,
      botId,
      variantACloneId,
      variantBCloneId,
      trafficSplit = 50,
      startDate,
      endDate,
      createdBy
    } = params;

    try {
      const result = await db.query(
        `INSERT INTO clone_ab_tests (
          organization_id, name, description, bot_id,
          variant_a_clone_id, variant_b_clone_id, traffic_split,
          start_date, end_date, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *`,
        [
          organizationId, name, description, botId,
          variantACloneId, variantBCloneId, trafficSplit,
          startDate, endDate, createdBy
        ]
      );

      return { success: true, test: result.rows[0] };
    } catch (error) {
      log.error('Error creating A/B test', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Get A/B test results
   */
  async getABTestResults(testId) {
    try {
      const testResult = await db.query(
        'SELECT * FROM clone_ab_tests WHERE id = $1',
        [testId]
      );

      if (testResult.rows.length === 0) {
        return { success: false, error: 'A/B test not found' };
      }

      const test = testResult.rows[0];

      // Get stats for variant A
      const variantAStats = await this.getUsageStats(test.variant_a_clone_id, {
        startDate: test.start_date,
        endDate: test.end_date
      });

      // Get stats for variant B
      const variantBStats = await this.getUsageStats(test.variant_b_clone_id, {
        startDate: test.start_date,
        endDate: test.end_date
      });

      return {
        success: true,
        test,
        results: {
          variantA: variantAStats.stats,
          variantB: variantBStats.stats
        }
      };
    } catch (error) {
      log.error('Error getting A/B test results', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Delete clone job
   */
  async deleteCloneJob(jobId, userId) {
    try {
      const result = await db.query(
        'DELETE FROM clone_jobs WHERE id = $1 AND user_id = $2 RETURNING id',
        [jobId, userId]
      );

      if (result.rows.length === 0) {
        return { success: false, error: 'Clone job not found' };
      }

      log.info('Clone job deleted', { jobId });
      return { success: true };
    } catch (error) {
      log.error('Error deleting clone job', { error: error.message });
      return { success: false, error: error.message };
    }
  }
}

module.exports = CloneService;
