import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import {
  Input,
  SearchInput,
  Textarea,
  Select,
  Checkbox,
  Radio,
  Switch
} from '../Input';

describe('Input Component', () => {
  // Basic Rendering
  describe('Rendering', () => {
    it('renders basic input', () => {
      render(<Input data-testid="input" />);
      expect(screen.getByTestId('input')).toBeInTheDocument();
    });

    it('renders with label', () => {
      render(<Input label="Email" />);
      expect(screen.getByText('Email')).toBeInTheDocument();
    });

    it('renders with placeholder', () => {
      render(<Input placeholder="Enter email" />);
      expect(screen.getByPlaceholderText('Enter email')).toBeInTheDocument();
    });

    it('renders with helper text', () => {
      render(<Input helperText="This is helper text" />);
      expect(screen.getByText('This is helper text')).toBeInTheDocument();
    });
  });

  // Sizes
  describe('Sizes', () => {
    it('renders small size', () => {
      render(<Input size="sm" data-testid="input" />);
      const input = screen.getByTestId('input');
      expect(input.className).toContain('h-8');
    });

    it('renders medium size', () => {
      render(<Input size="md" data-testid="input" />);
      const input = screen.getByTestId('input');
      expect(input.className).toContain('h-10');
    });

    it('renders large size', () => {
      render(<Input size="lg" data-testid="input" />);
      const input = screen.getByTestId('input');
      expect(input.className).toContain('h-12');
    });
  });

  // States
  describe('States', () => {
    it('renders error state', () => {
      render(<Input error errorMessage="Invalid input" data-testid="input" />);
      const input = screen.getByTestId('input');
      expect(input.className).toContain('border-red-500');
      expect(screen.getByText('Invalid input')).toBeInTheDocument();
    });

    it('renders success state', () => {
      render(<Input success successMessage="Valid input" data-testid="input" />);
      const input = screen.getByTestId('input');
      expect(input.className).toContain('border-emerald-500');
      expect(screen.getByText('Valid input')).toBeInTheDocument();
    });

    it('renders disabled state', () => {
      render(<Input disabled data-testid="input" />);
      const input = screen.getByTestId('input');
      expect(input).toBeDisabled();
    });
  });

  // Events
  describe('Events', () => {
    it('handles onChange', async () => {
      const handleChange = vi.fn();
      render(<Input onChange={handleChange} data-testid="input" />);

      const input = screen.getByTestId('input');
      await userEvent.type(input, 'test');

      expect(handleChange).toHaveBeenCalled();
    });

    it('handles onFocus and onBlur', async () => {
      const handleFocus = vi.fn();
      const handleBlur = vi.fn();
      render(<Input onFocus={handleFocus} onBlur={handleBlur} data-testid="input" />);

      const input = screen.getByTestId('input');
      fireEvent.focus(input);
      expect(handleFocus).toHaveBeenCalled();

      fireEvent.blur(input);
      expect(handleBlur).toHaveBeenCalled();
    });
  });

  // Password Toggle
  describe('Password Toggle', () => {
    it('toggles password visibility', async () => {
      render(<Input type="password" showPasswordToggle data-testid="input" />);

      const input = screen.getByTestId('input');
      expect(input).toHaveAttribute('type', 'password');

      const toggleBtn = screen.getByRole('button', { name: /show password/i });
      await userEvent.click(toggleBtn);

      expect(input).toHaveAttribute('type', 'text');
    });
  });

  // Clearable
  describe('Clearable', () => {
    it('shows clear button when has value', () => {
      const handleClear = vi.fn();
      render(<Input value="test" clearable onClear={handleClear} data-testid="input" />);

      const clearBtn = screen.getByRole('button', { name: /clear/i });
      expect(clearBtn).toBeInTheDocument();
    });

    it('calls onClear when clear button clicked', async () => {
      const handleClear = vi.fn();
      render(<Input value="test" clearable onClear={handleClear} data-testid="input" />);

      const clearBtn = screen.getByRole('button', { name: /clear/i });
      await userEvent.click(clearBtn);

      expect(handleClear).toHaveBeenCalled();
    });
  });

  // Dark Mode Classes
  describe('Dark Mode', () => {
    it('has dark mode classes', () => {
      render(<Input data-testid="input" />);
      const input = screen.getByTestId('input');
      expect(input.className).toContain('dark:bg-slate-800');
      expect(input.className).toContain('dark:text-white');
    });
  });
});

describe('SearchInput Component', () => {
  it('renders with search icon', () => {
    render(<SearchInput data-testid="search" />);
    expect(screen.getByTestId('search')).toBeInTheDocument();
  });

  it('has default placeholder', () => {
    render(<SearchInput />);
    expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument();
  });

  it('accepts custom placeholder', () => {
    render(<SearchInput placeholder="Find items..." />);
    expect(screen.getByPlaceholderText('Find items...')).toBeInTheDocument();
  });
});

