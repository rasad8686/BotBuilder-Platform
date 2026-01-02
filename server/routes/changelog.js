/**
 * @fileoverview Changelog Routes
 * @description API endpoints for changelog/release notes
 * @module routes/changelog
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const log = require('../utils/logger');
const { authenticateToken } = require('../middleware/auth');

// =============================================================================
// PUBLIC ENDPOINTS
// =============================================================================

/**
 * GET /api/changelog
 * Get public changelog (paginated)
 */
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 10, type, category, search } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let whereClause = 'WHERE is_published = true';
    const params = [];
    let paramIndex = 1;

    if (type) {
      whereClause += ` AND type = $${paramIndex++}`;
      params.push(type);
    }

    if (category) {
      whereClause += ` AND category = $${paramIndex++}`;
      params.push(category);
    }

    if (search) {
      whereClause += ` AND (title ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    // Get total count
    const countResult = await db.query(
      `SELECT COUNT(*) as total FROM changelog_entries ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].total);

    // Get entries
    const entriesResult = await db.query(
      `SELECT id, version, title, description, type, category, is_breaking, published_at, created_at
       FROM changelog_entries
       ${whereClause}
       ORDER BY published_at DESC, created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      [...params, parseInt(limit), offset]
    );

    // Get items for each entry
    const entries = await Promise.all(
      entriesResult.rows.map(async (entry) => {
        const itemsResult = await db.query(
          `SELECT id, content, api_endpoint, created_at
           FROM changelog_items
           WHERE changelog_entry_id = $1
           ORDER BY created_at ASC`,
          [entry.id]
        );
        return {
          ...entry,
          items: itemsResult.rows
        };
      })
    );

    res.json({
      success: true,
      data: {
        entries,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / parseInt(limit))
        }
      }
    });

  } catch (error) {
    log.error('[CHANGELOG] Error fetching changelog:', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch changelog'
    });
  }
});

/**
 * GET /api/changelog/latest
 * Get latest version
 */
router.get('/latest', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, version, title, description, type, category, is_breaking, published_at, created_at
       FROM changelog_entries
       WHERE is_published = true
       ORDER BY published_at DESC
       LIMIT 1`
    );

    if (result.rows.length === 0) {
      return res.json({
        success: true,
        data: null
      });
    }

    const entry = result.rows[0];

    // Get items
    const itemsResult = await db.query(
      `SELECT id, content, api_endpoint, created_at
       FROM changelog_items
       WHERE changelog_entry_id = $1
       ORDER BY created_at ASC`,
      [entry.id]
    );

    res.json({
      success: true,
      data: {
        ...entry,
        items: itemsResult.rows
      }
    });

  } catch (error) {
    log.error('[CHANGELOG] Error fetching latest:', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch latest changelog'
    });
  }
});

/**
 * GET /api/changelog/rss
 * RSS feed for changelog
 */
