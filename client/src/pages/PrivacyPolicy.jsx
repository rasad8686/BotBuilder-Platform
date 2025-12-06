import { Link } from 'react-router-dom';
import Footer from '../components/Footer';

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="bg-white rounded-lg shadow-md p-8">
          <Link to="/" className="text-blue-600 hover:text-blue-800 mb-4 inline-block">
            &larr; Back to Home
          </Link>

          <h1 className="text-3xl font-bold mb-6">Privacy Policy</h1>
          <p className="text-gray-600 mb-4">Last updated: {new Date().toLocaleDateString()}</p>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">1. Information We Collect</h2>
            <p className="text-gray-700 mb-4">
              We collect information you provide directly to us, including:
            </p>
            <ul className="list-disc list-inside text-gray-700 ml-4 mb-4">
              <li>Account information (name, email, password)</li>
              <li>Bot configurations and settings</li>
              <li>Usage data and analytics</li>
              <li>Payment information (processed securely via Stripe)</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">2. How We Use Your Information</h2>
            <p className="text-gray-700 mb-4">
              We use the information we collect to:
            </p>
            <ul className="list-disc list-inside text-gray-700 ml-4 mb-4">
              <li>Provide, maintain, and improve our services</li>
              <li>Process your transactions and send related information</li>
              <li>Send you technical notices and support messages</li>
              <li>Respond to your comments and questions</li>
              <li>Monitor and analyze trends and usage</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">3. Data Security</h2>
            <p className="text-gray-700 mb-4">
              We implement appropriate security measures to protect your personal information:
            </p>
            <ul className="list-disc list-inside text-gray-700 ml-4 mb-4">
              <li>Encrypted data transmission (HTTPS)</li>
              <li>Secure password hashing (bcrypt)</li>
              <li>Rate limiting to prevent abuse</li>
              <li>Regular security audits</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">4. Data Retention</h2>
            <p className="text-gray-700 mb-4">
              We retain your information for as long as your account is active or as needed to provide you services.
              You may request deletion of your account at any time.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">5. Third-Party Services</h2>
            <p className="text-gray-700 mb-4">
              We use third-party services including:
            </p>
            <ul className="list-disc list-inside text-gray-700 ml-4 mb-4">
              <li>Stripe for payment processing</li>
              <li>Hosting providers for infrastructure</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">6. Your Rights</h2>
            <p className="text-gray-700 mb-4">
              You have the right to:
            </p>
            <ul className="list-disc list-inside text-gray-700 ml-4 mb-4">
              <li>Access your personal data</li>
              <li>Correct inaccurate data</li>
              <li>Request deletion of your data</li>
              <li>Export your data</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">7. Contact Us</h2>
            <p className="text-gray-700">
              If you have any questions about this Privacy Policy, please contact us at{' '}
              <a href="mailto:privacy@botbuilder.com" className="text-blue-600 hover:text-blue-800">
                privacy@botbuilder.com
              </a>
            </p>
          </section>
        </div>
      </div>
      <Footer />
    </div>
  );
}
