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
import { Checkbox } from '@/components/ui/checkbox';
import { Search, UserCheck, Trash2, Trash2Icon, Pencil, Upload, X, Eye, Camera, Image as ImageIcon, SwitchCamera } from 'lucide-react';
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

  // Bulk selection (admin only)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

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
    password: '',
  });
  const [editPhoto, setEditPhoto] = useState<File | null>(null);
  const [editPhotoPreview, setEditPhotoPreview] = useState<string>('');
  const [editLoading, setEditLoading] = useState(false);
  const fileGalleryRef = useRef<HTMLInputElement>(null);
  const fileCameraRef = useRef<HTMLInputElement>(null);

  // Camera dialog (WebRTC for desktop)
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraFacing, setCameraFacing] = useState<'user' | 'environment'>('user');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

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

  // Clear selection when data changes
  useEffect(() => {
    setSelectedIds(new Set());
  }, [dataList]);

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

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    try {
      const res = await fetch('/api/users', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds) }), credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) { toast({ title: 'Gagal', description: data.error, variant: 'destructive' }); return; }
      toast({ title: 'Berhasil', description: `${selectedIds.size} pengguna berhasil dihapus` });
      setSelectedIds(new Set());
      setBulkDeleteOpen(false);
      fetchData();
    } catch { toast({ title: 'Error', description: 'Terjadi kesalahan', variant: 'destructive' }); }
  };

  // Selection helpers
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === dataList.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(dataList.map((d: any) => d.id)));
    }
  };

  const allSelected = dataList.length > 0 && selectedIds.size === dataList.length;
  const someSelected = selectedIds.size > 0 && !allSelected;

  // Edit handlers
  const openEditModal = (d: any) => {
    setEditModal(d);
    setEditForm({
      nip: d.nip || '',
      nama: d.nama || '',
      role: d.role || '',
      password: '',
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
    if (fileGalleryRef.current) fileGalleryRef.current.value = '';
    if (fileCameraRef.current) fileCameraRef.current.value = '';
  };

  // Check if device is mobile (supports native camera capture)
  const isMobile = useCallback(() => {
    if (typeof navigator === 'undefined') return false;
    return /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(navigator.userAgent);
  }, []);

  // Start WebRTC camera
  const startCamera = useCallback(async (facing: 'user' | 'environment' = 'user') => {
    try {
      // Stop any existing stream
      if (cameraStream) {
        cameraStream.getTracks().forEach(t => t.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      setCameraStream(stream);
      setCameraFacing(facing);
      setCameraOpen(true);
      // Wait for dialog to render, then attach stream to video
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 100);
    } catch (err) {
      console.error('Camera error:', err);
      toast({ title: 'Kamera Tidak Tersedia', description: 'Tidak dapat mengakses kamera. Pastikan izin kamera diberikan.', variant: 'destructive' });
    }
  }, [cameraStream, toast]);

  // Stop camera
  const stopCamera = useCallback(() => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(t => t.stop());
      setCameraStream(null);
    }
    setCameraOpen(false);
  }, [cameraStream]);

  // Switch camera (front/back)
  const switchCamera = useCallback(async () => {
    const newFacing = cameraFacing === 'user' ? 'environment' : 'user';
    await startCamera(newFacing);
  }, [cameraFacing, startCamera]);

  // Capture photo from video
  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], 'camera-capture.jpg', { type: 'image/jpeg' });
      setEditPhoto(file);
      const reader = new FileReader();
      reader.onloadend = () => setEditPhotoPreview(reader.result as string);
      reader.readAsDataURL(file);
      stopCamera();
    }, 'image/jpeg', 0.85);
  }, [stopCamera]);

  // Handle camera button click
  const handleCameraClick = useCallback(() => {
    if (isMobile()) {
      // On mobile, use native capture attribute
      fileCameraRef.current?.click();
    } else {
      // On desktop, use WebRTC
      startCamera('user');
    }
  }, [isMobile, startCamera]);

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

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
      if (editForm.password.trim()) {
        formData.append('password', editForm.password.trim());
      }
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
          type="button"
          onClick={() => openImagePreview(d.foto_profile, d.nama)}
          className="relative group w-10 h-10 rounded-full focus:outline-none focus:ring-2 focus:ring-ocean"
        >
          <img
            src={d.foto_profile}
            alt={d.nama}
            className="w-full h-full rounded-full object-cover ring-2 ring-transparent group-hover:ring-ocean dark:group-hover:ring-sky-400 transition-all"
          />
          <div className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center pointer-events-none">
            <Eye className="h-3.5 w-3.5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </button>
      );
    }
    return (
      <div className="w-10 h-10 rounded-full bg-ocean/20 flex items-center justify-center text-xs font-bold text-ocean">
        {d.nama?.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
      </div>
    );
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Data Pegawai</h1>
        {role === 'admin' && selectedIds.size > 0 && (
          <Button variant="destructive" size="sm" onClick={() => setBulkDeleteOpen(true)}>
            <Trash2Icon className="h-4 w-4 mr-1" /> Hapus ({selectedIds.size})
          </Button>
        )}
      </div>

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
                {role === 'admin' && (
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allSelected}
                      ref={(el) => {
                        if (el) el.dataset.state = someSelected ? 'indeterminate' : allSelected ? 'checked' : 'unchecked';
                      }}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                )}
                <TableHead>Foto</TableHead><TableHead>NIP</TableHead><TableHead>Nama</TableHead><TableHead>Role</TableHead><TableHead>JK</TableHead><TableHead>Tgl Lahir</TableHead>
                {role === 'admin' && <TableHead>Aksi</TableHead>}
              </TableRow></TableHeader>
              <TableBody>{dataList.map((d: any) => (
                <TableRow key={d.id} className={selectedIds.has(d.id) ? 'bg-muted/50' : ''}>
                  {role === 'admin' && (
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(d.id)}
                        onCheckedChange={() => toggleSelect(d.id)}
                      />
                    </TableCell>
                  )}
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
                  <button type="button" onClick={() => openImagePreview(approveModal.foto_profile, approveModal.nama)} className="hover:ring-2 hover:ring-ocean rounded-full transition-all">
                    <img src={approveModal.foto_profile} alt={approveModal.nama} className="w-12 h-12 rounded-full object-cover" />
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
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Edit Data Pegawai</DialogTitle></DialogHeader>
          {editModal && (
            <form className="space-y-3" autoComplete="off" onSubmit={(e) => { e.preventDefault(); handleEditSubmit(); }}>
              {/* Honeypot - mencegah browser autofill */}
              <input type="text" className="hidden" tabIndex={-1} autoComplete="username" />
              <input type="password" className="hidden" tabIndex={-1} autoComplete="current-password" />

              {/* Photo - compact with camera & gallery */}
              <div className="flex items-center gap-3">
                <div className="shrink-0">
                  {editPhotoPreview ? (
                    <button type="button" onClick={() => openImagePreview(editPhotoPreview, editForm.nama)} className="hover:ring-2 hover:ring-ocean rounded-full transition-all">
                      <img src={editPhotoPreview} alt="Preview" className="w-12 h-12 rounded-full object-cover" />
                    </button>
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-sm font-bold text-muted-foreground">
                      {editForm.nama?.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <input ref={fileGalleryRef} type="file" accept="image/*" onChange={handleEditPhotoChange} className="hidden" />
                  <input ref={fileCameraRef} type="file" accept="image/*" capture="environment" onChange={handleEditPhotoChange} className="hidden" />
                  <Button type="button" variant="outline" size="sm" className="gap-1 h-7 text-xs" onClick={() => fileGalleryRef.current?.click()}>
                    <ImageIcon className="h-3 w-3" /> Galeri
                  </Button>
                  <Button type="button" variant="outline" size="sm" className="gap-1 h-7 text-xs" onClick={handleCameraClick}>
                    <Camera className="h-3 w-3" /> Kamera
                  </Button>
                  {editPhotoPreview && (
                    <Button type="button" variant="ghost" size="sm" className="h-7 text-xs text-destructive px-1.5" onClick={removeEditPhoto}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>

              {/* NIP */}
              <div className="space-y-1">
                <Label className="text-xs">NIP</Label>
                <Input
                  value={editForm.nip}
                  onChange={(e) => setEditForm({ ...editForm, nip: e.target.value })}
                  placeholder="Masukkan NIP"
                  className="h-8 text-sm"
                  autoComplete="off"
                />
              </div>

              {/* Nama */}
              <div className="space-y-1">
                <Label className="text-xs">Nama</Label>
                <Input
                  value={editForm.nama}
                  onChange={(e) => setEditForm({ ...editForm, nama: e.target.value })}
                  placeholder="Masukkan nama"
                  className="h-8 text-sm"
                  autoComplete="off"
                />
              </div>

              {/* Role */}
              <div className="space-y-1">
                <Label className="text-xs">Role</Label>
                <Select value={editForm.role} onValueChange={(v) => setEditForm({ ...editForm, role: v })}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Pilih role" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="guru">Guru</SelectItem>
                    <SelectItem value="pegawai">Pegawai</SelectItem>
                    <SelectItem value="pimpinan">Pimpinan</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Password */}
              <div className="space-y-1">
                <Label className="text-xs">Password Baru</Label>
                <Input
                  type="password"
                  value={editForm.password}
                  onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                  placeholder="Kosongkan jika tidak diubah"
                  className="h-8 text-sm"
                  autoComplete="new-password"
                />
              </div>
            </form>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditModal(null)}>Batal</Button>
            <Button type="button" size="sm" onClick={handleEditSubmit} disabled={editLoading} className="bg-ocean hover:bg-ocean-dark text-white">
              {editLoading ? <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white" /> : 'Simpan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Hapus Pengguna?</AlertDialogTitle><AlertDialogDescription>Pengguna yang dihapus tidak dapat dikembalikan. Jadwal guru yang bersangkutan juga akan dihapus, namun data kehadiran pembelajaran tetap tersimpan.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Batal</AlertDialogCancel><AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Hapus</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Confirmation */}
      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus {selectedIds.size} Pengguna?</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedIds.size} pengguna yang dipilih akan dihapus secara permanen. Jadwal guru yang bersangkutan juga akan dihapus, namun data kehadiran pembelajaran tetap tersimpan. Tindakan ini tidak dapat dikembalikan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete} className="bg-destructive text-destructive-foreground">
              Hapus {selectedIds.size} Pengguna
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ImageModal open={imageOpen} onClose={() => setImageOpen(false)} src={imageSrc} alt={imageAlt} />

      {/* Camera Dialog (WebRTC for Desktop/Laptop) */}
      <Dialog open={cameraOpen} onOpenChange={(open) => { if (!open) stopCamera(); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Ambil Foto</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="relative bg-black rounded-lg overflow-hidden aspect-[4/3]">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex items-center justify-center gap-3">
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10 rounded-full"
                onClick={switchCamera}
                title="Ganti kamera"
              >
                <SwitchCamera className="h-4 w-4" />
              </Button>
              <Button
                className="h-14 w-14 rounded-full bg-ocean hover:bg-ocean-dark text-white border-4 border-white shadow-lg"
                onClick={capturePhoto}
                title="Ambil foto"
              >
                <Camera className="h-6 w-6" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10 rounded-full"
                onClick={stopCamera}
                title="Tutup kamera"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <canvas ref={canvasRef} className="hidden" />
        </DialogContent>
      </Dialog>
    </div>
  );
}
