export default function DocsSkeleton() {
  return (
    <div className="animate-pulse">
      {/* Breadcrumb skeleton */}
      <div className="flex items-center gap-2 mb-4">
        <div className="h-4 w-4 bg-gray-200 rounded" />
        <div className="h-4 w-24 bg-gray-200 rounded" />
        <div className="h-4 w-4 bg-gray-200 rounded" />
        <div className="h-4 w-32 bg-gray-200 rounded" />
      </div>

      {/* Title skeleton */}
      <div className="h-9 w-3/4 bg-gray-200 rounded mb-6" />

      {/* Reading time skeleton */}
      <div className="h-4 w-24 bg-gray-200 rounded mb-6" />

      {/* Table of contents skeleton */}
      <div
        className="mb-8 p-4 rounded-lg"
        style={{ backgroundColor: '#f6f9fc' }}
      >
        <div className="h-4 w-24 bg-gray-200 rounded mb-3" />
        <div className="space-y-2">
          <div className="h-4 w-48 bg-gray-200 rounded" />
          <div className="h-4 w-40 bg-gray-200 rounded ml-4" />
          <div className="h-4 w-56 bg-gray-200 rounded" />
          <div className="h-4 w-44 bg-gray-200 rounded ml-4" />
        </div>
      </div>

      {/* Content skeleton */}
      <div className="space-y-4">
        {/* Paragraph 1 */}
        <div className="space-y-2">
          <div className="h-4 w-full bg-gray-200 rounded" />
          <div className="h-4 w-5/6 bg-gray-200 rounded" />
          <div className="h-4 w-4/5 bg-gray-200 rounded" />
        </div>

        {/* Heading */}
        <div className="h-6 w-1/2 bg-gray-200 rounded mt-6" />

        {/* Paragraph 2 */}
        <div className="space-y-2">
          <div className="h-4 w-full bg-gray-200 rounded" />
          <div className="h-4 w-11/12 bg-gray-200 rounded" />
          <div className="h-4 w-3/4 bg-gray-200 rounded" />
        </div>

        {/* List skeleton */}
        <div className="space-y-2 ml-6">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 bg-gray-200 rounded-full" />
            <div className="h-4 w-48 bg-gray-200 rounded" />
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 bg-gray-200 rounded-full" />
            <div className="h-4 w-40 bg-gray-200 rounded" />
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 bg-gray-200 rounded-full" />
            <div className="h-4 w-52 bg-gray-200 rounded" />
          </div>
        </div>

        {/* Code block skeleton */}
        <div
          className="p-4 rounded-lg mt-4"
          style={{ backgroundColor: '#1e1e1e' }}
        >
          <div className="space-y-2">
            <div className="h-4 w-3/4 bg-gray-700 rounded" />
            <div className="h-4 w-1/2 bg-gray-700 rounded" />
            <div className="h-4 w-2/3 bg-gray-700 rounded" />
          </div>
        </div>

        {/* Heading */}
        <div className="h-6 w-2/5 bg-gray-200 rounded mt-6" />

        {/* Table skeleton */}
        <div className="border rounded-lg overflow-hidden" style={{ borderColor: '#e6ebf1' }}>
          <div className="p-3" style={{ backgroundColor: '#f6f9fc' }}>
            <div className="flex gap-4">
              <div className="h-4 w-24 bg-gray-200 rounded" />
              <div className="h-4 w-32 bg-gray-200 rounded" />
            </div>
          </div>
          <div className="p-3 border-t" style={{ borderColor: '#e6ebf1' }}>
            <div className="flex gap-4">
              <div className="h-4 w-24 bg-gray-100 rounded" />
              <div className="h-4 w-32 bg-gray-100 rounded" />
            </div>
          </div>
          <div className="p-3 border-t" style={{ borderColor: '#e6ebf1' }}>
            <div className="flex gap-4">
              <div className="h-4 w-24 bg-gray-100 rounded" />
              <div className="h-4 w-32 bg-gray-100 rounded" />
            </div>
          </div>
        </div>
      </div>

      {/* Navigation skeleton */}
      <div className="flex justify-between mt-8 pt-6 border-t" style={{ borderColor: '#e6ebf1' }}>
        <div className="flex items-center gap-2 px-4 py-2 border rounded-lg" style={{ borderColor: '#e6ebf1' }}>
          <div className="h-4 w-4 bg-gray-200 rounded" />
          <div>
            <div className="h-3 w-16 bg-gray-200 rounded mb-1" />
            <div className="h-4 w-24 bg-gray-200 rounded" />
          </div>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 border rounded-lg" style={{ borderColor: '#e6ebf1' }}>
          <div>
            <div className="h-3 w-16 bg-gray-200 rounded mb-1" />
            <div className="h-4 w-24 bg-gray-200 rounded" />
          </div>
          <div className="h-4 w-4 bg-gray-200 rounded" />
        </div>
      </div>
    </div>
  );
}
