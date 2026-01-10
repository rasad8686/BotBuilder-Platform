import { useState } from 'react';
import { Bot, MessageCircle, Wrench, Briefcase, BookOpen, PenTool, ClipboardList, Lightbulb } from 'lucide-react';

/**
 * AI Prompt Editor
 * Editor for system prompt with templates
 */
export default function AIPromptEditor({ systemPrompt, onPromptChange }) {
  const [showTemplates, setShowTemplates] = useState(false);

  const templates = [
    {
      name: 'Default Assistant',
      Icon: Bot,
      prompt: 'You are a helpful assistant.'
    },
    {
      name: 'Customer Support',
      Icon: MessageCircle,
      prompt: 'You are a friendly and professional customer support assistant. Help users with their questions and issues in a clear and concise manner. Always be polite and empathetic.'
    },
    {
      name: 'Technical Support',
      Icon: Wrench,
      prompt: 'You are a technical support specialist. Provide detailed, step-by-step solutions to technical problems. Use clear language and ask clarifying questions when needed.'
    },
    {
      name: 'Sales Assistant',
      Icon: Briefcase,
      prompt: 'You are a sales assistant helping customers find the right products. Ask questions to understand their needs, recommend appropriate solutions, and highlight key benefits.'
    },
    {
      name: 'Educational Tutor',
      Icon: BookOpen,
      prompt: 'You are a patient and encouraging educational tutor. Explain concepts clearly, provide examples, and ask questions to check understanding. Adapt your teaching style to the student\'s level.'
    },
    {
      name: 'Creative Writer',
      Icon: PenTool,
      prompt: 'You are a creative writing assistant. Help users brainstorm ideas, improve their writing, and provide constructive feedback. Be encouraging and suggest creative alternatives.'
    }
  ];

  const charCount = systemPrompt.length;
  const wordCount = systemPrompt.trim().split(/\s+/).filter(word => word.length > 0).length;

  return (
    <div className="space-y-4">
      {/* Template Selector */}
      <div>
        <button
          type="button"
          onClick={() => setShowTemplates(!showTemplates)}
          className="text-purple-600 hover:text-purple-700 font-medium text-sm flex items-center gap-2"
        >
          <ClipboardList size={14} /> {showTemplates ? 'Hide Templates' : 'Show Prompt Templates'}
        </button>

        {showTemplates && (
          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
            {templates.map((template, index) => (
              <button
                key={index}
                type="button"
                onClick={() => {
                  onPromptChange(template.prompt);
                  setShowTemplates(false);
                }}
                className="p-3 border border-gray-300 rounded-lg text-left hover:border-purple-500 hover:bg-purple-50 transition-colors"
              >
                <div className="flex items-center gap-2 mb-1">
                  <template.Icon size={20} className="text-purple-600" />
                  <span className="font-semibold text-sm">{template.name}</span>
                </div>
                <p className="text-xs text-gray-600 line-clamp-2">
                  {template.prompt}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* System Prompt Editor */}
      <div>
        <label className="block text-gray-700 font-semibold mb-2">
          System Prompt
        </label>
        <textarea
          value={systemPrompt}
          onChange={(e) => onPromptChange(e.target.value)}
          rows="8"
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono text-sm"
          placeholder="Define how the AI should behave..."
        />
        <div className="flex justify-between items-center mt-2 text-sm text-gray-500">
          <p className="flex items-center gap-1">
            <Lightbulb size={14} /> The system prompt defines the AI's personality and behavior
          </p>
          <p>
            {wordCount} words · {charCount} characters
          </p>
        </div>
      </div>

      {/* Examples */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-semibold text-blue-900 mb-2 flex items-center gap-2"><Lightbulb size={16} /> Tips for good prompts:</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Be specific about the AI's role and expertise</li>
          <li>• Include tone guidelines (professional, friendly, formal)</li>
          <li>• Specify what the AI should or shouldn't do</li>
          <li>• Keep it concise but comprehensive</li>
        </ul>
      </div>
    </div>
  );
}
