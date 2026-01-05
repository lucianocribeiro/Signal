'use client';

import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Radio, FolderKanban, Settings, ChevronDown, User, LogOut, Loader2, Users, ChevronLeft, ChevronRight, Bug } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { ProjectProvider } from '@/contexts/ProjectContext';
import ProjectSwitcher from '@/components/ProjectSwitcher';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { signOut, profile, user, loading } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Sidebar collapse state
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const SIDEBAR_COLLAPSED_KEY = 'signal_sidebar_collapsed';

  const userRole = profile?.role;
  const navigation = [
    {
      name: 'Tablero',
      href: '/dashboard',
      icon: LayoutDashboard,
      roles: ['admin', 'user', 'viewer'],
    },
    {
      name: 'Proyectos',
      href: '/dashboard/projects',
      icon: FolderKanban,
      roles: ['admin', 'user'],
    },
    {
      name: 'Fuentes',
      href: '/dashboard/sources',
      icon: Radio,
      roles: ['admin', 'user'],
    },
    {
      name: 'Configuración',
      href: '/dashboard/settings',
      icon: Settings,
      roles: ['admin', 'user'],
    },
    {
      name: 'Usuarios',
      href: '/dashboard/admin/users',
      icon: Users,
      roles: ['admin'],
    },
    {
      name: 'Observadores',
      href: '/dashboard/admin/viewer-assignments',
      icon: Users,
      roles: ['admin'],
    },
    {
      name: 'Debug',
      href: '/dashboard/admin/debug',
      icon: Bug,
      roles: ['admin'],
    },
  ];

  const filteredNavigation = userRole
    ? navigation.filter((item) => item.roles.includes(userRole))
    : [];

  const isActive = (path: string) => {
    if (path === '/dashboard') {
      return pathname === '/dashboard';
    }
    return pathname?.startsWith(path);
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    await signOut();
    router.push('/login');
  };

  // Initialize sidebar state from localStorage
  useEffect(() => {
    setIsMounted(true);
    try {
      const saved = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
      if (saved !== null) {
        setIsSidebarCollapsed(saved === 'true');
      }
    } catch (error) {
      console.warn('localStorage not available:', error);
    }
  }, [SIDEBAR_COLLAPSED_KEY]);

  // Persist sidebar state to localStorage
  useEffect(() => {
    if (isMounted) {
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(isSidebarCollapsed));
      } catch (error) {
        console.warn('localStorage not available:', error);
      }
    }
  }, [isSidebarCollapsed, isMounted, SIDEBAR_COLLAPSED_KEY]);

  return (
    <ProjectProvider>
      <div className="flex h-screen bg-black text-gray-100">
        {/* Sidebar */}
        <aside className={`${isSidebarCollapsed ? 'w-16' : 'w-64'} bg-gray-950 border-r border-gray-800 flex flex-col transition-all duration-300 ease-in-out`}>
          {/* Header - Product Logo */}
          <div className={`${isSidebarCollapsed ? 'p-3' : 'p-6'} border-b border-gray-800 transition-all duration-300`}>
            <div className={`relative ${isSidebarCollapsed ? 'h-8 w-8' : 'h-[4.2rem] w-full'} transition-all duration-300 mx-auto`}>
              <Image
                src="/Signal.png"
                alt="Signal"
                fill
                className="object-contain"
                priority
              />
            </div>

            {/* Toggle Button */}
            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className={`${isSidebarCollapsed ? 'mt-2' : 'mt-3'} w-full flex items-center justify-center p-2 rounded-lg text-gray-400 hover:text-signal-500 hover:bg-gray-900 transition-colors`}
              title={isSidebarCollapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
              aria-label={isSidebarCollapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
            >
              {isSidebarCollapsed ? (
                <ChevronRight className="h-5 w-5" />
              ) : (
                <ChevronLeft className="h-5 w-5" />
              )}
            </button>
          </div>

          {/* Project Context Selector */}
          <ProjectSwitcher isCollapsed={isSidebarCollapsed} />

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1">
            {filteredNavigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center ${isSidebarCollapsed ? 'justify-center' : 'gap-3'} px-3 py-2 rounded-lg transition-colors ${
                  isActive(item.href)
                    ? 'bg-signal-500/10 text-signal-500 border border-signal-500/20 font-medium'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-900'
                }`}
                title={isSidebarCollapsed ? item.name : undefined}
              >
                <item.icon className="h-5 w-5 flex-shrink-0" />
                {!isSidebarCollapsed && <span>{item.name}</span>}
              </Link>
            ))}
          </nav>

          {/* Footer - User Profile + Agency Logo */}
          <div className={`${isSidebarCollapsed ? 'p-2' : 'p-4'} border-t border-gray-800 space-y-3`}>
            {/* User Profile */}
            {loading ? (
              // Loading Skeleton
              <div className={`flex items-center ${isSidebarCollapsed ? 'justify-center px-1 py-2' : 'gap-3 px-3 py-2'} rounded-lg bg-black border border-gray-800 animate-pulse`}>
                <div className="h-8 w-8 rounded-full bg-gray-800" />
                {!isSidebarCollapsed && (
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="h-4 bg-gray-800 rounded w-24" />
                    <div className="h-3 bg-gray-800 rounded w-32" />
                  </div>
                )}
              </div>
            ) : (
              <div
                className={`flex items-center ${isSidebarCollapsed ? 'justify-center px-1 py-2' : 'gap-3 px-3 py-2'} rounded-lg bg-black border border-gray-800`}
                title={isSidebarCollapsed ? `${profile?.full_name || 'Usuario'} - ${user?.email}` : undefined}
              >
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-signal-500 to-signal-600 flex items-center justify-center flex-shrink-0">
                  <User className="h-4 w-4 text-white" />
                </div>
                {!isSidebarCollapsed && (
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-200 truncate">
                        {profile?.full_name || 'Usuario'}
                      </p>
                      {profile?.role === 'admin' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-signal-500/10 text-signal-500 border border-signal-500/20">
                          Admin
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 truncate">
                      {user?.email || 'cargando...'}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center px-1 py-2' : 'gap-3 px-3 py-2'} rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-950/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-transparent hover:border-red-900/30`}
              title={isSidebarCollapsed ? 'Cerrar Sesión' : undefined}
            >
              {isLoggingOut ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  {!isSidebarCollapsed && <span className="text-sm">Cerrando sesión...</span>}
                </>
              ) : (
                <>
                  <LogOut className="h-5 w-5" />
                  {!isSidebarCollapsed && <span className="text-sm">Cerrar Sesión</span>}
                </>
              )}
            </button>

            {/* Agency Logo - 20% Larger */}
            {!isSidebarCollapsed && (
              <div className="flex justify-center pb-2">
                <div className="relative h-14 w-40">
                  <Image
                    src="/Logo Final.png"
                    alt="Agencia Kairos"
                    fill
                    className="object-contain"
                    priority
                  />
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </ProjectProvider>
  );
}
