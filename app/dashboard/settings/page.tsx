'use client';

import React, { useState, useEffect } from 'react';
import {
  User,
  Mail,
  Bell,
  MessageSquare,
  Shield,
  Save,
  LogOut,
  Loader2,
  CheckCircle,
  AlertTriangle,
  FolderKanban,
  Sparkles
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useProjects } from '@/contexts/ProjectContext';
import { useRouter } from 'next/navigation';

export default function SettingsPage() {
  const { user, profile, signOut, loading: authLoading } = useAuth();
  const { currentProject, refreshProjects } = useProjects();
  const router = useRouter();

  // Profile form state
  const [fullName, setFullName] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Project form state
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [signalInstructions, setSignalInstructions] = useState('');
  const [savingProject, setSavingProject] = useState(false);
  const [projectSuccess, setProjectSuccess] = useState(false);
  const [projectError, setProjectError] = useState<string | null>(null);

  // Notification preferences (stored locally for now, will connect to DB in Epic 7)
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [smsNotifications, setSmsNotifications] = useState(false);

  // Initialize form values
  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
    }
  }, [profile]);

  useEffect(() => {
    if (currentProject) {
      setProjectName(currentProject.name || '');
      setProjectDescription(currentProject.description || '');
      setSignalInstructions(currentProject.signal_instructions || '');
    }
  }, [currentProject]);

  // Save profile
  const handleSaveProfile = async () => {
    setSavingProfile(true);
    setProfileError(null);
    setProfileSuccess(false);

    try {
      const response = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: fullName }),
      });

      if (!response.ok) {
        throw new Error('Error al guardar perfil');
      }

      setProfileSuccess(true);
      setTimeout(() => setProfileSuccess(false), 3000);
    } catch (err) {
      setProfileError('Error al guardar los cambios');
    } finally {
      setSavingProfile(false);
    }
  };

  // Save project settings
  const handleSaveProject = async () => {
    if (!currentProject) return;

    setSavingProject(true);
    setProjectError(null);
    setProjectSuccess(false);

    try {
      const response = await fetch(`/api/projects/${currentProject.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: projectName,
          description: projectDescription,
          signal_instructions: signalInstructions,
        }),
      });

      if (!response.ok) {
        throw new Error('Error al guardar proyecto');
      }

      setProjectSuccess(true);
      setTimeout(() => setProjectSuccess(false), 3000);

      // Refresh projects list to update sidebar/dropdown
      await refreshProjects();
    } catch (err) {
      setProjectError('Error al guardar los cambios del proyecto');
    } finally {
      setSavingProject(false);
    }
  };

  // Handle logout
  const handleLogout = async () => {
    await signOut();
    router.push('/login');
  };

  // Loading state
  if (authLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-signal-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <div className="border-b border-gray-800 bg-black/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="px-8 py-6">
          <h1 className="text-2xl font-bold text-white">Configuración</h1>
          <p className="text-gray-500 mt-1">Administra tu cuenta y preferencias</p>
        </div>
      </div>

      {/* Content */}
      <div className="px-8 py-6 max-w-4xl">
        <div className="space-y-8">

          {/* Section A: User Profile */}
          <section className="bg-gray-950 border border-gray-800 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-10 w-10 rounded-lg bg-signal-500/10 border border-signal-500/20 flex items-center justify-center">
                <User className="h-5 w-5 text-signal-500" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Perfil de Usuario</h2>
                <p className="text-sm text-gray-500">Tu información personal</p>
              </div>
            </div>

            <div className="space-y-4">
              {/* Email (read-only) */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Correo Electrónico
                </label>
                <div className="flex items-center gap-3 px-4 py-3 bg-gray-900 border border-gray-800 rounded-lg">
                  <Mail className="h-4 w-4 text-gray-500" />
                  <span className="text-gray-300">{user?.email}</span>
                  <span className="ml-auto text-xs text-gray-600">No editable</span>
                </div>
              </div>

              {/* Full Name */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Nombre Completo
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-900 border border-gray-800 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-signal-500 transition-colors"
                  placeholder="Tu nombre completo"
                />
              </div>

              {/* Role (read-only) */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Rol
                </label>
                <div className="flex items-center gap-3">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    profile?.role === 'admin' || profile?.role === 'owner'
                      ? 'bg-signal-500/10 text-signal-500 border border-signal-500/20'
                      : 'bg-gray-800 text-gray-400 border border-gray-700'
                  }`}>
                    <Shield className="h-3 w-3 inline mr-1" />
                    {profile?.role === 'admin' ? 'Administrador' :
                     profile?.role === 'owner' ? 'Propietario' :
                     profile?.role === 'viewer' ? 'Visualizador' : 'Usuario'}
                  </span>
                </div>
              </div>

              {/* Save Profile Button */}
              <div className="flex items-center gap-4 pt-4">
                <button
                  onClick={handleSaveProfile}
                  disabled={savingProfile}
                  className="flex items-center gap-2 px-6 py-2.5 bg-signal-500 hover:bg-signal-600 disabled:bg-signal-500/50 text-white rounded-lg transition-colors font-medium"
                >
                  {savingProfile ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Guardar Cambios
                </button>

                {profileSuccess && (
                  <span className="flex items-center gap-2 text-green-500 text-sm">
                    <CheckCircle className="h-4 w-4" />
                    Guardado exitosamente
                  </span>
                )}

                {profileError && (
                  <span className="flex items-center gap-2 text-red-500 text-sm">
                    <AlertTriangle className="h-4 w-4" />
                    {profileError}
                  </span>
                )}
              </div>
            </div>
          </section>

          {/* Section B: Notification Preferences */}
          <section className="bg-gray-950 border border-gray-800 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-10 w-10 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                <Bell className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Notificaciones</h2>
                <p className="text-sm text-gray-500">Configura cómo recibir alertas</p>
              </div>
              <span className="ml-auto px-2 py-1 bg-yellow-500/10 text-yellow-500 text-xs rounded-full border border-yellow-500/20">
                Próximamente
              </span>
            </div>

            <div className="space-y-4 opacity-60">
              {/* Email Notifications */}
              <div className="flex items-center justify-between p-4 bg-gray-900 border border-gray-800 rounded-lg">
                <div className="flex items-center gap-3">
                  <Mail className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-gray-300 font-medium">Notificaciones por Email</p>
                    <p className="text-sm text-gray-600">Recibe alertas de señales críticas</p>
                  </div>
                </div>
                <button
                  disabled
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    emailNotifications ? 'bg-signal-500' : 'bg-gray-700'
                  }`}
                >
                  <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                    emailNotifications ? 'right-1' : 'left-1'
                  }`} />
                </button>
              </div>

              {/* SMS Notifications */}
              <div className="flex items-center justify-between p-4 bg-gray-900 border border-gray-800 rounded-lg">
                <div className="flex items-center gap-3">
                  <MessageSquare className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-gray-300 font-medium">Notificaciones por SMS</p>
                    <p className="text-sm text-gray-600">Mensajes de texto para alertas urgentes</p>
                  </div>
                </div>
                <button
                  disabled
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    smsNotifications ? 'bg-signal-500' : 'bg-gray-700'
                  }`}
                >
                  <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                    smsNotifications ? 'right-1' : 'left-1'
                  }`} />
                </button>
              </div>
            </div>
          </section>

          {/* Section C: Project Settings (only if project selected) */}
          {currentProject && (
            <section className="bg-gray-950 border border-gray-800 rounded-lg p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="h-10 w-10 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
                  <FolderKanban className="h-5 w-5 text-sky-500" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">Proyecto Actual</h2>
                  <p className="text-sm text-gray-500">Configuración de "{currentProject.name}"</p>
                </div>
              </div>

              <div className="space-y-4">
                {/* Project Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Nombre del Proyecto
                  </label>
                  <input
                    type="text"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-900 border border-gray-800 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-signal-500 transition-colors"
                    placeholder="Nombre del proyecto"
                  />
                </div>

                {/* Project Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Descripción
                  </label>
                  <textarea
                    value={projectDescription}
                    onChange={(e) => setProjectDescription(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-3 bg-gray-900 border border-gray-800 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-signal-500 transition-colors resize-none"
                    placeholder="Descripción breve del proyecto"
                  />
                </div>

                {/* Signal Instructions */}
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    <span className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-signal-500" />
                      Instrucciones para IA
                    </span>
                  </label>
                  <textarea
                    value={signalInstructions}
                    onChange={(e) => setSignalInstructions(e.target.value)}
                    rows={4}
                    className="w-full px-4 py-3 bg-gray-900 border border-gray-800 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-signal-500 transition-colors resize-none"
                    placeholder="Ej: Monitorear menciones del candidato X, detectar crisis de reputación, identificar tendencias negativas en redes sociales..."
                  />
                  <p className="mt-2 text-xs text-gray-600">
                    Estas instrucciones guían a la IA sobre qué tipo de señales detectar para este proyecto.
                  </p>
                </div>

                {/* Save Project Button */}
                <div className="flex items-center gap-4 pt-4">
                  <button
                    onClick={handleSaveProject}
                    disabled={savingProject}
                    className="flex items-center gap-2 px-6 py-2.5 bg-sky-500 hover:bg-sky-600 disabled:bg-sky-500/50 text-white rounded-lg transition-colors font-medium"
                  >
                    {savingProject ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Guardar Proyecto
                  </button>

                  {projectSuccess && (
                    <span className="flex items-center gap-2 text-green-500 text-sm">
                      <CheckCircle className="h-4 w-4" />
                      Proyecto guardado
                    </span>
                  )}

                  {projectError && (
                    <span className="flex items-center gap-2 text-red-500 text-sm">
                      <AlertTriangle className="h-4 w-4" />
                      {projectError}
                    </span>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* Section D: Danger Zone */}
          <section className="bg-gray-950 border border-red-900/30 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-10 w-10 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Zona de Peligro</h2>
                <p className="text-sm text-gray-500">Acciones irreversibles</p>
              </div>
            </div>

            <div className="space-y-4">
              {/* Delete Account (disabled) */}
              <div className="flex items-center justify-between p-4 bg-gray-900 border border-gray-800 rounded-lg">
                <div>
                  <p className="text-gray-300 font-medium">Eliminar Cuenta</p>
                  <p className="text-sm text-gray-600">Elimina permanentemente tu cuenta y todos los datos</p>
                </div>
                <button
                  disabled
                  className="px-4 py-2 bg-gray-800 text-gray-500 rounded-lg cursor-not-allowed text-sm"
                >
                  Contactar administrador
                </button>
              </div>

              {/* Logout */}
              <div className="flex items-center justify-between p-4 bg-gray-900 border border-gray-800 rounded-lg">
                <div>
                  <p className="text-gray-300 font-medium">Cerrar Sesión</p>
                  <p className="text-sm text-gray-600">Salir de tu cuenta en este dispositivo</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 rounded-lg transition-colors text-sm font-medium"
                >
                  <LogOut className="h-4 w-4" />
                  Cerrar Sesión
                </button>
              </div>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
