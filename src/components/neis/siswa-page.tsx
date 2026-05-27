'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, Edit, Trash2, Search, Download, Upload, RotateCcw, ArrowUpCircle, CheckCircle2, XCircle, AlertTriangle, FileSpreadsheet, Loader2, Users, GraduationCap, UserX, ArrowRightLeft, BadgeCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Progress } from '@/components/ui/progress';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { usePagination } from '@/hooks/use-pagination';
import { PaginationBar } from '@/components/neis/pagination-bar';

export function SiswaPage() {
  const { toast } = useToast();
  const [data, setData] = useState<any[]>([]);
  const [kelasList, setKelasList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterKelasId, setFilterKelasId] = useState('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Form
  const [formOpen, setFormOpen] = useState(false);
  const [editData, setEditData] = useState<any>(null);
  const [formNis, setFormNis] = useState('');
  const [formNisn, setFormNisn] = useState('');
  const [formNama, setFormNama] = useState('');
  const [formKelasId, setFormKelasId] = useState('');
  const [formJenisKelamin, setFormJenisKelamin] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  // Delete → Status change
  const [statusChangeOpen, setStatusChangeOpen] = useState(false);
  const [statusChangeId, setStatusChangeId] = useState<string | null>(null);
  const [bulkStatusOpen, setBulkStatusOpen] = useState(false);
  const [bulkStatusType, setBulkStatusType] = useState<'berhenti' | 'pindah'>('berhenti');
  const [resetOpen, setResetOpen] = useState(false);

  // Kelulusan
  const [kelulusanOpen, setKelulusanOpen] = useState(false);
  const [kelulusanSelected, setKelulusanSelected] = useState<string[]>([]);
  const [kelulusanConfirmOpen, setKelulusanConfirmOpen] = useState(false);
  const [kelulusanLoading, setKelulusanLoading] = useState(false);

  // Kenaikan kelas
  const [kenaikanOpen, setKenaikanOpen] = useState(false);
  const [kenaikanMapping, setKenaikanMapping] = useState<Record<string, string>>({});
  const [kenaikanNewClasses, setKenaikanNewClasses] = useState<Record<string, string>>({}); // sourceKelasId -> new class name
  const [kenaikanConfirmOpen, setKenaikanConfirmOpen] = useState(false);
  const [kenaikanLoading, setKenaikanLoading] = useState(false);

  // Pagination
  const { pageSize, setPageSize, currentPage, setCurrentPage, totalPages, pageStart, pageEnd, paginatedData } = usePagination(data.length);
  const currentData = paginatedData(data);

  // Import/Export
  const importRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importTotal, setImportTotal] = useState(0);
  const [importProcessed, setImportProcessed] = useState(0);
  const [importSuccess, setImportSuccess] = useState(0);
  const [importDuplicates, setImportDuplicates] = useState(0);
  const [importFailed, setImportFailed] = useState(0);
  const [importErrors, setImportErrors] = useState<any[]>([]);
  const [importDone, setImportDone] = useState(false);
  const [importSteps, setImportSteps] = useState<{ step: string; status: 'processing' | 'done' | 'warning' | 'error'; detail?: string }[]>([]);
  const [importVerifyResult, setImportVerifyResult] = useState<any>(null);
  const [importConfirmOpen, setImportConfirmOpen] = useState(false);
  const [importPendingItems, setImportPendingItems] = useState<any[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      let url = '/api/siswa?';
      if (filterKelasId && filterKelasId !== 'all' && ['berhenti', 'pindah', 'lulus'].includes(filterKelasId)) {
        url += `status=${filterKelasId}`;
      } else if (filterKelasId && filterKelasId !== 'all') {
        url += `kelas_id=${filterKelasId}`;
      }
      const res = await fetch(url, { credentials: 'include' });
      if (res.ok) {
        const result = await res.json();
        let items = result.data || [];
        if (search) {
          items = items.filter(
            (s: any) =>
              s.nama.toLowerCase().includes(search.toLowerCase()) ||
              s.nis.toLowerCase().includes(search.toLowerCase()) ||
              s.nisn.toLowerCase().includes(search.toLowerCase())
          );
        }
        setData(items);
      }
    } finally { setLoading(false); }
  }, [filterKelasId, search]);

  const fetchKelas = useCallback(async () => {
    try {
      const res = await fetch('/api/kelas', { credentials: 'include' });
      if (res.ok) setKelasList((await res.json()).data || []);
    } catch {}
  }, []);

  useEffect(() => { fetchData(); fetchKelas(); }, [fetchData, fetchKelas]);

  const openAdd = () => {
    setEditData(null);
    setFormNis(''); setFormNisn(''); setFormNama(''); setFormKelasId(''); setFormJenisKelamin('');
    setFormOpen(true);
  };

  const openEdit = (item: any) => {
    setEditData(item);
    setFormNis(item.nis); setFormNisn(item.nisn); setFormNama(item.nama);
    setFormKelasId(item.kelas_id || ''); setFormJenisKelamin(item.jenis_kelamin || '');
    setFormOpen(true);
  };

  const handleSubmit = async () => {
    if (!formNis || !formNisn || !formNama) {
      toast({ title: 'Error', description: 'NIS, NISN, dan nama wajib diisi', variant: 'destructive' });
      return;
    }
    // For active students or reactivating, kelas is required
    const isNonActive = editData && ['berhenti', 'pindah', 'lulus'].includes(editData.status);
    if (!formKelasId && !isNonActive) {
      toast({ title: 'Error', description: 'Kelas wajib diisi', variant: 'destructive' });
      return;
    }
    setFormLoading(true);
    try {
      if (editData) {
        const updateBody: any = { id: editData.id, nis: formNis, nisn: formNisn, nama: formNama, jenis_kelamin: formJenisKelamin || null };
        if (formKelasId) {
          updateBody.kelas_id = formKelasId;
          // If student was non-active and gets a class, reactivate them
          if (['berhenti', 'pindah', 'lulus'].includes(editData.status)) {
            updateBody.status = 'aktif';
          }
        }
        // If non-active student and no class selected, keep their existing kelas_id
        const res = await fetch('/api/siswa', {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updateBody),
          credentials: 'include',
        });
        const data = await res.json();
        if (!res.ok) { toast({ title: 'Gagal', description: data.error, variant: 'destructive' }); return; }
        toast({ title: 'Berhasil', description: 'Siswa berhasil diperbarui' });
      } else {
        if (!formKelasId) {
          toast({ title: 'Error', description: 'Kelas wajib diisi untuk siswa baru', variant: 'destructive' });
          setFormLoading(false);
          return;
        }
        const res = await fetch('/api/siswa', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nis: formNis, nisn: formNisn, nama: formNama, kelas_id: formKelasId, jenis_kelamin: formJenisKelamin || null }),
          credentials: 'include',
        });
        const data = await res.json();
        if (!res.ok) { toast({ title: 'Gagal', description: data.error, variant: 'destructive' }); return; }
        toast({ title: 'Berhasil', description: 'Siswa berhasil ditambahkan' });
      }
      setFormOpen(false); fetchData();
    } catch { toast({ title: 'Error', description: 'Terjadi kesalahan', variant: 'destructive' }); }
    finally { setFormLoading(false); }
  };

  const handleStatusChange = async (newStatus: 'berhenti' | 'pindah') => {
    const targetId = statusChangeId;
    if (!targetId) return;
    try {
      const res = await fetch('/api/siswa?action=ubah-status', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [targetId], status: newStatus }), credentials: 'include',
      });
      const result = await res.json();
      if (!res.ok) { toast({ title: 'Gagal', description: result.error, variant: 'destructive' }); return; }
      const label = newStatus === 'berhenti' ? 'berhenti' : 'pindah';
      toast({ title: 'Berhasil', description: `Siswa dinyatakan ${label}` });
      setStatusChangeOpen(false); setStatusChangeId(null); setSelectedIds(prev => prev.filter(i => i !== targetId)); fetchData();
    } catch { toast({ title: 'Error', description: 'Terjadi kesalahan', variant: 'destructive' }); }
  };

  const handleBulkStatusChange = async () => {
    try {
      const res = await fetch('/api/siswa?action=ubah-status', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds, status: bulkStatusType }), credentials: 'include',
      });
      const result = await res.json();
      if (!res.ok) { toast({ title: 'Gagal', description: result.error, variant: 'destructive' }); return; }
      const label = bulkStatusType === 'berhenti' ? 'berhenti' : 'pindah';
      toast({ title: 'Berhasil', description: `${result.totalUpdated} siswa dinyatakan ${label}` });
      setSelectedIds([]); setBulkStatusOpen(false); fetchData();
    } catch { toast({ title: 'Error', description: 'Terjadi kesalahan', variant: 'destructive' }); }
  };

  const handleKelulusan = async () => {
    setKelulusanLoading(true);
    try {
      const res = await fetch('/api/siswa?action=kelulusan', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kelas_ids: kelulusanSelected }), credentials: 'include',
      });
      const result = await res.json();
      if (!res.ok) { toast({ title: 'Gagal', description: result.error, variant: 'destructive' }); setKelulusanLoading(false); return; }
      toast({ title: 'Berhasil', description: result.message });
      setKelulusanConfirmOpen(false); setKelulusanOpen(false); setKelulusanSelected([]); fetchData();
    } catch { toast({ title: 'Error', description: 'Terjadi kesalahan', variant: 'destructive' }); }
    finally { setKelulusanLoading(false); }
  };

  const handleReset = async () => {
    try {
      const res = await fetch('/api/siswa?action=reset', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: 'RESET_ALL_SISWA' }), credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) { toast({ title: 'Gagal', description: data.error, variant: 'destructive' }); return; }
      toast({ title: 'Berhasil', description: 'Semua data siswa berhasil dihapus' });
      setResetOpen(false); fetchData();
    } catch { toast({ title: 'Error', description: 'Terjadi kesalahan', variant: 'destructive' }); }
  };

  // Compute kenaikan preview data
  const kenaikanPreview = (() => {
    const validMappings: { oldKelasId: string; oldKelasName: string; newKelasId: string; newKelasName: string; studentCount: number; isNewClass: boolean }[] = [];
    const skipped: string[] = [];
    let hasEmpty = false;
    const newClassNames: string[] = [];

    for (const [oldKelasId, newKelasId] of Object.entries(kenaikanMapping)) {
      if (!newKelasId || newKelasId === '__none__') { hasEmpty = true; continue; }
      const oldKelas = kelasList.find((k: any) => k.id === oldKelasId);
      if (!oldKelas) continue;

      // Handle new class creation
      if (newKelasId === '__new__') {
        const newClassName = kenaikanNewClasses[oldKelasId]?.trim();
        if (!newClassName) continue;
        // Check if class name already exists
        const existingClass = kelasList.find((k: any) => k.nama_kelas.toLowerCase() === newClassName.toLowerCase());
        if (existingClass) {
          // Use existing class instead
          if (oldKelasId === existingClass.id) {
            skipped.push(oldKelas.nama_kelas);
            continue;
          }
          const studentCount = data.filter((s: any) => s.kelas_id === oldKelasId).length;
          validMappings.push({
            oldKelasId, oldKelasName: oldKelas.nama_kelas,
            newKelasId: existingClass.id, newKelasName: existingClass.nama_kelas, studentCount, isNewClass: false,
          });
        } else {
          const studentCount = data.filter((s: any) => s.kelas_id === oldKelasId).length;
          validMappings.push({
            oldKelasId, oldKelasName: oldKelas.nama_kelas,
            newKelasId: '__new__', newKelasName: newClassName, studentCount, isNewClass: true,
          });
          newClassNames.push(newClassName);
        }
        continue;
      }

      const newKelas = kelasList.find((k: any) => k.id === newKelasId);
      if (!newKelas) continue;

      if (oldKelasId === newKelasId) {
        skipped.push(oldKelas.nama_kelas);
        continue;
      }

      const studentCount = data.filter((s: any) => s.kelas_id === oldKelasId).length;
      validMappings.push({
        oldKelasId, oldKelasName: oldKelas.nama_kelas,
        newKelasId, newKelasName: newKelas.nama_kelas, studentCount, isNewClass: false,
      });
    }

    const totalAffected = validMappings.reduce((sum, m) => sum + m.studentCount, 0);
    return { validMappings, skipped, hasEmpty, totalAffected, hasValidMappings: validMappings.length > 0, newClassNames };
  })();

  const handleKenaikanKelas = async () => {
    setKenaikanLoading(true);
    try {
      const cleanMapping: Record<string, string> = {};
      const newClasses: Record<string, string> = {}; // sourceKelasId -> new class name
      for (const [key, val] of Object.entries(kenaikanMapping)) {
        if (val && val !== '__none__') {
          cleanMapping[key] = val;
          if (val === '__new__' && kenaikanNewClasses[key]?.trim()) {
            newClasses[key] = kenaikanNewClasses[key].trim();
          }
        }
      }
      const res = await fetch('/api/siswa?action=kenaikan-kelas', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mapping: cleanMapping, newClasses }), credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) { toast({ title: 'Gagal', description: data.error, variant: 'destructive' }); setKenaikanLoading(false); return; }

      // Show success with details
      const details = data.details || [];
      const detailMsg = details.length > 0
        ? details.map((d: any) => `${d.from} → ${d.to} (${d.count} siswa)`).join(', ')
        : '';
      const warningMsg = data.warnings?.length > 0 ? ` Peringatan: ${data.warnings.join('; ')}` : '';

      toast({ title: 'Berhasil', description: `${data.message}${detailMsg ? ' Detail: ' + detailMsg : ''}${warningMsg}` });
      setKenaikanConfirmOpen(false);
      setKenaikanOpen(false);
      setKenaikanMapping({});
      setKenaikanNewClasses({});
      fetchData();
      fetchKelas();
    } catch { toast({ title: 'Error', description: 'Terjadi kesalahan', variant: 'destructive' }); }
    finally { setKenaikanLoading(false); }
  };

  const handleExportExcel = async () => {
    const XLSX = await import('xlsx');
    const wsData = [['NIS', 'NISN', 'Nama', 'Kelas', 'Jenis Kelamin', 'Status']];
    data.forEach((d) => {
      const statusLabel = d.status === 'berhenti' ? 'Berhenti' : d.status === 'pindah' ? 'Pindah' : d.status === 'lulus' ? 'Lulus' : 'Aktif';
      wsData.push([d.nis, d.nisn, d.nama, d.nama_kelas || '-', d.jenis_kelamin || '', statusLabel]);
    });
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, 'Siswa');
    XLSX.writeFile(wb, 'data-siswa.xlsx');
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset import state
    setImporting(true);
    setImportProgress(0);
    setImportTotal(0);
    setImportProcessed(0);
    setImportSuccess(0);
    setImportDuplicates(0);
    setImportFailed(0);
    setImportErrors([]);
    setImportDone(false);
    setImportSteps([{ step: 'Membaca file Excel...', status: 'processing' }]);
    setImportVerifyResult(null);
    setImportPendingItems([]);

    try {
      const XLSX = await import('xlsx');
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

      setImportSteps(prev => [...prev, { step: 'Membaca file Excel...', status: 'done', detail: `${rows.length - 1} baris data` }]);
      setImportSteps(prev => [...prev, { step: 'Memvalidasi format data...', status: 'processing' }]);

      // Parse rows, skip header
      const items: any[] = [];
      const skippedRows: any[] = [];
      for (let i = 1; i < rows.length; i++) {
        const [nis, nisn, nama, namaKelas, jk] = rows[i];
        if (!nis || !nisn || !nama) {
          skippedRows.push({ row: i + 1, nis: String(nis || '-'), nama: String(nama || '-'), error: 'Data tidak lengkap (NIS/NISN/Nama kosong)' });
          continue;
        }
        const kelas = kelasList.find((k: any) => k.nama_kelas === String(namaKelas));
        if (!kelas) {
          skippedRows.push({ row: i + 1, nis: String(nis), nama: String(nama), error: `Kelas "${namaKelas}" tidak ditemukan` });
          continue;
        }
        items.push({
          nis: String(nis), nisn: String(nisn), nama: String(nama),
          namaKelas: String(namaKelas), kelas_id: kelas.id, jenis_kelamin: jk || null,
        });
      }

      if (skippedRows.length > 0) {
        setImportSteps(prev => [...prev, { step: 'Memvalidasi format data...', status: 'warning', detail: `${skippedRows.length} baris dilewati` }]);
      } else {
        setImportSteps(prev => [...prev, { step: 'Memvalidasi format data...', status: 'done', detail: `${items.length} data valid` }]);
      }

      if (items.length === 0) {
        setImporting(false);
        setImportDone(true);
        setImportErrors(skippedRows);
        setImportFailed(skippedRows.length);
        setImportSteps(prev => [...prev, { step: 'Import selesai', status: 'error', detail: 'Tidak ada data valid' }]);
        toast({ title: 'Import Gagal', description: 'Tidak ada data valid untuk diimpor', variant: 'destructive' });
        e.target.value = '';
        return;
      }

      // Pre-verify against existing database
      setImportSteps(prev => [...prev, { step: 'Memverifikasi data duplikat...', status: 'processing' }]);

      const verifyRes = await fetch('/api/siswa?action=verify-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
        credentials: 'include',
      });

      if (!verifyRes.ok) {
        setImportSteps(prev => [...prev, { step: 'Verifikasi gagal', status: 'error' }]);
        setImporting(false);
        setImportDone(true);
        toast({ title: 'Error', description: 'Gagal memverifikasi data', variant: 'destructive' });
        e.target.value = '';
        return;
      }

      const verifyResult = await verifyRes.json();
      setImportVerifyResult(verifyResult);

      const dupCount = verifyResult.duplicateCount || 0;
      const invalidCount = verifyResult.invalidCount || 0;
      const newCount = verifyResult.newCount || 0;

      if (dupCount > 0) {
        setImportSteps(prev => [...prev, { step: 'Memverifikasi data duplikat...', status: 'warning', detail: `${dupCount} data sudah ada, ${newCount} data baru` }]);
      } else {
        setImportSteps(prev => [...prev, { step: 'Memverifikasi data duplikat...', status: 'done', detail: `Semua ${newCount} data baru` }]);
      }

      if (newCount === 0) {
        setImporting(false);
        setImportDone(true);
        setImportFailed(skippedRows.length + invalidCount);
        setImportDuplicates(dupCount);
        setImportErrors([
          ...skippedRows,
          ...verifyResult.duplicates.map((d: any) => ({ nis: d.nis, nama: d.nama, error: d.reason, type: 'duplikat' as const })),
        ]);
        setImportSteps(prev => [...prev, { step: 'Import selesai', status: 'warning', detail: 'Semua data sudah ada, tidak ada yang diimpor' }]);
        toast({ title: 'Import Dilewati', description: 'Semua data sudah ada di database, tidak ada data baru yang diimpor', variant: 'destructive' });
        e.target.value = '';
        return;
      }

      // Store pending items and show confirmation
      setImportPendingItems(verifyResult.newItems.map((item: any) => ({
        nis: item.nis, nisn: item.nisn, nama: item.nama,
        kelas_id: item.kelas_id, jenis_kelamin: item.jenis_kelamin,
      })));
      setImportTotal(newCount);
      setImporting(false);
      setImportConfirmOpen(true);

    } catch {
      toast({ title: 'Error', description: 'Gagal membaca file Excel', variant: 'destructive' });
      setImportSteps(prev => [...prev, { step: 'Gagal membaca file', status: 'error' }]);
      setImporting(false);
      setImportDone(true);
    }
    e.target.value = '';
  };

  const executeImport = async () => {
    setImportConfirmOpen(false);
    setImporting(true);
    setImportProgress(0);
    setImportProcessed(0);
    setImportSuccess(0);
    setImportDuplicates(importVerifyResult?.duplicateCount || 0);
    setImportFailed(importVerifyResult?.invalidCount || 0);
    setImportErrors([
      ...(importVerifyResult?.duplicates || []).map((d: any) => ({ nis: d.nis, nama: d.nama, error: d.reason, type: 'duplikat' as const })),
    ]);

    const items = importPendingItems;
    if (items.length === 0) {
      setImporting(false);
      setImportDone(true);
      return;
    }

    // Send in batches of 50
    const BATCH_SIZE = 50;
    const totalBatches = Math.ceil(items.length / BATCH_SIZE);
    let totalSuccess = 0;
    let totalFailed = 0;
    const allErrors = [...(importVerifyResult?.duplicates || []).map((d: any) => ({ nis: d.nis, nama: d.nama, error: d.reason, type: 'duplikat' as const }))];

    setImportSteps(prev => [...prev, { step: `Mengimpor ${items.length} data baru...`, status: 'processing' }]);

    for (let batch = 0; batch < items.length; batch += BATCH_SIZE) {
      const batchNum = Math.floor(batch / BATCH_SIZE) + 1;
      const batchItems = items.slice(batch, batch + BATCH_SIZE);

      setImportSteps(prev => [...prev, { step: `Mengimpor batch ${batchNum}/${totalBatches}...`, status: 'processing', detail: `${batchItems.length} data` }]);

      const res = await fetch('/api/siswa?action=bulk-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: batchItems }),
        credentials: 'include',
      });

      const processed = Math.min(batch + BATCH_SIZE, items.length);
      setImportProcessed(processed);
      setImportProgress(Math.round((processed / items.length) * 100));

      if (res.ok) {
        const result = await res.json();
        totalSuccess += result.successCount || 0;
        totalFailed += result.failedCount || 0;
        setImportSuccess(totalSuccess);
        setImportFailed(totalFailed + (importVerifyResult?.invalidCount || 0));

        const batchStatus = result.failedCount > 0 ? 'warning' : 'done';
        const batchDetail = `✓${result.successCount || 0} gagal:${result.failedCount || 0}`;
        setImportSteps(prev => [...prev, { step: `Batch ${batchNum}/${totalBatches}`, status: batchStatus, detail: batchDetail }]);

        if (result.failed?.length > 0) {
          allErrors.push(...result.failed.map((f: any) => ({ ...f, type: 'gagal' as const })));
        }
        setImportErrors(allErrors);
      } else {
        totalFailed += batchItems.length;
        setImportFailed(totalFailed);
        setImportSteps(prev => [...prev, { step: `Batch ${batchNum}/${totalBatches}`, status: 'error', detail: 'Gagal diproses' }]);
        allErrors.push({ error: `Batch gagal diproses`, type: 'gagal' as const });
        setImportErrors(allErrors);
      }
    }

    const finalStatus = totalFailed > 0 ? 'warning' : 'done';
    const dupCount = importVerifyResult?.duplicateCount || 0;
    const finalDetail = `${totalSuccess} berhasil, ${dupCount} sudah ada (dilewati), ${totalFailed} gagal`;
    setImportSteps(prev => [...prev, { step: 'Import selesai', status: finalStatus, detail: finalDetail }]);
    setImportDone(true);
    setImporting(false);
    setImportProgress(100);
    fetchData();

    if (totalFailed === 0 && dupCount === 0) {
      toast({ title: 'Import Berhasil', description: `${totalSuccess} data siswa berhasil diimpor` });
    } else if (totalSuccess > 0) {
      toast({ title: 'Import Selesai', description: `${totalSuccess} berhasil, ${dupCount} sudah ada (dilewati), ${totalFailed} gagal` });
    } else {
      toast({ title: 'Import Gagal', description: 'Semua data gagal diimpor', variant: 'destructive' });
    }
  };

  const toggleSelect = (id: string) => setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  const toggleAll = () => {
    const pageIds = currentData.map((d: any) => d.id);
    const allPageSelected = pageIds.every((id: string) => selectedIds.includes(id));
    if (allPageSelected) {
      setSelectedIds(prev => prev.filter(i => !pageIds.includes(i)));
    } else {
      setSelectedIds(prev => [...new Set([...prev, ...pageIds])]);
    }
  };

  // Compute per-class stats
  const kelasStats = kelasList.map((k: any) => {
    const kelasSiswa = data.filter((s: any) => s.kelas_id === k.id);
    const laki = kelasSiswa.filter((s: any) => s.jenis_kelamin?.toLowerCase() === 'laki-laki').length;
    const perempuan = kelasSiswa.filter((s: any) => s.jenis_kelamin?.toLowerCase() === 'perempuan').length;
    return { ...k, total: kelasSiswa.length, laki, perempuan };
  }).filter((k: any) => k.total > 0).sort((a: any, b: any) => a.nama_kelas.localeCompare(b.nama_kelas));

  const totalLaki = data.filter((s: any) => s.jenis_kelamin?.toLowerCase() === 'laki-laki').length;
  const totalPerempuan = data.filter((s: any) => s.jenis_kelamin?.toLowerCase() === 'perempuan').length;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold">Siswa</h1>
          {!loading && data.length > 0 && (
            <Popover>
              <PopoverTrigger asChild>
                <button className="text-sm bg-ocean/10 text-ocean px-2.5 py-0.5 rounded-full font-medium hover:bg-ocean/20 transition-colors flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" />
                  {data.length} siswa
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0" align="start">
                <div className="p-3 border-b">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm">Jumlah Siswa</span>
                    <span className="text-sm font-bold text-ocean">{data.length}</span>
                  </div>
                  <div className="flex gap-3 mt-1.5 text-xs text-muted-foreground">
                    <span className="text-blue-600">♂ L: {totalLaki}</span>
                    <span className="text-pink-600">♀ P: {totalPerempuan}</span>
                  </div>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {kelasStats.map((k: any) => (
                    <div key={k.id} className="flex items-center justify-between px-3 py-2 hover:bg-accent/50 text-sm border-b last:border-b-0">
                      <span className="font-medium">{k.nama_kelas}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-blue-600">♂ {k.laki}</span>
                        <span className="text-xs text-pink-600">♀ {k.perempuan}</span>
                        <span className="font-bold text-ocean min-w-[24px] text-right">{k.total}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          {selectedIds.length > 0 && (
            <>
              <Button variant="outline" size="sm" onClick={() => { setBulkStatusType('berhenti'); setBulkStatusOpen(true); }} className="text-amber-600 border-amber-300 hover:bg-amber-50">
                <UserX className="h-4 w-4 mr-1" /> Berhenti ({selectedIds.length})
              </Button>
              <Button variant="outline" size="sm" onClick={() => { setBulkStatusType('pindah'); setBulkStatusOpen(true); }} className="text-blue-600 border-blue-300 hover:bg-blue-50">
                <ArrowRightLeft className="h-4 w-4 mr-1" /> Pindah ({selectedIds.length})
              </Button>
            </>
          )}
          <Button variant="outline" size="sm" onClick={() => setKenaikanOpen(true)}>
            <ArrowUpCircle className="h-4 w-4 mr-1" /> Kenaikan Kelas
          </Button>
          <Button variant="outline" size="sm" onClick={() => setKelulusanOpen(true)}>
            <GraduationCap className="h-4 w-4 mr-1" /> Kelulusan
          </Button>
          <Button variant="outline" size="sm" onClick={() => setResetOpen(true)}>
            <RotateCcw className="h-4 w-4 mr-1" /> Reset
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportExcel}>
            <Download className="h-4 w-4 mr-1" /> Export
          </Button>
          <Button variant="outline" size="sm" onClick={() => importRef.current?.click()}>
            <Upload className="h-4 w-4 mr-1" /> Import
          </Button>
          <input ref={importRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImportExcel} />
          <Button onClick={openAdd} size="sm" className="bg-ocean hover:bg-ocean-dark text-white">
            <Plus className="h-4 w-4 mr-1" /> Tambah
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Cari siswa..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterKelasId} onValueChange={setFilterKelasId}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Filter siswa" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Kelas</SelectItem>
            {kelasList.map((k: any) => (
              <SelectItem key={k.id} value={k.id}>{k.nama_kelas}</SelectItem>
            ))}
            <SelectItem value="berhenti">🟡 Berhenti</SelectItem>
            <SelectItem value="pindah">🔵 Pindah</SelectItem>
            <SelectItem value="lulus">🟢 Lulus</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card><CardContent className="p-0">
        {loading ? <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-ocean" /></div> :
        data.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">Belum ada data siswa</p> :
        <>
        <div className="overflow-x-auto"><Table>
          <TableHeader><TableRow>
            <TableHead className="w-10"><Checkbox checked={currentData.length > 0 && currentData.every((d: any) => selectedIds.includes(d.id))} onCheckedChange={toggleAll} /></TableHead>
            <TableHead>NIS</TableHead><TableHead>NISN</TableHead><TableHead>Nama</TableHead><TableHead>Kelas</TableHead><TableHead>JK</TableHead><TableHead>Status</TableHead><TableHead>Aksi</TableHead>
          </TableRow></TableHeader>
          <TableBody>{currentData.map((d: any) => {
            const statusLabel = d.status === 'berhenti' ? 'Berhenti' : d.status === 'pindah' ? 'Pindah' : d.status === 'lulus' ? 'Lulus' : '';
            const statusColor = d.status === 'berhenti' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300' : d.status === 'pindah' ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300' : d.status === 'lulus' ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300' : '';
            return (
            <TableRow key={d.id}>
              <TableCell><Checkbox checked={selectedIds.includes(d.id)} onCheckedChange={() => toggleSelect(d.id)} /></TableCell>
              <TableCell>{d.nis}</TableCell><TableCell>{d.nisn}</TableCell>
              <TableCell>{d.nama}</TableCell><TableCell>{d.nama_kelas || '-'}</TableCell>
              <TableCell>{d.jenis_kelamin || '-'}</TableCell>
              <TableCell>{statusLabel ? <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${statusColor}`}>{statusLabel}</span> : <span className="text-xs text-muted-foreground">Aktif</span>}</TableCell>
              <TableCell><div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(d)}><Edit className="h-3.5 w-3.5" /></Button>
                {(!d.status || d.status === 'aktif') && (
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => { setStatusChangeId(d.id); setStatusChangeOpen(true); }}><Trash2 className="h-3.5 w-3.5" /></Button>
                )}
              </div></TableCell>
            </TableRow>
            );
          })}</TableBody>
        </Table></div>
        {/* Pagination */}
        <PaginationBar
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={data.length}
          pageStart={pageStart}
          pageEnd={pageEnd}
          onPageChange={setCurrentPage}
        />
        </>}
      </CardContent></Card>

      {/* Add/Edit Form */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}><DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{editData ? 'Edit Siswa' : 'Tambah Siswa'}</DialogTitle></DialogHeader>
        {editData && ['berhenti', 'pindah', 'lulus'].includes(editData.status) && (
          <div className={`p-2.5 rounded-lg text-xs ${editData.status === 'berhenti' ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800' : editData.status === 'pindah' ? 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800' : 'bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800'}`}>
            Status siswa: <strong>{editData.status === 'berhenti' ? 'Berhenti' : editData.status === 'pindah' ? 'Pindah' : 'Lulus'}</strong>. Pilih kelas untuk mengaktifkan kembali.
          </div>
        )}
        <div className="space-y-4">
          <div className="space-y-2"><Label>NIS</Label><Input value={formNis} onChange={(e) => setFormNis(e.target.value)} placeholder="Masukkan NIS" /></div>
          <div className="space-y-2"><Label>NISN</Label><Input value={formNisn} onChange={(e) => setFormNisn(e.target.value)} placeholder="Masukkan NISN" /></div>
          <div className="space-y-2"><Label>Nama</Label><Input value={formNama} onChange={(e) => setFormNama(e.target.value)} placeholder="Masukkan nama" /></div>
          <div className="space-y-2"><Label>Kelas{editData && ['berhenti', 'pindah', 'lulus'].includes(editData.status) && ' (opsional - isi untuk mengaktifkan kembali)'}</Label>
            <Select value={formKelasId} onValueChange={setFormKelasId}>
              <SelectTrigger><SelectValue placeholder="Pilih kelas" /></SelectTrigger>
              <SelectContent>{kelasList.map((k: any) => <SelectItem key={k.id} value={k.id}>{k.nama_kelas}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2"><Label>Jenis Kelamin</Label>
            <Select value={formJenisKelamin} onValueChange={setFormJenisKelamin}>
              <SelectTrigger><SelectValue placeholder="Pilih" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Laki-laki">Laki-laki</SelectItem>
                <SelectItem value="Perempuan">Perempuan</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => setFormOpen(false)}>Batal</Button><Button onClick={handleSubmit} disabled={formLoading} className="bg-ocean hover:bg-ocean-dark text-white">{formLoading ? 'Menyimpan...' : 'Simpan'}</Button></DialogFooter>
      </DialogContent></Dialog>

      {/* Status Change - Single Student */}
      <AlertDialog open={statusChangeOpen} onOpenChange={(open) => { setStatusChangeOpen(open); if (!open) setStatusChangeId(null); }}><AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2"><Trash2 className="h-5 w-5 text-destructive" />Ubah Status Siswa</AlertDialogTitle>
          <AlertDialogDescription>Pilih status untuk siswa ini. Data siswa tidak akan dihapus, hanya statusnya yang berubah. Siswa akan keluar dari kelas.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <AlertDialogCancel>Batal</AlertDialogCancel>
          <AlertDialogAction onClick={() => handleStatusChange('berhenti')} className="bg-amber-600 hover:bg-amber-700 text-white">
            <UserX className="h-4 w-4 mr-1.5" /> Berhenti
          </AlertDialogAction>
          <AlertDialogAction onClick={() => handleStatusChange('pindah')} className="bg-blue-600 hover:bg-blue-700 text-white">
            <ArrowRightLeft className="h-4 w-4 mr-1.5" /> Pindah
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent></AlertDialog>

      {/* Bulk Status Change */}
      <AlertDialog open={bulkStatusOpen} onOpenChange={setBulkStatusOpen}><AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Ubah Status {selectedIds.length} Siswa?</AlertDialogTitle>
          <AlertDialogDescription>
            {bulkStatusType === 'berhenti' ? 'Siswa akan dinyatakan berhenti dan keluar dari kelas.' : 'Siswa akan dinyatakan pindah dan keluar dari kelas.'} Data siswa tidak dihapus dan bisa diaktifkan kembali melalui edit.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel>Batal</AlertDialogCancel><AlertDialogAction onClick={handleBulkStatusChange} className={bulkStatusType === 'berhenti' ? 'bg-amber-600 hover:bg-amber-700 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'}>
          {bulkStatusType === 'berhenti' ? <><UserX className="h-4 w-4 mr-1.5" /> Ya, Berhenti</> : <><ArrowRightLeft className="h-4 w-4 mr-1.5" /> Ya, Pindah</>}
        </AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent></AlertDialog>

      {/* Reset */}
      <AlertDialog open={resetOpen} onOpenChange={setResetOpen}><AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>Reset Data Siswa?</AlertDialogTitle><AlertDialogDescription>Semua data siswa akan dihapus permanen. Tindakan ini tidak dapat dibatalkan!</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel>Batal</AlertDialogCancel><AlertDialogAction onClick={handleReset} className="bg-destructive text-destructive-foreground">Reset Semua</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent></AlertDialog>

      {/* Import Progress Dialog */}
      <Dialog open={importing || importDone} onOpenChange={(open) => { if (!open && importDone) { setImportDone(false); setImporting(false); setImportSteps([]); setImportVerifyResult(null); setImportPendingItems([]); } }}>
        <DialogContent className="max-w-md" onPointerDownOutside={(e) => { if (importing && !importDone) e.preventDefault(); }}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              {importDone ? 'Import Selesai' : 'Mengimpor Data Siswa...'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Step-by-step progress */}
            {importSteps.length > 0 && (
              <div className="space-y-1.5">
                {importSteps.map((s, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    {s.status === 'processing' && <Loader2 className="h-4 w-4 animate-spin text-ocean shrink-0 mt-0.5" />}
                    {s.status === 'done' && <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />}
                    {s.status === 'warning' && <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0 mt-0.5" />}
                    {s.status === 'error' && <XCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />}
                    <div className="flex-1 min-w-0">
                      <span className={s.status === 'processing' ? 'text-muted-foreground' : ''}>{s.step}</span>
                      {s.detail && <span className="text-muted-foreground ml-1">({s.detail})</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Progress bar - only show during import */}
            {!importDone && importTotal > 0 && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Memproses {importProcessed} dari {importTotal} data</span>
                  <span>{importProgress}%</span>
                </div>
                <Progress value={importProgress} className="h-3" />
              </div>
            )}

            {/* Stats cards */}
            <div className="grid grid-cols-3 gap-3">
              <div className={`text-center ${importDone ? 'p-3' : 'p-2'} bg-green-50 dark:bg-green-950 rounded-lg`}>
                {importDone && <CheckCircle2 className="h-5 w-5 text-green-600 mx-auto mb-1" />}
                <div className={`${importDone ? 'text-xl' : 'text-lg'} font-bold text-green-600`}>{importSuccess}</div>
                <div className="text-xs text-green-600">Berhasil</div>
              </div>
              <div className={`text-center ${importDone ? 'p-3' : 'p-2'} bg-yellow-50 dark:bg-yellow-950 rounded-lg`}>
                {importDone && <AlertTriangle className="h-5 w-5 text-yellow-600 mx-auto mb-1" />}
                <div className={`${importDone ? 'text-xl' : 'text-lg'} font-bold text-yellow-600`}>{importDuplicates}</div>
                <div className="text-xs text-yellow-600">Sudah Ada</div>
              </div>
              <div className={`text-center ${importDone ? 'p-3' : 'p-2'} bg-red-50 dark:bg-red-950 rounded-lg`}>
                {importDone && <XCircle className="h-5 w-5 text-red-600 mx-auto mb-1" />}
                <div className={`${importDone ? 'text-xl' : 'text-lg'} font-bold text-red-600`}>{importFailed}</div>
                <div className="text-xs text-red-600">Gagal</div>
              </div>
            </div>

            {importDone && (
              <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-2.5">
                <p className="text-xs text-blue-700 dark:text-blue-300">Data yang sudah ada tidak ditimpa, hanya data baru yang diimpor.</p>
              </div>
            )}

            {importDone && importTotal > 0 && (
              <div className="text-center">
                <span className="text-sm text-muted-foreground">Total: {importTotal} data baru diproses</span>
              </div>
            )}

            {/* Error details */}
            {importDone && importErrors.length > 0 && (
              <div className="space-y-1">
                <p className="text-sm font-medium">Detail:</p>
                <div className="max-h-32 overflow-y-auto text-xs space-y-1 pr-1">
                  {importErrors.slice(0, 20).map((err: any, idx: number) => (
                    <div key={idx} className={`p-1.5 rounded ${err.type === 'duplikat' ? 'bg-yellow-50 dark:bg-yellow-950 text-yellow-700' : 'bg-red-50 dark:bg-red-950 text-red-700'}`}>
                      {err.row ? `Baris ${err.row}: ` : ''}{err.nis ? `${err.nis} - ` : ''}{err.error || err.reason}
                    </div>
                  ))}
                  {importErrors.length > 20 && (
                    <p className="text-muted-foreground">...dan {importErrors.length - 20} lainnya</p>
                  )}
                </div>
              </div>
            )}
          </div>
          {importDone && (
            <DialogFooter>
              <Button onClick={() => { setImportDone(false); setImporting(false); setImportSteps([]); setImportVerifyResult(null); setImportPendingItems([]); }} className="bg-ocean hover:bg-ocean-dark text-white">
                Tutup
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* Import Confirmation Dialog - shows verification results before importing */}
      <AlertDialog open={importConfirmOpen} onOpenChange={(open) => { if (!open) setImportConfirmOpen(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Konfirmasi Import Data
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>Verifikasi selesai. Berikut ringkasan data yang akan diimpor:</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="text-center p-2.5 bg-green-50 dark:bg-green-950 rounded-lg">
                    <div className="text-lg font-bold text-green-600">{importVerifyResult?.newCount || 0}</div>
                    <div className="text-xs text-green-600">Data Baru (Akan Diimpor)</div>
                  </div>
                  <div className="text-center p-2.5 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
                    <div className="text-lg font-bold text-yellow-600">{importVerifyResult?.duplicateCount || 0}</div>
                    <div className="text-xs text-yellow-600">Sudah Ada (Dilewati)</div>
                  </div>
                </div>
                {(importVerifyResult?.duplicateCount || 0) > 0 && (
                  <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-2.5">
                    <p className="text-xs text-blue-700 dark:text-blue-300">Data yang sudah ada <strong>tidak akan ditimpa</strong>. Hanya data baru yang akan ditambahkan ke database.</p>
                  </div>
                )}
                {(importVerifyResult?.invalidCount || 0) > 0 && (
                  <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-2.5">
                    <p className="text-xs text-red-700 dark:text-red-300">{importVerifyResult?.invalidCount} data tidak valid dan akan dilewati.</p>
                  </div>
                )}
                {importVerifyResult?.duplicates?.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Data yang sudah ada:</p>
                    <div className="max-h-24 overflow-y-auto text-xs space-y-1">
                      {importVerifyResult.duplicates.slice(0, 10).map((d: any, i: number) => (
                        <div key={i} className="p-1 rounded bg-yellow-50 dark:bg-yellow-950 text-yellow-700">
                          {d.nis} - {d.nama} ({d.reason})
                        </div>
                      ))}
                      {importVerifyResult.duplicates.length > 10 && (
                        <p className="text-muted-foreground">...dan {importVerifyResult.duplicates.length - 10} lainnya</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setImportConfirmOpen(false); setImportDone(true); }}>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={executeImport} className="bg-ocean hover:bg-ocean-dark text-white">
              Import {importVerifyResult?.newCount || 0} Data Baru
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Kelulusan - Class Selection Dialog */}
      <Dialog open={kelulusanOpen} onOpenChange={(open) => { setKelulusanOpen(open); if (!open) setKelulusanSelected([]); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><GraduationCap className="h-5 w-5" />Kelulusan Siswa</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground mb-2">Pilih kelas yang akan diluluskan:</p>
          <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-3 mb-3">
            <div className="flex items-start gap-2">
              <GraduationCap className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
              <div className="text-xs text-green-700 dark:text-green-300 space-y-1">
                <p className="font-medium">Informasi:</p>
                <ul className="list-disc pl-4 space-y-0.5">
                  <li>Semua siswa di kelas yang dipilih akan dinyatakan lulus</li>
                  <li>Siswa yang lulus akan keluar dari kelas</li>
                  <li>Status siswa berubah menjadi "Lulus"</li>
                  <li>Tindakan ini tidak dapat dibatalkan</li>
                </ul>
              </div>
            </div>
          </div>
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {kelasList.map((k: any) => {
              const siswaCount = data.filter((s: any) => s.kelas_id === k.id).length;
              const isSelected = kelulusanSelected.includes(k.id);
              return (
                <div key={k.id} className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${isSelected ? 'bg-green-50 dark:bg-green-950/30 border-green-300 dark:border-green-700' : 'hover:bg-accent/50 border-transparent'}`}
                  onClick={() => setKelulusanSelected(prev => isSelected ? prev.filter(id => id !== k.id) : [...prev, k.id])}>
                  <Checkbox checked={isSelected} onCheckedChange={() => setKelulusanSelected(prev => isSelected ? prev.filter(id => id !== k.id) : [...prev, k.id])} />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium">{k.nama_kelas}</span>
                    <span className="text-xs text-muted-foreground ml-2">({siswaCount} siswa)</span>
                  </div>
                  {isSelected && <BadgeCheck className="h-4 w-4 text-green-600" />}
                </div>
              );
            })}
          </div>
          {kelulusanSelected.length > 0 && (
            <div className="mt-3 p-2.5 bg-green-50 dark:bg-green-950/20 rounded-lg text-sm">
              <span className="font-medium text-green-700 dark:text-green-400">{kelulusanSelected.length} kelas</span>
              <span className="text-muted-foreground"> akan diluluskan</span>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setKelulusanOpen(false); setKelulusanSelected([]); }}>Batal</Button>
            <Button
              onClick={() => {
                if (kelulusanSelected.length === 0) {
                  toast({ title: 'Perhatian', description: 'Pilih kelas yang akan diluluskan', variant: 'destructive' });
                  return;
                }
                setKelulusanConfirmOpen(true);
              }}
              disabled={kelulusanSelected.length === 0}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              <GraduationCap className="h-4 w-4 mr-1" /> Proses Kelulusan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Kelulusan - Confirmation Dialog */}
      <AlertDialog open={kelulusanConfirmOpen} onOpenChange={setKelulusanConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-green-600" />
              Konfirmasi Kelulusan
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>Anda akan meluluskan semua siswa dari <strong>{kelulusanSelected.length} kelas</strong>. Tindakan ini tidak dapat dibatalkan!</p>
                <div className="bg-muted rounded-lg p-3 space-y-1.5">
                  {kelulusanSelected.map((kid) => {
                    const kelas = kelasList.find((k: any) => k.id === kid);
                    const count = data.filter((s: any) => s.kelas_id === kid).length;
                    return kelas ? (
                      <div key={kid} className="flex items-center justify-between text-sm">
                        <span>{kelas.nama_kelas}</span>
                        <span className="font-medium">{count} siswa</span>
                      </div>
                    ) : null;
                  })}
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={kelulusanLoading}>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleKelulusan} disabled={kelulusanLoading} className="bg-green-600 hover:bg-green-700 text-white">
              {kelulusanLoading ? 'Memproses...' : 'Ya, Proses Kelulusan'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Kenaikan Kelas - Mapping Dialog */}
      <Dialog open={kenaikanOpen} onOpenChange={(open) => { setKenaikanOpen(open); if (!open) { setKenaikanMapping({}); setKenaikanNewClasses({}); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Kenaikan Kelas Massal</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground mb-2">Pilih kelas tujuan untuk setiap kelas saat ini:</p>
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mb-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-700 dark:text-amber-300 space-y-1">
                <p className="font-medium">Perhatian:</p>
                <ul className="list-disc pl-4 space-y-0.5">
                  <li>Semua siswa di kelas asal akan dipindahkan ke kelas tujuan</li>
                  <li>Data kehadiran mengajar yang sudah ada tidak berubah (tetap tercatat di kelas asal)</li>
                  <li>Jadwal pembelajaran tidak ikut berpindah, perlu diatur manual</li>
                  <li>Tindakan ini tidak dapat dibatalkan</li>
                </ul>
              </div>
            </div>
          </div>
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {kelasList.map((k: any) => {
              const siswaCount = data.filter((s: any) => s.kelas_id === k.id).length;
              const isCreatingNew = kenaikanMapping[k.id] === '__new__';
              // Extract grade number from class name (e.g., "10 TO" → 10, "11 TKJ" → 11)
              const sourceGrade = parseInt(k.nama_kelas.trim(), 10);
              const nextGrade = !isNaN(sourceGrade) ? sourceGrade + 1 : null;
              // Only show classes with the next grade level in the dropdown
              const nextGradeClasses = kelasList.filter((k2: any) => {
                if (k2.id === k.id) return false; // skip self
                if (nextGrade !== null) {
                  const targetGrade = parseInt(k2.nama_kelas.trim(), 10);
                  return targetGrade === nextGrade;
                }
                return true; // fallback: show all if can't parse grade
              });
              const isHighestGrade = nextGrade !== null && nextGradeClasses.length === 0;
              return (
                <div key={k.id}>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{k.nama_kelas}</span>
                        <span className="text-xs text-muted-foreground">({siswaCount} siswa)</span>
                      </div>
                    </div>
                    <span className="text-muted-foreground shrink-0">→</span>
                    <Select value={kenaikanMapping[k.id] || ''} onValueChange={(v) => {
                      if (v === '__none__') {
                        setKenaikanMapping(prev => { const next = { ...prev }; delete next[k.id]; return next; });
                        setKenaikanNewClasses(prev => { const next = { ...prev }; delete next[k.id]; return next; });
                      } else {
                        setKenaikanMapping(prev => ({ ...prev, [k.id]: v }));
                        if (v !== '__new__') {
                          setKenaikanNewClasses(prev => { const next = { ...prev }; delete next[k.id]; return next; });
                        }
                      }
                    }}>
                      <SelectTrigger className="w-44 shrink-0"><SelectValue placeholder={isHighestGrade ? 'Hanya kelas baru' : 'Kelas tujuan'} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">-- Tidak Dipindah --</SelectItem>
                        <SelectItem value="__new__">➕ Kelas Baru...</SelectItem>
                        {nextGradeClasses.map((k2: any) => <SelectItem key={k2.id} value={k2.id}>{k2.nama_kelas}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  {isCreatingNew && (
                    <div className="mt-1.5 ml-auto w-44">
                      <Input
                        placeholder="Nama kelas baru..."
                        value={kenaikanNewClasses[k.id] || ''}
                        onChange={(e) => setKenaikanNewClasses(prev => ({ ...prev, [k.id]: e.target.value }))}
                        className="h-8 text-sm"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {kenaikanPreview.hasValidMappings && (
            <div className="mt-3 p-2.5 bg-ocean/5 dark:bg-sky-900/20 rounded-lg text-sm space-y-1">
              <div>
                <span className="font-medium text-ocean dark:text-sky-400">{kenaikanPreview.totalAffected} siswa</span>
                <span className="text-muted-foreground"> akan dipindahkan dari </span>
                <span className="font-medium text-ocean dark:text-sky-400">{kenaikanPreview.validMappings.length} kelas</span>
              </div>
              {kenaikanPreview.newClassNames.length > 0 && (
                <div className="text-xs text-emerald-600 dark:text-emerald-400">
                  ➕ Kelas baru akan dibuat: <strong>{kenaikanPreview.newClassNames.join(', ')}</strong>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setKenaikanOpen(false); setKenaikanMapping({}); setKenaikanNewClasses({}); }}>Batal</Button>
            <Button
              onClick={() => {
                if (!kenaikanPreview.hasValidMappings) {
                  toast({ title: 'Perhatian', description: 'Tidak ada mapping kelas yang valid', variant: 'destructive' });
                  return;
                }
                setKenaikanConfirmOpen(true);
              }}
              disabled={!kenaikanPreview.hasValidMappings}
              className="bg-ocean hover:bg-ocean-dark text-white"
            >
              Proses Kenaikan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Kenaikan Kelas - Confirmation Dialog */}
      <AlertDialog open={kenaikanConfirmOpen} onOpenChange={setKenaikanConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Konfirmasi Kenaikan Kelas
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>Anda akan memindahkan <strong>{kenaikanPreview.totalAffected} siswa</strong> dari <strong>{kenaikanPreview.validMappings.length} kelas</strong>. Tindakan ini tidak dapat dibatalkan!</p>
                <div className="bg-muted rounded-lg p-3 space-y-1.5">
                  {kenaikanPreview.validMappings.map((m, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span>{m.oldKelasName} → {m.newKelasName}{m.isNewClass && <span className="text-emerald-600 dark:text-emerald-400 text-xs ml-1">(baru)</span>}</span>
                      <span className="font-medium">{m.studentCount} siswa</span>
                    </div>
                  ))}
                </div>
                {kenaikanPreview.newClassNames.length > 0 && (
                  <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg p-2.5">
                    <p className="text-xs text-emerald-700 dark:text-emerald-300">➕ Kelas baru akan dibuat otomatis: <strong>{kenaikanPreview.newClassNames.join(', ')}</strong></p>
                  </div>
                )}
                {kenaikanPreview.skipped.length > 0 && (
                  <p className="text-xs text-muted-foreground">Kelas dilewati (sama): {kenaikanPreview.skipped.join(', ')}</p>
                )}
                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-2.5">
                  <p className="text-xs text-amber-700 dark:text-amber-300">Pastikan jadwal pembelajaran sudah diatur untuk kelas tujuan setelah kenaikan kelas.</p>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={kenaikanLoading}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleKenaikanKelas}
              disabled={kenaikanLoading}
              className="bg-ocean hover:bg-ocean-dark text-white"
            >
              {kenaikanLoading ? 'Memproses...' : 'Ya, Proses Kenaikan'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
