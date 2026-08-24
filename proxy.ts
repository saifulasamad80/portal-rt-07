import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Tarik identitas bawaan Supabase
  const { data: { user } } = await supabase.auth.getUser()

  // FAKTA: Berikan kacamata baru agar Middleware BISA MELIHAT Custom JWT kita!
  const adminToken = request.cookies.get('admin_session')?.value
  const wargaToken = request.cookies.get('warga_session')?.value

  // PROTEKSI ADMIN DOMINO EFFECT RESOLVED
  if (!user && !adminToken && 
      request.nextUrl.pathname.startsWith("/admin") && 
      request.nextUrl.pathname !== "/admin") {
    return NextResponse.redirect(new URL("/admin", request.url))
  }

  // PROTEKSI PORTAL WARGA DOMINO EFFECT RESOLVED
  if (!user && !wargaToken && 
      request.nextUrl.pathname.startsWith("/portal") && 
      request.nextUrl.pathname !== "/login") {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ["/admin/:path*", "/portal/:path*"]
}