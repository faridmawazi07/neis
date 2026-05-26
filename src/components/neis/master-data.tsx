'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, Edit, Trash2, CalendarIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { usePagination } from '@/hooks/use-pagination';
import { PaginationBar } from '@/components/neis/pagination-bar';

// ─── Hari Component ────────────────────────────────────────────────
export function HariMaster() {
  const { toast } = useToast();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editData, setEditData] = useState<any>(null);
  const [namaHari, setNamaHari] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const pagination = usePagination(data.length);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/hari', { credentials: 'include' });
      if (res.ok) setData((await res.json()).data || []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openAdd = () => { setEditData(null); setNamaHari(''); setFormOpen(true); };
  const openEdit = (item: any) => { setEditData(item); setNamaHari(item.nama_hari); setFormOpen(true); };

  const handleSubmit = async () => {
    if (!namaHari.trim()) { toast({ title: 'Error', description: 'Nama hari wajib diisi', variant: 'destructive' }); return; }
    try {
      const method = editData ? 'PUT' : 'POST';
      const body: any = { nama_hari: namaHari.trim() };
      if (editData) body.id = editData.id;
      const res = await fetch('/api/hari', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), credentials: 'include' });
      const data = await res.json();
      if (!res.ok) { toast({ title: 'Gagal', description: data.error, variant: 'destructive' }); return; }
      toast({ title: 'Berhasil', description: editData ? 'Hari berhasil diperbarui' : 'Hari berhasil ditambahkan' });
      setFormOpen(false); fetchData();
    } catch { toast({ title: 'Error', description: 'Terjadi kesalahan', variant: 'destructive' }); }
  };

  const handleDelete = async (id?: string) => {
    const targetId = id || deleteId;
    if (!targetId) return;
    try {
      const res = await fetch('/api/hari', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: targetId }), credentials: 'include' });
      const data = await res.json();
      if (!res.ok) { toast({ title: 'Gagal', description: data.error, variant: 'destructive' }); return; }
      toast({ title: 'Berhasil', description: 'Hari berhasil dihapus' });
      setDeleteId(null); setSelectedIds(prev => prev.filter(i => i !== targetId)); fetchData();
    } catch { toast({ title: 'Error', description: 'Terjadi kesalahan', variant: 'destructive' }); }
  };

  const handleBulkDelete = async () => {
    for (const id of selectedIds) { await handleDelete(id); }
    setSelectedIds([]); setBulkDeleteOpen(false);
  };

  const toggleSelect = (id: string) => setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  const toggleAll = () => {
    const pageIds = pagination.paginatedData(data).map((d: any) => d.id);
    const allPageSelected = pageIds.length > 0 && pageIds.every((id: string) => selectedIds.includes(id));
    if (allPageSelected) {
      setSelectedIds(prev => prev.filter(i => !pageIds.includes(i)));
    } else {
      setSelectedIds(prev => [...new Set([...prev, ...pageIds])]);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Hari</h1>
        <div className="flex gap-2">
          {selectedIds.length > 0 && (
            <Button variant="destructive" size="sm" onClick={() => setBulkDeleteOpen(true)}>
              <Trash2 className="h-4 w-4 mr-1" /> Hapus ({selectedIds.length})
            </Button>
          )}
          <Button onClick={openAdd} size="sm" className="bg-ocean hover:bg-ocean-dark text-white">
            <Plus className="h-4 w-4 mr-1" /> Tambah
          </Button>
        </div>
      </div>
      <Card><CardContent className="p-0">
        {loading ? (
          <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-ocean" /></div>
        ) : data.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Belum ada data</p>
        ) : (
          <>
            <div className="overflow-x-auto"><Table>
              <TableHeader><TableRow>
                <TableHead className="w-10"><Checkbox checked={pagination.paginatedData(data).length > 0 && pagination.paginatedData(data).every((d: any) => selectedIds.includes(d.id))} onCheckedChange={toggleAll} /></TableHead>
                <TableHead>Nama Hari</TableHead><TableHead>Aksi</TableHead>
              </TableRow></TableHeader>
              <TableBody>{pagination.paginatedData(data).map((d: any) => (
                <TableRow key={d.id}>
                  <TableCell><Checkbox checked={selectedIds.includes(d.id)} onCheckedChange={() => toggleSelect(d.id)} /></TableCell>
                  <TableCell>{d.nama_hari}</TableCell>
                  <TableCell><div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(d)}><Edit className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(d.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div></TableCell>
                </TableRow>
              ))}</TableBody>
            </Table></div>
            <PaginationBar
              pageSize={pagination.pageSize}
              onPageSizeChange={pagination.setPageSize}
              currentPage={pagination.currentPage}
              totalPages={pagination.totalPages}
              totalItems={data.length}
              pageStart={pagination.pageStart}
              pageEnd={pagination.pageEnd}
              onPageChange={pagination.setCurrentPage}
            />
          </>
        )}
      </CardContent></Card>

      <Dialog open={formOpen} onOpenChange={setFormOpen}><DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{editData ? 'Edit Hari' : 'Tambah Hari'}</DialogTitle></DialogHeader>
        <div className="space-y-4"><div className="space-y-2"><Label>Nama Hari</Label><Input value={namaHari} onChange={(e) => setNamaHari(e.target.value)} placeholder="Masukkan nama hari" /></div></div>
        <DialogFooter><Button variant="outline" onClick={() => setFormOpen(false)}>Batal</Button><Button onClick={handleSubmit} className="bg-ocean hover:bg-ocean-dark text-white">Simpan</Button></DialogFooter>
      </DialogContent></Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}><AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>Hapus Hari?</AlertDialogTitle><AlertDialogDescription>Data yang dihapus tidak dapat dikembalikan.</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel>Batal</AlertDialogCancel><AlertDialogAction onClick={() => handleDelete()} className="bg-destructive text-destructive-foreground">Hapus</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent></AlertDialog>

      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}><AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>Hapus {selectedIds.length} data?</AlertDialogTitle><AlertDialogDescription>Semua data yang dipilih akan dihapus.</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel>Batal</AlertDialogCancel><AlertDialogAction onClick={handleBulkDelete} className="bg-destructive text-destructive-foreground">Hapus Semua</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent></AlertDialog>
    </div>
  );
}

