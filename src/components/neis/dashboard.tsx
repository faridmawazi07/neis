'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Users,
  UserCheck,
  ClipboardCheck,
  AlertTriangle,
  CalendarIcon,
  CheckCircle2,
  XCircle,
  PartyPopper,
  List,
  UserPlus,
  Loader2,
  PlusCircle,
} from 'lucide-react';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import type { PageName } from './app-layout';
import { usePagination } from '@/hooks/use-pagination';
import { PaginationBar } from '@/components/neis/pagination-bar';
import { KehadiranForm } from './kehadiran-form';
import { JadwalForm } from './jadwal-form';

interface DashboardProps {
  onNavigate: (page: PageName) => void;
  onDeepNavigate?: (page: PageName, deepLink: string) => void;
  deepLink?: string;
}

export function Dashboard({ onNavigate, onDeepNavigate, deepLink }: DashboardProps) {
  const { user } = useAuthStore();
  const role = user?.role || 'guru';

  const [date, setDate] = useState<Date>(new Date());
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [absenceModalOpen, setAbsenceModalOpen] = useState(false);
  const [absenceModalData, setAbsenceModalData] = useState<{ type: string; students: any[]; kelas: string }>({
    type: '',
    students: [],
    kelas: '',
  });
  const [jadwalFilter, setJadwalFilter] = useState<'all' | 'sudah' | 'belum'>('all');
  const [jamKe, setJamKe] = useState<string>('');
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [jadwalCalendarOpen, setJadwalCalendarOpen] = useState(false);

  // Pending approval modal
  const [approvalModalOpen, setApprovalModalOpen] = useState(false);
  const [approvalRoles, setApprovalRoles] = useState<Record<string, string>>({});
  const [approvalLoading, setApprovalLoading] = useState<string | null>(null);
  const { toast } = useToast();

  // Kehadiran form (guru)
  const [kehadiranFormOpen, setKehadiranFormOpen] = useState(false);
  // Jadwal form (guru)
  const [jadwalFormOpen, setJadwalFormOpen] = useState(false);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const tanggal = format(date, 'yyyy-MM-dd');
      let url = `/api/dashboard?tanggal=${tanggal}`;
      if (jamKe) url += `&jam_ke=${jamKe}`;
      const res = await fetch(url, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setDashboardData(data);
      }
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [date, jamKe]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  useEffect(() => {
    if (deepLink === 'data-pegawai-approve') {
      onNavigate('data-pegawai');
    }
  }, [deepLink, onNavigate]);

  const stats = dashboardData?.stats || {};
  const isHoliday = dashboardData?.isHoliday || false;
  const holidayInfo = dashboardData?.holidayInfo || null;
  const jadwal = dashboardData?.jadwal || [];
  const kehadiranSiswa = dashboardData?.kehadiranSiswa || [];
  const jamKeOptions = dashboardData?.jamKeOptions || [];
  const pendingUsers = dashboardData?.pendingUsers || [];
  const dayName = dashboardData?.dayName || '';
  const siswaPerKelas = dashboardData?.siswaPerKelas || [];

  const showAbsenceModal = (type: string, kelasNama: string, siswaAbsenJson: string) => {
    try {
      const parsed = JSON.parse(siswaAbsenJson || '{}');
      // Handle both old format (string[]) and new format ({id, nama}[])
      const students = (parsed[type] || []).map((item: any) => ({
        nama: typeof item === 'string' ? item : (item.nama || ''),
        id: typeof item === 'string' ? '' : (item.id || ''),
      }));
      setAbsenceModalData({ type, students, kelas: kelasNama });
      setAbsenceModalOpen(true);
    } catch {
      setAbsenceModalData({ type, students: [], kelas: kelasNama });
      setAbsenceModalOpen(true);
    }
  };

  const filteredJadwal = jadwal.filter((j: any) => {
    if (jadwalFilter === 'all') return true;
    if (jadwalFilter === 'sudah') return Number(j.sudah_mengajar) > 0;
    return Number(j.sudah_mengajar) === 0;
  });

  const { pageSize, setPageSize, currentPage, setCurrentPage, totalPages, pageStart, pageEnd, paginatedData } = usePagination(filteredJadwal.length);

  useEffect(() => { setCurrentPage(1); }, [jadwalFilter]);

  const handleApprove = async (userId: string) => {
    const selectedRole = approvalRoles[userId];
    if (!selectedRole) {
      toast({ title: 'Error', description: 'Pilih role terlebih dahulu', variant: 'destructive' });
      return;
    }
    setApprovalLoading(userId);
    try {
      const res = await fetch('/api/users/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: userId, role: selectedRole }),
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: 'Error', description: data.error, variant: 'destructive' });
        return;
      }
      toast({ title: 'Berhasil', description: `${data.data?.nama || 'Pengguna'} disetujui sebagai ${selectedRole}` });
      // Remove from local state
      setApprovalRoles((prev) => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
      fetchDashboard();
    } catch {
      toast({ title: 'Error', description: 'Terjadi kesalahan', variant: 'destructive' });
    } finally {
      setApprovalLoading(null);
    }
  };

  const handleReject = async (userId: string) => {
    setApprovalLoading(userId);
    try {
      const res = await fetch('/api/users/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: userId }),
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: 'Error', description: data.error, variant: 'destructive' });
        return;
      }
      toast({ title: 'Ditolak', description: 'Pendaftaran telah ditolak' });
      setApprovalRoles((prev) => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
      fetchDashboard();
    } catch {
      toast({ title: 'Error', description: 'Terjadi kesalahan', variant: 'destructive' });
    } finally {
      setApprovalLoading(null);
    }
  };

  // Admin Widgets
  const renderAdminWidgets = () => (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <Card className="border-blue-200 dark:border-blue-800 cursor-pointer hover:shadow-md transition-shadow" onClick={() => onNavigate('data-pegawai')}>
        <CardContent className="p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/50">
            <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total Guru</p>
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.totalGuru || 0}</p>
          </div>
        </CardContent>
      </Card>
      <Card className="border-green-200 dark:border-green-800">
        <CardContent className="p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/50">
            <UserCheck className="h-5 w-5 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total Pegawai</p>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.totalPegawai || 0}</p>
          </div>
        </CardContent>
      </Card>
      <Card className="border-teal-200 dark:border-teal-800">
        <CardContent className="p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-teal-100 dark:bg-teal-900/50">
            <ClipboardCheck className="h-5 w-5 text-teal-600 dark:text-teal-400" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Kehadiran Hari Ini</p>
            <p className="text-2xl font-bold text-teal-600 dark:text-teal-400">{stats.kehadiranHariIni || 0}</p>
          </div>
        </CardContent>
      </Card>
      <Card
        className="border-red-200 dark:border-red-800 cursor-pointer hover:shadow-md transition-shadow"
        onClick={() => onDeepNavigate ? onDeepNavigate('data-pegawai', 'data-pegawai-approve') : onNavigate('data-pegawai')}
      >
        <CardContent className="p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/50">
            <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Persetujuan Pending</p>
            <p className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.pendingCount || 0}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // Guru Widgets
  const renderGuruWidgets = () => (
    <div className="grid grid-cols-2 gap-4 mb-6">
      <Card className="border-ocean/30 dark:border-sky-800">
        <CardContent className="p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-ocean/10 dark:bg-sky-900/50">
            <CalendarIcon className="h-5 w-5 text-ocean dark:text-sky-400" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Jadwal Hari Ini</p>
            <p className="text-2xl font-bold text-ocean dark:text-sky-400">{jadwal.length}</p>
          </div>
        </CardContent>
      </Card>
      <Card className="border-teal-200 dark:border-teal-800">
        <CardContent className="p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-teal-100 dark:bg-teal-900/50">
            <ClipboardCheck className="h-5 w-5 text-teal-600 dark:text-teal-400" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Kehadiran Bulan Ini</p>
            <p className="text-2xl font-bold text-teal-600 dark:text-teal-400">{stats.kehadiranBulanIni || 0}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // Pegawai/Pimpinan Widgets
  const renderPegawaiWidgets = () => (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
      <Card
        className="border-amber-200 dark:border-amber-800 cursor-pointer hover:shadow-md transition-shadow"
        onClick={() => setApprovalModalOpen(true)}
      >
        <CardContent className="p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/50">
            <UserPlus className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Persetujuan Pending</p>
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{stats.pendingCount || 0}</p>
          </div>
        </CardContent>
      </Card>
      <Card className="border-teal-200 dark:border-teal-800">
        <CardContent className="p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-teal-100 dark:bg-teal-900/50">
            <ClipboardCheck className="h-5 w-5 text-teal-600 dark:text-teal-400" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Kehadiran Hari Ini</p>
            <p className="text-2xl font-bold text-teal-600 dark:text-teal-400">{stats.kehadiranHariIni || 0}</p>
          </div>
        </CardContent>
      </Card>
      <Card className="border-blue-200 dark:border-blue-800">
        <CardContent className="p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/50">
            <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Jumlah Guru</p>
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.totalGuru || 0}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderKehadiranSiswa = () => {
    const canExport = role === 'pegawai' || role === 'pimpinan' || role === 'admin';

    const handleExportPDF = async () => {
      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');
      const doc = new jsPDF();
      doc.setFontSize(14);
      doc.text('Kehadiran Siswa', 14, 15);
      doc.setFontSize(10);
      doc.text(`Tanggal: ${format(date, 'dd MMMM yyyy', { locale: idLocale })}`, 14, 22);

      const totalHadir = kehadiranSiswa.reduce((sum: number, k: any) => sum + (Number(k.jumlah_hadir) || 0), 0);
      const totalIzinSakit = kehadiranSiswa.reduce((sum: number, k: any) => sum + (Number(k.jumlah_izin_sakit) || 0), 0);
      const totalAlfa = kehadiranSiswa.reduce((sum: number, k: any) => sum + (Number(k.jumlah_alfa) || 0), 0);
      const totalSiswa = kehadiranSiswa.reduce((sum: number, k: any) => sum + (Number(k.jumlah_siswa_total) || 0), 0);

      // Summary table
      autoTable(doc, {
        startY: 28,
        head: [['Kelas', 'Hadir', 'Izin/Sakit', 'Alfa', 'Jumlah']],
        body: [
          ...kehadiranSiswa.map((k: any) => [
            k.nama_kelas,
            k.jumlah_hadir || 0,
            k.jumlah_izin_sakit || 0,
            k.jumlah_alfa || 0,
            k.jumlah_siswa_total || 0,
          ]),
          ['Jumlah Total', totalHadir, totalIzinSakit, totalAlfa, totalSiswa],
        ],
        didParseCell: (data: any) => {
          if (data.row.index === kehadiranSiswa.length) {
            data.cell.styles.fontStyle = 'bold';
          }
        },
      });

      // Detail: names of Izin/Sakit & Alfa students per class
      const normalizeNames = (arr: any[]): string[] => arr.map((item: any) => typeof item === 'string' ? item : (item.nama || ''));
      const detailRows: string[][] = [];
      kehadiranSiswa.forEach((k: any) => {
        let izinSakit: string[] = [];
        let alfa: string[] = [];
        try {
          const parsed = JSON.parse(k.siswa_absen_json || '{}');
          izinSakit = normalizeNames(parsed.izin_sakit || []);
          alfa = normalizeNames(parsed.alfa || []);
        } catch {}
        if (izinSakit.length > 0 || alfa.length > 0) {
          detailRows.push([
            k.nama_kelas,
            izinSakit.length > 0 ? izinSakit.join(', ') : '-',
            alfa.length > 0 ? alfa.join(', ') : '-',
          ]);
        }
      });

      if (detailRows.length > 0) {
        const finalY = (doc as any).lastAutoTable?.finalY || 60;
        autoTable(doc, {
          startY: finalY + 10,
          head: [['Kelas', 'Izin/Sakit', 'Alfa']],
          body: detailRows,
          styles: { fontSize: 8 },
          headStyles: { fillColor: [100, 100, 100] },
          columnStyles: {
            0: { cellWidth: 30 },
            1: { cellWidth: 75 },
            2: { cellWidth: 75 },
          },
        });
      }

      doc.save(`kehadiran-siswa-${format(date, 'yyyy-MM-dd')}.pdf`);
    };

    const handleExportExcel = async () => {
      const XLSX = await import('xlsx');
      const normalizeNames = (arr: any[]): string[] => arr.map((item: any) => typeof item === 'string' ? item : (item.nama || ''));
      const wsData: any[][] = [['Kelas', 'Hadir', 'Izin/Sakit', 'Alfa', 'Jumlah', 'Nama Izin/Sakit', 'Nama Alfa']];
      kehadiranSiswa.forEach((k: any) => {
        let izinSakit: string[] = [];
        let alfa: string[] = [];
        try {
          const parsed = JSON.parse(k.siswa_absen_json || '{}');
          izinSakit = normalizeNames(parsed.izin_sakit || []);
          alfa = normalizeNames(parsed.alfa || []);
        } catch {}
        wsData.push([
          k.nama_kelas,
          k.jumlah_hadir || 0,
          k.jumlah_izin_sakit || 0,
          k.jumlah_alfa || 0,
          k.jumlah_siswa_total || 0,
          izinSakit.length > 0 ? izinSakit.join(', ') : '-',
          alfa.length > 0 ? alfa.join(', ') : '-',
        ]);
      });
      // Add Jumlah Total row
      wsData.push([
        'Jumlah Total',
        kehadiranSiswa.reduce((sum: number, k: any) => sum + (Number(k.jumlah_hadir) || 0), 0),
        kehadiranSiswa.reduce((sum: number, k: any) => sum + (Number(k.jumlah_izin_sakit) || 0), 0),
        kehadiranSiswa.reduce((sum: number, k: any) => sum + (Number(k.jumlah_alfa) || 0), 0),
        kehadiranSiswa.reduce((sum: number, k: any) => sum + (Number(k.jumlah_siswa_total) || 0), 0),
        '',
        '',
      ]);
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      // Set column widths
      ws['!cols'] = [
        { wch: 12 },  // Kelas
        { wch: 8 },   // Hadir
        { wch: 12 },  // Izin/Sakit
        { wch: 8 },   // Alfa
        { wch: 8 },   // Jumlah
        { wch: 40 },  // Nama Izin/Sakit
        { wch: 40 },  // Nama Alfa
      ];
      XLSX.utils.book_append_sheet(wb, ws, 'Kehadiran Siswa');
      XLSX.writeFile(wb, `kehadiran-siswa-${format(date, 'yyyy-MM-dd')}.xlsx`);
    };

    return (
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <CardTitle className="text-base">Kehadiran Siswa</CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1">
                    <CalendarIcon className="h-3.5 w-3.5" />
                    {format(date, 'dd MMM yyyy', { locale: idLocale })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={(d) => { if (d) { setDate(d); setJamKe(''); setCalendarOpen(false); } }}
                  />
                </PopoverContent>
              </Popover>
              <Select value={jamKe} onValueChange={(v) => setJamKe(v === 'all' ? '' : v)}>
                <SelectTrigger className="w-[110px] h-9">
                  <SelectValue placeholder="Semua Jam" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Jam</SelectItem>
                  {jamKeOptions.map((jk: string) => (
                    <SelectItem key={jk} value={jk}>Jam ke-{jk}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {canExport && (
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" onClick={handleExportPDF}>PDF</Button>
                  <Button variant="outline" size="sm" onClick={handleExportExcel}>Excel</Button>
                </div>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {kehadiranSiswa.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Belum ada data kehadiran siswa</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Kelas</TableHead>
                    <TableHead className="text-center">Hadir</TableHead>
                    <TableHead className="text-center">Izin/Sakit</TableHead>
                    <TableHead className="text-center">Alfa</TableHead>
                    <TableHead className="text-center">Jumlah</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {kehadiranSiswa.map((k: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{k.nama_kelas}</TableCell>
                      <TableCell className="text-center">{k.jumlah_hadir || 0}</TableCell>
                      <TableCell className="text-center">
                        <button
                          className="hover:underline text-ocean dark:text-sky-400 cursor-pointer disabled:cursor-default disabled:no-underline disabled:text-foreground"
                          disabled={!k.jumlah_izin_sakit || Number(k.jumlah_izin_sakit) === 0}
                          onClick={() => showAbsenceModal('izin_sakit', k.nama_kelas, k.siswa_absen_json)}
                        >
                          {k.jumlah_izin_sakit || 0}
                        </button>
                      </TableCell>
                      <TableCell className="text-center">
                        <button
                          className="hover:underline text-destructive cursor-pointer disabled:cursor-default disabled:no-underline disabled:text-foreground"
                          disabled={!k.jumlah_alfa || Number(k.jumlah_alfa) === 0}
                          onClick={() => showAbsenceModal('alfa', k.nama_kelas, k.siswa_absen_json)}
                        >
                          {k.jumlah_alfa || 0}
                        </button>
                      </TableCell>
                      <TableCell className="text-center">{k.jumlah_siswa_total || 0}</TableCell>
                    </TableRow>
                  ))}
                  {kehadiranSiswa.length > 0 && (
                    <TableRow className="font-bold bg-muted/50">
                      <TableCell>Jumlah Total</TableCell>
                      <TableCell className="text-center">{kehadiranSiswa.reduce((sum: number, k: any) => sum + (Number(k.jumlah_hadir) || 0), 0)}</TableCell>
                      <TableCell className="text-center">{kehadiranSiswa.reduce((sum: number, k: any) => sum + (Number(k.jumlah_izin_sakit) || 0), 0)}</TableCell>
                      <TableCell className="text-center">{kehadiranSiswa.reduce((sum: number, k: any) => sum + (Number(k.jumlah_alfa) || 0), 0)}</TableCell>
                      <TableCell className="text-center">{kehadiranSiswa.reduce((sum: number, k: any) => sum + (Number(k.jumlah_siswa_total) || 0), 0)}</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderJadwalPembelajaran = () => (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">Jadwal Pembelajaran</CardTitle>
            {role === 'guru' && (
              <Button
                size="sm"
                className="bg-ocean hover:bg-ocean-dark text-white h-7 text-xs rounded-full px-3"
                onClick={() => setJadwalFormOpen(true)}
              >
                <PlusCircle className="h-3.5 w-3.5 mr-1" />
                Tambah
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Popover open={jadwalCalendarOpen} onOpenChange={setJadwalCalendarOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1">
                  <CalendarIcon className="h-3.5 w-3.5" />
                  {format(date, 'dd MMM yyyy', { locale: idLocale })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar mode="single" selected={date} onSelect={(d) => { if (d) { setDate(d); setJadwalCalendarOpen(false); } }} />
              </PopoverContent>
            </Popover>
            <div className="flex items-center gap-1 text-xs">
              {jadwalFilter !== 'all' && (
                <button
                  className="flex items-center gap-1 px-2 py-1 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-300 dark:hover:bg-slate-600"
                  onClick={() => setJadwalFilter('all')}
                >
                  <List className="h-3 w-3" /> <span>Tampilkan Semua</span>
                </button>
              )}
              <button
                className={`flex items-center gap-1 px-2 py-1 rounded ${jadwalFilter === 'sudah' ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-400 font-medium' : 'hover:bg-accent'}`}
                onClick={() => setJadwalFilter('sudah')}
              >
                <CheckCircle2 className="h-3 w-3" /> <span className="text-green-600 dark:text-green-400">✓ Sudah Mengajar</span>
              </button>
              <button
                className={`flex items-center gap-1 px-2 py-1 rounded ${jadwalFilter === 'belum' ? 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-400 font-medium' : 'hover:bg-accent'}`}
                onClick={() => setJadwalFilter('belum')}
              >
                <XCircle className="h-3 w-3" /> <span className="text-red-600 dark:text-red-400">✗ Tidak Mengajar</span>
              </button>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isHoliday ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <PartyPopper className="h-10 w-10 text-yellow-500 mb-2" />
            <p className="font-semibold">Hari Libur!</p>
            <p className="text-sm text-muted-foreground">{holidayInfo?.keterangan || 'Tidak ada jadwal hari ini'}</p>
          </div>
        ) : filteredJadwal.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Tidak ada jadwal untuk hari ini</p>
        ) : (
        <>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>No</TableHead>
                  {role !== 'guru' && <TableHead>Guru</TableHead>}
                  <TableHead>Kelas</TableHead>
                  <TableHead>Mapel</TableHead>
                  <TableHead>Jam Ke</TableHead>
                  <TableHead>Jam</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedData(filteredJadwal).map((j: any, i: number) => (
                  <TableRow key={i}>
                    <TableCell>{(currentPage - 1) * pageSize + i + 1}</TableCell>
                    {role !== 'guru' && <TableCell>{j.guru_nama}</TableCell>}
                    <TableCell>{j.nama_kelas}</TableCell>
                    <TableCell>{j.nama_mapel}</TableCell>
                    <TableCell>{j.jam_ke}</TableCell>
                    <TableCell>{j.jam_mulai} - {j.jam_selesai}</TableCell>
                    <TableCell className="text-center">
                      {Number(j.sudah_mengajar) > 0 ? (
                        <Badge className="bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400 hover:bg-green-100">✓</Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400 hover:bg-red-100">✗</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <PaginationBar
            pageSize={pageSize}
            onPageSizeChange={setPageSize}
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredJadwal.length}
            pageStart={pageStart}
            pageEnd={pageEnd}
            onPageChange={setCurrentPage}
          />
        </>
        )}
      </CardContent>
    </Card>
  );

  if (loading && !dashboardData) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-ocean" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">Dashboard</h1>

      {/* Siswa + Mengajar Bar */}
      <div className="flex items-center gap-2 mb-4">
        {siswaPerKelas.length > 0 && (
          <Popover>
            <PopoverTrigger asChild>
              <button className="text-sm bg-ocean/10 text-ocean dark:text-sky-400 dark:bg-sky-900/30 px-3 py-1.5 rounded-full font-medium hover:bg-ocean/20 dark:hover:bg-sky-900/50 transition-colors flex items-center gap-1.5 cursor-pointer">
                <Users className="h-3.5 w-3.5" />
                Jumlah Siswa: <strong>{stats.totalSiswa || 0}</strong>
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-0" align="start">
              <div className="p-3 border-b">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm">Jumlah Siswa</span>
                  <span className="text-sm font-bold text-ocean dark:text-sky-400">{stats.totalSiswa || 0}</span>
                </div>
                <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                  <span className="text-blue-600 dark:text-blue-400">♂ L: {stats.totalLaki || 0}</span>
                  <span className="text-pink-600 dark:text-pink-400">♀ P: {stats.totalPerempuan || 0}</span>
                </div>
                <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t">
                  <span className="font-semibold text-sm">Jumlah Kelas</span>
                  <span className="text-sm font-bold text-ocean dark:text-sky-400">{siswaPerKelas.length}</span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {(() => {
                    const gradeMap: Record<string, number> = {};
                    siswaPerKelas.forEach((k: any) => {
                      const grade = k.nama_kelas.substring(0, 2).trim();
                      gradeMap[grade] = (gradeMap[grade] || 0) + 1;
                    });
                    const grades = Object.entries(gradeMap).sort(([a], [b]) => a.localeCompare(b));
                    return grades.map(([grade, count], i) => (
                      <span key={grade}>
                        {i > 0 && ' · '}
                        Kelas {grade}: {count}
                      </span>
                    ));
                  })()}
                </div>
              </div>
              <div className="max-h-64 overflow-y-auto">
                {siswaPerKelas.map((k: any) => (
                  <div key={k.kelas_id} className="flex items-center justify-between px-3 py-2 hover:bg-accent/50 text-sm border-b last:border-b-0">
                    <span className="font-medium">{k.nama_kelas}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-blue-600 dark:text-blue-400">♂ {k.laki}</span>
                      <span className="text-xs text-pink-600 dark:text-pink-400">♀ {k.perempuan}</span>
                      <span className="font-bold text-ocean dark:text-sky-400 min-w-[20px] text-right">{k.total}</span>
                    </div>
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        )}
        {role === 'guru' && (() => {
          const now = new Date();
          const jakartaOffset = 7 * 60;
          const jakartaTime = new Date(now.getTime() + (jakartaOffset + now.getTimezoneOffset()) * 60000);
          const dayOfWeek = jakartaTime.getDay();
          const hours = jakartaTime.getHours();
          const minutes = jakartaTime.getMinutes();
          const currentTime = hours * 60 + minutes;
          const isWorkHour = dayOfWeek !== 0 && dayOfWeek !== 6 && currentTime >= 420 && currentTime <= 1200;
          const canMengajar = isWorkHour && !isHoliday;
          return canMengajar ? (
            <Button
              size="sm"
              className="bg-ocean hover:bg-ocean-dark text-white h-7 text-xs rounded-full px-3"
              onClick={() => setKehadiranFormOpen(true)}
            >
              <PlusCircle className="h-3.5 w-3.5 mr-1" />
              Mengajar
            </Button>
          ) : null;
        })()}
      </div>

      {role === 'admin' && renderAdminWidgets()}
      {role === 'guru' && renderGuruWidgets()}
      {(role === 'pegawai' || role === 'pimpinan') && renderPegawaiWidgets()}

      {renderKehadiranSiswa()}
      {renderJadwalPembelajaran()}

      {/* Absence Detail Modal */}
      <Dialog open={absenceModalOpen} onOpenChange={setAbsenceModalOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {absenceModalData.type === 'izin_sakit' ? 'Izin/Sakit' : 'Alfa'} - {absenceModalData.kelas}
            </DialogTitle>
            <DialogDescription className="sr-only">Daftar siswa {absenceModalData.type}</DialogDescription>
          </DialogHeader>
          {absenceModalData.students.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Tidak ada data siswa</p>
          ) : (
            <>
              <ul className="space-y-1 max-h-64 overflow-y-auto">
                {absenceModalData.students.map((s: any, i: number) => (
                  <li key={i} className="text-sm p-2 rounded bg-accent/50">
                    {s.nama}
                  </li>
                ))}
              </ul>
              <div className="flex items-center justify-between pt-3 mt-3 border-t">
                <span className="text-sm font-medium text-muted-foreground">Jumlah</span>
                <span className="text-sm font-bold">{absenceModalData.students.length} siswa</span>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Pending Approval Modal */}
      <Dialog open={approvalModalOpen} onOpenChange={setApprovalModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-amber-500" />
              Persetujuan Pendaftar
            </DialogTitle>
            <DialogDescription className="sr-only">Setujui atau tolak pendaftar baru dan tentukan role-nya</DialogDescription>
          </DialogHeader>
          {pendingUsers.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle2 className="h-10 w-10 text-green-500 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Tidak ada pendaftar yang menunggu persetujuan</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              {pendingUsers.map((u: any) => (
                <div
                  key={u.id}
                  className="border rounded-lg p-3 space-y-2"
                >
                  <div className="flex items-center gap-3">
                    {u.foto_profile ? (
                      <img src={u.foto_profile} alt={u.nama} className="w-9 h-9 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-sm font-medium text-muted-foreground shrink-0">
                        {(u.nama || '?')[0]?.toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{u.nama}</p>
                      <p className="text-xs text-muted-foreground">NIP: {u.nip || '-'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select
                      value={approvalRoles[u.id] || ''}
                      onValueChange={(val) => setApprovalRoles((prev) => ({ ...prev, [u.id]: val }))}
                    >
                      <SelectTrigger className="h-8 text-xs flex-1">
                        <SelectValue placeholder="Pilih Role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="guru">Guru</SelectItem>
                        <SelectItem value="pegawai">Pegawai</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      className="h-8 text-xs bg-green-600 hover:bg-green-700 text-white"
                      disabled={!approvalRoles[u.id] || approvalLoading === u.id}
                      onClick={() => handleApprove(u.id)}
                    >
                      {approvalLoading === u.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Setujui'}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-8 text-xs"
                      disabled={approvalLoading === u.id}
                      onClick={() => handleReject(u.id)}
                    >
                      Tolak
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Kehadiran Form (Guru) */}
      {role === 'guru' && (
        <KehadiranForm
          open={kehadiranFormOpen}
          onClose={() => setKehadiranFormOpen(false)}
          onSuccess={fetchDashboard}
        />
      )}

      {/* Jadwal Form (Guru) */}
      {role === 'guru' && (
        <JadwalForm
          open={jadwalFormOpen}
          onClose={() => setJadwalFormOpen(false)}
          onSuccess={fetchDashboard}
        />
      )}

    </div>
  );
}
