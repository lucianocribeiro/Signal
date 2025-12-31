import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // IMPORTANT: Avoid writing any logic between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Define route patterns
  const isLoginPage = pathname.startsWith('/login');
  const isDashboardRoute = pathname.startsWith('/dashboard');
  const isAdminRoute = pathname.startsWith('/admin') || pathname.startsWith('/dashboard/admin');
  const isApiRoute = pathname.startsWith('/api');
  const isPublicRoute = isLoginPage || pathname.startsWith('/auth') || pathname === '/';

  // If user is not authenticated
  if (!user) {
    // Allow access to public routes and API routes (API routes handle their own auth)
    if (isPublicRoute || isApiRoute) {
      return supabaseResponse;
    }

    // Redirect to login for protected routes
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set('redirect', pathname); // Save intended destination
    return NextResponse.redirect(loginUrl);
  }

  // User is authenticated - fetch user profile to check role
  let userRole: 'admin' | 'user' | 'viewer' | null = null;

  try {
    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (error) {
      console.error('Error fetching user profile:', error);

      // If profile doesn't exist, redirect to login
      if (error.code === 'PGRST116') {
        await supabase.auth.signOut();
        const loginUrl = request.nextUrl.clone();
        loginUrl.pathname = '/login';
        loginUrl.searchParams.set('error', 'no_profile');
        return NextResponse.redirect(loginUrl);
      }
    } else {
      userRole = profile?.role || null;
    }
  } catch (error) {
    console.error('Error checking user role:', error);
  }

  // If user is authenticated and trying to access login page
  if (isLoginPage) {
    const redirectUrl = request.nextUrl.clone();

    // Check if there's a redirect parameter
    const redirect = request.nextUrl.searchParams.get('redirect');

    if (redirect && !redirect.startsWith('/login')) {
      redirectUrl.pathname = redirect;
      redirectUrl.search = ''; // Clear search params
    } else {
      redirectUrl.pathname = '/dashboard';
    }

    return NextResponse.redirect(redirectUrl);
  }

  // Check admin route access
  if (isAdminRoute) {
    // Only admins can access admin routes
    if (userRole !== 'admin') {
      const dashboardUrl = request.nextUrl.clone();
      dashboardUrl.pathname = '/dashboard';
      dashboardUrl.searchParams.set('error', 'unauthorized');
      dashboardUrl.searchParams.set('message', 'No tienes permisos para acceder a esta sección');
      return NextResponse.redirect(dashboardUrl);
    }
  }

  // All checks passed - allow access
  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
