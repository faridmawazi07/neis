'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Upload, Download, Loader2, Settings, Wifi, WifiOff, Clock, GitBranch, AlertCircle, CheckCircle2,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface GitStatus {
  connected: boolean;
  autoPush: boolean;
  lastPush: string | null;
  lastPull: string | null;
  branch: string;
  currentBranch: string;
  hasUncommittedChanges: boolean;
  ahead: number;
  behind: number;
}

function formatTime(iso: string | null): string {
  if (!iso) return 'Belum pernah';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

export function GitControlPage() {
  const { toast } = useToast();
  const [pushing, setPushing] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [loading, setLoading] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [autoPush, setAutoPush] = useState(true);
  const [branch, setBranch] = useState('main');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<GitStatus>({
    connected: false, autoPush: true, lastPush: null, lastPull: null,
    branch: 'main', currentBranch: 'main', hasUncommittedChanges: false, ahead: 0, behind: 0,
  });

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/git-control', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
        setAutoPush(data.autoPush);
        setBranch(data.branch);
      }
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

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
      fetchStatus();
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
      fetchStatus();
    } catch { toast({ title: 'Error', description: 'Terjadi kesalahan koneksi', variant: 'destructive' }); }
    finally { setPulling(false); }
  };

  const handleSaveConfig = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/git-control', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save-config', autoPush, branch }), credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) { toast({ title: 'Gagal', description: data.error, variant: 'destructive' }); return; }
      toast({ title: 'Berhasil', description: 'Konfigurasi berhasil disimpan' });
      setSettingsOpen(false);
      fetchStatus();
    } catch { toast({ title: 'Error', description: 'Terjadi kesalahan', variant: 'destructive' }); }
    finally { setSaving(false); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Git Control</h1>
        <Button variant="outline" size="sm" onClick={() => { setAutoPush(status.autoPush); setBranch(status.branch); setSettingsOpen(true); }}>
          <Settings className="h-4 w-4 mr-1" /> Pengaturan
        </Button>
      </div>

      {/* Connection & Status Info */}
      <Card className="mb-4">
        <CardContent className="p-4 space-y-3">
          {loading ? (
            <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-ocean" /></div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {status.connected ? <Wifi className="h-5 w-5 text-green-500" /> : <WifiOff className="h-5 w-5 text-red-500" />}
                  <span className="font-medium text-sm">{status.connected ? 'GitHub Terhubung' : 'GitHub Belum Terhubung'}</span>
                </div>
                <Badge variant={status.connected ? 'default' : 'destructive'} className={status.connected ? 'bg-green-500' : ''}>
                  {status.connected ? 'Aktif' : 'Tidak Aktif'}
                </Badge>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <GitBranch className="h-4 w-4" /> Branch: <strong className="text-foreground">{status.branch}</strong>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-4 w-4" /> Auto Push: <strong className="text-foreground">{status.autoPush ? 'Aktif' : 'Nonaktif'}</strong>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Upload className="h-4 w-4" /> Push: <strong className="text-foreground">{formatTime(status.lastPush)}</strong>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Download className="h-4 w-4" /> Pull: <strong className="text-foreground">{formatTime(status.lastPull)}</strong>
                </div>
              </div>

              {(status.hasUncommittedChanges || status.ahead > 0 || status.behind > 0) && (
                <>
                  <Separator />
                  <div className="flex flex-wrap gap-2">
                    {status.hasUncommittedChanges && (
                      <Badge variant="outline" className="text-amber-600 border-amber-300"><AlertCircle className="h-3 w-3 mr-1" /> Ada perubahan belum disimpan</Badge>
                    )}
                    {status.ahead > 0 && (
                      <Badge variant="outline" className="text-blue-600 border-blue-300"><Upload className="h-3 w-3 mr-1" /> {status.ahead} commit belum di-push</Badge>
                    )}
                    {status.behind > 0 && (
                      <Badge variant="outline" className="text-orange-600 border-orange-300"><Download className="h-3 w-3 mr-1" /> {status.behind} commit belum di-pull</Badge>
                    )}
                  </div>
                </>
              )}

              {status.connected && !status.hasUncommittedChanges && status.ahead === 0 && status.behind === 0 && (
                <div className="flex items-center gap-2 text-green-600 text-sm"><CheckCircle2 className="h-4 w-4" /> Semua sudah sinkron</div>
              )}

              {!status.connected && (
                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md p-3 text-sm">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium text-amber-700 dark:text-amber-400">GitHub Token belum dikonfigurasi</p>
                      <p className="text-amber-600 dark:text-amber-500 mt-1">Hubungi administrator untuk mengatur GITHUB_TOKEN di server.</p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Push & Pull Buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Upload className="h-5 w-5 text-ocean" /> Simpan ke GitHub
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Push kode dan data terbaru ke branch <strong>{status.branch}</strong>.
            </p>
            <Button onClick={handlePush} disabled={pushing || !status.connected} className="w-full bg-ocean hover:bg-ocean-dark text-white">
              {pushing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
              {pushing ? 'Menyimpan...' : 'Simpan ke GitHub'}
            </Button>
            {!status.connected && <p className="text-xs text-destructive mt-2">GitHub Token belum dikonfigurasi</p>}
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
              Pull kode terbaru dari branch <strong>{status.branch}</strong>.
            </p>
            <Button onClick={handlePull} disabled={pulling || !status.connected} className="w-full bg-green-600 hover:bg-green-700 text-white">
              {pulling ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
              {pulling ? 'Mengambil...' : 'Ambil dari GitHub'}
            </Button>
            {!status.connected && <p className="text-xs text-destructive mt-2">GitHub Token belum dikonfigurasi</p>}
          </CardContent>
        </Card>
      </div>

      {/* Settings Dialog */}
      <Dialog open={settingsOpen} onOpenChange={(open) => { if (!saving) setSettingsOpen(open); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Settings className="h-5 w-5" /> Pengaturan GitHub</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Branch Tujuan</Label>
              <div className="flex gap-2">
                {['main', 'dev'].map((b) => (
                  <Button key={b} variant={branch === b ? 'default' : 'outline'} size="sm" onClick={() => setBranch(b)} className={branch === b ? 'bg-ocean hover:bg-ocean-dark text-white' : ''}>
                    {b}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground"><strong>main</strong> = Production · <strong>dev</strong> = Preview</p>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label className="text-sm font-medium">Auto Push ke GitHub</Label>
                <p className="text-xs text-muted-foreground">Otomatis push setiap ada perubahan kode</p>
              </div>
              <Switch checked={autoPush} onCheckedChange={setAutoPush} />
            </div>

            {status.connected && (
              <div className="flex items-center gap-2 text-sm text-green-600"><CheckCircle2 className="h-4 w-4" /> GitHub Token aktif</div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSettingsOpen(false)} disabled={saving}>Batal</Button>
            <Button onClick={handleSaveConfig} disabled={saving} className="bg-ocean hover:bg-ocean-dark text-white">
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
