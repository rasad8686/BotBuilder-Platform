import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import MemberList from '../components/team/MemberList';
import InviteModal from '../components/team/InviteModal';
import RoleEditor from '../components/team/RoleEditor';
import ActivityLog from '../components/team/ActivityLog';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function TeamSettings() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('members');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [members, setMembers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setError('Not authenticated');
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [membersRes, rolesRes, statsRes] = await Promise.all([
        fetch(`${API_URL}/api/team/members`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${API_URL}/api/team/roles`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${API_URL}/api/team/stats`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      if (membersRes.ok) setMembers(await membersRes.json());
      if (rolesRes.ok) setRoles(await rolesRes.json());
      if (statsRes.ok) setStats(await statsRes.json());
    } catch (err) {
      setError('Failed to load team data');
    } finally {
      setLoading(false);
    }
  };

  const handleInviteSent = () => {
    setShowInviteModal(false);
    fetchData();
  };

  const handleMemberUpdated = () => {
    fetchData();
  };

  const handleRoleUpdated = () => {
    fetchData();
  };

  const tabs = [
    { id: 'members', label: t('team.members'), icon: '👥' },
    { id: 'roles', label: t('team.roles'), icon: '🔐' },
    { id: 'activity', label: t('team.activity'), icon: '📋' }
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto min-h-screen bg-gray-50 dark:bg-slate-900 transition-colors duration-300">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">{t('team.settings')}</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {t('team.settingsSubtitle')}
          </p>
        </div>
        {activeTab === 'members' && (
          <button
            onClick={() => setShowInviteModal(true)}
            className="px-5 py-2.5 bg-blue-500 text-white border-none rounded-lg cursor-pointer font-medium flex items-center gap-2 hover:bg-blue-600 transition-colors"
          >
            <span>+</span> {t('team.inviteMember')}
          </button>
        )}
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="p-5 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
            <div className="text-3xl font-bold text-blue-700 dark:text-blue-400">
              {stats.members?.total_members || 0}
            </div>
            <div className="text-blue-900 dark:text-blue-300 text-sm">{t('team.totalMembers')}</div>
          </div>
          <div className="p-5 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800">
            <div className="text-3xl font-bold text-green-700 dark:text-green-400">
              {stats.members?.active_members || 0}
            </div>
            <div className="text-green-900 dark:text-green-300 text-sm">{t('team.activeMembers')}</div>
          </div>
          <div className="p-5 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl border border-yellow-200 dark:border-yellow-800">
            <div className="text-3xl font-bold text-yellow-700 dark:text-yellow-400">
              {stats.invitations?.pending_invitations || 0}
            </div>
            <div className="text-yellow-900 dark:text-yellow-300 text-sm">{t('team.pendingInvites')}</div>
          </div>
          <div className="p-5 bg-purple-50 dark:bg-purple-900/20 rounded-xl border border-purple-200 dark:border-purple-800">
            <div className="text-3xl font-bold text-purple-700 dark:text-purple-400">
              {stats.roles?.length || 0}
            </div>
            <div className="text-purple-900 dark:text-purple-300 text-sm">{t('team.roles')}</div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-200 dark:border-slate-700 pb-3">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-5 py-2.5 border-none rounded-lg cursor-pointer font-medium flex items-center gap-2 transition-all ${
              activeTab === tab.id
                ? 'bg-blue-500 text-white'
                : 'bg-transparent text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800'
            }`}
          >
            <span>{tab.icon}</span> {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-center py-16 text-gray-500 dark:text-gray-400">
          {t('common.loading')}
        </div>
      ) : error ? (
        <div className="text-center py-16 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-xl">
          {error}
        </div>
      ) : (
        <>
          {activeTab === 'members' && (
            <MemberList
              members={members}
              roles={roles}
              onMemberUpdated={handleMemberUpdated}
            />
          )}
          {activeTab === 'roles' && (
            <RoleEditor
              roles={roles}
              onRoleUpdated={handleRoleUpdated}
            />
          )}
          {activeTab === 'activity' && (
            <ActivityLog />
          )}
        </>
      )}

      {/* Invite Modal */}
      {showInviteModal && (
        <InviteModal
          roles={roles}
          onClose={() => setShowInviteModal(false)}
          onInviteSent={handleInviteSent}
        />
      )}
    </div>
  );
}
