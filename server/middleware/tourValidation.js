/**
 * Tour Validation Middleware
 * Provides input validation for tour-related API endpoints
 */

const { v4: isUuid } = require('uuid');

/**
 * Validation error class
 */
class ValidationError extends Error {
  constructor(message, field, code = 'VALIDATION_ERROR') {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
    this.code = code;
    this.status = 400;
  }
}

/**
 * Valid enum values
 */
const VALID_VALUES = {
  status: ['draft', 'active', 'paused', 'archived'],
  trigger_type: ['manual', 'auto', 'event', 'delay'],
  step_type: ['tooltip', 'modal', 'hotspot', 'slideout', 'driven_action'],
  content_type: ['text', 'html', 'video'],
  position: ['top', 'bottom', 'left', 'right', 'auto', 'center'],
  alignment: ['start', 'center', 'end'],
  target_type: ['url', 'user_property', 'event', 'segment'],
  operator: ['equals', 'contains', 'starts_with', 'regex', 'gt', 'lt'],
  logic_operator: ['AND', 'OR']
};

/**
 * Validate UUID format
 */
const isValidUuid = (value) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
};

/**
 * Validate tour creation/update data
 */
const validateTour = (req, res, next) => {
  const errors = [];
  const { name, description, settings, theme, trigger_type, trigger_config, priority } = req.body;

  // Name validation (required for creation)
  if (req.method === 'POST') {
    if (!name) {
      errors.push({ field: 'name', message: 'Tour name is required', code: 'REQUIRED' });
    } else if (typeof name !== 'string') {
      errors.push({ field: 'name', message: 'Tour name must be a string', code: 'INVALID_TYPE' });
    } else if (name.length > 255) {
      errors.push({ field: 'name', message: 'Tour name must be 255 characters or less', code: 'MAX_LENGTH' });
    } else if (name.trim().length === 0) {
      errors.push({ field: 'name', message: 'Tour name cannot be empty', code: 'EMPTY' });
    }
  } else if (name !== undefined) {
    if (typeof name !== 'string') {
      errors.push({ field: 'name', message: 'Tour name must be a string', code: 'INVALID_TYPE' });
    } else if (name.length > 255) {
      errors.push({ field: 'name', message: 'Tour name must be 255 characters or less', code: 'MAX_LENGTH' });
    }
  }

  // Description validation
  if (description !== undefined && description !== null) {
    if (typeof description !== 'string') {
      errors.push({ field: 'description', message: 'Description must be a string', code: 'INVALID_TYPE' });
    } else if (description.length > 5000) {
      errors.push({ field: 'description', message: 'Description must be 5000 characters or less', code: 'MAX_LENGTH' });
    }
  }

  // Trigger type validation
  if (trigger_type !== undefined) {
    if (!VALID_VALUES.trigger_type.includes(trigger_type)) {
      errors.push({
        field: 'trigger_type',
        message: `Invalid trigger type. Must be one of: ${VALID_VALUES.trigger_type.join(', ')}`,
        code: 'INVALID_VALUE'
      });
    }
  }

  // Settings validation
  if (settings !== undefined) {
    if (typeof settings !== 'object' || Array.isArray(settings)) {
      errors.push({ field: 'settings', message: 'Settings must be an object', code: 'INVALID_TYPE' });
    } else {
      if (settings.dismissible !== undefined && typeof settings.dismissible !== 'boolean') {
        errors.push({ field: 'settings.dismissible', message: 'dismissible must be a boolean', code: 'INVALID_TYPE' });
      }
      if (settings.showProgressBar !== undefined && typeof settings.showProgressBar !== 'boolean') {
        errors.push({ field: 'settings.showProgressBar', message: 'showProgressBar must be a boolean', code: 'INVALID_TYPE' });
      }
      if (settings.overlayOpacity !== undefined) {
        if (typeof settings.overlayOpacity !== 'number' || settings.overlayOpacity < 0 || settings.overlayOpacity > 1) {
          errors.push({ field: 'settings.overlayOpacity', message: 'overlayOpacity must be a number between 0 and 1', code: 'INVALID_VALUE' });
        }
      }
    }
  }

  // Theme validation
  if (theme !== undefined) {
    if (typeof theme !== 'object' || Array.isArray(theme)) {
      errors.push({ field: 'theme', message: 'Theme must be an object', code: 'INVALID_TYPE' });
    } else {
      if (theme.primaryColor !== undefined) {
        const colorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
        if (!colorRegex.test(theme.primaryColor)) {
          errors.push({ field: 'theme.primaryColor', message: 'primaryColor must be a valid hex color', code: 'INVALID_FORMAT' });
        }
      }
      if (theme.borderRadius !== undefined) {
        if (typeof theme.borderRadius !== 'number' || theme.borderRadius < 0 || theme.borderRadius > 50) {
          errors.push({ field: 'theme.borderRadius', message: 'borderRadius must be a number between 0 and 50', code: 'INVALID_VALUE' });
        }
      }
    }
  }

  // Priority validation
  if (priority !== undefined) {
    if (typeof priority !== 'number' || !Number.isInteger(priority)) {
      errors.push({ field: 'priority', message: 'Priority must be an integer', code: 'INVALID_TYPE' });
    } else if (priority < 0 || priority > 100) {
      errors.push({ field: 'priority', message: 'Priority must be between 0 and 100', code: 'INVALID_VALUE' });
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors
    });
  }

  next();
};

