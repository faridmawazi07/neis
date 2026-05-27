'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Camera, Image as ImageIcon, Lock, SwitchCamera, X } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { compressFile, compressImage } from '@/lib/image-compress';
import { useToast } from '@/hooks/use-toast';
import { StudentAbsenceModal } from './student-absence-modal';
import { ImageModal } from './image-modal';
import { format } from 'date-fns';

interface KehadiranFormProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editData?: any;
}

export function KehadiranForm({ open, onClose, onSuccess, editData }: KehadiranFormProps) {
  const { user } = useAuthStore();
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [hariList, setHariList] = useState<any[]>([]);
  const [jadwalList, setJadwalList] = useState<any[]>([]);
  const [statusKehadiranList, setStatusKehadiranList] = useState<any[]>([]);
  const [siswaList, setSiswaList] = useState<any[]>([]);
  const [kelasList, setKelasList] = useState<any[]>([]);

  // Form state
  const [selectedJadwalId, setSelectedJadwalId] = useState('');
  const [selectedStatusKehadiranId, setSelectedStatusKehadiranId] = useState('');
  const [materiPembelajaran, setMateriPembelajaran] = useState('');
  const [fotoMengajar, setFotoMengajar] = useState<string | null>(null);
  const [jumlahHadir, setJumlahHadir] = useState(0);
  const [jumlahIzinSakit, setJumlahIzinSakit] = useState(0);
  const [jumlahAlfa, setJumlahAlfa] = useState(0);
  const [jumlahSiswaTotal, setJumlahSiswaTotal] = useState(0);
  const [siswaAbsenJson, setSiswaAbsenJson] = useState<{ izin_sakit: string[]; alfa: string[] }>({ izin_sakit: [], alfa: [] });

  const [absenceModalOpen, setAbsenceModalOpen] = useState(false);
  const [absenceType, setAbsenceType] = useState<'izin_sakit' | 'alfa'>('izin_sakit');
  const [isHoliday, setIsHoliday] = useState(false);
  const [outsideWorkHours, setOutsideWorkHours] = useState(false);

  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  // Image modal for foto mengajar preview
  const [imageOpen, setImageOpen] = useState(false);

  // Camera dialog (WebRTC for desktop)
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraFacing, setCameraFacing] = useState<'user' | 'environment'>('environment');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const today = new Date();
  const todayDayName = dayNames[today.getDay()];
  const todayStr = format(today, 'yyyy-MM-dd');

  // Find selected jadwal, with fallback to editData for display fields
  const jadwalFromList = jadwalList.find((j) => j.id === selectedJadwalId);
  const selectedJadwal = jadwalFromList || (editData ? {
    id: editData.jadwal_id,
    kelas_id: editData.kelas_id,
    nama_kelas: editData.nama_kelas,
    nama_mapel: editData.nama_mapel,
    jam_ke: editData.jam_ke,
    jam_mulai: editData.jam_mulai,
    jam_selesai: editData.jam_selesai,
  } : undefined);

  const fetchData = useCallback(async () => {
    try {
      const [hariRes, statusRes, kelasRes] = await Promise.all([
        fetch('/api/hari', { credentials: 'include' }),
        fetch('/api/status-kehadiran', { credentials: 'include' }),
        fetch('/api/kelas', { credentials: 'include' }),
      ]);
      if (hariRes.ok) setHariList((await hariRes.json()).data || []);
      if (statusRes.ok) setStatusKehadiranList((await statusRes.json()).data || []);
      if (kelasRes.ok) setKelasList((await kelasRes.json()).data || []);

      // Check holiday
      const holidayRes = await fetch(`/api/hari-libur?tanggal=${todayStr}`, { credentials: 'include' });
      if (holidayRes.ok) {
        const hData = await holidayRes.json();
        setIsHoliday(hData.isHoliday || false);
      }

      // Check work hours for guru
      if (user?.role === 'guru') {
        const now = new Date();
        const jakartaOffset = 7 * 60;
        const jakartaTime = new Date(now.getTime() + (jakartaOffset + now.getTimezoneOffset()) * 60000);
        const dayOfWeek = jakartaTime.getDay();
        const hours = jakartaTime.getHours();
        const minutes = jakartaTime.getMinutes();
        const currentTime = hours * 60 + minutes;
        setOutsideWorkHours(dayOfWeek === 0 || dayOfWeek === 6 || currentTime < 360 || currentTime > 1200);
      }
    } catch (err) {
      console.error('Fetch data error:', err);
    }
  }, [todayStr, user?.role]);

  useEffect(() => {
    if (open) fetchData();
  }, [open, fetchData]);

  const fetchJadwal = useCallback(async () => {
    if (!user) return;
    const hariObj = hariList.find((h) => h.nama_hari === todayDayName);
    if (!hariObj) return;

    try {
      const guruId = user.role === 'guru' ? user.id : '';
      const res = await fetch(`/api/jadwal?hari_id=${hariObj.id}${guruId ? `&guru_id=${guruId}` : ''}&tanggal=${todayStr}`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setJadwalList(data.data || []);
      }
    } catch (err) {
      console.error('Fetch jadwal error:', err);
    }
  }, [user, hariList, todayDayName, todayStr]);

  useEffect(() => {
    if (open && hariList.length > 0) fetchJadwal();
  }, [open, hariList, fetchJadwal]);

  const fetchSiswa = useCallback(async (kelasId: string) => {
    try {
      const res = await fetch(`/api/siswa?kelas_id=${kelasId}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setSiswaList(data.data || []);
      }
    } catch (err) {
      console.error('Fetch siswa error:', err);
    }
  }, []);

  useEffect(() => {
    if (selectedJadwal?.kelas_id) {
      fetchSiswa(selectedJadwal.kelas_id);
    }
  }, [selectedJadwal?.kelas_id, fetchSiswa]);

  // Populate edit data
  useEffect(() => {
    if (editData && open) {
      setSelectedJadwalId(editData.jadwal_id || '');
      setSelectedStatusKehadiranId(editData.status_kehadiran_id || '');
      setMateriPembelajaran(editData.materi_pembelajaran || '');
      setFotoMengajar(editData.foto_mengajar || null);
      setJumlahHadir(editData.jumlah_hadir || 0);
      setJumlahIzinSakit(editData.jumlah_izin_sakit || 0);
      setJumlahAlfa(editData.jumlah_alfa || 0);
      setJumlahSiswaTotal(editData.jumlah_siswa_total || 0);
      try {
        const parsed = JSON.parse(editData.siswa_absen_json || '{}');
        // Handle both old format (string[]) and new format ({id, nama}[])
        const normalize = (arr: any[]) => arr.map((item: any) =>
          typeof item === 'string' ? { id: '', nama: item } : { id: item.id || '', nama: item.nama || '' }
        );
        setSiswaAbsenJson({ izin_sakit: normalize(parsed.izin_sakit || []), alfa: normalize(parsed.alfa || []) });
      } catch {
        setSiswaAbsenJson({ izin_sakit: [], alfa: [] });
      }
    } else if (!editData && open) {
      resetForm();
    }
  }, [editData, open]);

  const resetForm = () => {
    setSelectedJadwalId('');
    setSelectedStatusKehadiranId('');
    setMateriPembelajaran('');
    setFotoMengajar(null);
    setJumlahHadir(0);
    setJumlahIzinSakit(0);
    setJumlahAlfa(0);
    setJumlahSiswaTotal(0);
    setSiswaAbsenJson({ izin_sakit: [], alfa: [] });
    setSiswaList([]);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressFile(file);
      setFotoMengajar(compressed);
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
  const startCamera = useCallback(async (facing: 'user' | 'environment' = 'environment') => {
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

  const switchCameraFn = useCallback(async () => {
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
        setFotoMengajar(compressed);
      } catch {
        // Fallback: use uncompressed
        const reader = new FileReader();
        reader.onloadend = () => setFotoMengajar(reader.result as string);
        reader.readAsDataURL(blob);
      }
      stopCamera();
    }, 'image/jpeg', 0.85);
  }, [stopCamera]);

  const handleCameraClick = useCallback(() => {
    if (isMobile()) {
      cameraRef.current?.click();
    } else {
      startCamera('environment');
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

  // Auto-calculate total: Hadir + Izin/Sakit + Alfa = Total
  useEffect(() => {
    setJumlahSiswaTotal(jumlahHadir + jumlahIzinSakit + jumlahAlfa);
  }, [jumlahHadir, jumlahIzinSakit, jumlahAlfa]);

  const handleAbsenceSave = (izinSakit: string[], alfa: string[]) => {
    // New format: include both id and nama for each student
    const izinSakitEntries = siswaList.filter((s) => izinSakit.includes(s.id)).map((s) => ({ id: s.id, nama: s.nama }));
    const alfaEntries = siswaList.filter((s) => alfa.includes(s.id)).map((s) => ({ id: s.id, nama: s.nama }));

    setSiswaAbsenJson({ izin_sakit: izinSakitEntries as any, alfa: alfaEntries as any });
    setJumlahIzinSakit(izinSakitEntries.length);
    setJumlahAlfa(alfaEntries.length);
  };

  const handleSubmit = async () => {
    if (!selectedJadwalId) {
      toast({ title: 'Error', description: 'Pilih jadwal terlebih dahulu', variant: 'destructive' });
      return;
    }
    if (!selectedStatusKehadiranId) {
      toast({ title: 'Error', description: 'Pilih status kehadiran', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('jadwal_id', selectedJadwalId);
      formData.append('status_kehadiran_id', selectedStatusKehadiranId);
      formData.append('tanggal', editData?.tanggal || todayStr);
      formData.append('materi_pembelajaran', materiPembelajaran);
      formData.append('jumlah_hadir', jumlahHadir.toString());
      formData.append('jumlah_izin_sakit', jumlahIzinSakit.toString());
      formData.append('jumlah_alfa', jumlahAlfa.toString());
      formData.append('jumlah_siswa_total', jumlahSiswaTotal.toString());
      formData.append('siswa_absen_json', JSON.stringify(siswaAbsenJson));
      if (fotoMengajar) formData.append('foto_mengajar', fotoMengajar);

      if (editData) {
        formData.append('id', editData.id);
        const res = await fetch('/api/kehadiran-mengajar', {
          method: 'PUT',
          body: formData,
          credentials: 'include',
        });
        const data = await res.json();
        if (!res.ok) {
          toast({ title: 'Error', description: data.error, variant: 'destructive' });
          return;
        }
        toast({ title: 'Berhasil', description: 'Kehadiran berhasil diperbarui' });
      } else {
        const res = await fetch('/api/kehadiran-mengajar', {
          method: 'POST',
          body: formData,
          credentials: 'include',
        });
        const data = await res.json();
        if (!res.ok) {
          toast({ title: 'Error', description: data.error, variant: 'destructive' });
          return;
        }
        toast({ title: 'Berhasil', description: 'Kehadiran berhasil disimpan' });
      }

      resetForm();
      onSuccess();
      onClose();
    } catch {
      toast({ title: 'Error', description: 'Terjadi kesalahan', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const isAdmin = user?.role === 'admin';
  const canAdd = (user?.role === 'guru' && !isHoliday && !outsideWorkHours) || isAdmin;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editData ? 'Edit Kehadiran' : 'Tambah Kehadiran'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Hari - auto locked */}
          <div className="space-y-2">
            <Label>Hari</Label>
            <div className="flex items-center gap-2">
              <Input value={todayDayName} disabled className="bg-muted" />
              <Lock className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>

          {/* Jam Ke */}
          <div className="space-y-2">
            <Label>Jam Ke</Label>
            <Select value={selectedJadwalId} onValueChange={setSelectedJadwalId} disabled={!!editData}>
              <SelectTrigger>
                <SelectValue placeholder="Pilih jam ke" />
              </SelectTrigger>
              <SelectContent>
                {jadwalList.map((j) => (
                  <SelectItem key={j.id} value={j.id}>
                    Jam Ke-{j.jam_ke} ({j.jam_mulai} - {j.jam_selesai})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Kelas - auto locked */}
          <div className="space-y-2">
            <Label>Kelas</Label>
            <div className="flex items-center gap-2">
              <Input
                value={selectedJadwal?.nama_kelas || '-'}
                disabled
                className="bg-muted"
              />
              <Lock className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>

          {/* Mata Pelajaran - auto locked */}
          <div className="space-y-2">
            <Label>Mata Pelajaran</Label>
            <div className="flex items-center gap-2">
              <Input
                value={selectedJadwal?.nama_mapel || '-'}
                disabled
                className="bg-muted"
              />
              <Lock className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>

          {/* Jam Mulai - auto locked */}
          <div className="space-y-2">
            <Label>Jam Mulai</Label>
            <div className="flex items-center gap-2">
              <Input value={selectedJadwal?.jam_mulai || '-'} disabled className="bg-muted" />
              <Lock className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>

          {/* Jam Selesai - auto locked */}
          <div className="space-y-2">
            <Label>Jam Selesai</Label>
            <div className="flex items-center gap-2">
              <Input value={selectedJadwal?.jam_selesai || '-'} disabled className="bg-muted" />
              <Lock className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>

          {/* Siswa Hadir */}
          <div className="space-y-2">
            <Label>Siswa Hadir</Label>
            <Input
              type="number"
              value={jumlahHadir}
              onChange={(e) => setJumlahHadir(parseInt(e.target.value) || 0)}
            />
          </div>

          {/* Jumlah Izin/Sakit */}
          <div className="space-y-2">
            <Label>Jumlah Izin/Sakit</Label>
            <div className="flex items-center gap-2">
              <Input type="number" value={jumlahIzinSakit} disabled className="bg-muted flex-1" />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!selectedJadwalId}
                onClick={() => {
                  setAbsenceType('izin_sakit');
                  setAbsenceModalOpen(true);
                }}
              >
                Pilih Siswa
              </Button>
            </div>
          </div>

          {/* Jumlah Alfa */}
          <div className="space-y-2">
            <Label>Jumlah Alfa</Label>
            <div className="flex items-center gap-2">
              <Input type="number" value={jumlahAlfa} disabled className="bg-muted flex-1" />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!selectedJadwalId}
                onClick={() => {
                  setAbsenceType('alfa');
                  setAbsenceModalOpen(true);
                }}
              >
                Pilih Siswa
              </Button>
            </div>
          </div>

          {/* Jumlah Siswa Total - locked */}
          <div className="space-y-2">
            <Label>Jumlah Siswa Total</Label>
            <div className="flex items-center gap-2">
              <Input type="number" value={jumlahSiswaTotal} disabled className="bg-muted" />
              <Lock className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>

          {/* Status Kehadiran Guru */}
          <div className="space-y-2">
            <Label>Status Kehadiran Guru</Label>
            <Select value={selectedStatusKehadiranId} onValueChange={setSelectedStatusKehadiranId}>
              <SelectTrigger>
                <SelectValue placeholder="Pilih status kehadiran" />
              </SelectTrigger>
              <SelectContent>
                {statusKehadiranList.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.nama_status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Materi Pembelajaran */}
          <div className="space-y-2">
            <Label>Materi Pembelajaran</Label>
            <Textarea
              value={materiPembelajaran}
              onChange={(e) => setMateriPembelajaran(e.target.value)}
              placeholder="Masukkan materi pembelajaran"
              rows={3}
            />
          </div>

          {/* Foto Mengajar */}
          <div className="space-y-2">
            <Label>Foto Mengajar</Label>
            <div className="flex items-center gap-3">
              {fotoMengajar && (
                <button
                  type="button"
                  onClick={() => setImageOpen(true)}
                  className="w-16 h-16 rounded-lg overflow-hidden border hover:ring-2 hover:ring-ocean transition-all cursor-pointer"
                >
                  <img src={fotoMengajar} alt="Foto" className="w-full h-full object-cover" />
                </button>
              )}
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={handleCameraClick}>
                  <Camera className="h-4 w-4 mr-1" /> Kamera
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => galleryRef.current?.click()}>
                  <ImageIcon className="h-4 w-4 mr-1" /> Galeri
                </Button>
              </div>
            </div>
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileChange} />
            <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button onClick={handleSubmit} disabled={loading} className="bg-ocean hover:bg-ocean-dark text-white">
            {loading ? 'Menyimpan...' : editData ? 'Simpan Perubahan' : 'Simpan'}
          </Button>
        </DialogFooter>

        {/* Student Absence Modal */}
        {selectedJadwal?.kelas_id && (
          <StudentAbsenceModal
            open={absenceModalOpen}
            onClose={() => setAbsenceModalOpen(false)}
            kelasId={selectedJadwal.kelas_id}
            siswaList={siswaList}
            selectedIzinSakit={
              siswaAbsenJson.izin_sakit
                .map((item: any) => {
                  const id = typeof item === 'string' ? '' : item.id;
                  // Try to match by ID first, then by name
                  if (id) return siswaList.find((s) => s.id === id)?.id || '';
                  const name = typeof item === 'string' ? item : item.nama;
                  return siswaList.find((s) => s.nama === name)?.id || '';
                })
                .filter(Boolean)
            }
            selectedAlfa={
              siswaAbsenJson.alfa
                .map((item: any) => {
                  const id = typeof item === 'string' ? '' : item.id;
                  if (id) return siswaList.find((s) => s.id === id)?.id || '';
                  const name = typeof item === 'string' ? item : item.nama;
                  return siswaList.find((s) => s.nama === name)?.id || '';
                })
                .filter(Boolean)
            }
            onSave={handleAbsenceSave}
          />
        )}
      </DialogContent>

      {/* Image Modal for Foto Mengajar */}
      <ImageModal open={imageOpen} onClose={() => setImageOpen(false)} src={fotoMengajar || ''} alt="Foto Mengajar" />

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
                onClick={switchCameraFn}
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
    </Dialog>
  );
}
