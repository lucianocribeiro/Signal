'use client';

import React, { useState } from 'react';
import { LayoutDashboard, Radio, FolderKanban, Settings, ChevronDown, User, LogOut, Loader2 } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { signOut, profile, user, loading } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const isActive = (path: string) => {
    if (path === '/dashboard') {
      return pathname === '/dashboard';
    }
    return pathname?.startsWith(path);
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await signOut();
      router.push('/login');
    } catch (error) {
      console.error('Error during logout:', error);
      setIsLoggingOut(false);
    }
  };

  return (
    <div className="flex h-screen bg-black text-gray-100">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-950 border-r border-gray-800 flex flex-col">
        {/* Header - Product Logo */}
        <div className="p-6 border-b border-gray-800">
          <div className="relative h-[4.2rem] w-full">
            <Image
              src="/Signal.png"
              alt="Signal"
              fill
              className="object-contain"
              priority
            />
          </div>
        </div>

        {/* Project Context Selector */}
        <div className="p-4 border-b border-gray-800">
          <button className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-black border border-gray-800 hover:border-gray-700 transition-colors">
            <span className="text-sm font-medium text-gray-300">Proyecto Actual</span>
            <ChevronDown className="h-4 w-4 text-gray-400" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          <Link
            href="/dashboard"
            className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
              isActive('/dashboard')
                ? 'bg-signal-500/10 text-signal-500 border border-signal-500/20 font-medium'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-900'
            }`}
          >
            <LayoutDashboard className="h-5 w-5" />
            <span>Tablero</span>
          </Link>

          <Link
            href="/dashboard/sources"
            className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
              isActive('/dashboard/sources')
                ? 'bg-signal-500/10 text-signal-500 border border-signal-500/20 font-medium'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-900'
            }`}
          >
            <Radio className="h-5 w-5" />
            <span>Fuentes</span>
          </Link>

          <Link
            href="/dashboard/projects"
            className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
              isActive('/dashboard/projects')
                ? 'bg-signal-500/10 text-signal-500 border border-signal-500/20 font-medium'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-900'
            }`}
          >
            <FolderKanban className="h-5 w-5" />
            <span>Proyectos</span>
          </Link>

          <Link
            href="/dashboard/settings"
            className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
              isActive('/dashboard/settings')
                ? 'bg-signal-500/10 text-signal-500 border border-signal-500/20 font-medium'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-900'
            }`}
          >
            <Settings className="h-5 w-5" />
            <span>Configuración</span>
          </Link>
        </nav>

        {/* Footer - User Profile + Agency Logo */}
        <div className="p-4 border-t border-gray-800 space-y-3">
          {/* User Profile */}
          {loading ? (
            // Loading Skeleton
            <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-black border border-gray-800 animate-pulse">
              <div className="h-8 w-8 rounded-full bg-gray-800" />
              <div className="flex-1 min-w-0 space-y-2">
                <div className="h-4 bg-gray-800 rounded w-24" />
                <div className="h-3 bg-gray-800 rounded w-32" />
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-black border border-gray-800">
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-signal-500 to-signal-600 flex items-center justify-center flex-shrink-0">
                <User className="h-4 w-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-gray-200 truncate">
                    {profile?.full_name || 'Usuario'}
                  </p>
                  {profile?.role === 'owner' && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-signal-500/10 text-signal-500 border border-signal-500/20">
                      Owner
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 truncate">
                  {user?.email || 'cargando...'}
                </p>
              </div>
            </div>
          )}

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-950/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-transparent hover:border-red-900/30"
          >
            {isLoggingOut ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm">Cerrando sesión...</span>
              </>
            ) : (
              <>
                <LogOut className="h-5 w-5" />
                <span className="text-sm">Cerrar Sesión</span>
              </>
            )}
          </button>

          {/* Agency Logo - 20% Larger */}
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
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
