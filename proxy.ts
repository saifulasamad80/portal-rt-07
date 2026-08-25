import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// REVISI MUTLAK: Nama fungsi wajib diubah dari 'middleware' menjadi 'proxy'
export function proxy(request: NextRequest) {
  // 1. Inisiasi Proxy: Tangkap request yang masuk
  const response = NextResponse.next();

  // 2. TAMBAL DOSA HSTS: Maksa browser pakai HTTPS selama 1 tahun (31536000 detik)
  response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');

  // 3. TAMBAL DOSA CSP: Bikin aturan ketat dari mana aja sumber file yang boleh di-load
  const cspHeader = `
    default-src 'self';
    script-src 'self' 'unsafe-inline' 'unsafe-eval';
    style-src 'self'; 
    img-src 'self' blob: data: https://*.supabase.co;
    font-src 'self' data:;
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    upgrade-insecure-requests;
  `.replace(/\s{2,}/g, ' ').trim(); 
  
  response.headers.set('Content-Security-Policy', cspHeader);

  // 4. HEADER KEAMANAN TAMBAHAN (Anti Clickjacking & MIME Sniffing)
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // 5. TAMBAL DOSA COOKIE: Deteksi & paksa semua Cookie jadi HttpOnly & Secure
  const setCookieHeader = response.headers.get('Set-Cookie');
  if (setCookieHeader && !setCookieHeader.toLowerCase().includes('httponly')) {
    response.headers.set('Set-Cookie', `${setCookieHeader}; HttpOnly; Secure; SameSite=Strict`);
  }

  return response;
}

// Konfigurasi Matcher: Tentukan rute mana saja yang dikawal oleh Proxy ini
export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};