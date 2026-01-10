/**
 * A/B Test Validation Middleware
 * Validates request data for A/B testing endpoints
 */

const { z } = require('zod');

// ==================== Schemas ====================

const createTestSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255, 'Name too long'),
  description: z.string().max(1000, 'Description too long').optional().nullable(),
  test_type: z.enum(['message', 'flow', 'widget', 'welcome', 'button', 'tour'], {
    errorMap: () => ({ message: 'Invalid test type' })
  }),
  goal_metric: z.enum(['conversion', 'engagement', 'response_rate', 'click_rate'], {
    errorMap: () => ({ message: 'Invalid goal metric' })
  }).optional().default('conversion'),
  traffic_split: z.record(z.string(), z.number().min(0).max(100)).optional(),
  auto_winner_enabled: z.boolean().optional().default(false),
  auto_winner_threshold: z.number().min(80).max(99).optional().default(95),
  variants: z.object({
    A: z.object({ content: z.record(z.any()).optional() }).optional(),
    B: z.object({ content: z.record(z.any()).optional() }).optional()
  }).optional()
});

const updateTestSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional().nullable(),
  goal_metric: z.enum(['conversion', 'engagement', 'response_rate', 'click_rate']).optional(),
  traffic_split: z.record(z.string(), z.number().min(0).max(100)).optional(),
  auto_winner_enabled: z.boolean().optional(),
  auto_winner_threshold: z.number().min(80).max(99).optional()
});

const createVariantSchema = z.object({
  name: z.string().min(1, 'Variant name is required').max(10, 'Variant name too long'),
  is_control: z.boolean().optional().default(false),
  content: z.record(z.any()).optional().default({})
});

const updateVariantSchema = z.object({
  name: z.string().min(1).max(10).optional(),
  is_control: z.boolean().optional(),
  content: z.record(z.any()).optional()
});

const assignVariantSchema = z.object({
  testId: z.string().uuid('Invalid test ID format'),
  visitorId: z.string().min(1, 'Visitor ID is required').max(255),
  userId: z.string().max(255).optional().nullable(),
  sessionId: z.string().max(255).optional().nullable()
});

const recordConversionSchema = z.object({
  testId: z.string().uuid('Invalid test ID format'),
  visitorId: z.string().min(1, 'Visitor ID is required').max(255),
  conversionType: z.enum(['click', 'submit', 'purchase', 'signup', 'goal'], {
    errorMap: () => ({ message: 'Invalid conversion type' })
  }).optional().default('goal'),
  value: z.number().min(0).optional().nullable(),
  metadata: z.record(z.any()).optional().nullable()
});

const declareWinnerSchema = z.object({
  variantId: z.string().uuid('Invalid variant ID format')
});

const batchAssignSchema = z.object({
  testIds: z.array(z.string().uuid()).min(1, 'At least one test ID required').max(10, 'Maximum 10 tests'),
  visitorId: z.string().min(1).max(255),
  userId: z.string().max(255).optional().nullable(),
  sessionId: z.string().max(255).optional().nullable()
});

const batchConvertSchema = z.object({
  conversions: z.array(z.object({
    testId: z.string().uuid(),
    visitorId: z.string().min(1).max(255),
    conversionType: z.enum(['click', 'submit', 'purchase', 'signup', 'goal']).optional(),
    value: z.number().min(0).optional().nullable(),
    metadata: z.record(z.any()).optional().nullable()
  })).min(1, 'At least one conversion required').max(50, 'Maximum 50 conversions')
});

const dateRangeSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)').optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)').optional()
});

// ==================== Validation Helpers ====================

/**
 * Creates validation middleware from a Zod schema
 */
const validate = (schema, source = 'body') => {
  return (req, res, next) => {
    try {
      const data = source === 'body' ? req.body :
                   source === 'query' ? req.query :
                   source === 'params' ? req.params : req.body;

      const result = schema.safeParse(data);

      if (!result.success) {
        const errors = result.error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code
        }));

        return res.status(400).json({
          success: false,
          error: 'Validation error',
          details: errors
        });
      }

      // Replace with parsed/validated data
      if (source === 'body') {
        req.body = result.data;
      } else if (source === 'query') {
        req.query = result.data;
      }

      next();
    } catch (error) {
      console.error('Validation error:', error);
      res.status(500).json({
        success: false,
        error: 'Validation failed',
        message: error.message
      });
    }
  };
};

/**
 * Validates traffic split totals to 100%
 */
const validateTrafficSplit = (req, res, next) => {
  const { traffic_split } = req.body;

  if (traffic_split) {
    const values = Object.values(traffic_split);
    const total = values.reduce((sum, val) => sum + val, 0);

    if (Math.abs(total - 100) > 0.01) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: [{
          field: 'traffic_split',
          message: `Traffic split must total 100%, got ${total}%`
        }]
      });
    }
  }

  next();
};

/**
 * Validates UUID parameter
 */
const validateUUID = (paramName) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  return (req, res, next) => {
    const value = req.params[paramName];

    if (!value || !uuidRegex.test(value)) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: [{
          field: paramName,
          message: `Invalid ${paramName} format`
        }]
      });
    }

    next();
  };
};

// ==================== Middleware Exports ====================

const validateCreateTest = [
  validate(createTestSchema),
  validateTrafficSplit
];

const validateUpdateTest = [
  validateUUID('id'),
  validate(updateTestSchema),
  validateTrafficSplit
];

const validateTestId = validateUUID('id');

const validateCreateVariant = [
  validateUUID('id'),
  validate(createVariantSchema)
];

const validateUpdateVariant = [
  validateUUID('id'),
  validateUUID('variantId'),
  validate(updateVariantSchema)
];

const validateDeleteVariant = [
  validateUUID('id'),
  validateUUID('variantId')
];

const validateAssignVariant = validate(assignVariantSchema);

const validateRecordConversion = validate(recordConversionSchema);

const validateDeclareWinner = [
  validateUUID('id'),
  validate(declareWinnerSchema)
];

const validateBatchAssign = validate(batchAssignSchema);

const validateBatchConvert = validate(batchConvertSchema);

const validateDateRange = validate(dateRangeSchema, 'query');

module.exports = {
  // Schemas (for direct use)
  createTestSchema,
  updateTestSchema,
  createVariantSchema,
  updateVariantSchema,
  assignVariantSchema,
  recordConversionSchema,
  declareWinnerSchema,
  batchAssignSchema,
  batchConvertSchema,
  dateRangeSchema,

  // Middleware
  validate,
  validateTrafficSplit,
  validateUUID,
  validateCreateTest,
  validateUpdateTest,
  validateTestId,
  validateCreateVariant,
  validateUpdateVariant,
  validateDeleteVariant,
  validateAssignVariant,
  validateRecordConversion,
  validateDeclareWinner,
  validateBatchAssign,
  validateBatchConvert,
  validateDateRange
};
