'use client';

import { useEffect, useState } from 'react';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle,
  Database,
  Radio,
  Search,
  TrendingUp,
  User,
} from 'lucide-react';
import Link from 'next/link';

interface ProjectMetrics {
  totalSignals: number;
  openSignals: number;
  archivedSignals: number;
  totalSources: number;
  activeSources: number;
  lastActivity: string;
  healthScore: number;
  healthStatus: 'excellent' | 'good' | 'fair' | 'poor';
}

interface Project {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  owner_id: string;
  user_profiles: {
    email: string;
    full_name: string | null;
  };
  metrics: ProjectMetrics;
}

interface Stats {
  totalProjects: number;
  totalSignals: number;
  totalSources: number;
  averageHealth: number;
}

export default function AdminProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [healthFilter, setHealthFilter] = useState('all');

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch('/api/admin/projects');
        if (!response.ok) {
          throw new Error('Error al cargar proyectos');
        }

        const data = await response.json();
        setProjects(data.projects || []);
        setStats(data.stats || null);
      } catch (err) {
        console.error('[Admin Projects] Error:', err);
        setError('Error al cargar proyectos');
      } finally {
        setIsLoading(false);
      }
    };

    fetchProjects();
  }, []);

  const filteredProjects = projects.filter((project) => {
    const matchesSearch =
      project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      project.user_profiles.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      project.user_profiles.full_name?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesHealth =
      healthFilter === 'all' || project.metrics.healthStatus === healthFilter;

    return matchesSearch && matchesHealth;
  });

  const getHealthBadgeClasses = (status: string) => {
    switch (status) {
      case 'excellent':
        return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
      case 'good':
        return 'text-sky-500 bg-sky-500/10 border-sky-500/20';
      case 'fair':
        return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
      case 'poor':
        return 'text-red-500 bg-red-500/10 border-red-500/20';
      default:
        return 'text-gray-500 bg-gray-500/10 border-gray-500/20';
    }
  };

  const getHealthTextClass = (status: string) => {
    switch (status) {
      case 'excellent':
        return 'text-emerald-500';
      case 'good':
        return 'text-sky-500';
      case 'fair':
        return 'text-amber-500';
      case 'poor':
        return 'text-red-500';
      default:
        return 'text-gray-500';
    }
  };

  const getHealthIcon = (status: string) => {
    switch (status) {
      case 'excellent':
      case 'good':
        return CheckCircle;
      case 'fair':
        return AlertTriangle;
      case 'poor':
        return AlertCircle;
      default:
        return Activity;
    }
  };

  const getHealthLabel = (status: string) => {
    switch (status) {
      case 'excellent':
        return 'Excelente';
      case 'good':
        return 'Bueno';
      case 'fair':
        return 'Regular';
      case 'poor':
        return 'Requiere atención';
      default:
        return 'Desconocido';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Hoy';
    if (diffDays === 1) return 'Ayer';
    if (diffDays < 7) return `Hace ${diffDays} días`;
    if (diffDays < 30) return `Hace ${Math.floor(diffDays / 7)} semanas`;

    return date.toLocaleDateString('es-AR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="text-gray-400">Cargando proyectos...</div>
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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Vista Global de Proyectos</h2>
        <p className="text-gray-400">
          Monitoreo de {stats?.totalProjects || 0} proyectos activos en el sistema
        </p>
      </div>

      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-gray-950 border border-gray-800 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-2">
              <Database className="h-5 w-5 text-sky-500" />
              <p className="text-sm text-gray-400">Total Proyectos</p>
            </div>
            <p className="text-2xl font-bold text-white">{stats.totalProjects}</p>
          </div>

          <div className="bg-gray-950 border border-gray-800 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-2">
              <TrendingUp className="h-5 w-5 text-emerald-500" />
              <p className="text-sm text-gray-400">Total Señales</p>
            </div>
            <p className="text-2xl font-bold text-white">{stats.totalSignals}</p>
          </div>

          <div className="bg-gray-950 border border-gray-800 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-2">
              <Radio className="h-5 w-5 text-purple-500" />
              <p className="text-sm text-gray-400">Total Fuentes</p>
            </div>
            <p className="text-2xl font-bold text-white">{stats.totalSources}</p>
          </div>

          <div className="bg-gray-950 border border-gray-800 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-2">
              <Activity className="h-5 w-5 text-amber-500" />
              <p className="text-sm text-gray-400">Salud Promedio</p>
            </div>
            <p className="text-2xl font-bold text-white">{stats.averageHealth}%</p>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" />
          <input
            type="text"
            placeholder="Buscar por nombre de proyecto o usuario..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="w-full bg-gray-950 border border-gray-800 rounded-lg pl-10 pr-4 py-3 text-gray-300 placeholder-gray-600 focus:outline-none focus:border-sky-500"
          />
        </div>

        <select
          value={healthFilter}
          onChange={(event) => setHealthFilter(event.target.value)}
          className="bg-gray-950 border border-gray-800 rounded-lg px-4 py-3 text-gray-300 focus:outline-none focus:border-sky-500"
        >
          <option value="all">Todas las saludes</option>
          <option value="excellent">Excelente</option>
          <option value="good">Bueno</option>
          <option value="fair">Regular</option>
          <option value="poor">Requiere atención</option>
        </select>
      </div>

      {filteredProjects.length === 0 ? (
        <div className="bg-gray-950 border border-gray-800 rounded-lg p-12 text-center">
          <Database className="h-12 w-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-500">
            {searchTerm || healthFilter !== 'all'
              ? 'No se encontraron proyectos con los filtros aplicados'
              : 'No hay proyectos en el sistema'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredProjects.map((project) => {
            const HealthIcon = getHealthIcon(project.metrics.healthStatus);
            const healthBadge = getHealthBadgeClasses(project.metrics.healthStatus);
            const healthText = getHealthTextClass(project.metrics.healthStatus);

            return (
              <div
                key={project.id}
                className="bg-gray-950 border border-gray-800 rounded-lg p-6 hover:border-gray-700 transition-colors"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-white mb-1">
                      {project.name}
                    </h3>
                    {project.description && (
                      <p className="text-sm text-gray-500 line-clamp-2">
                        {project.description}
                      </p>
                    )}
                  </div>

                  <div
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${healthBadge}`}
                  >
                    <HealthIcon className="h-3 w-3" />
                    {project.metrics.healthScore}%
                  </div>
                </div>

                <div className="flex items-center gap-2 mb-4 pb-4 border-b border-gray-800">
                  <User className="h-4 w-4 text-gray-500" />
                  <span className="text-sm text-gray-400">
                    {project.user_profiles.full_name || project.user_profiles.email}
                  </span>
                  {project.user_profiles.full_name && (
                    <span className="text-xs text-gray-600">
                      ({project.user_profiles.email})
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Señales Abiertas</p>
                    <p className="text-lg font-bold text-sky-500">
                      {project.metrics.openSignals}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Total Señales</p>
                    <p className="text-lg font-bold text-gray-400">
                      {project.metrics.totalSignals}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Fuentes Activas</p>
                    <p className="text-lg font-bold text-emerald-500">
                      {project.metrics.activeSources}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Última Actividad</p>
                    <p className="text-sm font-medium text-gray-400">
                      {formatDate(project.metrics.lastActivity)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-gray-800">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-gray-500" />
                    <span className="text-sm text-gray-500">
                      Estado:{' '}
                      <span className={`font-medium ${healthText}`}>
                        {getHealthLabel(project.metrics.healthStatus)}
                      </span>
                    </span>
                  </div>

                  <Link
                    href={`/dashboard?project=${project.id}`}
                    className="flex items-center gap-1 text-sm text-sky-500 hover:text-sky-400 transition-colors"
                  >
                    Ver señales
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {(searchTerm || healthFilter !== 'all') && (
        <p className="text-sm text-gray-500 text-center">
          Mostrando {filteredProjects.length} de {projects.length} proyectos
        </p>
      )}
    </div>
  );
}
