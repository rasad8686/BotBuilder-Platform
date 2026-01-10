/**
 * Survey Targeting Logic Utility
 * Checks if a survey should be shown based on targeting configuration
 */

/**
 * Check if visitor matches targeting rules
 * @param {Object} targetingConfig - Survey targeting configuration
 * @param {Object} visitorContext - Current visitor context
 * @returns {boolean} - Whether the survey should be shown
 */
export const checkTargetingMatch = (targetingConfig, visitorContext) => {
  // If targeting is disabled, always show
  if (!targetingConfig?.enabled) {
    return true;
  }

  const {
    rules = [],
    user_segments = [],
    page_targeting = [],
    device_targeting = ['desktop', 'mobile', 'tablet'],
    geo_targeting = []
  } = targetingConfig;

  const {
    userId,
    userSegments = [],
    currentPage,
    referrer,
    device,
    browser,
    country,
    city,
    sessionCount,
    pageViews,
    timeOnSite,
    isNewVisitor,
    customAttributes = {}
  } = visitorContext;

  // Check device targeting
  if (device_targeting.length > 0 && !device_targeting.includes(device)) {
    return false;
  }

  // Check geo targeting
  if (geo_targeting.length > 0) {
    const matchesGeo = geo_targeting.some(geo => {
      if (geo.type === 'country' && geo.value === country) return true;
      if (geo.type === 'city' && geo.value === city) return true;
      return false;
    });
    if (!matchesGeo) return false;
  }

  // Check user segments
  if (user_segments.length > 0) {
    const matchesSegment = user_segments.some(segment =>
      userSegments.includes(segment)
    );
    if (!matchesSegment) return false;
  }

  // Check page targeting
  if (page_targeting.length > 0) {
    const matchesPage = page_targeting.some(pageRule => {
      return checkPageMatch(pageRule, currentPage);
    });
    if (!matchesPage) return false;
  }

  // Check custom rules
  if (rules.length > 0) {
    const matchesAllRules = rules.every(rule => {
      return evaluateRule(rule, visitorContext);
    });
    if (!matchesAllRules) return false;
  }

  return true;
};

/**
 * Check if current page matches a page targeting rule
 * @param {Object} pageRule - Page targeting rule
 * @param {string} currentPage - Current page URL/path
 * @returns {boolean}
 */
const checkPageMatch = (pageRule, currentPage) => {
  const { match_type, value } = pageRule;

  if (!currentPage || !value) return false;

  switch (match_type) {
    case 'exact':
      return currentPage === value;

    case 'contains':
      return currentPage.includes(value);

    case 'starts_with':
      return currentPage.startsWith(value);

    case 'ends_with':
      return currentPage.endsWith(value);

    case 'regex':
      try {
        const regex = new RegExp(value);
        return regex.test(currentPage);
      } catch (e) {
        return false;
      }

    case 'not_contains':
      return !currentPage.includes(value);

    default:
      return false;
  }
};

/**
 * Evaluate a single targeting rule
 * @param {Object} rule - Targeting rule
 * @param {Object} context - Visitor context
 * @returns {boolean}
 */
const evaluateRule = (rule, context) => {
  const { field, operator, value } = rule;

  let fieldValue;

  // Get field value from context
  switch (field) {
    case 'session_count':
      fieldValue = context.sessionCount;
      break;
    case 'page_views':
      fieldValue = context.pageViews;
      break;
    case 'time_on_site':
      fieldValue = context.timeOnSite;
      break;
    case 'is_new_visitor':
      fieldValue = context.isNewVisitor;
      break;
    case 'referrer':
      fieldValue = context.referrer;
      break;
    case 'browser':
      fieldValue = context.browser;
      break;
    case 'user_id':
      fieldValue = context.userId;
      break;
    default:
      // Check custom attributes
      fieldValue = context.customAttributes?.[field];
  }

  // Evaluate based on operator
  return evaluateOperator(fieldValue, operator, value);
};

/**
 * Evaluate operator comparison
 * @param {*} fieldValue - Actual field value
 * @param {string} operator - Comparison operator
 * @param {*} targetValue - Target value to compare against
 * @returns {boolean}
 */
