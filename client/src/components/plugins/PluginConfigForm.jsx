import React, { useState, useEffect } from 'react';

const PluginConfigForm = ({
  schema = {},
  values = {},
  onChange,
  onSubmit,
  submitLabel = 'Save Settings',
  loading = false,
  showReset = true,
  className = ''
}) => {
  const [formValues, setFormValues] = useState({});
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  // Initialize form values
  useEffect(() => {
    const initialValues = {};
    Object.entries(schema).forEach(([key, config]) => {
      initialValues[key] = values[key] !== undefined ? values[key] : config.default;
    });
    setFormValues(initialValues);
  }, [schema, values]);

  const handleChange = (key, value) => {
    const newValues = { ...formValues, [key]: value };
    setFormValues(newValues);
    setTouched(prev => ({ ...prev, [key]: true }));

    // Validate field
    const error = validateField(key, value, schema[key]);
    setErrors(prev => ({ ...prev, [key]: error }));

    // Notify parent
    if (onChange) {
      onChange(newValues);
    }
  };

  const validateField = (key, value, config) => {
    if (config.required && (value === undefined || value === null || value === '')) {
      return `${config.label || key} is required`;
    }

    if (config.type === 'string' && config.minLength && value.length < config.minLength) {
      return `Minimum ${config.minLength} characters required`;
    }

    if (config.type === 'string' && config.maxLength && value.length > config.maxLength) {
      return `Maximum ${config.maxLength} characters allowed`;
    }

    if (config.type === 'number') {
      if (config.min !== undefined && value < config.min) {
        return `Minimum value is ${config.min}`;
      }
      if (config.max !== undefined && value > config.max) {
        return `Maximum value is ${config.max}`;
      }
    }

    if (config.pattern && !new RegExp(config.pattern).test(value)) {
      return config.patternMessage || 'Invalid format';
    }

    if (config.validate && typeof config.validate === 'function') {
      return config.validate(value);
    }

    return null;
  };

  const validateForm = () => {
    const newErrors = {};
    let isValid = true;

    Object.entries(schema).forEach(([key, config]) => {
      const error = validateField(key, formValues[key], config);
      if (error) {
        newErrors[key] = error;
        isValid = false;
      }
    });

    setErrors(newErrors);
    setTouched(Object.keys(schema).reduce((acc, key) => ({ ...acc, [key]: true }), {}));

    return isValid;
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (validateForm() && onSubmit) {
      onSubmit(formValues);
    }
  };

  const handleReset = () => {
    const defaultValues = {};
    Object.entries(schema).forEach(([key, config]) => {
      defaultValues[key] = config.default;
    });
    setFormValues(defaultValues);
    setErrors({});
    setTouched({});

    if (onChange) {
      onChange(defaultValues);
    }
  };

  const renderField = (key, config) => {
    const value = formValues[key];
    const error = touched[key] && errors[key];

    switch (config.type) {
      case 'string':
        if (config.multiline) {
          return (
            <textarea
              value={value || ''}
              onChange={(e) => handleChange(key, e.target.value)}
              placeholder={config.placeholder}
              rows={config.rows || 3}
              className={error ? 'has-error' : ''}
              disabled={config.disabled}
            />
          );
        }
        return (
          <input
            type={config.secret ? 'password' : 'text'}
            value={value || ''}
            onChange={(e) => handleChange(key, e.target.value)}
            placeholder={config.placeholder}
            className={error ? 'has-error' : ''}
            disabled={config.disabled}
          />
        );

      case 'number':
        return (
          <input
            type="number"
            value={value ?? ''}
            onChange={(e) => handleChange(key, parseFloat(e.target.value) || 0)}
            min={config.min}
            max={config.max}
            step={config.step || 1}
            className={error ? 'has-error' : ''}
            disabled={config.disabled}
          />
        );

      case 'boolean':
        return (
          <label className="toggle-container">
            <input
              type="checkbox"
              checked={!!value}
              onChange={(e) => handleChange(key, e.target.checked)}
              disabled={config.disabled}
            />
            <span className="toggle-slider"></span>
            {config.toggleLabel && <span className="toggle-label">{config.toggleLabel}</span>}
          </label>
        );

      case 'select':
        return (
          <select
            value={value || ''}
            onChange={(e) => handleChange(key, e.target.value)}
            className={error ? 'has-error' : ''}
            disabled={config.disabled}
          >
            {config.placeholder && (
              <option value="" disabled>{config.placeholder}</option>
            )}
            {(config.options || []).map((opt) => (
              <option key={opt.value || opt} value={opt.value || opt}>
                {opt.label || opt}
              </option>
            ))}
          </select>
        );

      case 'array':
        return (
          <div className="array-field">
            <textarea
              value={Array.isArray(value) ? value.join('\n') : ''}
              onChange={(e) => handleChange(key, e.target.value.split('\n').filter(Boolean))}
              placeholder={config.placeholder || 'One item per line'}
              rows={config.rows || 4}
              className={error ? 'has-error' : ''}
              disabled={config.disabled}
            />
            <span className="array-hint">Enter one item per line</span>
          </div>
        );

      case 'color':
        return (
          <div className="color-field">
            <input
              type="color"
              value={value || '#000000'}
              onChange={(e) => handleChange(key, e.target.value)}
              disabled={config.disabled}
            />
            <input
              type="text"
              value={value || ''}
              onChange={(e) => handleChange(key, e.target.value)}
              placeholder="#000000"
              className={error ? 'has-error' : ''}
              disabled={config.disabled}
            />
          </div>
        );

      case 'url':
        return (
          <input
            type="url"
            value={value || ''}
            onChange={(e) => handleChange(key, e.target.value)}
            placeholder={config.placeholder || 'https://example.com'}
            className={error ? 'has-error' : ''}
            disabled={config.disabled}
          />
        );

      case 'email':
        return (
          <input
            type="email"
            value={value || ''}
            onChange={(e) => handleChange(key, e.target.value)}
            placeholder={config.placeholder || 'email@example.com'}
            className={error ? 'has-error' : ''}
            disabled={config.disabled}
          />
        );

      default:
        return (
          <input
            type="text"
            value={value || ''}
            onChange={(e) => handleChange(key, e.target.value)}
            className={error ? 'has-error' : ''}
            disabled={config.disabled}
          />
        );
    }
  };

  const schemaEntries = Object.entries(schema);

  if (schemaEntries.length === 0) {
    return (
      <div className="config-form-empty">
        <p>No configuration options available.</p>
      </div>
    );
  }

  // Group fields by section
  const groups = {};
  schemaEntries.forEach(([key, config]) => {
    const section = config.section || 'General';
    if (!groups[section]) {
      groups[section] = [];
    }
    groups[section].push([key, config]);
  });

  return (
    <form className={`plugin-config-form ${className}`} onSubmit={handleSubmit}>
      {Object.entries(groups).map(([section, fields]) => (
        <div key={section} className="form-section">
          {Object.keys(groups).length > 1 && (
            <h3 className="section-title">{section}</h3>
          )}

          {fields.map(([key, config]) => (
            <div key={key} className={`form-field ${config.type}`}>
              <label>
                {config.label || key}
                {config.required && <span className="required">*</span>}
              </label>

              {config.description && (
                <p className="field-description">{config.description}</p>
              )}

              {renderField(key, config)}

              {touched[key] && errors[key] && (
                <span className="field-error">{errors[key]}</span>
              )}

              {config.hint && !errors[key] && (
                <span className="field-hint">{config.hint}</span>
              )}
            </div>
          ))}
        </div>
      ))}

      <div className="form-actions">
        {showReset && (
          <button type="button" className="btn-reset" onClick={handleReset}>
            Reset to Defaults
          </button>
        )}
        <button type="submit" className="btn-submit" disabled={loading}>
          {loading ? 'Saving...' : submitLabel}
        </button>
      </div>

      <style>{`
        .plugin-config-form {
          width: 100%;
        }

        .config-form-empty {
          text-align: center;
          padding: 40px;
          color: #6b7280;
        }

        .form-section {
          margin-bottom: 24px;
        }

        .section-title {
          margin: 0 0 16px 0;
          padding-bottom: 8px;
          border-bottom: 1px solid #e5e7eb;
          font-size: 16px;
          color: #1a1a2e;
        }

        .form-field {
          margin-bottom: 20px;
        }

        .form-field label {
          display: block;
          font-weight: 600;
          color: #1a1a2e;
          margin-bottom: 4px;
        }

        .required {
          color: #dc2626;
          margin-left: 4px;
        }

        .field-description {
          margin: 4px 0 8px;
          font-size: 13px;
          color: #6b7280;
        }

        .form-field input[type="text"],
        .form-field input[type="password"],
        .form-field input[type="number"],
        .form-field input[type="url"],
        .form-field input[type="email"],
        .form-field select,
        .form-field textarea {
          width: 100%;
          padding: 12px;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          font-size: 14px;
          transition: border-color 0.2s;
        }

        .form-field input:focus,
        .form-field select:focus,
        .form-field textarea:focus {
          outline: none;
          border-color: #667eea;
        }

        .form-field input.has-error,
        .form-field select.has-error,
        .form-field textarea.has-error {
          border-color: #dc2626;
        }

        .form-field input:disabled,
        .form-field select:disabled,
        .form-field textarea:disabled {
          background: #f3f4f6;
          cursor: not-allowed;
        }

        .toggle-container {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          cursor: pointer;
        }

        .toggle-container input {
          display: none;
        }

        .toggle-slider {
          width: 48px;
          height: 26px;
          background: #d1d5db;
          border-radius: 26px;
          position: relative;
          transition: background 0.3s;
        }

        .toggle-slider::before {
          content: '';
          position: absolute;
          width: 20px;
          height: 20px;
          background: white;
          border-radius: 50%;
          top: 3px;
          left: 3px;
          transition: transform 0.3s;
        }

        .toggle-container input:checked + .toggle-slider {
          background: #667eea;
        }

        .toggle-container input:checked + .toggle-slider::before {
          transform: translateX(22px);
        }

        .toggle-label {
          color: #4b5563;
          font-weight: normal;
        }

        .array-field {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .array-hint {
          font-size: 12px;
          color: #9ca3af;
        }

        .color-field {
          display: flex;
          gap: 8px;
          align-items: center;
        }

        .color-field input[type="color"] {
          width: 48px;
          height: 40px;
          padding: 0;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          cursor: pointer;
        }

        .color-field input[type="text"] {
          flex: 1;
        }

        .field-error {
          display: block;
          margin-top: 4px;
          font-size: 13px;
          color: #dc2626;
        }

        .field-hint {
          display: block;
          margin-top: 4px;
          font-size: 12px;
          color: #9ca3af;
        }

        .form-actions {
          display: flex;
          gap: 12px;
          justify-content: flex-end;
          margin-top: 24px;
          padding-top: 24px;
          border-top: 1px solid #e5e7eb;
        }

        .btn-reset,
        .btn-submit {
          padding: 12px 24px;
          border: none;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-reset {
          background: #f3f4f6;
          color: #4b5563;
        }

        .btn-reset:hover {
          background: #e5e7eb;
        }

        .btn-submit {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }

        .btn-submit:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
        }

        .btn-submit:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      `}</style>
    </form>
  );
};

export default PluginConfigForm;
