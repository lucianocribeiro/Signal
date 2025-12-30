'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, FolderKanban, AlertCircle } from 'lucide-react';

interface Source {
  id?: string;
  url: string;
  name: string;
  platform?: string;
  status?: string;
  last_scraped_at?: string;
}

interface Project {
  id: string;
  name: string;
  description: string;
  signal_instructions?: string;
  created_at: string;
  updated_at?: string;
  sources?: Source[];
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    signal_instructions: '',
  });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Fetch projects from API on mount
  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/projects');

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Error al cargar proyectos');
      }

      const data = await response.json();
      setProjects(data.projects || []);
    } catch (err) {
      console.error('Error fetching projects:', err);
      setError(err instanceof Error ? err.message : 'Error al cargar proyectos');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNew = () => {
    setEditingProject(null);
    setFormData({ name: '', description: '', signal_instructions: '' });
    setError(null);
    setSuccess(null);
    setIsModalOpen(true);
  };

  const handleEdit = (project: Project) => {
    setEditingProject(project);
    setFormData({
      name: project.name,
      description: project.description || '',
      signal_instructions: project.signal_instructions || '',
    });
    setError(null);
    setSuccess(null);
    setIsModalOpen(true);
  };

  const handleDelete = async (projectId: string) => {
    if (!confirm('¿Estás seguro de que deseas eliminar este proyecto?')) {
      return;
    }

    // TODO: Implement DELETE endpoint
    console.log('Delete project:', projectId);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      if (editingProject) {
        // Update existing project
        const response = await fetch(`/api/projects/${editingProject.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: formData.name,
            description: formData.description || null,
            signal_instructions: formData.signal_instructions || null,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Error al actualizar proyecto');
        }

        setSuccess('Proyecto actualizado exitosamente');

        // Refresh projects list
        await fetchProjects();

        // Close modal after short delay
        setTimeout(() => {
          setIsModalOpen(false);
          setFormData({ name: '', description: '', signal_instructions: '' });
        }, 1000);
      } else {
        // Create new project
        const response = await fetch('/api/projects', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: formData.name,
            description: formData.description || null,
            signal_instructions: formData.signal_instructions || null,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Error al crear proyecto');
        }

        setSuccess('Proyecto creado exitosamente');

        // Refresh projects list
        await fetchProjects();

        // Close modal after short delay
        setTimeout(() => {
          setIsModalOpen(false);
          setFormData({ name: '', description: '', signal_instructions: '' });
        }, 1000);
      }
    } catch (err) {
      console.error('Error submitting project:', err);
      setError(err instanceof Error ? err.message : 'Error al guardar proyecto');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-950/50 sticky top-0 z-30 backdrop-blur-sm">
        <div className="px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Proyectos</h1>
              <p className="text-gray-400">
                Gestiona tus proyectos de monitoreo de señales
              </p>
            </div>

            <button
              onClick={handleCreateNew}
              className="flex items-center gap-2 px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-lg transition-colors font-medium"
            >
              <Plus className="h-5 w-5" />
              Nuevo Proyecto
            </button>
          </div>
        </div>
      </div>

      {/* Projects Grid */}
      <div className="px-8 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-gray-400">Cargando proyectos...</div>
          </div>
        ) : error && projects.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-red-400">{error}</div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {projects.map((project) => (
                <div
                  key={project.id}
                  className="bg-gray-950 border border-gray-800 rounded-lg p-6 hover:border-gray-700 transition-colors"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="h-12 w-12 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center">
                      <FolderKanban className="h-6 w-6 text-sky-500" />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(project)}
                        className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                        title="Editar proyecto"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(project.id)}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-gray-800 rounded-lg transition-colors"
                        title="Eliminar proyecto"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <h3 className="text-xl font-semibold text-white mb-2">{project.name}</h3>
                  <p className="text-sm text-gray-400 mb-4 line-clamp-2">{project.description}</p>

                  {project.sources && project.sources.length > 0 && (
                    <div className="mb-4">
                      <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                        <LinkIcon className="h-3 w-3" />
                        <span>{project.sources.length} fuente{project.sources.length !== 1 ? 's' : ''}</span>
                      </div>
                    </div>
                  )}

                  <div className="pt-4 border-t border-gray-800 flex items-center justify-between text-sm">
                    <span className="text-gray-500">
                      Creado: {new Date(project.created_at).toLocaleDateString('es-ES')}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Empty State */}
            {projects.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="h-16 w-16 rounded-full bg-gray-900 border border-gray-800 flex items-center justify-center mb-4">
                  <FolderKanban className="h-8 w-8 text-gray-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-400 mb-2">No hay proyectos</h3>
                <p className="text-gray-600 max-w-md mb-6">
                  Crea tu primer proyecto para empezar a monitorear señales
                </p>
                <button
                  onClick={handleCreateNew}
                  className="flex items-center gap-2 px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-lg transition-colors font-medium"
                >
                  <Plus className="h-5 w-5" />
                  Crear Proyecto
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Create/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-950 border border-gray-800 rounded-lg max-w-3xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-white mb-4">
              {editingProject ? 'Editar Proyecto' : 'Nuevo Proyecto'}
            </h2>

            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2 text-red-400">
                <AlertCircle className="h-5 w-5 flex-shrink-0" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            {success && (
              <div className="mb-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg flex items-center gap-2 text-green-400">
                <AlertCircle className="h-5 w-5 flex-shrink-0" />
                <span className="text-sm">{success}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Name */}
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-2">
                  Nombre del Proyecto <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 bg-black border border-gray-800 rounded-lg text-white focus:outline-none focus:border-sky-500 transition-colors"
                  placeholder="Ej: Monitoreo de IA en Salud"
                  maxLength={200}
                  required
                  disabled={submitting}
                />
                <p className="text-xs text-gray-500 mt-1">{formData.name.length}/200 caracteres</p>
              </div>

              {/* Description */}
              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-300 mb-2">
                  Descripción
                </label>
                <textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2 bg-black border border-gray-800 rounded-lg text-white focus:outline-none focus:border-sky-500 transition-colors resize-none"
                  placeholder="Describe el propósito y alcance del proyecto..."
                  rows={3}
                  maxLength={1000}
                  disabled={submitting}
                />
                <p className="text-xs text-gray-500 mt-1">{formData.description.length}/1000 caracteres</p>
              </div>

              {/* Signal Instructions */}
              <div>
                <label htmlFor="signal_instructions" className="block text-sm font-medium text-gray-300 mb-2">
                  Instrucciones para Señales
                </label>
                <textarea
                  id="signal_instructions"
                  value={formData.signal_instructions}
                  onChange={(e) => setFormData({ ...formData, signal_instructions: e.target.value })}
                  className="w-full px-4 py-2 bg-black border border-gray-800 rounded-lg text-white focus:outline-none focus:border-sky-500 transition-colors resize-none"
                  placeholder="Especifica qué tipo de señales son importantes para este proyecto. Por ejemplo: avances tecnológicos, cambios regulatorios, movimientos de mercado..."
                  rows={4}
                  maxLength={2000}
                  disabled={submitting}
                />
                <p className="text-xs text-gray-500 mt-1">
                  {formData.signal_instructions.length}/2000 caracteres
                </p>
                <p className="text-xs text-sky-400 mt-2">
                  💡 Tip: Agrega fuentes a este proyecto desde el menú "Fuentes"
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setFormData({ name: '', description: '', signal_instructions: '' });
                    setError(null);
                    setSuccess(null);
                  }}
                  className="flex-1 px-4 py-2 bg-gray-900 border border-gray-800 text-gray-300 rounded-lg hover:bg-gray-800 transition-colors font-medium"
                  disabled={submitting}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={submitting}
                >
                  {submitting
                    ? 'Guardando...'
                    : editingProject
                    ? 'Guardar Cambios'
                    : 'Crear Proyecto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
