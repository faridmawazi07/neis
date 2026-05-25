import { NextRequest, NextResponse } from 'next/server';
import { turso } from '@/lib/turso';
import { comparePassword, signToken } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const { nip, password, rememberMe } = await req.json();

    if (!nip || !password) {
      return NextResponse.json({ error: 'NIP/Username dan password wajib diisi' }, { status: 400 });
    }

    // Find user by nip (for guru/pegawai/pimpinan) or by nip field containing admin username
    const result = await turso.execute({
      sql: 'SELECT * FROM users WHERE nip = ? AND status_persetujuan = ?',
      args: [nip, 'approved'],
    });

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Akun tidak ditemukan atau belum disetujui' }, { status: 401 });
    }

    const user = result.rows[0];
    const valid = await comparePassword(password, user.password as string);

    if (!valid) {
      return NextResponse.json({ error: 'Password salah' }, { status: 401 });
    }

    const token = signToken({
      userId: user.id as string,
      nip: user.nip as string,
      nama: user.nama as string,
      role: user.role as string,
      status_persetujuan: user.status_persetujuan as string,
    });

    const response = NextResponse.json({
      token,
      user: {
        id: user.id,
        nip: user.nip,
        nama: user.nama,
        role: user.role,
        status_persetujuan: user.status_persetujuan,
        foto_profile: user.foto_profile,
        jenis_kelamin: user.jenis_kelamin,
        tanggal_lahir: user.tanggal_lahir,
      },
    });

    const isProduction = process.env.NODE_ENV === 'production';

    if (rememberMe) {
      response.cookies.set('neis-token', token, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60, // 7 days
        path: '/',
      });
      response.cookies.set('neis-remember', 'true', {
        httpOnly: false,
        secure: isProduction,
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60, // 30 days
        path: '/',
      });
    } else {
      response.cookies.set('neis-token', token, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
        maxAge: 24 * 60 * 60, // 1 day
        path: '/',
      });
    }

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