/**
 * Validate step creation/update data
 */
const validateStep = (req, res, next) => {
  const errors = [];
  const {
    step_type, target_selector, title, content, content_type,
    position, alignment, actions, highlight_element, scroll_to_element
  } = req.body;

  // Step type validation
  if (step_type !== undefined) {
    if (!VALID_VALUES.step_type.includes(step_type)) {
      errors.push({
        field: 'step_type',
        message: `Invalid step type. Must be one of: ${VALID_VALUES.step_type.join(', ')}`,
        code: 'INVALID_VALUE'
      });
    }
  }

  // Target selector validation
  if (target_selector !== undefined && target_selector !== null) {
    if (typeof target_selector !== 'string') {
      errors.push({ field: 'target_selector', message: 'target_selector must be a string', code: 'INVALID_TYPE' });
    } else if (target_selector.length > 500) {
      errors.push({ field: 'target_selector', message: 'target_selector must be 500 characters or less', code: 'MAX_LENGTH' });
    }
  }

  // Title validation
  if (title !== undefined && title !== null) {
    if (typeof title !== 'string') {
      errors.push({ field: 'title', message: 'Title must be a string', code: 'INVALID_TYPE' });
    } else if (title.length > 255) {
      errors.push({ field: 'title', message: 'Title must be 255 characters or less', code: 'MAX_LENGTH' });
    }
  }

  // Content validation
  if (content !== undefined && content !== null) {
    if (typeof content !== 'string') {
      errors.push({ field: 'content', message: 'Content must be a string', code: 'INVALID_TYPE' });
    } else if (content.length > 10000) {
      errors.push({ field: 'content', message: 'Content must be 10000 characters or less', code: 'MAX_LENGTH' });
    }
  }

  // Content type validation
  if (content_type !== undefined) {
    if (!VALID_VALUES.content_type.includes(content_type)) {
      errors.push({
        field: 'content_type',
        message: `Invalid content type. Must be one of: ${VALID_VALUES.content_type.join(', ')}`,
        code: 'INVALID_VALUE'
      });
    }
  }

  // Position validation
  if (position !== undefined) {
    if (!VALID_VALUES.position.includes(position)) {
      errors.push({
        field: 'position',
        message: `Invalid position. Must be one of: ${VALID_VALUES.position.join(', ')}`,
        code: 'INVALID_VALUE'
      });
    }
  }

  // Alignment validation
  if (alignment !== undefined) {
    if (!VALID_VALUES.alignment.includes(alignment)) {
      errors.push({
        field: 'alignment',
        message: `Invalid alignment. Must be one of: ${VALID_VALUES.alignment.join(', ')}`,
        code: 'INVALID_VALUE'
      });
    }
  }

  // Actions validation
  if (actions !== undefined) {
    if (!Array.isArray(actions)) {
      errors.push({ field: 'actions', message: 'Actions must be an array', code: 'INVALID_TYPE' });
    } else {
      actions.forEach((action, index) => {
        if (!action.type) {
          errors.push({ field: `actions[${index}].type`, message: 'Action type is required', code: 'REQUIRED' });
        }
        if (!action.label) {
          errors.push({ field: `actions[${index}].label`, message: 'Action label is required', code: 'REQUIRED' });
        }
      });
    }
  }

  // Boolean validations
  if (highlight_element !== undefined && typeof highlight_element !== 'boolean') {
    errors.push({ field: 'highlight_element', message: 'highlight_element must be a boolean', code: 'INVALID_TYPE' });
  }

  if (scroll_to_element !== undefined && typeof scroll_to_element !== 'boolean') {
    errors.push({ field: 'scroll_to_element', message: 'scroll_to_element must be a boolean', code: 'INVALID_TYPE' });
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors
    });
  }

  next();
};

/**
 * Validate targeting rules
 */
