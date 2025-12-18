'use client';

import React, { useState, useEffect } from 'react';
import { TrendingUp, Activity, Filter, FolderKanban, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import SignalCard, { Signal } from '@/components/SignalCard';
import SignalDetailModal from '@/components/SignalDetailModal';

// Mock Data for Development
const mockSignals: Signal[] = [
  {
    id: '1',
    status: 'Accelerating',
    headline: 'Nueva regulación de IA aprobada en la Unión Europea',
    summary: 'El Parlamento Europeo aprueba la primera ley integral sobre inteligencia artificial que afectará a empresas tecnológicas globales.',
    source: 'TechCrunch',
    sourceUrl: 'https://techcrunch.com/ai-regulation-eu',
    detectedAt: 'Hace 12 min',
    momentum: 'high',
  },
  {
    id: '2',
    status: 'Accelerating',
    headline: 'Lanzamiento de nueva plataforma de análisis predictivo para PyMEs',
    summary: 'Una startup argentina presenta una solución de machine learning accesible para pequeñas y medianas empresas del sector financiero.',
    source: 'Ámbito Financiero',
    sourceUrl: 'https://ambito.com/startup-ml-pymes',
    detectedAt: 'Hace 25 min',
    momentum: 'high',
  },
  {
    id: '3',
    status: 'Accelerating',
    headline: 'Microsoft integra nuevas capacidades de GPT-5 en Azure',
    summary: 'La compañía anuncia integración profunda de modelos de lenguaje de próxima generación en su plataforma cloud empresarial.',
    source: 'The Verge',
    sourceUrl: 'https://theverge.com/microsoft-gpt5-azure',
    detectedAt: 'Hace 45 min',
    momentum: 'medium',
  },
  {
    id: '4',
    status: 'Stabilizing',
    headline: 'Actualización de políticas de privacidad en redes sociales',
    summary: 'Principales plataformas ajustan sus términos de servicio en respuesta a nuevas regulaciones de protección de datos.',
    source: 'Reuters',
    sourceUrl: 'https://reuters.com/social-privacy-updates',
    detectedAt: 'Hace 1 hora',
    momentum: 'low',
  },
  {
    id: '5',
    status: 'New',
    headline: 'Inversión récord en startups de tecnología climática',
    summary: 'Fondos de capital riesgo destinan $2.5B a empresas enfocadas en soluciones tecnológicas para el cambio climático.',
    source: 'Bloomberg',
    sourceUrl: 'https://bloomberg.com/climate-tech-investment',
    detectedAt: 'Hace 2 horas',
    momentum: 'medium',
  },
  {
    id: '6',
    status: 'Stabilizing',
    headline: 'Adopción de blockchain en cadenas de suministro',
    summary: 'Empresas logísticas reportan implementación gradual de tecnología blockchain para tracking de productos.',
    source: 'Supply Chain Dive',
    sourceUrl: 'https://supplychaindive.com/blockchain-adoption',
    detectedAt: 'Hace 3 horas',
    momentum: 'low',
  },
  {
    id: '7',
    status: 'Accelerating',
    headline: 'Nuevo protocolo de ciberseguridad adoptado por bancos centrales',
    summary: 'Instituciones financieras globales implementan estándar unificado para protección contra amenazas cibernéticas avanzadas.',
    source: 'Financial Times',
    sourceUrl: 'https://ft.com/cyber-banking-protocol',
    detectedAt: 'Hace 15 min',
    momentum: 'high',
  },
];

export default function DashboardPage() {
  const router = useRouter();
  const [selectedSignal, setSelectedSignal] = useState<Signal | null>(null);
  const [signals, setSignals] = useState<Signal[]>(mockSignals);
  const [hasProjects, setHasProjects] = useState(true);

  // Check if projects exist on mount
  useEffect(() => {
    const projectsData = localStorage.getItem('projects');
    if (projectsData) {
      const projects = JSON.parse(projectsData);
      setHasProjects(projects.length > 0);
    } else {
      setHasProjects(false);
    }
  }, []);

  // Separate signals by priority
  const acceleratingSignals = signals.filter((s) => s.status === 'Accelerating');
  const monitoringSignals = signals.filter((s) => s.status === 'Stabilizing' || s.status === 'New');

  const handleArchive = (signalId: string) => {
    setSignals((prev) => prev.filter((s) => s.id !== signalId));
    console.log(`Signal ${signalId} archived`);
  };

  const handleCreateProject = () => {
    router.push('/dashboard/projects');
  };

  // Show empty state when no projects exist
  if (!hasProjects) {
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

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-950/50 sticky top-0 z-30 backdrop-blur-sm">
        <div className="px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Tablero de Señales</h1>
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

        {/* Empty State */}
        {signals.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="h-16 w-16 rounded-full bg-gray-900 border border-gray-800 flex items-center justify-center mb-4">
              <Activity className="h-8 w-8 text-gray-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-400 mb-2">No hay señales activas</h3>
            <p className="text-gray-600 max-w-md">
              Todas las señales han sido archivadas. Nuevas señales aparecerán aquí cuando sean
              detectadas.
            </p>
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
