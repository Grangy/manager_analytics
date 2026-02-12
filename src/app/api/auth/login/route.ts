import { NextRequest, NextResponse } from 'next/server';

const AUTH_PASSWORD = process.env.AUTH_PASSWORD || '22170313';

export async function POST(req: NextRequest) {
  try {
    const { password } = await req.json();
    if (!password || typeof password !== 'string') {
      return NextResponse.json({ ok: false, error: 'Неверный формат' }, { status: 400 });
    }
    const ok = password.trim() === AUTH_PASSWORD;
    return NextResponse.json({ ok });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
