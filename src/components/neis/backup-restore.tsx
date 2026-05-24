'use client';

import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, Upload, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export function BackupRestorePage() {
  const { toast } = useToast();
  const [backingUp, setBackingUp] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [restoreConfirmOpen, setRestoreConfirmOpen] = useState(false);
  const [restoreFile, setRestoreFile] = useState<any>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleBackup = async () => {
    setBackingUp(true);
    try {
      const res = await fetch('/api/backup-restore', { credentials: 'include' });
      const data = await res.json();
      if (!res.ok) { toast({ title: 'Gagal', description: data.error, variant: 'destructive' }); return; }

      // Download as JSON file
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `neis-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: 'Berhasil', description: 'Backup berhasil diunduh' });
    } catch { toast({ title: 'Error', description: 'Terjadi kesalahan', variant: 'destructive' }); }
    finally { setBackingUp(false); }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setRestoreFile(file);
    setRestoreConfirmOpen(true);
    e.target.value = '';
  };

  const handleRestore = async () => {
    if (!restoreFile) return;
    setRestoring(true);
    try {
      const text = await restoreFile.text();
      const json = JSON.parse(text);
      const backup = json.backup || json;

      const res = await fetch('/api/backup-restore', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backup }), credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) { toast({ title: 'Gagal', description: data.error, variant: 'destructive' }); return; }
      toast({ title: 'Berhasil', description: data.message });
    } catch {
      toast({ title: 'Error', description: 'File tidak valid atau terjadi kesalahan', variant: 'destructive' });
    }
    finally { setRestoring(false); setRestoreConfirmOpen(false); setRestoreFile(null); }
  };

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">Backup / Restore</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Download className="h-5 w-5 text-ocean" /> Backup Database
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Unduh seluruh data database sebagai file JSON.
            </p>
            <Button
              onClick={handleBackup}
              disabled={backingUp}
              className="w-full bg-ocean hover:bg-ocean-dark text-white"
            >
              {backingUp ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
              {backingUp ? 'Memproses...' : 'Backup Sekarang'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Upload className="h-5 w-5 text-orange-600" /> Restore Database
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Pulihkan data dari file backup JSON. Data saat ini akan ditimpa.
            </p>
            <Button
              variant="outline"
              onClick={() => fileRef.current?.click()}
              disabled={restoring}
              className="w-full border-orange-300 text-orange-600 hover:bg-orange-50 dark:border-orange-800 dark:hover:bg-orange-900/20"
            >
              {restoring ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
              {restoring ? 'Memulihkan...' : 'Pilih File Backup'}
            </Button>
            <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleFileSelect} />
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={restoreConfirmOpen} onOpenChange={setRestoreConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Konfirmasi Restore</AlertDialogTitle>
            <AlertDialogDescription>
              Data saat ini akan ditimpa dengan data dari file backup. Tindakan ini tidak dapat dibatalkan!
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setRestoreConfirmOpen(false); setRestoreFile(null); }}>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleRestore} className="bg-orange-600 text-white">Restore</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
