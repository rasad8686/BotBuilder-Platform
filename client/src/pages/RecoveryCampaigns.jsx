import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Plus,
  Play,
  Pause,
  Edit2,
  Trash2,
  X,
  AlertCircle,
  TrendingUp,
  Users,
  Mail,
  Search
} from 'lucide-react';
import api from '../utils/api';

/**
 * RecoveryCampaigns Page
 * Campaign management for AI Revenue Recovery Engine
 */
const RecoveryCampaigns = () => {
  const { t } = useTranslation();
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [formData, setFormData] = useState({
    name: '',
    campaign_type: 'abandoned_cart',
    channel: 'email',
    message_template: '',
    trigger_conditions: {},
    status: 'draft'
  });

  useEffect(() => {
    fetchCampaigns();
  }, [statusFilter]);

  const fetchCampaigns = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = { limit: 100 };
      if (statusFilter !== 'all') {
        params.status = statusFilter;
      }
      const response = await api.get('/api/recovery/campaigns', { params });
      setCampaigns(response.data.campaigns || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load campaigns');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCampaign = async (e) => {
    e.preventDefault();
    try {
      if (editingCampaign) {
        await api.put(`/api/recovery/campaigns/${editingCampaign.id}`, formData);
      } else {
        await api.post('/api/recovery/campaigns', formData);
      }
      setShowModal(false);
      setEditingCampaign(null);
      resetForm();
      fetchCampaigns();
    } catch (err) {
      alert(err.response?.data?.message || t('recovery.saveCampaignError'));
    }
  };

  const handleToggleStatus = async (campaign) => {
    try {
      const newStatus = campaign.status === 'active' ? 'paused' : 'active';
      await api.put(`/api/recovery/campaigns/${campaign.id}`, { status: newStatus });
      fetchCampaigns();
    } catch (err) {
      alert(err.response?.data?.message || t('recovery.updateStatusError'));
    }
  };

  const handleDeleteCampaign = async (id) => {
    if (!confirm(t('recovery.deleteCampaignConfirm'))) return;
    try {
      await api.delete(`/api/recovery/campaigns/${id}`);
      fetchCampaigns();
    } catch (err) {
      alert(err.response?.data?.message || t('recovery.deleteCampaignError'));
    }
  };

  const openEditModal = (campaign) => {
    setEditingCampaign(campaign);
    setFormData({
      name: campaign.name,
      campaign_type: campaign.campaign_type,
      channel: campaign.channel,
      message_template: campaign.message_template || '',
      trigger_conditions: campaign.trigger_conditions || {},
      status: campaign.status
    });
    setShowModal(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      campaign_type: 'abandoned_cart',
      channel: 'email',
      message_template: '',
      trigger_conditions: {},
      status: 'draft'
    });
  };

  const filteredCampaigns = campaigns.filter(campaign =>
    campaign.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatPercent = (value) => `${(value || 0).toFixed(1)}%`;

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-white rounded-lg shadow-sm p-12 text-center border border-gray-200">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">{t('recovery.failedToLoadCampaigns')}</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={fetchCampaigns}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
          >
            {t('recovery.tryAgain')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('recovery.campaignsTitle')}</h1>
          <p className="text-gray-600 mt-1">{t('recovery.campaignsSubtitle')}</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setEditingCampaign(null);
            setShowModal(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          {t('recovery.newCampaign')}
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder={t('recovery.searchCampaigns')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        >
          <option value="all">{t('recovery.allStatus')}</option>
          <option value="active">{t('recovery.active')}</option>
          <option value="paused">{t('recovery.paused')}</option>
          <option value="draft">{t('recovery.draft')}</option>
        </select>
      </div>

      {/* Campaigns Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-6">
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="animate-pulse flex items-center gap-4">
                  <div className="h-10 bg-gray-200 rounded w-1/4"></div>
                  <div className="h-10 bg-gray-200 rounded w-1/6"></div>
                  <div className="h-10 bg-gray-200 rounded w-1/6"></div>
                  <div className="h-10 bg-gray-200 rounded w-1/6"></div>
                  <div className="h-10 bg-gray-200 rounded w-1/6"></div>
                </div>
              ))}
            </div>
          </div>
        ) : filteredCampaigns.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <th className="px-6 py-3">{t('recovery.campaign')}</th>
                  <th className="px-6 py-3">{t('recovery.type')}</th>
                  <th className="px-6 py-3">{t('recovery.channel')}</th>
                  <th className="px-6 py-3">{t('recovery.performance')}</th>
                  <th className="px-6 py-3">{t('recovery.status')}</th>
                  <th className="px-6 py-3">{t('recovery.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredCampaigns.map((campaign) => (
                  <tr key={campaign.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{campaign.name}</p>
                        <p className="text-xs text-gray-500">
                          Created {new Date(campaign.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex px-2 py-1 text-xs rounded-full bg-indigo-100 text-indigo-700">
                        {campaign.campaign_type?.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1 text-sm text-gray-600">
                        <Mail className="w-4 h-4" />
                        {campaign.channel}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1 text-sm">
                          <TrendingUp className="w-4 h-4 text-green-500" />
                          <span className="text-gray-900">{formatPercent(campaign.conversion_rate)}</span>
                        </div>
                        <div className="flex items-center gap-1 text-sm">
                          <Users className="w-4 h-4 text-blue-500" />
                          <span className="text-gray-600">{campaign.total_sent || 0}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleToggleStatus(campaign)}
                        className={`inline-flex items-center gap-1 px-3 py-1 text-xs rounded-full transition-colors ${
                          campaign.status === 'active'
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : campaign.status === 'paused'
                            ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {campaign.status === 'active' ? (
                          <><Play className="w-3 h-3" /> {t('recovery.active')}</>
                        ) : campaign.status === 'paused' ? (
                          <><Pause className="w-3 h-3" /> {t('recovery.paused')}</>
                        ) : (
                          t('recovery.draft')
                        )}
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEditModal(campaign)}
                          className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          title={t('common.edit')}
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteCampaign(campaign.id)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title={t('common.delete')}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center">
            <p className="text-gray-500 mb-4">{t('recovery.noCampaigns')}</p>
            <button
              onClick={() => {
                resetForm();
                setEditingCampaign(null);
                setShowModal(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              <Plus className="w-5 h-5" />
              {t('recovery.createFirstCampaign')}
            </button>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingCampaign ? t('recovery.editCampaign') : t('recovery.createNewCampaign')}
              </h2>
              <button
                onClick={() => {
                  setShowModal(false);
                  setEditingCampaign(null);
                }}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCampaign} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('recovery.campaignName')}
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder={t('recovery.enterCampaignName')}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('recovery.campaignType')}
                </label>
                <select
                  value={formData.campaign_type}
                  onChange={(e) => setFormData({ ...formData, campaign_type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="abandoned_cart">{t('recovery.abandonedCart')}</option>
                  <option value="churn_prevention">{t('recovery.churnPrevention')}</option>
                  <option value="win_back">{t('recovery.winBack')}</option>
                  <option value="upsell">{t('recovery.upsell')}</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('recovery.channel')}
                </label>
                <select
                  value={formData.channel}
                  onChange={(e) => setFormData({ ...formData, channel: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="email">{t('recovery.email')}</option>
                  <option value="sms">{t('recovery.sms')}</option>
                  <option value="whatsapp">{t('recovery.whatsapp')}</option>
                  <option value="telegram">{t('recovery.telegram')}</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('recovery.messageTemplate')}
                </label>
                <textarea
                  value={formData.message_template}
                  onChange={(e) => setFormData({ ...formData, message_template: e.target.value })}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder={t('recovery.enterMessageTemplate')}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('recovery.status')}
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="draft">{t('recovery.draft')}</option>
                  <option value="active">{t('recovery.active')}</option>
                  <option value="paused">{t('recovery.paused')}</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingCampaign(null);
                  }}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  {t('recovery.cancel')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  {editingCampaign ? t('recovery.updateCampaign') : t('recovery.createCampaign')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default RecoveryCampaigns;