const validateTargeting = (req, res, next) => {
  const errors = [];
  const { rules } = req.body;

  if (rules !== undefined && rules !== null) {
    if (!Array.isArray(rules)) {
      errors.push({ field: 'rules', message: 'Rules must be an array', code: 'INVALID_TYPE' });
    } else {
      rules.forEach((rule, index) => {
        // Target type validation
        if (!rule.target_type) {
          errors.push({ field: `rules[${index}].target_type`, message: 'Target type is required', code: 'REQUIRED' });
        } else if (!VALID_VALUES.target_type.includes(rule.target_type)) {
          errors.push({
            field: `rules[${index}].target_type`,
            message: `Invalid target type. Must be one of: ${VALID_VALUES.target_type.join(', ')}`,
            code: 'INVALID_VALUE'
          });
        }

        // Operator validation
        if (rule.operator && !VALID_VALUES.operator.includes(rule.operator)) {
          errors.push({
            field: `rules[${index}].operator`,
            message: `Invalid operator. Must be one of: ${VALID_VALUES.operator.join(', ')}`,
            code: 'INVALID_VALUE'
          });
        }

        // Logic operator validation
        if (rule.logic_operator && !VALID_VALUES.logic_operator.includes(rule.logic_operator)) {
          errors.push({
            field: `rules[${index}].logic_operator`,
            message: `Invalid logic operator. Must be one of: ${VALID_VALUES.logic_operator.join(', ')}`,
            code: 'INVALID_VALUE'
          });
        }

        // Value validation
        if (rule.value !== undefined && rule.value !== null && typeof rule.value !== 'string') {
          errors.push({ field: `rules[${index}].value`, message: 'Value must be a string', code: 'INVALID_TYPE' });
        }
      });
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors
    });
  }

  next();
};

/**
 * Validate tour ID parameter
 */
const validateTourId = (req, res, next) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({
      success: false,
      message: 'Tour ID is required',
      errors: [{ field: 'id', message: 'Tour ID is required', code: 'REQUIRED' }]
    });
  }

  if (!isValidUuid(id)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid tour ID format',
      errors: [{ field: 'id', message: 'Tour ID must be a valid UUID', code: 'INVALID_FORMAT' }]
    });
  }

  next();
};

/**
 * Validate step ID parameter
 */
const validateStepId = (req, res, next) => {
  const { stepId } = req.params;

  if (!stepId) {
    return res.status(400).json({
      success: false,
      message: 'Step ID is required',
      errors: [{ field: 'stepId', message: 'Step ID is required', code: 'REQUIRED' }]
    });
  }

  if (!isValidUuid(stepId)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid step ID format',
      errors: [{ field: 'stepId', message: 'Step ID must be a valid UUID', code: 'INVALID_FORMAT' }]
    });
  }

  next();
};

/**
 * Validate reorder request
 */
const validateReorder = (req, res, next) => {
  const errors = [];
  const { stepIds } = req.body;

  if (!stepIds) {
    errors.push({ field: 'stepIds', message: 'stepIds array is required', code: 'REQUIRED' });
  } else if (!Array.isArray(stepIds)) {
    errors.push({ field: 'stepIds', message: 'stepIds must be an array', code: 'INVALID_TYPE' });
  } else if (stepIds.length === 0) {
    errors.push({ field: 'stepIds', message: 'stepIds array cannot be empty', code: 'EMPTY' });
  } else {
    stepIds.forEach((id, index) => {
      if (!isValidUuid(id)) {
        errors.push({ field: `stepIds[${index}]`, message: 'Each stepId must be a valid UUID', code: 'INVALID_FORMAT' });
      }
    });

    // Check for duplicates
    const uniqueIds = new Set(stepIds);
    if (uniqueIds.size !== stepIds.length) {
      errors.push({ field: 'stepIds', message: 'stepIds array contains duplicates', code: 'DUPLICATE' });
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors
    });
  }

  next();
};

/**
 * Validate date range for analytics
 */
const validateDateRange = (req, res, next) => {
  const errors = [];
  const { startDate, endDate } = req.query;
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

  if (startDate) {
    if (!dateRegex.test(startDate)) {
      errors.push({ field: 'startDate', message: 'startDate must be in YYYY-MM-DD format', code: 'INVALID_FORMAT' });
    } else if (isNaN(Date.parse(startDate))) {
      errors.push({ field: 'startDate', message: 'startDate is not a valid date', code: 'INVALID_DATE' });
    }
  }

  if (endDate) {
    if (!dateRegex.test(endDate)) {
      errors.push({ field: 'endDate', message: 'endDate must be in YYYY-MM-DD format', code: 'INVALID_FORMAT' });
    } else if (isNaN(Date.parse(endDate))) {
      errors.push({ field: 'endDate', message: 'endDate is not a valid date', code: 'INVALID_DATE' });
    }
  }

  if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
    errors.push({ field: 'dateRange', message: 'startDate cannot be after endDate', code: 'INVALID_RANGE' });
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors
    });
  }

  next();
};

module.exports = {
  ValidationError,
  validateTour,
  validateStep,
  validateTargeting,
  validateTourId,
  validateStepId,
  validateReorder,
  validateDateRange,
  VALID_VALUES
};
