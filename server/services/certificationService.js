/**
 * @fileoverview Certification Service
 * @description Business logic for certification exams, scoring, and certificate issuance
 * @module services/certificationService
 */

const db = require('../db');
const log = require('../utils/logger');
const crypto = require('crypto');

class CertificationService {
  /**
   * Start a certification attempt
   * @param {number} userId - User ID
   * @param {number} certificationId - Certification ID
   * @returns {Object} Attempt with questions
   */
  async startAttempt(userId, certificationId) {
    // Get certification details
    const certResult = await db.query(
      `SELECT * FROM certifications WHERE id = $1 AND status = 'active'`,
      [certificationId]
    );

    if (certResult.rows.length === 0) {
      throw new Error('Certification not found or not active');
    }

    const certification = certResult.rows[0];

    // Check for existing in-progress attempt
    const existingAttempt = await db.query(
      `SELECT id FROM certification_attempts
       WHERE user_id = $1 AND certification_id = $2 AND status = 'in_progress'`,
      [userId, certificationId]
    );

    if (existingAttempt.rows.length > 0) {
      throw new Error('You already have an exam in progress');
    }

    // Check if user already has valid certification
    const existingCert = await db.query(
      `SELECT id FROM user_certifications
       WHERE user_id = $1 AND certification_id = $2
       AND expires_at > NOW() AND is_revoked = false`,
      [userId, certificationId]
    );

    if (existingCert.rows.length > 0) {
      throw new Error('You already have a valid certification');
    }

    // Get randomized questions
    const questionsResult = await db.query(
      `SELECT id, question, question_type, options, code_template, points
       FROM certification_questions
       WHERE certification_id = $1 AND is_active = true
       ORDER BY RANDOM()
       LIMIT $2`,
      [certificationId, certification.questions_count || 20]
    );

    // Create attempt
    const attemptResult = await db.query(
      `INSERT INTO certification_attempts
       (certification_id, user_id, started_at, status)
       VALUES ($1, $2, NOW(), 'in_progress')
       RETURNING *`,
      [certificationId, userId]
    );

    const attempt = attemptResult.rows[0];

    log.info('[CERTIFICATION] Attempt started', {
      userId,
      certificationId,
      attemptId: attempt.id
    });

    return {
      attempt: {
        id: attempt.id,
        started_at: attempt.started_at,
        time_limit: certification.time_limit
      },
      certification: {
        id: certification.id,
        name: certification.name,
        time_limit: certification.time_limit,
        required_score: certification.required_score
      },
      questions: questionsResult.rows.map((q, index) => ({
        id: q.id,
        number: index + 1,
        question: q.question,
        type: q.question_type,
        options: q.options,
        code_template: q.code_template,
        points: q.points
      })),
      total_questions: questionsResult.rows.length,
      total_points: questionsResult.rows.reduce((sum, q) => sum + q.points, 0)
    };
  }

  /**
   * Submit an answer for a question
   * @param {number} attemptId - Attempt ID
   * @param {number} questionId - Question ID
   * @param {any} answer - User's answer
   * @returns {Object} Updated answers
   */
  async submitAnswer(attemptId, questionId, answer) {
    // Get attempt
    const attemptResult = await db.query(
      `SELECT ca.*, c.time_limit
       FROM certification_attempts ca
       JOIN certifications c ON ca.certification_id = c.id
       WHERE ca.id = $1 AND ca.status = 'in_progress'`,
      [attemptId]
    );

    if (attemptResult.rows.length === 0) {
      throw new Error('Attempt not found or already completed');
    }

    const attempt = attemptResult.rows[0];

    // Check time limit
    if (attempt.time_limit) {
      const startTime = new Date(attempt.started_at).getTime();
      const now = Date.now();
      const elapsedMinutes = (now - startTime) / (1000 * 60);

      if (elapsedMinutes > attempt.time_limit) {
        // Auto-complete with timeout
        await this.completeAttempt(attemptId, true);
        throw new Error('Time limit exceeded. Exam has been submitted.');
      }
    }

    // Update answers in attempt
    const currentAnswers = attempt.answers || {};
    currentAnswers[questionId] = {
      answer,
      submitted_at: new Date().toISOString()
    };

    await db.query(
      `UPDATE certification_attempts SET answers = $1 WHERE id = $2`,
      [JSON.stringify(currentAnswers), attemptId]
    );

    return {
      success: true,
      answers_count: Object.keys(currentAnswers).length
    };
  }

