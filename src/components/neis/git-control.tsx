'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  Upload, Download, Loader2, Settings, Wifi, WifiOff, Clock, GitBranch,
  AlertCircle, CheckCircle2, Cloud, HardDrive, ImageIcon, Zap,
  ShieldAlert, ShieldCheck, RefreshCw,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface CloudinaryInfo {
  configured: boolean;
  error?: string;
  limitedAccess?: boolean;
  storage?: { usedMB: number; limitMB: number; percentage: number };
  bandwidth?: { usedMB: number; limitMB: number; percentage: number };
  resources?: number;
  plan?: string;
}

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
  synced: boolean;
  needsPull: boolean;
  cloudinary: CloudinaryInfo;
}

function formatTime(iso: string | null): string {
  if (!iso) return 'Belum pernah';
  try { return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
  catch { return iso; }
}

export function GitControlPage() {
  const { toast } = useToast();
  const [pushing, setPushing] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [loading, setLoading] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [autoPush, setAutoPush] = useState(true);
  const [branch, setBranch] = useState('dev');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<GitStatus>({
    connected: false, autoPush: true, lastPush: null, lastPull: null,
    branch: 'dev', currentBranch: 'main', hasUncommittedChanges: false,
    ahead: 0, behind: 0, synced: true, needsPull: false,
    cloudinary: { configured: false },
  });

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/git-control', { credentials: 'include' });
      if (res.ok) { const data = await res.json(); setStatus(data); setAutoPush(data.autoPush); setBranch(data.branch); }
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  const handlePush = async () => {
    if (!status.synced) { toast({ title: 'Diblokir', description: 'Push diblokir! Ambil kode dari GitHub terlebih dahulu.', variant: 'destructive' }); return; }
    setPushing(true);
    try {
      const res = await fetch('/api/git-control', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'push' }), credentials: 'include' });
      const data = await res.json();
      if (!res.ok) { toast({ title: data.blocked ? 'Push Diblokir' : 'Gagal', description: data.error, variant: 'destructive' }); return; }
      toast({ title: 'Berhasil', description: data.message });
      fetchStatus();
    } catch { toast({ title: 'Error', description: 'Terjadi kesalahan koneksi', variant: 'destructive' }); }
    finally { setPushing(false); }
  };

  const handlePull = async () => {
    setPulling(true);
    try {
      const res = await fetch('/api/git-control', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'pull' }), credentials: 'include' });
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
      const res = await fetch('/api/git-control', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'save-config', autoPush, branch }), credentials: 'include' });
      const data = await res.json();
      if (!res.ok) { toast({ title: 'Gagal', description: data.error, variant: 'destructive' }); return; }
      toast({ title: 'Berhasil', description: 'Konfigurasi berhasil disimpan' });
      setSettingsOpen(false);
      fetchStatus();
    } catch { toast({ title: 'Error', description: 'Terjadi kesalahan', variant: 'destructive' }); }
    finally { setSaving(false); }
  };

  const cld = status.cloudinary;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Git Control & Penyimpanan</h1>
        <Button variant="outline" size="sm" onClick={() => { setAutoPush(status.autoPush); setBranch(status.branch); setSettingsOpen(true); }}>
          <Settings className="h-4 w-4 mr-1" /> Pengaturan
        </Button>
      </div>

      {/* SANDBOX RESET WARNING */}
      {!loading && status.connected && !status.synced && (
        <Card className="mb-4 border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <ShieldAlert className="h-6 w-6 text-red-500 shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-bold text-red-700 dark:text-red-400 text-base">Sandbox Reset Terdeteksi!</h3>
                <p className="text-sm text-red-600 dark:text-red-500 mt-1">
                  Kode lokal kemungkinan sudah usang. <strong>Push ke GitHub diblokir</strong> untuk mencegah kode lama menimpa kode terbaru.
                </p>
                <Button onClick={handlePull} disabled={pulling} className="mt-3 bg-red-600 hover:bg-red-700 text-white" size="sm">
                  {pulling ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                  {pulling ? 'Mengambil...' : 'Sinkronkan Sekarang'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* SYNCED SUCCESS */}
      {!loading && status.connected && status.synced && (
        <Card className="mb-4 border-green-300 dark:border-green-800 bg-green-50 dark:bg-green-950/30">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-green-600 shrink-0" />
              <span className="font-medium text-sm text-green-700 dark:text-green-400">Sandbox sudah sinkron dengan GitHub</span>
              <Badge className="bg-green-600 ml-auto">Aman</Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* GitHub Connection */}
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
                <div className="flex gap-2">
                  {status.synced && status.connected && <Badge className="bg-green-500"><ShieldCheck className="h-3 w-3 mr-1" /> Sinkron</Badge>}
                  {!status.synced && status.connected && <Badge variant="destructive"><ShieldAlert className="h-3 w-3 mr-1" /> Belum Sinkron</Badge>}
                  <Badge variant={status.connected ? 'default' : 'destructive'} className={status.connected ? 'bg-green-500' : ''}>
                    {status.connected ? 'Aktif' : 'Tidak Aktif'}
                  </Badge>
                </div>
              </div>
              <Separator />
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground"><GitBranch className="h-4 w-4" /> Branch: <strong className="text-foreground">{status.branch}</strong></div>
                <div className="flex items-center gap-2 text-muted-foreground"><Clock className="h-4 w-4" /> Auto Push: <strong className={`text-foreground ${!status.synced ? 'line-through opacity-50' : ''}`}>{status.autoPush ? 'Aktif' : 'Nonaktif'}</strong></div>
                <div className="flex items-center gap-2 text-muted-foreground"><Upload className="h-4 w-4" /> Push: <strong className="text-foreground">{formatTime(status.lastPush)}</strong></div>
                <div className="flex items-center gap-2 text-muted-foreground"><Download className="h-4 w-4" /> Pull: <strong className="text-foreground">{formatTime(status.lastPull)}</strong></div>
              </div>
              {(status.hasUncommittedChanges || status.ahead > 0 || status.behind > 0) && (
                <>
                  <Separator />
                  <div className="flex flex-wrap gap-2">
                    {status.hasUncommittedChanges && <Badge variant="outline" className="text-amber-600 border-amber-300"><AlertCircle className="h-3 w-3 mr-1" /> Ada perubahan belum disimpan</Badge>}
                    {status.ahead > 0 && <Badge variant="outline" className="text-blue-600 border-blue-300"><Upload className="h-3 w-3 mr-1" /> {status.ahead} commit belum di-push</Badge>}
                    {status.behind > 0 && <Badge variant="outline" className="text-orange-600 border-orange-300"><Download className="h-3 w-3 mr-1" /> {status.behind} commit belum di-pull</Badge>}
                  </div>
                </>
              )}
              {status.connected && status.synced && !status.hasUncommittedChanges && status.ahead === 0 && status.behind === 0 && (
                <div className="flex items-center gap-2 text-green-600 text-sm"><CheckCircle2 className="h-4 w-4" /> Semua sudah sinkron</div>
              )}
              {!status.connected && (
                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md p-3 text-sm">
                  <div className="flex items-start gap-2"><AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" /><div><p className="font-medium text-amber-700 dark:text-amber-400">GitHub Token belum dikonfigurasi</p><p className="text-amber-600 dark:text-amber-500 mt-1">Hubungi administrator untuk mengatur token di file .neis.env.</p></div></div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Cloudinary */}
      <Card className="mb-4">
        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Cloud className="h-5 w-5 text-sky-500" /> Cloudinary Penyimpanan Foto</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-sky-500" /></div>
          ) : !cld.configured ? (
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md p-3 text-sm">
              <div className="flex items-start gap-2"><AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" /><div><p className="font-medium text-amber-700 dark:text-amber-400">Cloudinary Belum Dikonfigurasi</p><p className="text-amber-600 dark:text-amber-500 mt-1">Atur CLOUDINARY_CLOUD_NAME, API_KEY, dan API_SECRET di file .neis.env.</p></div></div>
            </div>
          ) : cld.limitedAccess ? (
            <>
              <div className="flex items-center justify-between"><div className="flex items-center gap-2"><Cloud className="h-4 w-4 text-sky-500" /><span className="font-medium text-sm">Terhubung</span></div><Badge className="bg-sky-500 capitalize">{cld.plan || 'Free'} Plan</Badge></div>
              <Separator />
              <div className="flex items-center gap-2 text-sm text-sky-600 dark:text-sky-400"><CheckCircle2 className="h-4 w-4" /><span>Cloudinary aktif untuk menyimpan foto</span></div>
              <p className="text-xs text-muted-foreground">Statistik penggunaan tidak tersedia (akun Free tier)</p>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between"><div className="flex items-center gap-2"><Cloud className="h-4 w-4 text-sky-500" /><span className="font-medium text-sm">Terhubung</span></div><Badge className="bg-sky-500 capitalize">{cld.plan || 'Free'} Plan</Badge></div>
              <Separator />
              {cld.storage && (<div className="space-y-2"><div className="flex items-center justify-between text-sm"><div className="flex items-center gap-2 text-muted-foreground"><HardDrive className="h-4 w-4" /> Penyimpanan</div><span className="font-medium">{cld.storage.usedMB} MB / {cld.storage.limitMB} MB</span></div><Progress value={cld.storage.percentage} className="h-2" /><p className="text-xs text-muted-foreground text-right">{cld.storage.percentage}% terpakai</p></div>)}
              {cld.bandwidth && (<div className="space-y-2"><div className="flex items-center justify-between text-sm"><div className="flex items-center gap-2 text-muted-foreground"><Zap className="h-4 w-4" /> Bandwidth</div><span className="font-medium">{cld.bandwidth.usedMB} MB / {cld.bandwidth.limitMB} MB</span></div><Progress value={cld.bandwidth.percentage} className="h-2" /><p className="text-xs text-muted-foreground text-right">{cld.bandwidth.percentage}% terpakai</p></div>)}
              <div className="grid grid-cols-2 gap-3 text-sm pt-1"><div className="flex items-center gap-2 text-muted-foreground"><ImageIcon className="h-4 w-4" /> Foto: <strong className="text-foreground">{cld.resources ?? 0}</strong></div><div className="flex items-center gap-2 text-muted-foreground"><HardDrive className="h-4 w-4" /> Turunan: <strong className="text-foreground">{cld.derivedResources ?? 0}</strong></div></div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Push & Pull */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
        <Card className={!status.synced ? 'opacity-60' : ''}>
          <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Upload className="h-5 w-5 text-ocean" /> Simpan ke GitHub</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">Push kode terbaru ke branch <strong>{status.branch}</strong>.</p>
            <Button onClick={handlePush} disabled={pushing || !status.connected || !status.synced} className="w-full bg-ocean hover:bg-ocean-dark text-white">
              {pushing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
              {pushing ? 'Menyimpan...' : 'Simpan ke GitHub'}
            </Button>
            {!status.connected && <p className="text-xs text-destructive mt-2">GitHub Token belum dikonfigurasi</p>}
            {status.connected && !status.synced && <p className="text-xs text-red-500 mt-2 flex items-center gap-1"><ShieldAlert className="h-3 w-3" /> Diblokir - Ambil dari GitHub dulu</p>}
          </CardContent>
        </Card>
        <Card className={status.needsPull && status.connected ? 'ring-2 ring-orange-300' : ''}>
          <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Download className="h-5 w-5 text-green-600" /> Ambil dari GitHub</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">Pull kode terbaru dari branch <strong>{status.branch}</strong>.</p>
            <Button onClick={handlePull} disabled={pulling || !status.connected} className="w-full bg-green-600 hover:bg-green-700 text-white">
              {pulling ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
              {pulling ? 'Mengambil...' : 'Ambil dari GitHub'}
            </Button>
            {!status.connected && <p className="text-xs text-destructive mt-2">GitHub Token belum dikonfigurasi</p>}
            {status.needsPull && status.connected && <p className="text-xs text-orange-600 mt-2 flex items-center gap-1"><AlertCircle className="h-3 w-3" /> Kode lokal tertinggal - perlu pull</p>}
          </CardContent>
        </Card>
      </div>

      {/* Info Box */}
      <div className="mt-4 max-w-2xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-md p-3 text-sm">
        <div className="flex items-start gap-2">
          <GitBranch className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
          <div className="text-blue-700 dark:text-blue-400">
            <p className="font-medium">Alur Kerja Anti-Reset</p>
            <div className="mt-2 space-y-1 text-blue-600 dark:text-blue-500">
              <p>1. Sandbox reset → <strong>Push DIBLOKIR</strong></p>
              <p>2. NEIS otomatis <strong>pull dari GitHub</strong></p>
              <p>3. Setelah sinkron → Push dibuka + auto-push aktif</p>
              <p>4. GitHub: merge <strong>dev → main</strong> → Vercel deploy</p>
            </div>
          </div>
        </div>
      </div>

      {/* Settings */}
      <Dialog open={settingsOpen} onOpenChange={(open) => { if (!saving) setSettingsOpen(open); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Settings className="h-5 w-5" /> Pengaturan GitHub</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Branch Tujuan</Label>
              <div className="flex gap-2">
                {['dev', 'main'].map((b) => (<Button key={b} variant={branch === b ? 'default' : 'outline'} size="sm" onClick={() => setBranch(b)} className={branch === b ? 'bg-ocean hover:bg-ocean-dark text-white' : ''}>{b}</Button>))}
              </div>
              <p className="text-xs text-muted-foreground"><strong>dev</strong> = Preview · <strong>main</strong> = Production</p>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div><Label className="text-sm font-medium">Auto Push ke GitHub</Label><p className="text-xs text-muted-foreground">Push setiap 5 menit jika sudah sinkron</p></div>
              <Switch checked={autoPush} onCheckedChange={setAutoPush} />
            </div>
            {status.connected && <div className="flex items-center gap-2 text-sm text-green-600"><CheckCircle2 className="h-4 w-4" /> GitHub Token aktif</div>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSettingsOpen(false)} disabled={saving}>Batal</Button>
            <Button onClick={handleSaveConfig} disabled={saving} className="bg-ocean hover:bg-ocean-dark text-white">{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
