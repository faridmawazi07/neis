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
import { Plus, Edit, Trash2, Search, Download, Upload, RotateCcw, ArrowUpCircle, CheckCircle2, XCircle, AlertTriangle, FileSpreadsheet } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Progress } from '@/components/ui/progress';

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

  // Delete
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);

  // Kenaikan kelas
  const [kenaikanOpen, setKenaikanOpen] = useState(false);
  const [kenaikanMapping, setKenaikanMapping] = useState<Record<string, string>>({});

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

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      let url = '/api/siswa?';
      if (filterKelasId && filterKelasId !== 'all') url += `kelas_id=${filterKelasId}`;
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
    setFormKelasId(item.kelas_id); setFormJenisKelamin(item.jenis_kelamin || '');
    setFormOpen(true);
  };

  const handleSubmit = async () => {
    if (!formNis || !formNisn || !formNama || !formKelasId) {
      toast({ title: 'Error', description: 'NIS, NISN, nama, dan kelas wajib diisi', variant: 'destructive' });
      return;
    }
    setFormLoading(true);
    try {
      if (editData) {
        const res = await fetch('/api/siswa', {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editData.id, nis: formNis, nisn: formNisn, nama: formNama, kelas_id: formKelasId, jenis_kelamin: formJenisKelamin || null }),
          credentials: 'include',
        });
        const data = await res.json();
        if (!res.ok) { toast({ title: 'Gagal', description: data.error, variant: 'destructive' }); return; }
        toast({ title: 'Berhasil', description: 'Siswa berhasil diperbarui' });
      } else {
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

  const handleDelete = async (id?: string) => {
    const targetId = id || deleteId;
    if (!targetId) return;
    try {
      const res = await fetch('/api/siswa', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: targetId }), credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) { toast({ title: 'Gagal', description: data.error, variant: 'destructive' }); return; }
      toast({ title: 'Berhasil', description: 'Siswa berhasil dihapus' });
      setDeleteId(null); setSelectedIds(prev => prev.filter(i => i !== targetId)); fetchData();
    } catch { toast({ title: 'Error', description: 'Terjadi kesalahan', variant: 'destructive' }); }
  };

  const handleBulkDelete = async () => {
    try {
      const res = await fetch('/api/siswa', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds }), credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) { toast({ title: 'Gagal', description: data.error, variant: 'destructive' }); return; }
      toast({ title: 'Berhasil', description: data.message });
      setSelectedIds([]); setBulkDeleteOpen(false); fetchData();
    } catch { toast({ title: 'Error', description: 'Terjadi kesalahan', variant: 'destructive' }); }
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

  const handleKenaikanKelas = async () => {
    try {
      const res = await fetch('/api/siswa?action=kenaikan-kelas', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mapping: kenaikanMapping }), credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) { toast({ title: 'Gagal', description: data.error, variant: 'destructive' }); return; }
      toast({ title: 'Berhasil', description: data.message });
      setKenaikanOpen(false); fetchData();
    } catch { toast({ title: 'Error', description: 'Terjadi kesalahan', variant: 'destructive' }); }
  };

  const handleExportExcel = async () => {
    const XLSX = await import('xlsx');
    const wsData = [['NIS', 'NISN', 'Nama', 'Kelas', 'Jenis Kelamin']];
    data.forEach((d) => {
      wsData.push([d.nis, d.nisn, d.nama, d.nama_kelas, d.jenis_kelamin || '']);
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

    try {
      const XLSX = await import('xlsx');
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

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
          kelas_id: kelas.id, jenis_kelamin: jk || null,
        });
      }

      setImportTotal(items.length);

      if (items.length === 0) {
        setImporting(false);
        setImportDone(true);
        setImportErrors(skippedRows);
        setImportFailed(skippedRows.length);
        toast({ title: 'Import Gagal', description: 'Tidak ada data valid untuk diimpor', variant: 'destructive' });
        e.target.value = '';
        return;
      }

      // Send in batches of 50 for better UX with progress updates
      const BATCH_SIZE = 50;
      let totalSuccess = 0;
      let totalDuplicates = 0;
      let totalFailed = skippedRows.length;
      const allErrors = [...skippedRows];

      for (let batch = 0; batch < items.length; batch += BATCH_SIZE) {
        const batchItems = items.slice(batch, batch + BATCH_SIZE);
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
          totalDuplicates += result.duplicateCount || 0;
          totalFailed += result.failedCount || 0;
          setImportSuccess(totalSuccess);
          setImportDuplicates(totalDuplicates);
          setImportFailed(totalFailed);

          if (result.duplicates?.length > 0) {
            allErrors.push(...result.duplicates.map((d: any) => ({ ...d, type: 'duplikat' })));
          }
          if (result.failed?.length > 0) {
            allErrors.push(...result.failed.map((f: any) => ({ ...f, type: 'gagal' })));
          }
          setImportErrors(allErrors);
        } else {
          totalFailed += batchItems.length;
          setImportFailed(totalFailed);
          allErrors.push({ error: `Batch gagal diproses (baris ${batch + 1}-${processed})`, type: 'gagal' });
          setImportErrors(allErrors);
        }
      }

      setImportDone(true);
      setImportProgress(100);
      fetchData();
    } catch {
      toast({ title: 'Error', description: 'Gagal membaca file Excel', variant: 'destructive' });
      setImporting(false);
    }
    e.target.value = '';
  };

  const toggleSelect = (id: string) => setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  const toggleAll = () => setSelectedIds(prev => prev.length === data.length ? [] : data.map((d: any) => d.id));

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold">Siswa</h1>
          {!loading && data.length > 0 && (
            <span className="text-sm bg-ocean/10 text-ocean px-2.5 py-0.5 rounded-full font-medium">
              {data.length} siswa
            </span>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          {selectedIds.length > 0 && (
            <Button variant="destructive" size="sm" onClick={() => setBulkDeleteOpen(true)}>
              <Trash2 className="h-4 w-4 mr-1" /> Hapus ({selectedIds.length})
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setKenaikanOpen(true)}>
            <ArrowUpCircle className="h-4 w-4 mr-1" /> Kenaikan Kelas
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
          <SelectTrigger className="w-40"><SelectValue placeholder="Filter kelas" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Kelas</SelectItem>
            {kelasList.map((k: any) => (
              <SelectItem key={k.id} value={k.id}>{k.nama_kelas}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card><CardContent className="p-0">
        {loading ? <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-ocean" /></div> :
        data.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">Belum ada data siswa</p> :
        <div className="overflow-x-auto"><Table>
          <TableHeader><TableRow>
            <TableHead className="w-10"><Checkbox checked={selectedIds.length === data.length && data.length > 0} onCheckedChange={toggleAll} /></TableHead>
            <TableHead>NIS</TableHead><TableHead>NISN</TableHead><TableHead>Nama</TableHead><TableHead>Kelas</TableHead><TableHead>JK</TableHead><TableHead>Aksi</TableHead>
          </TableRow></TableHeader>
          <TableBody>{data.map((d: any) => (
            <TableRow key={d.id}>
              <TableCell><Checkbox checked={selectedIds.includes(d.id)} onCheckedChange={() => toggleSelect(d.id)} /></TableCell>
              <TableCell>{d.nis}</TableCell><TableCell>{d.nisn}</TableCell>
              <TableCell>{d.nama}</TableCell><TableCell>{d.nama_kelas}</TableCell>
              <TableCell>{d.jenis_kelamin || '-'}</TableCell>
              <TableCell><div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(d)}><Edit className="h-3.5 w-3.5" /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(d.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div></TableCell>
            </TableRow>
          ))}</TableBody>
        </Table></div>}
      </CardContent></Card>

      {/* Add/Edit Form */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}><DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{editData ? 'Edit Siswa' : 'Tambah Siswa'}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2"><Label>NIS</Label><Input value={formNis} onChange={(e) => setFormNis(e.target.value)} placeholder="Masukkan NIS" /></div>
          <div className="space-y-2"><Label>NISN</Label><Input value={formNisn} onChange={(e) => setFormNisn(e.target.value)} placeholder="Masukkan NISN" /></div>
          <div className="space-y-2"><Label>Nama</Label><Input value={formNama} onChange={(e) => setFormNama(e.target.value)} placeholder="Masukkan nama" /></div>
          <div className="space-y-2"><Label>Kelas</Label>
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

      {/* Single Delete */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}><AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>Hapus Siswa?</AlertDialogTitle><AlertDialogDescription>Data yang dihapus tidak dapat dikembalikan.</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel>Batal</AlertDialogCancel><AlertDialogAction onClick={() => handleDelete()} className="bg-destructive text-destructive-foreground">Hapus</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent></AlertDialog>

      {/* Bulk Delete */}
      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}><AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>Hapus {selectedIds.length} siswa?</AlertDialogTitle><AlertDialogDescription>Semua siswa yang dipilih akan dihapus.</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel>Batal</AlertDialogCancel><AlertDialogAction onClick={handleBulkDelete} className="bg-destructive text-destructive-foreground">Hapus</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent></AlertDialog>

      {/* Reset */}
      <AlertDialog open={resetOpen} onOpenChange={setResetOpen}><AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>Reset Data Siswa?</AlertDialogTitle><AlertDialogDescription>Semua data siswa akan dihapus permanen. Tindakan ini tidak dapat dibatalkan!</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel>Batal</AlertDialogCancel><AlertDialogAction onClick={handleReset} className="bg-destructive text-destructive-foreground">Reset Semua</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent></AlertDialog>

      {/* Import Progress Dialog */}
      <Dialog open={importing || importDone} onOpenChange={(open) => { if (!open && importDone) { setImportDone(false); setImporting(false); } }}>
        <DialogContent className="max-w-md" onPointerDownOutside={(e) => { if (importing && !importDone) e.preventDefault(); }}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              {importDone ? 'Import Selesai' : 'Mengimpor Data Siswa...'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {!importDone ? (
              <>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Memproses {importProcessed} dari {importTotal} data</span>
                    <span>{importProgress}%</span>
                  </div>
                  <Progress value={importProgress} className="h-3" />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center p-2 bg-green-50 dark:bg-green-950 rounded-lg">
                    <div className="text-lg font-bold text-green-600">{importSuccess}</div>
                    <div className="text-xs text-green-600">Berhasil</div>
                  </div>
                  <div className="text-center p-2 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
                    <div className="text-lg font-bold text-yellow-600">{importDuplicates}</div>
                    <div className="text-xs text-yellow-600">Duplikat</div>
                  </div>
                  <div className="text-center p-2 bg-red-50 dark:bg-red-950 rounded-lg">
                    <div className="text-lg font-bold text-red-600">{importFailed}</div>
                    <div className="text-xs text-red-600">Gagal</div>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                    <CheckCircle2 className="h-5 w-5 text-green-600 mx-auto mb-1" />
                    <div className="text-xl font-bold text-green-600">{importSuccess}</div>
                    <div className="text-xs text-green-600">Berhasil</div>
                  </div>
                  <div className="text-center p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
                    <AlertTriangle className="h-5 w-5 text-yellow-600 mx-auto mb-1" />
                    <div className="text-xl font-bold text-yellow-600">{importDuplicates}</div>
                    <div className="text-xs text-yellow-600">Duplikat</div>
                  </div>
                  <div className="text-center p-3 bg-red-50 dark:bg-red-950 rounded-lg">
                    <XCircle className="h-5 w-5 text-red-600 mx-auto mb-1" />
                    <div className="text-xl font-bold text-red-600">{importFailed}</div>
                    <div className="text-xs text-red-600">Gagal</div>
                  </div>
                </div>
                <div className="text-center">
                  <span className="text-sm text-muted-foreground">Total: {importTotal} data diproses</span>
                </div>
                {importErrors.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Detail Error:</p>
                    <div className="max-h-32 overflow-y-auto text-xs space-y-1 pr-1">
                      {importErrors.slice(0, 20).map((err: any, idx: number) => (
                        <div key={idx} className={`p-1.5 rounded ${err.type === 'duplikat' ? 'bg-yellow-50 dark:bg-yellow-950 text-yellow-700' : 'bg-red-50 dark:bg-red-950 text-red-700'}`}>
                          {err.row ? `Baris ${err.row}: ` : ''}{err.nis ? `${err.nis} - ` : ''}{err.error}
                        </div>
                      ))}
                      {importErrors.length > 20 && (
                        <p className="text-muted-foreground">...dan {importErrors.length - 20} error lainnya</p>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
          {importDone && (
            <DialogFooter>
              <Button onClick={() => { setImportDone(false); setImporting(false); }} className="bg-ocean hover:bg-ocean-dark text-white">
                Tutup
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* Kenaikan Kelas */}
      <Dialog open={kenaikanOpen} onOpenChange={setKenaikanOpen}><DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Kenaikan Kelas Massal</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground mb-4">Pilih kelas tujuan untuk setiap kelas saat ini:</p>
        <div className="space-y-3 max-h-64 overflow-y-auto">
          {kelasList.map((k: any) => (
            <div key={k.id} className="flex items-center gap-3">
              <span className="text-sm w-32 font-medium">{k.nama_kelas}</span>
              <span className="text-muted-foreground">→</span>
              <Select value={kenaikanMapping[k.id] || ''} onValueChange={(v) => setKenaikanMapping(prev => ({ ...prev, [k.id]: v }))}>
                <SelectTrigger className="flex-1"><SelectValue placeholder="Kelas tujuan" /></SelectTrigger>
                <SelectContent>{kelasList.map((k2: any) => <SelectItem key={k2.id} value={k2.id}>{k2.nama_kelas}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          ))}
        </div>
        <DialogFooter><Button variant="outline" onClick={() => setKenaikanOpen(false)}>Batal</Button><Button onClick={handleKenaikanKelas} className="bg-ocean hover:bg-ocean-dark text-white">Proses Kenaikan</Button></DialogFooter>
      </DialogContent></Dialog>
    </div>
  );
}
