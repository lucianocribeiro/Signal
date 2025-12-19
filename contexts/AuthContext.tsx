'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';

// Types
export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  role: 'user' | 'owner';
  created_at: string;
  updated_at: string;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

// Create Context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Error messages in Spanish
const ERROR_MESSAGES: Record<string, string> = {
  'Invalid login credentials': 'Credenciales de inicio de sesión inválidas',
  'Email not confirmed': 'El correo electrónico no ha sido confirmado',
  'User not found': 'Usuario no encontrado',
  'Invalid email': 'Correo electrónico inválido',
  'Password should be at least 6 characters': 'La contraseña debe tener al menos 6 caracteres',
  'Network request failed': 'Error de conexión. Verifica tu internet',
  'default': 'Ocurrió un error. Por favor, intenta nuevamente',
};

function getSpanishErrorMessage(error: AuthError | Error | null): string {
  if (!error) return ERROR_MESSAGES.default;

  const message = error.message;
  return ERROR_MESSAGES[message] || ERROR_MESSAGES.default;
}

// Provider Component
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  // Fetch user profile from database
  const fetchUserProfile = async (userId: string): Promise<UserProfile | null> => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching user profile:', error);
        return null;
      }

      return data as UserProfile;
    } catch (error) {
      console.error('Error fetching user profile:', error);
      return null;
    }
  };

  // Sign In
  const signIn = async (email: string, password: string): Promise<{ error: string | null }> => {
    try {
      setLoading(true);

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { error: getSpanishErrorMessage(error) };
      }

      if (data.user) {
        setUser(data.user);
        setSession(data.session);

        // Fetch user profile
        const userProfile = await fetchUserProfile(data.user.id);
        setProfile(userProfile);
      }

      return { error: null };
    } catch (error) {
      return { error: getSpanishErrorMessage(error as Error) };
    } finally {
      setLoading(false);
    }
  };

  // Sign Out
  const signOut = async (): Promise<void> => {
    try {
      setLoading(true);
      await supabase.auth.signOut();
      setUser(null);
      setProfile(null);
      setSession(null);
    } catch (error) {
      console.error('Error signing out:', error);
    } finally {
      setLoading(false);
    }
  };

  // Refresh User
  const refreshUser = async (): Promise<void> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        setUser(user);
        const userProfile = await fetchUserProfile(user.id);
        setProfile(userProfile);
      } else {
        setUser(null);
        setProfile(null);
        setSession(null);
      }
    } catch (error) {
      console.error('Error refreshing user:', error);
      setUser(null);
      setProfile(null);
      setSession(null);
    }
  };

  // Initialize auth state on mount
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // Get initial session
        const { data: { session } } = await supabase.auth.getSession();

        if (session) {
          setSession(session);
          setUser(session.user);

          // Fetch user profile
          const userProfile = await fetchUserProfile(session.user.id);
          setProfile(userProfile);
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event);

        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          const userProfile = await fetchUserProfile(session.user.id);
          setProfile(userProfile);
        } else {
          setProfile(null);
        }

        setLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const value: AuthContextType = {
    user,
    profile,
    session,
    loading,
    signIn,
    signOut,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Custom hook to use auth context
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}
