/**
 * Tour Targeting & Segmentation Service
 * Handles targeting rules evaluation, user segments, and eligibility checks
 */

const db = require('../config/db');
const log = require('../utils/logger');

class TourTargetingService {
  /**
   * Evaluate if a tour should be shown to a user based on targeting rules
   */
  async evaluateTargeting(tourId, userId, context = {}) {
    try {
      // Get tour with targeting rules
      const tour = await db('tours')
        .where('id', tourId)
        .first();

      if (!tour) {
        return { eligible: false, reason: 'Tour not found' };
      }

      if (tour.status !== 'active') {
        return { eligible: false, reason: 'Tour is not active' };
      }

      const targetingRules = tour.targeting_rules || {};

      // Check all targeting conditions
      const checks = [];

      // URL Pattern Match
      if (targetingRules.url_rules && context.currentUrl) {
        const urlMatch = this.checkPageMatch(context.currentUrl, targetingRules.url_rules);
        checks.push({ type: 'url', passed: urlMatch, required: true });
      }

      // User Segment
      if (targetingRules.user_segment) {
        const segmentMatch = await this.checkUserSegment(userId, targetingRules.user_segment);
        checks.push({ type: 'segment', passed: segmentMatch, required: true });
      }

      // Device Type
      if (targetingRules.device_rules && context.userAgent) {
        const deviceMatch = this.checkDeviceMatch(context.userAgent, targetingRules.device_rules);
        checks.push({ type: 'device', passed: deviceMatch, required: true });
      }

      // Browser
      if (targetingRules.browser_rules && context.userAgent) {
        const browserMatch = this.checkBrowserMatch(context.userAgent, targetingRules.browser_rules);
        checks.push({ type: 'browser', passed: browserMatch, required: true });
      }

      // User Properties
      if (targetingRules.user_properties && context.userProperties) {
        const propsMatch = this.checkUserProperties(context.userProperties, targetingRules.user_properties);
        checks.push({ type: 'properties', passed: propsMatch, required: true });
      }

      // Date/Time Rules
      if (targetingRules.datetime_rules) {
        const datetimeMatch = this.checkDateTimeRules(targetingRules.datetime_rules);
        checks.push({ type: 'datetime', passed: datetimeMatch, required: true });
      }

      // Check if user has already completed the tour
      const completion = await db('tour_user_progress')
        .where({ tour_id: tourId, user_id: userId, status: 'completed' })
        .first();

      if (completion && !tour.allow_replay) {
        return { eligible: false, reason: 'Tour already completed' };
      }

      // Check frequency limits
      if (targetingRules.frequency) {
        const frequencyOk = await this.checkFrequencyLimit(tourId, userId, targetingRules.frequency);
        checks.push({ type: 'frequency', passed: frequencyOk, required: true });
      }

      // All required checks must pass
      const failedChecks = checks.filter(c => c.required && !c.passed);

      if (failedChecks.length > 0) {
        return {
          eligible: false,
          reason: `Failed checks: ${failedChecks.map(c => c.type).join(', ')}`,
          checks
        };
      }

      return { eligible: true, checks, tour };
    } catch (error) {
      log.error('Error evaluating targeting:', error);
      return { eligible: false, reason: error.message };
    }
  }

  /**
   * Check if user belongs to a segment
   */
  async checkUserSegment(userId, segmentRules) {
    try {
      if (!userId) return false;

      const user = await db('users')
        .where('id', userId)
        .first();

      if (!user) return false;

      // Check segment type
      const { type, custom_segment_id, rules } = segmentRules;

      switch (type) {
        case 'all':
          return true;

        case 'new_users':
          // User created within last 7 days
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          return new Date(user.created_at) > sevenDaysAgo;

        case 'returning':
          // User has logged in more than once
          const loginCount = await db('user_sessions')
            .where('user_id', userId)
            .count('* as count')
            .first();
          return (loginCount?.count || 0) > 1;

        case 'premium':
          return user.plan === 'premium' || user.plan === 'enterprise';

        case 'trial':
          return user.plan === 'trial' || user.is_trial === true;

        case 'free':
          return user.plan === 'free' || !user.plan;

        case 'custom':
          if (custom_segment_id) {
            return await this.evaluateCustomSegment(userId, custom_segment_id);
          }
          if (rules) {
            return this.evaluateSegmentRules(user, rules);
          }
          return false;

        default:
          return true;
      }
    } catch (error) {
      log.error('Error checking user segment:', error);
      return false;
    }
  }

