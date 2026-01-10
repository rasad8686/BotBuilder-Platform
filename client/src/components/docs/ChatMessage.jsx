import { useState, useMemo } from 'react';

// Simple syntax highlighter for code blocks
function highlightCode(code, language) {
  // Keywords for different languages
  const keywords = {
    javascript: ['const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'async', 'await', 'import', 'export', 'from', 'class', 'new', 'try', 'catch', 'throw'],
    python: ['def', 'return', 'if', 'else', 'for', 'while', 'import', 'from', 'class', 'try', 'except', 'raise', 'with', 'as', 'async', 'await', 'True', 'False', 'None'],
    bash: ['curl', 'echo', 'export', 'if', 'then', 'fi', 'for', 'do', 'done', 'while']
  };

  const langKeywords = keywords[language] || keywords.javascript;

  // Escape HTML
  let highlighted = code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Highlight strings
  highlighted = highlighted.replace(/(["'`])(?:(?!\1)[^\\]|\\.)*\1/g, '<span style="color: #a5d6ff;">$&</span>');

  // Highlight numbers
  highlighted = highlighted.replace(/\b(\d+\.?\d*)\b/g, '<span style="color: #79c0ff;">$1</span>');

  // Highlight keywords
  langKeywords.forEach(keyword => {
    const regex = new RegExp(`\\b(${keyword})\\b`, 'g');
    highlighted = highlighted.replace(regex, '<span style="color: #ff7b72;">$1</span>');
  });

  // Highlight comments
  highlighted = highlighted.replace(/(\/\/.*$)/gm, '<span style="color: #8b949e;">$1</span>');
  highlighted = highlighted.replace(/(#.*$)/gm, '<span style="color: #8b949e;">$1</span>');

  return highlighted;
}

// Parse markdown-like content
function parseContent(content) {
  const parts = [];
  const codeBlockRegex = /```(\w+)?\n?([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    // Add text before code block
    if (match.index > lastIndex) {
      parts.push({
        type: 'text',
        content: content.slice(lastIndex, match.index)
      });
    }

    // Add code block
    parts.push({
      type: 'code',
      language: match[1] || 'javascript',
      content: match[2].trim()
    });

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < content.length) {
    parts.push({
      type: 'text',
      content: content.slice(lastIndex)
    });
  }

  return parts.length > 0 ? parts : [{ type: 'text', content }];
}

// Format text with basic markdown
function formatText(text) {
  return text
    // Bold
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code style="background: rgba(99, 91, 255, 0.1); padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 0.9em;">$1</code>')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" style="color: #635bff; text-decoration: underline;">$1</a>')
    // Line breaks
    .replace(/\n/g, '<br/>');
}

function CodeBlock({ code, language }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const highlightedCode = useMemo(() => highlightCode(code, language), [code, language]);

  return (
    <div className="relative my-2 rounded-lg overflow-hidden" style={{ backgroundColor: '#161b22' }}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2"
        style={{ backgroundColor: '#21262d', borderBottom: '1px solid #30363d' }}
      >
        <span className="text-xs font-mono" style={{ color: '#8b949e' }}>
          {language}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors"
          style={{
            backgroundColor: copied ? '#238636' : 'transparent',
            color: copied ? '#fff' : '#8b949e',
            border: copied ? 'none' : '1px solid #30363d'
          }}
        >
          {copied ? (
            <>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Copied!
            </>
          ) : (
            <>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Copy
            </>
          )}
        </button>
      </div>
      {/* Code */}
      <pre className="p-3 overflow-x-auto" style={{ margin: 0 }}>
        <code
          className="text-sm font-mono"
          style={{ color: '#c9d1d9' }}
          dangerouslySetInnerHTML={{ __html: highlightedCode }}
        />
      </pre>
    </div>
  );
}

// Loading dots animation
function LoadingDots() {
  return (
    <div className="flex items-center gap-1 py-2">
      <span
        className="w-2 h-2 rounded-full animate-bounce"
        style={{ backgroundColor: '#635bff', animationDelay: '0ms' }}
      />
      <span
        className="w-2 h-2 rounded-full animate-bounce"
        style={{ backgroundColor: '#635bff', animationDelay: '150ms' }}
      />
      <span
        className="w-2 h-2 rounded-full animate-bounce"
        style={{ backgroundColor: '#635bff', animationDelay: '300ms' }}
      />
    </div>
  );
}

export default function ChatMessage({ role, content, timestamp, isLoading = false }) {
  const isUser = role === 'user';
  const parsedContent = useMemo(() => parseContent(content || ''), [content]);

  const formattedTime = timestamp
    ? new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <div
      className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}
    >
      <div
        className={`max-w-[85%] ${isUser ? 'order-2' : 'order-1'}`}
      >
        {/* Avatar */}
        {!isUser && (
          <div className="flex items-center gap-2 mb-1">
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-xs"
              style={{
                background: 'linear-gradient(135deg, #635bff 0%, #8b5cf6 100%)',
                color: '#fff'
              }}
            >
              AI
            </div>
            <span className="text-xs" style={{ color: '#8898aa' }}>
              BotBuilder AI
            </span>
          </div>
        )}

        {/* Message bubble */}
        <div
          className="px-4 py-3 rounded-2xl"
          style={{
            backgroundColor: isUser ? '#635bff' : '#f6f9fc',
            color: isUser ? '#fff' : '#32325d',
            borderTopRightRadius: isUser ? '4px' : '16px',
            borderTopLeftRadius: isUser ? '16px' : '4px'
          }}
        >
          {isLoading ? (
            <LoadingDots />
          ) : (
            <div className="text-sm leading-relaxed">
              {parsedContent.map((part, index) => (
                part.type === 'code' ? (
                  <CodeBlock
                    key={index}
                    code={part.content}
                    language={part.language}
                  />
                ) : (
                  <span
                    key={index}
                    dangerouslySetInnerHTML={{ __html: formatText(part.content) }}
                  />
                )
              ))}
            </div>
          )}
        </div>

        {/* Timestamp */}
        {timestamp && !isLoading && (
          <div
            className={`text-xs mt-1 ${isUser ? 'text-right' : 'text-left'}`}
            style={{ color: '#8898aa' }}
          >
            {formattedTime}
          </div>
        )}
      </div>
    </div>
  );
}

export { LoadingDots, CodeBlock };
