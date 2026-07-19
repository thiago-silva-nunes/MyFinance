import React, { useState, useCallback, useRef } from 'react';
import * as XLSX from 'xlsx';
import { useFinance } from '@/context/FinanceContext';
import { dataService } from '@/services/dataService';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  FileDown, Upload, CheckCircle2, AlertCircle, Loader2, FileSpreadsheet,
  ChevronRight, RotateCcw,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ─── Palettes for auto-created items ─────────────────────────────────────────
const CAT_COLORS  = ['#6366f1','#f97316','#22c55e','#ec4899','#0ea5e9','#a855f7','#eab308','#64748b','#14b8a6','#ef4444','#84cc16','#f43f5e'];
const BANK_COLORS = ['#2563eb','#16a34a','#d97706','#dc2626','#7c3aed','#0891b2','#be185d','#065f46'];

// ─── Row types ────────────────────────────────────────────────────────────────
interface ParsedRow {
  rowNum: number;
  date: string;          // YYYY-MM-DD or ''
  description: string;
  type: 'income' | 'expense' | '';
  amount: number;
  status: 'paid' | 'pending' | '';
  category: string;
  subcategory: string;
  bank: string;
  paymentMethod: string;
  notes: string;
  errors: string[];
}

interface ImportResults {
  total: number;
  imported: number;
  skipped: number;
  newCategories: string[];
  newSubcategories: string[];
  newBanks: string[];
  rowErrors: { row: number; msg: string }[];
}

