import React, { useState, useCallback } from 'react';
import { Calculator } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { TransactionFormDialog } from '@/components/TransactionFormDialog';

// ── Number formatting ─────────────────────────────────────────────────────────

/** Format a number for the expression/accumulated display (pt-BR, no symbol). */
function formatNum(value: number): string {
  if (!isFinite(value)) return 'Erro';
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 8 }).format(value);
}

/**
 * Format the raw input string (internal dots as decimal) for display in pt-BR.
 * e.g. '1234.5' → '1.234,5'   '125.' → '125,'   '0' → '0'
 */
function formatInput(input: string): string {
  if (!input || input === '-') return '0';
  const hasDot = input.includes('.');
  const [intStr, decStr] = input.split('.');
  const intNum = parseInt(intStr || '0', 10);
  const intFormatted = isNaN(intNum) ? '0' : new Intl.NumberFormat('pt-BR').format(intNum);
  return hasDot ? `${intFormatted},${decStr ?? ''}` : intFormatted;
}

function parseInput(s: string): number {
  const n = parseFloat(s);
  return isFinite(n) ? n : 0;
}

// ── Calculator logic ──────────────────────────────────────────────────────────

interface CalcState {
  inputStr: string;        // raw number being typed (uses '.' for decimal internally)
  accumulated: number;     // value stored from previous operation
  pendingOp: string | null;
  justEvaluated: boolean;  // true after pressing op or = — next digit starts fresh
}

const initState: CalcState = {
  inputStr: '0',
  accumulated: 0,
  pendingOp: null,
  justEvaluated: false,
};

const OP_DISPLAY: Record<string, string> = { '+': '+', '-': '−', '×': '×', '÷': '÷' };

function applyOp(a: number, op: string, b: number): number {
  switch (op) {
    case '+': return a + b;
    case '-': return a - b;
    case '×': return a * b;
    case '÷': return b !== 0 ? a / b : NaN;
    default:  return b;
  }
}

