'use client';

import { useState, useEffect, useCallback, useRef, useSyncExternalStore } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import { LoginPage } from '@/components/neis/login-page';
import { RegisterPage } from '@/components/neis/register-page';
import { AppLayout, PageName } from '@/components/neis/app-layout';
import { Dashboard } from '@/components/neis/dashboard';
import { KehadiranPage } from '@/components/neis/kehadiran-page';
import { JadwalPage } from '@/components/neis/jadwal-page';
import { HariMaster, KelasMaster, MapelMaster, StatusKehadiranMaster, HariLiburMaster } from '@/components/neis/master-data';
import { SiswaPage } from '@/components/neis/siswa-page';
import { DataPegawaiPage } from '@/components/neis/data-pegawai';
import { ProfilePage } from '@/components/neis/profile-page';
import { GitControlPage } from '@/components/neis/git-control';
import { BackupRestorePage } from '@/components/neis/backup-restore';
import { useToast } from '@/hooks/use-toast';
import { GitBranch } from 'lucide-react';

type AuthView = 'login' | 'register';

const INACTIVITY_TIMEOUT = 5 * 60 * 1000; // 5 minutes

const emptySubscribe = () => () => {};
function useHydrated() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}

export default function HomePage() {
  const { isAuthenticated, user, logout } = useAuthStore();
  const [authView, setAuthView] = useState<AuthView>('login');
  const [activePage, setActivePage] = useState<PageName>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('neis-active-page');
      if (saved && [
        'dashboard', 'kehadiran', 'jadwal', 'hari', 'kelas', 'mapel',
        'status-kehadiran', 'hari-libur', 'siswa', 'data-pegawai',
        'backup-restore', 'git-control', 'profile',
      ].includes(saved)) {
        return saved as PageName;
      }
    }
    return 'dashboard';
  });
  const [deepLink, setDeepLink] = useState<string>('');
  const hydrated = useHydrated();
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  // Verify token on mount
  useEffect(() => {
    if (!isAuthenticated) return;
    const verifyToken = async () => {
      try {
        const res = await fetch('/api/auth/me', { credentials: 'include' });
        if (!res.ok) {
          logout();
        }
      } catch {
        // Network error - keep session
      }
    };
    verifyToken();
  }, [isAuthenticated, logout]);

  // Auto-logout after 5 minutes of inactivity
  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }
    if (isAuthenticated) {
      inactivityTimerRef.current = setTimeout(() => {
        toast({
          title: 'Sesi Berakhir',
          description: 'Sesi Anda telah berakhir karena tidak ada aktivitas selama 5 menit.',
          variant: 'destructive',
          duration: 5000,
        });
        logout();
      }, INACTIVITY_TIMEOUT);
    }
  }, [isAuthenticated, logout, toast]);

  useEffect(() => {
    if (!isAuthenticated) return;

    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart', 'mousedown'];
    events.forEach((event) => {
      window.addEventListener(event, resetInactivityTimer);
    });

    resetInactivityTimer();

    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, resetInactivityTimer);
      });
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
    };
  }, [isAuthenticated, resetInactivityTimer]);

  const handleNavigate = (page: PageName, dl?: string) => {
    setActivePage(page);
    setDeepLink(dl || '');
    if (typeof window !== 'undefined') {
      localStorage.setItem('neis-active-page', page);
    }
  };

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard':
        return <Dashboard onNavigate={(p) => handleNavigate(p)} onDeepNavigate={(p, dl) => handleNavigate(p, dl)} deepLink={deepLink} />;
      case 'kehadiran':
        return <KehadiranPage />;
      case 'jadwal':
        return <JadwalPage />;
      case 'hari':
        return <HariMaster />;
      case 'kelas':
        return <KelasMaster />;
      case 'mapel':
        return <MapelMaster />;
      case 'status-kehadiran':
        return <StatusKehadiranMaster />;
      case 'hari-libur':
        return <HariLiburMaster />;
      case 'siswa':
        return <SiswaPage />;
      case 'data-pegawai':
        return <DataPegawaiPage initialTab={deepLink === 'data-pegawai-approve' ? 'approve' : 'data'} />;
      case 'backup-restore':
        return <BackupRestorePage />;
      case 'git-control':
        // Git Control tidak tersedia di production (deploy)
        if (process.env.NODE_ENV === 'production') {
          return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
              <GitBranch className="h-16 w-16 text-muted-foreground mb-4" />
              <h2 className="text-2xl font-bold mb-2">Git Control Tidak Tersedia</h2>
              <p className="text-muted-foreground max-w-md">
                Fitur Git Control hanya tersedia di lingkungan pengembangan (lokal). 
                Di versi yang sudah di-deploy, kode dikelola melalui GitHub dan Vercel secara otomatis.
              </p>
            </div>
          );
        }
        return <GitControlPage />;
      case 'profile':
        return <ProfilePage />;
      default:
        return <Dashboard onNavigate={(p) => handleNavigate(p)} onDeepNavigate={(p, dl) => handleNavigate(p, dl)} />;
    }
  };

  if (!hydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-100 via-blue-50 to-cyan-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-ocean" />
      </div>
    );
  }

  if (!isAuthenticated) {
    if (authView === 'register') {
      return <RegisterPage onSwitchToLogin={() => setAuthView('login')} />;
    }
    return <LoginPage onSwitchToRegister={() => setAuthView('register')} />;
  }

  return (
    <AppLayout activePage={activePage} onNavigate={handleNavigate}>
      {renderPage()}
    </AppLayout>
  );
}
