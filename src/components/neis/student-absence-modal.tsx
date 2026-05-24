'use client';

import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search } from 'lucide-react';

interface Siswa {
  id: string;
  nama: string;
  nis: string;
  kelas_id: string;
  nama_kelas?: string;
}

interface StudentAbsenceModalProps {
  open: boolean;
  onClose: () => void;
  kelasId: string;
  siswaList: Siswa[];
  selectedIzinSakit: string[];
  selectedAlfa: string[];
  onSave: (izinSakit: string[], alfa: string[]) => void;
}

export function StudentAbsenceModal({
  open,
  onClose,
  kelasId,
  siswaList,
  selectedIzinSakit: initialIzinSakit,
  selectedAlfa: initialAlfa,
  onSave,
}: StudentAbsenceModalProps) {
  const [search, setSearch] = useState('');
  const [izinSakit, setIzinSakit] = useState<string[]>(() => [...initialIzinSakit]);
  const [alfa, setAlfa] = useState<string[]>(() => [...initialAlfa]);

  const filteredSiswa = siswaList.filter(
    (s) =>
      s.nama.toLowerCase().includes(search.toLowerCase()) ||
      s.nis.toLowerCase().includes(search.toLowerCase())
  );

  const toggleIzinSakit = (id: string) => {
    setIzinSakit((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      // Remove from alfa if adding to izin/sakit
      if (!prev.includes(id)) {
        setAlfa((a) => a.filter((x) => x !== id));
      }
      return next;
    });
  };

  const toggleAlfa = (id: string) => {
    setAlfa((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      // Remove from izin/sakit if adding to alfa
      if (!prev.includes(id)) {
        setIzinSakit((i) => i.filter((x) => x !== id));
      }
      return next;
    });
  };

  const handleSave = () => {
    onSave(izinSakit, alfa);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Pilih Siswa Absen</DialogTitle>
        </DialogHeader>

        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari nama atau NIS..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <Tabs defaultValue="izin-sakit" className="flex-1 min-h-0">
          <TabsList className="w-full">
            <TabsTrigger value="izin-sakit" className="flex-1">
              Izin/Sakit ({izinSakit.length})
            </TabsTrigger>
            <TabsTrigger value="alfa" className="flex-1">
              Alfa ({alfa.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="izin-sakit" className="mt-2 max-h-64 overflow-y-auto">
            {filteredSiswa.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Tidak ada siswa ditemukan</p>
            ) : (
              <div className="space-y-2">
                {filteredSiswa.map((s) => (
                  <label
                    key={s.id}
                    className="flex items-center gap-3 p-2 rounded-md hover:bg-accent cursor-pointer"
                  >
                    <Checkbox
                      checked={izinSakit.includes(s.id)}
                      onCheckedChange={() => toggleIzinSakit(s.id)}
                    />
                    <span className="text-sm">{s.nama}</span>
                    <span className="text-xs text-muted-foreground ml-auto">{s.nis}</span>
                  </label>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="alfa" className="mt-2 max-h-64 overflow-y-auto">
            {filteredSiswa.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Tidak ada siswa ditemukan</p>
            ) : (
              <div className="space-y-2">
                {filteredSiswa.map((s) => (
                  <label
                    key={s.id}
                    className="flex items-center gap-3 p-2 rounded-md hover:bg-accent cursor-pointer"
                  >
                    <Checkbox
                      checked={alfa.includes(s.id)}
                      onCheckedChange={() => toggleAlfa(s.id)}
                    />
                    <span className="text-sm">{s.nama}</span>
                    <span className="text-xs text-muted-foreground ml-auto">{s.nis}</span>
                  </label>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button onClick={handleSave}>
            Simpan ({izinSakit.length + alfa.length} siswa)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
