'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

// Types
export interface Source {
  id: string;
  url: string;
  name: string | null;
  source_type: 'twitter' | 'reddit' | 'news' | 'marketplace';
  platform: string;
  is_active: boolean;
  last_scraped_at: string | null;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  signal_instructions: string | null;
  risk_criteria?: string | null;
  created_at: string;
  updated_at: string;
  sources?: Source[];
}

interface ProjectContextType {
  currentProject: Project | null;
  projects: Project[];
  isLoading: boolean;
  error: string | null;
  setCurrentProject: (project: Project | null) => void;
  refreshProjects: () => Promise<void>;
}

// Create Context
const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

// LocalStorage key for persistence
const SELECTED_PROJECT_KEY = 'signal_selected_project_id';

// Provider Component
export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const [currentProject, setCurrentProjectState] = useState<Project | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  // Fetch all projects for the authenticated user
  const fetchProjects = useCallback(async (): Promise<Project[]> => {
    try {
      const response = await fetch('/api/projects');

      if (!response.ok) {
        throw new Error('Error al obtener proyectos');
      }

      const data = await response.json();
      return data.projects || [];
    } catch (err) {
      console.error('Error fetching projects:', err);
      throw err;
    }
  }, []);

  // Refresh projects (public method)
  const refreshProjects = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const fetchedProjects = await fetchProjects();
      setProjects(fetchedProjects);

      // If current project is not in the list anymore, clear it
      if (currentProject) {
        const stillExists = fetchedProjects.find(p => p.id === currentProject.id);
        if (!stillExists) {
          setCurrentProjectState(null);
          localStorage.removeItem(SELECTED_PROJECT_KEY);
        }
      }

      // If no current project but projects exist, select first one
      if (!currentProject && fetchedProjects.length > 0) {
        const savedProjectId = localStorage.getItem(SELECTED_PROJECT_KEY);
        const projectToSelect = savedProjectId
          ? fetchedProjects.find(p => p.id === savedProjectId) || fetchedProjects[0]
          : fetchedProjects[0];

        setCurrentProjectState(projectToSelect);
        localStorage.setItem(SELECTED_PROJECT_KEY, projectToSelect.id);
      }
    } catch (err) {
      setError('Error al cargar proyectos');
      console.error('Error refreshing projects:', err);
    } finally {
      setIsLoading(false);
    }
  }, [currentProject, fetchProjects]);

  // Set current project and persist to localStorage
  const setCurrentProject = useCallback((project: Project | null) => {
    setCurrentProjectState(project);
    if (project) {
      localStorage.setItem(SELECTED_PROJECT_KEY, project.id);
    } else {
      localStorage.removeItem(SELECTED_PROJECT_KEY);
    }
  }, []);

  // Initialize projects on mount
  useEffect(() => {
    const initializeProjects = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const fetchedProjects = await fetchProjects();
        setProjects(fetchedProjects);

        if (fetchedProjects.length > 0) {
          // Try to restore last selected project from localStorage
          const savedProjectId = localStorage.getItem(SELECTED_PROJECT_KEY);

          if (savedProjectId) {
            const savedProject = fetchedProjects.find(p => p.id === savedProjectId);
            if (savedProject) {
              setCurrentProjectState(savedProject);
            } else {
              // Saved project no longer exists, select first one
              setCurrentProjectState(fetchedProjects[0]);
              localStorage.setItem(SELECTED_PROJECT_KEY, fetchedProjects[0].id);
            }
          } else {
            // No saved project, select first one
            setCurrentProjectState(fetchedProjects[0]);
            localStorage.setItem(SELECTED_PROJECT_KEY, fetchedProjects[0].id);
          }
        }
      } catch (err) {
        setError('Error al cargar proyectos');
        console.error('Error initializing projects:', err);
      } finally {
        setIsLoading(false);
      }
    };

    initializeProjects();
  }, [fetchProjects]);

  const value: ProjectContextType = {
    currentProject,
    projects,
    isLoading,
    error,
    setCurrentProject,
    refreshProjects,
  };

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

// Custom hook to use project context
export function useProjects(): ProjectContextType {
  const context = useContext(ProjectContext);

  if (context === undefined) {
    throw new Error('useProjects must be used within a ProjectProvider');
  }

  return context;
}