router.get('/rss', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, version, title, description, type, category, is_breaking, published_at
       FROM changelog_entries
       WHERE is_published = true
       ORDER BY published_at DESC
       LIMIT 20`
    );

    const baseUrl = `${req.protocol}://${req.get('host')}`;

    let rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>BotBuilder Changelog</title>
    <link>${baseUrl}/changelog</link>
    <description>Latest updates and releases for BotBuilder</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${baseUrl}/api/changelog/rss" rel="self" type="application/rss+xml"/>
`;

    for (const entry of result.rows) {
      const pubDate = entry.published_at ? new Date(entry.published_at).toUTCString() : new Date(entry.created_at).toUTCString();
      const typeLabel = entry.type ? `[${entry.type.toUpperCase()}] ` : '';

      rss += `    <item>
      <title>${escapeXml(typeLabel + entry.title)}</title>
      <link>${baseUrl}/changelog/${entry.version}</link>
      <guid>${baseUrl}/changelog/${entry.version}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${escapeXml(entry.description || entry.title)}</description>
    </item>
`;
    }

    rss += `  </channel>
</rss>`;

    res.set('Content-Type', 'application/rss+xml');
    res.send(rss);

  } catch (error) {
    log.error('[CHANGELOG] Error generating RSS:', { error: error.message });
    res.status(500).send('Failed to generate RSS feed');
  }
});

/**
 * GET /api/changelog/:version
 * Get specific version
 */
router.get('/:version', async (req, res) => {
  try {
    const { version } = req.params;

    const result = await db.query(
      `SELECT id, version, title, description, type, category, is_breaking, published_at, created_at
       FROM changelog_entries
       WHERE version = $1 AND is_published = true`,
      [version]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Version not found'
      });
    }

    const entry = result.rows[0];

    // Get items
    const itemsResult = await db.query(
      `SELECT id, content, api_endpoint, created_at
       FROM changelog_items
       WHERE changelog_entry_id = $1
       ORDER BY created_at ASC`,
      [entry.id]
    );

    res.json({
      success: true,
      data: {
        ...entry,
        items: itemsResult.rows
      }
    });

  } catch (error) {
    log.error('[CHANGELOG] Error fetching version:', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch changelog version'
    });
  }
});

// =============================================================================
// ADMIN ENDPOINTS
// =============================================================================

/**
 * GET /api/admin/changelog
 * Get all changelog entries (including unpublished) - Admin only
 */
router.get('/admin/list', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const countResult = await db.query(
      'SELECT COUNT(*) as total FROM changelog_entries'
    );
    const total = parseInt(countResult.rows[0].total);

    const result = await db.query(
      `SELECT id, version, title, description, type, category, is_breaking, is_published, published_at, created_at
       FROM changelog_entries
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [parseInt(limit), offset]
    );

    // Get items for each entry
    const entries = await Promise.all(
      result.rows.map(async (entry) => {
        const itemsResult = await db.query(
          `SELECT id, content, api_endpoint, created_at
           FROM changelog_items
           WHERE changelog_entry_id = $1
           ORDER BY created_at ASC`,
          [entry.id]
        );
        return {
          ...entry,
          items: itemsResult.rows
        };
      })
    );

    res.json({
      success: true,
      data: {
        entries,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / parseInt(limit))
        }
      }
    });

  } catch (error) {
    log.error('[CHANGELOG] Error fetching admin list:', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch changelog entries'
    });
  }
});

/**
 * POST /api/admin/changelog
 * Create new changelog entry - Admin only
 */
router.post('/admin', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { version, title, description, type, category, isBreaking, items } = req.body;

    // Validate required fields
    if (!version || !title) {
      return res.status(400).json({
        success: false,
        message: 'Version and title are required'
      });
    }

    // Check for duplicate version
    const existingResult = await db.query(
      'SELECT id FROM changelog_entries WHERE version = $1',
      [version]
    );

    if (existingResult.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Version already exists'
      });
    }

    // Create entry
    const entryResult = await db.query(
      `INSERT INTO changelog_entries (version, title, description, type, category, is_breaking, is_published, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, false, NOW())
       RETURNING id, version, title, description, type, category, is_breaking, is_published, created_at`,
      [version, title, description || null, type || null, category || null, isBreaking || false]
    );

    const entry = entryResult.rows[0];

    // Add items if provided
    const addedItems = [];
    if (items && Array.isArray(items) && items.length > 0) {
      for (const item of items) {
        if (item.content) {
          const itemResult = await db.query(
            `INSERT INTO changelog_items (changelog_entry_id, content, api_endpoint, created_at)
             VALUES ($1, $2, $3, NOW())
             RETURNING id, content, api_endpoint, created_at`,
            [entry.id, item.content, item.apiEndpoint || null]
          );
          addedItems.push(itemResult.rows[0]);
        }
      }
    }

    log.info('[CHANGELOG] Entry created', { entryId: entry.id, version });

    res.status(201).json({
      success: true,
      data: {
        ...entry,
        items: addedItems
      }
    });

  } catch (error) {
    log.error('[CHANGELOG] Error creating entry:', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to create changelog entry'
    });
  }
});

/**
 * PUT /api/admin/changelog/:id
 * Update changelog entry - Admin only
 */
