import { useState } from 'react';

export default function DocsSidebar({
  categories,
  activeCategory,
  activeSection,
  onCategoryChange,
  onSectionChange,
  searchQuery,
  onSearchChange,
  isMobileOpen,
  onMobileClose
}) {
  const [expandedCategories, setExpandedCategories] = useState([activeCategory]);

  const toggleCategory = (categoryId) => {
    setExpandedCategories(prev =>
      prev.includes(categoryId)
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const handleCategoryClick = (categoryId, sections) => {
    if (!expandedCategories.includes(categoryId)) {
      setExpandedCategories(prev => [...prev, categoryId]);
    }
    onCategoryChange(categoryId);
    if (sections && sections.length > 0) {
      onSectionChange(sections[0].id);
    }
  };

  const handleSectionClick = (categoryId, sectionId) => {
    onCategoryChange(categoryId);
    onSectionChange(sectionId);
    if (onMobileClose) onMobileClose();
  };

  // Filter categories based on search
  const filteredCategories = searchQuery
    ? categories.filter(cat =>
        cat.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        cat.sections.some(s =>
          s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.content.toLowerCase().includes(searchQuery.toLowerCase())
        )
      )
    : categories;

  return (
    <>
      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={onMobileClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed lg:sticky top-0 left-0 h-screen z-50 lg:z-auto
          w-[250px] flex-shrink-0 overflow-hidden
          transition-transform duration-300 lg:translate-x-0
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
        style={{ backgroundColor: '#f6f9fc' }}
        aria-label="Documentation navigation"
        role="navigation"
      >
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="p-4 border-b" style={{ borderColor: '#e6ebf1' }}>
            <div className="flex items-center justify-between">
              <h1 className="text-lg font-bold" style={{ color: '#32325d' }}>
                Documentation
              </h1>
              <button
                onClick={onMobileClose}
                className="lg:hidden p-1 rounded hover:bg-gray-200"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="p-4 border-b" style={{ borderColor: '#e6ebf1' }}>
            <div className="relative">
              <input
                type="text"
                placeholder="Search docs..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="w-full px-3 py-2 pl-9 rounded-md border text-sm focus:outline-none focus:ring-2"
                style={{
                  borderColor: '#e6ebf1',
                  color: '#32325d',
                  backgroundColor: '#fff'
                }}
              />
              <svg
                className="absolute left-3 top-2.5 w-4 h-4"
                style={{ color: '#8898aa' }}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto p-4">
            {filteredCategories.map((category) => (
              <div key={category.id} className="mb-2">
                {/* Category Header */}
                <button
                  onClick={() => toggleCategory(category.id)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-md text-left font-medium text-sm transition-colors duration-200 hover:bg-white"
                  style={{ color: '#32325d' }}
                >
                  <span className="flex items-center gap-2">
                    <span>{category.icon}</span>
                    <span>{category.title}</span>
                  </span>
                  <svg
                    className={`w-4 h-4 transition-transform duration-200 ${
                      expandedCategories.includes(category.id) ? 'rotate-90' : ''
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>

                {/* Sections */}
                {expandedCategories.includes(category.id) && (
                  <div className="ml-4 mt-1 space-y-1">
                    {category.sections.map((section) => {
                      const isActive = activeCategory === category.id && activeSection === section.id;
                      return (
                        <button
                          key={section.id}
                          onClick={() => handleSectionClick(category.id, section.id)}
                          className={`
                            w-full text-left px-3 py-1.5 rounded-md text-sm transition-colors duration-200
                            ${isActive
                              ? 'font-medium'
                              : 'hover:bg-white'
                            }
                          `}
                          style={{
                            color: isActive ? '#635bff' : '#525f7f',
                            backgroundColor: isActive ? 'rgba(99, 91, 255, 0.1)' : 'transparent',
                            borderLeft: isActive ? '2px solid #635bff' : '2px solid transparent'
                          }}
                        >
                          {section.title}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </nav>

          {/* Footer */}
          <div className="p-4 border-t text-xs" style={{ borderColor: '#e6ebf1', color: '#8898aa' }}>
            <a
              href="https://github.com/BotBuilder/botbuilder-docs"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 hover:underline"
              style={{ color: '#635bff' }}
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
              </svg>
              Edit on GitHub
            </a>
          </div>
        </div>
      </aside>
    </>
  );
}
