'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Pencil, Camera, Image as ImageIcon, Save, X, Key, SwitchCamera } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ImageModal } from './image-modal';

export function ProfilePage() {
  const { user, updateUser } = useAuthStore();
  const { toast } = useToast();
  const role = user?.role || 'guru';

  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);

  // Edit fields
  const [editNama, setEditNama] = useState('');
  const [editNip, setEditNip] = useState('');
  const [editFoto, setEditFoto] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Password
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);

  // Image modal
  const [imageSrc, setImageSrc] = useState('');
  const [imageOpen, setImageOpen] = useState(false);

  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  // Camera dialog (WebRTC for desktop)
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraFacing, setCameraFacing] = useState<'user' | 'environment'>('user');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
        setEditNama(data.nama || '');
        setEditNip(data.nip || '');
        setEditFoto(data.foto_profile || null);
        updateUser(data);
      }
    } finally { setLoading(false); }
  }, [updateUser]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setEditFoto(reader.result as string);
    reader.readAsDataURL(file);
  };

  // Check if device is mobile
  const isMobile = useCallback(() => {
    if (typeof navigator === 'undefined') return false;
    return /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(navigator.userAgent);
  }, []);

  // Start WebRTC camera
  const startCamera = useCallback(async (facing: 'user' | 'environment' = 'user') => {
    try {
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

  const stopCamera = useCallback(() => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(t => t.stop());
      setCameraStream(null);
    }
    setCameraOpen(false);
  }, [cameraStream]);

  const switchCamera = useCallback(async () => {
    const newFacing = cameraFacing === 'user' ? 'environment' : 'user';
    await startCamera(newFacing);
  }, [cameraFacing, startCamera]);

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
      const reader = new FileReader();
      reader.onloadend = () => setEditFoto(reader.result as string);
      reader.readAsDataURL(blob);
      stopCamera();
    }, 'image/jpeg', 0.85);
  }, [stopCamera]);

  const handleCameraClick = useCallback(() => {
    if (isMobile()) {
      cameraRef.current?.click();
    } else {
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

  const handleSave = async () => {
    if (!editNama.trim()) {
      toast({ title: 'Error', description: 'Nama wajib diisi', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('id', user?.id || '');
      formData.append('nama', editNama.trim());
      if (role === 'admin') formData.append('nip', editNip.trim());
      if (editFoto && editFoto !== profile?.foto_profile) {
        formData.append('foto_profile', editFoto);
      }

      const res = await fetch('/api/users/update-profile', {
        method: 'POST', body: formData, credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) { toast({ title: 'Gagal', description: data.error, variant: 'destructive' }); return; }
      toast({ title: 'Berhasil', description: 'Profil berhasil diperbarui' });
      setEditMode(false);
      fetchProfile();
    } catch { toast({ title: 'Error', description: 'Terjadi kesalahan', variant: 'destructive' }); }
    finally { setSaving(false); }
  };

  const handleChangePassword = async () => {
    if (!oldPassword || !newPassword || !confirmPassword) {
      toast({ title: 'Error', description: 'Semua field wajib diisi', variant: 'destructive' });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: 'Error', description: 'Konfirmasi password tidak sesuai', variant: 'destructive' });
      return;
    }
    setPasswordSaving(true);
    try {
      const res = await fetch('/api/users/change-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: user?.id, oldPassword, newPassword }),
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) { toast({ title: 'Gagal', description: data.error, variant: 'destructive' }); return; }
      toast({ title: 'Berhasil', description: 'Password berhasil diubah' });
      setPasswordOpen(false);
      setOldPassword(''); setNewPassword(''); setConfirmPassword('');
    } catch { toast({ title: 'Error', description: 'Terjadi kesalahan', variant: 'destructive' }); }
    finally { setPasswordSaving(false); }
  };

  if (loading) {
    return <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-ocean" /></div>;
  }

  const fotoSrc = editMode ? editFoto : profile?.foto_profile;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Profile</h1>
        <div className="flex gap-2">
          {!editMode && (
            <Button variant="outline" size="sm" onClick={() => setEditMode(true)}>
              <Pencil className="h-4 w-4 mr-1" /> Edit
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setPasswordOpen(true)}>
            <Key className="h-4 w-4 mr-1" /> Ubah Password
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col items-center mb-6">
            <div className="relative">
              {fotoSrc ? (
                <button type="button" onClick={() => { setImageSrc(fotoSrc); setImageOpen(true); }} className="hover:ring-2 hover:ring-ocean rounded-full transition-all">
                  <img src={fotoSrc} alt="Profile" className="w-24 h-24 rounded-full object-cover border-4 border-ocean/20" />
                </button>
              ) : (
                <div className="w-24 h-24 rounded-full bg-ocean/10 flex items-center justify-center text-2xl font-bold text-ocean">
                  {profile?.nama?.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                </div>
              )}
              {editMode && (
                <div className="absolute bottom-0 right-0 flex gap-1">
                  <button type="button" className="p-1.5 rounded-full bg-ocean text-white shadow" onClick={handleCameraClick}>
                    <Camera className="h-3 w-3" />
                  </button>
                  <button type="button" className="p-1.5 rounded-full bg-ocean text-white shadow" onClick={() => galleryRef.current?.click()}>
                    <ImageIcon className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileChange} />
            <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>NIP / Username</Label>
              {editMode && role === 'admin' ? (
                <Input value={editNip} onChange={(e) => setEditNip(e.target.value)} />
              ) : (
                <Input value={profile?.nip || '-'} disabled className="bg-muted" />
              )}
            </div>

            <div className="space-y-2">
              <Label>Nama</Label>
              {editMode ? (
                <Input value={editNama} onChange={(e) => setEditNama(e.target.value)} />
              ) : (
                <Input value={profile?.nama || '-'} disabled className="bg-muted" />
              )}
            </div>

            <div className="space-y-2">
              <Label>Role</Label>
              <Input value={profile?.role ? String(profile.role).charAt(0).toUpperCase() + String(profile.role).slice(1) : '-'} disabled className="bg-muted capitalize" />
            </div>

            <div className="space-y-2">
              <Label>Jenis Kelamin</Label>
              <Input value={profile?.jenis_kelamin || '-'} disabled className="bg-muted" />
            </div>

            <div className="space-y-2">
              <Label>Tanggal Lahir</Label>
              <Input value={profile?.tanggal_lahir || '-'} disabled className="bg-muted" />
            </div>
          </div>

          {editMode && (
            <div className="flex gap-2 mt-6">
              <Button variant="outline" onClick={() => { setEditMode(false); setEditNama(profile?.nama || ''); setEditNip(profile?.nip || ''); setEditFoto(profile?.foto_profile || null); }} className="flex-1">
                <X className="h-4 w-4 mr-1" /> Batal
              </Button>
              <Button onClick={handleSave} disabled={saving} className="flex-1 bg-ocean hover:bg-ocean-dark text-white">
                <Save className="h-4 w-4 mr-1" /> {saving ? 'Menyimpan...' : 'Simpan'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Password Dialog */}
      <Dialog open={passwordOpen} onOpenChange={setPasswordOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Ubah Password</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Password Lama</Label><Input type="password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} /></div>
            <div className="space-y-2"><Label>Password Baru</Label><Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} /></div>
            <div className="space-y-2"><Label>Konfirmasi Password Baru</Label><Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPasswordOpen(false)}>Batal</Button>
            <Button onClick={handleChangePassword} disabled={passwordSaving} className="bg-ocean hover:bg-ocean-dark text-white">
              {passwordSaving ? 'Menyimpan...' : 'Ubah Password'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ImageModal open={imageOpen} onClose={() => setImageOpen(false)} src={imageSrc} />

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