  /**
   * Check if current URL matches the pattern rules
   */
  checkPageMatch(currentUrl, urlRules) {
    try {
      if (!urlRules || !currentUrl) return true;

      const { match_type, patterns } = urlRules;

      if (!patterns || patterns.length === 0) return true;

      const url = currentUrl.toLowerCase();

      for (const pattern of patterns) {
        const patternLower = pattern.toLowerCase();

        switch (match_type) {
          case 'exact':
            if (url === patternLower) return true;
            break;

          case 'contains':
            if (url.includes(patternLower)) return true;
            break;

          case 'starts_with':
            if (url.startsWith(patternLower)) return true;
            break;

          case 'ends_with':
            if (url.endsWith(patternLower)) return true;
            break;

          case 'regex':
            try {
              const regex = new RegExp(pattern, 'i');
              if (regex.test(currentUrl)) return true;
            } catch (e) {
              log.warn('Invalid regex pattern:', pattern);
            }
            break;

          case 'not_contains':
            if (!url.includes(patternLower)) return true;
            break;

          default:
            if (url.includes(patternLower)) return true;
        }
      }

      return false;
    } catch (error) {
      log.error('Error checking page match:', error);
      return false;
    }
  }

  /**
   * Check if user's device matches the rules
   */
  checkDeviceMatch(userAgent, deviceRules) {
    try {
      if (!deviceRules || !userAgent) return true;

      const { allowed_devices } = deviceRules;

      if (!allowed_devices || allowed_devices.length === 0) return true;

      const ua = userAgent.toLowerCase();
      const detectedDevice = this.detectDeviceType(ua);

      return allowed_devices.includes(detectedDevice);
    } catch (error) {
      log.error('Error checking device match:', error);
      return false;
    }
  }

  /**
   * Detect device type from user agent
   */
  detectDeviceType(userAgent) {
    const ua = userAgent.toLowerCase();

    if (/tablet|ipad|playbook|silk/i.test(ua)) {
      return 'tablet';
    }

    if (/mobile|iphone|ipod|android.*mobile|blackberry|opera mini|opera mobi/i.test(ua)) {
      return 'mobile';
    }

    return 'desktop';
  }

  /**
   * Check if user's browser matches the rules
   */
  checkBrowserMatch(userAgent, browserRules) {
    try {
      if (!browserRules || !userAgent) return true;

      const { allowed_browsers } = browserRules;

      if (!allowed_browsers || allowed_browsers.length === 0) return true;

      const detectedBrowser = this.detectBrowser(userAgent);

      return allowed_browsers.includes(detectedBrowser);
    } catch (error) {
      log.error('Error checking browser match:', error);
      return false;
    }
  }

  /**
   * Detect browser from user agent
   */
  detectBrowser(userAgent) {
    const ua = userAgent.toLowerCase();

    if (ua.includes('edg/')) return 'edge';
    if (ua.includes('chrome') && !ua.includes('edg/')) return 'chrome';
    if (ua.includes('firefox')) return 'firefox';
    if (ua.includes('safari') && !ua.includes('chrome')) return 'safari';
    if (ua.includes('opera') || ua.includes('opr/')) return 'opera';
    if (ua.includes('msie') || ua.includes('trident/')) return 'ie';

    return 'other';
  }

  /**
   * Check user properties against rules
   */
  checkUserProperties(userProperties, propertyRules) {
    try {
      if (!propertyRules || propertyRules.length === 0) return true;

      for (const rule of propertyRules) {
        const { property, operator, value } = rule;
        const userValue = userProperties[property];

        if (!this.evaluateCondition(userValue, operator, value)) {
          return false;
        }
      }

      return true;
    } catch (error) {
      log.error('Error checking user properties:', error);
      return false;
    }
  }

