import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// REVISI MUTLAK: Nama fungsi wajib diubah dari 'middleware' menjadi 'proxy'
export function proxy(request: NextRequest) {
  const response = NextResponse.next();

  // 2. TAMBAL DOSA HSTS: Maksa browser pakai HTTPS selama 1 tahun (31536000 detik)
  response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');

  // 3. TAMBAL DOSA CSP: Bikin aturan ketat dari mana aja sumber file yang boleh di-load
  const scriptSrc = process.env.NODE_ENV === "production"
    ? "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://cdn.onesignal.com https://onesignal.com https://*.onesignal.com https://cdn.jsdelivr.net"
    : "script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' https://cdn.onesignal.com https://onesignal.com https://*.onesignal.com https://cdn.jsdelivr.net";
  const cspHeader = `
    default-src 'self';
    ${scriptSrc};
    style-src 'self' 'unsafe-inline';
    img-src 'self' blob: data: https://*.supabase.co https://*.onesignal.com;
    font-src 'self' data:;
    connect-src 'self' https://*.supabase.co https://fcm.googleapis.com https://android.googleapis.com https://updates.push.services.mozilla.com https://web.push.apple.com https://cdn.onesignal.com https://onesignal.com https://*.onesignal.com https://cdn.jsdelivr.net;
    worker-src 'self' blob: https://cdn.onesignal.com https://cdn.jsdelivr.net;
    frame-src https://onesignal.com https://*.onesignal.com;
    manifest-src 'self';
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
  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};