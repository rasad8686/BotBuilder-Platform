/**
 * SkipLink - Accessibility skip navigation link
 * Allows keyboard users to skip to main content
 */
export default function SkipLink({ href = '#main-content', children = 'Skip to main content' }) {
  return (
    <a
      href={href}
      className="
        sr-only focus:not-sr-only
        fixed top-4 left-4 z-[9999]
        px-4 py-2
        bg-purple-600 text-white font-semibold
        rounded-lg shadow-lg
        focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2
        transition-all
      "
    >
      {children}
    </a>
  );
}
