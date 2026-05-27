'use client';

import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuthStore } from '@/stores/auth-store';
import { useToast } from '@/hooks/use-toast';

interface JadwalFormProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function JadwalForm({ open, onClose, onSuccess }: JadwalFormProps) {
  const { user } = useAuthStore();
  const { toast } = useToast();
  const isAdmin = user?.role === 'admin';

  const [loading, setLoading] = useState(false);
  const [hariList, setHariList] = useState<any[]>([]);
  const [kelasList, setKelasList] = useState<any[]>([]);
  const [mapelList, setMapelList] = useState<any[]>([]);
  const [guruList, setGuruList] = useState<any[]>([]);

  const [formHariId, setFormHariId] = useState('');
  const [formKelasId, setFormKelasId] = useState('');
  const [formMapelId, setFormMapelId] = useState('');
  const [formGuruId, setFormGuruId] = useState('');
  const [formJamKe, setFormJamKe] = useState('');
  const [formJamMulai, setFormJamMulai] = useState('');
  const [formJamSelesai, setFormJamSelesai] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const [hariRes, kelasRes, mapelRes] = await Promise.all([
        fetch('/api/hari', { credentials: 'include' }),
        fetch('/api/kelas', { credentials: 'include' }),
        fetch('/api/mapel', { credentials: 'include' }),
      ]);
      if (hariRes.ok) setHariList((await hariRes.json()).data || []);
      if (kelasRes.ok) setKelasList((await kelasRes.json()).data || []);
      if (mapelRes.ok) setMapelList((await mapelRes.json()).data || []);

      if (isAdmin) {
        const guruRes = await fetch('/api/users?role=guru', { credentials: 'include' });
        if (guruRes.ok) setGuruList((await guruRes.json()).data || []);
      }
    } catch (err) {
      console.error('Fetch data error:', err);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (open) {
      fetchData();
      // Reset form
      setFormHariId('');
      setFormKelasId('');
      setFormMapelId('');
      setFormGuruId(!isAdmin && user?.role === 'guru' ? user.id : '');
      setFormJamKe('');
      setFormJamMulai('');
      setFormJamSelesai('');
    }
  }, [open, fetchData, isAdmin, user?.id]);

  const handleSubmit = async () => {
    if (!formHariId || !formKelasId || !formMapelId || !formJamKe || !formJamMulai || !formJamSelesai) {
      toast({ title: 'Error', description: 'Semua field wajib diisi', variant: 'destructive' });
      return;
    }
    if (isAdmin && !formGuruId) {
      toast({ title: 'Error', description: 'Guru wajib dipilih', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const body: any = {
        hari_id: formHariId,
        kelas_id: formKelasId,
        mapel_id: formMapelId,
        jam_ke: parseInt(formJamKe),
        jam_mulai: formJamMulai,
        jam_selesai: formJamSelesai,
      };
      if (isAdmin) body.guru_id = formGuruId;

      const res = await fetch('/api/jadwal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: 'Gagal', description: data.error, variant: 'destructive' });
        return;
      }
      toast({ title: 'Berhasil', description: 'Jadwal berhasil ditambahkan' });
      onSuccess();
      onClose();
    } catch {
      toast({ title: 'Error', description: 'Terjadi kesalahan', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Tambah Jadwal</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {isAdmin && (
            <div className="space-y-2">
              <Label>Guru</Label>
              <Select value={formGuruId} onValueChange={setFormGuruId}>
                <SelectTrigger><SelectValue placeholder="Pilih guru" /></SelectTrigger>
                <SelectContent>
                  {guruList.map((g: any) => (
                    <SelectItem key={g.id} value={g.id}>{g.nama}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-2">
            <Label>Hari</Label>
            <Select value={formHariId} onValueChange={setFormHariId}>
              <SelectTrigger><SelectValue placeholder="Pilih hari" /></SelectTrigger>
              <SelectContent>
                {hariList.map((h: any) => (
                  <SelectItem key={h.id} value={h.id}>{h.nama_hari}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Kelas</Label>
            <Select value={formKelasId} onValueChange={setFormKelasId}>
              <SelectTrigger><SelectValue placeholder="Pilih kelas" /></SelectTrigger>
              <SelectContent>
                {kelasList.map((k: any) => (
                  <SelectItem key={k.id} value={k.id}>{k.nama_kelas}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Mata Pelajaran</Label>
            <Select value={formMapelId} onValueChange={setFormMapelId}>
              <SelectTrigger><SelectValue placeholder="Pilih mapel" /></SelectTrigger>
              <SelectContent>
                {mapelList.map((m: any) => (
                  <SelectItem key={m.id} value={m.id}>{m.nama_mapel}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Jam Ke</Label>
            <Select value={formJamKe} onValueChange={setFormJamKe}>
              <SelectTrigger><SelectValue placeholder="Pilih jam ke" /></SelectTrigger>
              <SelectContent>
                {Array.from({ length: 15 }, (_, i) => i + 1).map((n) => (
                  <SelectItem key={n} value={n.toString()}>{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Jam Mulai</Label>
              <Input type="time" value={formJamMulai} onChange={(e) => setFormJamMulai(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Jam Selesai</Label>
              <Input type="time" value={formJamSelesai} onChange={(e) => setFormJamSelesai(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Batal</Button>
          <Button onClick={handleSubmit} disabled={loading} className="bg-ocean hover:bg-ocean-dark text-white">
            {loading ? 'Menyimpan...' : 'Simpan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
