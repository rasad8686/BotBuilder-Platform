/**
 * A/B Test Custom Error Classes
 * Provides structured error handling for A/B testing system
 */

/**
 * Base error class for A/B Test errors
 */
class ABTestError extends Error {
  constructor(message, status = 500, code = 'AB_TEST_ERROR') {
    super(message);
    this.name = this.constructor.name;
    this.status = status;
    this.code = code;
    this.timestamp = new Date().toISOString();
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      success: false,
      error: {
        name: this.name,
        message: this.message,
        code: this.code,
        status: this.status,
        timestamp: this.timestamp
      }
    };
  }
}

/**
 * 404 - Test not found
 */
class ABTestNotFoundError extends ABTestError {
  constructor(testId) {
    super(`A/B Test not found: ${testId}`, 404, 'AB_TEST_NOT_FOUND');
    this.testId = testId;
  }
}

/**
 * 404 - Variant not found
 */
class ABTestVariantNotFoundError extends ABTestError {
  constructor(variantId, testId) {
    super(`Variant not found: ${variantId} in test ${testId}`, 404, 'AB_TEST_VARIANT_NOT_FOUND');
    this.variantId = variantId;
    this.testId = testId;
  }
}

/**
 * 422 - Invalid state transition
 */
class ABTestInvalidStateError extends ABTestError {
  constructor(message, currentState, targetState) {
    super(message, 422, 'AB_TEST_INVALID_STATE');
    this.currentState = currentState;
    this.targetState = targetState;
  }
}

/**
 * 422 - Minimum variants requirement not met
 */
class ABTestMinVariantsError extends ABTestError {
  constructor(currentCount = 0, requiredCount = 2) {
    super(`A/B Test requires at least ${requiredCount} variants, currently has ${currentCount}`, 422, 'AB_TEST_MIN_VARIANTS');
    this.currentCount = currentCount;
    this.requiredCount = requiredCount;
  }
}

/**
 * 422 - Maximum variants exceeded
 */
class ABTestMaxVariantsError extends ABTestError {
  constructor(maxCount = 4) {
    super(`A/B Test cannot have more than ${maxCount} variants`, 422, 'AB_TEST_MAX_VARIANTS');
    this.maxCount = maxCount;
  }
}

/**
 * 422 - Cannot delete control variant
 */
class ABTestControlVariantError extends ABTestError {
  constructor() {
    super('Cannot delete control variant. Assign control to another variant first.', 422, 'AB_TEST_CONTROL_VARIANT');
  }
}

/**
 * 422 - Cannot delete variant when only 2 remain
 */
class ABTestLastVariantsError extends ABTestError {
  constructor() {
    super('Cannot delete variant. A/B Test must have at least 2 variants.', 422, 'AB_TEST_LAST_VARIANTS');
  }
}

/**
 * 409 - Test already running
 */
class ABTestAlreadyRunningError extends ABTestError {
  constructor(testId) {
    super(`A/B Test is already running: ${testId}`, 409, 'AB_TEST_ALREADY_RUNNING');
    this.testId = testId;
  }
}

/**
 * 409 - Cannot modify running test
 */
class ABTestModifyRunningError extends ABTestError {
  constructor(testId, operation) {
    super(`Cannot ${operation} a running A/B test. Pause or complete the test first.`, 409, 'AB_TEST_MODIFY_RUNNING');
    this.testId = testId;
    this.operation = operation;
  }
}

/**
 * 409 - Cannot delete running test
 */
class ABTestDeleteRunningError extends ABTestError {
  constructor(testId) {
    super(`Cannot delete a running A/B test. Complete or pause the test first.`, 409, 'AB_TEST_DELETE_RUNNING');
    this.testId = testId;
  }
}

/**
 * 422 - Test not running for assignment
 */
class ABTestNotRunningError extends ABTestError {
  constructor(testId, currentStatus) {
    super(`A/B Test is not running. Current status: ${currentStatus}`, 422, 'AB_TEST_NOT_RUNNING');
    this.testId = testId;
    this.currentStatus = currentStatus;
  }
}

/**
 * 404 - Assignment not found
 */
class ABTestAssignmentNotFoundError extends ABTestError {
  constructor(testId, visitorId) {
    super(`No assignment found for visitor ${visitorId} in test ${testId}`, 404, 'AB_TEST_ASSIGNMENT_NOT_FOUND');
    this.testId = testId;
    this.visitorId = visitorId;
  }
}

/**
 * 409 - Duplicate conversion
 */
class ABTestDuplicateConversionError extends ABTestError {
  constructor(testId, visitorId) {
    super(`Conversion already recorded for visitor ${visitorId} in test ${testId}`, 409, 'AB_TEST_DUPLICATE_CONVERSION');
    this.testId = testId;
    this.visitorId = visitorId;
  }
}

/**
 * 422 - Invalid traffic split
 */
class ABTestInvalidTrafficSplitError extends ABTestError {
  constructor(total) {
    super(`Traffic split must total 100%, got ${total}%`, 422, 'AB_TEST_INVALID_TRAFFIC_SPLIT');
    this.total = total;
  }
}

/**
 * 422 - Insufficient sample size for significance
 */
class ABTestInsufficientSampleError extends ABTestError {
  constructor(currentSize, requiredSize = 30) {
    super(`Insufficient sample size for statistical significance. Current: ${currentSize}, Required: ${requiredSize}`, 422, 'AB_TEST_INSUFFICIENT_SAMPLE');
    this.currentSize = currentSize;
    this.requiredSize = requiredSize;
  }
}

/**
 * 403 - Workspace access denied
 */
class ABTestWorkspaceAccessError extends ABTestError {
  constructor(testId, workspaceId) {
    super(`Access denied: Test ${testId} does not belong to workspace ${workspaceId}`, 403, 'AB_TEST_WORKSPACE_ACCESS');
    this.testId = testId;
    this.workspaceId = workspaceId;
  }
}

/**
 * 409 - Duplicate variant name
 */
class ABTestDuplicateVariantError extends ABTestError {
  constructor(variantName, testId) {
    super(`Variant with name '${variantName}' already exists in test ${testId}`, 409, 'AB_TEST_DUPLICATE_VARIANT');
    this.variantName = variantName;
    this.testId = testId;
  }
}

/**
 * Error handler middleware for A/B Test errors
 */
const abTestErrorHandler = (err, req, res, next) => {
  if (err instanceof ABTestError) {
    console.error(`[ABTestError] ${err.code}: ${err.message}`, {
      testId: err.testId,
      status: err.status
    });

    return res.status(err.status).json(err.toJSON());
  }

  // Pass to default error handler
  next(err);
};

/**
 * Async handler wrapper to catch errors
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

module.exports = {
  // Base error
  ABTestError,

  // 404 errors
  ABTestNotFoundError,
  ABTestVariantNotFoundError,
  ABTestAssignmentNotFoundError,

  // 409 errors (Conflict)
  ABTestAlreadyRunningError,
  ABTestModifyRunningError,
  ABTestDeleteRunningError,
  ABTestDuplicateConversionError,
  ABTestDuplicateVariantError,

  // 422 errors (Business logic)
  ABTestInvalidStateError,
  ABTestMinVariantsError,
  ABTestMaxVariantsError,
  ABTestControlVariantError,
  ABTestLastVariantsError,
  ABTestNotRunningError,
  ABTestInvalidTrafficSplitError,
  ABTestInsufficientSampleError,

  // 403 errors (Forbidden)
  ABTestWorkspaceAccessError,

  // Middleware
  abTestErrorHandler,
  asyncHandler
};
