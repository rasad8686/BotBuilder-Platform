/**
 * Shared password validation utility
 */

function validatePassword(password) {
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);

  if (password.length < minLength) return { valid: false, message: 'Password must be at least 8 characters' };
  if (!hasUpperCase) return { valid: false, message: 'Password must contain uppercase letter' };
  if (!hasLowerCase) return { valid: false, message: 'Password must contain lowercase letter' };
  if (!hasNumber) return { valid: false, message: 'Password must contain a number' };

  return { valid: true };
}

module.exports = { validatePassword };
