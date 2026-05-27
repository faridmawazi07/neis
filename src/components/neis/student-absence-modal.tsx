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
  selectedIzinSakit,
  selectedAlfa,
  onSave,
}: StudentAbsenceModalProps) {
  // Filter only valid IDs that exist in siswaList
  const validSiswaIds = useMemo(() => new Set(siswaList.map(s => s.id)), [siswaList]);
  const validSelectedIzinSakit = useMemo(() => selectedIzinSakit.filter(id => validSiswaIds.has(id)), [selectedIzinSakit, validSiswaIds]);
  const validSelectedAlfa = useMemo(() => selectedAlfa.filter(id => validSiswaIds.has(id)), [selectedAlfa, validSiswaIds]);

  // Use a sync key to force re-mount when initial selection changes or kelasId changes
  // This ensures the inner component always starts with the correct pre-selected students
  const syncKey = useMemo(() =>
    `${kelasId}:${validSelectedIzinSakit.join(',')}:${validSelectedAlfa.join(',')}:${siswaList.length}`,
    [kelasId, validSelectedIzinSakit, validSelectedAlfa, siswaList.length]
  );

  return (
    <StudentAbsenceModalInner
      key={syncKey}
      open={open}
      onClose={onClose}
      siswaList={siswaList}
      initialIzinSakit={validSelectedIzinSakit}
      initialAlfa={validSelectedAlfa}
      onSave={onSave}
    />
  );
}

// Inner component that holds the mutable state
function StudentAbsenceModalInner({
  open,
  onClose,
  siswaList,
  initialIzinSakit,
  initialAlfa,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  siswaList: Siswa[];
  initialIzinSakit: string[];
  initialAlfa: string[];
  onSave: (izinSakin: string[], alfa: string[]) => void;
}) {
  // State initialized from props (only on mount, which is controlled by key)
  const [izinSakit, setIzinSakit] = useState<string[]>(() => [...initialIzinSakit]);
  const [alfa, setAlfa] = useState<string[]>(() => [...initialAlfa]);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('izin-sakit');

  const filteredSiswa = useMemo(() =>
    siswaList.filter(
      (s) =>
        s.nama.toLowerCase().includes(search.toLowerCase()) ||
        s.nis.toLowerCase().includes(search.toLowerCase())
    ),
    [siswaList, search]
  );

  const toggleIzinSakit = (id: string) => {
    setIzinSakit((prev) => {
      if (prev.includes(id)) {
        return prev.filter((x) => x !== id);
      }
      // Remove from alfa if adding to izin/sakit
      setAlfa((a) => a.filter((x) => x !== id));
      return [...prev, id];
    });
  };

  const toggleAlfa = (id: string) => {
    setAlfa((prev) => {
      if (prev.includes(id)) {
        return prev.filter((x) => x !== id);
      }
      // Remove from izin/sakit if adding to alfa
      setIzinSakit((i) => i.filter((x) => x !== id));
      return [...prev, id];
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

        <Tabs value={tab} onValueChange={setTab} className="flex-1 min-h-0">
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
