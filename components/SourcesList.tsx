'use client';

import React from 'react';
import { ExternalLink, Twitter, Globe, Megaphone, CheckCircle, XCircle, Calendar, Clock, Trash2 } from 'lucide-react';

interface Source {
  id: string;
  project_id: string;
  url: string;
  name: string | null;
  source_type: 'twitter' | 'reddit' | 'news';
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
}

export default function SourcesList({ sources, isLoading, onDeleteClick }: SourcesListProps) {
  // Get icon for source type
  const getSourceIcon = (sourceType: string) => {
    switch (sourceType) {
      case 'twitter':
        return <Twitter className="h-5 w-5 text-sky-400" />;
      case 'reddit':
        return <Megaphone className="h-5 w-5 text-orange-400" />;
      case 'news':
        return <Globe className="h-5 w-5 text-gray-400" />;
      default:
        return <Globe className="h-5 w-5 text-gray-400" />;
    }
  };

  // Get badge color for source type
  const getSourceBadgeColor = (sourceType: string) => {
    switch (sourceType) {
      case 'twitter':
        return 'bg-sky-500/10 text-sky-400 border-sky-500/30';
      case 'reddit':
        return 'bg-orange-500/10 text-orange-400 border-orange-500/30';
      case 'news':
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
      {sources.map((source) => (
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

                  {/* Delete Button */}
                  {onDeleteClick && source.is_active && (
                    <button
                      onClick={() => onDeleteClick(source)}
                      className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-950/20 rounded-lg transition-colors"
                      title="Eliminar fuente"
                      aria-label="Eliminar fuente"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Metadata */}
              <div className="flex flex-wrap items-center gap-3 mt-3">
                {/* Source Type Badge */}
                <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium ${getSourceBadgeColor(source.source_type)}`}>
                  {getSourceIcon(source.source_type)}
                  <span className="capitalize">{source.source_type === 'news' ? 'Noticias' : source.source_type}</span>
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
      ))}
    </div>
  );
}
