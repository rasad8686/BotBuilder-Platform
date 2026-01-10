import { useState } from 'react';

export default function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setShowTooltip(true);
      setTimeout(() => {
        setCopied(false);
        setShowTooltip(false);
      }, 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={handleCopy}
        onMouseEnter={() => !copied && setShowTooltip(true)}
        onMouseLeave={() => !copied && setShowTooltip(false)}
        className="p-2 rounded hover:bg-gray-700 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-purple-500"
        aria-label={copied ? 'Copied to clipboard' : 'Copy to clipboard'}
      >
        {copied ? (
          <svg
            className="w-4 h-4 text-green-400 animate-bounce-once"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        ) : (
          <svg
            className="w-4 h-4 text-gray-400 hover:text-white transition-colors"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
          </svg>
        )}
      </button>

      {/* Tooltip */}
      {showTooltip && (
        <div
          className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs font-medium rounded whitespace-nowrap animate-fade-in"
          style={{
            backgroundColor: copied ? '#22c55e' : '#374151',
            color: '#fff'
          }}
        >
          {copied ? 'Copied!' : 'Copy to clipboard'}
          <div
            className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent"
            style={{
              borderTopColor: copied ? '#22c55e' : '#374151'
            }}
          />
        </div>
      )}

      {/* Animation styles */}
      <style>{`
        @keyframes bounce-once {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }
        @keyframes fade-in {
          from { opacity: 0; transform: translate(-50%, 4px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
        .animate-bounce-once {
          animation: bounce-once 0.3s ease-out;
        }
        .animate-fade-in {
          animation: fade-in 0.15s ease-out;
        }
      `}</style>
    </div>
  );
}
