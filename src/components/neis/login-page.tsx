'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useAuthStore } from '@/stores/auth-store';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';

interface LoginPageProps {
  onSwitchToRegister: () => void;
}

export function LoginPage({ onSwitchToRegister }: LoginPageProps) {
  const [nip, setNip] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuthStore();
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nip || !password) {
      toast({ title: 'Error', description: 'NIP/Username dan password wajib diisi', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nip, password, rememberMe }),
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: 'Login Gagal', description: data.error, variant: 'destructive' });
        return;
      }
      login(data.token, data.user);
      toast({ title: 'Login Berhasil', description: `Selamat datang, ${data.user.nama}!` });
    } catch {
      toast({ title: 'Error', description: 'Terjadi kesalahan koneksi', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-100 via-blue-50 to-cyan-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 p-4">
      <button
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        className="fixed top-4 right-4 p-2 rounded-full bg-white/80 dark:bg-slate-800/80 shadow-md hover:shadow-lg transition-all z-50"
        aria-label="Toggle dark mode"
      >
        {theme === 'dark' ? <Sun className="h-5 w-5 text-yellow-400" /> : <Moon className="h-5 w-5 text-slate-600" />}
      </button>

      <div className="w-full max-w-md">
        <div className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm rounded-2xl shadow-xl p-8 border border-white/50 dark:border-slate-700/50">
          <div className="flex flex-col items-center mb-8">
            <div className="w-24 h-24 mb-4 relative">
              <Image
                src="/logo-sekolah.png"
                alt="Logo Sekolah"
                fill
                className="object-contain"
                priority
              />
            </div>
            <h1 className="text-3xl font-bold text-ocean dark:text-sky-400">NEIS</h1>
            <p className="text-sm text-muted-foreground mt-1">by Farid Mawazi</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="nip">Masukan NIP (18 digit) atau username</Label>
              <Input
                id="nip"
                type="text"
                placeholder="NIP atau username"
                value={nip}
                onChange={(e) => setNip(e.target.value)}
                className="h-11"
                autoComplete="username"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Masukkan password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 pr-10"
                  autoComplete="current-password"
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

            <div className="flex items-center space-x-2">
              <Checkbox
                id="remember"
                checked={rememberMe}
                onCheckedChange={(checked) => setRememberMe(checked === true)}
              />
              <Label htmlFor="remember" className="text-sm cursor-pointer">
                Ingatkan Saya
              </Label>
            </div>

            <Button
              type="submit"
              className="w-full h-11 bg-ocean hover:bg-ocean-dark text-white font-semibold"
              disabled={loading}
            >
              {loading ? 'Memproses...' : 'Login'}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={onSwitchToRegister}
              className="text-sm text-ocean dark:text-sky-400 hover:underline"
            >
              Belum punya akun? Daftar di sini
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-4">by ried</p>
      </div>
    </div>
  );
}
