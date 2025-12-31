/**
 * @fileoverview Form management hook with validation support
 * @module hooks/useForm
 */

import { useState, useCallback, useMemo } from 'react';

/**
 * Custom hook for managing form state and validation
 * @param {Object} initialValues - Initial form values
 * @param {Object} options - Configuration options
 * @param {Function} options.validate - Validation function (values) => errors
 * @param {Function} options.onSubmit - Submit handler (values) => Promise
 * @param {boolean} options.validateOnChange - Validate on each change (default: false)
 * @param {boolean} options.validateOnBlur - Validate on blur (default: true)
 * @returns {Object} Form state and handlers
 * @property {Object} values - Current form values
 * @property {Object} errors - Validation errors
 * @property {Object} touched - Touched fields
 * @property {boolean} isSubmitting - Submitting state
 * @property {boolean} isValid - Whether form is valid
 * @property {boolean} isDirty - Whether form has been modified
 * @property {Function} handleChange - Change handler for inputs
 * @property {Function} handleBlur - Blur handler for inputs
 * @property {Function} handleSubmit - Form submit handler
 * @property {Function} setFieldValue - Set specific field value
 * @property {Function} setFieldError - Set specific field error
 * @property {Function} setValues - Set multiple values
 * @property {Function} setErrors - Set multiple errors
 * @property {Function} reset - Reset form to initial values
 * @property {Function} validateField - Validate single field
 * @property {Function} validateForm - Validate entire form
 *
 * @example
 * const { values, errors, handleChange, handleSubmit, isSubmitting } = useForm(
 *   { email: '', password: '' },
 *   {
 *     validate: (values) => {
 *       const errors = {};
 *       if (!values.email) errors.email = 'Email is required';
 *       if (!values.password) errors.password = 'Password is required';
 *       return errors;
 *     },
 *     onSubmit: async (values) => {
 *       await loginUser(values);
 *     }
 *   }
 * );
 */
const useForm = (initialValues = {}, options = {}) => {
  const {
    validate,
    onSubmit,
    validateOnChange = false,
    validateOnBlur = true
  } = options;

  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  /**
   * Check if form values differ from initial values
   */
  const isDirty = useMemo(() => {
    return JSON.stringify(values) !== JSON.stringify(initialValues);
  }, [values, initialValues]);

  /**
   * Check if form is valid (no errors)
   */
  const isValid = useMemo(() => {
    return Object.keys(errors).length === 0;
  }, [errors]);

  /**
   * Validate entire form
   * @returns {Object} Validation errors
   */
  const validateForm = useCallback(() => {
    if (!validate) return {};

    const validationErrors = validate(values);
    setErrors(validationErrors || {});
    return validationErrors || {};
  }, [validate, values]);

  /**
   * Validate a single field
   * @param {string} name - Field name
   * @param {any} value - Field value
   * @returns {string|undefined} Error message
   */
  const validateField = useCallback((name, value) => {
    if (!validate) return;

    const allErrors = validate({ ...values, [name]: value });
    const fieldError = allErrors?.[name];

    setErrors(prev => {
      if (fieldError) {
        return { ...prev, [name]: fieldError };
      }
      const { [name]: removed, ...rest } = prev;
      return rest;
    });

    return fieldError;
  }, [validate, values]);

  /**
   * Handle input change
   * @param {Event|Object} eventOrValue - Change event or direct value
   */
  const handleChange = useCallback((eventOrValue) => {
    let name, value;

    if (eventOrValue?.target) {
      // Handle DOM event
      const { target } = eventOrValue;
      name = target.name;
      value = target.type === 'checkbox' ? target.checked : target.value;
    } else if (typeof eventOrValue === 'object' && eventOrValue.name !== undefined) {
      // Handle custom object { name, value }
      name = eventOrValue.name;
      value = eventOrValue.value;
    }

    if (name === undefined) return;

    setValues(prev => ({ ...prev, [name]: value }));

    if (validateOnChange) {
      validateField(name, value);
    }
  }, [validateOnChange, validateField]);

  /**
   * Handle input blur
   * @param {Event} event - Blur event
   */
  const handleBlur = useCallback((event) => {
    const { name, value } = event.target;

    setTouched(prev => ({ ...prev, [name]: true }));

    if (validateOnBlur) {
      validateField(name, value);
    }
  }, [validateOnBlur, validateField]);

  /**
   * Set a specific field value
   * @param {string} name - Field name
   * @param {any} value - Field value
   */
  const setFieldValue = useCallback((name, value) => {
    setValues(prev => ({ ...prev, [name]: value }));

    if (validateOnChange) {
      validateField(name, value);
    }
  }, [validateOnChange, validateField]);

  /**
   * Set a specific field error
   * @param {string} name - Field name
   * @param {string} error - Error message
   */
  const setFieldError = useCallback((name, error) => {
    setErrors(prev => ({ ...prev, [name]: error }));
  }, []);

  /**
   * Handle form submission
   * @param {Event} event - Submit event
   */
  const handleSubmit = useCallback(async (event) => {
    if (event) {
      event.preventDefault();
    }

    // Mark all fields as touched
    const allTouched = Object.keys(values).reduce((acc, key) => {
      acc[key] = true;
      return acc;
    }, {});
    setTouched(allTouched);

    // Validate form
    const validationErrors = validateForm();

    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    if (!onSubmit) return;

    setIsSubmitting(true);

    try {
      await onSubmit(values);
    } catch (err) {
      // Let the onSubmit handler deal with errors
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  }, [values, validateForm, onSubmit]);

  /**
   * Reset form to initial values
   * @param {Object} newInitialValues - Optional new initial values
   */
  const reset = useCallback((newInitialValues) => {
    setValues(newInitialValues || initialValues);
    setErrors({});
    setTouched({});
    setIsSubmitting(false);
  }, [initialValues]);

  /**
   * Get field props for easy binding
   * @param {string} name - Field name
   * @returns {Object} Props object for input
   */
  const getFieldProps = useCallback((name) => ({
    name,
    value: values[name] ?? '',
    onChange: handleChange,
    onBlur: handleBlur
  }), [values, handleChange, handleBlur]);

  return {
    values,
    errors,
    touched,
    isSubmitting,
    isValid,
    isDirty,
    handleChange,
    handleBlur,
    handleSubmit,
    setFieldValue,
    setFieldError,
    setValues,
    setErrors,
    reset,
    validateField,
    validateForm,
    getFieldProps
  };
};

export default useForm;