// ─── Kelas Component ────────────────────────────────────────────────
export function KelasMaster() {
  const { toast } = useToast();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editData, setEditData] = useState<any>(null);
  const [namaKelas, setNamaKelas] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const pagination = usePagination(data.length);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/kelas', { credentials: 'include' });
      if (res.ok) setData((await res.json()).data || []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openAdd = () => { setEditData(null); setNamaKelas(''); setFormOpen(true); };
  const openEdit = (item: any) => { setEditData(item); setNamaKelas(item.nama_kelas); setFormOpen(true); };

  const handleSubmit = async () => {
    if (!namaKelas.trim()) { toast({ title: 'Error', description: 'Nama kelas wajib diisi', variant: 'destructive' }); return; }
    try {
      const method = editData ? 'PUT' : 'POST';
      const body: any = { nama_kelas: namaKelas.trim() };
      if (editData) body.id = editData.id;
      const res = await fetch('/api/kelas', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), credentials: 'include' });
      const data = await res.json();
      if (!res.ok) { toast({ title: 'Gagal', description: data.error, variant: 'destructive' }); return; }
      toast({ title: 'Berhasil', description: editData ? 'Kelas berhasil diperbarui' : 'Kelas berhasil ditambahkan' });
      setFormOpen(false); fetchData();
    } catch { toast({ title: 'Error', description: 'Terjadi kesalahan', variant: 'destructive' }); }
  };

  const handleDelete = async (id?: string) => {
    const targetId = id || deleteId;
    if (!targetId) return;
    try {
      const res = await fetch('/api/kelas', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: targetId }), credentials: 'include' });
      const data = await res.json();
      if (!res.ok) { toast({ title: 'Gagal', description: data.error, variant: 'destructive' }); return; }
      toast({ title: 'Berhasil', description: 'Kelas berhasil dihapus' });
      setDeleteId(null); setSelectedIds(prev => prev.filter(i => i !== targetId)); fetchData();
    } catch { toast({ title: 'Error', description: 'Terjadi kesalahan', variant: 'destructive' }); }
  };

  const handleBulkDelete = async () => { for (const id of selectedIds) { await handleDelete(id); } setSelectedIds([]); setBulkDeleteOpen(false); };
  const toggleSelect = (id: string) => setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  const toggleAll = () => {
    const pageIds = pagination.paginatedData(data).map((d: any) => d.id);
    const allPageSelected = pageIds.length > 0 && pageIds.every((id: string) => selectedIds.includes(id));
    if (allPageSelected) {
      setSelectedIds(prev => prev.filter(i => !pageIds.includes(i)));
    } else {
      setSelectedIds(prev => [...new Set([...prev, ...pageIds])]);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Kelas</h1>
        <div className="flex gap-2">
          {selectedIds.length > 0 && <Button variant="destructive" size="sm" onClick={() => setBulkDeleteOpen(true)}><Trash2 className="h-4 w-4 mr-1" /> Hapus ({selectedIds.length})</Button>}
          <Button onClick={openAdd} size="sm" className="bg-ocean hover:bg-ocean-dark text-white"><Plus className="h-4 w-4 mr-1" /> Tambah</Button>
        </div>
      </div>
      <Card><CardContent className="p-0">
        {loading ? (
          <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-ocean" /></div>
        ) : data.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Belum ada data</p>
        ) : (
          <>
            <div className="overflow-x-auto"><Table>
              <TableHeader><TableRow>
                <TableHead className="w-10"><Checkbox checked={pagination.paginatedData(data).length > 0 && pagination.paginatedData(data).every((d: any) => selectedIds.includes(d.id))} onCheckedChange={toggleAll} /></TableHead>
                <TableHead>Nama Kelas</TableHead><TableHead>Aksi</TableHead>
              </TableRow></TableHeader>
              <TableBody>{pagination.paginatedData(data).map((d: any) => (
                <TableRow key={d.id}>
                  <TableCell><Checkbox checked={selectedIds.includes(d.id)} onCheckedChange={() => toggleSelect(d.id)} /></TableCell>
                  <TableCell>{d.nama_kelas}</TableCell>
                  <TableCell><div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(d)}><Edit className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(d.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div></TableCell>
                </TableRow>
              ))}</TableBody>
            </Table></div>
            <PaginationBar
              pageSize={pagination.pageSize}
              onPageSizeChange={pagination.setPageSize}
              currentPage={pagination.currentPage}
              totalPages={pagination.totalPages}
              totalItems={data.length}
              pageStart={pagination.pageStart}
              pageEnd={pagination.pageEnd}
              onPageChange={pagination.setCurrentPage}
            />
          </>
        )}
      </CardContent></Card>

      <Dialog open={formOpen} onOpenChange={setFormOpen}><DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{editData ? 'Edit Kelas' : 'Tambah Kelas'}</DialogTitle></DialogHeader>
        <div className="space-y-4"><div className="space-y-2"><Label>Nama Kelas</Label><Input value={namaKelas} onChange={(e) => setNamaKelas(e.target.value)} placeholder="Masukkan nama kelas" /></div></div>
        <DialogFooter><Button variant="outline" onClick={() => setFormOpen(false)}>Batal</Button><Button onClick={handleSubmit} className="bg-ocean hover:bg-ocean-dark text-white">Simpan</Button></DialogFooter>
      </DialogContent></Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}><AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>Hapus Kelas?</AlertDialogTitle><AlertDialogDescription>Data yang dihapus tidak dapat dikembalikan.</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel>Batal</AlertDialogCancel><AlertDialogAction onClick={() => handleDelete()} className="bg-destructive text-destructive-foreground">Hapus</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent></AlertDialog>

      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}><AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>Hapus {selectedIds.length} data?</AlertDialogTitle><AlertDialogDescription>Semua data yang dipilih akan dihapus.</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel>Batal</AlertDialogCancel><AlertDialogAction onClick={handleBulkDelete} className="bg-destructive text-destructive-foreground">Hapus Semua</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent></AlertDialog>
    </div>
  );
}