// ─── Parse date: dd/mm/aaaa, dd/mm/aa, ISO, or Excel serial ──────────────────
function parseDate(raw: string): string {
  const s = String(raw ?? '').trim();
  const dmY = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (dmY) {
    const [, d, m, y] = dmY;
    const year = y.length === 2 ? `20${y}` : y;
    return `${year}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const serial = parseInt(s);
  if (!isNaN(serial) && serial > 1000) {
    const d = new Date(Date.UTC(1900, 0, serial - 1));
    const y = d.getUTCFullYear();
    const mo = String(d.getUTCMonth() + 1).padStart(2,'0');
    const dd = String(d.getUTCDate()).padStart(2,'0');
    return `${y}-${mo}-${dd}`;
  }
  return '';
}

// ─── Parse a single spreadsheet row ──────────────────────────────────────────
function parseRow(raw: Record<string, unknown>, rowNum: number): ParsedRow {
  const get = (key: string) => String(raw[key] ?? '').trim();

  const rawType   = get('Tipo').toLowerCase();
  const rawStatus = get('Status').toLowerCase();
  const rawAmount = get('Valor').replace(',', '.');

  const errors: string[] = [];

  const date = parseDate(get('Data'));
  if (!date) errors.push(`Data inválida "${get('Data')}" — use dd/mm/aaaa`);

  const description = get('Descrição');
  if (!description) errors.push('Descrição é obrigatória');

  let type: 'income' | 'expense' | '' = '';
  if (['receita','income'].includes(rawType)) type = 'income';
  else if (['despesa','expense'].includes(rawType)) type = 'expense';
  else errors.push(`Tipo inválido "${get('Tipo')}" — use Receita ou Despesa`);

  const amount = parseFloat(rawAmount);
  if (isNaN(amount) || amount <= 0) errors.push(`Valor inválido "${get('Valor')}" — use número positivo`);

  let status: 'paid' | 'pending' | '' = '';
  if (['pago','paid'].includes(rawStatus)) status = 'paid';
  else if (['pendente','pending'].includes(rawStatus)) status = 'pending';
  else errors.push(`Status inválido "${get('Status')}" — use Pago ou Pendente`);

  const category = get('Categoria');
  if (!category) errors.push('Categoria é obrigatória');

  const pmRaw = get('Método de Pagamento').toLowerCase();
  const pmMap: Record<string,string> = {
    pix:'pix', boleto:'boleto', transferência:'transferência', transferencia:'transferência',
    débito:'débito', debito:'débito', crédito:'crédito', credito:'crédito',
    dinheiro:'dinheiro', cartão:'crédito', cartao:'crédito',
  };
  const paymentMethod = pmMap[pmRaw] ?? pmRaw;

  return {
    rowNum, date, description,
    type, amount: isNaN(amount) ? 0 : amount,
    status, category,
    subcategory: get('Subcategoria'),
    bank:        get('Banco/Conta'),
    paymentMethod, notes: get('Observação'),
    errors,
  };
}

// ─── Parse entire xlsx file → rows ───────────────────────────────────────────
async function parseXlsx(file: File): Promise<ParsedRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const buf = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb  = XLSX.read(buf, { type: 'array' });
        // Prefer "Lançamentos" sheet, else first sheet
        const sheetName = wb.SheetNames.includes('Lançamentos') ? 'Lançamentos' : wb.SheetNames[0];
        const ws = wb.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });
        // Filter completely empty rows (all values empty)
        const nonEmpty = rows.filter(r => Object.values(r).some(v => String(v).trim() !== ''));
        resolve(nonEmpty.map((r, i) => parseRow(r, i + 2))); // +2 because row 1 = headers
      } catch (err) { reject(err); }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

// ─── Generate & download the Excel template ───────────────────────────────────
function generateTemplate() {
  const wb = XLSX.utils.book_new();

  // ── Sheet 1: Lançamentos ──────────────────────────────────────────────────
  const headers = [
    'Data','Descrição','Tipo','Valor','Status',
    'Categoria','Subcategoria','Banco/Conta','Método de Pagamento','Observação',
  ];
  const examples = [
    ['15/07/2025','Salário','Receita',5000.00,'Pago','Salário','','Banco do Brasil','pix','Salário referente a julho'],
    ['10/07/2025','Aluguel','Despesa',1800.00,'Pago','Moradia','Aluguel','Nubank','pix',''],
    ['12/07/2025','Supermercado','Despesa',320.50,'Pago','Alimentação','Mercado','Itaú','débito',''],
    ['18/07/2025','Academia','Despesa',99.90,'Pendente','Saúde','Academia','','boleto',''],
    ['20/07/2025','Freelance design','Receita',1200.00,'Pago','Freelance','','Nubank','pix','Projeto XYZ'],
  ];

  const ws = XLSX.utils.aoa_to_sheet([headers, ...examples]);
  ws['!cols'] = [
    {wch:12},{wch:32},{wch:10},{wch:12},{wch:10},
    {wch:20},{wch:20},{wch:20},{wch:22},{wch:32},
  ];

  // Style header row (bold) via cell styles — basic approach
  headers.forEach((_, ci) => {
    const addr = XLSX.utils.encode_cell({ r: 0, c: ci });
    if (!ws[addr]) ws[addr] = {};
    ws[addr].s = { font: { bold: true }, fill: { fgColor: { rgb: 'EEF2FF' } } };
  });

  XLSX.utils.book_append_sheet(wb, ws, 'Lançamentos');

  // ── Sheet 2: Instruções ───────────────────────────────────────────────────
  const instr = [
    ['MODELO DE IMPORTAÇÃO — MyFinance'],
    [''],
    ['CAMPOS DA PLANILHA'],
    ['Campo','Obrigatório?','Valores aceitos','Observação'],
    ['Data','Sim','dd/mm/aaaa','Ex: 15/07/2025'],
    ['Descrição','Sim','Texto livre','Nome do lançamento'],
    ['Tipo','Sim','Receita   ou   Despesa','Exatamente como escrito (sem acentos ou maiúsculas extras)'],
    ['Valor','Sim','Número positivo','Ex: 1500.00 — use ponto como decimal, não vírgula'],
    ['Status','Sim','Pago   ou   Pendente','Exatamente como escrito'],
    ['Categoria','Sim','Texto livre','Será criada automaticamente se não existir'],
    ['Subcategoria','Não','Texto livre','Será criada dentro da categoria acima se não existir'],
    ['Banco/Conta','Não','Texto livre','Será criada automaticamente se não existir'],
    ['Método de Pagamento','Não','pix / boleto / transferência / débito / crédito / dinheiro',''],
    ['Observação','Não','Texto livre','Qualquer anotação extra'],
    [''],
    ['DICAS IMPORTANTES'],
    ['1. Não renomeie nem altere a ordem das colunas da aba "Lançamentos".'],
    ['2. Linhas completamente em branco são ignoradas.'],
    ['3. Categorias, subcategorias e bancos inexistentes são criados automaticamente.'],
    ['4. O tipo da categoria (Receita/Despesa) é definido pelo campo "Tipo" da primeira transação nessa categoria.'],
    ['5. Você pode apagar as linhas de exemplo e inserir os seus dados nas linhas a partir da linha 2.'],
  ];

  const wsI = XLSX.utils.aoa_to_sheet(instr);
  wsI['!cols'] = [{wch:25},{wch:15},{wch:45},{wch:65}];
  XLSX.utils.book_append_sheet(wb, wsI, 'Instruções');

  XLSX.writeFile(wb, 'modelo-lancamentos-myfinance.xlsx');
}

// ─── Main dialog component ────────────────────────────────────────────────────
interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

type Step = 'idle' | 'preview' | 'importing' | 'done';

export function ImportDataDialog({ open, onOpenChange }: Props) {
  const { categories, subcategories, banks, refreshData } = useFinance();

  const [step, setStep] = useState<Step>('idle');
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<ImportResults | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const validRows   = parsedRows.filter(r => r.errors.length === 0);
  const invalidRows = parsedRows.filter(r => r.errors.length > 0);

  // ── Reset state when dialog closes ───────────────────────────────────────
  const handleOpenChange = (v: boolean) => {
    if (!v) {
      setStep('idle');
      setParsedRows([]);
      setParseError(null);
      setProgress(0);
      setResults(null);
    }
    onOpenChange(v);
  };

  // ── File processing ───────────────────────────────────────────────────────
  const processFile = useCallback(async (file: File) => {
    if (!file.name.match(/\.(xlsx|xls|csv)$/i)) {
      setParseError('Formato não suportado. Use .xlsx, .xls ou .csv');
      return;
    }
    setParseError(null);
    try {
      const rows = await parseXlsx(file);
      if (rows.length === 0) {
        setParseError('Nenhuma linha de dados encontrada na planilha.');
        return;
      }
      setParsedRows(rows);
      setStep('preview');
    } catch {
      setParseError('Erro ao ler o arquivo. Verifique se é um Excel válido.');
    }
  }, []);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = '';
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  // ── Execute import ────────────────────────────────────────────────────────
  const runImport = async () => {
    setStep('importing');
    setProgress(0);

    const results: ImportResults = {
      total: validRows.length, imported: 0, skipped: 0,
      newCategories: [], newSubcategories: [], newBanks: [],
      rowErrors: [],
    };

    // Local lookup maps (normalized lowercase name → id)
    const catMap  = new Map<string, { id: string; type: 'income' | 'expense' }>(
      categories.map(c => [c.name.toLowerCase(), { id: c.id, type: c.type }])
    );
    const subMap  = new Map<string, string>( // "catId::subName" → subId
      subcategories.map(s => [`${s.categoryId}::${s.name.toLowerCase()}`, s.id])
    );
    const bankMap = new Map<string, string>(
      banks.map(b => [b.name.toLowerCase(), b.id])
    );

    let catColorIdx  = CAT_COLORS.findIndex(c => !categories.some(cat => cat.color === c));
    if (catColorIdx < 0) catColorIdx = 0;
    let bankColorIdx = BANK_COLORS.findIndex(c => !banks.some(b => b.color === c));
    if (bankColorIdx < 0) bankColorIdx = 0;

    const total = validRows.length;

    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i];
      setProgress(Math.round((i / total) * 100));

      try {
        // ── Resolve / create category ────────────────────────────────────
        const catKey = row.category.toLowerCase();
        let catId: string;

        if (catMap.has(catKey)) {
          catId = catMap.get(catKey)!.id;
        } else {
          const newCat = await dataService.addCategory({
            name: row.category,
            type: row.type as 'income' | 'expense',
            color: CAT_COLORS[catColorIdx % CAT_COLORS.length],
            icon: 'tag',
            dreGroup: undefined,
          });
          catColorIdx++;
          catMap.set(catKey, { id: newCat.id, type: newCat.type });
          results.newCategories.push(row.category);
          catId = newCat.id;
        }

        // ── Resolve / create subcategory ──────────────────────────────────
        let subcategoryId: string | undefined;
        if (row.subcategory) {
          const subKey = `${catId}::${row.subcategory.toLowerCase()}`;
          if (subMap.has(subKey)) {
            subcategoryId = subMap.get(subKey);
          } else {
            const newSub = await dataService.addSubcategory({
              categoryId: catId,
              name: row.subcategory,
              dreGroup: undefined,
            });
            subMap.set(subKey, newSub.id);
            results.newSubcategories.push(`${row.category} → ${row.subcategory}`);
            subcategoryId = newSub.id;
          }
        }

        // ── Resolve / create bank ─────────────────────────────────────────
        let bankId: string | undefined;
        if (row.bank) {
          const bankKey = row.bank.toLowerCase();
          if (bankMap.has(bankKey)) {
            bankId = bankMap.get(bankKey);
          } else {
            const newBank = await dataService.addBank({
              name: row.bank,
              type: 'corrente',
              initialBalance: 0,
              color: BANK_COLORS[bankColorIdx % BANK_COLORS.length],
              icon: 'building-2',
            });
            bankColorIdx++;
            bankMap.set(bankKey, newBank.id);
            results.newBanks.push(row.bank);
            bankId = newBank.id;
          }
        }

        // ── Create transaction ────────────────────────────────────────────
        await dataService.addTransaction({
          description:   row.description,
          amount:        row.amount,
          type:          row.type as 'income' | 'expense',
          categoryId:    catId,
          subcategoryId: subcategoryId,
          date:          row.date,
          status:        row.status as 'paid' | 'pending',
          paymentMethod: row.paymentMethod || undefined,
          bankId:        bankId,
          notes:         row.notes || undefined,
        });

        results.imported++;
      } catch (err) {
        results.skipped++;
        results.rowErrors.push({
          row: row.rowNum,
          msg: err instanceof Error ? err.message : 'Erro desconhecido',
        });
      }
    }

    setProgress(100);
    await refreshData();
    setResults(results);
    setStep('done');
    toast.success(`${results.imported} lançamentos importados com sucesso!`);
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-full sm:max-w-[680px] max-h-[90vh] p-0 flex flex-col gap-0">
        <DialogHeader className="px-6 py-5 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-primary" />
            Importar Lançamentos via Planilha
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* ── STEP: IDLE ─────────────────────────────────────────────────── */}
          {step === 'idle' && (
            <>
              {/* Download template */}
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <FileDown className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-medium text-sm">1. Baixe o modelo de planilha</p>
                    <p className="text-sm text-muted-foreground">
                      Preencha com seus dados. Categorias, subcategorias e contas serão criadas automaticamente se não existirem.
                    </p>
                  </div>
                </div>
                <Button variant="outline" onClick={generateTemplate} className="gap-2 w-full sm:w-auto">
                  <FileDown className="w-4 h-4" />
                  Baixar modelo (.xlsx)
                </Button>
              </div>

              {/* Colunas esperadas */}
              <div className="rounded-lg border p-4 space-y-3">
                <p className="text-sm font-medium">Colunas da planilha</p>
                <div className="grid grid-cols-2 gap-1.5 text-xs">
                  {[
                    ['Data','dd/mm/aaaa','required'],
                    ['Descrição','Texto livre','required'],
                    ['Tipo','Receita ou Despesa','required'],
                    ['Valor','Número positivo ex: 1500.00','required'],
                    ['Status','Pago ou Pendente','required'],
                    ['Categoria','Criada se não existir','required'],
                    ['Subcategoria','Criada se não existir','optional'],
                    ['Banco/Conta','Criado se não existir','optional'],
                    ['Método de Pagamento','pix, boleto, débito…','optional'],
                    ['Observação','Texto livre','optional'],
                  ].map(([col, hint, req]) => (
                    <div key={col} className="flex items-start gap-1.5">
                      <Badge
                        variant={req === 'required' ? 'default' : 'outline'}
                        className="text-[10px] h-4 px-1 shrink-0 mt-0.5"
                      >
                        {req === 'required' ? 'obrig.' : 'opc.'}
                      </Badge>
                      <span>
                        <span className="font-medium">{col}</span>
                        <span className="text-muted-foreground"> — {hint}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Upload area */}
              <div>
                <p className="text-sm font-medium mb-2">2. Envie a planilha preenchida</p>
                <div
                  className={cn(
                    'border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer',
                    isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/30',
                  )}
                  onClick={() => fileRef.current?.click()}
                  onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={onDrop}
                >
                  <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm font-medium">Clique ou arraste o arquivo aqui</p>
                  <p className="text-xs text-muted-foreground mt-1">.xlsx, .xls ou .csv</p>
                </div>
                <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={onFileChange} />
                {parseError && (
                  <p className="text-sm text-destructive mt-2 flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 shrink-0" /> {parseError}
                  </p>
                )}
              </div>
            </>
          )}

          {/* ── STEP: PREVIEW ─────────────────────────────────────────────── */}
          {step === 'preview' && (
            <>
              {/* Summary counts */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-2xl font-bold text-foreground">{parsedRows.length}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Linhas lidas</p>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-2xl font-bold text-success">{validRows.length}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Prontas para importar</p>
                </div>
                <div className={cn('rounded-lg border p-3 text-center', invalidRows.length > 0 && 'border-destructive/40 bg-destructive/5')}>
                  <p className={cn('text-2xl font-bold', invalidRows.length > 0 ? 'text-destructive' : 'text-foreground')}>{invalidRows.length}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Com erro (serão ignoradas)</p>
                </div>
              </div>

              {/* Preview table */}
              <ScrollArea className="h-[300px] border rounded-lg">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm border-b">
                    <tr>
                      <th className="text-left px-3 py-2 w-8">#</th>
                      <th className="text-left px-3 py-2">Data</th>
                      <th className="text-left px-3 py-2">Descrição</th>
                      <th className="text-left px-3 py-2">Tipo</th>
                      <th className="text-right px-3 py-2">Valor</th>
                      <th className="text-left px-3 py-2">Categoria</th>
                      <th className="text-left px-3 py-2 w-8"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {parsedRows.map(row => (
                      <tr
                        key={row.rowNum}
                        className={cn(
                          'transition-colors',
                          row.errors.length > 0 ? 'bg-destructive/5' : 'hover:bg-muted/30',
                        )}
                        title={row.errors.join(' | ')}
                      >
                        <td className="px-3 py-1.5 text-muted-foreground">{row.rowNum}</td>
                        <td className="px-3 py-1.5 whitespace-nowrap">{row.date ? row.date.split('-').reverse().join('/') : row.date}</td>
                        <td className="px-3 py-1.5 max-w-[160px] truncate">{row.description}</td>
                        <td className="px-3 py-1.5">
                          <Badge variant="outline" className={cn('text-[10px] h-4 px-1', row.type === 'income' ? 'text-success border-success/30' : 'text-destructive border-destructive/30')}>
                            {row.type === 'income' ? 'Receita' : row.type === 'expense' ? 'Despesa' : '?'}
                          </Badge>
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums">
                          {row.amount > 0 ? `R$ ${row.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—'}
                        </td>
                        <td className="px-3 py-1.5 max-w-[120px] truncate">{row.category}</td>
                        <td className="px-3 py-1.5">
                          {row.errors.length > 0
                            ? <AlertCircle className="w-3.5 h-3.5 text-destructive" />
                            : <CheckCircle2 className="w-3.5 h-3.5 text-success" />}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollArea>

              {/* Errors list */}
              {invalidRows.length > 0 && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 space-y-1">
                  <p className="text-xs font-medium text-destructive mb-2">Linhas com erro (serão ignoradas na importação):</p>
                  {invalidRows.map(row => (
                    <div key={row.rowNum} className="text-xs text-destructive/80">
                      <span className="font-medium">Linha {row.rowNum}:</span> {row.errors.join(' · ')}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ── STEP: IMPORTING ───────────────────────────────────────────── */}
          {step === 'importing' && (
            <div className="flex flex-col items-center justify-center py-8 gap-5">
              <Loader2 className="w-10 h-10 text-primary animate-spin" />
              <div className="w-full space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Importando lançamentos…</span>
                  <span className="font-medium tabular-nums">{progress}%</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-primary h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Não feche esta janela durante a importação.</p>
            </div>
          )}

          {/* ── STEP: DONE ────────────────────────────────────────────────── */}
          {step === 'done' && results && (
            <div className="space-y-5">
              <div className="flex flex-col items-center py-4 gap-2">
                <CheckCircle2 className="w-12 h-12 text-success" />
                <p className="text-lg font-semibold">Importação concluída!</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-2xl font-bold text-success">{results.imported}</p>
                  <p className="text-xs text-muted-foreground">Lançamentos importados</p>
                </div>
                <div className={cn('rounded-lg border p-3 text-center', results.skipped > 0 && 'border-destructive/30')}>
                  <p className={cn('text-2xl font-bold', results.skipped > 0 ? 'text-destructive' : 'text-foreground')}>{results.skipped}</p>
                  <p className="text-xs text-muted-foreground">Com falha</p>
                </div>
              </div>

              {(results.newCategories.length > 0 || results.newSubcategories.length > 0 || results.newBanks.length > 0) && (
                <div className="rounded-lg border p-4 space-y-3 text-sm">
                  <p className="font-medium text-sm">Itens criados automaticamente</p>
                  {results.newCategories.length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Categorias ({results.newCategories.length})</p>
                      <div className="flex flex-wrap gap-1.5">
                        {results.newCategories.map(n => <Badge key={n} variant="secondary">{n}</Badge>)}
                      </div>
                    </div>
                  )}
                  {results.newSubcategories.length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Subcategorias ({results.newSubcategories.length})</p>
                      <div className="flex flex-wrap gap-1.5">
                        {results.newSubcategories.map(n => <Badge key={n} variant="secondary">{n}</Badge>)}
                      </div>
                    </div>
                  )}
                  {results.newBanks.length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Contas bancárias ({results.newBanks.length})</p>
                      <div className="flex flex-wrap gap-1.5">
                        {results.newBanks.map(n => <Badge key={n} variant="secondary">{n}</Badge>)}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {results.rowErrors.length > 0 && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 space-y-1">
                  <p className="text-xs font-medium text-destructive mb-1">Erros durante a importação:</p>
                  {results.rowErrors.map(e => (
                    <p key={e.row} className="text-xs text-destructive/80">
                      <span className="font-medium">Linha {e.row}:</span> {e.msg}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Footer ───────────────────────────────────────────────────────── */}
        <div className="px-6 py-4 border-t shrink-0 bg-background">
          <DialogFooter className="pt-0">
            {step === 'idle' && (
              <Button variant="outline" onClick={() => handleOpenChange(false)}>Fechar</Button>
            )}

            {step === 'preview' && (
              <>
                <Button variant="outline" onClick={() => { setStep('idle'); setParsedRows([]); }}>
                  <RotateCcw className="w-4 h-4 mr-2" /> Trocar arquivo
                </Button>
                <Button onClick={runImport} disabled={validRows.length === 0}>
                  <ChevronRight className="w-4 h-4 mr-2" />
                  Importar {validRows.length} lançamento{validRows.length !== 1 ? 's' : ''}
                </Button>
              </>
            )}

            {step === 'importing' && (
              <Button variant="outline" disabled>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Importando…
              </Button>
            )}

            {step === 'done' && (
              <Button onClick={() => handleOpenChange(false)}>Fechar</Button>
            )}
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
