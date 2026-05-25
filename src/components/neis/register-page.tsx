'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Eye, EyeOff, Camera, Image as ImageIcon, ArrowLeft, SwitchCamera, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { compressFile, compressImage } from '@/lib/image-compress';
import Image from 'next/image';
import { ImageModal } from './image-modal';

interface RegisterPageProps {
  onSwitchToLogin: () => void;
}

function parseNIP(nip: string): { tanggalLahir: string; jenisKelamin: string } | null {
  if (nip.length !== 18 || !/^\d{18}$/.test(nip)) return null;
  const year = nip.substring(0, 4);
  const month = nip.substring(4, 6);
  const day = nip.substring(6, 8);
  const genderDigit = nip.substring(14, 15);
  let tanggalLahir = `${year}-${month}-${day}`;
  const dayNum = parseInt(day);
  if (dayNum > 40) {
    const actualDay = (dayNum - 40).toString().padStart(2, '0');
    tanggalLahir = `${year}-${month}-${actualDay}`;
  }
  const jenisKelamin = genderDigit === '1' ? 'Laki-laki' : genderDigit === '2' ? 'Perempuan' : '';
  return { tanggalLahir, jenisKelamin };
}

export function RegisterPage({ onSwitchToLogin }: RegisterPageProps) {
  const [nip, setNip] = useState('');
  const [nama, setNama] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [foto, setFoto] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [parsedNIP, setParsedNIP] = useState<{ tanggalLahir: string; jenisKelamin: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Image modal
  const [imageOpen, setImageOpen] = useState(false);

  // Camera dialog (WebRTC for desktop)
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraFacing, setCameraFacing] = useState<'user' | 'environment'>('user');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handleNIPChange = (value: string) => {
    const cleaned = value.replace(/\D/g, '').slice(0, 18);
    setNip(cleaned);
    if (cleaned.length === 18) {
      const parsed = parseNIP(cleaned);
      setParsedNIP(parsed);
    } else {
      setParsedNIP(null);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressFile(file);
      setFoto(compressed);
    } catch (err: any) {
      toast({ title: 'Error', description: err?.message || 'Gagal memproses foto', variant: 'destructive' });
    }
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
    // Compress captured photo to JPEG
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      try {
        const dataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
        const compressed = await compressImage(dataUrl);
        setFoto(compressed);
      } catch {
        // Fallback: use uncompressed
        const reader = new FileReader();
        reader.onloadend = () => setFoto(reader.result as string);
        reader.readAsDataURL(blob);
      }
      stopCamera();
    }, 'image/jpeg', 0.85);
  }, [stopCamera]);

  const handleCameraClick = useCallback(() => {
    if (isMobile()) {
      cameraInputRef.current?.click();
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

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!/^\d{18}$/.test(nip)) {
      toast({ title: 'Peringatan', description: 'NIP harus tepat 18 digit angka!', variant: 'destructive' });
      return;
    }
    if (!nama.trim()) {
      toast({ title: 'Error', description: 'Nama wajib diisi', variant: 'destructive' });
      return;
    }
    if (!password) {
      toast({ title: 'Error', description: 'Password wajib diisi', variant: 'destructive' });
      return;
    }
    if (!foto) {
      toast({
        title: 'Peringatan',
        description: 'Foto profil wajib diunggah/diambil melalui kamera untuk melanjutkan pendaftaran!',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('nip', nip);
      formData.append('nama', nama.trim());
      formData.append('password', password);
      formData.append('foto_profile', foto);

      const res = await fetch('/api/auth/register', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: 'Pendaftaran Gagal', description: data.error, variant: 'destructive' });
        return;
      }
      toast({ title: 'Berhasil', description: 'Pendaftaran berhasil! Menunggu persetujuan admin.' });
      onSwitchToLogin();
    } catch {
      toast({ title: 'Error', description: 'Terjadi kesalahan koneksi', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-100 via-blue-50 to-cyan-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 p-4">
      <div className="w-full max-w-md">
        <div className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm rounded-2xl shadow-xl p-8 border border-white/50 dark:border-slate-700/50">
          <div className="flex flex-col items-center mb-6">
            <div className="w-20 h-20 mb-3 relative">
              <Image src="/logo-sekolah.png" alt="Logo Sekolah" fill className="object-contain" priority />
            </div>
            <h1 className="text-2xl font-bold text-ocean dark:text-sky-400">Daftar Akun</h1>
          </div>

          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nip">NIP (18 digit)</Label>
              <Input
                id="nip"
                type="text"
                placeholder="Masukkan 18 digit NIP"
                value={nip}
                onChange={(e) => handleNIPChange(e.target.value)}
                className="h-11"
                maxLength={18}
              />
              {nip.length > 0 && nip.length !== 18 && (
                <p className="text-xs text-destructive">NIP harus tepat 18 digit angka!</p>
              )}
              {parsedNIP && (
                <div className="text-xs text-muted-foreground space-y-0.5 bg-accent/50 p-2 rounded-md">
                  <p>Tanggal Lahir: {parsedNIP.tanggalLahir}</p>
                  <p>Jenis Kelamin: {parsedNIP.jenisKelamin || '-'}</p>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="nama">Nama Lengkap</Label>
              <Input
                id="nama"
                type="text"
                placeholder="Masukkan nama lengkap"
                value={nama}
                onChange={(e) => setNama(e.target.value)}
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reg-password">Password</Label>
              <div className="relative">
                <Input
                  id="reg-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Masukkan password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Foto Profil</Label>
              <div className="flex items-center gap-3">
                {foto && (
                  <button
                    type="button"
                    onClick={() => setImageOpen(true)}
                    className="w-16 h-16 rounded-full overflow-hidden border-2 border-ocean/30 hover:ring-2 hover:ring-ocean transition-all cursor-pointer"
                  >
                    <img src={foto} alt="Preview" className="w-full h-full object-cover" />
                  </button>
                )}
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleCameraClick}
                  >
                    <Camera className="h-4 w-4 mr-1" /> Kamera
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <ImageIcon className="h-4 w-4 mr-1" /> Galeri
                  </Button>
                </div>
              </div>
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleFileChange}
              />
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            <Button
              type="submit"
              className="w-full h-11 bg-ocean hover:bg-ocean-dark text-white font-semibold"
              disabled={loading}
            >
              {loading ? 'Memproses...' : 'Daftar'}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={onSwitchToLogin}
              className="text-sm text-ocean dark:text-sky-400 hover:underline inline-flex items-center gap-1"
            >
              <ArrowLeft className="h-3 w-3" /> Kembali ke Login
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-4">by ried</p>
      </div>

      {/* Image Modal */}
      <ImageModal open={imageOpen} onClose={() => setImageOpen(false)} src={foto || ''} alt="Foto Profil" />

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
