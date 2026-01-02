import { NextResponse } from 'next/server';
import chromium from '@sparticuz/chromium-min';
import { existsSync } from 'fs';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const executablePath = await chromium.executablePath(
      'https://github.com/Sparticuz/chromium/releases/download/v121.0.0/chromium-v121.0.0-pack.tar'
    );

    const exists = existsSync(executablePath);

    return NextResponse.json({
      success: true,
      executablePath,
      exists,
      env: process.env.NODE_ENV,
      vercel: !!process.env.VERCEL,
      tmpDir: process.env.TMPDIR || '/tmp',
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        env: process.env.NODE_ENV,
        vercel: !!process.env.VERCEL,
      },
      { status: 500 }
    );
  }
}
