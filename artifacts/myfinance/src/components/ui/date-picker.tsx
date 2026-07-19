import React from 'react';
import { format, parse, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn, parseLocalDate } from '@/lib/utils';

interface DatePickerProps {
  /** Date in YYYY-MM-DD format, or '' for no date. */
  value: string;
  /** Called with a YYYY-MM-DD string (or '' when cleared). */
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

/**
 * Date picker that always shows and accepts dates in dd/mm/aaaa format,
 * regardless of the browser's locale.  Internally stores/returns YYYY-MM-DD
 * strings, compatible with the existing data layer.
 *
 * Users can type the date directly or pick it from the calendar popover.
 * Auto-inserts slashes as the user types so they only need to enter digits.
 */
export const DatePicker = ({
  value,
  onChange,
  placeholder = 'dd/mm/aaaa',
  className,
  disabled,
}: DatePickerProps) => {
  const [open, setOpen] = React.useState(false);

  const toDisplay = (iso: string): string => {
    if (!iso) return '';
    try { return format(parseLocalDate(iso), 'dd/MM/yyyy'); } catch { return ''; }
  };

  const [inputValue, setInputValue] = React.useState(() => toDisplay(value));

  // Sync display when value prop changes externally (form.reset, edit mode, etc.)
  React.useEffect(() => {
    setInputValue(toDisplay(value));
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  // Parse a complete dd/MM/yyyy string → YYYY-MM-DD for storage
  const fromDisplay = (display: string): string | null => {
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(display)) return null;
    const parsed = parse(display, 'dd/MM/yyyy', new Date());
    return isValid(parsed) ? format(parsed, 'yyyy-MM-dd') : null;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Extract only digits, auto-insert slashes, cap at 10 chars (dd/MM/yyyy)
    const digits = e.target.value.replace(/\D/g, '').slice(0, 8);
    let formatted = digits;
    if (formatted.length > 2) formatted = formatted.slice(0, 2) + '/' + formatted.slice(2);
    if (formatted.length > 5) formatted = formatted.slice(0, 5) + '/' + formatted.slice(5);
    setInputValue(formatted);

    if (formatted === '') {
      onChange('');
    } else {
      const iso = fromDisplay(formatted);
      if (iso) onChange(iso);
      // Partial input: leave the last valid value in the form state untouched
    }
  };

  const handleCalendarSelect = (date: Date | undefined) => {
    if (date) {
      onChange(format(date, 'yyyy-MM-dd'));
      setInputValue(format(date, 'dd/MM/yyyy'));
    } else {
      onChange('');
      setInputValue('');
    }
    setOpen(false);
  };

  const selectedDate = value ? parseLocalDate(value) : undefined;
  const thisYear = new Date().getFullYear();

  return (
    <div className={cn('relative flex items-center', className)}>
      <Input
        value={inputValue}
        onChange={handleInputChange}
        placeholder={placeholder}
        disabled={disabled}
        className="pr-9"
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={disabled}
            className="absolute right-0 h-full w-9 px-0 text-muted-foreground hover:text-foreground"
          >
            <CalendarIcon className="w-4 h-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-auto p-0 shadow-lg border"
          side="bottom"
          align="start"
          sideOffset={4}
        >
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={handleCalendarSelect}
            locale={ptBR}
            captionLayout="dropdown"
            fromYear={2000}
            toYear={thisYear + 5}
            defaultMonth={selectedDate ?? new Date()}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
};
