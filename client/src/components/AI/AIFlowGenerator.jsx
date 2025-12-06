import React, { useState } from 'react';
import GeneratedFlowPreview from './GeneratedFlowPreview';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function AIFlowGenerator({ onFlowGenerated, onClose }) {
  const [prompt, setPrompt] = useState('');
  const [options, setOptions] = useState({
    complexity: 'medium',
    language: 'en',
    maxNodes: 20
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [generatedFlow, setGeneratedFlow] = useState(null);
  const [showPreview, setShowPreview] = useState(false);

  const getToken = () => localStorage.getItem('token');

  const handleGenerate = async () => {
    if (!prompt.trim() || prompt.length < 10) {
      setError('Please provide a detailed description (at least 10 characters)');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/api/ai/flow/generate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ prompt, options })
      });

      const data = await res.json();

      if (data.success) {
        setGeneratedFlow(data.flow);
        setShowPreview(true);
      } else {
        setError(data.error || 'Failed to generate flow');
      }
    } catch (err) {
      setError('Network error. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleUseFlow = () => {
    if (generatedFlow && onFlowGenerated) {
      onFlowGenerated(generatedFlow);
    }
  };

  const examplePrompts = [
    'Create a customer support bot that handles product inquiries and complaints',
    'Build a lead generation flow that collects contact info and schedules demos',
    'Design an FAQ bot for a SaaS product with categories and search',
    'Create an appointment booking bot for a dental clinic'
  ];

  if (showPreview && generatedFlow) {
    return (
      <GeneratedFlowPreview
        flow={generatedFlow}
        onUseFlow={handleUseFlow}
        onBack={() => setShowPreview(false)}
        onEdit={(editedFlow) => setGeneratedFlow(editedFlow)}
      />
    );
  }

  return (
    <div style={{
      backgroundColor: 'white',
      borderRadius: '16px',
      padding: '32px',
      maxWidth: '700px',
      width: '100%',
      maxHeight: '90vh',
      overflow: 'auto'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px'
      }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '600' }}>
            AI Flow Generator
          </h2>
          <p style={{ margin: '8px 0 0', color: '#6b7280', fontSize: '14px' }}>
            Describe your chatbot and AI will create the flow for you
          </p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: '#6b7280'
            }}
          >
            &times;
          </button>
        )}
      </div>

      {/* Prompt Input */}
      <div style={{ marginBottom: '20px' }}>
        <label style={{
          display: 'block',
          marginBottom: '8px',
          fontWeight: '500',
          color: '#374151'
        }}>
          Describe your chatbot
        </label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="E.g., Create a customer support bot that helps users track orders, process returns, and answer FAQs about shipping and payments..."
          style={{
            width: '100%',
            minHeight: '120px',
            padding: '16px',
            borderRadius: '12px',
            border: '1px solid #d1d5db',
            fontSize: '15px',
            resize: 'vertical',
            boxSizing: 'border-box',
            fontFamily: 'inherit'
          }}
        />
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: '8px',
          fontSize: '13px',
          color: '#6b7280'
        }}>
          <span>{prompt.length} characters</span>
          <span>Minimum 10 characters</span>
        </div>
      </div>

      {/* Example Prompts */}
      <div style={{ marginBottom: '24px' }}>
        <label style={{
          display: 'block',
          marginBottom: '8px',
          fontWeight: '500',
          color: '#374151',
          fontSize: '14px'
        }}>
          Or try an example:
        </label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {examplePrompts.map((example, index) => (
            <button
              key={index}
              onClick={() => setPrompt(example)}
              style={{
                padding: '8px 12px',
                backgroundColor: '#f3f4f6',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '13px',
                color: '#4b5563',
                textAlign: 'left',
                transition: 'background-color 0.2s'
              }}
              onMouseOver={(e) => e.target.style.backgroundColor = '#e5e7eb'}
              onMouseOut={(e) => e.target.style.backgroundColor = '#f3f4f6'}
            >
              {example.length > 50 ? example.substring(0, 50) + '...' : example}
            </button>
          ))}
        </div>
      </div>

      {/* Options */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '16px',
        marginBottom: '24px'
      }}>
        <div>
          <label style={{
            display: 'block',
            marginBottom: '6px',
            fontSize: '13px',
            fontWeight: '500',
            color: '#374151'
          }}>
            Complexity
          </label>
          <select
            value={options.complexity}
            onChange={(e) => setOptions(prev => ({ ...prev, complexity: e.target.value }))}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: '8px',
              border: '1px solid #d1d5db',
              fontSize: '14px'
            }}
          >
            <option value="simple">Simple (5-8 nodes)</option>
            <option value="medium">Medium (8-15 nodes)</option>
            <option value="advanced">Advanced (15-25 nodes)</option>
          </select>
        </div>

        <div>
          <label style={{
            display: 'block',
            marginBottom: '6px',
            fontSize: '13px',
            fontWeight: '500',
            color: '#374151'
          }}>
            Language
          </label>
          <select
            value={options.language}
            onChange={(e) => setOptions(prev => ({ ...prev, language: e.target.value }))}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: '8px',
              border: '1px solid #d1d5db',
              fontSize: '14px'
            }}
          >
            <option value="en">English</option>
            <option value="az">Azerbaijani</option>
            <option value="tr">Turkish</option>
            <option value="ru">Russian</option>
            <option value="es">Spanish</option>
            <option value="de">German</option>
            <option value="fr">French</option>
          </select>
        </div>

        <div>
          <label style={{
            display: 'block',
            marginBottom: '6px',
            fontSize: '13px',
            fontWeight: '500',
            color: '#374151'
          }}>
            Max Nodes
          </label>
          <select
            value={options.maxNodes}
            onChange={(e) => setOptions(prev => ({ ...prev, maxNodes: parseInt(e.target.value) }))}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: '8px',
              border: '1px solid #d1d5db',
              fontSize: '14px'
            }}
          >
            <option value="10">10 nodes</option>
            <option value="15">15 nodes</option>
            <option value="20">20 nodes</option>
            <option value="30">30 nodes</option>
          </select>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div style={{
          padding: '12px 16px',
          backgroundColor: '#fef2f2',
          color: '#dc2626',
          borderRadius: '8px',
          marginBottom: '20px',
          fontSize: '14px'
        }}>
          {error}
        </div>
      )}

      {/* Generate Button */}
      <button
        onClick={handleGenerate}
        disabled={loading || prompt.length < 10}
        style={{
          width: '100%',
          padding: '14px 24px',
          backgroundColor: loading || prompt.length < 10 ? '#9ca3af' : '#8b5cf6',
          color: 'white',
          border: 'none',
          borderRadius: '10px',
          cursor: loading || prompt.length < 10 ? 'not-allowed' : 'pointer',
          fontWeight: '600',
          fontSize: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '10px'
        }}
      >
        {loading ? (
          <>
            <span style={{
              width: '20px',
              height: '20px',
              border: '2px solid white',
              borderTopColor: 'transparent',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }} />
            Generating Flow...
          </>
        ) : (
          <>
            <span style={{ fontSize: '20px' }}>&#10024;</span>
            Generate with AI
          </>
        )}
      </button>

      {/* Info */}
      <p style={{
        marginTop: '16px',
        fontSize: '13px',
        color: '#6b7280',
        textAlign: 'center'
      }}>
        Powered by GPT-4. Generation typically takes 10-20 seconds.
      </p>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