describe('Textarea Component', () => {
  it('renders textarea', () => {
    render(<Textarea data-testid="textarea" />);
    expect(screen.getByTestId('textarea')).toBeInTheDocument();
    expect(screen.getByTestId('textarea').tagName).toBe('TEXTAREA');
  });

  it('renders with label', () => {
    render(<Textarea label="Description" />);
    expect(screen.getByText('Description')).toBeInTheDocument();
  });

  it('renders with custom rows', () => {
    render(<Textarea rows={6} data-testid="textarea" />);
    expect(screen.getByTestId('textarea')).toHaveAttribute('rows', '6');
  });

  it('handles resize prop', () => {
    render(<Textarea resize="none" data-testid="textarea" />);
    expect(screen.getByTestId('textarea').className).toContain('resize-none');
  });
});

describe('Select Component', () => {
  const options = [
    { value: 'opt1', label: 'Option 1' },
    { value: 'opt2', label: 'Option 2' },
    { value: 'opt3', label: 'Option 3', disabled: true }
  ];

  it('renders select', () => {
    render(<Select options={options} data-testid="select" />);
    expect(screen.getByTestId('select')).toBeInTheDocument();
    expect(screen.getByTestId('select').tagName).toBe('SELECT');
  });

  it('renders with label', () => {
    render(<Select label="Choose option" options={options} />);
    expect(screen.getByText('Choose option')).toBeInTheDocument();
  });

  it('renders all options', () => {
    render(<Select options={options} data-testid="select" />);
    expect(screen.getByText('Option 1')).toBeInTheDocument();
    expect(screen.getByText('Option 2')).toBeInTheDocument();
    expect(screen.getByText('Option 3')).toBeInTheDocument();
  });

  it('handles disabled option', () => {
    render(<Select options={options} data-testid="select" />);
    const disabledOption = screen.getByText('Option 3');
    expect(disabledOption).toBeDisabled();
  });
});

describe('Checkbox Component', () => {
  it('renders checkbox', () => {
    render(<Checkbox data-testid="checkbox" />);
    expect(screen.getByTestId('checkbox')).toBeInTheDocument();
    expect(screen.getByTestId('checkbox')).toHaveAttribute('type', 'checkbox');
  });

  it('renders with label', () => {
    render(<Checkbox label="Accept terms" />);
    expect(screen.getByText('Accept terms')).toBeInTheDocument();
  });

  it('renders with description', () => {
    render(<Checkbox label="Accept terms" description="Read the terms first" />);
    expect(screen.getByText('Read the terms first')).toBeInTheDocument();
  });

  it('handles change event', async () => {
    const handleChange = vi.fn();
    render(<Checkbox onChange={handleChange} data-testid="checkbox" />);

    await userEvent.click(screen.getByTestId('checkbox'));
    expect(handleChange).toHaveBeenCalled();
  });
});

describe('Radio Component', () => {
  it('renders radio', () => {
    render(<Radio data-testid="radio" />);
    expect(screen.getByTestId('radio')).toBeInTheDocument();
    expect(screen.getByTestId('radio')).toHaveAttribute('type', 'radio');
  });

  it('renders with label', () => {
    render(<Radio label="Option A" />);
    expect(screen.getByText('Option A')).toBeInTheDocument();
  });

  it('renders with description', () => {
    render(<Radio label="Option A" description="This is option A" />);
    expect(screen.getByText('This is option A')).toBeInTheDocument();
  });
});

describe('Switch Component', () => {
  it('renders switch', () => {
    render(<Switch data-testid="switch" />);
    expect(screen.getByTestId('switch')).toBeInTheDocument();
    expect(screen.getByTestId('switch')).toHaveAttribute('role', 'switch');
  });

  it('renders with label', () => {
    render(<Switch label="Enable notifications" />);
    expect(screen.getByText('Enable notifications')).toBeInTheDocument();
  });

  it('handles onChange', async () => {
    const handleChange = vi.fn();
    render(<Switch onChange={handleChange} data-testid="switch" />);

    await userEvent.click(screen.getByTestId('switch'));
    expect(handleChange).toHaveBeenCalledWith(true);
  });

  it('reflects checked state', () => {
    render(<Switch checked data-testid="switch" />);
    expect(screen.getByTestId('switch')).toHaveAttribute('aria-checked', 'true');
  });

  it('shows unchecked state', () => {
    render(<Switch checked={false} data-testid="switch" />);
    expect(screen.getByTestId('switch')).toHaveAttribute('aria-checked', 'false');
  });
});
