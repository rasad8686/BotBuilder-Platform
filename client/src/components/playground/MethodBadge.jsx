import React from 'react';

const methodColors = {
  GET: 'bg-green-500 text-white',
  POST: 'bg-blue-500 text-white',
  PUT: 'bg-orange-500 text-white',
  PATCH: 'bg-yellow-500 text-white',
  DELETE: 'bg-red-500 text-white'
};

export default function MethodBadge({ method, size = 'md' }) {
  const sizeClasses = {
    sm: 'px-1.5 py-0.5 text-[10px]',
    md: 'px-2 py-1 text-xs',
    lg: 'px-3 py-1.5 text-sm'
  };

  return (
    <span className={`
      ${methodColors[method] || 'bg-gray-500 text-white'}
      ${sizeClasses[size]}
      font-bold rounded uppercase tracking-wide
    `}>
      {method}
    </span>
  );
}
