import { NextRequest, NextResponse } from 'next/server';
import { turso } from '@/lib/turso';
import { verifyToken } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get('neis-token')?.value || req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Token tidak valid' }, { status: 401 });
    if (payload.role !== 'admin') return NextResponse.json({ error: 'Hanya admin yang dapat mereset data' }, { status: 403 });

    const body = await req.json();
    const { confirm } = body;
    if (confirm !== 'RESET_ALL_DATA') {
      return NextResponse.json({ error: 'Konfirmasi tidak valid' }, { status: 400 });
    }

    const steps: { step: string; status: string; count?: number }[] = [];

    // Step 1: Count kehadiran_mengajar
    const countKehadiran = await turso.execute('SELECT COUNT(*) as count FROM kehadiran_mengajar');
    const kehadiranCount = Number(countKehadiran.rows[0].count);
    steps.push({ step: 'Menghitung data kehadiran mengajar', status: 'done', count: kehadiranCount });

    // Step 2: Delete Cloudinary photos from kehadiran_mengajar
    const photos = await turso.execute("SELECT foto_mengajar FROM kehadiran_mengajar WHERE foto_mengajar IS NOT NULL AND foto_mengajar != ''");
    const cloudinaryUrls = photos.rows
      .map((r: any) => r.foto_mengajar)
      .filter((url: string) => url && url.includes('cloudinary.com'));

    if (cloudinaryUrls.length > 0) {
      steps.push({ step: `Menghapus ${cloudinaryUrls.length} foto dari Cloudinary`, status: 'processing' });
      try {
        const { deleteFromCloudinary } = await import('@/lib/cloudinary');
        await Promise.allSettled(cloudinaryUrls.map((url: string) => deleteFromCloudinary(url)));
        steps.push({ step: 'Foto Cloudinary dihapus', status: 'done', count: cloudinaryUrls.length });
      } catch {
        steps.push({ step: 'Gagal menghapus beberapa foto Cloudinary', status: 'warning' });
      }
    } else {
      steps.push({ step: 'Tidak ada foto Cloudinary untuk dihapus', status: 'done', count: 0 });
    }

    // Step 3: Delete all kehadiran_mengajar
    await turso.execute('DELETE FROM kehadiran_mengajar');
    steps.push({ step: 'Data kehadiran mengajar dihapus', status: 'done', count: kehadiranCount });

    // Step 4: Count jadwal
    const countJadwal = await turso.execute('SELECT COUNT(*) as count FROM jadwal');
    const jadwalCount = Number(countJadwal.rows[0].count);
    steps.push({ step: 'Menghitung data jadwal mengajar', status: 'done', count: jadwalCount });

    // Step 5: Delete all jadwal
    await turso.execute('DELETE FROM jadwal');
    steps.push({ step: 'Data jadwal mengajar dihapus', status: 'done', count: jadwalCount });

    // Step 6: Verify
    const verifyKehadiran = await turso.execute('SELECT COUNT(*) as count FROM kehadiran_mengajar');
    const verifyJadwal = await turso.execute('SELECT COUNT(*) as count FROM jadwal');
    const remainingKehadiran = Number(verifyKehadiran.rows[0].count);
    const remainingJadwal = Number(verifyJadwal.rows[0].count);

    steps.push({
      step: 'Verifikasi selesai',
      status: remainingKehadiran === 0 && remainingJadwal === 0 ? 'done' : 'warning',
      count: remainingKehadiran + remainingJadwal,
    });

    return NextResponse.json({
      success: true,
      message: `Berhasil menghapus ${kehadiranCount} data kehadiran mengajar dan ${jadwalCount} data jadwal mengajar`,
      steps,
      deleted: { kehadiran: kehadiranCount, jadwal: jadwalCount },
    });
  } catch (error) {
    console.error('Reset data error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