// ─── Mapel Component ────────────────────────────────────────────────
export function MapelMaster() {
  const { toast } = useToast();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editData, setEditData] = useState<any>(null);
  const [namaMapel, setNamaMapel] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const pagination = usePagination(data.length);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/mapel', { credentials: 'include' });
      if (res.ok) setData((await res.json()).data || []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openAdd = () => { setEditData(null); setNamaMapel(''); setFormOpen(true); };
  const openEdit = (item: any) => { setEditData(item); setNamaMapel(item.nama_mapel); setFormOpen(true); };

  const handleSubmit = async () => {
    if (!namaMapel.trim()) { toast({ title: 'Error', description: 'Nama mapel wajib diisi', variant: 'destructive' }); return; }
    try {
      const method = editData ? 'PUT' : 'POST';
      const body: any = { nama_mapel: namaMapel.trim() };
      if (editData) body.id = editData.id;
      const res = await fetch('/api/mapel', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), credentials: 'include' });
      const data = await res.json();
      if (!res.ok) { toast({ title: 'Gagal', description: data.error, variant: 'destructive' }); return; }
      toast({ title: 'Berhasil', description: editData ? 'Mapel berhasil diperbarui' : 'Mapel berhasil ditambahkan' });
      setFormOpen(false); fetchData();
    } catch { toast({ title: 'Error', description: 'Terjadi kesalahan', variant: 'destructive' }); }
  };

  const handleDelete = async (id?: string) => {
    const targetId = id || deleteId;
    if (!targetId) return;
    try {
      const res = await fetch('/api/mapel', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: targetId }), credentials: 'include' });
      const data = await res.json();
      if (!res.ok) { toast({ title: 'Gagal', description: data.error, variant: 'destructive' }); return; }
      toast({ title: 'Berhasil', description: 'Mapel berhasil dihapus' });
      setDeleteId(null); setSelectedIds(prev => prev.filter(i => i !== targetId)); fetchData();
    } catch { toast({ title: 'Error', description: 'Terjadi kesalahan', variant: 'destructive' }); }
  };

  const handleBulkDelete = async () => { for (const id of selectedIds) { await handleDelete(id); } setSelectedIds([]); setBulkDeleteOpen(false); };
  const toggleSelect = (id: string) => setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  const toggleAll = () => {
    const pageIds = pagination.paginatedData(data).map((d: any) => d.id);
    const allPageSelected = pageIds.length > 0 && pageIds.every((id: string) => selectedIds.includes(id));
    if (allPageSelected) {
      setSelectedIds(prev => prev.filter(i => !pageIds.includes(i)));
    } else {
      setSelectedIds(prev => [...new Set([...prev, ...pageIds])]);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Mapel</h1>
        <div className="flex gap-2">
          {selectedIds.length > 0 && <Button variant="destructive" size="sm" onClick={() => setBulkDeleteOpen(true)}><Trash2 className="h-4 w-4 mr-1" /> Hapus ({selectedIds.length})</Button>}
          <Button onClick={openAdd} size="sm" className="bg-ocean hover:bg-ocean-dark text-white"><Plus className="h-4 w-4 mr-1" /> Tambah</Button>
        </div>
      </div>
      <Card><CardContent className="p-0">
        {loading ? (
          <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-ocean" /></div>
        ) : data.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Belum ada data</p>
        ) : (
          <>
            <div className="overflow-x-auto"><Table>
              <TableHeader><TableRow>
                <TableHead className="w-10"><Checkbox checked={pagination.paginatedData(data).length > 0 && pagination.paginatedData(data).every((d: any) => selectedIds.includes(d.id))} onCheckedChange={toggleAll} /></TableHead>
                <TableHead>Nama Mapel</TableHead><TableHead>Aksi</TableHead>
              </TableRow></TableHeader>
              <TableBody>{pagination.paginatedData(data).map((d: any) => (
                <TableRow key={d.id}>
                  <TableCell><Checkbox checked={selectedIds.includes(d.id)} onCheckedChange={() => toggleSelect(d.id)} /></TableCell>
                  <TableCell>{d.nama_mapel}</TableCell>
                  <TableCell><div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(d)}><Edit className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(d.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div></TableCell>
                </TableRow>
              ))}</TableBody>
            </Table></div>
            <PaginationBar
              pageSize={pagination.pageSize}
              onPageSizeChange={pagination.setPageSize}
              currentPage={pagination.currentPage}
              totalPages={pagination.totalPages}
              totalItems={data.length}
              pageStart={pagination.pageStart}
              pageEnd={pagination.pageEnd}
              onPageChange={pagination.setCurrentPage}
            />
          </>
        )}
      </CardContent></Card>

      <Dialog open={formOpen} onOpenChange={setFormOpen}><DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{editData ? 'Edit Mapel' : 'Tambah Mapel'}</DialogTitle></DialogHeader>
        <div className="space-y-4"><div className="space-y-2"><Label>Nama Mapel</Label><Input value={namaMapel} onChange={(e) => setNamaMapel(e.target.value)} placeholder="Masukkan nama mapel" /></div></div>
        <DialogFooter><Button variant="outline" onClick={() => setFormOpen(false)}>Batal</Button><Button onClick={handleSubmit} className="bg-ocean hover:bg-ocean-dark text-white">Simpan</Button></DialogFooter>
      </DialogContent></Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}><AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>Hapus Mapel?</AlertDialogTitle><AlertDialogDescription>Data yang dihapus tidak dapat dikembalikan.</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel>Batal</AlertDialogCancel><AlertDialogAction onClick={() => handleDelete()} className="bg-destructive text-destructive-foreground">Hapus</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent></AlertDialog>

      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}><AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>Hapus {selectedIds.length} data?</AlertDialogTitle><AlertDialogDescription>Semua data yang dipilih akan dihapus.</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel>Batal</AlertDialogCancel><AlertDialogAction onClick={handleBulkDelete} className="bg-destructive text-destructive-foreground">Hapus Semua</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent></AlertDialog>
    </div>
  );
}

