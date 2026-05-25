'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Search, CalendarIcon, Plus, Download, FileSpreadsheet, Edit, Trash2, Eye, FileText, Filter } from 'lucide-react';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { KehadiranForm } from './kehadiran-form';
import { ImageModal } from './image-modal';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export function KehadiranPage() {
  const { user } = useAuthStore();
  const { toast } = useToast();
  const role = user?.role || 'guru';

  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Date filters
  const [tanggalGuru, setTanggalGuru] = useState<Date>(new Date());
  const [tanggalFrom, setTanggalFrom] = useState<Date>(new Date());
  const [tanggalTo, setTanggalTo] = useState<Date>(new Date());

  // Kelas filter
  const [kelasList, setKelasList] = useState<any[]>([]);
  const [selectedKelasId, setSelectedKelasId] = useState<string>('all');

  // Form
  const [formOpen, setFormOpen] = useState(false);
  const [editData, setEditData] = useState<any>(null);

  // Image modal
  const [imageModalSrc, setImageModalSrc] = useState('');
  const [imageModalOpen, setImageModalOpen] = useState(false);

  // Delete
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Materi popup
  const [materiPopup, setMateriPopup] = useState<string>('');

  // Holiday check
  const [isHoliday, setIsHoliday] = useState(false);
  const [outsideWorkHours, setOutsideWorkHours] = useState(false);

  const isGuru = role === 'guru';
  const canExport = role === 'admin' || role === 'pegawai' || role === 'pimpinan';
  const canAdd = isGuru;
  const canEdit = isGuru || role === 'admin';
  const canDelete = role === 'admin';

  // Fetch kelas list
  const fetchKelas = useCallback(async () => {
    try {
      const res = await fetch('/api/kelas', { credentials: 'include' });
      if (res.ok) {
        const result = await res.json();
        setKelasList(result.data || []);
      }
    } catch (err) {
      console.error('Fetch kelas error:', err);
    }
  }, []);

  useEffect(() => {
    fetchKelas();
  }, [fetchKelas]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      let url = '/api/kehadiran-mengajar?';
      if (isGuru) {
        url += `guru_id=${user?.id}&tanggal=${format(tanggalGuru, 'yyyy-MM-dd')}`;
      } else {
        url += `tanggal_from=${format(tanggalFrom, 'yyyy-MM-dd')}&tanggal_to=${format(tanggalTo, 'yyyy-MM-dd')}`;
        if (search) url += `&search=${encodeURIComponent(search)}`;
      }
      if (selectedKelasId && selectedKelasId !== 'all') {
        url += `&kelas_id=${selectedKelasId}`;
      }
      const res = await fetch(url, { credentials: 'include' });
      if (res.ok) {
        const result = await res.json();
        setData(result.data || []);
      }
    } catch (err) {
      console.error('Fetch kehadiran error:', err);
    } finally {
      setLoading(false);
    }
  }, [isGuru, user?.id, tanggalGuru, tanggalFrom, tanggalTo, search, selectedKelasId]);

  const checkHoliday = useCallback(async () => {
    if (!isGuru) return;
    try {
      const tgl = format(tanggalGuru, 'yyyy-MM-dd');
      const res = await fetch(`/api/hari-libur?tanggal=${tgl}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setIsHoliday(data.isHoliday || false);
      }
      // Check work hours
      const now = new Date();
      const jakartaOffset = 7 * 60;
      const jakartaTime = new Date(now.getTime() + (jakartaOffset + now.getTimezoneOffset()) * 60000);
      const dayOfWeek = jakartaTime.getDay();
      const hours = jakartaTime.getHours();
      const minutes = jakartaTime.getMinutes();
      const currentTime = hours * 60 + minutes;
      setOutsideWorkHours(dayOfWeek === 0 || dayOfWeek === 6 || currentTime < 360 || currentTime > 1200);
    } catch {}
  }, [isGuru, tanggalGuru]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    checkHoliday();
  }, [checkHoliday]);

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const res = await fetch('/api/kehadiran-mengajar', {
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
      toast({ title: 'Berhasil', description: 'Kehadiran berhasil dihapus' });
      setDeleteId(null);
      fetchData();
    } catch {
      toast({ title: 'Error', description: 'Terjadi kesalahan', variant: 'destructive' });
    }
  };

  const handleExportPDF = async () => {
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text('Kehadiran Mengajar', 14, 15);
    doc.setFontSize(10);
    if (isGuru) {
      doc.text(`Tanggal: ${format(tanggalGuru, 'dd MMMM yyyy', { locale: idLocale })}`, 14, 22);
    } else {
      doc.text(`Periode: ${format(tanggalFrom, 'dd MMM yyyy')} - ${format(tanggalTo, 'dd MMM yyyy')}`, 14, 22);
    }
    autoTable(doc, {
      startY: 28,
      head: [['Tanggal', 'Guru', 'Kelas', 'Mapel', 'Hadir', 'I/S', 'Alfa', 'Jumlah', 'Materi', 'Jam Ke', 'Waktu', 'Status']],
      body: data.map((d) => [
        d.tanggal,
        d.guru_nama,
        d.nama_kelas,
        d.nama_mapel,
        d.jumlah_hadir,
        d.jumlah_izin_sakit,
        d.jumlah_alfa,
        d.jumlah_siswa_total || (d.jumlah_hadir + d.jumlah_izin_sakit + d.jumlah_alfa),
        d.materi_pembelajaran || '-',
        d.jam_ke,
        d.jam_mulai && d.jam_selesai ? `${d.jam_mulai} - ${d.jam_selesai}` : '-',
        d.nama_status,
      ]),
    });
    doc.save('kehadiran-mengajar.pdf');
  };

  const handleExportExcel = async () => {
    const XLSX = await import('xlsx');
    const wsData = [['Tanggal', 'Guru', 'Kelas', 'Mapel', 'Hadir', 'I/S', 'Alfa', 'Jumlah', 'Materi', 'Jam Ke', 'Waktu', 'Status']];
    data.forEach((d) => {
      wsData.push([d.tanggal, d.guru_nama, d.nama_kelas, d.nama_mapel, d.jumlah_hadir, d.jumlah_izin_sakit, d.jumlah_alfa, d.jumlah_siswa_total || (d.jumlah_hadir + d.jumlah_izin_sakit + d.jumlah_alfa), d.materi_pembelajaran || '-', d.jam_ke, d.jam_mulai && d.jam_selesai ? `${d.jam_mulai} - ${d.jam_selesai}` : '-', d.nama_status]);
    });
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, 'Kehadiran');
    XLSX.writeFile(wb, 'kehadiran-mengajar.xlsx');
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <h1 className="text-xl font-bold">Kehadiran Mengajar</h1>
        <div className="flex items-center gap-2 flex-wrap">
          {canAdd && !isHoliday && !outsideWorkHours && (
            <Button
              onClick={() => { setEditData(null); setFormOpen(true); }}
              size="sm"
              className="bg-ocean hover:bg-ocean-dark text-white"
            >
              <Plus className="h-4 w-4 mr-1" /> Tambah
            </Button>
          )}
          {canExport && (
            <>
              <Button variant="outline" size="sm" onClick={handleExportPDF}>
                <Download className="h-4 w-4 mr-1" /> PDF
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportExcel}>
                <FileSpreadsheet className="h-4 w-4 mr-1" /> Excel
              </Button>
            </>
          )}
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              {isGuru ? (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-1 w-fit">
                      <CalendarIcon className="h-3.5 w-3.5" />
                      {format(tanggalGuru, 'dd MMM yyyy', { locale: idLocale })}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={tanggalGuru} onSelect={(d) => d && setTanggalGuru(d)} />
                  </PopoverContent>
                </Popover>
              ) : (
                <>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-1">
                        <CalendarIcon className="h-3.5 w-3.5" />
                        Dari: {format(tanggalFrom, 'dd MMM yyyy')}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={tanggalFrom} onSelect={(d) => d && setTanggalFrom(d)} />
                    </PopoverContent>
                  </Popover>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-1">
                        <CalendarIcon className="h-3.5 w-3.5" />
                        Sampai: {format(tanggalTo, 'dd MMM yyyy')}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={tanggalTo} onSelect={(d) => d && setTanggalTo(d)} />
                    </PopoverContent>
                  </Popover>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Cari guru..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-9 w-48"
                      size={20}
                    />
                  </div>
                </>
              )}
              <Select value={selectedKelasId} onValueChange={setSelectedKelasId}>
                <SelectTrigger className="w-[160px] h-9">
                  <Filter className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
                  <SelectValue placeholder="Semua Kelas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Kelas</SelectItem>
                  {kelasList.map((k) => (
                    <SelectItem key={k.id} value={k.id}>{k.nama_kelas}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isHoliday && isGuru && (
            <div className="text-center py-6 text-muted-foreground">
              <p className="font-medium">Hari Libur</p>
              <p className="text-sm">Tidak dapat mengisi kehadiran pada hari libur</p>
            </div>
          )}

          {!isHoliday && loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-ocean" />
            </div>
          ) : data.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Belum ada data kehadiran</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {!isGuru && <TableHead>Tanggal</TableHead>}
                    {!isGuru && <TableHead>Guru</TableHead>}
                    <TableHead>Kelas</TableHead>
                    <TableHead>Mapel</TableHead>
                    <TableHead className="text-center">Hadir</TableHead>
                    <TableHead className="text-center">I/S</TableHead>
                    <TableHead className="text-center">Alfa</TableHead>
                    <TableHead className="text-center">Jumlah</TableHead>
                    <TableHead>Materi</TableHead>
                    <TableHead>Jam Ke</TableHead>
                    <TableHead>Waktu</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Foto</TableHead>
                    {(canEdit || canDelete) && <TableHead>Aksi</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((d) => (
                    <TableRow key={d.id}>
                      {!isGuru && <TableCell className="text-xs">{d.tanggal}</TableCell>}
                      {!isGuru && (
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {d.guru_foto && (
                              <button type="button" onClick={() => { setImageModalSrc(d.guru_foto); setImageModalOpen(true); }} className="hover:ring-2 hover:ring-ocean rounded-full transition-all">
                                <img src={d.guru_foto} alt={d.guru_nama} className="w-7 h-7 rounded-full object-cover" />
                              </button>
                            )}
                            <div>
                              <p className="text-sm font-medium">{d.guru_nama}</p>
                              <p className="text-xs text-muted-foreground">{d.guru_nip}</p>
                            </div>
                          </div>
                        </TableCell>
                      )}
                      <TableCell>{d.nama_kelas}</TableCell>
                      <TableCell>{d.nama_mapel}</TableCell>
                      <TableCell className="text-center">{d.jumlah_hadir}</TableCell>
                      <TableCell className="text-center">{d.jumlah_izin_sakit}</TableCell>
                      <TableCell className="text-center">{d.jumlah_alfa}</TableCell>
                      <TableCell className="text-center">{d.jumlah_siswa_total || (d.jumlah_hadir + d.jumlah_izin_sakit + d.jumlah_alfa)}</TableCell>
                      <TableCell>
                        {d.materi_pembelajaran ? (
                          <button
                            type="button"
                            onClick={() => setMateriPopup(d.materi_pembelajaran)}
                            className="text-left text-xs text-muted-foreground hover:text-foreground transition-colors max-w-[120px] truncate block cursor-pointer"
                            title={d.materi_pembelajaran}
                          >
                            {d.materi_pembelajaran}
                          </button>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>{d.jam_ke}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap">{d.jam_mulai && d.jam_selesai ? `${d.jam_mulai} - ${d.jam_selesai}` : '-'}</TableCell>
                      <TableCell>{d.nama_status}</TableCell>
                      <TableCell>
                        {d.foto_mengajar && (
                          <button type="button" onClick={() => { setImageModalSrc(d.foto_mengajar); setImageModalOpen(true); }} className="hover:ring-2 hover:ring-ocean rounded transition-all">
                            <img src={d.foto_mengajar} alt="Foto" className="w-10 h-10 rounded object-cover" />
                          </button>
                        )}
                      </TableCell>
                      {(canEdit || canDelete) && (
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {canEdit && (isGuru || role === 'admin') && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => { setEditData(d); setFormOpen(true); }}
                              >
                                <Edit className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            {canDelete && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive"
                                onClick={() => setDeleteId(d.id)}
                              >
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

      {/* Kehadiran Form Modal */}
      <KehadiranForm
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditData(null); }}
        onSuccess={fetchData}
        editData={editData}
      />

      {/* Image Modal */}
      <ImageModal
        open={imageModalOpen}
        onClose={() => setImageModalOpen(false)}
        src={imageModalSrc}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Kehadiran?</AlertDialogTitle>
            <AlertDialogDescription>
              Data kehadiran yang dihapus tidak dapat dikembalikan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Materi Popup */}
      <Dialog open={!!materiPopup} onOpenChange={(open) => { if (!open) setMateriPopup(''); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-ocean" /> Materi Pembelajaran
            </DialogTitle>
          </DialogHeader>
          <div className="text-sm whitespace-pre-wrap leading-relaxed max-h-[60vh] overflow-y-auto">
            {materiPopup}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
