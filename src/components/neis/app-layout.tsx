'use client';

import { useState } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import { useTheme } from 'next-themes';
import Image from 'next/image';
import {
  LayoutDashboard,
  ClipboardList,
  Database,
  Users,
  HardDrive,
  GitBranch,
  User,
  Menu,
  X,
  Moon,
  Sun,
  LogOut,
  ChevronDown,
  ChevronRight,
  Calendar,
  BookOpen,
  GraduationCap,
  Clock,
  AlertCircle,
  CalendarDays,
  Eye,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ImageModal } from './image-modal';

export type PageName =
  | 'dashboard'
  | 'kehadiran'
  | 'jadwal'
  | 'hari'
  | 'kelas'
  | 'mapel'
  | 'status-kehadiran'
  | 'hari-libur'
  | 'siswa'
  | 'data-pegawai'
  | 'backup-restore'
  | 'git-control'
  | 'profile';

interface AppLayoutProps {
  activePage: PageName;
  onNavigate: (page: PageName) => void;
  children: React.ReactNode;
}

const isProduction = process.env.NODE_ENV === 'production';

const menuItems = {
  admin: [
    { id: 'dashboard' as PageName, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'kehadiran' as PageName, label: 'Kehadiran', icon: ClipboardList },
    {
      label: 'Manajemen Data',
      icon: Database,
      children: [
        { id: 'hari' as PageName, label: 'Hari', icon: Calendar },
        { id: 'kelas' as PageName, label: 'Kelas', icon: GraduationCap },
        { id: 'mapel' as PageName, label: 'Mapel', icon: BookOpen },
        { id: 'status-kehadiran' as PageName, label: 'Status Kehadiran', icon: AlertCircle },
        { id: 'hari-libur' as PageName, label: 'Hari Libur', icon: CalendarDays },
        { id: 'jadwal' as PageName, label: 'Jadwal', icon: Clock },
        { id: 'siswa' as PageName, label: 'Siswa', icon: Users },
      ],
    },
    { id: 'data-pegawai' as PageName, label: 'Data Pegawai', icon: Users },
    { id: 'backup-restore' as PageName, label: 'Backup/Restore/Reset', icon: HardDrive },
    // Git Control hanya tampil di development (lokal), disembunyikan di production (deploy)
    ...(isProduction ? [] : [{ id: 'git-control' as PageName, label: 'Git Control', icon: GitBranch }]),
    { id: 'profile' as PageName, label: 'Profile', icon: User },
  ],
  guru: [
    { id: 'dashboard' as PageName, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'jadwal' as PageName, label: 'Jadwal', icon: Clock },
    { id: 'kehadiran' as PageName, label: 'Kehadiran', icon: ClipboardList },
    { id: 'profile' as PageName, label: 'Profile', icon: User },
  ],
  pegawai: [
    { id: 'dashboard' as PageName, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'kehadiran' as PageName, label: 'Kehadiran', icon: ClipboardList },
    { id: 'siswa' as PageName, label: 'Siswa', icon: Users },
    { id: 'profile' as PageName, label: 'Profile', icon: User },
  ],
  pimpinan: [
    { id: 'dashboard' as PageName, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'kehadiran' as PageName, label: 'Kehadiran', icon: ClipboardList },
    { id: 'profile' as PageName, label: 'Profile', icon: User },
  ],
};

export function AppLayout({ activePage, onNavigate, children }: AppLayoutProps) {
  const { user, logout } = useAuthStore();
  const { theme, setTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dataMenuOpen, setDataMenuOpen] = useState(false);

  // Image preview modal
  const [imageOpen, setImageOpen] = useState(false);

  const role = user?.role || 'guru';
  const items = menuItems[role as keyof typeof menuItems] || menuItems.guru;

  const handleNavigate = (page: PageName) => {
    onNavigate(page);
    setSidebarOpen(false);
  };

  const handleLogout = () => {
    logout();
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const isDataMenuActive = ['hari', 'kelas', 'mapel', 'status-kehadiran', 'hari-libur', 'jadwal', 'siswa'].includes(activePage);

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-card border-r border-border transform transition-transform duration-200 ease-in-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        } flex flex-col`}
      >
        <div className="h-16 flex items-center gap-3 px-4 border-b border-border shrink-0">
          <div className="w-9 h-9 relative">
            <Image src="/logo-sekolah.png" alt="Logo" fill className="object-contain" />
          </div>
          <div>
            <h2 className="font-bold text-ocean dark:text-sky-400 text-lg leading-tight">NEIS</h2>
            <p className="text-[10px] text-muted-foreground leading-tight">SMKN Maniis</p>
          </div>
          <button
            className="ml-auto lg:hidden p-1 rounded hover:bg-accent"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <ScrollArea className="flex-1 py-3">
          <nav className="px-3 space-y-1">
            {items.map((item) => {
              if ('children' in item && item.children) {
                return (
                  <Collapsible
                    key={item.label}
                    open={dataMenuOpen || isDataMenuActive}
                    onOpenChange={setDataMenuOpen}
                  >
                    <CollapsibleTrigger asChild>
                      <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-accent transition-colors text-left">
                        <item.icon className="h-4 w-4 shrink-0" />
                        <span className="flex-1">{item.label}</span>
                        <ChevronDown
                          className={`h-4 w-4 shrink-0 transition-transform ${
                            (dataMenuOpen || isDataMenuActive) ? 'rotate-180' : ''
                          }`}
                        />
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="ml-4 mt-1 space-y-0.5">
                      {item.children.map((child) => (
                        <button
                          key={child.id}
                          onClick={() => handleNavigate(child.id)}
                          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                            activePage === child.id
                              ? 'bg-ocean text-white'
                              : 'hover:bg-accent text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          <child.icon className="h-3.5 w-3.5 shrink-0" />
                          <span>{child.label}</span>
                        </button>
                      ))}
                    </CollapsibleContent>
                  </Collapsible>
                );
              }

              return (
                <button
                  key={item.id}
                  onClick={() => handleNavigate(item.id!)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    activePage === item.id
                      ? 'bg-ocean text-white'
                      : 'hover:bg-accent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </ScrollArea>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="h-16 bg-card border-b border-border flex items-center justify-between px-4 shrink-0">
          <button
            className="lg:hidden p-2 rounded-lg hover:bg-accent"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="lg:hidden" />

          <div className="flex items-center gap-2">
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-2 rounded-lg hover:bg-accent transition-colors"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-accent transition-colors">
                  <Avatar className="h-8 w-8">
                    {user?.foto_profile ? (
                      <AvatarImage src={user.foto_profile} alt={user.nama} />
                    ) : null}
                    <AvatarFallback className="bg-ocean text-white text-xs">
                      {user?.nama ? getInitials(user.nama) : 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="hidden sm:block text-left">
                    <p className="text-sm font-medium leading-tight">{user?.nama}</p>
                    <p className="text-[10px] text-muted-foreground capitalize">{user?.role}</p>
                  </div>
                  <ChevronDown className="h-3 w-3 text-muted-foreground hidden sm:block" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {user?.foto_profile && (
                  <DropdownMenuItem onClick={() => setImageOpen(true)}>
                    <Eye className="h-4 w-4 mr-2" /> Lihat Foto
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => handleNavigate('profile')}>
                  <User className="h-4 w-4 mr-2" /> Profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                  <LogOut className="h-4 w-4 mr-2" /> Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>

      {/* Image Preview Modal */}
      <ImageModal open={imageOpen} onClose={() => setImageOpen(false)} src={user?.foto_profile || ''} alt={user?.nama || 'Foto'} />
    </div>
  );
}