  /**
   * Evaluate a single condition
   */
  evaluateCondition(actualValue, operator, expectedValue) {
    switch (operator) {
      case 'equals':
      case 'eq':
        return actualValue == expectedValue;

      case 'not_equals':
      case 'neq':
        return actualValue != expectedValue;

      case 'contains':
        return String(actualValue).includes(expectedValue);

      case 'not_contains':
        return !String(actualValue).includes(expectedValue);

      case 'greater_than':
      case 'gt':
        return Number(actualValue) > Number(expectedValue);

      case 'less_than':
      case 'lt':
        return Number(actualValue) < Number(expectedValue);

      case 'greater_equal':
      case 'gte':
        return Number(actualValue) >= Number(expectedValue);

      case 'less_equal':
      case 'lte':
        return Number(actualValue) <= Number(expectedValue);

      case 'exists':
        return actualValue !== undefined && actualValue !== null;

      case 'not_exists':
        return actualValue === undefined || actualValue === null;

      case 'in':
        return Array.isArray(expectedValue) && expectedValue.includes(actualValue);

      case 'not_in':
        return Array.isArray(expectedValue) && !expectedValue.includes(actualValue);

      case 'starts_with':
        return String(actualValue).startsWith(expectedValue);

      case 'ends_with':
        return String(actualValue).endsWith(expectedValue);

      default:
        return actualValue == expectedValue;
    }
  }

  /**
   * Check date/time targeting rules
   */
  checkDateTimeRules(datetimeRules) {
    try {
      if (!datetimeRules) return true;

      const now = new Date();
      const { start_date, end_date, time_range, days_of_week, timezone } = datetimeRules;

      // Check date range
      if (start_date && new Date(start_date) > now) {
        return false;
      }

      if (end_date && new Date(end_date) < now) {
        return false;
      }

      // Check time range
      if (time_range) {
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        const currentTime = currentHour * 60 + currentMinute;

        if (time_range.start_time) {
          const [startHour, startMin] = time_range.start_time.split(':').map(Number);
          const startTime = startHour * 60 + startMin;
          if (currentTime < startTime) return false;
        }

        if (time_range.end_time) {
          const [endHour, endMin] = time_range.end_time.split(':').map(Number);
          const endTime = endHour * 60 + endMin;
          if (currentTime > endTime) return false;
        }
      }

      // Check days of week
      if (days_of_week && days_of_week.length > 0) {
        const currentDay = now.getDay(); // 0 = Sunday
        if (!days_of_week.includes(currentDay)) {
          return false;
        }
      }

      return true;
    } catch (error) {
      log.error('Error checking datetime rules:', error);
      return false;
    }
  }

  /**
   * Check behavior trigger conditions
   */
  async checkBehaviorTrigger(userId, behaviorRules) {
    try {
      if (!behaviorRules || !userId) return true;

      const { trigger_type, trigger_value, event_name } = behaviorRules;

      switch (trigger_type) {
        case 'page_view_count':
          const viewCount = await db('tour_analytics')
            .where({ user_id: userId, event_type: 'page_view' })
            .count('* as count')
            .first();
          return (viewCount?.count || 0) >= (trigger_value || 1);

        case 'session_count':
          const sessionCount = await db('user_sessions')
            .where('user_id', userId)
            .count('* as count')
            .first();
          return (sessionCount?.count || 0) >= (trigger_value || 1);

        case 'custom_event':
          if (!event_name) return true;
          const eventExists = await db('tour_analytics')
            .where({ user_id: userId, event_type: event_name })
            .first();
          return !!eventExists;

        case 'time_on_page':
          // This is checked client-side
          return true;

        case 'scroll_depth':
          // This is checked client-side
          return true;

        case 'element_click':
          // This is checked client-side
          return true;

        default:
          return true;
      }
    } catch (error) {
      log.error('Error checking behavior trigger:', error);
      return false;
    }
  }

  /**
   * Check frequency limit for showing tour
   */
  async checkFrequencyLimit(tourId, userId, frequency) {
    try {
      const { type, value, period } = frequency;

      if (type === 'once') {
        const shown = await db('tour_user_progress')
          .where({ tour_id: tourId, user_id: userId })
          .first();
        return !shown;
      }

      if (type === 'unlimited') {
        return true;
      }

      if (type === 'limited') {
        let query = db('tour_user_progress')
          .where({ tour_id: tourId, user_id: userId });

        // Apply period filter
        if (period === 'day') {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          query = query.where('created_at', '>=', today);
        } else if (period === 'week') {
          const weekAgo = new Date();
          weekAgo.setDate(weekAgo.getDate() - 7);
          query = query.where('created_at', '>=', weekAgo);
        } else if (period === 'month') {
          const monthAgo = new Date();
          monthAgo.setMonth(monthAgo.getMonth() - 1);
          query = query.where('created_at', '>=', monthAgo);
        }

        const count = await query.count('* as count').first();
        return (count?.count || 0) < (value || 1);
      }

      return true;
    } catch (error) {
      log.error('Error checking frequency limit:', error);
      return true;
    }
  }

