'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Upload, Download, Loader2, Clock, CheckCircle2, XCircle, MinusCircle, RefreshCw, AlertTriangle, ShieldAlert, ArrowDownToLine } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface AutoPushStatus {
  enabled: boolean;
  intervalMinutes: number;
  lastAutoPushTime: string | null;
  lastAutoPushStatus: 'success' | 'failed' | 'no_changes' | 'sandbox_reset_blocked' | null;
  sandboxResetDetected: boolean;
}

export function GitControlPage() {
  const { toast } = useToast();
  const [pushing, setPushing] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [forcePushing, setForcePushing] = useState(false);
  const [autoStatus, setAutoStatus] = useState<AutoPushStatus | null>(null);
  const [toggling, setToggling] = useState(false);
  const [changingInterval, setChangingInterval] = useState(false);

  const fetchAutoStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/git-control', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'auto-push-status' }), credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setAutoStatus(data);
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchAutoStatus();
    const interval = setInterval(fetchAutoStatus, 30000);
    return () => clearInterval(interval);
  }, [fetchAutoStatus]);

  const handlePush = async () => {
    setPushing(true);
    try {
      const res = await fetch('/api/git-control', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'push' }), credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.sandboxResetDetected) {
          toast({ title: '🚨 Sandbox Reset Terdeteksi!', description: data.error, variant: 'destructive', duration: 10000 });
        } else {
          toast({ title: 'Gagal', description: data.error, variant: 'destructive' });
        }
        return;
      }
      toast({ title: 'Berhasil', description: data.message });
      fetchAutoStatus();
    } catch { toast({ title: 'Error', description: 'Terjadi kesalahan koneksi', variant: 'destructive' }); }
    finally { setPushing(false); }
  };

  const handleForcePush = async () => {
    if (!confirm('⚠️ PERINGATAN: Force push akan MENIMPA semua data di GitHub dengan data lokal saat ini. Data GitHub yang lebih baru akan HILANG. Lanjutkan?')) return;
    setForcePushing(true);
    try {
      const res = await fetch('/api/git-control', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'force-push' }), credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) { toast({ title: 'Gagal', description: data.error, variant: 'destructive' }); return; }
      toast({ title: 'Force Push Berhasil', description: data.message });
      fetchAutoStatus();
    } catch { toast({ title: 'Error', description: 'Terjadi kesalahan koneksi', variant: 'destructive' }); }
    finally { setForcePushing(false); }
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
      fetchAutoStatus();
    } catch { toast({ title: 'Error', description: 'Terjadi kesalahan koneksi', variant: 'destructive' }); }
    finally { setPulling(false); }
  };

  const handleDismissSandboxReset = async () => {
    try {
      const res = await fetch('/api/git-control', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'dismiss-sandbox-reset' }), credentials: 'include',
      });
      const data = await res.json();
      if (res.ok) {
        toast({ title: 'Dikonfirmasi', description: data.message });
        fetchAutoStatus();
      }
    } catch {}
  };

  const handleToggleAutoPush = async (enabled: boolean) => {
    setToggling(true);
    try {
      const res = await fetch('/api/git-control', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'auto-push-toggle', enabled }), credentials: 'include',
      });
      const data = await res.json();
      if (res.ok) {
        toast({ title: enabled ? 'Auto-Push Aktif' : 'Auto-Push Nonaktif', description: data.message });
        fetchAutoStatus();
      }
    } catch { toast({ title: 'Error', description: 'Gagal mengubah auto-push', variant: 'destructive' }); }
    finally { setToggling(false); }
  };

  const handleIntervalChange = async (minutes: string) => {
    setChangingInterval(true);
    try {
      const res = await fetch('/api/git-control', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'auto-push-interval', intervalMinutes: parseInt(minutes) }), credentials: 'include',
      });
      const data = await res.json();
      if (res.ok) {
        toast({ title: 'Interval Diubah', description: data.message });
        fetchAutoStatus();
      } else {
        toast({ title: 'Gagal', description: data.error, variant: 'destructive' });
      }
    } catch { toast({ title: 'Error', description: 'Gagal mengubah interval', variant: 'destructive' }); }
    finally { setChangingInterval(false); }
  };

  const formatTime = (isoTime: string | null) => {
    if (!isoTime) return 'Belum pernah';
    const d = new Date(isoTime);
    return d.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const statusIcon = () => {
    if (!autoStatus?.lastAutoPushStatus) return <MinusCircle className="h-4 w-4 text-gray-400" />;
    if (autoStatus.lastAutoPushStatus === 'success') return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    if (autoStatus.lastAutoPushStatus === 'no_changes') return <CheckCircle2 className="h-4 w-4 text-blue-400" />;
    if (autoStatus.lastAutoPushStatus === 'sandbox_reset_blocked') return <ShieldAlert className="h-4 w-4 text-red-500" />;
    return <XCircle className="h-4 w-4 text-red-500" />;
  };

  const statusText = () => {
    if (!autoStatus?.lastAutoPushStatus) return 'Belum ada';
    if (autoStatus.lastAutoPushStatus === 'success') return 'Berhasil';
    if (autoStatus.lastAutoPushStatus === 'no_changes') return 'Tidak ada perubahan';
    if (autoStatus.lastAutoPushStatus === 'sandbox_reset_blocked') return '🚨 Diblokir (Reset)';
    return 'Gagal';
  };

  const isSandboxReset = autoStatus?.sandboxResetDetected === true;

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">Git Control</h1>

      {/* SANDBOX RESET ALERT - Most prominent */}
      {isSandboxReset && (
        <Alert variant="destructive" className="mb-4 border-2 border-red-500">
          <ShieldAlert className="h-5 w-5" />
          <AlertTitle className="text-base font-bold">🚨 TERDETEKSI SANDOX RESET!</AlertTitle>
          <AlertDescription className="space-y-3">
            <p className="text-sm">
              Sandbox telah di-reset ke kondisi awal. <strong>Auto-push telah diblokir</strong> untuk melindungi data backup di GitHub.
            </p>
            <p className="text-sm font-medium">Pilih tindakan:</p>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={handlePull}
                disabled={pulling}
                className="bg-green-600 hover:bg-green-700 text-white"
                size="sm"
              >
                {pulling ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ArrowDownToLine className="h-4 w-4 mr-2" />}
                Pulihkan dari GitHub (Rekomendasi)
              </Button>
              <Button
                onClick={handleForcePush}
                disabled={forcePushing}
                variant="destructive"
                size="sm"
              >
                {forcePushing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                Force Push (Timpa GitHub)
              </Button>
              <Button
                onClick={handleDismissSandboxReset}
                variant="outline"
                size="sm"
              >
                Abaikan & Lanjutkan
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Auto-Push Status Card */}
      <Card className={`mb-4 border-l-4 ${isSandboxReset ? 'border-l-red-500' : 'border-l-ocean'}`}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center justify-between">
            <span className="flex items-center gap-2">
              <RefreshCw className={`h-5 w-5 ${isSandboxReset ? 'text-red-500' : 'text-ocean'}`} />
              Auto-Push Berkala
              {isSandboxReset && <Badge variant="destructive" className="text-xs">DIBLOKIR</Badge>}
            </span>
            <div className="flex items-center gap-2">
              <Label htmlFor="auto-push-toggle" className="text-sm font-normal text-muted-foreground">
                {autoStatus?.enabled ? 'Aktif' : 'Nonaktif'}
              </Label>
              <Switch
                id="auto-push-toggle"
                checked={autoStatus?.enabled ?? true}
                onCheckedChange={handleToggleAutoPush}
                disabled={toggling}
              />
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {isSandboxReset
                ? 'Auto-push diblokir karena sandbox reset terdeteksi. Selesaikan peringatan di atas terlebih dahulu.'
                : 'Otomatis menyimpan perubahan ke GitHub secara berkala. Melindungi data dari sandbox reset.'
              }
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Interval:</span>
                <Select
                  value={String(autoStatus?.intervalMinutes || 5)}
                  onValueChange={handleIntervalChange}
                  disabled={changingInterval || isSandboxReset}
                >
                  <SelectTrigger className="w-24 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 menit</SelectItem>
                    <SelectItem value="3">3 menit</SelectItem>
                    <SelectItem value="5">5 menit</SelectItem>
                    <SelectItem value="10">10 menit</SelectItem>
                    <SelectItem value="15">15 menit</SelectItem>
                    <SelectItem value="30">30 menit</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2 text-sm">
                {statusIcon()}
                <span className="text-muted-foreground">Status:</span>
                <Badge variant={autoStatus?.lastAutoPushStatus === 'sandbox_reset_blocked' || autoStatus?.lastAutoPushStatus === 'failed' ? 'destructive' : 'secondary'} className="text-xs">
                  {statusText()}
                </Badge>
              </div>

              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Terakhir:</span>
                <span className="text-xs">{formatTime(autoStatus?.lastAutoPushTime ?? null)}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Manual Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Upload className="h-5 w-5 text-ocean" /> Simpan ke GitHub
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Push kode dan data terbaru ke repositori GitHub secara manual.
            </p>
            <Button
              onClick={handlePush}
              disabled={pushing}
              className="w-full bg-ocean hover:bg-ocean-dark text-white"
            >
              {pushing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
              {pushing ? 'Menyimpan...' : 'Simpan ke GitHub'}
            </Button>
            {isSandboxReset && (
              <Button
                onClick={handleForcePush}
                disabled={forcePushing}
                variant="destructive"
                className="w-full"
                size="sm"
              >
                {forcePushing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <AlertTriangle className="h-4 w-4 mr-2" />}
                Force Push (Timpa GitHub)
              </Button>
            )}
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
              {isSandboxReset && <span className="text-green-600 font-medium block mt-1">✅ Gunakan ini untuk memulihkan data setelah sandbox reset!</span>}
              {!isSandboxReset && <span className="text-destructive font-medium"> Data lokal akan ditimpa!</span>}
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

      {/* Info Box */}
      <div className="mt-4 p-4 bg-muted/50 rounded-lg border text-sm text-muted-foreground max-w-2xl">
        <p className="font-medium text-foreground mb-2">ℹ️ Informasi Penting</p>
        <ul className="list-disc list-inside space-y-1">
          <li><strong>Auto-Push</strong> berjalan di background setiap {autoStatus?.intervalMinutes || 5} menit.</li>
          <li><strong>🛡️ Sandbox Reset Protection</strong>: Jika sandbox di-reset, auto-push otomatis <strong>diblokir</strong> agar tidak merusak data di GitHub.</li>
          <li><strong>Pemulihan</strong>: Setelah reset, klik <em>&quot;Ambil dari GitHub&quot;</em> untuk memulihkan semua data.</li>
          <li><strong>Force Push</strong>: Hanya gunakan jika Anda yakin ingin menimpa data GitHub dengan data lokal saat ini.</li>
        </ul>
      </div>
    </div>
  );
}
