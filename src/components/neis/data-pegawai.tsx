'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, UserCheck, Trash2, Pencil, Upload, X, Eye } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ImageModal } from './image-modal';

interface DataPegawaiProps {
  initialTab?: string;
}

export function DataPegawaiPage({ initialTab = 'data' }: DataPegawaiProps) {
  const { user } = useAuthStore();
  const { toast } = useToast();
  const role = user?.role || 'admin';

  const [activeTab, setActiveTab] = useState(initialTab);
  const [dataList, setDataList] = useState<any[]>([]);
  const [pendingList, setPendingList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Approve modal
  const [approveModal, setApproveModal] = useState<any>(null);
  const [approveRole, setApproveRole] = useState('');

  // Delete
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Image modal
  const [imageSrc, setImageSrc] = useState('');
  const [imageAlt, setImageAlt] = useState('');
  const [imageOpen, setImageOpen] = useState(false);

  // Edit modal
  const [editModal, setEditModal] = useState<any>(null);
  const [editForm, setEditForm] = useState({
    nip: '',
    nama: '',
    role: '',
    jenis_kelamin: '',
    tanggal_lahir: '',
  });
  const [editPhoto, setEditPhoto] = useState<File | null>(null);
  const [editPhotoPreview, setEditPhotoPreview] = useState<string>('');
  const [editLoading, setEditLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [approvedRes, pendingRes] = await Promise.all([
        fetch(`/api/users?status=approved&search=${encodeURIComponent(search)}`, { credentials: 'include' }),
        fetch(`/api/users?status=pending&search=${encodeURIComponent(search)}`, { credentials: 'include' }),
      ]);
      if (approvedRes.ok) setDataList((await approvedRes.json()).data || []);
      if (pendingRes.ok) setPendingList((await pendingRes.json()).data || []);
    } finally { setLoading(false); }
  }, [search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);

  const openImagePreview = (src: string, alt: string) => {
    setImageSrc(src);
    setImageAlt(alt);
    setImageOpen(true);
  };

  const handleApprove = async () => {
    if (!approveModal || !approveRole) {
      toast({ title: 'Error', description: 'Pilih role terlebih dahulu', variant: 'destructive' });
      return;
    }
    try {
      const res = await fetch('/api/users/approve', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: approveModal.id, role: approveRole }),
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) { toast({ title: 'Gagal', description: data.error, variant: 'destructive' }); return; }
      toast({ title: 'Berhasil', description: 'Pengguna berhasil disetujui' });
      setApproveModal(null); setApproveRole('');
      fetchData();
    } catch { toast({ title: 'Error', description: 'Terjadi kesalahan', variant: 'destructive' }); }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const res = await fetch('/api/users', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: deleteId }), credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) { toast({ title: 'Gagal', description: data.error, variant: 'destructive' }); return; }
      toast({ title: 'Berhasil', description: 'Pengguna berhasil dihapus' });
      setDeleteId(null); fetchData();
    } catch { toast({ title: 'Error', description: 'Terjadi kesalahan', variant: 'destructive' }); }
  };

  // Edit handlers
  const openEditModal = (d: any) => {
    setEditModal(d);
    setEditForm({
      nip: d.nip || '',
      nama: d.nama || '',
      role: d.role || '',
      jenis_kelamin: d.jenis_kelamin || '',
      tanggal_lahir: d.tanggal_lahir || '',
    });
    setEditPhoto(null);
    setEditPhotoPreview(d.foto_profile || '');
  };

  const handleEditPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setEditPhoto(file);
      const reader = new FileReader();
      reader.onloadend = () => setEditPhotoPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const removeEditPhoto = () => {
    setEditPhoto(null);
    setEditPhotoPreview('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleEditSubmit = async () => {
    if (!editModal) return;
    if (!editForm.nama.trim()) {
      toast({ title: 'Error', description: 'Nama wajib diisi', variant: 'destructive' });
      return;
    }
    setEditLoading(true);
    try {
      const formData = new FormData();
      formData.append('id', editModal.id);
      formData.append('nip', editForm.nip.trim());
      formData.append('nama', editForm.nama.trim());
      formData.append('role', editForm.role);
      formData.append('jenis_kelamin', editForm.jenis_kelamin);
      formData.append('tanggal_lahir', editForm.tanggal_lahir);
      if (editPhoto) {
        formData.append('foto_profile', editPhoto);
      } else if (!editPhotoPreview && editModal.foto_profile) {
        // Photo was removed
        formData.append('remove_photo', 'true');
      }

      const res = await fetch('/api/users/update-profile', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) { toast({ title: 'Gagal', description: data.error, variant: 'destructive' }); return; }
      toast({ title: 'Berhasil', description: 'Data pegawai berhasil diperbarui' });
      setEditModal(null);
      fetchData();
    } catch {
      toast({ title: 'Error', description: 'Terjadi kesalahan', variant: 'destructive' });
    } finally {
      setEditLoading(false);
    }
  };

  const renderFoto = (d: any) => {
    if (d.foto_profile) {
      return (
        <button
          onClick={() => openImagePreview(d.foto_profile, d.nama)}
          className="relative group"
        >
          <img
            src={d.foto_profile}
            alt={d.nama}
            className="w-9 h-9 rounded-full object-cover cursor-pointer hover:ring-2 hover:ring-ocean dark:hover:ring-sky-400 transition-all"
          />
          <div className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
            <Eye className="h-3 w-3 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </button>
      );
    }
    return (
      <div className="w-9 h-9 rounded-full bg-ocean/20 flex items-center justify-center text-xs font-bold text-ocean">
        {d.nama?.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
      </div>
    );
  };

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">Data Pegawai</h1>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Cari nama atau NIP..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="data">Data Pegawai</TabsTrigger>
          <TabsTrigger value="approve">
            Approve {pendingList.length > 0 && `(${pendingList.length})`}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="data">
          <Card><CardContent className="p-0">
            {loading ? <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-ocean" /></div> :
            dataList.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">Belum ada data</p> :
            <div className="overflow-x-auto"><Table>
              <TableHeader><TableRow>
                <TableHead>Foto</TableHead><TableHead>NIP</TableHead><TableHead>Nama</TableHead><TableHead>Role</TableHead><TableHead>JK</TableHead><TableHead>Tgl Lahir</TableHead>
                {role === 'admin' && <TableHead>Aksi</TableHead>}
              </TableRow></TableHeader>
              <TableBody>{dataList.map((d: any) => (
                <TableRow key={d.id}>
                  <TableCell>{renderFoto(d)}</TableCell>
                  <TableCell className="text-xs">{d.nip || '-'}</TableCell>
                  <TableCell className="font-medium">{d.nama}</TableCell>
                  <TableCell className="capitalize">{d.role}</TableCell>
                  <TableCell>{d.jenis_kelamin || '-'}</TableCell>
                  <TableCell className="text-xs">{d.tanggal_lahir || '-'}</TableCell>
                  {role === 'admin' && (
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-ocean dark:text-sky-400" onClick={() => openEditModal(d)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(d.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}</TableBody>
            </Table></div>}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="approve">
          <Card><CardContent className="p-0">
            {loading ? <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-ocean" /></div> :
            pendingList.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">Tidak ada pengguna yang menunggu persetujuan</p> :
            <div className="overflow-x-auto"><Table>
              <TableHeader><TableRow>
                <TableHead>Foto</TableHead><TableHead>NIP</TableHead><TableHead>Nama</TableHead><TableHead>Aksi</TableHead>
              </TableRow></TableHeader>
              <TableBody>{pendingList.map((d: any) => (
                <TableRow key={d.id}>
                  <TableCell>{renderFoto(d)}</TableCell>
                  <TableCell className="text-xs">{d.nip || '-'}</TableCell>
                  <TableCell>{d.nama}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-green-600" onClick={() => { setApproveModal(d); setApproveRole('guru'); }}>
                        <UserCheck className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(d.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}</TableBody>
            </Table></div>}
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      {/* Approve Modal */}
      <Dialog open={!!approveModal} onOpenChange={() => setApproveModal(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Setujui Pengguna</DialogTitle></DialogHeader>
          {approveModal && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                {approveModal.foto_profile ? (
                  <button onClick={() => openImagePreview(approveModal.foto_profile, approveModal.nama)}>
                    <img src={approveModal.foto_profile} alt={approveModal.nama} className="w-12 h-12 rounded-full object-cover hover:ring-2 hover:ring-ocean cursor-pointer" />
                  </button>
                ) : (
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">?</div>
                )}
                <div>
                  <p className="font-medium">{approveModal.nama}</p>
                  <p className="text-xs text-muted-foreground">{approveModal.nip}</p>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Pilih Role</label>
                <Select value={approveRole} onValueChange={setApproveRole}>
                  <SelectTrigger><SelectValue placeholder="Pilih role" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="guru">Guru</SelectItem>
                    <SelectItem value="pegawai">Pegawai</SelectItem>
                    <SelectItem value="pimpinan">Pimpinan</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveModal(null)}>Batal</Button>
            <Button onClick={handleApprove} className="bg-ocean hover:bg-ocean-dark text-white">Setujui</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <Dialog open={!!editModal} onOpenChange={() => setEditModal(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Edit Data Pegawai</DialogTitle></DialogHeader>
          {editModal && (
            <form className="space-y-4" autoComplete="off" onSubmit={(e) => { e.preventDefault(); handleEditSubmit(); }}>
              {/* Photo */}
              <div className="space-y-2">
                <Label>Foto Profile</Label>
                <div className="flex items-center gap-4">
                  <div className="relative group">
                    {editPhotoPreview ? (
                      <button onClick={() => openImagePreview(editPhotoPreview, editForm.nama)} className="relative">
                        <img src={editPhotoPreview} alt="Preview" className="w-16 h-16 rounded-full object-cover hover:ring-2 hover:ring-ocean cursor-pointer" />
                        <div className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
                          <Eye className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </button>
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center text-lg font-bold text-muted-foreground">
                        {editForm.nama?.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleEditPhotoChange}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="h-3.5 w-3.5" /> Upload Foto
                    </Button>
                    {editPhotoPreview && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="gap-1 text-destructive"
                        onClick={removeEditPhoto}
                      >
                        <X className="h-3.5 w-3.5" /> Hapus Foto
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {/* NIP */}
              <div className="space-y-2">
                <Label htmlFor="pegawai-nip">NIP</Label>
                <Input
                  id="pegawai-nip"
                  value={editForm.nip}
                  onChange={(e) => setEditForm({ ...editForm, nip: e.target.value })}
                  placeholder="Masukkan NIP"
                  autoComplete="new-password"
                />
              </div>

              {/* Nama */}
              <div className="space-y-2">
                <Label htmlFor="pegawai-nama">Nama</Label>
                <Input
                  id="pegawai-nama"
                  value={editForm.nama}
                  onChange={(e) => setEditForm({ ...editForm, nama: e.target.value })}
                  placeholder="Masukkan nama"
                  autoComplete="new-password"
                />
              </div>

              {/* Role */}
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={editForm.role} onValueChange={(v) => setEditForm({ ...editForm, role: v })}>
                  <SelectTrigger><SelectValue placeholder="Pilih role" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="guru">Guru</SelectItem>
                    <SelectItem value="pegawai">Pegawai</SelectItem>
                    <SelectItem value="pimpinan">Pimpinan</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Jenis Kelamin */}
              <div className="space-y-2">
                <Label>Jenis Kelamin</Label>
                <Select value={editForm.jenis_kelamin} onValueChange={(v) => setEditForm({ ...editForm, jenis_kelamin: v })}>
                  <SelectTrigger><SelectValue placeholder="Pilih jenis kelamin" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="L">Laki-laki</SelectItem>
                    <SelectItem value="P">Perempuan</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Tanggal Lahir */}
              <div className="space-y-2">
                <Label htmlFor="pegawai-tgl-lahir">Tanggal Lahir</Label>
                <Input
                  id="pegawai-tgl-lahir"
                  type="date"
                  value={editForm.tanggal_lahir}
                  onChange={(e) => setEditForm({ ...editForm, tanggal_lahir: e.target.value })}
                  autoComplete="new-password"
                />
              </div>
            </form>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditModal(null)}>Batal</Button>
            <Button type="button" onClick={handleEditSubmit} disabled={editLoading} className="bg-ocean hover:bg-ocean-dark text-white">
              {editLoading ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> : 'Simpan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Hapus Pengguna?</AlertDialogTitle><AlertDialogDescription>Pengguna yang dihapus tidak dapat dikembalikan.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Batal</AlertDialogCancel><AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Hapus</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ImageModal open={imageOpen} onClose={() => setImageOpen(false)} src={imageSrc} alt={imageAlt} />
    </div>
  );
}