const evaluateOperator = (fieldValue, operator, targetValue) => {
  // Handle undefined/null field values
  if (fieldValue === undefined || fieldValue === null) {
    return operator === 'is_empty' || operator === 'not_exists';
  }

  switch (operator) {
    case 'equals':
      return String(fieldValue) === String(targetValue);

    case 'not_equals':
      return String(fieldValue) !== String(targetValue);

    case 'contains':
      return String(fieldValue).includes(String(targetValue));

    case 'not_contains':
      return !String(fieldValue).includes(String(targetValue));

    case 'starts_with':
      return String(fieldValue).startsWith(String(targetValue));

    case 'ends_with':
      return String(fieldValue).endsWith(String(targetValue));

    case 'greater_than':
      return Number(fieldValue) > Number(targetValue);

    case 'less_than':
      return Number(fieldValue) < Number(targetValue);

    case 'greater_or_equal':
      return Number(fieldValue) >= Number(targetValue);

    case 'less_or_equal':
      return Number(fieldValue) <= Number(targetValue);

    case 'is_true':
      return fieldValue === true || fieldValue === 'true' || fieldValue === 1;

    case 'is_false':
      return fieldValue === false || fieldValue === 'false' || fieldValue === 0;

    case 'is_empty':
      return fieldValue === '' || fieldValue === null || fieldValue === undefined;

    case 'is_not_empty':
      return fieldValue !== '' && fieldValue !== null && fieldValue !== undefined;

    case 'in_list':
      const list = Array.isArray(targetValue) ? targetValue : String(targetValue).split(',').map(s => s.trim());
      return list.includes(String(fieldValue));

    case 'not_in_list':
      const excludeList = Array.isArray(targetValue) ? targetValue : String(targetValue).split(',').map(s => s.trim());
      return !excludeList.includes(String(fieldValue));

    case 'regex':
      try {
        const regex = new RegExp(targetValue);
        return regex.test(String(fieldValue));
      } catch (e) {
        return false;
      }

    default:
      return false;
  }
};

/**
 * Check if survey should be shown based on schedule
 * @param {Object} scheduleConfig - Schedule configuration
 * @returns {boolean}
 */
export const checkScheduleMatch = (scheduleConfig) => {
  if (!scheduleConfig?.enabled) {
    return true;
  }

  const {
    start_date,
    end_date,
    days_of_week = [0, 1, 2, 3, 4, 5, 6],
    time_start = '00:00',
    time_end = '23:59',
    timezone = 'UTC'
  } = scheduleConfig;

  const now = new Date();

  // Convert to target timezone
  const options = { timeZone: timezone };
  const localTime = new Date(now.toLocaleString('en-US', options));

  // Check date range
  if (start_date) {
    const startDate = new Date(start_date);
    if (localTime < startDate) return false;
  }

  if (end_date) {
    const endDate = new Date(end_date);
    endDate.setHours(23, 59, 59, 999);
    if (localTime > endDate) return false;
  }

  // Check day of week
  const currentDay = localTime.getDay();
  if (!days_of_week.includes(currentDay)) {
    return false;
  }

  // Check time range
  const currentTimeStr = localTime.toTimeString().slice(0, 5);
  if (currentTimeStr < time_start || currentTimeStr > time_end) {
    return false;
  }

  return true;
};

/**
 * Get visitor context from browser/environment
 * @returns {Object} - Visitor context
 */
export const getVisitorContext = () => {
  const userAgent = navigator.userAgent.toLowerCase();

  // Detect device
  let device = 'desktop';
  if (/mobile|android|iphone|ipod|blackberry|windows phone/i.test(userAgent)) {
    device = 'mobile';
  } else if (/ipad|tablet/i.test(userAgent)) {
    device = 'tablet';
  }

  // Detect browser
  let browser = 'other';
  if (userAgent.includes('chrome') && !userAgent.includes('edg')) {
    browser = 'chrome';
  } else if (userAgent.includes('firefox')) {
    browser = 'firefox';
  } else if (userAgent.includes('safari') && !userAgent.includes('chrome')) {
    browser = 'safari';
  } else if (userAgent.includes('edg')) {
    browser = 'edge';
  } else if (userAgent.includes('opera') || userAgent.includes('opr')) {
    browser = 'opera';
  }

  // Get stored visitor data
  const visitorData = JSON.parse(localStorage.getItem('bb_visitor_data') || '{}');
  const sessionCount = parseInt(visitorData.sessionCount || 1);
  const isNewVisitor = sessionCount === 1;

  return {
    device,
    browser,
    currentPage: window.location.pathname,
    referrer: document.referrer,
    sessionCount,
    pageViews: parseInt(visitorData.pageViews || 1),
    timeOnSite: parseInt(visitorData.timeOnSite || 0),
    isNewVisitor,
    customAttributes: visitorData.customAttributes || {}
  };
};

/**
 * Check all targeting conditions for a survey
 * @param {Object} survey - Survey object with targeting and schedule configs
 * @param {Object} customContext - Optional custom context to merge with auto-detected
 * @returns {boolean}
 */
export const shouldShowSurvey = (survey, customContext = {}) => {
  const visitorContext = {
    ...getVisitorContext(),
    ...customContext
  };

  const targetingMatch = checkTargetingMatch(survey.targeting_config, visitorContext);
  const scheduleMatch = checkScheduleMatch(survey.schedule_config);

  return targetingMatch && scheduleMatch;
};

export default {
  checkTargetingMatch,
  checkScheduleMatch,
  getVisitorContext,
  shouldShowSurvey
};
