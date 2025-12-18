import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

const SSOCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const token = searchParams.get('token');
    const returnUrl = searchParams.get('returnUrl') || '/dashboard';

    if (token) {
      // Store token
      localStorage.setItem('token', token);

      // Decode token to get user info (basic JWT decode)
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        localStorage.setItem('user', JSON.stringify({
          id: payload.id,
          email: payload.email,
          organization_id: payload.organization_id
        }));

        if (payload.organization_id) {
          localStorage.setItem('currentOrganizationId', payload.organization_id);
        }
      } catch (e) {
        console.error('Error decoding token:', e);
      }

      // Redirect to return URL
      navigate(returnUrl, { replace: true });
    } else {
      // No token, redirect to login with error
      navigate('/login?error=sso_failed&message=No%20token%20received', { replace: true });
    }
  }, [navigate, searchParams]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-purple-500 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
        <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-800">Completing SSO Login...</h2>
        <p className="text-gray-600 mt-2">Please wait while we authenticate you.</p>
      </div>
    </div>
  );
};

export default SSOCallback;
