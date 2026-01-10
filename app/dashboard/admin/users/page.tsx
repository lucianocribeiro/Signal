'use client';

import { useEffect, useState } from 'react';
import { Calendar, Mail, Search, Shield } from 'lucide-react';

interface User {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  created_at: string;
  updated_at: string;
}

interface Stats {
  total: number;
  admins: number;
  users: number;
  viewers: number;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
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

    fetchUsers();
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
                        <button
                          disabled
                          className="text-sm text-gray-600 hover:text-gray-500 transition-colors"
                        >
                          Gestionar
                        </button>
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
