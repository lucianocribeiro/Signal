'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, Settings2 } from 'lucide-react';
import { useProjects } from '@/contexts/ProjectContext';
import ProjectSettings from '@/components/settings/ProjectSettings';
import SourceManagement from '@/components/settings/SourceManagement';

interface ProjectRecord {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  settings?: {
    refresh_interval_hours?: number;
  } | null;
}

export default function SettingsPage() {
  const { currentProject, projects, isLoading: projectsLoading } = useProjects();
  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [isLoadingProject, setIsLoadingProject] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProject = async (projectId: string) => {
    setIsLoadingProject(true);
    setError(null);

    try {
      const response = await fetch(`/api/projects/${projectId}`);
      if (!response.ok) {
        throw new Error('Error al cargar proyecto');
      }
      const data = await response.json();
      setProject(data.project || null);
    } catch (err) {
      console.error('[Settings] Error fetching project:', err);
      setError('Error al cargar proyecto');
      setProject(null);
    } finally {
      setIsLoadingProject(false);
    }
  };

  useEffect(() => {
    if (!currentProject) {
      setProject(null);
      return;
    }

    fetchProject(currentProject.id);
  }, [currentProject?.id]);

  if (projectsLoading || isLoadingProject) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 text-signal-500 animate-spin" />
          <p className="text-gray-400">Cargando configuración...</p>
        </div>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="min-h-screen bg-black">
        <div className="border-b border-gray-800 bg-gray-950/50 sticky top-0 z-30 backdrop-blur-sm">
          <div className="px-8 py-6">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Configuración</h1>
              <p className="text-gray-400">
                Administra la configuración de tus proyectos
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center py-32 px-8 text-center">
          <div className="h-20 w-20 rounded-full bg-gray-900 border border-gray-800 flex items-center justify-center mb-6">
            <Settings2 className="h-10 w-10 text-gray-600" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">No hay proyectos</h2>
          <p className="text-gray-400 max-w-md">
            Primero debes crear un proyecto para poder configurar sus ajustes.
          </p>
        </div>
      </div>
    );
  }

  if (!currentProject || !project) {
    return (
      <div className="min-h-screen bg-black">
        <div className="border-b border-gray-800 bg-gray-950/50 sticky top-0 z-30 backdrop-blur-sm">
          <div className="px-8 py-6">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Configuración</h1>
              <p className="text-gray-400">
                Administra la configuración de tus proyectos
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <p className="text-gray-400">Selecciona un proyecto para configurar.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-gray-100">
      <div className="border-b border-gray-800 bg-gray-950/50 sticky top-0 z-30 backdrop-blur-sm">
        <div className="px-8 py-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-white">Configuración del Proyecto</h1>
              <p className="text-gray-400">
                Gestiona la configuración y fuentes del proyecto seleccionado
              </p>
            </div>
            <Link
              href="/dashboard"
              className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-200 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Volver al Tablero
            </Link>
          </div>
        </div>
      </div>

      <div className="px-8 py-8 space-y-8">
        {error && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
            {error}
          </div>
        )}

        <ProjectSettings
          project={project}
          onProjectUpdated={(updated) => setProject(updated)}
        />

        <SourceManagement projectId={project.id} />
      </div>
    </div>
  );
}
