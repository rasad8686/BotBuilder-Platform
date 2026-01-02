/**
 * @fileoverview Certification Program Routes
 * @description API endpoints for certifications, exams, and certificates
 * @module routes/certifications
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const log = require('../utils/logger');
const jwt = require('jsonwebtoken');
const certificationService = require('../services/certificationService');

// ==========================================
// MIDDLEWARE: Authenticate User
// ==========================================
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ success: false, message: 'Invalid token' });
  }
};

// Optional authentication (for public endpoints that may show extra data to logged-in users)
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    try {
      req.user = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      // Invalid token, continue as anonymous
    }
  }
  next();
};

// ==========================================
// MIDDLEWARE: Admin Check
// ==========================================
const requireAdmin = async (req, res, next) => {
  try {
    const orgId = req.headers['x-organization-id'] || req.user.current_organization_id;

    const result = await db.query(
      `SELECT role FROM organization_members
       WHERE user_id = $1 AND org_id = $2 AND status = 'active'`,
      [req.user.id, orgId]
    );

    if (result.rows.length === 0 || result.rows[0].role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }

    next();
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ==========================================
// PUBLIC: List Certifications
// ==========================================
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { level, category, search } = req.query;

    let query = `
      SELECT
        c.*,
        (SELECT COUNT(*) FROM user_certifications WHERE certification_id = c.id) as holders_count
      FROM certifications c
      WHERE c.status = 'active'
    `;
    const params = [];
    let paramIndex = 1;

    if (level) {
      query += ` AND c.level = $${paramIndex}`;
      params.push(level);
      paramIndex++;
    }

    if (category) {
      query += ` AND c.category = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    }

    if (search) {
      query += ` AND (c.name ILIKE $${paramIndex} OR c.description ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    query += ` ORDER BY c.level, c.name`;

    const result = await db.query(query, params);

    // If user is logged in, add their status for each certification
    let userCertifications = {};
    if (req.user) {
      const userCertsResult = await db.query(
        `SELECT certification_id, expires_at, is_revoked
         FROM user_certifications
         WHERE user_id = $1`,
        [req.user.id]
      );
      userCertsResult.rows.forEach(uc => {
        userCertifications[uc.certification_id] = {
          certified: !uc.is_revoked && new Date(uc.expires_at) > new Date(),
          expires_at: uc.expires_at
        };
      });
    }

    res.json({
      success: true,
      certifications: result.rows.map(cert => ({
        ...cert,
        user_status: userCertifications[cert.id] || null
      }))
    });
  } catch (error) {
    log.error('[CERTIFICATIONS] List error', { error: error.message });
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ==========================================
// PUBLIC: Get Certification Detail
// ==========================================
router.get('/:slug', optionalAuth, async (req, res) => {
  try {
    const { slug } = req.params;

    const result = await db.query(
      `SELECT
         c.*,
         (SELECT COUNT(*) FROM user_certifications WHERE certification_id = c.id) as holders_count,
         (SELECT COUNT(*) FROM certification_attempts WHERE certification_id = c.id) as attempts_count
       FROM certifications c
       WHERE c.slug = $1 AND c.status = 'active'`,
      [slug]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Certification not found'
      });
    }

    const certification = result.rows[0];

    // Get study guide overview
    const guidesResult = await db.query(
      `SELECT id, title, estimated_time, order_num
       FROM certification_study_guides
       WHERE certification_id = $1 AND is_published = true
       ORDER BY order_num`,
      [certification.id]
    );

    // Check user's status if logged in
    let userStatus = null;
    if (req.user) {
      const userCertResult = await db.query(
        `SELECT * FROM user_certifications
         WHERE user_id = $1 AND certification_id = $2`,
        [req.user.id, certification.id]
      );

      const attemptsResult = await db.query(
        `SELECT id, score, passed, completed_at
         FROM certification_attempts
         WHERE user_id = $1 AND certification_id = $2 AND status = 'completed'
         ORDER BY completed_at DESC`,
        [req.user.id, certification.id]
      );

      userStatus = {
        is_certified: userCertResult.rows.length > 0 &&
          !userCertResult.rows[0].is_revoked &&
          new Date(userCertResult.rows[0].expires_at) > new Date(),
        certificate: userCertResult.rows[0] || null,
        attempts: attemptsResult.rows
      };
    }

    res.json({
      success: true,
      certification: {
        ...certification,
        study_guides: guidesResult.rows,
        user_status: userStatus
      }
    });
  } catch (error) {
    log.error('[CERTIFICATIONS] Detail error', { error: error.message });
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ==========================================
// PUBLIC: Get Study Guide
// ==========================================
router.get('/:slug/study-guide', optionalAuth, async (req, res) => {
  try {
    const { slug } = req.params;

    // Get certification
    const certResult = await db.query(
      `SELECT id, name FROM certifications WHERE slug = $1 AND status = 'active'`,
      [slug]
    );

    if (certResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Certification not found'
      });
    }

    const certification = certResult.rows[0];

    // Get study guides
    const guidesResult = await db.query(
      `SELECT *
       FROM certification_study_guides
       WHERE certification_id = $1 AND is_published = true
       ORDER BY order_num`,
      [certification.id]
    );

    // Track progress if user is logged in
    let progress = null;
    if (req.user) {
      const progressResult = await db.query(
        `SELECT * FROM certification_progress
         WHERE user_id = $1 AND certification_id = $2`,
        [req.user.id, certification.id]
      );
      progress = progressResult.rows[0] || { completed_guides: [], study_time: 0 };
    }

    res.json({
      success: true,
      certification: {
        id: certification.id,
        name: certification.name
      },
      guides: guidesResult.rows,
      progress
    });
  } catch (error) {
    log.error('[CERTIFICATIONS] Study guide error', { error: error.message });
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ==========================================
// PUBLIC: Verify Certificate
// ==========================================
router.get('/verify/:number', async (req, res) => {
  try {
    const { number } = req.params;

    const result = await certificationService.verifyCertificate(number);

    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Certificate not found'
      });
    }

    res.json({
      success: true,
      certificate: result
    });
  } catch (error) {
    log.error('[CERTIFICATIONS] Verify error', { error: error.message });
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ==========================================
// AUTHENTICATED: Start Exam
// ==========================================
router.post('/:slug/start', authenticateToken, async (req, res) => {
  try {
    const { slug } = req.params;

    // Get certification ID
    const certResult = await db.query(
      `SELECT id FROM certifications WHERE slug = $1 AND status = 'active'`,
      [slug]
    );

    if (certResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Certification not found'
      });
    }

    const result = await certificationService.startAttempt(
      req.user.id,
      certResult.rows[0].id
    );

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    log.error('[CERTIFICATIONS] Start exam error', { error: error.message });
    res.status(400).json({ success: false, message: error.message });
  }
});

// ==========================================
// AUTHENTICATED: Submit Answer
// ==========================================
router.post('/attempts/:id/submit', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { question_id, answer } = req.body;

    // Verify ownership
    const attemptCheck = await db.query(
      `SELECT user_id FROM certification_attempts WHERE id = $1`,
      [id]
    );

    if (attemptCheck.rows.length === 0 || attemptCheck.rows[0].user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const result = await certificationService.submitAnswer(id, question_id, answer);

    res.json(result);
  } catch (error) {
    log.error('[CERTIFICATIONS] Submit answer error', { error: error.message });
    res.status(400).json({ success: false, message: error.message });
  }
});

// ==========================================
// AUTHENTICATED: Complete Exam
// ==========================================
router.post('/attempts/:id/complete', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Verify ownership
    const attemptCheck = await db.query(
      `SELECT user_id FROM certification_attempts WHERE id = $1`,
      [id]
    );

    if (attemptCheck.rows.length === 0 || attemptCheck.rows[0].user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const result = await certificationService.completeAttempt(id);

    res.json({
      success: true,
      results: result
    });
  } catch (error) {
    log.error('[CERTIFICATIONS] Complete exam error', { error: error.message });
    res.status(400).json({ success: false, message: error.message });
  }
});

// ==========================================
// AUTHENTICATED: View Results
// ==========================================
router.get('/attempts/:id/results', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT
         ca.*,
         c.name as certification_name,
         c.slug,
         c.level,
         c.required_score,
         c.badge_image,
         c.badge_color
       FROM certification_attempts ca
       JOIN certifications c ON ca.certification_id = c.id
       WHERE ca.id = $1 AND ca.user_id = $2`,
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Attempt not found'
      });
    }

    const attempt = result.rows[0];

    // Get certificate if passed
    let certificate = null;
    if (attempt.passed) {
      const certResult = await db.query(
        `SELECT certificate_number, issued_at, expires_at
         FROM user_certifications
         WHERE attempt_id = $1`,
        [id]
      );
      certificate = certResult.rows[0] || null;
    }

    // Get questions with explanations
    const questionIds = Object.keys(attempt.answers || {}).map(Number);
    let questions = [];

    if (questionIds.length > 0) {
      const questionsResult = await db.query(
        `SELECT id, question, question_type, options, correct_answer, explanation, points
         FROM certification_questions
         WHERE id = ANY($1)`,
        [questionIds]
      );
      questions = questionsResult.rows;
    }

    res.json({
      success: true,
      attempt: {
        id: attempt.id,
        certification_name: attempt.certification_name,
        slug: attempt.slug,
        level: attempt.level,
        score: attempt.score,
        points_earned: attempt.points_earned,
        total_points: attempt.total_points,
        required_score: attempt.required_score,
        passed: attempt.passed,
        time_taken: attempt.time_taken,
        started_at: attempt.started_at,
        completed_at: attempt.completed_at,
        badge_image: attempt.badge_image,
        badge_color: attempt.badge_color
      },
      answers: attempt.answers,
      questions,
      certificate
    });
  } catch (error) {
    log.error('[CERTIFICATIONS] Results error', { error: error.message });
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ==========================================
// AUTHENTICATED: My Certifications
// ==========================================
router.get('/my/certificates', authenticateToken, async (req, res) => {
  try {
    const certifications = await certificationService.getUserCertifications(req.user.id);

    res.json({
      success: true,
      certifications
    });
  } catch (error) {
    log.error('[CERTIFICATIONS] My certs error', { error: error.message });
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ==========================================
// AUTHENTICATED: My Attempts
// ==========================================
router.get('/my/attempts', authenticateToken, async (req, res) => {
  try {
    const attempts = await certificationService.getUserAttempts(req.user.id);

    res.json({
      success: true,
      attempts
    });
  } catch (error) {
    log.error('[CERTIFICATIONS] My attempts error', { error: error.message });
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ==========================================
// AUTHENTICATED: Download Certificate PDF
// ==========================================
router.get('/my/:id/certificate', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT
         uc.*,
         u.name as user_name,
         c.name as certification_name,
         c.level,
         c.badge_image,
         ca.score
       FROM user_certifications uc
       JOIN users u ON uc.user_id = u.id
       JOIN certifications c ON uc.certification_id = c.id
       LEFT JOIN certification_attempts ca ON uc.attempt_id = ca.id
       WHERE uc.id = $1 AND uc.user_id = $2`,
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Certificate not found'
      });
    }

    // Return certificate data (PDF generation would happen on client or separate service)
    res.json({
      success: true,
      certificate: result.rows[0]
    });
  } catch (error) {
    log.error('[CERTIFICATIONS] Download cert error', { error: error.message });
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ==========================================
// ADMIN: Create Certification
// ==========================================
router.post('/admin', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const {
      name, slug, description, level, required_score, time_limit,
      questions_count, price, badge_image, badge_color, validity_months,
      prerequisites, skills, category
    } = req.body;

    const result = await db.query(
      `INSERT INTO certifications
       (name, slug, description, level, required_score, time_limit,
        questions_count, price, badge_image, badge_color, validity_months,
        prerequisites, skills, category, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'draft')
       RETURNING *`,
      [
        name, slug, description, level || 'beginner', required_score || 70,
        time_limit, questions_count || 20, price || 0, badge_image,
        badge_color || '#3B82F6', validity_months || 24,
        JSON.stringify(prerequisites || []), JSON.stringify(skills || []), category
      ]
    );

    log.info('[CERTIFICATIONS ADMIN] Created', { id: result.rows[0].id, name });

    res.status(201).json({
      success: true,
      certification: result.rows[0]
    });
  } catch (error) {
    log.error('[CERTIFICATIONS ADMIN] Create error', { error: error.message });
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ==========================================
// ADMIN: Update Certification
// ==========================================
router.put('/admin/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const allowedFields = [
      'name', 'slug', 'description', 'level', 'required_score', 'time_limit',
      'questions_count', 'price', 'badge_image', 'badge_color', 'validity_months',
      'prerequisites', 'skills', 'category', 'status'
    ];

    const setClauses = [];
    const params = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        setClauses.push(`${key} = $${paramIndex}`);
        params.push(key === 'prerequisites' || key === 'skills' ? JSON.stringify(value) : value);
        paramIndex++;
      }
    }

    if (setClauses.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update'
      });
    }

    setClauses.push(`updated_at = NOW()`);
    params.push(id);

    const result = await db.query(
      `UPDATE certifications SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Certification not found'
      });
    }

    res.json({
      success: true,
      certification: result.rows[0]
    });
  } catch (error) {
    log.error('[CERTIFICATIONS ADMIN] Update error', { error: error.message });
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ==========================================
// ADMIN: Add Question
// ==========================================
router.post('/admin/:id/questions', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      question, question_type, options, correct_answer,
      explanation, code_template, points, order_num
    } = req.body;

    const result = await db.query(
      `INSERT INTO certification_questions
       (certification_id, question, question_type, options, correct_answer,
        explanation, code_template, points, order_num)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        id, question, question_type || 'single',
        JSON.stringify(options || []), JSON.stringify(correct_answer),
        explanation, code_template, points || 1, order_num || 0
      ]
    );

    res.status(201).json({
      success: true,
      question: result.rows[0]
    });
  } catch (error) {
    log.error('[CERTIFICATIONS ADMIN] Add question error', { error: error.message });
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ==========================================
// ADMIN: Update Question
// ==========================================
router.put('/admin/questions/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const allowedFields = [
      'question', 'question_type', 'options', 'correct_answer',
      'explanation', 'code_template', 'points', 'order_num', 'is_active'
    ];

    const setClauses = [];
    const params = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        setClauses.push(`${key} = $${paramIndex}`);
        params.push(
          key === 'options' || key === 'correct_answer'
            ? JSON.stringify(value)
            : value
        );
        paramIndex++;
      }
    }

    if (setClauses.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update'
      });
    }

    params.push(id);

    const result = await db.query(
      `UPDATE certification_questions SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Question not found'
      });
    }

    res.json({
      success: true,
      question: result.rows[0]
    });
  } catch (error) {
    log.error('[CERTIFICATIONS ADMIN] Update question error', { error: error.message });
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
