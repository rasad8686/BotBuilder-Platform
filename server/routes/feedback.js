const express = require('express');
const router = express.Router();
const db = require('../db');
const authenticateToken = require('../middleware/auth');
const { organizationContext } = require('../middleware/organizationContext');
const nodemailer = require('nodemailer');

// Apply authentication middleware
router.use(authenticateToken);
router.use(organizationContext);

/**
 * POST /api/feedback
 * Submit user feedback
 *
 * Body:
 * - category: string (bug, feature, question, suggestion, other)
 * - message: string (required, min 10 characters)
 *
 * Auto-filled from auth:
 * - user_id
 * - organization_id
 * - name (from user context)
 * - email (from user context)
 */
router.post('/', async (req, res) => {
  try {
    const { category, message } = req.body;
    const userId = req.user.id;
    const organizationId = req.organization?.id || null;

    // Validation
    if (!category || !message) {
      return res.status(400).json({
        success: false,
        message: 'Category and message are required'
      });
    }

    // Validate category
    const validCategories = ['bug', 'feature', 'question', 'suggestion', 'other'];
    if (!validCategories.includes(category)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid category. Must be one of: ' + validCategories.join(', ')
      });
    }

    // Validate message length
    if (message.trim().length < 10) {
      return res.status(400).json({
        success: false,
        message: 'Message must be at least 10 characters long'
      });
    }

    if (message.trim().length > 5000) {
      return res.status(400).json({
        success: false,
        message: 'Message must not exceed 5000 characters'
      });
    }

    // Get user details
    const userResult = await db.query(
      'SELECT name, email FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const user = userResult.rows[0];
    const name = user.name;
    const email = user.email;

    // Insert feedback into database
    const insertQuery = `
      INSERT INTO feedback (user_id, organization_id, name, email, category, message, status, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, 'new', CURRENT_TIMESTAMP)
      RETURNING id, category, created_at
    `;

    const result = await db.query(insertQuery, [
      userId,
      organizationId,
      name,
      email,
      category,
      message.trim()
    ]);

    const feedback = result.rows[0];

    // Send email notification
    try {
      await sendFeedbackEmail({
        feedbackId: feedback.id,
        name,
        email,
        category,
        message: message.trim(),
        organizationId,
        createdAt: feedback.created_at
      });
    } catch (emailError) {
      // Log error but don't fail the request
      console.error('[FEEDBACK] Failed to send email notification:', emailError.message);
    }

    return res.status(201).json({
      success: true,
      message: 'Thank you for your feedback! We will review it shortly.',
      data: {
        id: feedback.id,
        category: feedback.category,
        submitted_at: feedback.created_at
      }
    });

  } catch (error) {
    console.error('[FEEDBACK] Error submitting feedback:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to submit feedback. Please try again later.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/feedback
 * Get all feedback submissions (admin only)
 * Query params: page, limit, status, category
 */
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;

    // Check if user is admin
    const userResult = await db.query(
      'SELECT role FROM users WHERE id = $1',
      [userId]
    );

    const isAdmin = userResult.rows[0]?.role === 'admin';

    // Build query
    let query = `
      SELECT
        f.id,
        f.name,
        f.email,
        f.category,
        f.message,
        f.status,
        f.created_at,
        u.name as user_name,
        o.name as organization_name
      FROM feedback f
      LEFT JOIN users u ON f.user_id = u.id
      LEFT JOIN organizations o ON f.organization_id = o.id
    `;

    const conditions = [];
    const values = [];
    let paramCount = 1;

    // If not admin, only show user's own feedback
    if (!isAdmin) {
      conditions.push(`f.user_id = $${paramCount}`);
      values.push(userId);
      paramCount++;
    }

    // Filter by status
    if (req.query.status) {
      conditions.push(`f.status = $${paramCount}`);
      values.push(req.query.status);
      paramCount++;
    }

    // Filter by category
    if (req.query.category) {
      conditions.push(`f.category = $${paramCount}`);
      values.push(req.query.category);
      paramCount++;
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY f.created_at DESC';

    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    query += ` LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    values.push(limit, offset);

    const result = await db.query(query, values);

    // Get total count
    let countQuery = 'SELECT COUNT(*) FROM feedback f';
    const countConditions = conditions.length > 0 ? ' WHERE ' + conditions.join(' AND ') : '';
    countQuery += countConditions;

    const countResult = await db.query(countQuery, values.slice(0, -2));
    const total = parseInt(countResult.rows[0].count);

    return res.status(200).json({
      success: true,
      data: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('[FEEDBACK] Error fetching feedback:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch feedback',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * Send feedback email notification
 */
async function sendFeedbackEmail({ feedbackId, name, email, category, message, organizationId, createdAt }) {
  // Check if email is configured
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log('[FEEDBACK] ⚠️ Email not configured - missing environment variables:');
    console.log('[FEEDBACK]   EMAIL_USER:', process.env.EMAIL_USER ? '✓ Set' : '✗ Missing');
    console.log('[FEEDBACK]   EMAIL_PASS:', process.env.EMAIL_PASS ? '✓ Set' : '✗ Missing');
    console.log('[FEEDBACK] Skipping email notification for feedback ID:', feedbackId);
    return;
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });

  const categoryEmojis = {
    bug: '🐛',
    feature: '✨',
    question: '❓',
    suggestion: '💡',
    other: '📝'
  };

  const categoryNames = {
    bug: 'Bug Report',
    feature: 'Feature Request',
    question: 'Question',
    suggestion: 'Suggestion',
    other: 'Other'
  };

  const emoji = categoryEmojis[category] || '📝';
  const categoryName = categoryNames[category] || category;

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: 'dunugojaev@gmail.com',
    subject: `${emoji} New Feedback: ${categoryName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px;">${emoji} New Feedback Received</h1>
        </div>

        <div style="padding: 30px; background: #f7f7f7;">
          <div style="background: white; padding: 25px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h2 style="color: #333; margin-top: 0; border-bottom: 2px solid #667eea; padding-bottom: 10px;">
              ${categoryName}
            </h2>

            <div style="margin: 20px 0;">
              <p style="margin: 8px 0; color: #666;">
                <strong style="color: #333;">From:</strong> ${name}
              </p>
              <p style="margin: 8px 0; color: #666;">
                <strong style="color: #333;">Email:</strong> ${email}
              </p>
              <p style="margin: 8px 0; color: #666;">
                <strong style="color: #333;">Feedback ID:</strong> #${feedbackId}
              </p>
              <p style="margin: 8px 0; color: #666;">
                <strong style="color: #333;">Organization ID:</strong> ${organizationId || 'N/A'}
              </p>
              <p style="margin: 8px 0; color: #666;">
                <strong style="color: #333;">Submitted:</strong> ${new Date(createdAt).toLocaleString()}
              </p>
            </div>

            <div style="margin-top: 25px; padding: 20px; background: #f9f9f9; border-left: 4px solid #667eea; border-radius: 4px;">
              <h3 style="color: #333; margin-top: 0; font-size: 16px;">Message:</h3>
              <p style="color: #555; line-height: 1.6; white-space: pre-wrap; margin: 0;">${message}</p>
            </div>
          </div>

          <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
            <p>This is an automated notification from BotBuilder Platform</p>
          </div>
        </div>
      </div>
    `
  };

  await transporter.sendMail(mailOptions);
  console.log(`[FEEDBACK] ✅ Email sent successfully for feedback ID: ${feedbackId}`);
}

module.exports = router;
