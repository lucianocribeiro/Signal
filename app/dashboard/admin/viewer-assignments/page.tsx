'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

interface Viewer {
  id: string;
  email: string;
  full_name: string | null;
}

interface Project {
  id: string;
  name: string;
}

interface Assignment {
  id: string;
  project_id: string;
  viewer_id: string;
}

export default function ViewerAssignmentsPage() {
  const supabase = createClient();
  const searchParams = useSearchParams();
  const viewerIdParam = searchParams.get('viewerId');
  const [viewers, setViewers] = useState<Viewer[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selectedViewer, setSelectedViewer] = useState('');
  const [selectedProject, setSelectedProject] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [{ data: viewersData, error: viewersError }, { data: projectsData, error: projectsError }, { data: assignmentsData, error: assignmentsError }] =
        await Promise.all([
          supabase
            .from('user_profiles')
            .select('id, email, full_name')
            .eq('role', 'viewer')
            .order('created_at', { ascending: false }),
          supabase
            .from('projects')
            .select('id, name')
            .order('created_at', { ascending: false }),
          supabase
            .from('project_viewer_assignments')
            .select('id, project_id, viewer_id')
        ]);

      if (viewersError || projectsError || assignmentsError) {
        throw new Error('Error al cargar asignaciones');
      }

      setViewers(viewersData || []);
      setProjects(projectsData || []);
      setAssignments(assignmentsData || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar asignaciones');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (viewerIdParam) {
      setSelectedViewer(viewerIdParam);
    }
  }, [viewerIdParam]);

  const handleAssign = async () => {
    if (!selectedViewer || !selectedProject) {
      setError('Selecciona un observador y un proyecto');
      return;
    }

    setError(null);
    setSuccess(null);

    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) {
      setError('No autenticado');
      return;
    }

    const { error: assignError } = await supabase
      .from('project_viewer_assignments')
      .insert({
        project_id: selectedProject,
        viewer_id: selectedViewer,
        assigned_by: authData.user.id,
      });

    if (assignError) {
      setError(assignError.message || 'Error al asignar proyecto');
      return;
    }

    setSuccess('Asignación creada correctamente');
    setSelectedProject('');
    await fetchData();
  };

  const handleUnassign = async (assignmentId: string) => {
    setError(null);
    setSuccess(null);

    const { error: deleteError } = await supabase
      .from('project_viewer_assignments')
      .delete()
      .eq('id', assignmentId);

    if (deleteError) {
      setError(deleteError.message || 'Error al remover asignación');
      return;
    }

    setSuccess('Asignación removida correctamente');
    await fetchData();
  };

  const assignmentsByViewer = useMemo(() => {
    return assignments.reduce<Record<string, Assignment[]>>((acc, assignment) => {
      if (!acc[assignment.viewer_id]) {
        acc[assignment.viewer_id] = [];
      }
      acc[assignment.viewer_id].push(assignment);
      return acc;
    }, {});
  }, [assignments]);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-white mb-6">Asignaciones de Observadores</h1>

      {error && (
        <div className="mb-4 bg-red-900/20 border border-red-800 rounded-lg p-3 text-sm text-red-300">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 bg-green-900/20 border border-green-800 rounded-lg p-3 text-sm text-green-300">
          {success}
        </div>
      )}

      <div className="bg-gray-950 border border-gray-800 rounded-lg p-4 mb-6">
        <h2 className="text-lg font-semibold text-white mb-4">Nueva asignación</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <select
            value={selectedViewer}
            onChange={(e) => setSelectedViewer(e.target.value)}
            className="bg-gray-900 border border-gray-800 text-gray-200 rounded-lg px-3 py-2"
          >
            <option value="">Selecciona observador</option>
            {viewers.map((viewer) => (
              <option key={viewer.id} value={viewer.id}>
                {viewer.full_name || viewer.email}
              </option>
            ))}
          </select>

          <select
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
            className="bg-gray-900 border border-gray-800 text-gray-200 rounded-lg px-3 py-2"
          >
            <option value="">Selecciona proyecto</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>

          <button
            onClick={handleAssign}
            className="bg-signal-500 hover:bg-signal-600 text-white rounded-lg px-4 py-2 transition-colors"
          >
            Asignar
          </button>
        </div>
      </div>

      <div className="bg-gray-950 border border-gray-800 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-800 text-sm text-gray-400">
          Observadores y proyectos asignados
        </div>
        {isLoading ? (
          <div className="p-6 text-gray-400">Cargando...</div>
        ) : (
          <div className="divide-y divide-gray-800">
            {viewers.map((viewer) => {
              const viewerAssignments = assignmentsByViewer[viewer.id] || [];
              return (
                <div key={viewer.id} className="p-4">
                  <div className="text-sm text-gray-300 font-medium">
                    {viewer.full_name || viewer.email}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {viewerAssignments.length === 0 && (
                      <span className="text-xs text-gray-500">Sin asignaciones</span>
                    )}
                    {viewerAssignments.map((assignment) => {
                      const project = projects.find((p) => p.id === assignment.project_id);
                      return (
                        <span
                          key={assignment.id}
                          className="inline-flex items-center gap-2 text-xs text-gray-300 bg-gray-900 border border-gray-800 rounded-full px-3 py-1"
                        >
                          {project?.name || 'Proyecto'}
                          <button
                            onClick={() => handleUnassign(assignment.id)}
                            className="text-red-400 hover:text-red-300"
                          >
                            Quitar
                          </button>
                        </span>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
