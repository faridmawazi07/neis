'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, Download, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export function GitControlPage() {
  const { toast } = useToast();
  const [pushing, setPushing] = useState(false);
  const [pulling, setPulling] = useState(false);

  const handlePush = async () => {
    setPushing(true);
    try {
      const res = await fetch('/api/git-control', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'push' }), credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) { toast({ title: 'Gagal', description: data.error, variant: 'destructive' }); return; }
      toast({ title: 'Berhasil', description: data.message });
    } catch { toast({ title: 'Error', description: 'Terjadi kesalahan koneksi', variant: 'destructive' }); }
    finally { setPushing(false); }
  };

  const handlePull = async () => {
    setPulling(true);
    try {
      const res = await fetch('/api/git-control', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'pull' }), credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) { toast({ title: 'Gagal', description: data.error, variant: 'destructive' }); return; }
      toast({ title: 'Berhasil', description: data.message });
    } catch { toast({ title: 'Error', description: 'Terjadi kesalahan koneksi', variant: 'destructive' }); }
    finally { setPulling(false); }
  };

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">Git Control</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Upload className="h-5 w-5 text-ocean" /> Simpan ke GitHub
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Push kode dan data terbaru ke repositori GitHub.
            </p>
            <Button
              onClick={handlePush}
              disabled={pushing}
              className="w-full bg-ocean hover:bg-ocean-dark text-white"
            >
              {pushing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
              {pushing ? 'Menyimpan...' : 'Simpan ke GitHub'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Download className="h-5 w-5 text-green-600" /> Ambil dari GitHub
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Pull kode terbaru dari repositori GitHub.
            </p>
            <Button
              onClick={handlePull}
              disabled={pulling}
              className="w-full bg-green-600 hover:bg-green-700 text-white"
            >
              {pulling ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
              {pulling ? 'Mengambil...' : 'Ambil dari GitHub'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