  /**
   * Complete an attempt and calculate score
   * @param {number} attemptId - Attempt ID
   * @param {boolean} timedOut - Whether the attempt timed out
   * @returns {Object} Results
   */
  async completeAttempt(attemptId, timedOut = false) {
    // Get attempt with answers
    const attemptResult = await db.query(
      `SELECT ca.*, c.required_score, c.name as certification_name
       FROM certification_attempts ca
       JOIN certifications c ON ca.certification_id = c.id
       WHERE ca.id = $1`,
      [attemptId]
    );

    if (attemptResult.rows.length === 0) {
      throw new Error('Attempt not found');
    }

    const attempt = attemptResult.rows[0];

    if (attempt.status === 'completed') {
      throw new Error('Attempt already completed');
    }

    // Calculate score
    const scoreResult = await this.calculateScore(attemptId);

    // Update attempt
    const completedAt = new Date();
    const timeTaken = Math.floor(
      (completedAt.getTime() - new Date(attempt.started_at).getTime()) / 1000
    );

    await db.query(
      `UPDATE certification_attempts
       SET score = $1, points_earned = $2, total_points = $3,
           passed = $4, completed_at = $5, time_taken = $6,
           status = 'completed', answers = $7
       WHERE id = $8`,
      [
        scoreResult.percentage,
        scoreResult.points_earned,
        scoreResult.total_points,
        scoreResult.passed,
        completedAt,
        timeTaken,
        JSON.stringify(scoreResult.detailed_answers),
        attemptId
      ]
    );

    // Issue certificate if passed
    let certificate = null;
    if (scoreResult.passed) {
      certificate = await this.issueCertificate(
        attempt.user_id,
        attempt.certification_id,
        attemptId
      );
    }

    log.info('[CERTIFICATION] Attempt completed', {
      attemptId,
      score: scoreResult.percentage,
      passed: scoreResult.passed,
      timedOut
    });

    return {
      attempt_id: attemptId,
      certification_name: attempt.certification_name,
      score: scoreResult.percentage,
      points_earned: scoreResult.points_earned,
      total_points: scoreResult.total_points,
      required_score: attempt.required_score,
      passed: scoreResult.passed,
      time_taken: timeTaken,
      timed_out: timedOut,
      certificate: certificate ? {
        number: certificate.certificate_number,
        expires_at: certificate.expires_at
      } : null,
      detailed_results: scoreResult.detailed_answers
    };
  }

  /**
   * Calculate score for an attempt
   * @param {number} attemptId - Attempt ID
   * @returns {Object} Score details
   */
  async calculateScore(attemptId) {
    // Get attempt
    const attemptResult = await db.query(
      `SELECT ca.*, c.required_score
       FROM certification_attempts ca
       JOIN certifications c ON ca.certification_id = c.id
       WHERE ca.id = $1`,
      [attemptId]
    );

    const attempt = attemptResult.rows[0];
    const userAnswers = attempt.answers || {};

    // Get all questions for this certification that were asked
    const questionIds = Object.keys(userAnswers).map(Number);

    if (questionIds.length === 0) {
      return {
        percentage: 0,
        points_earned: 0,
        total_points: 0,
        passed: false,
        detailed_answers: {}
      };
    }

    const questionsResult = await db.query(
      `SELECT id, question, correct_answer, explanation, points
       FROM certification_questions
       WHERE id = ANY($1)`,
      [questionIds]
    );

    let pointsEarned = 0;
    let totalPoints = 0;
    const detailedAnswers = {};

    for (const question of questionsResult.rows) {
      totalPoints += question.points;
      const userAnswer = userAnswers[question.id]?.answer;
      const isCorrect = this.checkAnswer(userAnswer, question.correct_answer);

      if (isCorrect) {
        pointsEarned += question.points;
      }

      detailedAnswers[question.id] = {
        user_answer: userAnswer,
        correct_answer: question.correct_answer,
        is_correct: isCorrect,
        points: isCorrect ? question.points : 0,
        max_points: question.points,
        explanation: question.explanation
      };
    }

    const percentage = totalPoints > 0
      ? Math.round((pointsEarned / totalPoints) * 100)
      : 0;
    const passed = percentage >= attempt.required_score;

    return {
      percentage,
      points_earned: pointsEarned,
      total_points: totalPoints,
      passed,
      detailed_answers: detailedAnswers
    };
  }

  /**
   * Check if user answer is correct
   * @param {any} userAnswer - User's answer
   * @param {any} correctAnswer - Correct answer
   * @returns {boolean} Whether answer is correct
   */
  checkAnswer(userAnswer, correctAnswer) {
    if (userAnswer === undefined || userAnswer === null) {
      return false;
    }

    // Handle array answers (multiple choice)
    if (Array.isArray(correctAnswer)) {
      if (!Array.isArray(userAnswer)) {
        return false;
      }
      // Sort and compare
      const sortedUser = [...userAnswer].sort();
      const sortedCorrect = [...correctAnswer].sort();
      return JSON.stringify(sortedUser) === JSON.stringify(sortedCorrect);
    }

    // Handle string/number comparison
    if (typeof correctAnswer === 'string' || typeof correctAnswer === 'number') {
      return String(userAnswer).toLowerCase().trim() ===
             String(correctAnswer).toLowerCase().trim();
    }

    // Handle object comparison
    return JSON.stringify(userAnswer) === JSON.stringify(correctAnswer);
  }

