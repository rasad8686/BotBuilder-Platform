/**
 * AutomationRulesPage
 * Manage ticket automation rules
 */

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Plus,
  Settings,
  Trash2,
  Edit,
  Play,
  Pause,
  Copy,
  ChevronDown,
  ChevronUp,
  Zap,
  Clock,
  AlertTriangle,
  CheckCircle,
  Filter,
  Search,
  RefreshCw,
  FileText
} from 'lucide-react';
import useApi from '../../hooks/useApi';
import RuleBuilderModal from '../../components/tickets/automation/RuleBuilderModal';
import RuleLogViewer from '../../components/tickets/automation/RuleLogViewer';

// Trigger type labels
const TRIGGER_TYPES = {
  ticket_created: { label: 'Ticket Created', icon: Plus, color: 'blue' },
  ticket_updated: { label: 'Ticket Updated', icon: Edit, color: 'amber' },
  time_based: { label: 'Time Based', icon: Clock, color: 'purple' },
  sla_breach: { label: 'SLA Breach', icon: AlertTriangle, color: 'red' },
};

/**
 * Rule Card Component
 */
function RuleCard({ rule, onEdit, onToggle, onDelete, onViewLogs, onTest }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const trigger = TRIGGER_TYPES[rule.trigger_type] || TRIGGER_TYPES.ticket_created;
  const TriggerIcon = trigger.icon;

  return (
    <div className={`bg-white dark:bg-slate-800 rounded-lg border ${
      rule.is_active
        ? 'border-gray-200 dark:border-slate-700'
        : 'border-gray-300 dark:border-slate-600 opacity-60'
    }`}>
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-lg bg-${trigger.color}-100 dark:bg-${trigger.color}-900/30`}>
              <TriggerIcon className={`w-5 h-5 text-${trigger.color}-600 dark:text-${trigger.color}-400`} />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                {rule.name}
                {!rule.is_active && (
                  <span className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-400 rounded">
                    {t('automation.disabled', 'Disabled')}
                  </span>
                )}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {rule.description || t('automation.noDescription', 'No description')}
              </p>
              <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
                <span className={`px-2 py-0.5 rounded bg-${trigger.color}-50 dark:bg-${trigger.color}-900/20 text-${trigger.color}-700 dark:text-${trigger.color}-400`}>
                  {trigger.label}
                </span>
                <span>Priority: {rule.priority}</span>
                <span>Executions: {rule.execution_count || 0}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onToggle(rule.id)}
              className={`p-2 rounded-lg ${
                rule.is_active
                  ? 'text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20'
                  : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700'
              }`}
              title={rule.is_active ? t('automation.disable', 'Disable') : t('automation.enable', 'Enable')}
            >
              {rule.is_active ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
            </button>
            <button
              onClick={() => onEdit(rule)}
              className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg"
              title={t('common.edit', 'Edit')}
            >
              <Edit className="w-5 h-5" />
            </button>
            <button
              onClick={() => onDelete(rule.id)}
              className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
              title={t('common.delete', 'Delete')}
            >
              <Trash2 className="w-5 h-5" />
            </button>
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg"
            >
              {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-gray-200 dark:border-slate-700 p-4 bg-gray-50 dark:bg-slate-900/50">
          <div className="grid grid-cols-2 gap-6">
            {/* Conditions */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('automation.conditions', 'Conditions')}
              </h4>
              {rule.conditions?.length > 0 ? (
                <ul className="space-y-1">
                  {rule.conditions.map((cond, i) => (
                    <li key={i} className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-500" />
                      {cond.field} {cond.operator} {JSON.stringify(cond.value)}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-400 dark:text-gray-500">
                  {t('automation.noConditions', 'No conditions (always matches)')}
                </p>
              )}
            </div>

            {/* Actions */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('automation.actions', 'Actions')}
              </h4>
              {rule.actions?.length > 0 ? (
                <ul className="space-y-1">
                  {rule.actions.map((action, i) => (
                    <li key={i} className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-green-500" />
                      {action.action}: {JSON.stringify(action.params)}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-400 dark:text-gray-500">
                  {t('automation.noActions', 'No actions configured')}
                </p>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-3 mt-4 pt-4 border-t border-gray-200 dark:border-slate-700">
            <button
              onClick={() => onTest(rule.id)}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg"
            >
              <Zap className="w-4 h-4" />
              {t('automation.test', 'Test Rule')}
            </button>
            <button
              onClick={() => onViewLogs(rule.id)}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg"
            >
              <FileText className="w-4 h-4" />
              {t('automation.viewLogs', 'View Logs')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * AutomationRulesPage Component
 */
export default function AutomationRulesPage() {
  const { t } = useTranslation();
  const api = useApi();

  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showRuleBuilder, setShowRuleBuilder] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [showLogViewer, setShowLogViewer] = useState(false);
  const [selectedRuleId, setSelectedRuleId] = useState(null);
  const [filterTrigger, setFilterTrigger] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch rules
  const fetchRules = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/tickets/automation/rules');
      setRules(response.data.rules || []);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  // Toggle rule
  const handleToggle = async (ruleId) => {
    try {
      await api.post(`/api/tickets/automation/rules/${ruleId}/toggle`);
      fetchRules();
    } catch (err) {
      console.error('Error toggling rule:', err);
    }
  };

  // Delete rule
  const handleDelete = async (ruleId) => {
    if (!window.confirm(t('automation.confirmDelete', 'Are you sure you want to delete this rule?'))) {
      return;
    }
    try {
      await api.delete(`/api/tickets/automation/rules/${ruleId}`);
      fetchRules();
    } catch (err) {
      console.error('Error deleting rule:', err);
    }
  };

  // Edit rule
  const handleEdit = (rule) => {
    setEditingRule(rule);
    setShowRuleBuilder(true);
  };

  // View logs
  const handleViewLogs = (ruleId) => {
    setSelectedRuleId(ruleId);
    setShowLogViewer(true);
  };

  // Test rule
  const handleTest = async (ruleId) => {
    try {
      const sampleTicket = {
        id: 'test-123',
        subject: 'Test Ticket',
        status: 'open',
        priority: 'high',
        tags: ['support'],
      };
      const response = await api.post(`/api/tickets/automation/rules/${ruleId}/test`, {
        ticket: sampleTicket,
      });
      alert(JSON.stringify(response.data, null, 2));
    } catch (err) {
      console.error('Error testing rule:', err);
    }
  };

  // Save rule
  const handleSaveRule = async (ruleData) => {
    try {
      if (editingRule) {
        await api.put(`/api/tickets/automation/rules/${editingRule.id}`, ruleData);
      } else {
        await api.post('/api/tickets/automation/rules', ruleData);
      }
      setShowRuleBuilder(false);
      setEditingRule(null);
      fetchRules();
    } catch (err) {
      console.error('Error saving rule:', err);
    }
  };

  // Filter rules
  const filteredRules = rules.filter(rule => {
    if (filterTrigger !== 'all' && rule.trigger_type !== filterTrigger) {
      return false;
    }
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        rule.name.toLowerCase().includes(query) ||
        rule.description?.toLowerCase().includes(query)
      );
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {t('automation.rules', 'Automation Rules')}
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              {t('automation.rulesDescription', 'Create rules to automate ticket workflows')}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchRules}
              disabled={loading}
              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => {
                setEditingRule(null);
                setShowRuleBuilder(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              {t('automation.newRule', 'New Rule')}
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder={t('automation.searchRules', 'Search rules...')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={filterTrigger}
              onChange={(e) => setFilterTrigger(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
            >
              <option value="all">{t('automation.allTriggers', 'All Triggers')}</option>
              {Object.entries(TRIGGER_TYPES).map(([key, { label }]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-red-700 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Rules list */}
        {loading && rules.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="mt-4 text-gray-500 dark:text-gray-400">
                {t('common.loading', 'Loading...')}
              </p>
            </div>
          </div>
        ) : filteredRules.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700">
            <Zap className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              {t('automation.noRules', 'No automation rules')}
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              {t('automation.createFirst', 'Create your first rule to automate ticket workflows')}
            </p>
            <button
              onClick={() => {
                setEditingRule(null);
                setShowRuleBuilder(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              {t('automation.createRule', 'Create Rule')}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredRules.map(rule => (
              <RuleCard
                key={rule.id}
                rule={rule}
                onEdit={handleEdit}
                onToggle={handleToggle}
                onDelete={handleDelete}
                onViewLogs={handleViewLogs}
                onTest={handleTest}
              />
            ))}
          </div>
        )}

        {/* Rule Builder Modal */}
        {showRuleBuilder && (
          <RuleBuilderModal
            rule={editingRule}
            onSave={handleSaveRule}
            onClose={() => {
              setShowRuleBuilder(false);
              setEditingRule(null);
            }}
          />
        )}

        {/* Log Viewer Modal */}
        {showLogViewer && (
          <RuleLogViewer
            ruleId={selectedRuleId}
            onClose={() => {
              setShowLogViewer(false);
              setSelectedRuleId(null);
            }}
          />
        )}
      </div>
    </div>
  );
}