  /**
   * Get all eligible tours for a user
   */
  async getEligibleTours(userId, context = {}) {
    try {
      const organizationId = context.organizationId;

      // Get active tours
      let query = db('tours')
        .where('status', 'active');

      if (organizationId) {
        query = query.where('organization_id', organizationId);
      }

      const tours = await query.orderBy('priority', 'desc');

      const eligibleTours = [];

      for (const tour of tours) {
        const result = await this.evaluateTargeting(tour.id, userId, context);
        if (result.eligible) {
          eligibleTours.push({
            id: tour.id,
            name: tour.name,
            description: tour.description,
            trigger_type: tour.trigger_type,
            priority: tour.priority,
            steps: tour.steps
          });
        }
      }

      // Sort by priority
      eligibleTours.sort((a, b) => (b.priority || 0) - (a.priority || 0));

      return eligibleTours;
    } catch (error) {
      log.error('Error getting eligible tours:', error);
      return [];
    }
  }

  /**
   * Evaluate custom segment
   */
  async evaluateCustomSegment(userId, segmentId) {
    try {
      const segment = await db('tour_segments')
        .where('id', segmentId)
        .first();

      if (!segment) return false;

      const user = await db('users')
        .where('id', userId)
        .first();

      if (!user) return false;

      return this.evaluateSegmentRules(user, segment.rules || {});
    } catch (error) {
      log.error('Error evaluating custom segment:', error);
      return false;
    }
  }

  /**
   * Evaluate segment rules against user data
   */
  evaluateSegmentRules(user, rules) {
    try {
      if (!rules || !rules.conditions || rules.conditions.length === 0) {
        return true;
      }

      const { operator, conditions } = rules;
      const results = conditions.map(condition => {
        const userValue = user[condition.field];
        return this.evaluateCondition(userValue, condition.operator, condition.value);
      });

      if (operator === 'AND') {
        return results.every(r => r);
      } else if (operator === 'OR') {
        return results.some(r => r);
      }

      return results.every(r => r);
    } catch (error) {
      log.error('Error evaluating segment rules:', error);
      return false;
    }
  }

  // ==================== SEGMENT MANAGEMENT ====================

  /**
   * Create a new segment
   */
  async createSegment(organizationId, data) {
    try {
      const [segment] = await db('tour_segments')
        .insert({
          organization_id: organizationId,
          name: data.name,
          description: data.description,
          rules: JSON.stringify(data.rules || {}),
          created_at: new Date(),
          updated_at: new Date()
        })
        .returning('*');

      // Calculate user count
      await this.updateSegmentUserCount(segment.id);

      return segment;
    } catch (error) {
      log.error('Error creating segment:', error);
      throw error;
    }
  }

  /**
   * Get all segments for organization
   */
  async getSegments(organizationId) {
    try {
      const segments = await db('tour_segments')
        .where('organization_id', organizationId)
        .orderBy('created_at', 'desc');

      return segments.map(s => ({
        ...s,
        rules: typeof s.rules === 'string' ? JSON.parse(s.rules) : s.rules
      }));
    } catch (error) {
      log.error('Error getting segments:', error);
      throw error;
    }
  }

  /**
   * Get segment by ID
   */
  async getSegmentById(segmentId) {
    try {
      const segment = await db('tour_segments')
        .where('id', segmentId)
        .first();

      if (segment) {
        segment.rules = typeof segment.rules === 'string' ? JSON.parse(segment.rules) : segment.rules;
      }

      return segment;
    } catch (error) {
      log.error('Error getting segment:', error);
      throw error;
    }
  }

