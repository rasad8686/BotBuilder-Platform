import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { ArrowLeft, Save, UserPlus, AlertCircle } from 'lucide-react';
import { useCreateContactMutation } from '../../hooks/email/useContacts';
import { useListsQuery } from '../../hooks/email/useLists';
import ContactForm from '../../components/email/ContactForm';

const ContactCreatePage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    email: '',
    first_name: '',
    last_name: '',
    phone: '',
    company: '',
    job_title: '',
    tags: [],
    lists: [],
    custom_fields: {},
    status: 'subscribed'
  });
  const [errors, setErrors] = useState({});
  const [saveAndAdd, setSaveAndAdd] = useState(false);

  const createMutation = useCreateContactMutation();
  const { data: listsData } = useListsQuery();
  const lists = listsData?.lists || [];

  // Validate form
  const validate = () => {
    const newErrors = {};

    if (!formData.email) {
      newErrors.email = t('email.contactForm.emailRequired', 'Email is required');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = t('email.contactForm.emailInvalid', 'Invalid email address');
    }

    if (formData.phone && !/^[+]?[\d\s-()]+$/.test(formData.phone)) {
      newErrors.phone = t('email.contactForm.phoneInvalid', 'Invalid phone number');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle submit
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validate()) return;

    try {
      await createMutation.mutateAsync(formData);

      if (saveAndAdd) {
        // Reset form for adding another
        setFormData({
          email: '',
          first_name: '',
          last_name: '',
          phone: '',
          company: '',
          job_title: '',
          tags: [],
          lists: formData.lists, // Keep selected lists
          custom_fields: {},
          status: 'subscribed'
        });
        setErrors({});
      } else {
        navigate('/email/contacts');
      }
    } catch (err) {
      if (err.response?.data?.errors) {
        setErrors(err.response.data.errors);
      } else {
        setErrors({ submit: err.message });
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        {/* Back Button */}
        <button
          onClick={() => navigate('/email/contacts')}
          className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          {t('email.contactCreate.backToContacts', 'Back to Contacts')}
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
            <UserPlus className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {t('email.contactCreate.title', 'Add Contact')}
            </h1>
            <p className="text-gray-500 dark:text-gray-400">
              {t('email.contactCreate.subtitle', 'Add a new contact to your email list')}
            </p>
          </div>
        </div>

        {/* Form */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-6">
          {errors.submit && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-500" />
              <p className="text-red-600 dark:text-red-400">{errors.submit}</p>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <ContactForm
              data={formData}
              onChange={setFormData}
              errors={errors}
              lists={lists}
            />

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 mt-8 pt-6 border-t border-gray-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => navigate('/email/contacts')}
                className="px-4 py-2 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700"
              >
                {t('email.contactCreate.cancel', 'Cancel')}
              </button>
              <motion.button
                type="submit"
                onClick={() => setSaveAndAdd(true)}
                disabled={createMutation.isLoading}
                className="px-4 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 disabled:opacity-50"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {createMutation.isLoading ? (
                  t('email.contactCreate.saving', 'Saving...')
                ) : (
                  t('email.contactCreate.saveAndAdd', 'Save & Add Another')
                )}
              </motion.button>
              <motion.button
                type="submit"
                onClick={() => setSaveAndAdd(false)}
                disabled={createMutation.isLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Save className="w-4 h-4" />
                {createMutation.isLoading ? (
                  t('email.contactCreate.saving', 'Saving...')
                ) : (
                  t('email.contactCreate.save', 'Save')
                )}
              </motion.button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ContactCreatePage;
