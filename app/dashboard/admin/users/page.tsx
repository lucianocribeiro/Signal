'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Calendar, Mail, Search, Shield } from 'lucide-react';

interface User {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  created_at: string;
  updated_at: string;
  is_banned?: boolean;
}

interface Stats {
  total: number;
  admins: number;
  users: number;
  viewers: number;
}

interface Project {
  id: string;
  name: string;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [projects, setProjects] = useState<Project[]>([]);
  const [createForm, setCreateForm] = useState({
    email: '',
    password: '',
    full_name: '',
    phone_number: '',
    role: 'user',
  });
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingRole, setEditingRole] = useState('user');
  const [isUpdating, setIsUpdating] = useState(false);
  const [isResettingUserId, setIsResettingUserId] = useState<string | null>(null);
  const [isTogglingUserId, setIsTogglingUserId] = useState<string | null>(null);
  const [isDeletingUserId, setIsDeletingUserId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/admin/users');
      if (!response.ok) {
        throw new Error('Error al cargar usuarios');
      }

      const data = await response.json();
      setUsers(data.users || []);
      setStats(data.stats || null);
    } catch (err) {
      console.error('[Admin Users] Error:', err);
      setError('Error al cargar usuarios');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchProjects = async () => {
    try {
      const response = await fetch('/api/admin/projects');
      if (!response.ok) {
        throw new Error('Error al cargar proyectos');
      }

      const data = await response.json();
      const mappedProjects = (data.projects || []).map((project: any) => ({
        id: project.id,
        name: project.name,
      }));
      setProjects(mappedProjects);
    } catch (err) {
      console.error('[Admin Users] Error loading projects:', err);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchProjects();
  }, []);

  const filteredUsers = users.filter((user) =>
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.role.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getRoleInfo = (role: string) => {
    switch (role) {
      case 'admin':
        return {
          color: 'bg-sky-500/10 text-sky-500 border-sky-500/20',
          label: 'ADMINISTRADOR',
        };
      case 'user':
        return {
          color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
          label: 'USUARIO',
        };
      case 'viewer':
        return {
          color: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
          label: 'VISUALIZADOR',
        };
      default:
        return {
          color: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
          label: role.toUpperCase(),
        };
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-AR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const handleCreateUser = async (event: FormEvent) => {
    event.preventDefault();
    setCreateError(null);
    setCreateSuccess(null);

    if (!createForm.email || !createForm.password || !createForm.role) {
      setCreateError('Completa email, contraseña y rol.');
      return;
    }

    if (createForm.role === 'viewer' && selectedProjects.length === 0) {
      setCreateError('Selecciona al menos un proyecto para el visualizador.');
      return;
    }

    try {
      setIsCreating(true);
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...createForm,
          project_ids: createForm.role === 'viewer' ? selectedProjects : [],
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Error al crear usuario');
      }

      setCreateSuccess('Usuario creado correctamente.');
      setCreateForm({
        email: '',
        password: '',
        full_name: '',
        phone_number: '',
        role: 'user',
      });
      setSelectedProjects([]);
      await fetchUsers();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Error al crear usuario');
    } finally {
      setIsCreating(false);
    }
  };

  const handleStartEdit = (user: User) => {
    setActionError(null);
    setActionSuccess(null);
    setEditingUserId(user.id);
    setEditingRole(user.role);
  };

  const handleCancelEdit = () => {
    setEditingUserId(null);
    setEditingRole('user');
  };

  const handleSaveRole = async (userId: string) => {
    try {
      setIsUpdating(true);
      setActionError(null);
      setActionSuccess(null);

      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: editingRole }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Error al actualizar el rol');
      }

      setActionSuccess('Rol actualizado correctamente.');
      setEditingUserId(null);
      await fetchUsers();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Error al actualizar el rol');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleResetPassword = async (user: User) => {
    const newPassword = window.prompt(`Nueva contraseña para ${user.email}`);
    if (!newPassword) {
      return;
    }

    try {
      setIsResettingUserId(user.id);
      setActionError(null);
      setActionSuccess(null);

      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPassword }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Error al restablecer contraseña');
      }

      setActionSuccess('Contraseña restablecida correctamente.');
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Error al restablecer contraseña'
      );
    } finally {
      setIsResettingUserId(null);
    }
  };

  const handleToggleAccess = async (user: User) => {
    try {
      setIsTogglingUserId(user.id);
      setActionError(null);
      setActionSuccess(null);

      const nextActiveState = Boolean(user.is_banned);
      const response = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          updates: { is_active: nextActiveState },
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Error al actualizar el acceso');
      }

      setActionSuccess(
        nextActiveState ? 'Acceso reactivado correctamente.' : 'Acceso desactivado correctamente.'
      );
      await fetchUsers();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Error al actualizar el acceso');
    } finally {
      setIsTogglingUserId(null);
    }
  };

  const handleDeleteUser = async (user: User) => {
    const confirmed = window.confirm(
      `Eliminar usuario ${user.email}. Esta accion no se puede deshacer.`
    );
    if (!confirmed) {
      return;
    }

    try {
      setIsDeletingUserId(user.id);
      setActionError(null);
      setActionSuccess(null);

      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Error al eliminar usuario');
      }

      setActionSuccess('Usuario eliminado correctamente.');
      await fetchUsers();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Error al eliminar usuario');
    } finally {
      setIsDeletingUserId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="text-gray-400">Cargando usuarios...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="text-red-500">{error}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">Gestión de Usuarios</h2>
          <p className="text-gray-400">
            {stats?.total || 0} usuarios registrados en el sistema
          </p>
        </div>
      </div>

      <div className="bg-gray-950 border border-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Crear nuevo usuario</h3>
        {createError && (
          <div className="mb-4 bg-red-900/20 border border-red-800 rounded-lg p-3 text-sm text-red-300">
            {createError}
          </div>
        )}
        {createSuccess && (
          <div className="mb-4 bg-green-900/20 border border-green-800 rounded-lg p-3 text-sm text-green-300">
            {createSuccess}
          </div>
        )}
        <form onSubmit={handleCreateUser} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            type="email"
            placeholder="Email"
            value={createForm.email}
            onChange={(event) => setCreateForm({ ...createForm, email: event.target.value })}
            className="bg-gray-900 border border-gray-800 text-gray-200 rounded-lg px-3 py-2"
            required
          />
          <input
            type="password"
            placeholder="Contraseña"
            value={createForm.password}
            onChange={(event) => setCreateForm({ ...createForm, password: event.target.value })}
            className="bg-gray-900 border border-gray-800 text-gray-200 rounded-lg px-3 py-2"
            required
          />
          <input
            type="text"
            placeholder="Nombre completo (opcional)"
            value={createForm.full_name}
            onChange={(event) => setCreateForm({ ...createForm, full_name: event.target.value })}
            className="bg-gray-900 border border-gray-800 text-gray-200 rounded-lg px-3 py-2"
          />
          <input
            type="text"
            placeholder="Teléfono (opcional)"
            value={createForm.phone_number}
            onChange={(event) => setCreateForm({ ...createForm, phone_number: event.target.value })}
            className="bg-gray-900 border border-gray-800 text-gray-200 rounded-lg px-3 py-2"
          />
          <select
            value={createForm.role}
            onChange={(event) => {
              const nextRole = event.target.value;
              setCreateForm({ ...createForm, role: nextRole });
              if (nextRole !== 'viewer') {
                setSelectedProjects([]);
              }
            }}
            className="bg-gray-900 border border-gray-800 text-gray-200 rounded-lg px-3 py-2"
          >
            <option value="user">Usuario</option>
            <option value="admin">Administrador</option>
            <option value="viewer">Visualizador</option>
          </select>
          {createForm.role === 'viewer' && (
            <select
              multiple
              value={selectedProjects}
              onChange={(event) => {
                const values = Array.from(event.target.selectedOptions).map(
                  (option) => option.value
                );
                setSelectedProjects(values);
              }}
              className="bg-gray-900 border border-gray-800 text-gray-200 rounded-lg px-3 py-2"
            >
              {projects.length === 0 && (
                <option value="" disabled>
                  No hay proyectos disponibles
                </option>
              )}
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          )}
          <div className="md:col-span-2 flex justify-end">
            <button
              type="submit"
              disabled={isCreating}
              className="bg-signal-500 hover:bg-signal-600 text-white rounded-lg px-4 py-2 transition-colors disabled:opacity-60"
            >
              {isCreating ? 'Creando...' : 'Crear usuario'}
            </button>
          </div>
        </form>
      </div>

      {(actionError || actionSuccess) && (
        <div
          className={`border rounded-lg p-3 text-sm ${
            actionError
              ? 'bg-red-900/20 border-red-800 text-red-300'
              : 'bg-green-900/20 border-green-800 text-green-300'
          }`}
        >
          {actionError || actionSuccess}
        </div>
      )}

      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-950 border border-gray-800 rounded-lg p-4">
            <p className="text-2xl font-bold text-sky-500">{stats.admins}</p>
            <p className="text-sm text-gray-400">Administradores</p>
          </div>
          <div className="bg-gray-950 border border-gray-800 rounded-lg p-4">
            <p className="text-2xl font-bold text-emerald-500">{stats.users}</p>
            <p className="text-sm text-gray-400">Usuarios</p>
          </div>
          <div className="bg-gray-950 border border-gray-800 rounded-lg p-4">
            <p className="text-2xl font-bold text-amber-500">{stats.viewers}</p>
            <p className="text-sm text-gray-400">Visualizadores</p>
          </div>
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" />
        <input
          type="text"
          placeholder="Buscar por email, nombre o rol..."
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          className="w-full bg-gray-950 border border-gray-800 rounded-lg pl-10 pr-4 py-3 text-gray-300 placeholder-gray-600 focus:outline-none focus:border-sky-500"
        />
      </div>

      <div className="bg-gray-950 border border-gray-800 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-900/50">
                <th className="text-left px-6 py-4 text-sm font-semibold text-gray-400">Usuario</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-gray-400">Rol</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-gray-400">Fecha de Registro</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-gray-400">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                    {searchTerm ? 'No se encontraron usuarios' : 'No hay usuarios registrados'}
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const roleInfo = getRoleInfo(user.role);

                  return (
                    <tr
                      key={user.id}
                      className="border-b border-gray-800 hover:bg-gray-900/30 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-gray-500" />
                            <p className="font-medium text-white">{user.email}</p>
                          </div>
                          {user.full_name && (
                            <p className="text-sm text-gray-500 mt-1 ml-6">{user.full_name}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${roleInfo.color}`}
                        >
                          <Shield className="h-3 w-3" />
                          {roleInfo.label}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-gray-400">
                          <Calendar className="h-4 w-4" />
                          <span className="text-sm">{formatDate(user.created_at)}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {editingUserId === user.id ? (
                          <div className="flex flex-col gap-2">
                            <select
                              value={editingRole}
                              onChange={(event) => setEditingRole(event.target.value)}
                              className="bg-gray-900 border border-gray-800 text-gray-200 rounded-lg px-2 py-1 text-sm"
                            >
                              <option value="admin">Administrador</option>
                              <option value="user">Usuario</option>
                              <option value="viewer">Visualizador</option>
                            </select>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleSaveRole(user.id)}
                                disabled={isUpdating || editingRole === user.role}
                                className="text-xs text-sky-400 hover:text-sky-300 disabled:text-gray-500"
                              >
                                Guardar
                              </button>
                              <button
                                onClick={handleCancelEdit}
                                className="text-xs text-gray-400 hover:text-gray-300"
                              >
                                Cancelar
                              </button>
                            </div>
                            <button
                              onClick={() => handleResetPassword(user)}
                              disabled={isResettingUserId === user.id}
                              className="text-xs text-amber-400 hover:text-amber-300 disabled:text-gray-500"
                            >
                              Restablecer contraseña
                            </button>
                            <button
                              onClick={() => handleToggleAccess(user)}
                              disabled={isTogglingUserId === user.id}
                              className="text-xs text-red-400 hover:text-red-300 disabled:text-gray-500"
                            >
                              {user.is_banned ? 'Reactivar acceso' : 'Desactivar acceso'}
                            </button>
                            <button
                              onClick={() => handleDeleteUser(user)}
                              disabled={isDeletingUserId === user.id}
                              className="text-xs text-red-500 hover:text-red-400 disabled:text-gray-500"
                            >
                              Eliminar usuario
                            </button>
                            {user.role === 'viewer' && (
                              <Link
                                href={`/dashboard/admin/viewer-assignments?viewerId=${user.id}`}
                                className="text-xs text-gray-400 hover:text-gray-300"
                              >
                                Asignar proyectos
                              </Link>
                            )}
                          </div>
                        ) : (
                          <div className="flex flex-col gap-2">
                            <button
                              onClick={() => handleStartEdit(user)}
                              className="text-sm text-sky-400 hover:text-sky-300 transition-colors"
                            >
                              Gestionar
                            </button>
                            <button
                              onClick={() => handleResetPassword(user)}
                              disabled={isResettingUserId === user.id}
                              className="text-xs text-amber-400 hover:text-amber-300 disabled:text-gray-500"
                            >
                              Restablecer contraseña
                            </button>
                            <button
                              onClick={() => handleToggleAccess(user)}
                              disabled={isTogglingUserId === user.id}
                              className="text-xs text-red-400 hover:text-red-300 disabled:text-gray-500"
                            >
                              {user.is_banned ? 'Reactivar acceso' : 'Desactivar acceso'}
                            </button>
                            <button
                              onClick={() => handleDeleteUser(user)}
                              disabled={isDeletingUserId === user.id}
                              className="text-xs text-red-500 hover:text-red-400 disabled:text-gray-500"
                            >
                              Eliminar usuario
                            </button>
                            {user.role === 'viewer' && (
                              <Link
                                href={`/dashboard/admin/viewer-assignments?viewerId=${user.id}`}
                                className="text-xs text-gray-400 hover:text-gray-300"
                              >
                                Asignar proyectos
                              </Link>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {searchTerm && (
        <p className="text-sm text-gray-500 text-center">
          Mostrando {filteredUsers.length} de {users.length} usuarios
        </p>
      )}
    </div>
  );
}
