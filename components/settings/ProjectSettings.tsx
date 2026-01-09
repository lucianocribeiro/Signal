'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Save, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useProjects } from '@/contexts/ProjectContext';
import ConfirmDialog from '@/components/settings/ConfirmDialog';
import Toast, { ToastType } from '@/components/ui/toast';

interface ProjectSettingsProps {
  project: {
    id: string;
    name: string;
    description: string | null;
    created_at: string;
    updated_at: string;
    settings?: {
      refresh_interval_hours?: number;
    } | null;
  };
  onProjectUpdated: (project: ProjectSettingsProps['project']) => void;
}

const REFRESH_INTERVAL_OPTIONS = [2, 4, 8, 12];

function formatDate(value: string) {
  return new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium' }).format(
    new Date(value)
  );
}

function isValidProjectName(name: string) {
  if (name.length < 3) {
    return 'El nombre debe tener al menos 3 caracteres';
  }
  if (name.length > 100) {
    return 'El nombre no puede exceder 100 caracteres';
  }
  if (!/^[A-Za-z0-9 -]+$/.test(name)) {
    return 'El nombre solo puede contener letras, números, espacios y guiones';
  }
  return null;
}

export default function ProjectSettings({ project, onProjectUpdated }: ProjectSettingsProps) {
  const router = useRouter();
  const { refreshProjects } = useProjects();
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description ?? '');
  const [refreshInterval, setRefreshInterval] = useState<number>(
    project.settings?.refresh_interval_hours ?? 4
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [toast, setToast] = useState<{ type: ToastType; message: string } | null>(null);

  useEffect(() => {
    setName(project.name);
    setDescription(project.description ?? '');
    setRefreshInterval(project.settings?.refresh_interval_hours ?? 4);
  }, [
    project.id,
    project.name,
    project.description,
    project.updated_at,
    project.settings?.refresh_interval_hours,
  ]);

  const nameError = useMemo(() => {
    if (!name.trim()) return 'El nombre es requerido';
    return isValidProjectName(name.trim());
  }, [name]);

  const descriptionError = useMemo(() => {
    if (description.length > 500) {
      return 'La descripción no puede exceder 500 caracteres';
    }
    return null;
  }, [description]);

  const isFormValid = !nameError && !descriptionError;

  const handleSave = async () => {
    if (!isFormValid) return;

    setIsSaving(true);
    setToast(null);

    try {
      const response = await fetch(`/api/projects/${project.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() ? description.trim() : null,
          refresh_interval_hours: refreshInterval,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al guardar cambios');
      }

      onProjectUpdated({
        ...project,
        name: data.project?.name ?? name.trim(),
        description: data.project?.description ?? (description.trim() || null),
        updated_at: data.project?.updated_at ?? project.updated_at,
        settings: data.project?.settings ?? {
          refresh_interval_hours: refreshInterval,
        },
      });

      await refreshProjects();

      setToast({ type: 'success', message: 'Cambios guardados exitosamente' });
    } catch (error) {
      console.error('[ProjectSettings] Save failed:', error);
      setToast({ type: 'error', message: 'Error al guardar cambios' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    setToast(null);

    try {
      const response = await fetch(`/api/projects/${project.id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al eliminar proyecto');
      }

      setToast({ type: 'success', message: 'Proyecto eliminado' });
      await refreshProjects();
      router.push('/dashboard');
    } catch (error) {
      console.error('[ProjectSettings] Delete failed:', error);
      setToast({ type: 'error', message: 'Error al eliminar proyecto' });
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <section className="bg-gray-950 border border-gray-800 rounded-xl p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-white">Configuración del Proyecto</h2>
          <p className="text-sm text-gray-400">
            Ajusta la información básica y el intervalo de actualización
          </p>
        </div>
        <span className="text-sm text-gray-500">Creado: {formatDate(project.created_at)}</span>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="project-name" className="text-sm text-gray-400">
            Nombre del Proyecto
          </label>
          <input
            id="project-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="w-full rounded-lg border border-gray-700 bg-black px-4 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
            placeholder="Nombre del proyecto"
          />
          {nameError && <p className="text-xs text-red-400">{nameError}</p>}
        </div>

        <div className="space-y-2">
          <label htmlFor="refresh-interval" className="text-sm text-gray-400">
            Intervalo de Actualización
          </label>
          <select
            id="refresh-interval"
            value={refreshInterval}
            onChange={(event) => setRefreshInterval(Number(event.target.value))}
            className="w-full rounded-lg border border-gray-700 bg-black px-4 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
          >
            {REFRESH_INTERVAL_OPTIONS.map((option) => (
              <option key={option} value={option}>
                Cada {option} horas
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="project-description" className="text-sm text-gray-400">
          Descripción
        </label>
        <textarea
          id="project-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={4}
          maxLength={500}
          className="w-full rounded-lg border border-gray-700 bg-black px-4 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
          placeholder="Describe el objetivo del proyecto"
        />
        {descriptionError && <p className="text-xs text-red-400">{descriptionError}</p>}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={handleSave}
          disabled={!isFormValid || isSaving}
          className="inline-flex items-center gap-2 rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-600 disabled:cursor-not-allowed disabled:bg-sky-500/60"
        >
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {isSaving ? 'Guardando...' : 'Guardar Cambios'}
        </button>
        <button
          type="button"
          onClick={() => setShowDeleteConfirm(true)}
          className="inline-flex items-center gap-2 rounded-lg border border-red-500/30 px-4 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/10"
        >
          <Trash2 className="h-4 w-4" />
          Eliminar Proyecto
        </button>
      </div>

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title="¿Eliminar proyecto?"
        message="Esta acción es permanente. Se eliminarán todas las señales, fuentes y datos asociados."
        warning="Esta acción no se puede deshacer."
        confirmLabel="Eliminar Proyecto"
        isLoading={isDeleting}
        onCancel={() => setShowDeleteConfirm(false)}
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
