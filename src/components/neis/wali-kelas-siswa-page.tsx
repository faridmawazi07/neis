'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, Search, Upload, UserX, ArrowRightLeft, Loader2, Users, FileText, FileDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuthStore } from '@/stores/auth-store';
import { usePagination } from '@/hooks/use-pagination';
import { PaginationBar } from '@/components/neis/pagination-bar';
import { Progress } from '@/components/ui/progress';

export function WaliKelasSiswaPage() {
  const { user } = useAuthStore();
  const { toast } = useToast();
  const [data, setData] = useState<any[]>([]);
  const [myKelas, setMyKelas] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('aktif');

  // Form
  const [formOpen, setFormOpen] = useState(false);
  const [formNis, setFormNis] = useState('');
  const [formNisn, setFormNisn] = useState('');
  const [formNama, setFormNama] = useState('');
  const [formJenisKelamin, setFormJenisKelamin] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  // Delete → Status change
  const [statusChangeOpen, setStatusChangeOpen] = useState(false);
  const [statusChangeId, setStatusChangeId] = useState<string | null>(null);

  // Import
  const importRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importDone, setImportDone] = useState(false);
  const [importSuccess, setImportSuccess] = useState(0);
  const [importDuplicates, setImportDuplicates] = useState(0);
  const [importFailed, setImportFailed] = useState(0);
  const [importErrors, setImportErrors] = useState<any[]>([]);
  const [importConfirmOpen, setImportConfirmOpen] = useState(false);
  const [importVerifyResult, setImportVerifyResult] = useState<any>(null);
  const [importPendingItems, setImportPendingItems] = useState<any[]>([]);
  const [importSteps, setImportSteps] = useState<{ step: string; status: 'processing' | 'done' | 'warning' | 'error'; detail?: string }[]>([]);

  // Pagination
  const { pageSize, setPageSize, currentPage, setCurrentPage, totalPages, pageStart, pageEnd, paginatedData } = usePagination(data.length);
  const currentData = paginatedData(data);

  const fetchMyKelas = useCallback(async () => {
    if (!user?.id) return;
    try {
      const res = await fetch(`/api/kelas?action=my-kelas&guru_id=${user.id}`, { credentials: 'include' });
      if (res.ok) {
        const result = await res.json();
        setMyKelas(result.data);
      }
    } catch {}
  }, [user?.id]);

  const fetchData = useCallback(async () => {
    if (!myKelas) { setLoading(false); return; }
    setLoading(true);
    try {
      let url = '/api/siswa?';
      if (filterStatus === 'aktif') {
        url += `kelas_id=${myKelas.id}`;
      } else {
        url += `status=${filterStatus}`;
      }
      const res = await fetch(url, { credentials: 'include' });
      if (res.ok) {
        let items = (await res.json()).data || [];
        // For non-aktif filter, only show students from this class
        if (filterStatus !== 'aktif') {
          items = items.filter((s: any) => s.kelas_id === myKelas.id);
        }
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
  }, [myKelas, filterStatus, search]);

  useEffect(() => { fetchMyKelas(); }, [fetchMyKelas]);
  useEffect(() => { if (myKelas) fetchData(); }, [fetchData]);

  const openAdd = () => {
    setFormNis(''); setFormNisn(''); setFormNama(''); setFormJenisKelamin('');
    setFormOpen(true);
  };

  const handleSubmit = async () => {
    if (!formNis || !formNisn || !formNama) {
      toast({ title: 'Error', description: 'NIS, NISN, dan nama wajib diisi', variant: 'destructive' });
      return;
    }
    setFormLoading(true);
    try {
      const res = await fetch('/api/siswa', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nis: formNis, nisn: formNisn, nama: formNama,
          kelas_id: myKelas.id, jenis_kelamin: formJenisKelamin || null,
        }),
        credentials: 'include',
      });
      const result = await res.json();
      if (!res.ok) { toast({ title: 'Gagal', description: result.error, variant: 'destructive' }); return; }
      toast({ title: 'Berhasil', description: 'Siswa berhasil ditambahkan' });
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
      setStatusChangeOpen(false); setStatusChangeId(null); fetchData();
    } catch { toast({ title: 'Error', description: 'Terjadi kesalahan', variant: 'destructive' }); }
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportProgress(0);
    setImportDone(false);
    setImportSuccess(0);
    setImportDuplicates(0);
    setImportFailed(0);
    setImportErrors([]);
    setImportSteps([{ step: 'Membaca file...', status: 'processing' }]);
    setImportVerifyResult(null);
    setImportPendingItems([]);

    try {
      const XLSX = await import('xlsx');
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

      setImportSteps(prev => [...prev, { step: 'Membaca file...', status: 'done', detail: `${rows.length - 1} baris data` }]);

      const items: any[] = [];
      const skippedRows: any[] = [];
      for (let i = 1; i < rows.length; i++) {
        const [nis, nisn, nama, jk] = rows[i];
        if (!nis || !nisn || !nama) {
          skippedRows.push({ row: i + 1, error: 'Data tidak lengkap' });
          continue;
        }
        items.push({
          nis: String(nis), nisn: String(nisn), nama: String(nama),
          namaKelas: myKelas.nama_kelas, kelas_id: myKelas.id, jenis_kelamin: jk || null,
        });
      }

      if (items.length === 0) {
        setImporting(false); setImportDone(true);
        setImportErrors(skippedRows); setImportFailed(skippedRows.length);
        toast({ title: 'Import Gagal', description: 'Tidak ada data valid', variant: 'destructive' });
        e.target.value = '';
        return;
      }

      // Verify
      setImportSteps(prev => [...prev, { step: 'Memverifikasi data...', status: 'processing' }]);
      const verifyRes = await fetch('/api/siswa?action=verify-import', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }), credentials: 'include',
      });

      if (!verifyRes.ok) {
        setImportSteps(prev => [...prev, { step: 'Verifikasi gagal', status: 'error' }]);
        setImporting(false); setImportDone(true);
        e.target.value = '';
        return;
      }

      const verifyResult = await verifyRes.json();
      setImportVerifyResult(verifyResult);
      const newCount = verifyResult.newCount || 0;

      if (newCount === 0) {
        setImporting(false); setImportDone(true);
        setImportDuplicates(verifyResult.duplicateCount || 0);
        toast({ title: 'Import Dilewati', description: 'Semua data sudah ada', variant: 'destructive' });
        e.target.value = '';
        return;
      }

      setImportPendingItems(verifyResult.newItems.map((item: any) => ({
        nis: item.nis, nisn: item.nisn, nama: item.nama,
        kelas_id: item.kelas_id, jenis_kelamin: item.jenis_kelamin,
      })));
      setImporting(false);
      setImportConfirmOpen(true);
    } catch {
      toast({ title: 'Error', description: 'Gagal membaca file', variant: 'destructive' });
      setImporting(false); setImportDone(true);
    }
    e.target.value = '';
  };

  const executeImport = async () => {
    setImportConfirmOpen(false);
    setImporting(true);
    setImportProgress(0);
    setImportSuccess(0);
    setImportDuplicates(importVerifyResult?.duplicateCount || 0);
    setImportFailed(0);

    const items = importPendingItems;
    if (items.length === 0) { setImporting(false); setImportDone(true); return; }

    const BATCH_SIZE = 50;
    let totalSuccess = 0;
    let totalFailed = 0;

    setImportSteps(prev => [...prev, { step: `Mengimpor ${items.length} data...`, status: 'processing' }]);

    for (let batch = 0; batch < items.length; batch += BATCH_SIZE) {
      const batchItems = items.slice(batch, batch + BATCH_SIZE);
      const res = await fetch('/api/siswa?action=bulk-import', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: batchItems }), credentials: 'include',
      });
      const processed = Math.min(batch + BATCH_SIZE, items.length);
      setImportProgress(Math.round((processed / items.length) * 100));

      if (res.ok) {
        const result = await res.json();
        totalSuccess += result.successCount || 0;
        totalFailed += result.failedCount || 0;
        setImportSuccess(totalSuccess);
        setImportFailed(totalFailed);
      } else {
        totalFailed += batchItems.length;
        setImportFailed(totalFailed);
      }
    }

    setImportSteps(prev => [...prev, { step: 'Import selesai', status: totalFailed > 0 ? 'warning' : 'done', detail: `${totalSuccess} berhasil, ${totalFailed} gagal` }]);
    setImportDone(true);
    setImporting(false);
    setImportProgress(100);
    fetchData();

    if (totalFailed === 0) {
      toast({ title: 'Import Berhasil', description: `${totalSuccess} data siswa berhasil diimpor` });
    } else {
      toast({ title: 'Import Selesai', description: `${totalSuccess} berhasil, ${totalFailed} gagal` });
    }
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
    XLSX.writeFile(wb, `data-siswa-${myKelas?.nama_kelas || 'kelas'}.xlsx`);
  };

  const handleExportPDF = async () => {
    try {
      const { default: jsPDF } = await import('jspdf');
      await import('jspdf-autotable');
      const doc = new jsPDF();

      doc.setFontSize(14);
      doc.text(`Data Siswa - ${myKelas?.nama_kelas || 'Kelas'}`, 14, 15);
      doc.setFontSize(10);
      doc.text(`Wali Kelas: ${user?.nama || '-'}`, 14, 22);
      doc.text(`Dicetak: ${new Date().toLocaleDateString('id-ID')}`, 14, 28);

      const tableData = data.map((d, i) => [
        i + 1, d.nis, d.nisn, d.nama, d.jenis_kelamin || '-',
        d.status === 'berhenti' ? 'Berhenti' : d.status === 'pindah' ? 'Pindah' : d.status === 'lulus' ? 'Lulus' : 'Aktif',
      ]);

      (doc as any).autoTable({
        startY: 32,
        head: [['No', 'NIS', 'NISN', 'Nama', 'JK', 'Status']],
        body: tableData,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [8, 145, 178] },
      });

      doc.save(`data-siswa-${myKelas?.nama_kelas || 'kelas'}.pdf`);
    } catch {
      toast({ title: 'Error', description: 'Gagal membuat PDF. Pastikan paket tersedia.', variant: 'destructive' });
    }
  };

  if (!myKelas && !loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <Users className="h-16 w-16 text-muted-foreground mb-4" />
        <h2 className="text-xl font-bold mb-2">Anda Belum Ditugaskan Sebagai Wali Kelas</h2>
        <p className="text-muted-foreground max-w-md">
          Hubungi admin atau pegawai untuk menetapkan Anda sebagai wali kelas.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold">Siswa</h1>
          {myKelas && (
            <span className="text-sm bg-ocean/10 text-ocean px-2.5 py-0.5 rounded-full font-medium">
              {myKelas.nama_kelas}
            </span>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={handleExportPDF}>
            <FileText className="h-4 w-4 mr-1" /> PDF
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportExcel}>
            <FileDown className="h-4 w-4 mr-1" /> Excel
          </Button>
          <Button variant="outline" size="sm" onClick={() => importRef.current?.click()}>
            <Upload className="h-4 w-4 mr-1" /> Import
          </Button>
          <input ref={importRef} type="file" accept=".xlsx,.xls,.pdf" className="hidden" onChange={handleImportExcel} />
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
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Filter status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="aktif">Aktif</SelectItem>
            <SelectItem value="berhenti">🟡 Berhenti</SelectItem>
            <SelectItem value="pindah">🔵 Pindah</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card><CardContent className="p-0">
        {loading ? <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-ocean" /></div> :
        data.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">Belum ada data siswa</p> :
        <>
        <div className="overflow-x-auto"><Table>
          <TableHeader><TableRow>
            <TableHead>NIS</TableHead><TableHead>NISN</TableHead><TableHead>Nama</TableHead><TableHead>JK</TableHead><TableHead>Status</TableHead><TableHead>Aksi</TableHead>
          </TableRow></TableHeader>
          <TableBody>{currentData.map((d: any) => {
            const statusLabel = d.status === 'berhenti' ? 'Berhenti' : d.status === 'pindah' ? 'Pindah' : d.status === 'lulus' ? 'Lulus' : '';
            const statusColor = d.status === 'berhenti' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300' : d.status === 'pindah' ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300' : d.status === 'lulus' ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300' : '';
            return (
            <TableRow key={d.id}>
              <TableCell>{d.nis}</TableCell><TableCell>{d.nisn}</TableCell>
              <TableCell>{d.nama}</TableCell>
              <TableCell>{d.jenis_kelamin || '-'}</TableCell>
              <TableCell>{statusLabel ? <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${statusColor}`}>{statusLabel}</span> : <span className="text-xs text-muted-foreground">Aktif</span>}</TableCell>
              <TableCell>
                {(!d.status || d.status === 'aktif') && (
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => { setStatusChangeId(d.id); setStatusChangeOpen(true); }}>
                    <UserX className="h-3.5 w-3.5" />
                  </Button>
                )}
              </TableCell>
            </TableRow>
            );
          })}</TableBody>
        </Table></div>
        <PaginationBar
          pageSize={pageSize} onPageSizeChange={setPageSize}
          currentPage={currentPage} totalPages={totalPages}
          totalItems={data.length} pageStart={pageStart} pageEnd={pageEnd}
          onPageChange={setCurrentPage}
        />
        </>}
      </CardContent></Card>

      {/* Add Form */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}><DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Tambah Siswa</DialogTitle></DialogHeader>
        <div className="text-sm text-muted-foreground mb-2">Kelas: <strong>{myKelas?.nama_kelas}</strong></div>
        <div className="space-y-4">
          <div className="space-y-2"><Label>NIS</Label><Input value={formNis} onChange={(e) => setFormNis(e.target.value)} placeholder="Masukkan NIS" /></div>
          <div className="space-y-2"><Label>NISN</Label><Input value={formNisn} onChange={(e) => setFormNisn(e.target.value)} placeholder="Masukkan NISN" /></div>
          <div className="space-y-2"><Label>Nama</Label><Input value={formNama} onChange={(e) => setFormNama(e.target.value)} placeholder="Masukkan nama" /></div>
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

      {/* Status Change Popup */}
      <AlertDialog open={statusChangeOpen} onOpenChange={(open) => { setStatusChangeOpen(open); if (!open) setStatusChangeId(null); }}><AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2"><UserX className="h-5 w-5 text-destructive" />Ubah Status Siswa</AlertDialogTitle>
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

      {/* Import Progress */}
      {(importing || importDone) && !importConfirmOpen && (
        <Dialog open onOpenChange={() => { if (importDone) { setImporting(false); setImportDone(false); } }}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Import Siswa</DialogTitle></DialogHeader>
            <div className="space-y-3">
              {importSteps.map((s, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  {s.status === 'processing' && <Loader2 className="h-4 w-4 animate-spin text-ocean" />}
                  {s.status === 'done' && <span className="text-green-600">✓</span>}
                  {s.status === 'warning' && <span className="text-amber-600">⚠</span>}
                  {s.status === 'error' && <span className="text-red-600">✗</span>}
                  <span>{s.step}</span>
                  {s.detail && <span className="text-muted-foreground text-xs">({s.detail})</span>}
                </div>
              ))}
              {importing && <Progress value={importProgress} className="h-2" />}
              {importDone && (
                <div className="mt-3 p-3 rounded-lg bg-muted text-sm space-y-1">
                  <div>Berhasil: <strong className="text-green-600">{importSuccess}</strong></div>
                  <div>Sudah ada (dilewati): <strong className="text-amber-600">{importDuplicates}</strong></div>
                  <div>Gagal: <strong className="text-red-600">{importFailed}</strong></div>
                </div>
              )}
            </div>
            {importDone && (
              <DialogFooter><Button onClick={() => { setImporting(false); setImportDone(false); }}>Tutup</Button></DialogFooter>
            )}
          </DialogContent>
        </Dialog>
      )}

      {/* Import Confirmation */}
      <AlertDialog open={importConfirmOpen} onOpenChange={setImportConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Konfirmasi Import</AlertDialogTitle>
            <AlertDialogDescription>
              {importVerifyResult?.newCount || 0} data siswa baru akan diimpor ke kelas <strong>{myKelas?.nama_kelas}</strong>.
              {importVerifyResult?.duplicateCount > 0 && ` ${importVerifyResult.duplicateCount} data sudah ada dan akan dilewati.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={executeImport} className="bg-ocean hover:bg-ocean-dark text-white">Ya, Import</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
