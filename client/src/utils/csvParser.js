/**
 * @fileoverview CSV parsing utility for contact imports
 * @module utils/csvParser
 */

import Papa from 'papaparse';

/**
 * Parse a CSV file
 * @param {File} file - The CSV file to parse
 * @returns {Promise<{data: Array, headers: Array, errors: Array}>}
 */
export const parseCSV = (file) => {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
      complete: (results) => {
        resolve({
          data: results.data,
          headers: results.meta.fields || [],
          errors: results.errors
        });
      },
      error: (error) => {
        reject(new Error(error.message || 'Failed to parse CSV file'));
      }
    });
  });
};

/**
 * Common column name mappings for auto-detection
 */
const commonMappings = {
  email: [
    'email', 'e-mail', 'email address', 'emailaddress', 'e_mail',
    'mail', 'email_address', 'primary_email', 'work_email'
  ],
  first_name: [
    'first name', 'firstname', 'first', 'ad', 'isim', 'name', 'given name',
    'first_name', 'fname', 'givenname', 'given_name'
  ],
  last_name: [
    'last name', 'lastname', 'last', 'soyad', 'surname', 'family name',
    'last_name', 'lname', 'familyname', 'family_name'
  ],
  phone: [
    'phone', 'telephone', 'tel', 'mobile', 'telefon', 'phone number',
    'phonenumber', 'phone_number', 'mobile_phone', 'cell', 'cellphone'
  ],
  company: [
    'company', 'organization', 'şirket', 'firma', 'org', 'company name',
    'companyname', 'company_name', 'organization_name', 'employer'
  ],
  job_title: [
    'job title', 'title', 'position', 'ünvan', 'pozisyon', 'role',
    'job_title', 'jobtitle', 'job', 'designation'
  ],
  tags: [
    'tags', 'tag', 'labels', 'label', 'categories', 'category', 'groups'
  ]
};

/**
 * Auto-detect column mappings based on header names
 * @param {Array<string>} headers - CSV column headers
 * @returns {Object} Mapping of CSV headers to contact fields
 */
export const autoMapColumns = (headers) => {
  const mapping = {};

  headers.forEach(header => {
    const headerLower = header.toLowerCase().trim();

    for (const [field, aliases] of Object.entries(commonMappings)) {
      if (aliases.includes(headerLower) || aliases.some(alias => headerLower.includes(alias))) {
        // Don't map if already mapped to this field
        if (!Object.values(mapping).includes(field)) {
          mapping[header] = field;
          break;
        }
      }
    }
  });

  return mapping;
};

/**
 * Validate email address format
 * @param {string} email - Email address to validate
 * @returns {boolean} True if valid
 */
export const validateEmail = (email) => {
  if (!email || typeof email !== 'string') return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
};

/**
 * Validate phone number format (basic validation)
 * @param {string} phone - Phone number to validate
 * @returns {boolean} True if valid
 */
export const validatePhone = (phone) => {
  if (!phone || typeof phone !== 'string') return true; // Phone is optional
  const phoneRegex = /^[+]?[\d\s\-()]+$/;
  return phoneRegex.test(phone.trim()) && phone.replace(/\D/g, '').length >= 7;
};

/**
 * Validate and categorize import data
 * @param {Array} data - Parsed CSV data
 * @param {Object} mapping - Column to field mapping
 * @returns {{valid: Array, invalid: Array, duplicates: Array}}
 */
export const validateImportData = (data, mapping) => {
  const results = {
    valid: [],
    invalid: [],
    duplicates: []
  };

  const seenEmails = new Set();

  // Find the email column
  const emailColumn = Object.keys(mapping).find(k => mapping[k] === 'email');

  data.forEach((row, index) => {
    const rowNumber = index + 2; // +2 because row 1 is header and we're 0-indexed

    // Get email value
    const email = emailColumn ? row[emailColumn]?.trim().toLowerCase() : null;

    // Validate email
    if (!email) {
      results.invalid.push({
        row: rowNumber,
        reason: 'Missing email',
        data: row
      });
      return;
    }

    if (!validateEmail(email)) {
      results.invalid.push({
        row: rowNumber,
        reason: 'Invalid email format',
        data: row
      });
      return;
    }

    // Check for duplicates within the file
    if (seenEmails.has(email)) {
      results.duplicates.push({
        row: rowNumber,
        email,
        data: row
      });
      return;
    }

    seenEmails.add(email);

    // Validate phone if present
    const phoneColumn = Object.keys(mapping).find(k => mapping[k] === 'phone');
    if (phoneColumn && row[phoneColumn]) {
      if (!validatePhone(row[phoneColumn])) {
        results.invalid.push({
          row: rowNumber,
          reason: 'Invalid phone format',
          data: row
        });
        return;
      }
    }

    // Row is valid
    results.valid.push(row);
  });

  return results;
};

/**
 * Transform row data according to mapping
 * @param {Object} row - Raw CSV row
 * @param {Object} mapping - Column to field mapping
 * @returns {Object} Transformed contact data
 */
export const transformRow = (row, mapping) => {
  const contact = {};

  Object.entries(mapping).forEach(([column, field]) => {
    if (field === 'skip' || !row[column]) return;

    let value = row[column].trim();

    // Special handling for certain fields
    switch (field) {
      case 'email':
        value = value.toLowerCase();
        break;
      case 'tags':
        // Split tags by comma
        value = value.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
        break;
      default:
        break;
    }

    contact[field] = value;
  });

  return contact;
};

/**
 * Generate sample CSV template content
 * @returns {string} CSV content
 */
export const generateTemplate = () => {
  const headers = ['email', 'first_name', 'last_name', 'phone', 'company', 'job_title', 'tags'];
  const sampleRows = [
    ['john@example.com', 'John', 'Doe', '+1234567890', 'Acme Inc', 'CEO', 'vip,customer'],
    ['jane@example.com', 'Jane', 'Smith', '+0987654321', 'TechCorp', 'CTO', 'lead,tech']
  ];

  return [headers.join(','), ...sampleRows.map(row => row.join(','))].join('\n');
};

/**
 * Download template as CSV file
 */
export const downloadTemplate = () => {
  const content = generateTemplate();
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'contacts_template.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
};

export default {
  parseCSV,
  autoMapColumns,
  validateEmail,
  validatePhone,
  validateImportData,
  transformRow,
  generateTemplate,
  downloadTemplate
};
