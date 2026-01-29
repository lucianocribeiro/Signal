'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import AddSourceModal from '@/components/settings/AddSourceModal';
import ConfirmDialog from '@/components/settings/ConfirmDialog';
import Toast, { ToastType } from '@/components/ui/toast';

interface SourceRecord {
  id: string;
  project_id: string;
  url: string;
  name: string | null;
  source_type: 'twitter' | 'reddit' | 'news' | 'marketplace';
  is_active: boolean;
  last_scraped_at: string | null;
  created_at: string;
  updated_at: string;
}

interface SourceManagementProps {
  projectId: string;
}

function formatRelativeTime(value: string | null) {
  if (!value) return 'Nunca';

  const date = new Date(value);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Hace instantes';
  if (diffMins < 60) return `Hace ${diffMins} min`;
  if (diffHours < 24) return `Hace ${diffHours} h`;
  if (diffDays < 7) return `Hace ${diffDays} d`;
  return new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium' }).format(date);
}

function getTypeBadge(sourceType: SourceRecord['source_type']) {
  switch (sourceType) {
    case 'twitter':
      return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    case 'reddit':
      return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
    case 'marketplace':
      return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
    case 'news':
    default:
      return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
  }
}

function getTypeLabel(sourceType: SourceRecord['source_type']) {
  if (sourceType === 'twitter') return 'Twitter';
  if (sourceType === 'reddit') return 'Reddit';
  if (sourceType === 'marketplace') return 'Marketplace';
  if (sourceType === 'news') return 'Noticias';
  return 'Otra';
}

export default function SourceManagement({ projectId }: SourceManagementProps) {
  const [sources, setSources] = useState<SourceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SourceRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [toast, setToast] = useState<{ type: ToastType; message: string } | null>(null);

  const fetchSources = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/sources?project_id=${projectId}`);
      if (!response.ok) {
        throw new Error('Error al cargar fuentes');
      }
      const data = await response.json();
      setSources(data.sources || []);
    } catch (error) {
      console.error('[SourceManagement] Fetch failed:', error);
      setToast({ type: 'error', message: 'Error al cargar fuentes' });
      setSources([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSources();
  }, [projectId]);

  const handleSourceAdded = (source: SourceRecord) => {
    setSources((prev) => [source, ...prev]);
    setToast({ type: 'success', message: 'Fuente agregada exitosamente' });
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);

    try {
      const response = await fetch(`/api/sources/${deleteTarget.id}`, {
        method: 'DELETE',
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al eliminar fuente');
      }

      setSources((prev) => prev.filter((source) => source.id !== deleteTarget.id));
      setToast({ type: 'success', message: 'Fuente eliminada exitosamente' });
      setDeleteTarget(null);
    } catch (error) {
      console.error('[SourceManagement] Delete failed:', error);
      setToast({ type: 'error', message: 'Error al eliminar fuente' });
    } finally {
      setIsDeleting(false);
    }
  };

  const hasSources = sources.length > 0;
  const activeSources = useMemo(() => sources.filter((source) => source.is_active), [sources]);

  return (
    <section className="bg-gray-950 border border-gray-800 rounded-xl p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-white">Fuentes Configuradas</h2>
          <p className="text-sm text-gray-400">
            Administra las fuentes que alimentan el monitoreo del proyecto
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-600"
        >
          <Plus className="h-4 w-4" />
          Agregar Fuente
        </button>
      </div>

      <div className="text-sm text-gray-400">
        {activeSources.length} fuente{activeSources.length === 1 ? '' : 's'} activa{activeSources.length === 1 ? '' : 's'}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-6 w-6 text-sky-500 animate-spin" />
        </div>
      ) : !hasSources ? (
        <div className="rounded-lg border border-gray-800 bg-black p-6 text-sm text-gray-400">
          No hay fuentes configuradas. Agrega tu primera fuente para comenzar el monitoreo.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500">
                <th className="pb-3 pr-4 font-medium">URL</th>
                <th className="pb-3 pr-4 font-medium">Tipo</th>
                <th className="pb-3 pr-4 font-medium">Estado</th>
                <th className="pb-3 pr-4 font-medium">Última Actualización</th>
                <th className="pb-3 text-right font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {sources.map((source) => (
                <tr key={source.id} className="hover:bg-gray-900/50">
                  <td className="py-4 pr-4">
                    <div className="max-w-xs truncate text-gray-200" title={source.url}>
                      {source.url}
                    </div>
                  </td>
                  <td className="py-4 pr-4">
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                        getTypeBadge(source.source_type)
                      }`}
                    >
                      {getTypeLabel(source.source_type)}
                    </span>
                  </td>
                  <td className="py-4 pr-4">
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                        source.is_active
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : 'bg-gray-500/10 text-gray-400 border-gray-500/20'
                      }`}
                    >
                      {source.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="py-4 pr-4 text-gray-400">
                    {formatRelativeTime(source.last_scraped_at)}
                  </td>
                  <td className="py-4 text-right">
                    <button
                      onClick={() => setDeleteTarget(source)}
                      className="inline-flex items-center gap-1 text-sm text-red-400 hover:text-red-300"
                      aria-label={`Eliminar fuente ${source.url}`}
                    >
                      <Trash2 className="h-4 w-4" />
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AddSourceModal
        isOpen={isModalOpen}
        projectId={projectId}
        onClose={() => setIsModalOpen(false)}
        onSourceAdded={handleSourceAdded}
      />

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="¿Eliminar fuente?"
        message="La fuente será eliminada y dejará de monitorearse."
        confirmLabel="Eliminar"
        isLoading={isDeleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />

      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}
    </section>
  );
}
