'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Activity, BarChart3, Bug, Database, FileText, Shield, TrendingUp, Users } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { profile, loading } = useAuth();

  useEffect(() => {
    if (!loading && profile && profile.role !== 'admin') {
      router.push('/dashboard');
    }
  }, [loading, profile, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-gray-400">Verificando acceso...</div>
      </div>
    );
  }

  if (profile?.role !== 'admin') {
    return null;
  }

  const navigation = [
    { name: 'Vista General', href: '/dashboard/admin', icon: BarChart3 },
    { name: 'Usuarios', href: '/dashboard/admin/users', icon: Users },
    { name: 'Debug', href: '/dashboard/admin/debug', icon: Bug },
    { name: 'Proyectos', href: '/dashboard/admin/projects', icon: Database },
    { name: 'Tokens & Costos', href: '/dashboard/admin/usage', icon: Activity },
    { name: 'Salud del Scraper', href: '/dashboard/admin/scraper', icon: TrendingUp },
    { name: 'Logs de Auditoría', href: '/dashboard/admin/logs', icon: FileText },
  ];

  return (
    <div className="min-h-screen bg-black">
      <div className="border-b border-gray-800 bg-gray-950/50 sticky top-0 z-30 backdrop-blur-sm">
        <div className="px-8 py-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
              <Shield className="h-5 w-5 text-sky-500" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Panel de Administración</h1>
              <p className="text-sm text-gray-500">Acceso exclusivo para Administradores</p>
            </div>
          </div>
        </div>
      </div>

      <div className="border-b border-gray-800 bg-gray-950/30">
        <div className="px-8">
          <nav className="flex gap-1">
            {navigation.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    isActive
                      ? 'border-sky-500 text-sky-500'
                      : 'border-transparent text-gray-400 hover:text-gray-300'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      <div className="p-8">{children}</div>
    </div>
  );
}
