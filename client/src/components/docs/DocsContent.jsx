import { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import FeedbackWidget from './FeedbackWidget';

export default function DocsContent({
  category,
  section,
  sections,
  onSectionChange,
  onPrevious,
  onNext,
  previousSection,
  nextSection
}) {
  // Extract headers for table of contents
  const tableOfContents = useMemo(() => {
    if (!section?.content) return [];

    const headers = [];
    const lines = section.content.split('\n');

    lines.forEach((line) => {
      if (line.startsWith('## ')) {
        headers.push({
          level: 2,
          text: line.replace('## ', ''),
          id: line.replace('## ', '').toLowerCase().replace(/\s+/g, '-')
        });
      } else if (line.startsWith('### ')) {
        headers.push({
          level: 3,
          text: line.replace('### ', ''),
          id: line.replace('### ', '').toLowerCase().replace(/\s+/g, '-')
        });
      }
    });

    return headers;
  }, [section?.content]);

  // Custom markdown components
  const markdownComponents = {
    h1: ({ children }) => (
      <h1 className="text-3xl font-bold mt-8 mb-4" style={{ color: '#32325d' }}>
        {children}
      </h1>
    ),
    h2: ({ children }) => (
      <h2
        id={String(children).toLowerCase().replace(/\s+/g, '-')}
        className="text-2xl font-bold mt-8 mb-4 pb-2 border-b scroll-mt-4"
        style={{ color: '#32325d', borderColor: '#e6ebf1' }}
      >
        {children}
      </h2>
    ),
    h3: ({ children }) => (
      <h3
        id={String(children).toLowerCase().replace(/\s+/g, '-')}
        className="text-xl font-semibold mt-6 mb-3 scroll-mt-4"
        style={{ color: '#32325d' }}
      >
        {children}
      </h3>
    ),
    p: ({ children }) => (
      <p className="my-3 leading-relaxed" style={{ color: '#525f7f' }}>
        {children}
      </p>
    ),
    ul: ({ children }) => (
      <ul className="my-3 ml-6 space-y-1 list-disc" style={{ color: '#525f7f' }}>
        {children}
      </ul>
    ),
    ol: ({ children }) => (
      <ol className="my-3 ml-6 space-y-1 list-decimal" style={{ color: '#525f7f' }}>
        {children}
      </ol>
    ),
    li: ({ children }) => (
      <li className="leading-relaxed">{children}</li>
    ),
    strong: ({ children }) => (
      <strong style={{ color: '#32325d' }}>{children}</strong>
    ),
    code: ({ inline, children }) => (
      inline ? (
        <code
          className="px-1.5 py-0.5 rounded text-sm font-mono"
          style={{ backgroundColor: '#f6f9fc', color: '#635bff' }}
        >
          {children}
        </code>
      ) : (
        <code className="block bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto my-4 text-sm font-mono">
          {children}
        </code>
      )
    ),
    pre: ({ children }) => (
      <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto my-4 text-sm">
        {children}
      </pre>
    ),
    table: ({ children }) => (
      <div className="overflow-x-auto my-4">
        <table className="min-w-full border rounded-lg" style={{ borderColor: '#e6ebf1' }}>
          {children}
        </table>
      </div>
    ),
    thead: ({ children }) => (
      <thead style={{ backgroundColor: '#f6f9fc' }}>
        {children}
      </thead>
    ),
    th: ({ children }) => (
      <th
        className="px-4 py-2 text-left font-semibold text-sm"
        style={{ color: '#32325d', borderColor: '#e6ebf1' }}
      >
        {children}
      </th>
    ),
    td: ({ children }) => (
      <td
        className="px-4 py-2 text-sm border-t"
        style={{ color: '#525f7f', borderColor: '#e6ebf1' }}
      >
        {children}
      </td>
    ),
    a: ({ href, children }) => (
      <a
        href={href}
        className="hover:underline"
        style={{ color: '#635bff' }}
        target={href?.startsWith('http') ? '_blank' : undefined}
        rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
      >
        {children}
      </a>
    )
  };

  const scrollToHeader = (id) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Calculate reading time
  const readingTime = useMemo(() => {
    if (!section?.content) return 0;
    const words = section.content.trim().split(/\s+/).length;
    return Math.max(1, Math.ceil(words / 200)); // 200 words per minute
  }, [section?.content]);

  return (
    <div className="flex-1 min-w-0 bg-white" aria-label="Documentation content" role="main">
      <div className="max-w-[800px] mx-auto px-6 py-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm mb-4" style={{ color: '#8898aa' }}>
          <span>{category?.icon}</span>
          <span>{category?.title}</span>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span style={{ color: '#32325d' }}>{section?.title}</span>
        </div>

        {/* Title */}
        <h1 className="text-3xl font-bold mb-2" style={{ color: '#32325d' }}>
          {section?.title}
        </h1>

        {/* Reading Time */}
        <div className="flex items-center gap-2 mb-6 text-sm" style={{ color: '#8898aa' }}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          <span>{readingTime} min read</span>
        </div>

        {/* Table of Contents */}
        {tableOfContents.length > 0 && (
          <div
            className="mb-8 p-4 rounded-lg border"
            style={{ backgroundColor: '#f6f9fc', borderColor: '#e6ebf1' }}
          >
            <h4 className="text-sm font-semibold mb-2" style={{ color: '#32325d' }}>
              On this page
            </h4>
            <ul className="space-y-1">
              {tableOfContents.map((item, index) => (
                <li key={index}>
                  <button
                    onClick={() => scrollToHeader(item.id)}
                    className="text-sm hover:underline text-left"
                    style={{
                      color: '#635bff',
                      paddingLeft: item.level === 3 ? '1rem' : 0
                    }}
                  >
                    {item.text}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Content */}
        <div className="prose max-w-none">
          <ReactMarkdown components={markdownComponents}>
            {section?.content || ''}
          </ReactMarkdown>
        </div>

        {/* Edit on GitHub */}
        <div className="mt-8 pt-4 border-t" style={{ borderColor: '#e6ebf1' }}>
          <a
            href={`https://github.com/BotBuilder/botbuilder-docs/edit/main/content/${category?.id}/${section?.id}.md`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm hover:underline"
            style={{ color: '#8898aa' }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Edit this page on GitHub
          </a>
        </div>

        {/* Feedback Widget */}
        <FeedbackWidget
          sectionId={section?.id}
          categoryId={category?.id}
        />

        {/* Previous / Next Navigation */}
        <div
          className="mt-8 pt-6 border-t flex justify-between"
          style={{ borderColor: '#e6ebf1' }}
        >
          {previousSection ? (
            <button
              onClick={onPrevious}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border hover:border-purple-300 transition-colors"
              style={{ borderColor: '#e6ebf1' }}
            >
              <svg className="w-4 h-4" style={{ color: '#635bff' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <div className="text-left">
                <div className="text-xs" style={{ color: '#8898aa' }}>Previous</div>
                <div className="text-sm font-medium" style={{ color: '#635bff' }}>
                  {previousSection.title}
                </div>
              </div>
            </button>
          ) : (
            <div />
          )}

          {nextSection ? (
            <button
              onClick={onNext}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border hover:border-purple-300 transition-colors"
              style={{ borderColor: '#e6ebf1' }}
            >
              <div className="text-right">
                <div className="text-xs" style={{ color: '#8898aa' }}>Next</div>
                <div className="text-sm font-medium" style={{ color: '#635bff' }}>
                  {nextSection.title}
                </div>
              </div>
              <svg className="w-4 h-4" style={{ color: '#635bff' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ) : (
            <div />
          )}
        </div>
      </div>
    </div>
  );
}
