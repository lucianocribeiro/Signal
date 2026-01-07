'use client';

import React, { useState } from 'react';
import { ExternalLink, Twitter, Globe, Megaphone, CheckCircle, XCircle, Calendar, Clock, Trash2, Pencil, RotateCcw, Save, X } from 'lucide-react';

interface Source {
  id: string;
  project_id: string;
  url: string;
  name: string | null;
  source_type: 'x_twitter' | 'twitter' | 'reddit' | 'news' | 'other';
  platform: string;
  is_active: boolean;
  last_scraped_at: string | null;
  created_at: string;
  updated_at: string;
}

interface SourcesListProps {
  sources: Source[];
  isLoading?: boolean;
  onDeleteClick?: (source: Source) => void;
  onUpdateSource?: (sourceId: string, updates: { url: string; name: string | null; source_type: Source['source_type'] }) => Promise<Source | void>;
  onReactivateSource?: (sourceId: string) => Promise<Source | void>;
}

const normalizeSourceType = (sourceType: Source['source_type']) => {
  if (sourceType === 'twitter') {
    return 'x_twitter';
  }
  return sourceType;
};

const isValidUrl = (urlString: string): boolean => {
  try {
    const urlObj = new URL(urlString);
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
  } catch {
    return false;
  }
};

export default function SourcesList({ sources, isLoading, onDeleteClick, onUpdateSource, onReactivateSource }: SourcesListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftUrl, setDraftUrl] = useState('');
  const [draftName, setDraftName] = useState('');
  const [draftType, setDraftType] = useState<Source['source_type']>('news');
  const [isSaving, setIsSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<{ id: string; message: string } | null>(null);

  const startEditing = (source: Source) => {
    setEditingId(source.id);
    setDraftUrl(source.url || '');
    setDraftName(source.name || '');
    setDraftType(normalizeSourceType(source.source_type));
    setEditError(null);
    setActionError(null);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setDraftUrl('');
    setDraftName('');
    setDraftType('news');
    setEditError(null);
  };

  const handleSave = async (source: Source) => {
    if (!onUpdateSource) return;
    setEditError(null);

    const trimmedUrl = draftUrl.trim();
    const trimmedName = draftName.trim();

    if (!trimmedUrl) {
      setEditError('La URL es requerida');
      return;
    }

    if (!isValidUrl(trimmedUrl)) {
      setEditError('URL inválida. Debe comenzar con http:// o https://');
      return;
    }

    const nextName = trimmedName.length > 0 ? trimmedName : null;
    const normalizedExistingType = normalizeSourceType(source.source_type);
    const hasChanges =
      trimmedUrl !== source.url ||
      nextName !== (source.name || null) ||
      draftType !== normalizedExistingType;

    if (!hasChanges) {
      setEditError('No hay cambios para guardar');
      return;
    }

    setIsSaving(true);

    try {
      await onUpdateSource(source.id, {
        url: trimmedUrl,
        name: nextName,
        source_type: draftType,
      });
      cancelEditing();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al actualizar fuente';
      setEditError(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReactivate = async (sourceId: string) => {
    if (!onReactivateSource) return;
    setIsSaving(true);
    setActionError(null);
    try {
      await onReactivateSource(sourceId);
      setActionError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al reactivar fuente';
      setActionError({ id: sourceId, message });
    } finally {
      setIsSaving(false);
    }
  };
  // Get icon for source type
  const getSourceIcon = (sourceType: string) => {
    switch (sourceType) {
      case 'twitter':
      case 'x_twitter':
        return <Twitter className="h-5 w-5 text-sky-400" />;
      case 'reddit':
        return <Megaphone className="h-5 w-5 text-orange-400" />;
      case 'news':
        return <Globe className="h-5 w-5 text-gray-400" />;
      case 'other':
        return <Globe className="h-5 w-5 text-gray-400" />;
      default:
        return <Globe className="h-5 w-5 text-gray-400" />;
    }
  };

  // Get badge color for source type
  const getSourceBadgeColor = (sourceType: string) => {
    switch (sourceType) {
      case 'twitter':
      case 'x_twitter':
        return 'bg-sky-500/10 text-sky-400 border-sky-500/30';
      case 'reddit':
        return 'bg-orange-500/10 text-orange-400 border-orange-500/30';
      case 'news':
        return 'bg-gray-500/10 text-gray-400 border-gray-500/30';
      case 'other':
        return 'bg-gray-500/10 text-gray-400 border-gray-500/30';
      default:
        return 'bg-gray-500/10 text-gray-400 border-gray-500/30';
    }
  };

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  // Format relative time
  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Hace un momento';
    if (diffMins < 60) return `Hace ${diffMins} min`;
    if (diffHours < 24) return `Hace ${diffHours}h`;
    if (diffDays < 7) return `Hace ${diffDays}d`;
    return formatDate(dateString);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-black border border-gray-800 rounded-lg p-6 animate-pulse"
          >
            <div className="flex items-start gap-4">
              <div className="h-10 w-10 bg-gray-800 rounded-lg" />
              <div className="flex-1 space-y-3">
                <div className="h-5 bg-gray-800 rounded w-3/4" />
                <div className="h-4 bg-gray-800 rounded w-1/2" />
                <div className="flex gap-2">
                  <div className="h-6 bg-gray-800 rounded w-20" />
                  <div className="h-6 bg-gray-800 rounded w-16" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Empty state
  if (sources.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-8 text-center bg-black border border-gray-800 rounded-lg">
        <div className="h-16 w-16 rounded-full bg-gray-900 border border-gray-800 flex items-center justify-center mb-4">
          <Globe className="h-8 w-8 text-gray-600" />
        </div>
        <h3 className="text-lg font-semibold text-gray-400 mb-2">
          No hay fuentes configuradas
        </h3>
        <p className="text-gray-600 max-w-md">
          Agrega tu primera fuente para comenzar a monitorear señales de este proyecto
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4">
      {sources.map((source) => {
        const isEditing = editingId === source.id;
        return (
        <div
          key={source.id}
          className="bg-black border border-gray-800 hover:border-gray-700 rounded-lg p-6 transition-colors"
        >
          <div className="flex items-start gap-4">
            {/* Icon */}
            <div className="h-10 w-10 rounded-lg bg-gray-900 border border-gray-800 flex items-center justify-center flex-shrink-0">
              {getSourceIcon(source.source_type)}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              {/* Name or URL */}
              <div className="flex items-start justify-between gap-4 mb-2">
                <div className="flex-1 min-w-0">
                  {isEditing ? (
                    <div className="space-y-3">
                      <div>
                        <label htmlFor={`source-url-${source.id}`} className="block text-xs text-gray-400 mb-1">
                          URL
                        </label>
                        <input
                          id={`source-url-${source.id}`}
                          type="url"
                          value={draftUrl}
                          onChange={(e) => setDraftUrl(e.target.value)}
                          className="w-full px-3 py-2 bg-black border border-gray-800 rounded-lg text-gray-100 placeholder-gray-600 focus:outline-none focus:border-signal-500 focus:ring-1 focus:ring-signal-500 transition-colors"
                          disabled={isSaving}
                          required
                        />
                      </div>
                      <div>
                        <label htmlFor={`source-name-${source.id}`} className="block text-xs text-gray-400 mb-1">
                          Nombre (Opcional)
                        </label>
                        <input
                          id={`source-name-${source.id}`}
                          type="text"
                          value={draftName}
                          onChange={(e) => setDraftName(e.target.value)}
                          maxLength={200}
                          className="w-full px-3 py-2 bg-black border border-gray-800 rounded-lg text-gray-100 placeholder-gray-600 focus:outline-none focus:border-signal-500 focus:ring-1 focus:ring-signal-500 transition-colors"
                          disabled={isSaving}
                        />
                      </div>
                      <div>
                        <label htmlFor={`source-type-${source.id}`} className="block text-xs text-gray-400 mb-1">
                          Tipo de Plataforma
                        </label>
                        <select
                          id={`source-type-${source.id}`}
                          value={draftType}
                          onChange={(e) => setDraftType(e.target.value as Source['source_type'])}
                          className="w-full px-3 py-2 bg-black border border-gray-800 rounded-lg text-gray-100 focus:outline-none focus:border-signal-500 focus:ring-1 focus:ring-signal-500 transition-colors"
                          disabled={isSaving}
                        >
                          <option value="news">Noticias (RSS/Artículos)</option>
                          <option value="x_twitter">X (Twitter)</option>
                          <option value="reddit">Reddit</option>
                          <option value="other">Otro</option>
                        </select>
                      </div>
                    </div>
                  ) : (
                    <>
                      <h3 className="text-base font-semibold text-gray-200 mb-1">
                        {source.name || new URL(source.url).hostname}
                      </h3>
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-signal-500 hover:text-signal-400 transition-colors flex items-center gap-1 truncate"
                      >
                        <span className="truncate">{source.url}</span>
                        <ExternalLink className="h-3 w-3 flex-shrink-0" />
                      </a>
                    </>
                  )}
                </div>

                {/* Status and Actions */}
                <div className="flex items-center gap-3 flex-shrink-0">
                  {/* Active Status */}
                  <div className="flex items-center gap-1">
                    {source.is_active ? (
                      <>
                        <CheckCircle className="h-4 w-4 text-green-400" />
                        <span className="text-xs text-green-400 font-medium">Activa</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="h-4 w-4 text-gray-500" />
                        <span className="text-xs text-gray-500 font-medium">Inactiva</span>
                      </>
                    )}
                  </div>

                  {/* Edit Button */}
                  {onUpdateSource && !isEditing && (
                    <button
                      onClick={() => startEditing(source)}
                      className="p-2 rounded-lg transition-colors text-gray-400 hover:text-signal-400 hover:bg-signal-500/10"
                      title="Editar fuente"
                      aria-label="Editar fuente"
                      disabled={isSaving}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  )}

                  {/* Delete Button */}
                  {onDeleteClick && source.is_active && !isEditing && (
                    <button
                      onClick={() => onDeleteClick(source)}
                      className={`p-2 rounded-lg transition-colors ${
                        source.is_active
                          ? 'text-gray-400 hover:text-red-400 hover:bg-red-950/20'
                          : 'text-gray-600 hover:text-red-500 hover:bg-red-950/30'
                      }`}
                      title={source.is_active ? 'Desactivar fuente' : 'Eliminar fuente inactiva'}
                      aria-label={source.is_active ? 'Desactivar fuente' : 'Eliminar fuente inactiva'}
                      disabled={isSaving}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}

                  {/* Reactivate Button */}
                  {onReactivateSource && !source.is_active && !isEditing && (
                    <button
                      onClick={() => handleReactivate(source.id)}
                      className="p-2 rounded-lg transition-colors text-gray-400 hover:text-green-400 hover:bg-green-500/10"
                      title="Reactivar fuente"
                      aria-label="Reactivar fuente"
                      disabled={isSaving}
                    >
                      <RotateCcw className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              {isEditing && (
                <div className="mt-4 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleSave(source)}
                    disabled={isSaving}
                    className="inline-flex items-center gap-2 px-3 py-2 bg-signal-500 text-white rounded-lg hover:bg-signal-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                  >
                    <Save className="h-4 w-4" />
                    <span>Guardar</span>
                  </button>
                  <button
                    type="button"
                    onClick={cancelEditing}
                    disabled={isSaving}
                    className="inline-flex items-center gap-2 px-3 py-2 bg-gray-900 border border-gray-700 text-gray-300 rounded-lg hover:bg-gray-800 hover:border-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                  >
                    <X className="h-4 w-4" />
                    <span>Cancelar</span>
                  </button>
                </div>
              )}

              {isEditing && editError && (
                <div className="mt-3 bg-red-950/20 border border-red-900/30 rounded-lg p-3">
                  <p className="text-sm text-red-400">{editError}</p>
                </div>
              )}

              {!isEditing && actionError && actionError.id === source.id && (
                <div className="mt-3 bg-red-950/20 border border-red-900/30 rounded-lg p-3">
                  <p className="text-sm text-red-400">{actionError.message}</p>
                </div>
              )}

              {/* Metadata */}
              <div className="flex flex-wrap items-center gap-3 mt-3">
                {/* Source Type Badge */}
                <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium ${getSourceBadgeColor(source.source_type)}`}>
                  {getSourceIcon(source.source_type)}
                  <span className="capitalize">
                    {source.source_type === 'news'
                      ? 'Noticias'
                      : source.source_type === 'x_twitter' || source.source_type === 'twitter'
                        ? 'X/Twitter'
                        : source.source_type === 'other'
                          ? 'Otro'
                          : source.source_type}
                  </span>
                </div>

                {/* Created Date */}
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>Agregada: {formatDate(source.created_at)}</span>
                </div>

                {/* Last Scraped */}
                {source.last_scraped_at && (
                  <div className="flex items-center gap-1.5 text-xs text-gray-500">
                    <Clock className="h-3.5 w-3.5" />
                    <span>Última revisión: {formatRelativeTime(source.last_scraped_at)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )})}
    </div>
  );
}
