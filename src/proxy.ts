import { NextRequest, NextResponse } from 'next/server'

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  // We rely on a lightweight UI cookie set by the client after login
  const hasSession = req.cookies.has('parchi_ui_auth')

  // Not logged in and not on login page or auth callback → redirect to login
  if (!hasSession && !pathname.startsWith('/login') && !pathname.startsWith('/auth/callback')) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  // Already logged in and on login page → redirect to home
  if (hasSession && pathname.startsWith('/login')) {
    return NextResponse.redirect(new URL('/', req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
