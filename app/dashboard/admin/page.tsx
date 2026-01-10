'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Activity, Database, TrendingUp, Users } from 'lucide-react';

interface Stats {
  total: number;
  admins: number;
  users: number;
  viewers: number;
}

export default function AdminPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch('/api/admin/users');
        if (!response.ok) {
          throw new Error('Error al cargar estadísticas');
        }

        const data = await response.json();
        setStats(data.stats);
      } catch (err) {
        console.error('[Admin Dashboard] Error:', err);
        setError('Error al cargar estadísticas');
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="text-gray-400">Cargando estadísticas...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="text-red-500">{error}</div>
      </div>
    );
  }

  const metrics = [
    {
      name: 'Total de Usuarios',
      value: stats?.total || 0,
      href: '/dashboard/admin/users',
      icon: Users,
      iconClasses: 'bg-sky-500/10 border-sky-500/20 text-sky-500',
    },
    {
      name: 'Proyectos Activos',
      value: '—',
      href: '/dashboard/admin/projects',
      icon: Database,
      iconClasses: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500',
      subtitle: 'Próximamente',
    },
    {
      name: 'Tokens Consumidos',
      value: '—',
      href: '/dashboard/admin/usage',
      icon: Activity,
      iconClasses: 'bg-purple-500/10 border-purple-500/20 text-purple-500',
      subtitle: 'Próximamente',
    },
    {
      name: 'Señales Detectadas',
      value: '—',
      href: '/dashboard/admin/projects',
      icon: TrendingUp,
      iconClasses: 'bg-amber-500/10 border-amber-500/20 text-amber-500',
      subtitle: 'Próximamente',
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Vista General del Sistema</h2>
        <p className="text-gray-400">Métricas clave y estado del sistema Signal</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          const isClickable = !metric.subtitle;

          const content = (
            <div
              className={`bg-gray-950 border border-gray-800 rounded-lg p-6 ${
                isClickable ? 'hover:border-gray-700 transition-colors cursor-pointer' : 'opacity-75'
              }`}
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`h-12 w-12 rounded-lg border flex items-center justify-center ${metric.iconClasses}`}>
                  <Icon className="h-6 w-6" />
                </div>
              </div>
              <p className="text-3xl font-bold text-white mb-1">{metric.value}</p>
              <p className="text-sm text-gray-400">{metric.name}</p>
              {metric.subtitle && <p className="text-xs text-gray-600 mt-2">{metric.subtitle}</p>}
            </div>
          );

          return isClickable ? (
            <Link key={metric.name} href={metric.href}>
              {content}
            </Link>
          ) : (
            <div key={metric.name}>{content}</div>
          );
        })}
      </div>

      {stats && (
        <div className="bg-gray-950 border border-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Distribución de Roles</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-sky-500">{stats.admins}</p>
              <p className="text-sm text-gray-400">Administradores</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-emerald-500">{stats.users}</p>
              <p className="text-sm text-gray-400">Usuarios</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-amber-500">{stats.viewers}</p>
              <p className="text-sm text-gray-400">Visualizadores</p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-gray-950 border border-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Acciones Rápidas</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link
            href="/dashboard/admin/users"
            className="flex items-center gap-3 p-4 bg-gray-900 border border-gray-800 rounded-lg hover:border-gray-700 transition-colors"
          >
            <Users className="h-5 w-5 text-sky-500" />
            <div>
              <p className="font-medium text-white">Gestionar Usuarios</p>
              <p className="text-sm text-gray-500">Ver y administrar cuentas de usuario</p>
            </div>
          </Link>

          <div className="flex items-center gap-3 p-4 bg-gray-900 border border-gray-800 rounded-lg opacity-50">
            <Database className="h-5 w-5 text-gray-600" />
            <div>
              <p className="font-medium text-gray-500">Ver Proyectos</p>
              <p className="text-sm text-gray-600">Próximamente</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-4 bg-gray-900 border border-gray-800 rounded-lg opacity-50">
            <Activity className="h-5 w-5 text-gray-600" />
            <div>
              <p className="font-medium text-gray-500">Uso de Tokens</p>
              <p className="text-sm text-gray-600">Próximamente</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-4 bg-gray-900 border border-gray-800 rounded-lg opacity-50">
            <TrendingUp className="h-5 w-5 text-gray-600" />
            <div>
              <p className="font-medium text-gray-500">Salud del Sistema</p>
              <p className="text-sm text-gray-600">Próximamente</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
