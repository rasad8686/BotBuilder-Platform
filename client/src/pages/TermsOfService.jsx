import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Footer from '../components/Footer';

export default function TermsOfService() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="bg-white rounded-lg shadow-md p-8">
          <Link to="/" className="text-blue-600 hover:text-blue-800 mb-4 inline-block">
            &larr; {t('common.back')}
          </Link>

          <h1 className="text-3xl font-bold mb-6">Terms of Service</h1>
          <p className="text-gray-600 mb-4">Last updated: {new Date().toLocaleDateString()}</p>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">1. Acceptance of Terms</h2>
            <p className="text-gray-700 mb-4">
              By accessing and using BotBuilder, you accept and agree to be bound by the terms and
              provisions of this agreement. If you do not agree to these terms, please do not use our service.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">2. Use of Service</h2>
            <p className="text-gray-700 mb-4">
              You agree to use BotBuilder only for lawful purposes and in accordance with these Terms.
              You agree not to:
            </p>
            <ul className="list-disc list-inside text-gray-700 ml-4 mb-4">
              <li>Violate any applicable laws or regulations</li>
              <li>Infringe on intellectual property rights</li>
              <li>Transmit malicious code or viruses</li>
              <li>Attempt to gain unauthorized access to our systems</li>
              <li>Use the service to spam or harass others</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">3. Account Responsibilities</h2>
            <p className="text-gray-700 mb-4">
              You are responsible for:
            </p>
            <ul className="list-disc list-inside text-gray-700 ml-4 mb-4">
              <li>Maintaining the confidentiality of your account credentials</li>
              <li>All activities that occur under your account</li>
              <li>Notifying us immediately of any unauthorized use</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">4. Subscription and Billing</h2>
            <p className="text-gray-700 mb-4">
              Paid subscriptions are billed in advance on a recurring basis. You may cancel your
              subscription at any time. Refunds are handled on a case-by-case basis.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">5. Intellectual Property</h2>
            <p className="text-gray-700 mb-4">
              The service and its original content, features, and functionality are owned by BotBuilder
              and are protected by international copyright, trademark, and other intellectual property laws.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">6. Service Availability</h2>
            <p className="text-gray-700 mb-4">
              We strive to provide reliable service but do not guarantee uninterrupted access. We may:
            </p>
            <ul className="list-disc list-inside text-gray-700 ml-4 mb-4">
              <li>Modify or discontinue features with notice</li>
              <li>Perform maintenance that may temporarily affect service</li>
              <li>Suspend accounts that violate these terms</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">7. Limitation of Liability</h2>
            <p className="text-gray-700 mb-4">
              BotBuilder shall not be liable for any indirect, incidental, special, consequential, or
              punitive damages resulting from your use or inability to use the service.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">8. Termination</h2>
            <p className="text-gray-700 mb-4">
              We may terminate or suspend your account immediately, without prior notice, for conduct
              that we believe violates these Terms or is harmful to other users, us, or third parties.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">9. Changes to Terms</h2>
            <p className="text-gray-700 mb-4">
              We reserve the right to modify these terms at any time. We will notify users of any
              material changes via email or through the service.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">10. Contact Information</h2>
            <p className="text-gray-700">
              For questions about these Terms, please contact us at{' '}
              <a href="mailto:legal@botbuilder.com" className="text-blue-600 hover:text-blue-800">
                legal@botbuilder.com
              </a>
            </p>
          </section>
        </div>
      </div>
      <Footer />
    </div>
  );
}
