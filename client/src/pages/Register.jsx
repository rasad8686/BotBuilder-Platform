import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { validateEmail, validatePassword, validateRequired } from '../utils/formValidation';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://botbuilder-platform.onrender.com';

export default function Register() {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});

    // Validate fields
    const errors = {};
    const nameError = validateRequired(formData.name, 'Name');
    const emailError = validateEmail(formData.email);
    const passwordError = validatePassword(formData.password);

    if (nameError) errors.name = nameError;
    if (emailError) errors.email = emailError;
    if (passwordError) errors.password = passwordError;
    if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setLoading(true);

    try {
      const response = await axios.post(`${API_BASE_URL}/api/auth/register`, {
        username: formData.name,  // Backend expects 'username', not 'name'
        email: formData.email,
        password: formData.password
      });

      if (response.data.token) {
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('user', JSON.stringify(response.data.user));
        if (response.data.user?.currentOrganizationId) {
          localStorage.setItem('currentOrganizationId', response.data.user.currentOrganizationId);
        }
        navigate('/dashboard');
      } else {
        setError(t('errors.registerNoToken'));
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-500 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <h1 className="text-3xl font-bold text-center mb-2">BotBuilder</h1>
        <p className="text-gray-600 text-center mb-6">{t('auth.createAccount')}</p>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} role="form" aria-label="Registration form">
          <div className="mb-4">
            <label htmlFor="register-name" className="block text-gray-700 font-semibold mb-2">{t('auth.name')}</label>
            <input
              id="register-name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              aria-describedby={fieldErrors.name ? 'name-error' : undefined}
              aria-invalid={fieldErrors.name ? 'true' : 'false'}
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 ${fieldErrors.name ? 'border-red-500' : ''}`}
            />
            {fieldErrors.name && <p id="name-error" className="text-red-500 text-sm mt-1" role="alert">{fieldErrors.name}</p>}
          </div>

          <div className="mb-4">
            <label htmlFor="register-email" className="block text-gray-700 font-semibold mb-2">{t('auth.email')}</label>
            <input
              id="register-email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
              aria-describedby={fieldErrors.email ? 'reg-email-error' : undefined}
              aria-invalid={fieldErrors.email ? 'true' : 'false'}
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 ${fieldErrors.email ? 'border-red-500' : ''}`}
            />
            {fieldErrors.email && <p id="reg-email-error" className="text-red-500 text-sm mt-1" role="alert">{fieldErrors.email}</p>}
          </div>

          <div className="mb-4">
            <label htmlFor="register-password" className="block text-gray-700 font-semibold mb-2">{t('auth.password')}</label>
            <div className="relative">
              <input
                id="register-password"
                type={showPassword ? "text" : "password"}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                aria-describedby={fieldErrors.password ? 'reg-password-error' : undefined}
                aria-invalid={fieldErrors.password ? 'true' : 'false'}
                className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 pr-10 ${fieldErrors.password ? 'border-red-500' : ''}`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
            {fieldErrors.password && <p id="reg-password-error" className="text-red-500 text-sm mt-1" role="alert">{fieldErrors.password}</p>}
          </div>

          <div className="mb-6">
            <label htmlFor="register-confirm-password" className="block text-gray-700 font-semibold mb-2">{t('auth.confirmPassword', 'Confirm Password')}</label>
            <input
              id="register-confirm-password"
              type="password"
              value={formData.confirmPassword}
              onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              required
              aria-describedby={fieldErrors.confirmPassword ? 'confirm-password-error' : undefined}
              aria-invalid={fieldErrors.confirmPassword ? 'true' : 'false'}
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 ${fieldErrors.confirmPassword ? 'border-red-500' : ''}`}
            />
            {fieldErrors.confirmPassword && <p id="confirm-password-error" className="text-red-500 text-sm mt-1" role="alert">{fieldErrors.confirmPassword}</p>}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-purple-600 text-white py-3 rounded-lg font-semibold hover:bg-purple-700 disabled:opacity-50"
          >
            {loading ? t('auth.creating') : t('auth.register')}
          </button>
        </form>

        <p className="text-center mt-6 text-gray-600">
          {t('auth.haveAccount')} <Link to="/login" className="text-purple-600 hover:underline">{t('auth.login')}</Link>
        </p>
      </div>
    </div>
  );
}