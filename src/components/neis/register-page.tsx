'use client';

import { useState, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff, Camera, Image as ImageIcon, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';

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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setFoto(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

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
                  <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-ocean/30">
                    <img src={foto} alt="Preview" className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => cameraInputRef.current?.click()}
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
    </div>
  );
}