  /**
   * Update segment
   */
  async updateSegment(segmentId, data) {
    try {
      const updateData = {
        updated_at: new Date()
      };

      if (data.name) updateData.name = data.name;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.rules) updateData.rules = JSON.stringify(data.rules);

      await db('tour_segments')
        .where('id', segmentId)
        .update(updateData);

      // Recalculate user count
      await this.updateSegmentUserCount(segmentId);

      return this.getSegmentById(segmentId);
    } catch (error) {
      log.error('Error updating segment:', error);
      throw error;
    }
  }

  /**
   * Delete segment
   */
  async deleteSegment(segmentId) {
    try {
      await db('tour_segments')
        .where('id', segmentId)
        .delete();

      return true;
    } catch (error) {
      log.error('Error deleting segment:', error);
      throw error;
    }
  }

  /**
   * Evaluate segment for a specific user
   */
  async evaluateSegmentForUser(segmentId, userId) {
    try {
      const segment = await this.getSegmentById(segmentId);
      if (!segment) {
        return { matches: false, reason: 'Segment not found' };
      }

      const user = await db('users')
        .where('id', userId)
        .first();

      if (!user) {
        return { matches: false, reason: 'User not found' };
      }

      const matches = this.evaluateSegmentRules(user, segment.rules);

      return {
        matches,
        segment: segment.name,
        user_id: userId
      };
    } catch (error) {
      log.error('Error evaluating segment for user:', error);
      throw error;
    }
  }

  /**
   * Update user count for segment
   */
  async updateSegmentUserCount(segmentId) {
    try {
      const segment = await this.getSegmentById(segmentId);
      if (!segment) return;

      // Get all users in organization
      const users = await db('users')
        .where('organization_id', segment.organization_id);

      let matchCount = 0;
      for (const user of users) {
        if (this.evaluateSegmentRules(user, segment.rules)) {
          matchCount++;
        }
      }

      await db('tour_segments')
        .where('id', segmentId)
        .update({ user_count: matchCount });

      return matchCount;
    } catch (error) {
      log.error('Error updating segment user count:', error);
      return 0;
    }
  }

  // ==================== TARGETING RULES MANAGEMENT ====================

  /**
   * Set targeting rules for a tour
   */
  async setTargetingRules(tourId, rules) {
    try {
      await db('tours')
        .where('id', tourId)
        .update({
          targeting_rules: JSON.stringify(rules),
          updated_at: new Date()
        });

      return this.getTargetingRules(tourId);
    } catch (error) {
      log.error('Error setting targeting rules:', error);
      throw error;
    }
  }

  /**
   * Get targeting rules for a tour
   */
  async getTargetingRules(tourId) {
    try {
      const tour = await db('tours')
        .where('id', tourId)
        .select('id', 'name', 'targeting_rules')
        .first();

      if (!tour) return null;

      return {
        tour_id: tour.id,
        tour_name: tour.name,
        rules: typeof tour.targeting_rules === 'string'
          ? JSON.parse(tour.targeting_rules)
          : tour.targeting_rules || {}
      };
    } catch (error) {
      log.error('Error getting targeting rules:', error);
      throw error;
    }
  }

  /**
   * Test targeting rules with sample data
   */
  async testTargetingRules(rules, testContext) {
    try {
      const results = {
        url_match: true,
        device_match: true,
        browser_match: true,
        datetime_match: true,
        properties_match: true,
        overall: true
      };

      // Test URL rules
      if (rules.url_rules && testContext.currentUrl) {
        results.url_match = this.checkPageMatch(testContext.currentUrl, rules.url_rules);
      }

      // Test device rules
      if (rules.device_rules && testContext.userAgent) {
        results.device_match = this.checkDeviceMatch(testContext.userAgent, rules.device_rules);
      }

      // Test browser rules
      if (rules.browser_rules && testContext.userAgent) {
        results.browser_match = this.checkBrowserMatch(testContext.userAgent, rules.browser_rules);
      }

      // Test datetime rules
      if (rules.datetime_rules) {
        results.datetime_match = this.checkDateTimeRules(rules.datetime_rules);
      }

      // Test user properties
      if (rules.user_properties && testContext.userProperties) {
        results.properties_match = this.checkUserProperties(testContext.userProperties, rules.user_properties);
      }

      results.overall = Object.values(results).every(v => v === true);

      return results;
    } catch (error) {
      log.error('Error testing targeting rules:', error);
      throw error;
    }
  }
}

module.exports = new TourTargetingService();
