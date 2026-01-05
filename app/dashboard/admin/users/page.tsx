'use client';

import { useState, useEffect } from 'react';
import { Plus, X, User as UserIcon, Mail, Lock, Calendar, Shield, Loader2, Check, AlertCircle, Trash2, RefreshCw } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  role: string;
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
    role: 'user',
  });

  const [formErrors, setFormErrors] = useState({
    email: '',
    password: '',
  });

  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetUser, setResetUser] = useState<UserProfile | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [resetError, setResetError] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState(false);

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

  const roleOptions = Array.from(
    new Set(['admin', 'owner', 'user', 'viewer', ...users.map((user) => user.role)].filter(Boolean))
  );

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin':
        return 'Administrador';
      case 'owner':
        return 'Propietario';
      case 'viewer':
        return 'Observador';
      case 'user':
        return 'Usuario';
      default:
        return role;
    }
  };

  const getRoleBadgeClasses = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-signal-500/10 text-signal-500 border border-signal-500/20';
      case 'owner':
        return 'bg-amber-500/10 text-amber-500 border border-amber-500/20';
      case 'viewer':
        return 'bg-gray-800 text-gray-400 border border-gray-700';
      case 'user':
        return 'bg-gray-800 text-gray-400 border border-gray-700';
      default:
        return 'bg-gray-800 text-gray-400 border border-gray-700';
    }
  };

  // Validate email format
  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Validate password requirements
  const validatePassword = (password: string): { isValid: boolean; error: string } => {
    if (!password) {
      return { isValid: false, error: 'La contraseña es requerida' };
    }
    if (password.length < 8) {
      return { isValid: false, error: 'La contraseña debe tener al menos 8 caracteres' };
    }
    if (!/[a-zA-Z]/.test(password)) {
      return { isValid: false, error: 'La contraseña debe contener al menos 1 letra' };
    }
    if (!/[0-9]/.test(password)) {
      return { isValid: false, error: 'La contraseña debe contener al menos 1 número' };
    }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      return { isValid: false, error: 'La contraseña debe contener al menos 1 símbolo (!@#$%^&*...)' };
    }
    return { isValid: true, error: '' };
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

    // Validate password with new requirements
    const passwordValidation = validatePassword(formData.password);
    if (!passwordValidation.isValid) {
      errors.password = passwordValidation.error;
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
          phone_number: formData.phone || null,
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

  const handleOpenResetModal = (user: UserProfile) => {
    setResetUser(user);
    setResetPassword('');
    setResetError(null);
    setIsResetModalOpen(true);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetUser) return;

    setResetError(null);

    const passwordValidation = validatePassword(resetPassword);
    if (!passwordValidation.isValid) {
      setResetError(passwordValidation.error);
      return;
    }

    setIsResetting(true);

    try {
      const response = await fetch(`/api/admin/users/${resetUser.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password: resetPassword }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Error al restablecer la contraseña');
      }

      setSuccess(`Contraseña restablecida para ${resetUser.email}`);
      setIsResetModalOpen(false);
      setResetUser(null);
      setResetPassword('');
    } catch (err) {
      setResetError(err instanceof Error ? err.message : 'Error al restablecer la contraseña');
    } finally {
      setIsResetting(false);
    }
  };

  // Delete user
  const handleDeleteUser = async (userId: string, userEmail: string) => {
    // Confirm deletion
    if (!window.confirm(`¿Estás seguro de que deseas eliminar al usuario ${userEmail}? Esta acción no se puede deshacer.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Error al eliminar usuario');
      }

      // Remove user from local state
      setUsers((prev) => prev.filter((user) => user.id !== userId));

      setSuccess('Usuario eliminado exitosamente');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar usuario');
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
                    Acciones
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
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeClasses(
                          user.role
                        )}`}
                      >
                        {(user.role === 'admin' || user.role === 'owner') && (
                          <Shield className="h-3 w-3 mr-1" />
                        )}
                        {getRoleLabel(user.role)}
                      </span>
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
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleOpenResetModal(user)}
                          className="flex items-center gap-2 px-3 py-1.5 text-signal-400 hover:text-signal-300 hover:bg-signal-500/10 rounded-lg transition-colors text-sm border border-transparent hover:border-signal-500/30"
                        >
                          <RefreshCw className="h-4 w-4" />
                          Resetear
                        </button>
                        <button
                          onClick={() => handleDeleteUser(user.id, user.email)}
                          className="flex items-center gap-2 px-3 py-1.5 text-red-400 hover:text-red-300 hover:bg-red-950/20 rounded-lg transition-colors text-sm border border-transparent hover:border-red-900/30"
                        >
                          <Trash2 className="h-4 w-4" />
                          Eliminar
                        </button>
                      </div>
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
                  {/* Password Requirements */}
                  <div className="mt-2 space-y-1">
                    <p className="text-xs text-gray-400">La contraseña debe contener:</p>
                    <div className="space-y-0.5 text-xs">
                      <div className={`flex items-center gap-1.5 ${formData.password.length >= 8 ? 'text-green-400' : 'text-gray-500'}`}>
                        <Check className={`h-3 w-3 ${formData.password.length >= 8 ? 'opacity-100' : 'opacity-30'}`} />
                        <span>Mínimo 8 caracteres</span>
                      </div>
                      <div className={`flex items-center gap-1.5 ${/[a-zA-Z]/.test(formData.password) ? 'text-green-400' : 'text-gray-500'}`}>
                        <Check className={`h-3 w-3 ${/[a-zA-Z]/.test(formData.password) ? 'opacity-100' : 'opacity-30'}`} />
                        <span>Al menos 1 letra</span>
                      </div>
                      <div className={`flex items-center gap-1.5 ${/[0-9]/.test(formData.password) ? 'text-green-400' : 'text-gray-500'}`}>
                        <Check className={`h-3 w-3 ${/[0-9]/.test(formData.password) ? 'opacity-100' : 'opacity-30'}`} />
                        <span>Al menos 1 número</span>
                      </div>
                      <div className={`flex items-center gap-1.5 ${/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(formData.password) ? 'text-green-400' : 'text-gray-500'}`}>
                        <Check className={`h-3 w-3 ${/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(formData.password) ? 'opacity-100' : 'opacity-30'}`} />
                        <span>Al menos 1 símbolo (!@#$%...)</span>
                      </div>
                    </div>
                  </div>
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
                  <label htmlFor="phone_number" className="block text-sm font-medium mb-1">
                    Teléfono (Opcional)
                  </label>
                  <input
                    id="phone_number"
                    name="phone_number"
                    type="tel"
                    placeholder="+54 11 1234-5678"
                    value={formData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    disabled={isCreating}
                    className="w-full px-3 py-2 border rounded-md"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Para recibir notificaciones por SMS
                  </p>
                </div>

                {/* Role Selector */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-3">
                    Rol del usuario *
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) => handleInputChange('role', e.target.value)}
                    disabled={isCreating}
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-signal-500 focus:border-transparent transition-all disabled:opacity-50"
                  >
                    {roleOptions.map((role) => (
                      <option key={role} value={role}>
                        {getRoleLabel(role)}
                      </option>
                    ))}
                  </select>
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

      {/* Reset Password Modal */}
      {isResetModalOpen && resetUser && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center px-4">
            <div
              className="fixed inset-0 bg-black/80 backdrop-blur-sm"
              onClick={() => !isResetting && setIsResetModalOpen(false)}
            />

            <div className="relative bg-gray-950 border border-gray-800 rounded-2xl shadow-xl max-w-md w-full p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white">Restablecer Contraseña</h2>
                <button
                  onClick={() => !isResetting && setIsResetModalOpen(false)}
                  disabled={isResetting}
                  className="text-gray-400 hover:text-white transition-colors disabled:opacity-50"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleResetPassword} className="space-y-4">
                <div className="text-sm text-gray-400">
                  Usuario: <span className="text-gray-200">{resetUser.email}</span>
                </div>

                <div>
                  <label htmlFor="reset_password" className="block text-sm font-medium text-gray-300 mb-2">
                    Nueva contraseña *
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Lock className="h-5 w-5 text-gray-500" />
                    </div>
                    <input
                      id="reset_password"
                      type="password"
                      required
                      value={resetPassword}
                      onChange={(e) => setResetPassword(e.target.value)}
                      disabled={isResetting}
                      className="block w-full pl-10 pr-3 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-signal-500 focus:border-transparent transition-all disabled:opacity-50"
                      placeholder="Mínimo 8 caracteres"
                    />
                  </div>
                  {resetError && (
                    <p className="mt-1 text-xs text-red-400">{resetError}</p>
                  )}
                  <div className="mt-2 space-y-1">
                    <p className="text-xs text-gray-400">La contraseña debe contener:</p>
                    <div className="space-y-0.5 text-xs">
                      <div className={`flex items-center gap-1.5 ${resetPassword.length >= 8 ? 'text-green-400' : 'text-gray-500'}`}>
                        <Check className={`h-3 w-3 ${resetPassword.length >= 8 ? 'opacity-100' : 'opacity-30'}`} />
                        <span>Mínimo 8 caracteres</span>
                      </div>
                      <div className={`flex items-center gap-1.5 ${/[a-zA-Z]/.test(resetPassword) ? 'text-green-400' : 'text-gray-500'}`}>
                        <Check className={`h-3 w-3 ${/[a-zA-Z]/.test(resetPassword) ? 'opacity-100' : 'opacity-30'}`} />
                        <span>Al menos 1 letra</span>
                      </div>
                      <div className={`flex items-center gap-1.5 ${/[0-9]/.test(resetPassword) ? 'text-green-400' : 'text-gray-500'}`}>
                        <Check className={`h-3 w-3 ${/[0-9]/.test(resetPassword) ? 'opacity-100' : 'opacity-30'}`} />
                        <span>Al menos 1 número</span>
                      </div>
                      <div className={`flex items-center gap-1.5 ${/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(resetPassword) ? 'text-green-400' : 'text-gray-500'}`}>
                        <Check className={`h-3 w-3 ${/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(resetPassword) ? 'opacity-100' : 'opacity-30'}`} />
                        <span>Al menos 1 símbolo (!@#$%...)</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsResetModalOpen(false)}
                    disabled={isResetting}
                    className="flex-1 px-4 py-2.5 bg-gray-900 hover:bg-gray-800 text-gray-300 rounded-lg transition-colors disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isResetting}
                    className="flex-1 px-4 py-2.5 bg-signal-500 hover:bg-signal-600 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isResetting ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <span>Actualizando...</span>
                      </>
                    ) : (
                      <span>Restablecer</span>
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