  /**
   * Issue a certificate for a passed exam
   * @param {number} userId - User ID
   * @param {number} certificationId - Certification ID
   * @param {number} attemptId - Attempt ID
   * @returns {Object} Certificate details
   */
  async issueCertificate(userId, certificationId, attemptId) {
    // Get certification for validity period
    const certResult = await db.query(
      `SELECT validity_months FROM certifications WHERE id = $1`,
      [certificationId]
    );

    const validityMonths = certResult.rows[0]?.validity_months || 24;

    // Generate certificate number
    const certificateNumber = this.generateCertificateNumber(certificationId);

    // Calculate expiry date
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + validityMonths);

    // Check if certificate already exists
    const existingCert = await db.query(
      `SELECT id FROM user_certifications
       WHERE user_id = $1 AND certification_id = $2`,
      [userId, certificationId]
    );

    let certificate;

    if (existingCert.rows.length > 0) {
      // Update existing certificate
      const updateResult = await db.query(
        `UPDATE user_certifications
         SET attempt_id = $1, certificate_number = $2, issued_at = NOW(),
             expires_at = $3, is_revoked = false, revocation_reason = NULL
         WHERE user_id = $4 AND certification_id = $5
         RETURNING *`,
        [attemptId, certificateNumber, expiresAt, userId, certificationId]
      );
      certificate = updateResult.rows[0];
    } else {
      // Create new certificate
      const insertResult = await db.query(
        `INSERT INTO user_certifications
         (user_id, certification_id, attempt_id, certificate_number, expires_at)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [userId, certificationId, attemptId, certificateNumber, expiresAt]
      );
      certificate = insertResult.rows[0];
    }

    log.info('[CERTIFICATION] Certificate issued', {
      userId,
      certificationId,
      certificateNumber
    });

    return certificate;
  }

  /**
   * Generate a unique certificate number
   * @param {number} certificationId - Certification ID
   * @returns {string} Certificate number
   */
  generateCertificateNumber(certificationId) {
    const prefix = 'BB';
    const certCode = String(certificationId).padStart(3, '0');
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = crypto.randomBytes(2).toString('hex').toUpperCase();
    return `${prefix}-${certCode}-${timestamp}-${random}`;
  }

  /**
   * Verify a certificate by number
   * @param {string} certificateNumber - Certificate number
   * @returns {Object} Certificate details or null
   */
  async verifyCertificate(certificateNumber) {
    const result = await db.query(
      `SELECT
         uc.*,
         u.name as user_name,
         u.email as user_email,
         c.name as certification_name,
         c.level,
         c.badge_image,
         c.badge_color,
         ca.score
       FROM user_certifications uc
       JOIN users u ON uc.user_id = u.id
       JOIN certifications c ON uc.certification_id = c.id
       LEFT JOIN certification_attempts ca ON uc.attempt_id = ca.id
       WHERE uc.certificate_number = $1`,
      [certificateNumber]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const cert = result.rows[0];

    return {
      valid: !cert.is_revoked && new Date(cert.expires_at) > new Date(),
      certificate_number: cert.certificate_number,
      holder: cert.is_public ? cert.user_name : 'Private',
      certification: cert.certification_name,
      level: cert.level,
      score: cert.score,
      issued_at: cert.issued_at,
      expires_at: cert.expires_at,
      is_revoked: cert.is_revoked,
      revocation_reason: cert.revocation_reason,
      badge_image: cert.badge_image,
      badge_color: cert.badge_color
    };
  }

  /**
   * Get user's certifications
   * @param {number} userId - User ID
   * @returns {Array} User's certifications
   */
  async getUserCertifications(userId) {
    const result = await db.query(
      `SELECT
         uc.*,
         c.name as certification_name,
         c.slug,
         c.level,
         c.badge_image,
         c.badge_color,
         ca.score
       FROM user_certifications uc
       JOIN certifications c ON uc.certification_id = c.id
       LEFT JOIN certification_attempts ca ON uc.attempt_id = ca.id
       WHERE uc.user_id = $1
       ORDER BY uc.issued_at DESC`,
      [userId]
    );

    return result.rows.map(cert => ({
      ...cert,
      is_valid: !cert.is_revoked && new Date(cert.expires_at) > new Date(),
      is_expired: new Date(cert.expires_at) <= new Date()
    }));
  }

  /**
   * Get user's attempt history
   * @param {number} userId - User ID
   * @returns {Array} Attempt history
   */
  async getUserAttempts(userId) {
    const result = await db.query(
      `SELECT
         ca.*,
         c.name as certification_name,
         c.slug,
         c.level
       FROM certification_attempts ca
       JOIN certifications c ON ca.certification_id = c.id
       WHERE ca.user_id = $1
       ORDER BY ca.created_at DESC`,
      [userId]
    );

    return result.rows;
  }
}

module.exports = new CertificationService();
