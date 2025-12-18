'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, FolderKanban } from 'lucide-react';

interface Project {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  signalsCount: number;
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [formData, setFormData] = useState({ name: '', description: '' });

  // Load projects from localStorage on mount
  useEffect(() => {
    const savedProjects = localStorage.getItem('projects');
    if (savedProjects) {
      setProjects(JSON.parse(savedProjects));
    }
  }, []);

  // Save projects to localStorage whenever they change
  useEffect(() => {
    if (projects.length >= 0) {
      localStorage.setItem('projects', JSON.stringify(projects));
    }
  }, [projects]);

  const handleCreateNew = () => {
    setEditingProject(null);
    setFormData({ name: '', description: '' });
    setIsModalOpen(true);
  };

  const handleEdit = (project: Project) => {
    setEditingProject(project);
    setFormData({ name: project.name, description: project.description });
    setIsModalOpen(true);
  };

  const handleDelete = (projectId: string) => {
    if (confirm('¿Estás seguro de que deseas eliminar este proyecto?')) {
      setProjects((prev) => prev.filter((p) => p.id !== projectId));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (editingProject) {
      // Edit existing project
      setProjects((prev) =>
        prev.map((p) =>
          p.id === editingProject.id
            ? { ...p, name: formData.name, description: formData.description }
            : p
        )
      );
    } else {
      // Create new project
      const newProject: Project = {
        id: Date.now().toString(),
        name: formData.name,
        description: formData.description,
        createdAt: new Date().toISOString().split('T')[0],
        signalsCount: 0,
      };
      setProjects((prev) => [...prev, newProject]);
    }

    setIsModalOpen(false);
    setFormData({ name: '', description: '' });
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
              className="flex items-center gap-2 px-4 py-2 bg-signal-500 hover:bg-signal-600 text-white rounded-lg transition-colors font-medium"
            >
              <Plus className="h-5 w-5" />
              Nuevo Proyecto
            </button>
          </div>
        </div>
      </div>

      {/* Projects Grid */}
      <div className="px-8 py-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => (
            <div
              key={project.id}
              className="bg-gray-950 border border-gray-800 rounded-lg p-6 hover:border-gray-700 transition-colors"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="h-12 w-12 rounded-lg bg-signal-500/10 border border-signal-500/30 flex items-center justify-center">
                  <FolderKanban className="h-6 w-6 text-signal-500" />
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

              <div className="pt-4 border-t border-gray-800 flex items-center justify-between text-sm">
                <span className="text-gray-500">
                  {project.signalsCount} señales
                </span>
                <span className="text-gray-500">
                  Creado: {new Date(project.createdAt).toLocaleDateString('es-ES')}
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
              className="flex items-center gap-2 px-4 py-2 bg-signal-500 hover:bg-signal-600 text-white rounded-lg transition-colors font-medium"
            >
              <Plus className="h-5 w-5" />
              Crear Proyecto
            </button>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-950 border border-gray-800 rounded-lg max-w-2xl w-full p-6">
            <h2 className="text-2xl font-bold text-white mb-4">
              {editingProject ? 'Editar Proyecto' : 'Nuevo Proyecto'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-2">
                  Nombre del Proyecto
                </label>
                <input
                  type="text"
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 bg-black border border-gray-800 rounded-lg text-white focus:outline-none focus:border-signal-500 transition-colors"
                  placeholder="Ej: Monitoreo de IA en Salud"
                  required
                />
              </div>

              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-300 mb-2">
                  Descripción
                </label>
                <textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2 bg-black border border-gray-800 rounded-lg text-white focus:outline-none focus:border-signal-500 transition-colors resize-none"
                  placeholder="Describe el propósito y alcance del proyecto..."
                  rows={4}
                  required
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setFormData({ name: '', description: '' });
                  }}
                  className="flex-1 px-4 py-2 bg-gray-900 border border-gray-800 text-gray-300 rounded-lg hover:bg-gray-800 transition-colors font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-signal-500 hover:bg-signal-600 text-white rounded-lg transition-colors font-medium"
                >
                  {editingProject ? 'Guardar Cambios' : 'Crear Proyecto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