/** Compute the final value to use when launching as a transaction. */
function computeLaunchValue(calc: CalcState): number {
  const current = parseInput(calc.inputStr);
  if (calc.pendingOp && !calc.justEvaluated) {
    const result = applyOp(calc.accumulated, calc.pendingOp, current);
    return isFinite(result) ? result : 0;
  }
  return current;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function CalcBtn({
  label,
  onClick,
  variant = 'outline',
  className,
}: {
  label: React.ReactNode;
  onClick: () => void;
  variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'destructive';
  className?: string;
}) {
  return (
    <Button
      type="button"
      variant={variant}
      size="sm"
      onClick={onClick}
      className={cn('h-12 text-base font-medium select-none', className)}
    >
      {label}
    </Button>
  );
}

// ── Calculator body ───────────────────────────────────────────────────────────

interface CalcBodyProps {
  calc: CalcState;
  onDigit: (d: string) => void;
  onOp: (op: string) => void;
  onEquals: () => void;
  onClear: () => void;
  onBackspace: () => void;
  onLaunch: () => void;
  launchValue: number;
}

function CalcBody({
  calc,
  onDigit,
  onOp,
  onEquals,
  onClear,
  onBackspace,
  onLaunch,
  launchValue,
}: CalcBodyProps) {
  const expressionStr = calc.pendingOp
    ? `${formatNum(calc.accumulated)} ${OP_DISPLAY[calc.pendingOp] ?? calc.pendingOp}`
    : '';

  const displayStr = formatInput(calc.inputStr);
  const canLaunch  = launchValue > 0;

  return (
    <div className="flex flex-col gap-3">
      {/* ── Display ── */}
      <div className="bg-muted/50 rounded-xl px-4 py-3 text-right min-h-[76px] flex flex-col justify-end border border-border/50">
        <p className="text-xs text-muted-foreground h-5 leading-5 truncate font-mono">
          {expressionStr || '\u00A0'}
        </p>
        <p className="text-3xl font-mono font-semibold leading-tight truncate">
          {displayStr}
        </p>
      </div>

      {/* ── Button grid ── */}
      <div className="grid grid-cols-4 gap-1.5">
        {/* Row 1: operators + clear */}
        <CalcBtn
          label="C"
          onClick={onClear}
          variant="ghost"
          className="text-destructive font-bold hover:bg-destructive/10"
        />
        <CalcBtn
          label="⌫"
          onClick={onBackspace}
          variant="ghost"
          className="text-muted-foreground"
        />
        <CalcBtn label="÷" onClick={() => onOp('÷')} variant="secondary" />
        <CalcBtn label="×" onClick={() => onOp('×')} variant="secondary" />

        {/* Row 2 */}
        <CalcBtn label="7" onClick={() => onDigit('7')} />
        <CalcBtn label="8" onClick={() => onDigit('8')} />
        <CalcBtn label="9" onClick={() => onDigit('9')} />
        <CalcBtn label="−" onClick={() => onOp('-')} variant="secondary" />

        {/* Row 3 */}
        <CalcBtn label="4" onClick={() => onDigit('4')} />
        <CalcBtn label="5" onClick={() => onDigit('5')} />
        <CalcBtn label="6" onClick={() => onDigit('6')} />
        <CalcBtn label="+" onClick={() => onOp('+')} variant="secondary" />

        {/* Row 4 */}
        <CalcBtn label="1" onClick={() => onDigit('1')} />
        <CalcBtn label="2" onClick={() => onDigit('2')} />
        <CalcBtn label="3" onClick={() => onDigit('3')} />
        <CalcBtn
          label="="
          onClick={onEquals}
          variant="default"
          className="bg-primary text-primary-foreground"
        />

        {/* Row 5 */}
        <CalcBtn label="0" onClick={() => onDigit('0')} className="col-span-2" />
        <CalcBtn label="," onClick={() => onDigit('.')} />
        {/* col 4 intentionally empty to keep grid alignment */}
        <div />
      </div>

      {/* ── Launch button ── */}
      <Button
        size="sm"
        className="w-full"
        disabled={!canLaunch}
        onClick={onLaunch}
      >
        Lançar como transação
      </Button>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function FloatingCalculator() {
  const [panelOpen, setPanelOpen]   = useState(false);  // desktop expand/collapse
  const [sheetOpen, setSheetOpen]   = useState(false);  // mobile bottom sheet
  const [txOpen,    setTxOpen]      = useState(false);  // transaction dialog
  const [calc,      setCalc]        = useState<CalcState>(initState);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleDigit = useCallback((digit: string) => {
    setCalc(prev => {
      if (prev.justEvaluated) {
        return { ...prev, inputStr: digit === '0' ? '0' : digit, justEvaluated: false };
      }
      if (prev.inputStr === '0' && digit !== '.') return { ...prev, inputStr: digit };
      if (digit === '.' && prev.inputStr.includes('.')) return prev;
      if (prev.inputStr.replace('.', '').replace('-', '').length >= 12) return prev; // max digits
      return { ...prev, inputStr: prev.inputStr + digit };
    });
  }, []);

  const handleOp = useCallback((op: string) => {
    setCalc(prev => {
      // If user presses op right after another op, just change the operator
      if (prev.justEvaluated) return { ...prev, pendingOp: op };
      const current       = parseInput(prev.inputStr);
      const newAccumulated = prev.pendingOp
        ? applyOp(prev.accumulated, prev.pendingOp, current)
        : current;
      const safe = isFinite(newAccumulated) ? newAccumulated : 0;
      return {
        inputStr:      String(safe),
        accumulated:   safe,
        pendingOp:     op,
        justEvaluated: true,
      };
    });
  }, []);

  const handleEquals = useCallback(() => {
    setCalc(prev => {
      if (!prev.pendingOp || prev.justEvaluated) return { ...prev, justEvaluated: true };
      const current = parseInput(prev.inputStr);
      const result  = applyOp(prev.accumulated, prev.pendingOp, current);
      const safe    = isFinite(result) ? result : 0;
      return {
        inputStr:      String(safe),
        accumulated:   safe,
        pendingOp:     null,
        justEvaluated: true,
      };
    });
  }, []);

  const handleClear = useCallback(() => setCalc(initState), []);

  const handleBackspace = useCallback(() => {
    setCalc(prev => {
      if (prev.justEvaluated) return initState;
      if (prev.inputStr.length <= 1) return { ...prev, inputStr: '0' };
      const next = prev.inputStr.slice(0, -1);
      return { ...prev, inputStr: next === '-' || next === '' ? '0' : next };
    });
  }, []);

  const launchValue = computeLaunchValue(calc);

  const handleLaunch = useCallback(() => {
    setSheetOpen(false);
    setTxOpen(true);
  }, []);

  const handleTxChange = useCallback((open: boolean) => {
    setTxOpen(open);
  }, []);

  const handleTxSuccess = useCallback(() => {
    setCalc(initState);
  }, []);

  // ── Shared body props ────────────────────────────────────────────────────────

  const bodyProps: CalcBodyProps = {
    calc,
    onDigit:    handleDigit,
    onOp:       handleOp,
    onEquals:   handleEquals,
    onClear:    handleClear,
    onBackspace: handleBackspace,
    onLaunch:   handleLaunch,
    launchValue,
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Desktop fixed panel (md+) ─────────────────────────────────────── */}
      <div className="hidden md:flex fixed right-0 top-1/2 -translate-y-1/2 z-30 flex-row items-stretch">
        {/* Toggle tab */}
        <button
          onClick={() => setPanelOpen(o => !o)}
          aria-label={panelOpen ? 'Recolher calculadora' : 'Abrir calculadora'}
          className={cn(
            'flex flex-col items-center justify-center gap-1 px-1 py-4',
            'bg-card border border-r-0 border-border rounded-l-xl w-9',
            'shadow-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground',
          )}
        >
          <Calculator className="w-4 h-4" />
          {!panelOpen && (
            <span className="text-[9px] leading-none font-medium" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
              Calc
            </span>
          )}
        </button>

        {/* Panel */}
        <div
          className={cn(
            'bg-card border border-border rounded-tl-2xl rounded-bl-2xl shadow-xl',
            'transition-all duration-300 overflow-hidden',
            panelOpen ? 'w-72 opacity-100' : 'w-0 opacity-0 pointer-events-none',
          )}
        >
          <div className="w-72 p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold flex items-center gap-1.5 text-foreground">
                <Calculator className="w-4 h-4" />
                Calculadora
              </span>
              <button
                onClick={() => setPanelOpen(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Fechar calculadora"
              >
                <span className="text-xs">✕</span>
              </button>
            </div>
            <CalcBody {...bodyProps} />
          </div>
        </div>
      </div>

      {/* ── Mobile FAB (below the + FAB) ─────────────────────────────────── */}
      <button
        onClick={() => setSheetOpen(true)}
        aria-label="Abrir calculadora"
        className="md:hidden fixed bottom-[138px] right-4 z-50 bg-card border border-border text-muted-foreground rounded-full w-11 h-11 flex items-center justify-center shadow-md active:scale-95 transition-transform"
      >
        <Calculator className="w-5 h-5" />
      </button>

      {/* ── Mobile bottom sheet ───────────────────────────────────────────── */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[90vh] overflow-y-auto pb-8">
          <SheetHeader className="mb-4">
            <SheetTitle className="flex items-center gap-2 text-base">
              <Calculator className="w-4 h-4" />
              Calculadora
            </SheetTitle>
          </SheetHeader>
          <CalcBody {...bodyProps} />
        </SheetContent>
      </Sheet>

      {/* ── Transaction dialog ────────────────────────────────────────────── */}
      <TransactionFormDialog
        open={txOpen}
        onOpenChange={handleTxChange}
        initialAmount={launchValue > 0 ? launchValue : undefined}
        onSuccess={handleTxSuccess}
      />
    </>
  );
}
