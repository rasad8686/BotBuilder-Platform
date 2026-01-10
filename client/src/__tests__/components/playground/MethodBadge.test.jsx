import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import MethodBadge from '../../../components/playground/MethodBadge';

describe('MethodBadge', () => {
  describe('Rendering', () => {
    it('renders without crashing', () => {
      render(<MethodBadge method="GET" />);
      expect(screen.getByText('GET')).toBeInTheDocument();
    });

    it('displays the method text', () => {
      render(<MethodBadge method="POST" />);
      expect(screen.getByText('POST')).toBeInTheDocument();
    });
  });

  describe('Method Colors', () => {
    it('applies green color for GET method', () => {
      render(<MethodBadge method="GET" />);
      const badge = screen.getByText('GET');
      expect(badge.className).toContain('bg-green-500');
    });

    it('applies blue color for POST method', () => {
      render(<MethodBadge method="POST" />);
      const badge = screen.getByText('POST');
      expect(badge.className).toContain('bg-blue-500');
    });

    it('applies orange color for PUT method', () => {
      render(<MethodBadge method="PUT" />);
      const badge = screen.getByText('PUT');
      expect(badge.className).toContain('bg-orange-500');
    });

    it('applies yellow color for PATCH method', () => {
      render(<MethodBadge method="PATCH" />);
      const badge = screen.getByText('PATCH');
      expect(badge.className).toContain('bg-yellow-500');
    });

    it('applies red color for DELETE method', () => {
      render(<MethodBadge method="DELETE" />);
      const badge = screen.getByText('DELETE');
      expect(badge.className).toContain('bg-red-500');
    });

    it('applies gray color for unknown method', () => {
      render(<MethodBadge method="OPTIONS" />);
      const badge = screen.getByText('OPTIONS');
      expect(badge.className).toContain('bg-gray-500');
    });
  });

  describe('Size Props', () => {
    it('uses medium size by default', () => {
      render(<MethodBadge method="GET" />);
      const badge = screen.getByText('GET');
      expect(badge.className).toContain('px-2');
      expect(badge.className).toContain('py-1');
      expect(badge.className).toContain('text-xs');
    });

    it('applies small size when size="sm"', () => {
      render(<MethodBadge method="GET" size="sm" />);
      const badge = screen.getByText('GET');
      expect(badge.className).toContain('px-1.5');
      expect(badge.className).toContain('py-0.5');
    });

    it('applies large size when size="lg"', () => {
      render(<MethodBadge method="GET" size="lg" />);
      const badge = screen.getByText('GET');
      expect(badge.className).toContain('px-3');
      expect(badge.className).toContain('py-1.5');
      expect(badge.className).toContain('text-sm');
    });
  });

  describe('Styling', () => {
    it('has uppercase text', () => {
      render(<MethodBadge method="get" />);
      const badge = screen.getByText('get');
      expect(badge.className).toContain('uppercase');
    });

    it('has bold font', () => {
      render(<MethodBadge method="GET" />);
      const badge = screen.getByText('GET');
      expect(badge.className).toContain('font-bold');
    });

    it('has rounded corners', () => {
      render(<MethodBadge method="GET" />);
      const badge = screen.getByText('GET');
      expect(badge.className).toContain('rounded');
    });
  });
});
