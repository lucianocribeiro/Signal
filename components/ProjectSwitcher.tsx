'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, FolderKanban, Check, Loader2, AlertCircle } from 'lucide-react';
import { useProjects } from '@/contexts/ProjectContext';
import { useRouter } from 'next/navigation';

export default function ProjectSwitcher() {
  const { currentProject, projects, isLoading, error, setCurrentProject } = useProjects();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Handle project selection
  const handleSelectProject = (project: typeof currentProject) => {
    setCurrentProject(project);
    setIsOpen(false);
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="p-4 border-b border-gray-800">
        <div className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-black border border-gray-800">
          <span className="text-sm font-medium text-gray-400">Cargando proyectos...</span>
          <Loader2 className="h-4 w-4 text-gray-400 animate-spin" />
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="p-4 border-b border-gray-800">
        <div className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-red-950/20 border border-red-900/30">
          <AlertCircle className="h-4 w-4 text-red-400" />
          <span className="text-sm text-red-400">Error al cargar proyectos</span>
        </div>
      </div>
    );
  }

  // No projects state
  if (projects.length === 0) {
    return (
      <div className="p-4 border-b border-gray-800">
        <button
          onClick={() => router.push('/dashboard/projects')}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-signal-500/10 border border-signal-500/30 hover:bg-signal-500/20 transition-colors"
        >
          <FolderKanban className="h-4 w-4 text-signal-500" />
          <span className="text-sm font-medium text-signal-500">Crear Primer Proyecto</span>
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 border-b border-gray-800" ref={dropdownRef}>
      <div className="relative">
        {/* Current Project Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg bg-black border border-gray-800 hover:border-signal-500/30 transition-colors group"
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <FolderKanban className="h-4 w-4 text-signal-500 flex-shrink-0" />
            <div className="flex flex-col items-start min-w-0">
              <span className="text-xs text-gray-500 font-medium">Proyecto Actual</span>
              <span className="text-sm font-medium text-gray-200 truncate w-full text-left">
                {currentProject?.name || 'Sin proyecto'}
              </span>
            </div>
          </div>
          <ChevronDown
            className={`h-4 w-4 text-gray-400 flex-shrink-0 transition-transform ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        </button>

        {/* Dropdown Menu */}
        {isOpen && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-gray-950 border border-gray-800 rounded-lg shadow-xl z-50 max-h-80 overflow-y-auto">
            <div className="p-2">
              <div className="text-xs font-medium text-gray-500 px-3 py-2 mb-1">
                Tus Proyectos ({projects.length})
              </div>
              {projects.map((project) => {
                const isSelected = currentProject?.id === project.id;
                return (
                  <button
                    key={project.id}
                    onClick={() => handleSelectProject(project)}
                    className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                      isSelected
                        ? 'bg-signal-500/10 border border-signal-500/30'
                        : 'hover:bg-gray-900 border border-transparent'
                    }`}
                  >
                    <div className="flex-1 min-w-0 text-left">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={`text-sm font-medium truncate ${
                            isSelected ? 'text-signal-500' : 'text-gray-200'
                          }`}
                        >
                          {project.name}
                        </span>
                        {isSelected && (
                          <Check className="h-4 w-4 text-signal-500 flex-shrink-0" />
                        )}
                      </div>
                      {project.description && (
                        <p className="text-xs text-gray-500 truncate mb-1">
                          {project.description}
                        </p>
                      )}
                      <div className="flex items-center gap-2 text-xs text-gray-600">
                        <span>Creado: {formatDate(project.created_at)}</span>
                        {project.sources && project.sources.length > 0 && (
                          <>
                            <span>•</span>
                            <span>{project.sources.length} fuentes</span>
                          </>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Divider */}
            <div className="border-t border-gray-800 mx-2" />

            {/* Create New Project Button */}
            <div className="p-2">
              <button
                onClick={() => {
                  setIsOpen(false);
                  router.push('/dashboard/projects');
                }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-signal-500 hover:bg-signal-500/10 transition-colors border border-transparent hover:border-signal-500/20"
              >
                <FolderKanban className="h-4 w-4" />
                <span className="text-sm font-medium">Crear Nuevo Proyecto</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
