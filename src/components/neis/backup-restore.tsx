'use client';

import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, Upload, Loader2, Trash2, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';

export function BackupRestorePage() {
  const { toast } = useToast();
  const [backingUp, setBackingUp] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [restoreConfirmOpen, setRestoreConfirmOpen] = useState(false);
  const [restoreFile, setRestoreFile] = useState<any>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Reset data state
  const [resetOpen, setResetOpen] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSteps, setResetSteps] = useState<{ step: string; status: string; count?: number }[]>([]);
  const [resetResult, setResetResult] = useState<{ message: string; deleted: { kehadiran: number; jadwal: number } } | null>(null);

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

  const handleResetData = async () => {
    setResetLoading(true);
    setResetSteps([]);
    setResetResult(null);

    // Simulate step-by-step progress
    const progressSteps = [
      { step: 'Menghubungi server...', status: 'processing' },
    ];
    setResetSteps([...progressSteps]);

    try {
      const res = await fetch('/api/reset-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: 'RESET_ALL_DATA' }),
        credentials: 'include',
      });
      const data = await res.json();

      if (!res.ok) {
        toast({ title: 'Gagal', description: data.error, variant: 'destructive' });
        setResetSteps([{ step: data.error || 'Gagal mereset data', status: 'error' }]);
        return;
      }

      setResetSteps(data.steps || []);
      setResetResult({ message: data.message, deleted: data.deleted });
      toast({ title: 'Berhasil', description: data.message });
    } catch {
      toast({ title: 'Error', description: 'Terjadi kesalahan koneksi', variant: 'destructive' });
      setResetSteps([{ step: 'Koneksi gagal', status: 'error' }]);
    } finally {
      setResetLoading(false);
    }
  };

  const openResetDialog = () => {
    setResetOpen(true);
    setResetSteps([]);
    setResetResult(null);
  };

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">Backup / Restore / Reset</h1>
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

      {/* Reset Data Section */}
      <div className="mt-6 max-w-2xl">
        <div className="flex items-center justify-between rounded-lg border border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/50">
              <Trash2 className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="font-medium text-sm">Reset Data</p>
              <p className="text-xs text-muted-foreground">Hapus semua kehadiran mengajar & jadwal mengajar</p>
            </div>
          </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={openResetDialog}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Reset Data
          </Button>
        </div>
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

      {/* Reset Data Dialog */}
      <Dialog open={resetOpen} onOpenChange={(open) => { if (!resetLoading) setResetOpen(open); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-red-500" />
              Reset Data
            </DialogTitle>
            <DialogDescription className="sr-only">Hapus semua data kehadiran mengajar dan jadwal mengajar</DialogDescription>
          </DialogHeader>

          {!resetResult ? (
            <>
              <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-md p-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium text-sm text-red-700 dark:text-red-400">Perhatian!</p>
                    <p className="text-xs text-red-600 dark:text-red-500 mt-1">
                      Tindakan ini akan menghapus <strong>semua data kehadiran mengajar</strong> dan <strong>semua data jadwal mengajar</strong>. 
                      Tindakan ini <strong>tidak dapat dibatalkan</strong>.
                    </p>
                  </div>
                </div>
              </div>

              {resetSteps.length > 0 && (
                <div className="space-y-2 mt-2">
                  {resetSteps.map((s, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      {s.status === 'processing' && <Loader2 className="h-4 w-4 animate-spin text-orange-500 shrink-0" />}
                      {s.status === 'done' && <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />}
                      {s.status === 'warning' && <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />}
                      {s.status === 'error' && <XCircle className="h-4 w-4 text-red-500 shrink-0" />}
                      <span className={s.status === 'processing' ? 'text-muted-foreground' : ''}>{s.step}</span>
                      {s.count !== undefined && <span className="text-muted-foreground ml-auto">({s.count})</span>}
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-end gap-2 mt-4">
                <Button variant="outline" onClick={() => setResetOpen(false)} disabled={resetLoading}>Batal</Button>
                <Button
                  variant="destructive"
                  onClick={handleResetData}
                  disabled={resetLoading}
                >
                  {resetLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
                  {resetLoading ? 'Menghapus...' : 'Ya, Hapus Semua'}
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-md p-3">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium text-sm text-green-700 dark:text-green-400">Data berhasil direset!</p>
                    <p className="text-xs text-green-600 dark:text-green-500 mt-1">{resetResult.message}</p>
                  </div>
                </div>
              </div>

              {resetSteps.length > 0 && (
                <div className="space-y-2 mt-2">
                  {resetSteps.map((s, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      {s.status === 'done' && <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />}
                      {s.status === 'warning' && <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />}
                      {s.status === 'error' && <XCircle className="h-4 w-4 text-red-500 shrink-0" />}
                      <span>{s.step}</span>
                      {s.count !== undefined && <span className="text-muted-foreground ml-auto">({s.count})</span>}
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-end mt-4">
                <Button onClick={() => setResetOpen(false)}>Tutup</Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