// ─── Status Kehadiran Component ─────────────────────────────────────
export function StatusKehadiranMaster() {
  const { toast } = useToast();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editData, setEditData] = useState<any>(null);
  const [namaStatus, setNamaStatus] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const pagination = usePagination(data.length);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/status-kehadiran', { credentials: 'include' });
      if (res.ok) setData((await res.json()).data || []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openAdd = () => { setEditData(null); setNamaStatus(''); setFormOpen(true); };
  const openEdit = (item: any) => { setEditData(item); setNamaStatus(item.nama_status); setFormOpen(true); };

  const handleSubmit = async () => {
    if (!namaStatus.trim()) { toast({ title: 'Error', description: 'Nama status wajib diisi', variant: 'destructive' }); return; }
    try {
      const method = editData ? 'PUT' : 'POST';
      const body: any = { nama_status: namaStatus.trim() };
      if (editData) body.id = editData.id;
      const res = await fetch('/api/status-kehadiran', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), credentials: 'include' });
      const data = await res.json();
      if (!res.ok) { toast({ title: 'Gagal', description: data.error, variant: 'destructive' }); return; }
      toast({ title: 'Berhasil', description: editData ? 'Status berhasil diperbarui' : 'Status berhasil ditambahkan' });
      setFormOpen(false); fetchData();
    } catch { toast({ title: 'Error', description: 'Terjadi kesalahan', variant: 'destructive' }); }
  };

  const handleDelete = async (id?: string) => {
    const targetId = id || deleteId;
    if (!targetId) return;
    try {
      const res = await fetch('/api/status-kehadiran', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: targetId }), credentials: 'include' });
      const data = await res.json();
      if (!res.ok) { toast({ title: 'Gagal', description: data.error, variant: 'destructive' }); return; }
      toast({ title: 'Berhasil', description: 'Status berhasil dihapus' });
      setDeleteId(null); setSelectedIds(prev => prev.filter(i => i !== targetId)); fetchData();
    } catch { toast({ title: 'Error', description: 'Terjadi kesalahan', variant: 'destructive' }); }
  };

  const handleBulkDelete = async () => { for (const id of selectedIds) { await handleDelete(id); } setSelectedIds([]); setBulkDeleteOpen(false); };
  const toggleSelect = (id: string) => setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  const toggleAll = () => {
    const pageIds = pagination.paginatedData(data).map((d: any) => d.id);
    const allPageSelected = pageIds.length > 0 && pageIds.every((id: string) => selectedIds.includes(id));
    if (allPageSelected) {
      setSelectedIds(prev => prev.filter(i => !pageIds.includes(i)));
    } else {
      setSelectedIds(prev => [...new Set([...prev, ...pageIds])]);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Status Kehadiran</h1>
        <div className="flex gap-2">
          {selectedIds.length > 0 && <Button variant="destructive" size="sm" onClick={() => setBulkDeleteOpen(true)}><Trash2 className="h-4 w-4 mr-1" /> Hapus ({selectedIds.length})</Button>}
          <Button onClick={openAdd} size="sm" className="bg-ocean hover:bg-ocean-dark text-white"><Plus className="h-4 w-4 mr-1" /> Tambah</Button>
        </div>
      </div>
      <Card><CardContent className="p-0">
        {loading ? (
          <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-ocean" /></div>
        ) : data.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Belum ada data</p>
        ) : (
          <>
            <div className="overflow-x-auto"><Table>
              <TableHeader><TableRow>
                <TableHead className="w-10"><Checkbox checked={pagination.paginatedData(data).length > 0 && pagination.paginatedData(data).every((d: any) => selectedIds.includes(d.id))} onCheckedChange={toggleAll} /></TableHead>
                <TableHead>Nama Status</TableHead><TableHead>Aksi</TableHead>
              </TableRow></TableHeader>
              <TableBody>{pagination.paginatedData(data).map((d: any) => (
                <TableRow key={d.id}>
                  <TableCell><Checkbox checked={selectedIds.includes(d.id)} onCheckedChange={() => toggleSelect(d.id)} /></TableCell>
                  <TableCell>{d.nama_status}</TableCell>
                  <TableCell><div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(d)}><Edit className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(d.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div></TableCell>
                </TableRow>
              ))}</TableBody>
            </Table></div>
            <PaginationBar
              pageSize={pagination.pageSize}
              onPageSizeChange={pagination.setPageSize}
              currentPage={pagination.currentPage}
              totalPages={pagination.totalPages}
              totalItems={data.length}
              pageStart={pagination.pageStart}
              pageEnd={pagination.pageEnd}
              onPageChange={pagination.setCurrentPage}
            />
          </>
        )}
      </CardContent></Card>

      <Dialog open={formOpen} onOpenChange={setFormOpen}><DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{editData ? 'Edit Status Kehadiran' : 'Tambah Status Kehadiran'}</DialogTitle></DialogHeader>
        <div className="space-y-4"><div className="space-y-2"><Label>Nama Status</Label><Input value={namaStatus} onChange={(e) => setNamaStatus(e.target.value)} placeholder="Masukkan nama status" /></div></div>
        <DialogFooter><Button variant="outline" onClick={() => setFormOpen(false)}>Batal</Button><Button onClick={handleSubmit} className="bg-ocean hover:bg-ocean-dark text-white">Simpan</Button></DialogFooter>
      </DialogContent></Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}><AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>Hapus Status?</AlertDialogTitle><AlertDialogDescription>Data yang dihapus tidak dapat dikembalikan.</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel>Batal</AlertDialogCancel><AlertDialogAction onClick={() => handleDelete()} className="bg-destructive text-destructive-foreground">Hapus</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent></AlertDialog>

      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}><AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>Hapus {selectedIds.length} data?</AlertDialogTitle><AlertDialogDescription>Semua data yang dipilih akan dihapus.</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel>Batal</AlertDialogCancel><AlertDialogAction onClick={handleBulkDelete} className="bg-destructive text-destructive-foreground">Hapus Semua</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent></AlertDialog>
    </div>
  );
}

