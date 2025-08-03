import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import SubmitButton from '../../../components/ui/SubmitButton';

describe('SubmitButton', () => {
  describe('Rendering', () => {
    it('renders with children text', () => {
      render(<SubmitButton>Submit</SubmitButton>);
      expect(screen.getByRole('button')).toHaveTextContent('Submit');
    });

    it('renders with primary variant by default', () => {
      const { container } = render(<SubmitButton>Submit</SubmitButton>);
      expect(container.firstChild).toHaveClass('primary');
    });

    it('renders with secondary variant', () => {
      const { container } = render(<SubmitButton variant="secondary">Cancel</SubmitButton>);
      expect(container.firstChild).toHaveClass('secondary');
    });

    it('renders with danger variant', () => {
      const { container } = render(<SubmitButton variant="danger">Delete</SubmitButton>);
      expect(container.firstChild).toHaveClass('danger');
    });

    it('matches snapshot', () => {
      const { container } = render(<SubmitButton>Submit</SubmitButton>);
      expect(container.firstChild).toMatchSnapshot();
    });
  });

  describe('States', () => {
    it('shows loading state', () => {
      render(<SubmitButton loading>Submit</SubmitButton>);
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-busy', 'true');
      expect(button).toBeDisabled();
    });

    it('shows disabled state', () => {
      render(<SubmitButton disabled>Submit</SubmitButton>);
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute('aria-disabled', 'true');
    });

    it('applies custom className', () => {
      const { container } = render(<SubmitButton className="custom-class">Submit</SubmitButton>);
      expect(container.firstChild).toHaveClass('custom-class');
    });
  });

  describe('Interactions', () => {
    it('calls onClick when clicked', () => {
      const handleClick = jest.fn();
      render(<SubmitButton onClick={handleClick}>Submit</SubmitButton>);

      fireEvent.click(screen.getByRole('button'));
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('does not call onClick when disabled', () => {
      const handleClick = jest.fn();
      render(<SubmitButton onClick={handleClick} disabled>Submit</SubmitButton>);

      fireEvent.click(screen.getByRole('button'));
      expect(handleClick).not.toHaveBeenCalled();
    });

    it('does not call onClick when loading', () => {
      const handleClick = jest.fn();
      render(<SubmitButton onClick={handleClick} loading>Submit</SubmitButton>);

      fireEvent.click(screen.getByRole('button'));
      expect(handleClick).not.toHaveBeenCalled();
    });

    it('passes event object to onClick', () => {
      const handleClick = jest.fn();
      render(<SubmitButton onClick={handleClick}>Submit</SubmitButton>);

      fireEvent.click(screen.getByRole('button'));
      expect(handleClick).toHaveBeenCalledWith(expect.objectContaining({
        type: 'click'
      }));
    });
  });

  describe('Props', () => {
    it('accepts type prop', () => {
      render(<SubmitButton type="submit">Submit</SubmitButton>);
      expect(screen.getByRole('button')).toHaveAttribute('type', 'submit');
    });

    it('spreads additional props', () => {
      render(<SubmitButton data-testid="custom-button">Submit</SubmitButton>);
      expect(screen.getByTestId('custom-button')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA attributes when loading', () => {
      render(<SubmitButton loading>Submit</SubmitButton>);
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-busy', 'true');
      expect(button).toHaveAttribute('aria-disabled', 'true');
    });

    it('is keyboard accessible', () => {
      const handleClick = jest.fn();
      render(<SubmitButton onClick={handleClick}>Submit</SubmitButton>);

      const button = screen.getByRole('button');
      button.focus();

      // Button should be focusable
      expect(document.activeElement).toBe(button);

      // Click works via keyboard (Space/Enter handled by browser)
      fireEvent.click(button);
      expect(handleClick).toHaveBeenCalled();
    });
  });
});