router.put('/admin/:id', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { id } = req.params;
    const { version, title, description, type, category, isBreaking, items } = req.body;

    // Check if entry exists
    const existingResult = await db.query(
      'SELECT id, is_published FROM changelog_entries WHERE id = $1',
      [id]
    );

    if (existingResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Changelog entry not found'
      });
    }

    // Check for duplicate version if version changed
    if (version) {
      const duplicateResult = await db.query(
        'SELECT id FROM changelog_entries WHERE version = $1 AND id != $2',
        [version, id]
      );

      if (duplicateResult.rows.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Version already exists'
        });
      }
    }

    // Update entry
    const updateResult = await db.query(
      `UPDATE changelog_entries
       SET version = COALESCE($1, version),
           title = COALESCE($2, title),
           description = $3,
           type = $4,
           category = $5,
           is_breaking = COALESCE($6, is_breaking)
       WHERE id = $7
       RETURNING id, version, title, description, type, category, is_breaking, is_published, published_at, created_at`,
      [version, title, description, type, category, isBreaking, id]
    );

    const entry = updateResult.rows[0];

    // Update items if provided
    let updatedItems = [];
    if (items && Array.isArray(items)) {
      // Delete existing items
      await db.query('DELETE FROM changelog_items WHERE changelog_entry_id = $1', [id]);

      // Add new items
      for (const item of items) {
        if (item.content) {
          const itemResult = await db.query(
            `INSERT INTO changelog_items (changelog_entry_id, content, api_endpoint, created_at)
             VALUES ($1, $2, $3, NOW())
             RETURNING id, content, api_endpoint, created_at`,
            [id, item.content, item.apiEndpoint || null]
          );
          updatedItems.push(itemResult.rows[0]);
        }
      }
    } else {
      // Get existing items
      const itemsResult = await db.query(
        'SELECT id, content, api_endpoint, created_at FROM changelog_items WHERE changelog_entry_id = $1',
        [id]
      );
      updatedItems = itemsResult.rows;
    }

    log.info('[CHANGELOG] Entry updated', { entryId: id });

    res.json({
      success: true,
      data: {
        ...entry,
        items: updatedItems
      }
    });

  } catch (error) {
    log.error('[CHANGELOG] Error updating entry:', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to update changelog entry'
    });
  }
});

/**
 * DELETE /api/admin/changelog/:id
 * Delete changelog entry - Admin only
 */
router.delete('/admin/:id', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { id } = req.params;

    const result = await db.query(
      'DELETE FROM changelog_entries WHERE id = $1 RETURNING id, version',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Changelog entry not found'
      });
    }

    log.info('[CHANGELOG] Entry deleted', { entryId: id, version: result.rows[0].version });

    res.json({
      success: true,
      message: 'Changelog entry deleted'
    });

  } catch (error) {
    log.error('[CHANGELOG] Error deleting entry:', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to delete changelog entry'
    });
  }
});

/**
 * POST /api/admin/changelog/:id/publish
 * Publish changelog entry - Admin only
 */
router.post('/admin/:id/publish', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { id } = req.params;

    const result = await db.query(
      `UPDATE changelog_entries
       SET is_published = true, published_at = NOW()
       WHERE id = $1
       RETURNING id, version, title, description, type, category, is_breaking, is_published, published_at, created_at`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Changelog entry not found'
      });
    }

    const entry = result.rows[0];

    // Get items
    const itemsResult = await db.query(
      'SELECT id, content, api_endpoint, created_at FROM changelog_items WHERE changelog_entry_id = $1',
      [id]
    );

    log.info('[CHANGELOG] Entry published', { entryId: id, version: entry.version });

    res.json({
      success: true,
      data: {
        ...entry,
        items: itemsResult.rows
      }
    });

  } catch (error) {
    log.error('[CHANGELOG] Error publishing entry:', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to publish changelog entry'
    });
  }
});

/**
 * POST /api/admin/changelog/:id/unpublish
 * Unpublish changelog entry - Admin only
 */
router.post('/admin/:id/unpublish', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { id } = req.params;

    const result = await db.query(
      `UPDATE changelog_entries
       SET is_published = false
       WHERE id = $1
       RETURNING id, version, title, description, type, category, is_breaking, is_published, published_at, created_at`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Changelog entry not found'
      });
    }

    log.info('[CHANGELOG] Entry unpublished', { entryId: id });

    res.json({
      success: true,
      data: result.rows[0]
    });

  } catch (error) {
    log.error('[CHANGELOG] Error unpublishing entry:', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to unpublish changelog entry'
    });
  }
});

/**
 * Escape XML special characters
 */
function escapeXml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

module.exports = router;
