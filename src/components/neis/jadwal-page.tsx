'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export function JadwalPage() {
  const { user } = useAuthStore();
  const { toast } = useToast();
  const role = user?.role || 'guru';

  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [hariList, setHariList] = useState<any[]>([]);
  const [kelasList, setKelasList] = useState<any[]>([]);
  const [mapelList, setMapelList] = useState<any[]>([]);
  const [guruList, setGuruList] = useState<any[]>([]);

  // Form
  const [formOpen, setFormOpen] = useState(false);
  const [editData, setEditData] = useState<any>(null);
  const [formHariId, setFormHariId] = useState('');
  const [formKelasId, setFormKelasId] = useState('');
  const [formMapelId, setFormMapelId] = useState('');
  const [formGuruId, setFormGuruId] = useState('');
  const [formJamKe, setFormJamKe] = useState('');
  const [formJamMulai, setFormJamMulai] = useState('');
  const [formJamSelesai, setFormJamSelesai] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  const [deleteId, setDeleteId] = useState<string | null>(null);

  const isGuru = role === 'guru';
  const isAdmin = role === 'admin';
  const canAdd = isGuru; // Admin can only edit/delete, Guru can add/edit/delete
  const canEdit = isGuru || isAdmin;
  const canDelete = isGuru || isAdmin;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      let url = '/api/jadwal?';
      if (isGuru) url += `guru_id=${user?.id}`;
      url += `&tanggal=${new Date().toISOString().split('T')[0]}`;
      const res = await fetch(url, { credentials: 'include' });
      if (res.ok) {
        const result = await res.json();
        setData(result.data || []);
      }
    } catch (err) {
      console.error('Fetch jadwal error:', err);
    } finally {
      setLoading(false);
    }
  }, [isGuru, user?.id]);

  const fetchRefData = useCallback(async () => {
    try {
      const [hariRes, kelasRes, mapelRes] = await Promise.all([
        fetch('/api/hari', { credentials: 'include' }),
        fetch('/api/kelas', { credentials: 'include' }),
        fetch('/api/mapel', { credentials: 'include' }),
      ]);
      if (hariRes.ok) setHariList((await hariRes.json()).data || []);
      if (kelasRes.ok) setKelasList((await kelasRes.json()).data || []);
      if (mapelRes.ok) setMapelList((await mapelRes.json()).data || []);

      if (isAdmin) {
        const guruRes = await fetch('/api/users?status=approved&role=guru', { credentials: 'include' });
        if (guruRes.ok) setGuruList((await guruRes.json()).data || []);
      }
    } catch (err) {
      console.error('Fetch ref data error:', err);
    }
  }, [isAdmin]);

  useEffect(() => {
    fetchData();
    fetchRefData();
  }, [fetchData, fetchRefData]);

  const openAddForm = () => {
    setEditData(null);
    setFormHariId('');
    setFormKelasId('');
    setFormMapelId('');
    setFormGuruId(isGuru ? user?.id || '' : '');
    setFormJamKe('');
    setFormJamMulai('');
    setFormJamSelesai('');
    setFormOpen(true);
  };

  const openEditForm = (item: any) => {
    setEditData(item);
    setFormHariId(item.hari_id);
    setFormKelasId(item.kelas_id);
    setFormMapelId(item.mapel_id);
    setFormGuruId(item.guru_id);
    setFormJamKe(item.jam_ke);
    setFormJamMulai(item.jam_mulai);
    setFormJamSelesai(item.jam_selesai);
    setFormOpen(true);
  };

  const handleSubmit = async () => {
    if (!formHariId || !formKelasId || !formMapelId || !formJamKe || !formJamMulai || !formJamSelesai) {
      toast({ title: 'Error', description: 'Semua field wajib diisi', variant: 'destructive' });
      return;
    }
    if (isAdmin && !formGuruId) {
      toast({ title: 'Error', description: 'Guru wajib dipilih', variant: 'destructive' });
      return;
    }

    setFormLoading(true);
    try {
      const body: any = {
        hari_id: formHariId,
        kelas_id: formKelasId,
        mapel_id: formMapelId,
        jam_ke: parseInt(formJamKe),
        jam_mulai: formJamMulai,
        jam_selesai: formJamSelesai,
      };
      if (isAdmin) body.guru_id = formGuruId;

      if (editData) {
        body.id = editData.id;
        const res = await fetch('/api/jadwal', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          credentials: 'include',
        });
        const data = await res.json();
        if (!res.ok) {
          toast({ title: 'Gagal', description: data.error, variant: 'destructive' });
          return;
        }
        toast({ title: 'Berhasil', description: 'Jadwal berhasil diperbarui' });
      } else {
        const res = await fetch('/api/jadwal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          credentials: 'include',
        });
        const data = await res.json();
        if (!res.ok) {
          toast({ title: 'Gagal', description: data.error, variant: 'destructive' });
          return;
        }
        toast({ title: 'Berhasil', description: 'Jadwal berhasil ditambahkan' });
      }

      setFormOpen(false);
      fetchData();
    } catch {
      toast({ title: 'Error', description: 'Terjadi kesalahan', variant: 'destructive' });
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const res = await fetch('/api/jadwal', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: deleteId }),
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: 'Error', description: data.error, variant: 'destructive' });
        return;
      }
      toast({ title: 'Berhasil', description: 'Jadwal berhasil dihapus' });
      setDeleteId(null);
      fetchData();
    } catch {
      toast({ title: 'Error', description: 'Terjadi kesalahan', variant: 'destructive' });
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Jadwal</h1>
        {canAdd && (
          <Button onClick={openAddForm} size="sm" className="bg-ocean hover:bg-ocean-dark text-white">
            <Plus className="h-4 w-4 mr-1" /> Tambah
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-ocean" />
            </div>
          ) : data.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Belum ada jadwal</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Hari</TableHead>
                    {isAdmin && <TableHead>Guru</TableHead>}
                    <TableHead>Kelas</TableHead>
                    <TableHead>Mapel</TableHead>
                    <TableHead>Jam Ke</TableHead>
                    <TableHead>Jam Mulai</TableHead>
                    <TableHead>Jam Selesai</TableHead>
                    {canEdit && <TableHead>Aksi</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell>{d.nama_hari}</TableCell>
                      {isAdmin && <TableCell>{d.guru_nama}</TableCell>}
                      <TableCell>{d.nama_kelas}</TableCell>
                      <TableCell>{d.nama_mapel}</TableCell>
                      <TableCell>{d.jam_ke}</TableCell>
                      <TableCell>{d.jam_mulai}</TableCell>
                      <TableCell>{d.jam_selesai}</TableCell>
                      {canEdit && (
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditForm(d)}>
                              <Edit className="h-3.5 w-3.5" />
                            </Button>
                            {canDelete && (
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(d.id)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Form Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editData ? 'Edit Jadwal' : 'Tambah Jadwal'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {isAdmin && (
              <div className="space-y-2">
                <Label>Guru</Label>
                <Select value={formGuruId} onValueChange={setFormGuruId}>
                  <SelectTrigger><SelectValue placeholder="Pilih guru" /></SelectTrigger>
                  <SelectContent>
                    {guruList.map((g) => (
                      <SelectItem key={g.id} value={g.id}>{g.nama}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Hari</Label>
              <Select value={formHariId} onValueChange={setFormHariId}>
                <SelectTrigger><SelectValue placeholder="Pilih hari" /></SelectTrigger>
                <SelectContent>
                  {hariList.map((h) => (
                    <SelectItem key={h.id} value={h.id}>{h.nama_hari}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Kelas</Label>
              <Select value={formKelasId} onValueChange={setFormKelasId}>
                <SelectTrigger><SelectValue placeholder="Pilih kelas" /></SelectTrigger>
                <SelectContent>
                  {kelasList.map((k) => (
                    <SelectItem key={k.id} value={k.id}>{k.nama_kelas}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Mata Pelajaran</Label>
              <Select value={formMapelId} onValueChange={setFormMapelId}>
                <SelectTrigger><SelectValue placeholder="Pilih mapel" /></SelectTrigger>
                <SelectContent>
                  {mapelList.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.nama_mapel}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Jam Ke</Label>
              <Select value={formJamKe} onValueChange={setFormJamKe}>
                <SelectTrigger><SelectValue placeholder="Pilih jam ke" /></SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 15 }, (_, i) => i + 1).map((n) => (
                    <SelectItem key={n} value={n.toString()}>{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Jam Mulai</Label>
                <Input type="time" value={formJamMulai} onChange={(e) => setFormJamMulai(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Jam Selesai</Label>
                <Input type="time" value={formJamSelesai} onChange={(e) => setFormJamSelesai(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Batal</Button>
            <Button onClick={handleSubmit} disabled={formLoading} className="bg-ocean hover:bg-ocean-dark text-white">
              {formLoading ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Jadwal?</AlertDialogTitle>
            <AlertDialogDescription>Jadwal yang dihapus tidak dapat dikembalikan.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
