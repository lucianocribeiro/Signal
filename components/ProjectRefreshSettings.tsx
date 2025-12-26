'use client';

import { useState, useEffect } from 'react';
import { Clock, RefreshCw, AlertTriangle } from 'lucide-react';
import { RefreshInterval, REFRESH_INTERVAL_OPTIONS } from '@/lib/scraper/types';

interface ProjectRefreshSettingsProps {
  projectId: string;
  currentInterval: RefreshInterval;
  lastRefreshAt: string | null;
  onIntervalChange: (interval: RefreshInterval) => void;
}

/**
 * Component for managing project refresh settings
 * Displays refresh interval selector, last refresh time, and manual refresh button
 */
export default function ProjectRefreshSettings({
  projectId,
  currentInterval,
  lastRefreshAt,
  onIntervalChange,
}: ProjectRefreshSettingsProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Calculate time since last refresh
  const getTimeSinceRefresh = () => {
    if (!lastRefreshAt) return null;

    const now = new Date();
    const lastRefresh = new Date(lastRefreshAt);
    const diffMs = now.getTime() - lastRefresh.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    if (diffHours < 1) {
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      return `hace ${diffMinutes} minuto${diffMinutes !== 1 ? 's' : ''}`;
    }

    const hours = Math.floor(diffHours);
    return `hace ${hours} hora${hours !== 1 ? 's' : ''}`;
  };

  // Calculate next refresh time
  const getNextRefreshTime = () => {
    if (!lastRefreshAt) return 'Próximamente';

    const lastRefresh = new Date(lastRefreshAt);
    const nextRefresh = new Date(lastRefresh.getTime() + currentInterval * 60 * 60 * 1000);
    const now = new Date();

    if (nextRefresh <= now) return 'Ahora';

    const diffMs = nextRefresh.getTime() - now.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    if (diffHours < 1) {
      const diffMinutes = Math.ceil(diffMs / (1000 * 60));
      return `en ${diffMinutes} minuto${diffMinutes !== 1 ? 's' : ''}`;
    }

    const hours = Math.ceil(diffHours);
    return `en ${hours} hora${hours !== 1 ? 's' : ''}`;
  };

  // Check if data is stale (older than 2× the refresh interval)
  const isDataStale = () => {
    if (!lastRefreshAt) return false;

    const now = new Date();
    const lastRefresh = new Date(lastRefreshAt);
    const diffHours = (now.getTime() - lastRefresh.getTime()) / (1000 * 60 * 60);

    return diffHours > currentInterval * 2;
  };

  // Handle manual refresh
  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await fetch(`/api/projects/${projectId}/scrape`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Error al actualizar el proyecto');
      }

      const result = await response.json();

      if (result.success) {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
        // Reload page to show updated data
        window.location.reload();
      } else {
        throw new Error(result.error || 'Error desconocido');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al actualizar');
    } finally {
      setIsRefreshing(false);
    }
  };

  const timeSinceRefresh = getTimeSinceRefresh();
  const nextRefreshTime = getNextRefreshTime();
  const showStaleWarning = isDataStale();

  return (
    <div className="space-y-4">
      {/* Refresh Interval Selector */}
      <div>
        <label className="block text-sm font-medium text-gray-200 mb-2">
          <Clock className="inline h-4 w-4 mr-1" />
          Intervalo de actualización
        </label>
        <select
          value={currentInterval}
          onChange={(e) => onIntervalChange(Number(e.target.value) as RefreshInterval)}
          className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-md text-gray-200 focus:outline-none focus:ring-2 focus:ring-signal-500 transition-colors"
        >
          {REFRESH_INTERVAL_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label} - {option.description}
            </option>
          ))}
        </select>
      </div>

      {/* Last Refresh Info */}
      <div className="text-sm text-gray-400 space-y-1">
        <div>
          <span className="font-medium">Última actualización:</span>{' '}
          {timeSinceRefresh || 'Nunca'}
        </div>
        <div>
          <span className="font-medium">Próxima actualización:</span> {nextRefreshTime}
        </div>
      </div>

      {/* Staleness Warning */}
      {showStaleWarning && (
        <div className="flex items-start gap-2 p-3 bg-yellow-900/20 border border-yellow-700/50 rounded-md">
          <AlertTriangle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-yellow-200">
            <div className="font-medium">Datos desactualizados</div>
            <div className="text-yellow-300/80">
              Los datos tienen más de {currentInterval * 2} horas. Considera actualizar manualmente.
            </div>
          </div>
        </div>
      )}

      {/* Manual Refresh Button */}
      <button
        onClick={handleManualRefresh}
        disabled={isRefreshing}
        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-signal-600 hover:bg-signal-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-md transition-colors"
      >
        <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
        {isRefreshing ? 'Actualizando...' : 'Actualizar ahora'}
      </button>

      {/* Success Message */}
      {success && (
        <div className="p-3 bg-green-900/20 border border-green-700/50 rounded-md text-sm text-green-200">
          ✅ Proyecto actualizado correctamente
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="p-3 bg-red-900/20 border border-red-700/50 rounded-md text-sm text-red-200">
          ❌ {error}
        </div>
      )}
    </div>
  );
}
