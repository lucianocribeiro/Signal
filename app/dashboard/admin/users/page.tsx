'use client';

import { useState, useEffect } from 'react';
import { Plus, X, User as UserIcon, Mail, Lock, Phone, Calendar, Shield, Loader2, Check, AlertCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  role: 'user' | 'owner';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export default function AdminUsersPage() {
  const { profile } = useAuth();
  const supabase = createClient();

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    phone: '',
    role: 'user' as 'user' | 'owner',
  });

  const [formErrors, setFormErrors] = useState({
    email: '',
    password: '',
  });

  // Fetch users from database
  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setUsers(data || []);
    } catch (err) {
      console.error('Error fetching users:', err);
      setError('Error al cargar usuarios');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Validate email format
  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Handle form input changes
  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear errors when user types
    if (field === 'email' || field === 'password') {
      setFormErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  // Create new user
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // Validate form
    let hasErrors = false;
    const errors = { email: '', password: '' };

    if (!formData.email) {
      errors.email = 'El correo electrónico es requerido';
      hasErrors = true;
    } else if (!validateEmail(formData.email)) {
      errors.email = 'El formato del correo electrónico no es válido';
      hasErrors = true;
    }

    if (!formData.password) {
      errors.password = 'La contraseña es requerida';
      hasErrors = true;
    } else if (formData.password.length < 8) {
      errors.password = 'La contraseña debe tener al menos 8 caracteres';
      hasErrors = true;
    }

    if (hasErrors) {
      setFormErrors(errors);
      return;
    }

    setIsCreating(true);

    try {
      // Call API route to create user
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          full_name: formData.full_name,
          phone_number: formData.phone,
          role: formData.role,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Error al crear usuario');
      }

      // Success
      setSuccess(`Usuario ${formData.email} creado exitosamente`);

      // Reset form
      setFormData({
        email: '',
        password: '',
        full_name: '',
        phone: '',
        role: 'user',
      });

      // Close modal after delay
      setTimeout(() => {
        setIsModalOpen(false);
        setSuccess(null);
        fetchUsers(); // Refresh user list
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear usuario');
    } finally {
      setIsCreating(false);
    }
  };

  // Toggle user active status
  const handleToggleActive = async (userId: string, currentStatus: boolean) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          is_active: !currentStatus,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Error al actualizar estado del usuario');
      }

      // Update local state
      setUsers((prev) =>
        prev.map((user) =>
          user.id === userId ? { ...user, is_active: !currentStatus } : user
        )
      );

      setSuccess('Estado de usuario actualizado exitosamente');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al actualizar estado del usuario');
      setTimeout(() => setError(null), 3000);
    }
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-AR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-950/50 sticky top-0 z-20 backdrop-blur-sm">
        <div className="px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Gestión de Usuarios</h1>
              <p className="text-gray-400">
                Administra las cuentas de usuario de la plataforma
              </p>
            </div>
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-signal-500 hover:bg-signal-600 text-white rounded-lg transition-colors font-medium"
            >
              <Plus className="h-5 w-5" />
              Crear Nuevo Usuario
            </button>
          </div>
        </div>
      </div>

      {/* Success/Error Notifications */}
      {success && (
        <div className="mx-8 mt-6">
          <div className="bg-green-900/20 border border-green-800 rounded-lg p-4 flex items-center gap-3">
            <Check className="h-5 w-5 text-green-500 flex-shrink-0" />
            <p className="text-sm text-green-400">{success}</p>
          </div>
        </div>
      )}

      {error && (
        <div className="mx-8 mt-6">
          <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-400">{error}</p>
          </div>
        </div>
      )}

      {/* User List */}
      <div className="px-8 py-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 text-signal-500 animate-spin" />
          </div>
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="h-16 w-16 rounded-full bg-gray-900 border border-gray-800 flex items-center justify-center mb-4">
              <UserIcon className="h-8 w-8 text-gray-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-400 mb-2">No hay usuarios</h3>
            <p className="text-gray-600">Crea el primer usuario para comenzar</p>
          </div>
        ) : (
          <div className="bg-gray-950 border border-gray-800 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-black border-b border-gray-800">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Usuario
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Rol
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Teléfono
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Fecha de Creación
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Estado
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-900/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-signal-500 to-signal-600 flex items-center justify-center flex-shrink-0">
                          <UserIcon className="h-5 w-5 text-white" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white">
                            {user.full_name || 'Sin nombre'}
                          </p>
                          <p className="text-xs text-gray-500">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {user.role === 'owner' ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-signal-500/10 text-signal-500 border border-signal-500/20">
                          <Shield className="h-3 w-3 mr-1" />
                          Propietario
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-800 text-gray-400 border border-gray-700">
                          Usuario
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-gray-400">{user.phone || '—'}</p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-sm text-gray-400">
                        <Calendar className="h-4 w-4" />
                        {formatDate(user.created_at)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleToggleActive(user.id, user.is_active)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          user.is_active ? 'bg-signal-500' : 'bg-gray-700'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            user.is_active ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                      <span className="ml-3 text-xs text-gray-400">
                        {user.is_active ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create User Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center px-4">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black/80 backdrop-blur-sm"
              onClick={() => !isCreating && setIsModalOpen(false)}
            />

            {/* Modal */}
            <div className="relative bg-gray-950 border border-gray-800 rounded-2xl shadow-xl max-w-md w-full p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white">Crear Nuevo Usuario</h2>
                <button
                  onClick={() => !isCreating && setIsModalOpen(false)}
                  disabled={isCreating}
                  className="text-gray-400 hover:text-white transition-colors disabled:opacity-50"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleCreateUser} className="space-y-4">
                {/* Email */}
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                    Correo electrónico *
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Mail className="h-5 w-5 text-gray-500" />
                    </div>
                    <input
                      id="email"
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      disabled={isCreating}
                      className={`block w-full pl-10 pr-3 py-2.5 bg-gray-900 border ${
                        formErrors.email ? 'border-red-500' : 'border-gray-700'
                      } rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-signal-500 focus:border-transparent transition-all disabled:opacity-50`}
                      placeholder="usuario@ejemplo.com"
                    />
                  </div>
                  {formErrors.email && (
                    <p className="mt-1 text-xs text-red-400">{formErrors.email}</p>
                  )}
                </div>

                {/* Password */}
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                    Contraseña temporal *
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Lock className="h-5 w-5 text-gray-500" />
                    </div>
                    <input
                      id="password"
                      type="password"
                      required
                      value={formData.password}
                      onChange={(e) => handleInputChange('password', e.target.value)}
                      disabled={isCreating}
                      className={`block w-full pl-10 pr-3 py-2.5 bg-gray-900 border ${
                        formErrors.password ? 'border-red-500' : 'border-gray-700'
                      } rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-signal-500 focus:border-transparent transition-all disabled:opacity-50`}
                      placeholder="Mínimo 8 caracteres"
                    />
                  </div>
                  {formErrors.password && (
                    <p className="mt-1 text-xs text-red-400">{formErrors.password}</p>
                  )}
                </div>

                {/* Full Name */}
                <div>
                  <label htmlFor="full_name" className="block text-sm font-medium text-gray-300 mb-2">
                    Nombre completo
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <UserIcon className="h-5 w-5 text-gray-500" />
                    </div>
                    <input
                      id="full_name"
                      type="text"
                      value={formData.full_name}
                      onChange={(e) => handleInputChange('full_name', e.target.value)}
                      disabled={isCreating}
                      className="block w-full pl-10 pr-3 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-signal-500 focus:border-transparent transition-all disabled:opacity-50"
                      placeholder="Juan Pérez"
                    />
                  </div>
                </div>

                {/* Phone */}
                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-gray-300 mb-2">
                    Teléfono
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Phone className="h-5 w-5 text-gray-500" />
                    </div>
                    <input
                      id="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => handleInputChange('phone', e.target.value)}
                      disabled={isCreating}
                      className="block w-full pl-10 pr-3 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-signal-500 focus:border-transparent transition-all disabled:opacity-50"
                      placeholder="+54 11 1234-5678"
                    />
                  </div>
                </div>

                {/* Role Selector */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-3">
                    Rol del usuario *
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-3 p-3 bg-gray-900 border border-gray-700 rounded-lg cursor-pointer hover:border-gray-600 transition-colors">
                      <input
                        type="radio"
                        name="role"
                        value="user"
                        checked={formData.role === 'user'}
                        onChange={(e) => handleInputChange('role', e.target.value)}
                        disabled={isCreating}
                        className="h-4 w-4 text-signal-500 focus:ring-signal-500 border-gray-600"
                      />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-white">Usuario</p>
                        <p className="text-xs text-gray-500">Acceso estándar a la plataforma</p>
                      </div>
                    </label>

                    <label className="flex items-center gap-3 p-3 bg-gray-900 border border-gray-700 rounded-lg cursor-pointer hover:border-gray-600 transition-colors">
                      <input
                        type="radio"
                        name="role"
                        value="owner"
                        checked={formData.role === 'owner'}
                        onChange={(e) => handleInputChange('role', e.target.value)}
                        disabled={isCreating}
                        className="h-4 w-4 text-signal-500 focus:ring-signal-500 border-gray-600"
                      />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-white">Propietario</p>
                        <p className="text-xs text-gray-500">Acceso completo y administración</p>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Submit Button */}
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    disabled={isCreating}
                    className="flex-1 px-4 py-2.5 bg-gray-900 hover:bg-gray-800 text-gray-300 rounded-lg transition-colors disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isCreating}
                    className="flex-1 px-4 py-2.5 bg-signal-500 hover:bg-signal-600 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isCreating ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <span>Creando...</span>
                      </>
                    ) : (
                      <span>Crear Usuario</span>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