// ─── Hari Libur Component ───────────────────────────────────────────
export function HariLiburMaster() {
  const { toast } = useToast();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editData, setEditData] = useState<any>(null);
  const [formTanggal, setFormTanggal] = useState<Date>();
  const [holidayCalOpen, setHolidayCalOpen] = useState(false);
  const [formKeterangan, setFormKeterangan] = useState('');
  const [deleteTanggal, setDeleteTanggal] = useState<string | null>(null);
  const [selectedTanggals, setSelectedTanggals] = useState<string[]>([]);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const pagination = usePagination(data.length);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/hari-libur', { credentials: 'include' });
      if (res.ok) setData((await res.json()).data || []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openAdd = () => { setEditData(null); setFormTanggal(undefined); setFormKeterangan(''); setFormOpen(true); };
  const openEdit = (item: any) => {
    setEditData(item);
    setFormTanggal(new Date(item.tanggal + 'T00:00:00'));
    setFormKeterangan(item.keterangan);
    setFormOpen(true);
  };

  const handleSubmit = async () => {
    if (!formTanggal || !formKeterangan.trim()) { toast({ title: 'Error', description: 'Tanggal dan keterangan wajib diisi', variant: 'destructive' }); return; }
    try {
      const tanggal = format(formTanggal, 'yyyy-MM-dd');
      const method = editData ? 'PUT' : 'POST';
      const body = { tanggal, keterangan: formKeterangan.trim() };
      const res = await fetch('/api/hari-libur', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), credentials: 'include' });
      const data = await res.json();
      if (!res.ok) { toast({ title: 'Gagal', description: data.error, variant: 'destructive' }); return; }
      toast({ title: 'Berhasil', description: editData ? 'Hari libur berhasil diperbarui' : 'Hari Libur berhasil ditambahkan' });
      setFormOpen(false); fetchData();
    } catch { toast({ title: 'Error', description: 'Terjadi kesalahan', variant: 'destructive' }); }
  };

  const handleDelete = async () => {
    if (!deleteTanggal) return;
    try {
      const res = await fetch('/api/hari-libur', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tanggal: deleteTanggal }), credentials: 'include' });
      const data = await res.json();
      if (!res.ok) { toast({ title: 'Gagal', description: data.error, variant: 'destructive' }); return; }
      toast({ title: 'Berhasil', description: 'Hari libur berhasil dihapus' });
      setDeleteTanggal(null); setSelectedTanggals(prev => prev.filter(t => t !== deleteTanggal)); fetchData();
    } catch { toast({ title: 'Error', description: 'Terjadi kesalahan', variant: 'destructive' }); }
  };

  const handleBulkDelete = async () => {
    if (selectedTanggals.length === 0) return;
    setBulkDeleting(true);
    try {
      const res = await fetch('/api/hari-libur', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'bulk-delete', tanggals: selectedTanggals }),
        credentials: 'include',
      });
      const result = await res.json();
      if (!res.ok) { toast({ title: 'Gagal', description: result.error, variant: 'destructive' }); return; }
      const { results } = result;
      let msg = `${results.success} hari libur berhasil dihapus`;
      if (results.notFound > 0) msg += `, ${results.notFound} tidak ditemukan`;
      if (results.errors.length > 0) msg += `, ${results.errors.length} gagal`;
      toast({ title: 'Berhasil', description: msg });
      setSelectedTanggals([]); setBulkDeleteOpen(false); fetchData();
    } catch {
      toast({ title: 'Error', description: 'Terjadi kesalahan saat menghapus', variant: 'destructive' });
    } finally {
      setBulkDeleting(false);
    }
  };

  const toggleSelect = (tanggal: string) => setSelectedTanggals(prev => prev.includes(tanggal) ? prev.filter(t => t !== tanggal) : [...prev, tanggal]);
  const toggleAll = () => {
    const pageTanggals = pagination.paginatedData(data).map((d: any) => d.tanggal);
    const allPageSelected = pageTanggals.length > 0 && pageTanggals.every((t: string) => selectedTanggals.includes(t));
    if (allPageSelected) {
      setSelectedTanggals(prev => prev.filter(t => !pageTanggals.includes(t)));
    } else {
      setSelectedTanggals(prev => [...new Set([...prev, ...pageTanggals])]);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Hari Libur</h1>
        <div className="flex gap-2">
          {selectedTanggals.length > 0 && (
            <Button variant="destructive" size="sm" onClick={() => setBulkDeleteOpen(true)}>
              <Trash2 className="h-4 w-4 mr-1" /> Hapus ({selectedTanggals.length})
            </Button>
          )}
          <Button onClick={openAdd} size="sm" className="bg-ocean hover:bg-ocean-dark text-white"><Plus className="h-4 w-4 mr-1" /> Tambah</Button>
        </div>
      </div>
      <Card><CardContent className="p-0">
        {loading ? (
          <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-ocean" /></div>
        ) : data.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Belum ada data</p>
        ) : (
          <>
            <div className="overflow-x-auto"><Table>
              <TableHeader><TableRow>
                <TableHead className="w-10"><Checkbox checked={pagination.paginatedData(data).length > 0 && pagination.paginatedData(data).every((d: any) => selectedTanggals.includes(d.tanggal))} onCheckedChange={toggleAll} /></TableHead>
                <TableHead>Tanggal</TableHead><TableHead>Keterangan</TableHead><TableHead>Aksi</TableHead>
              </TableRow></TableHeader>
              <TableBody>{pagination.paginatedData(data).map((d: any) => (
                <TableRow key={d.tanggal}>
                  <TableCell><Checkbox checked={selectedTanggals.includes(d.tanggal)} onCheckedChange={() => toggleSelect(d.tanggal)} /></TableCell>
                  <TableCell>{d.tanggal}</TableCell>
                  <TableCell>{d.keterangan}</TableCell>
                  <TableCell><div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(d)}><Edit className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteTanggal(d.tanggal)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div></TableCell>
                </TableRow>
              ))}</TableBody>
            </Table></div>
            <PaginationBar
              pageSize={pagination.pageSize}
              onPageSizeChange={pagination.setPageSize}
              currentPage={pagination.currentPage}
              totalPages={pagination.totalPages}
              totalItems={data.length}
              pageStart={pagination.pageStart}
              pageEnd={pagination.pageEnd}
              onPageChange={pagination.setCurrentPage}
            />
          </>
        )}
      </CardContent></Card>

      <Dialog open={formOpen} onOpenChange={setFormOpen}><DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{editData ? 'Edit Hari Libur' : 'Tambah Hari Libur'}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Tanggal</Label>
            <Popover open={holidayCalOpen} onOpenChange={setHolidayCalOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start gap-2">
                  <CalendarIcon className="h-4 w-4" />
                  {formTanggal ? format(formTanggal, 'dd MMMM yyyy') : 'Pilih tanggal'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={formTanggal} onSelect={setFormTanggal} />
              </PopoverContent>
            </Popover>
          </div>
          <div className="space-y-2"><Label>Keterangan</Label><Input value={formKeterangan} onChange={(e) => setFormKeterangan(e.target.value)} placeholder="Keterangan hari libur" /></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => setFormOpen(false)}>Batal</Button><Button onClick={handleSubmit} className="bg-ocean hover:bg-ocean-dark text-white">Simpan</Button></DialogFooter>
      </DialogContent></Dialog>

      <AlertDialog open={!!deleteTanggal} onOpenChange={() => setDeleteTanggal(null)}><AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>Hapus Hari Libur?</AlertDialogTitle><AlertDialogDescription>Data yang dihapus tidak dapat dikembalikan.</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel>Batal</AlertDialogCancel><AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Hapus</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent></AlertDialog>

      <AlertDialog open={bulkDeleteOpen} onOpenChange={(open) => { if (!bulkDeleting) setBulkDeleteOpen(open); }}><AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>Hapus {selectedTanggals.length} Hari Libur?</AlertDialogTitle><AlertDialogDescription>Semua hari libur yang dipilih akan dihapus secara permanen. Tindakan ini tidak dapat dibatalkan.</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={bulkDeleting}>Batal</AlertDialogCancel>
          <AlertDialogAction onClick={handleBulkDelete} className="bg-destructive text-destructive-foreground" disabled={bulkDeleting}>
            {bulkDeleting ? <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" /> Menghapus...</> : 'Hapus Semua'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent></AlertDialog>
    </div>
  );
}
