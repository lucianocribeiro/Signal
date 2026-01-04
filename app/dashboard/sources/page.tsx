'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Radio, FolderKanban, RefreshCw, Loader2, CheckCircle, Info } from 'lucide-react';
import { useProjects } from '@/contexts/ProjectContext';
import AddSourceModal from '@/components/AddSourceModal';
import SourcesList from '@/components/SourcesList';
import DeleteSourceConfirmModal from '@/components/DeleteSourceConfirmModal';
import { UrlBestPracticesInfo } from '@/components/ui/url-best-practices-info';

interface Source {
  id: string;
  project_id: string;
  url: string;
  name: string | null;
  source_type: 'twitter' | 'reddit' | 'news';
  platform: string;
  is_active: boolean;
  last_scraped_at: string | null;
  created_at: string;
  updated_at: string;
}

export default function SourcesPage() {
  const { currentProject, projects, isLoading: projectsLoading } = useProjects();
  const [sources, setSources] = useState<Source[]>([]);
  const [isLoadingSources, setIsLoadingSources] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [sourceToDelete, setSourceToDelete] = useState<Source | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Fetch sources for current project
  const fetchSources = async () => {
    if (!currentProject) {
      setSources([]);
      return;
    }

    setIsLoadingSources(true);
    setError(null);

    try {
      const response = await fetch(`/api/sources?project_id=${currentProject.id}`);

      if (!response.ok) {
        throw new Error('Error al obtener fuentes');
      }

      const data = await response.json();
      setSources(data.sources || []);
    } catch (err) {
      console.error('Error fetching sources:', err);
      setError('Error al cargar las fuentes');
      setSources([]);
    } finally {
      setIsLoadingSources(false);
    }
  };

  // Fetch sources when project changes
  useEffect(() => {
    fetchSources();
  }, [currentProject?.id]);

  // Handle source added
  const handleSourceAdded = () => {
    fetchSources();
  };

  // Handle delete click
  const handleDeleteClick = (source: Source) => {
    setSourceToDelete(source);
    setIsDeleteModalOpen(true);
  };

  // Handle delete confirm
  const handleDeleteConfirm = async (sourceId: string) => {
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(`/api/sources/${sourceId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al eliminar fuente');
      }

      // Success - remove from list and show message
      setSources((prev) => prev.filter((s) => s.id !== sourceId));
      setSuccessMessage('Fuente eliminada correctamente');
      setIsDeleteModalOpen(false);
      setSourceToDelete(null);

      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccessMessage(null);
      }, 3000);
    } catch (err) {
      console.error('Error deleting source:', err);
      throw err; // Re-throw to let modal handle it
    }
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
              <h1 className="text-3xl font-bold text-white mb-2">Fuentes</h1>
              <p className="text-gray-400">
                Gestiona las fuentes de datos para tus proyectos
              </p>
            </div>
          </div>
        </div>

        {/* Empty State - No Projects */}
        <div className="flex flex-col items-center justify-center py-32 px-8 text-center">
          <div className="h-20 w-20 rounded-full bg-gray-900 border border-gray-800 flex items-center justify-center mb-6">
            <FolderKanban className="h-10 w-10 text-gray-600" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">No hay proyectos</h2>
          <p className="text-gray-400 max-w-md mb-8">
            Primero debes crear un proyecto para poder agregar fuentes de monitoreo
          </p>
        </div>
      </div>
    );
  }

  // Show message if no current project is selected
  if (!currentProject) {
    return (
      <div className="min-h-screen bg-black">
        {/* Header */}
        <div className="border-b border-gray-800 bg-gray-950/50 sticky top-0 z-30 backdrop-blur-sm">
          <div className="px-8 py-6">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Fuentes</h1>
              <p className="text-gray-400">
                Gestiona las fuentes de datos para tus proyectos
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
            Por favor, selecciona un proyecto desde el menú lateral para ver sus fuentes
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
                <h1 className="text-3xl font-bold text-white">Fuentes</h1>
                <div className="flex items-center gap-2 px-3 py-1 bg-signal-500/10 border border-signal-500/20 rounded-lg">
                  <FolderKanban className="h-4 w-4 text-signal-500" />
                  <span className="text-sm font-medium text-signal-500">{currentProject.name}</span>
                </div>
              </div>
              <p className="text-gray-400">
                Gestiona las URLs que se monitorean para detectar señales
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Refresh Button */}
              <button
                onClick={fetchSources}
                disabled={isLoadingSources}
                className="flex items-center gap-2 px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-300 hover:bg-gray-800 hover:border-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw className={`h-4 w-4 ${isLoadingSources ? 'animate-spin' : ''}`} />
                <span className="text-sm font-medium">Actualizar</span>
              </button>

              {/* Info Button */}
              <button
                onClick={() => setIsInfoOpen((prev) => !prev)}
                className="flex items-center gap-2 px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-300 hover:bg-gray-800 hover:border-gray-600 transition-colors"
                aria-expanded={isInfoOpen}
                aria-controls="url-best-practices"
              >
                <Info className="h-4 w-4" />
                <span className="text-sm font-medium">Info</span>
              </button>

              {/* Add Source Button */}
              <button
                onClick={() => setIsModalOpen(true)}
                className="flex items-center gap-2 px-6 py-2.5 bg-signal-500 hover:bg-signal-600 text-white rounded-lg transition-colors font-medium"
              >
                <Plus className="h-5 w-5" />
                <span>Agregar Fuente</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-8 py-6">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-black border border-gray-800 rounded-lg p-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-signal-500/10 border border-signal-500/20 flex items-center justify-center">
                <Radio className="h-5 w-5 text-signal-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{sources.length}</p>
                <p className="text-sm text-gray-500">Total de Fuentes</p>
              </div>
            </div>
          </div>

          <div className="bg-black border border-gray-800 rounded-lg p-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                <Radio className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">
                  {sources.filter((s) => s.is_active).length}
                </p>
                <p className="text-sm text-gray-500">Fuentes Activas</p>
              </div>
            </div>
          </div>

          <div className="bg-black border border-gray-800 rounded-lg p-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
                <Radio className="h-5 w-5 text-sky-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">
                  {sources.filter((s) => s.source_type === 'twitter').length}
                </p>
                <p className="text-sm text-gray-500">Twitter/X</p>
              </div>
            </div>
          </div>
        </div>

        {/* Success Message */}
        {successMessage && (
          <div className="bg-signal-500/10 border border-signal-500/30 rounded-lg p-4 mb-6 flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-signal-500 flex-shrink-0" />
            <p className="text-signal-400">{successMessage}</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-950/20 border border-red-900/30 rounded-lg p-4 mb-6">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {isInfoOpen && (
          <div id="url-best-practices">
            <UrlBestPracticesInfo />
          </div>
        )}

        {/* Sources List */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-300">
              Fuentes del Proyecto ({sources.length})
            </h2>
          </div>

          <SourcesList
            sources={sources}
            isLoading={isLoadingSources}
            onDeleteClick={handleDeleteClick}
          />
        </div>
      </div>

      {/* Add Source Modal */}
      <AddSourceModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        projectId={currentProject.id}
        onSourceAdded={handleSourceAdded}
      />

      {/* Delete Source Confirmation Modal */}
      <DeleteSourceConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setSourceToDelete(null);
        }}
        source={sourceToDelete}
        onConfirmDelete={handleDeleteConfirm}
      />
    </div>
  );
}
