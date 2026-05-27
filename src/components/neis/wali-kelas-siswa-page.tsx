'use client';

import { useState, useEffect, useCallback } from 'react';
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
import { Plus, Edit, Search, UserX, ArrowRightLeft, Loader2, Users, FileDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuthStore } from '@/stores/auth-store';
import { usePagination } from '@/hooks/use-pagination';
import { PaginationBar } from '@/components/neis/pagination-bar';

export function WaliKelasSiswaPage() {
  const { user } = useAuthStore();
  const { toast } = useToast();
  const [data, setData] = useState<any[]>([]);
  const [allSiswa, setAllSiswa] = useState<any[]>([]); // All active siswa for counting
  const [myKelas, setMyKelas] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('aktif');

  // Form (Add & Edit)
  const [formOpen, setFormOpen] = useState(false);
  const [editData, setEditData] = useState<any>(null);
  const [formNis, setFormNis] = useState('');
  const [formNisn, setFormNisn] = useState('');
  const [formNama, setFormNama] = useState('');
  const [formJenisKelamin, setFormJenisKelamin] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  // Delete → Status change
  const [statusChangeOpen, setStatusChangeOpen] = useState(false);
  const [statusChangeId, setStatusChangeId] = useState<string | null>(null);

  // Export loading
  const [exportingExcel, setExportingExcel] = useState(false);

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

  const fetchAllSiswa = useCallback(async () => {
    if (!myKelas) return;
    try {
      const res = await fetch(`/api/siswa?kelas_id=${myKelas.id}`, { credentials: 'include' });
      if (res.ok) {
        const result = (await res.json()).data || [];
        setAllSiswa(result);
      }
    } catch {}
  }, [myKelas]);

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
  useEffect(() => { if (myKelas) { fetchData(); fetchAllSiswa(); } }, [fetchData, fetchAllSiswa]);

  // Compute stats from allSiswa
  const totalSiswa = allSiswa.length;
  const totalLaki = allSiswa.filter((s: any) => s.jenis_kelamin?.toLowerCase() === 'laki-laki').length;
  const totalPerempuan = allSiswa.filter((s: any) => s.jenis_kelamin?.toLowerCase() === 'perempuan').length;

  const openAdd = () => {
    setEditData(null);
    setFormNis(''); setFormNisn(''); setFormNama(''); setFormJenisKelamin('');
    setFormOpen(true);
  };

  const openEdit = (item: any) => {
    setEditData(item);
    setFormNis(item.nis); setFormNisn(item.nisn); setFormNama(item.nama);
    setFormJenisKelamin(item.jenis_kelamin || '');
    setFormOpen(true);
  };

  const handleSubmit = async () => {
    if (!formNis || !formNisn || !formNama) {
      toast({ title: 'Error', description: 'NIS, NISN, dan nama wajib diisi', variant: 'destructive' });
      return;
    }
    setFormLoading(true);
    try {
      if (editData) {
        // Edit mode
        const res = await fetch('/api/siswa', {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editData.id, nis: formNis, nisn: formNisn, nama: formNama,
            jenis_kelamin: formJenisKelamin || null,
          }),
          credentials: 'include',
        });
        const result = await res.json();
        if (!res.ok) { toast({ title: 'Gagal', description: result.error, variant: 'destructive' }); return; }
        toast({ title: 'Berhasil', description: 'Siswa berhasil diperbarui' });
      } else {
        // Add mode
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
      }
      setFormOpen(false); fetchData(); fetchAllSiswa();
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
      setStatusChangeOpen(false); setStatusChangeId(null); fetchData(); fetchAllSiswa();
    } catch { toast({ title: 'Error', description: 'Terjadi kesalahan', variant: 'destructive' }); }
  };

  const handleExportExcel = async () => {
    setExportingExcel(true);
    try {
      const XLSX = await import('xlsx');
      const wsData = [['NIS', 'NISN', 'Nama', 'Kelas', 'Jenis Kelamin', 'Status']];
      data.forEach((d) => {
        const statusLabel = d.status === 'berhenti' ? 'Berhenti' : d.status === 'pindah' ? 'Pindah' : d.status === 'lulus' ? 'Lulus' : 'Aktif';
        wsData.push([d.nis, d.nisn, d.nama, d.nama_kelas || myKelas?.nama_kelas || '-', d.jenis_kelamin || '', statusLabel]);
      });
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      XLSX.utils.book_append_sheet(wb, ws, 'Siswa');
      XLSX.writeFileXLSX(wb, `data-siswa-${myKelas?.nama_kelas || 'kelas'}.xlsx`);
      toast({ title: 'Berhasil', description: 'File Excel berhasil diunduh' });
    } catch (err) {
      console.error('Export Excel error:', err);
      toast({ title: 'Error', description: 'Gagal membuat file Excel', variant: 'destructive' });
    } finally {
      setExportingExcel(false);
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
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-xl font-bold">Siswa</h1>
          {myKelas && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm bg-ocean/10 text-ocean px-2.5 py-0.5 rounded-full font-medium">
                {myKelas.nama_kelas}
              </span>
              <span className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
                {totalSiswa} siswa
              </span>
              <span className="text-xs px-1.5 py-0.5 rounded-full text-blue-600 bg-blue-50 dark:bg-blue-950/30">
                ♂ {totalLaki}
              </span>
              <span className="text-xs px-1.5 py-0.5 rounded-full text-pink-600 bg-pink-50 dark:bg-pink-950/30">
                ♀ {totalPerempuan}
              </span>
            </div>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={handleExportExcel} disabled={exportingExcel || data.length === 0}>
            {exportingExcel ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FileDown className="h-4 w-4 mr-1" />}
            Excel
          </Button>
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
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(d)}>
                    <Edit className="h-3.5 w-3.5" />
                  </Button>
                  {(!d.status || d.status === 'aktif') && (
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => { setStatusChangeId(d.id); setStatusChangeOpen(true); }}>
                      <UserX className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
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

      {/* Add/Edit Form */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}><DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{editData ? 'Edit Siswa' : 'Tambah Siswa'}</DialogTitle></DialogHeader>
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
        <DialogFooter>
          <Button variant="outline" onClick={() => setFormOpen(false)}>Batal</Button>
          <Button onClick={handleSubmit} disabled={formLoading} className="bg-ocean hover:bg-ocean-dark text-white">
            {formLoading ? 'Menyimpan...' : 'Simpan'}
          </Button>
        </DialogFooter>
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
    </div>
  );
}
