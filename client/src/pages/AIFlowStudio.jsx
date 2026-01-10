import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles, ClipboardList, Bot, Rocket, Lightbulb, FileText, RefreshCw } from 'lucide-react';
import AIFlowGenerator from '../components/AI/AIFlowGenerator';
import FlowTemplateSelector from '../components/AI/FlowTemplateSelector';
import GeneratedFlowPreview from '../components/AI/GeneratedFlowPreview';
import { useNavigate } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function AIFlowStudio() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('generate'); // 'generate' or 'templates'
  const [generatedFlow, setGeneratedFlow] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showBotSelector, setShowBotSelector] = useState(false);
  const [bots, setBots] = useState([]);
  const [loadingBots, setLoadingBots] = useState(false);

  const handleFlowGenerated = (flow) => {
    setGeneratedFlow(flow);
    setShowPreview(true);
  };

  const handleTemplateSelected = (flow) => {
    setGeneratedFlow(flow);
    setShowPreview(true);
  };

  const getToken = () => localStorage.getItem('token');

  const fetchBots = async () => {
    setLoadingBots(true);
    try {
      const res = await fetch(`${API_URL}/api/bots`, {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      if (res.ok) {
        const data = await res.json();
        setBots(Array.isArray(data) ? data : data.bots || []);
      }
    } catch (err) {
      // Silent fail
    } finally {
      setLoadingBots(false);
    }
  };

  const handleUseFlow = () => {
    if (generatedFlow) {
      fetchBots();
      setShowBotSelector(true);
    }
  };

  const handleSelectBot = (botId) => {
    if (generatedFlow) {
      localStorage.setItem('importedFlow', JSON.stringify(generatedFlow));
      navigate(`/bots/${botId}/flow?import=true`);
    }
  };

  const handleEditFlow = (editedFlow) => {
    setGeneratedFlow(editedFlow);
  };

  const handleBack = () => {
    setShowPreview(false);
    setGeneratedFlow(null);
  };

  const tabs = [
    { id: 'generate', label: t('aiFlow.aiGenerate'), Icon: Sparkles },
    { id: 'templates', label: t('aiFlow.templates'), Icon: ClipboardList }
  ];

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-slate-900 transition-colors duration-300">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 px-8 py-4 flex justify-between items-center transition-colors duration-300">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="bg-transparent border-none cursor-pointer text-xl text-gray-500 dark:text-gray-400 flex items-center hover:text-gray-700 dark:hover:text-gray-200"
          >
            ←
          </button>
          <div>
            <h1 className="m-0 text-2xl font-semibold text-gray-900 dark:text-white flex items-center gap-2.5">
              <Bot size={28} className="text-blue-500" />
              {t('aiFlow.title')}
            </h1>
            <p className="mt-1 text-gray-500 dark:text-gray-400 text-sm">
              {t('aiFlow.subtitle')}
            </p>
          </div>
        </div>

        {generatedFlow && showPreview && (
          <button
            onClick={handleUseFlow}
            className="px-6 py-2.5 bg-blue-500 text-white border-none rounded-lg cursor-pointer font-medium text-sm flex items-center gap-2 hover:bg-blue-600 transition-colors"
          >
            <Rocket size={16} /> {t('aiFlow.openInWorkflow')}
          </button>
        )}
      </div>

      {/* Main Content */}
      <div className="flex" style={{ height: 'calc(100vh - 81px)' }}>
        {/* Left Panel - Generator/Templates */}
        <div
          className={`bg-white dark:bg-slate-800 flex flex-col transition-all duration-300 ${showPreview ? 'w-[400px] max-w-[400px] border-r border-gray-200 dark:border-slate-700' : 'w-full max-w-[800px] mx-auto'}`}
        >
          {/* Tabs */}
          {!showPreview && (
            <div className="flex border-b border-gray-200 dark:border-slate-700 px-6">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-6 py-4 bg-transparent border-none cursor-pointer text-[15px] flex items-center gap-2 transition-all border-b-2 ${
                    activeTab === tab.id
                      ? 'border-blue-500 font-semibold text-gray-900 dark:text-white'
                      : 'border-transparent font-normal text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  <tab.Icon size={16} />
                  {tab.label}
                </button>
              ))}
            </div>
          )}

          {/* Content */}
          <div className="flex-1 overflow-auto p-6">
            {showPreview ? (
              <div>
                <h3 className="m-0 mb-4 text-base font-semibold text-gray-900 dark:text-white">
                  {t('aiFlow.generateAnother')}
                </h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">
                  {t('aiFlow.notHappy')}
                </p>
                <div className="flex flex-col gap-3">
                  <button
                    onClick={handleBack}
                    className="px-5 py-3 bg-purple-500 text-white border-none rounded-lg cursor-pointer font-medium text-sm flex items-center justify-center gap-2 hover:bg-purple-600 transition-colors"
                  >
                    <Sparkles size={16} /> {t('aiFlow.generateNewWithAI')}
                  </button>
                  <button
                    onClick={() => { setActiveTab('templates'); handleBack(); }}
                    className="px-5 py-3 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-200 border-none rounded-lg cursor-pointer font-medium text-sm flex items-center justify-center gap-2 hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
                  >
                    <ClipboardList size={16} /> {t('aiFlow.browseTemplates')}
                  </button>
                </div>

                {/* Quick Stats */}
                {generatedFlow && (
                  <div className="mt-6 p-4 bg-gray-50 dark:bg-slate-700 rounded-xl">
                    <h4 className="m-0 mb-3 text-sm font-semibold text-gray-900 dark:text-white">
                      {t('aiFlow.currentFlow')}
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <div className="text-2xl font-bold text-blue-500">
                          {generatedFlow.nodes?.length || 0}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{t('aiFlow.nodes')}</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-emerald-500">
                          {generatedFlow.edges?.length || 0}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{t('aiFlow.connections')}</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <>
                {activeTab === 'generate' && (
                  <AIFlowGenerator
                    onFlowGenerated={handleFlowGenerated}
                  />
                )}
                {activeTab === 'templates' && (
                  <FlowTemplateSelector
                    onSelectTemplate={handleTemplateSelected}
                  />
                )}
              </>
            )}
          </div>
        </div>

        {/* Right Panel - Preview */}
        {showPreview && generatedFlow && (
          <div className="flex-1 overflow-auto p-6 bg-gray-50 dark:bg-slate-900">
            <GeneratedFlowPreview
              flow={generatedFlow}
              onUseFlow={handleUseFlow}
              onEdit={handleEditFlow}
            />
          </div>
        )}

        {/* Empty State when no preview */}
        {!showPreview && (
          <div className="hidden" />
        )}
      </div>

      {/* Bot Selector Modal */}
      {showBotSelector && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1000]">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-[500px] max-h-[80vh] overflow-auto">
            <div className="flex justify-between items-center mb-5">
              <h2 className="m-0 text-xl font-semibold text-gray-900 dark:text-white">
                {t('common.selectBot')}
              </h2>
              <button
                onClick={() => setShowBotSelector(false)}
                className="bg-transparent border-none text-2xl cursor-pointer text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              >
                &times;
              </button>
            </div>
            <p className="text-gray-500 dark:text-gray-400 text-sm mb-5">
              {t('aiFlow.chooseBotToImport')}
            </p>

            {loadingBots ? (
              <div className="text-center py-10 text-gray-500 dark:text-gray-400">
                {t('common.loading')}
              </div>
            ) : bots.length === 0 ? (
              <div className="text-center py-10 bg-gray-50 dark:bg-slate-700 rounded-xl">
                <div className="mb-4"><Bot size={48} className="mx-auto text-gray-400" /></div>
                <p className="text-gray-500 dark:text-gray-400 mb-4">{t('agentStudio.noBotsFound')}</p>
                <button
                  onClick={() => navigate('/create-bot')}
                  className="px-5 py-2.5 bg-blue-500 text-white border-none rounded-lg cursor-pointer hover:bg-blue-600 transition-colors"
                >
                  {t('agentStudio.createFirstBot')}
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {bots.map(bot => (
                  <button
                    key={bot.id}
                    onClick={() => handleSelectBot(bot.id)}
                    className="flex items-center gap-3 p-4 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl cursor-pointer text-left transition-all hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-slate-600"
                  >
                    <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-slate-600 flex items-center justify-center">
                      <Bot size={24} className="text-blue-500" />
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-[15px] text-gray-900 dark:text-white">{bot.name}</div>
                      <div className="text-[13px] text-gray-500 dark:text-gray-400">
                        {bot.platform || 'telegram'} • {bot.description || 'No description'}
                      </div>
                    </div>
                    <span className="text-blue-500 text-xl">→</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tips Footer */}
      {!showPreview && (
        <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-800 border-t border-gray-200 dark:border-slate-700 py-3 px-8 flex justify-center gap-8">
          <div className="flex items-center gap-2 text-[13px] text-gray-500 dark:text-gray-400">
            <Lightbulb size={14} />
            <span>Be specific in your descriptions for better results</span>
          </div>
          <div className="flex items-center gap-2 text-[13px] text-gray-500 dark:text-gray-400">
            <FileText size={14} />
            <span>You can edit the generated flow before using it</span>
          </div>
          <div className="flex items-center gap-2 text-[13px] text-gray-500 dark:text-gray-400">
            <RefreshCw size={14} />
            <span>Not satisfied? Generate again with different settings</span>
          </div>
        </div>
      )}
    </div>
  );
}
