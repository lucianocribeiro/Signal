'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { TrendingUp, Activity, Filter, FolderKanban, Plus, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import SignalCard, { Signal } from '@/components/SignalCard';
import SignalDetailModal from '@/components/SignalDetailModal';
import { useProjects } from '@/contexts/ProjectContext';

export default function DashboardPage() {
  const router = useRouter();
  const { currentProject, projects, isLoading: projectsLoading } = useProjects();
  const [selectedSignal, setSelectedSignal] = useState<Signal | null>(null);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [isLoadingSignals, setIsLoadingSignals] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch signals for current project
  const fetchSignals = useCallback(async () => {
    if (!currentProject) {
      setSignals([]);
      return;
    }

    setIsLoadingSignals(true);
    setError(null);

    try {
      console.log('[Dashboard] Fetching signals for project:', currentProject.id);

      const response = await fetch(`/api/signals?project_id=${currentProject.id}&status=active`);

      if (!response.ok) {
        throw new Error('Error al cargar señales');
      }

      const data = await response.json();
      console.log('[Dashboard] Loaded', data.signals?.length || 0, 'signals');

      setSignals(data.signals || []);
    } catch (err) {
      console.error('[Dashboard] Error fetching signals:', err);
      setError('Error al cargar las señales');
      setSignals([]);
    } finally {
      setIsLoadingSignals(false);
    }
  }, [currentProject]);

  // Fetch signals when project changes
  useEffect(() => {
    fetchSignals();
  }, [fetchSignals]);

  // Separate signals by priority
  const acceleratingSignals = signals.filter((s) => s.status === 'Accelerating');
  const monitoringSignals = signals.filter((s) => s.status === 'Stabilizing' || s.status === 'New');

  // Archive signal (real database update)
  const handleArchive = async (signalId: string) => {
    try {
      console.log('[Dashboard] Archiving signal:', signalId);

      const response = await fetch('/api/signals', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signal_id: signalId, status: 'Archived' }),
      });

      if (!response.ok) {
        throw new Error('Error al archivar señal');
      }

      console.log('[Dashboard] Signal archived successfully');

      // Remove from local state immediately for responsive UI
      setSignals((prev) => prev.filter((s) => s.id !== signalId));

      // Close modal if this signal was selected
      if (selectedSignal?.id === signalId) {
        setSelectedSignal(null);
      }
    } catch (err) {
      console.error('[Dashboard] Error archiving signal:', err);
      setError('Error al archivar la señal');
    }
  };

  const handleCreateProject = () => {
    router.push('/dashboard/projects');
  };

  // Show loading state while projects are loading
  if (projectsLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 text-signal-500 animate-spin" />
          <p className="text-gray-400">Cargando proyectos...</p>
        </div>
      </div>
    );
  }

  // Show empty state when no projects exist
  if (projects.length === 0) {
    return (
      <div className="min-h-screen bg-black">
        {/* Header */}
        <div className="border-b border-gray-800 bg-gray-950/50 sticky top-0 z-30 backdrop-blur-sm">
          <div className="px-8 py-6">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Tablero de Señales</h1>
              <p className="text-gray-400">
                Monitoreo en tiempo real de eventos y tendencias relevantes
              </p>
            </div>
          </div>
        </div>

        {/* Empty State - No Projects */}
        <div className="flex flex-col items-center justify-center py-32 px-8 text-center">
          <div className="h-20 w-20 rounded-full bg-gray-900 border border-gray-800 flex items-center justify-center mb-6">
            <FolderKanban className="h-10 w-10 text-gray-600" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">Bienvenido a Signal</h2>
          <p className="text-gray-400 max-w-md mb-8">
            Para comenzar a monitorear señales, primero debes crear un proyecto. Los proyectos te permiten organizar y gestionar tus señales de manera eficiente.
          </p>
          <button
            onClick={handleCreateProject}
            className="flex items-center gap-2 px-6 py-3 bg-signal-500 hover:bg-signal-600 text-white rounded-lg transition-colors font-medium text-lg"
          >
            <Plus className="h-6 w-6" />
            Crear Primer Proyecto
          </button>
        </div>
      </div>
    );
  }

  // Show message if no current project is selected (edge case)
  if (!currentProject) {
    return (
      <div className="min-h-screen bg-black">
        {/* Header */}
        <div className="border-b border-gray-800 bg-gray-950/50 sticky top-0 z-30 backdrop-blur-sm">
          <div className="px-8 py-6">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Tablero de Señales</h1>
              <p className="text-gray-400">
                Monitoreo en tiempo real de eventos y tendencias relevantes
              </p>
            </div>
          </div>
        </div>

        {/* No Project Selected State */}
        <div className="flex flex-col items-center justify-center py-32 px-8 text-center">
          <div className="h-20 w-20 rounded-full bg-gray-900 border border-gray-800 flex items-center justify-center mb-6">
            <FolderKanban className="h-10 w-10 text-gray-600" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">No hay proyecto seleccionado</h2>
          <p className="text-gray-400 max-w-md mb-8">
            Por favor, selecciona un proyecto desde el menú lateral para ver sus señales.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-950/50 sticky top-0 z-30 backdrop-blur-sm">
        <div className="px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold text-white">Tablero de Señales</h1>
                <div className="flex items-center gap-2 px-3 py-1 bg-signal-500/10 border border-signal-500/20 rounded-lg">
                  <FolderKanban className="h-4 w-4 text-signal-500" />
                  <span className="text-sm font-medium text-signal-500">{currentProject.name}</span>
                </div>
                {isLoadingSignals && (
                  <Loader2 className="h-5 w-5 text-signal-500 animate-spin" />
                )}
              </div>
              <p className="text-gray-400">
                Monitoreo en tiempo real de eventos y tendencias relevantes
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Stats */}
              <div className="flex items-center gap-2 px-4 py-2 bg-black border border-signal-500/30 rounded-lg">
                <TrendingUp className="h-5 w-5 text-signal-500" />
                <div className="text-right">
                  <div className="text-2xl font-bold text-signal-500">{acceleratingSignals.length}</div>
                  <div className="text-xs text-gray-500">Prioritarias</div>
                </div>
              </div>

              <div className="flex items-center gap-2 px-4 py-2 bg-black border border-gray-700 rounded-lg">
                <Activity className="h-5 w-5 text-gray-400" />
                <div className="text-right">
                  <div className="text-2xl font-bold text-gray-300">{monitoringSignals.length}</div>
                  <div className="text-xs text-gray-500">En Monitoreo</div>
                </div>
              </div>

              <button className="flex items-center gap-2 px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-300 hover:bg-gray-800 hover:border-gray-600 transition-colors">
                <Filter className="h-4 w-4" />
                <span className="text-sm font-medium">Filtros</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-8 py-6 space-y-8">
        {/* Section A: Seguimiento Prioritario */}
        {acceleratingSignals.length > 0 && (
          <section>
            <div className="flex items-center gap-3 mb-4">
              <div className="h-8 w-1 bg-signal-500 rounded-full" />
              <div>
                <h2 className="text-xl font-bold text-gray-300">Seguimiento Prioritario</h2>
                <p className="text-sm text-gray-500">
                  Señales con alto momentum que requieren atención inmediata
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {acceleratingSignals.map((signal) => (
                <SignalCard
                  key={signal.id}
                  signal={signal}
                  onClick={() => setSelectedSignal(signal)}
                />
              ))}
            </div>
          </section>
        )}

        {/* Section B: Monitoreo General */}
        {monitoringSignals.length > 0 && (
          <section>
            <div className="flex items-center gap-3 mb-4">
              <div className="h-8 w-1 bg-gray-600 rounded-full" />
              <div>
                <h2 className="text-xl font-bold text-gray-300">Monitoreo General</h2>
                <p className="text-sm text-gray-500">
                  Señales estabilizadas o nuevas bajo observación continua
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
              {monitoringSignals.map((signal) => (
                <SignalCard
                  key={signal.id}
                  signal={signal}
                  onClick={() => setSelectedSignal(signal)}
                />
              ))}
            </div>
          </section>
        )}

        {/* Error State */}
        {error && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="h-16 w-16 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mb-4">
              <Activity className="h-8 w-8 text-red-500" />
            </div>
            <h3 className="text-xl font-semibold text-red-400 mb-2">Error al cargar señales</h3>
            <p className="text-gray-600 max-w-md mb-4">{error}</p>
            <button
              onClick={fetchSignals}
              className="px-4 py-2 bg-signal-500 hover:bg-signal-600 text-white rounded-lg transition-colors"
            >
              Reintentar
            </button>
          </div>
        )}

        {/* Empty State */}
        {!error && signals.length === 0 && !isLoadingSignals && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="h-16 w-16 rounded-full bg-gray-900 border border-gray-800 flex items-center justify-center mb-4">
              <Activity className="h-8 w-8 text-gray-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-400 mb-2">No hay señales activas</h3>
            <p className="text-gray-600 max-w-md">
              No se han detectado señales para este proyecto aún. Las señales aparecerán aquí cuando sean detectadas por el sistema de análisis.
            </p>
          </div>
        )}

        {/* Loading State */}
        {isLoadingSignals && signals.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Loader2 className="h-10 w-10 text-signal-500 animate-spin mb-4" />
            <p className="text-gray-400">Cargando señales...</p>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      <SignalDetailModal
        signal={selectedSignal}
        isOpen={!!selectedSignal}
        onClose={() => setSelectedSignal(null)}
        onArchive={handleArchive}
      />
    </div>
  );
}
