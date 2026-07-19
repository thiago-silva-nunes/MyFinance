import React from 'react';
import { useFinance } from '@/context/FinanceContext';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { AnimatePresence, motion } from 'framer-motion';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { getIcon } from '@/components/IconMap';
import { toast } from 'sonner';
import { Transaction, ScheduledTransaction, Subcategory, BankAccount } from '@/data/mockData';
import { CreditCard, Info, Loader2, Repeat2, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DRE_GROUP_OPTIONS, DRE_GROUP_LABEL } from '@/services/dataService';
import { CurrencyInput } from '@/components/ui/currency-input';
import { DatePicker } from '@/components/ui/date-picker';

// ── Section label/divider ─────────────────────────────────────────────────────
const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <div className="flex items-center gap-2 pt-1 col-span-2">
    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
      {children}
    </span>
    <div className="flex-1 h-px bg-border" />
  </div>
);

// ── Dynamic Zod schema ────────────────────────────────────────────────────────
const buildSchema = (
  isRecurring: boolean,
  subcategories: Subcategory[],
  banks: BankAccount[],
) =>
  z
    .object({
      // Common
      description:      z.string().min(1, 'Descrição é obrigatória'),
      amount:           z.coerce.number().min(0.01, 'Valor deve ser maior que zero'),
      type:             z.enum(['income', 'expense']),
      categoryId:       z.string().min(1, 'Categoria é obrigatória'),
      subcategoryId:    z.string().optional(),
      dreGroupOverride: z.string().optional(),
      notes:            z.string().optional(),

      // Transaction-only
      date:          z.string().optional(),
      status:        z.enum(['paid', 'pending']).optional(),
      paymentMethod: z.string().optional(),
      cardId:        z.string().optional(),
      bankId:        z.string().optional(),
      purchaseType:  z.enum(['avista', 'parcelado']).default('avista'),
      installments:  z.coerce.number().min(2).max(24).default(2),

      // Recurring-only
      startDate: z.string().optional(),
      endDate:   z.string().optional(),
      frequency: z
        .enum(['once', 'daily', 'weekly', 'monthly', 'yearly'])
        .optional(),
      active: z.boolean().default(true),
    })
    .superRefine((data, ctx) => {
      // Subcategory: required when category has subcategories
      if (data.categoryId) {
        const subs = subcategories.filter(s => s.categoryId === data.categoryId);
        if (
          subs.length > 0 &&
          (!data.subcategoryId || data.subcategoryId === '' || data.subcategoryId === '__none__')
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Selecione uma subcategoria',
            path: ['subcategoryId'],
          });
        }
      }

      if (!isRecurring) {
        // Date required
        if (!data.date || data.date === '') {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Data é obrigatória',
            path: ['date'],
          });
        }
        // Card required when credit card payment
        if (
          data.type === 'expense' &&
          data.paymentMethod === 'cartao_credito' &&
          (!data.cardId || data.cardId === '')
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Selecione um cartão',
            path: ['cardId'],
          });
        }
        // Bank required for non-card, non-legacy expense payments when banks exist
        if (
          data.type === 'expense' &&
          data.paymentMethod !== 'cartao_credito' &&
          data.paymentMethod !== 'dinheiro_pix_debito' &&
          banks.length > 0 &&
          (!data.bankId || data.bankId === '' || data.bankId === '__none__')
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Selecione uma conta bancária',
            path: ['bankId'],
          });
        }
      } else {
        // Start date required in recurring mode
        if (!data.startDate || data.startDate === '') {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Data de início é obrigatória',
            path: ['startDate'],
          });
        }
      }
    });

type FormValues = z.infer<ReturnType<typeof buildSchema>>;

// ── Props ─────────────────────────────────────────────────────────────────────
interface TransactionFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction?: Transaction | null;
  /** When set, opens the form in recurring-edit mode (toggle locked ON). */
  editingScheduled?: ScheduledTransaction | null;
  defaultCardId?: string;
  /** When set, pre-fills the form with these values but saves as a NEW transaction (duplicate mode). */
  duplicateFrom?: Transaction | null;
  /** Pre-fills the amount field when opening a new (non-edit, non-duplicate) transaction. */
  initialAmount?: number;
  /** Called after a successful save (not on cancel). */
  onSuccess?: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────
