import React from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface CurrencyInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  /** Numeric value in full units (e.g. 104.50). */
  value: number;
  /** Called with the updated numeric value whenever the user edits. */
  onChange: (value: number) => void;
}

/**
 * Bank-style currency input for Brazilian Real.
 * The user types only digits; the two rightmost are treated as centavos.
 * Example: typing 1 → 0 → 4 → 5 → 0 produces "104,50".
 * Exposes a plain number (e.g. 104.50) to react-hook-form via onChange.
 * Backspace removes the last digit; Delete clears the field entirely.
 * Uses inputMode="numeric" for the correct mobile keyboard.
 */
export const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ value, onChange, className, placeholder = '0,00', disabled, ...props }, ref) => {
    // Internal state: raw digit characters representing the value in centavos.
    // e.g. value=104.50  →  digits="10450"
    //      value=0       →  digits=""
    const [digits, setDigits] = React.useState<string>(() => {
      const cents = Math.round(value * 100);
      return cents > 0 ? String(cents) : '';
    });

    // Sync when the value prop changes externally (form.reset, edit / duplicate mode).
    const prevValue = React.useRef(value);
    React.useEffect(() => {
      const oldCents = Math.round(prevValue.current * 100);
      const newCents = Math.round(value * 100);
      if (oldCents !== newCents) {
        prevValue.current = value;
        setDigits(newCents > 0 ? String(newCents) : '');
      }
    }, [value]);

    const format = (d: string): string => {
      if (!d) return '';
      const cents = parseInt(d, 10);
      return (cents / 100).toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    };

    const commit = (newDigits: string) => {
      prevValue.current = newDigits ? parseInt(newDigits, 10) / 100 : 0;
      setDigits(newDigits);
      onChange(newDigits ? parseInt(newDigits, 10) / 100 : 0);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (/^\d$/.test(e.key)) {
        e.preventDefault();
        // Strip leading zeros, cap at 11 digits (R$ 999.999.999,99)
        const next = (digits + e.key).replace(/^0+/, '') || '';
        if (next.length <= 11) commit(next);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        commit(digits.slice(0, -1));
      } else if (e.key === 'Delete') {
        e.preventDefault();
        commit('');
      } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
        // Block non-digit printable characters (letters, symbols, commas, dots)
        e.preventDefault();
      }
    };

    // Fallback onChange for mobile virtual keyboards where keyDown can be unreliable.
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value.replace(/\D/g, '').replace(/^0+/, '');
      if (raw.length <= 11) commit(raw);
    };

    return (
      <Input
        ref={ref}
        inputMode="numeric"
        value={format(digits)}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={cn(className)}
        disabled={disabled}
        {...props}
      />
    );
  },
);
CurrencyInput.displayName = 'CurrencyInput';