export const TransactionFormDialog = ({
  open,
  onOpenChange,
  transaction,
  editingScheduled,
  defaultCardId,
  duplicateFrom,
  initialAmount,
  onSuccess,
}: TransactionFormProps) => {
  const {
    categories,
    subcategories,
    cards,
    banks,
    addTransaction,
    updateTransaction,
    addInstallments,
    addScheduled,
    updateScheduled,
  } = useFinance();

  // ── Recurring mode state ───────────────────────────────────────────────────
  const [isRecurring, setIsRecurring] = React.useState(!!editingScheduled);
  /** Toggle locked when editing an existing scheduled transaction. */
  const isRecurringLocked = !!editingScheduled;
  /** Toggle is hidden when editing an existing regular transaction or duplicating. */
  const showRecurringToggle = !transaction && !duplicateFrom;

  // Sync when editingScheduled changes externally
  React.useEffect(() => {
    setIsRecurring(!!editingScheduled);
  }, [editingScheduled]);

  // ── Stable resolver that reads from refs so useForm is not re-mounted ──────
  const isRecurringRef     = React.useRef(isRecurring);
  const subcategoriesRef   = React.useRef(subcategories);
  const banksRef           = React.useRef(banks);
  isRecurringRef.current   = isRecurring;
  subcategoriesRef.current = subcategories;
  banksRef.current         = banks;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stableResolver = React.useCallback((...args: any[]) => {
    const schema = buildSchema(isRecurringRef.current, subcategoriesRef.current, banksRef.current);
    return (zodResolver(schema) as any)(...args);
  }, []); // intentionally stable — reads current state via refs

  // ── Form ──────────────────────────────────────────────────────────────────
  const form = useForm<FormValues>({
    resolver: stableResolver,
    defaultValues: {
      description: '', amount: 0, type: 'expense',
      categoryId: '', subcategoryId: '', dreGroupOverride: '', notes: '',
      date: new Date().toISOString().split('T')[0],
      status: 'paid',
      paymentMethod: defaultCardId ? 'cartao_credito' : 'dinheiro',
      cardId: defaultCardId ?? '', bankId: '',
      purchaseType: 'avista', installments: 2,
      startDate: new Date().toISOString().split('T')[0],
      endDate: '', frequency: 'monthly', active: true,
    },
  });

  // ── Reset on open / prop change ───────────────────────────────────────────
  React.useEffect(() => {
    if (!open) return;

    if (editingScheduled) {
      setIsRecurring(true);
      form.reset({
        description:      editingScheduled.description,
        amount:           editingScheduled.amount,
        type:             editingScheduled.type,
        categoryId:       editingScheduled.categoryId,
        subcategoryId:    editingScheduled.subcategoryId ?? '',
        dreGroupOverride: editingScheduled.dreGroupOverride ?? '',
        notes:            '',
        startDate:        editingScheduled.startDate.split('T')[0],
        endDate:          editingScheduled.endDate ? editingScheduled.endDate.split('T')[0] : '',
        frequency:        editingScheduled.frequency,
        active:           editingScheduled.active,
        bankId:           editingScheduled.bankId ?? '',
        // Transaction defaults (unused in this mode)
        date: new Date().toISOString().split('T')[0],
        status: 'paid',
        paymentMethod: 'dinheiro',
        cardId: '', purchaseType: 'avista', installments: 2,
      });
    } else if (transaction) {
      setIsRecurring(false);
      const isCard = !!transaction.cardId;
      form.reset({
        description:      transaction.description,
        amount:           transaction.amount,
        type:             transaction.type,
        categoryId:       transaction.categoryId,
        subcategoryId:    transaction.subcategoryId ?? '',
        dreGroupOverride: transaction.dreGroupOverride ?? '',
        notes:            transaction.notes || '',
        date:             transaction.date.split('T')[0],
        status:           transaction.status,
        paymentMethod:    isCard ? 'cartao_credito' : (transaction.paymentMethod || 'dinheiro'),
        cardId:           transaction.cardId ?? '',
        bankId:           transaction.bankId ?? '',
        purchaseType: 'avista', installments: 2,
        // Recurring defaults (unused in this mode)
        startDate: new Date().toISOString().split('T')[0],
        endDate: '', frequency: 'monthly', active: true,
      });
    } else if (duplicateFrom) {
      // Duplicate mode: same data as source, but date = today, status = 'paid', no installment group
      setIsRecurring(false);
      const isCard = !!duplicateFrom.cardId;
      form.reset({
        description:      duplicateFrom.description,
        amount:           duplicateFrom.amount,
        type:             duplicateFrom.type,
        categoryId:       duplicateFrom.categoryId,
        subcategoryId:    duplicateFrom.subcategoryId ?? '',
        dreGroupOverride: duplicateFrom.dreGroupOverride ?? '',
        notes:            duplicateFrom.notes || '',
        date:             new Date().toISOString().split('T')[0], // today
        status:           'paid',                                 // reset to default
        paymentMethod:    isCard ? 'cartao_credito' : (duplicateFrom.paymentMethod || 'dinheiro'),
        cardId:           duplicateFrom.cardId ?? '',
        bankId:           duplicateFrom.bankId ?? '',
        purchaseType: 'avista', installments: 2,                  // no installments
        // Recurring defaults (unused in this mode)
        startDate: new Date().toISOString().split('T')[0],
        endDate: '', frequency: 'monthly', active: true,
      });
    } else {
      // New transaction / new recurring
      setIsRecurring(false);
      form.reset({
        description: '', amount: initialAmount ?? 0, type: 'expense',
        categoryId: '', subcategoryId: '', dreGroupOverride: '', notes: '',
        date: new Date().toISOString().split('T')[0],
        status: 'paid',
        paymentMethod: defaultCardId ? 'cartao_credito' : 'dinheiro',
        cardId: defaultCardId ?? '', bankId: '',
        purchaseType: 'avista', installments: 2,
        startDate: new Date().toISOString().split('T')[0],
        endDate: '', frequency: 'monthly', active: true,
      });
    }
  }, [open, transaction, editingScheduled, duplicateFrom, defaultCardId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Watched values ────────────────────────────────────────────────────────
  const type               = form.watch('type');
  const paymentMethod      = form.watch('paymentMethod');
  const purchaseType       = form.watch('purchaseType');
  const selectedCategoryId = form.watch('categoryId');
  const selectedSubcatId   = form.watch('subcategoryId');
  const dreGroupOverride   = form.watch('dreGroupOverride');

  const isCardPayment  = !isRecurring && type === 'expense' && paymentMethod === 'cartao_credito';
  const isNewInstallment = isCardPayment && !transaction && purchaseType === 'parcelado';

  // Bank selector: show for non-card expense payments (not legacy dinheiro_pix_debito)
  const showBankSelectorTx =
    !isRecurring &&
    paymentMethod !== 'cartao_credito' &&
    paymentMethod !== 'dinheiro_pix_debito';

  const filteredCategories     = categories.filter(c => c.type === type);
  const availableSubcategories = selectedCategoryId
    ? subcategories.filter(s => s.categoryId === selectedCategoryId)
    : [];
  const subcatRequired = availableSubcategories.length > 0;

  // DRE helpers
  const selectedCategory    = categories.find(c => c.id === selectedCategoryId);
  const selectedSubcategory = subcategories.find(s => s.id === selectedSubcatId);
  const inheritedDreGroup   =
    selectedSubcategory?.dreGroup ??
    selectedCategory?.dreGroup ??
    (type === 'income' ? 'receita' : 'despesa_variavel');
  const isDreOverriding = !!(dreGroupOverride && dreGroupOverride !== '' && dreGroupOverride !== '__inherited__');
  const dreHelperText = isDreOverriding
    ? 'Personalizado para este lançamento'
    : `Herdado de ${
        selectedSubcategory
          ? `${selectedSubcategory.name} (${selectedCategory?.name ?? ''})`
          : (selectedCategory?.name ?? 'Categoria')
      }`;

  // Dialog title
  const dialogTitle = editingScheduled
    ? 'Editar Recorrência'
    : transaction
      ? 'Editar Transação'
      : duplicateFrom
        ? 'Duplicar Transação'
        : isRecurring
          ? 'Nova Recorrência'
          : 'Nova Transação';

  // ── Submit ────────────────────────────────────────────────────────────────
  const onSubmit = async (data: FormValues) => {
    try {
      const subcategoryId =
        data.subcategoryId && data.subcategoryId !== '' && data.subcategoryId !== '__none__'
          ? data.subcategoryId
          : undefined;
      const dreGroupOverrideVal =
        data.dreGroupOverride && data.dreGroupOverride !== '' && data.dreGroupOverride !== '__inherited__'
          ? data.dreGroupOverride
          : undefined;

      if (isRecurring) {
        const bankId =
          data.bankId && data.bankId !== '' && data.bankId !== '__none__'
            ? data.bankId
            : undefined;
        const payload = {
          description:      data.description,
          amount:           data.amount,
          type:             data.type,
          categoryId:       data.categoryId,
          subcategoryId,
          bankId,
          startDate:        data.startDate!,
          endDate:          data.endDate || undefined,
          frequency:        data.frequency!,
          active:           data.active ?? true,
          dreGroupOverride: dreGroupOverrideVal,
        };
        if (editingScheduled) {
          await updateScheduled(editingScheduled.id, payload);
          toast.success('Recorrência atualizada');
        } else {
          await addScheduled(payload);
          toast.success('Recorrência adicionada');
        }
      } else {
        const cardId = isCardPayment && data.cardId ? data.cardId : undefined;
        const bankId =
          !isCardPayment && data.bankId && data.bankId !== '' && data.bankId !== '__none__'
            ? data.bankId
            : undefined;
        const payload: Omit<Transaction, 'id'> = {
          description:      data.description,
          amount:           data.amount,
          type:             data.type,
          categoryId:       data.categoryId,
          subcategoryId,
          date:             data.date!,
          status:           data.status ?? 'paid',
          paymentMethod:    data.paymentMethod || undefined,
          cardId,
          bankId,
          notes:            data.notes || undefined,
          dreGroupOverride: dreGroupOverrideVal,
        };
        if (transaction) {
          await updateTransaction(transaction.id, {
            ...payload,
            cardId: cardId ?? (null as unknown as undefined),
          });
          toast.success('Transação atualizada com sucesso');
        } else if (isCardPayment && data.purchaseType === 'parcelado' && data.installments > 1) {
          await addInstallments(payload, data.installments);
          toast.success(`Compra parcelada em ${data.installments}x lançada com sucesso`);
        } else {
          await addTransaction(payload);
          toast.success('Transação adicionada com sucesso');
        }
      }
      onOpenChange(false);
      onSuccess?.();
    } catch (err: unknown) {
      const { extractErrorMessage } = await import('@/services/dataService');
      toast.error(`Erro ao salvar: ${extractErrorMessage(err)}`);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full sm:max-w-[700px] max-h-[90vh] p-0 flex flex-col gap-0">
        <div className="px-6 pt-6 pb-4 border-b shrink-0">
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
          </DialogHeader>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">

            {/* ── Recurring toggle ────────────────────────────────────────── */}
            {showRecurringToggle && (
              <div className="flex items-center justify-between rounded-lg border px-4 py-3 bg-muted/30">
                <div className="flex items-center gap-2">
                  <Repeat2 className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Esta é uma transação recorrente?</span>
                </div>
                <Switch
                  checked={isRecurring}
                  disabled={isRecurringLocked}
                  onCheckedChange={setIsRecurring}
                />
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-4">

              {/* ════ DETALHES ════════════════════════════════════════════ */}
              <SectionLabel>Detalhes</SectionLabel>

              {/* Type */}
              <FormField control={form.control} name="type" render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>Tipo</FormLabel>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        field.onChange('expense');
                        form.setValue('categoryId', '');
                        form.setValue('subcategoryId', '');
                      }}
                      className={cn(
                        'flex-1 h-9 px-3 rounded-md border text-sm font-medium transition-colors',
                        field.value === 'expense'
                          ? 'bg-destructive text-destructive-foreground border-destructive hover:bg-destructive/90'
                          : 'bg-background text-foreground border-input hover:bg-muted',
                      )}
                    >
                      Despesa
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        field.onChange('income');
                        form.setValue('categoryId', '');
                        form.setValue('subcategoryId', '');
                        if (!isRecurring) form.setValue('paymentMethod', 'dinheiro');
                      }}
                      className={cn(
                        'flex-1 h-9 px-3 rounded-md border text-sm font-medium transition-colors',
                        field.value === 'income'
                          ? 'bg-green-500 text-white border-green-500 hover:bg-green-600'
                          : 'bg-background text-foreground border-input hover:bg-muted',
                      )}
                    >
                      Receita
                    </button>
                  </div>
                </FormItem>
              )} />

              {/* Description — full width */}
              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>Descrição</FormLabel>
                  <FormControl><Input placeholder="Ex: Mercado" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              {/* Amount — col 1 */}
              <FormField control={form.control} name="amount" render={({ field }) => (
                <FormItem>
                  <FormLabel>{isNewInstallment ? 'Valor total (R$)' : 'Valor (R$)'}</FormLabel>
                  <FormControl>
                    <CurrencyInput value={field.value} onChange={field.onChange} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              {/* Date / Start Date — col 2 */}
              {!isRecurring ? (
                <FormField control={form.control} name="date" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data</FormLabel>
                    <FormControl>
                      <DatePicker value={field.value || ''} onChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              ) : (
                <FormField control={form.control} name="startDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data de início</FormLabel>
                    <FormControl>
                      <DatePicker value={field.value || ''} onChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              )}

              {/* ════ CATEGORIZAÇÃO ═══════════════════════════════════════ */}
              <SectionLabel>Categorização</SectionLabel>

              {/* Category — full width */}
              <FormField control={form.control} name="categoryId" render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>Categoria</FormLabel>
                  <Select
                    onValueChange={(v) => {
                      field.onChange(v);
                      form.setValue('subcategoryId', '');
                      form.setValue('dreGroupOverride', '');
                    }}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Selecione uma categoria" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {filteredCategories.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-muted-foreground">
                          Nenhuma categoria cadastrada para este tipo.
                        </div>
                      ) : (
                        filteredCategories.map((cat) => {
                          const Icon = getIcon(cat.icon);
                          return (
                            <SelectItem key={cat.id} value={cat.id}>
                              <div className="flex items-center gap-2">
                                <Icon className="w-4 h-4" style={{ color: cat.color }} />
                                {cat.name}
                              </div>
                            </SelectItem>
                          );
                        })
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              {/* Subcategory — animated, required when category has subs */}
              <AnimatePresence>
                {availableSubcategories.length > 0 && (
                  <motion.div
                    key="subcategory-field"
                    className="col-span-2"
                    initial={{ opacity: 0, y: -6, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: 'auto' }}
                    exit={{ opacity: 0, y: -6, height: 0 }}
                    transition={{ duration: 0.15, ease: 'easeOut' }}
                    style={{ overflow: 'hidden' }}
                  >
                    <FormField control={form.control} name="subcategoryId" render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Subcategoria{' '}
                          {!subcatRequired && (
                            <span className="text-muted-foreground font-normal">(opcional)</span>
                          )}
                        </FormLabel>
                        <Select
                          onValueChange={(v) => {
                            field.onChange(v === '__none__' ? '' : v);
                            form.setValue('dreGroupOverride', '');
                          }}
                          value={field.value && field.value !== '' ? field.value : (subcatRequired ? '' : '__none__')}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione uma subcategoria" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {!subcatRequired && (
                              <SelectItem value="__none__">— Nenhuma —</SelectItem>
                            )}
                            {availableSubcategories.map((sub) => (
                              <SelectItem key={sub.id} value={sub.id}>{sub.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* DRE classification — full width, only when category selected */}
              {selectedCategoryId && (
                <FormField control={form.control} name="dreGroupOverride" render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Classificação no DRE</FormLabel>
                    <Select
                      onValueChange={(v) => field.onChange(v === '__inherited__' ? '' : v)}
                      value={field.value && field.value !== '' ? field.value : '__inherited__'}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue>
                            {isDreOverriding
                              ? DRE_GROUP_LABEL[dreGroupOverride ?? ''] ?? dreGroupOverride
                              : `${DRE_GROUP_LABEL[inheritedDreGroup] ?? inheritedDreGroup} (herdado)`}
                          </SelectValue>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="__inherited__">
                          {DRE_GROUP_LABEL[inheritedDreGroup] ?? inheritedDreGroup} (herdado)
                        </SelectItem>
                        {DRE_GROUP_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className={`text-xs mt-1 ${isDreOverriding ? 'text-amber-600' : 'text-muted-foreground'}`}>
                      {dreHelperText}
                    </p>
                    <FormMessage />
                  </FormItem>
                )} />
              )}

              {/* ════ PAGAMENTO (transaction mode only) ══════════════════ */}
              {!isRecurring && (
                <>
                  <SectionLabel>Pagamento</SectionLabel>

                  {/* Status — col 1 */}
                  <FormField control={form.control} name="status" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="paid">Pago / Recebido</SelectItem>
                          <SelectItem value="pending">Pendente</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />

                  {/* Payment method — col 2, only for expenses */}
                  {type === 'expense' ? (
                    <FormField control={form.control} name="paymentMethod" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Forma de pagamento</FormLabel>
                        <Select
                          onValueChange={(v) => {
                            field.onChange(v);
                            if (v !== 'cartao_credito') {
                              form.setValue('cardId', '');
                              form.setValue('purchaseType', 'avista');
                            }
                            if (v === 'cartao_credito') form.setValue('bankId', '');
                          }}
                          value={field.value}
                        >
                          <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent>
                            {field.value === 'dinheiro_pix_debito' && (
                              <SelectItem value="dinheiro_pix_debito">
                                Dinheiro / PIX / Débito (legado)
                              </SelectItem>
                            )}
                            <SelectItem value="dinheiro">Dinheiro</SelectItem>
                            <SelectItem value="pix">PIX</SelectItem>
                            <SelectItem value="debito">Débito</SelectItem>
                            <SelectItem value="cartao_credito">
                              <div className="flex items-center gap-2">
                                <CreditCard className="w-4 h-4" /> Cartão de Crédito
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                  ) : (
                    /* Income has no payment method — empty col 2 placeholder */
                    <div />
                  )}

                  {/* Bank account — animated, for non-card tx payments */}
                  <AnimatePresence>
                    {showBankSelectorTx && (
                      <motion.div
                        key="bank-field"
                        className="col-span-2"
                        initial={{ opacity: 0, y: -6, height: 0 }}
                        animate={{ opacity: 1, y: 0, height: 'auto' }}
                        exit={{ opacity: 0, y: -6, height: 0 }}
                        transition={{ duration: 0.15, ease: 'easeOut' }}
                        style={{ overflow: 'hidden' }}
                      >
                        {banks.length === 0 ? (
                          <p className="text-sm text-muted-foreground rounded-md border bg-muted/40 px-3 py-2.5">
                            Cadastre uma conta em{' '}
                            <strong>Configurações &gt; Bancos</strong>{' '}
                            para vincular a este lançamento.
                          </p>
                        ) : (
                          <FormField control={form.control} name="bankId" render={({ field }) => (
                            <FormItem>
                              <FormLabel>Conta bancária</FormLabel>
                              <Select
                                onValueChange={(v) => field.onChange(v === '__none__' ? '' : v)}
                                value={field.value && field.value !== '' ? field.value : '__none__'}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Selecione a conta" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="__none__">— Nenhuma —</SelectItem>
                                  {banks.map((b) => (
                                    <SelectItem key={b.id} value={b.id}>
                                      <div className="flex items-center gap-2">
                                        <span
                                          className="w-2.5 h-2.5 rounded-full inline-block shrink-0"
                                          style={{ backgroundColor: b.color }}
                                        />
                                        {b.name}
                                        <span className="text-muted-foreground text-xs">({b.type})</span>
                                      </div>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )} />
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Card selector — only for credit card payments */}
                  {isCardPayment && (
                    <FormField control={form.control} name="cardId" render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>Cartão</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue
                                placeholder={
                                  cards.length === 0
                                    ? 'Nenhum cartão cadastrado'
                                    : 'Selecione o cartão'
                                }
                              />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {cards.map((c) => (
                              <SelectItem key={c.id} value={c.id}>
                                <div className="flex items-center gap-2">
                                  <span
                                    className="w-3 h-3 rounded-full inline-block"
                                    style={{ backgroundColor: c.color }}
                                  />
                                  {c.name} — {c.bank}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                  )}

                  {/* Purchase type — only for new card transactions */}
                  {isCardPayment && !transaction && (
                    <FormField control={form.control} name="purchaseType" render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>Tipo de compra</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="avista">À vista</SelectItem>
                            <SelectItem value="parcelado">Parcelado</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                  )}

                  {/* Installment count */}
                  {isCardPayment && !transaction && purchaseType === 'parcelado' && (
                    <FormField control={form.control} name="installments" render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>Número de parcelas</FormLabel>
                        <Select
                          onValueChange={(v) => field.onChange(Number(v))}
                          value={String(field.value)}
                        >
                          <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent>
                            {Array.from({ length: 23 }, (_, i) => i + 2).map((n) => (
                              <SelectItem key={n} value={String(n)}>{n}x</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                  )}

                  {/* Installment notice */}
                  {transaction?.installmentGroupId && (
                    <div className="col-span-2 flex items-start gap-2 rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
                      <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      <span>
                        Parcela{' '}
                        <strong>
                          {transaction.installmentNumber}/{transaction.installmentTotal}
                        </strong>{' '}
                        de uma compra parcelada. A edição afeta apenas esta parcela.
                      </span>
                    </div>
                  )}
                </>
              )}

              {/* ════ RECORRÊNCIA (recurring mode only) ══════════════════ */}
              {isRecurring && (
                <>
                  <SectionLabel>Recorrência</SectionLabel>

                  {/* Frequency — col 1 */}
                  <FormField control={form.control} name="frequency" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Frequência</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value ?? 'monthly'}
                      >
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="daily">Diário</SelectItem>
                          <SelectItem value="weekly">Semanal</SelectItem>
                          <SelectItem value="monthly">Mensal</SelectItem>
                          <SelectItem value="yearly">Anual</SelectItem>
                          <SelectItem value="once">Uma vez</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />

                  {/* End date — col 2 */}
                  <FormField control={form.control} name="endDate" render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Data fim{' '}
                        <span className="text-muted-foreground font-normal">(opcional)</span>
                      </FormLabel>
                      <FormControl>
                        <DatePicker value={field.value || ''} onChange={field.onChange} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  {/* Bank account — optional for recurring */}
                  {banks.length > 0 && (
                    <FormField control={form.control} name="bankId" render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>
                          Conta bancária{' '}
                          <span className="text-muted-foreground font-normal">(opcional)</span>
                        </FormLabel>
                        <Select
                          onValueChange={(v) => field.onChange(v === '__none__' ? '' : v)}
                          value={field.value && field.value !== '' ? field.value : '__none__'}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione a conta" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="__none__">— Nenhuma —</SelectItem>
                            {banks.map((b) => (
                              <SelectItem key={b.id} value={b.id}>
                                <div className="flex items-center gap-2">
                                  <span
                                    className="w-2.5 h-2.5 rounded-full inline-block shrink-0"
                                    style={{ backgroundColor: b.color }}
                                  />
                                  {b.name}
                                  <span className="text-muted-foreground text-xs">({b.type})</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                  )}

                  {/* Active toggle */}
                  <FormField control={form.control} name="active" render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 col-span-2">
                      <FormLabel className="text-base">Ativo</FormLabel>
                      <FormControl>
                        <Switch
                          checked={field.value ?? true}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )} />
                </>
              )}

              {/* ════ OBSERVAÇÃO ══════════════════════════════════════════ */}
              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>
                    Observação{' '}
                    <span className="text-muted-foreground font-normal">(opcional)</span>
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Observação (opcional)"
                      rows={2}
                      className="resize-none"
                      {...field}
                      value={field.value || ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            </div>
            <div className="px-6 py-4 border-t shrink-0 bg-background">
              <DialogFooter className="pt-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={form.formState.isSubmitting}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting && (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  )}
                  {isNewInstallment ? 'Lançar parcelado' : 'Salvar'}
                </Button>
              </DialogFooter>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
