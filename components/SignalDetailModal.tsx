'use client';

import React, { useState, useEffect } from 'react';
import { X, Archive, ExternalLink, TrendingUp, Minus, Clock, AlertCircle, Loader2, FileText } from 'lucide-react';
import { Signal } from './SignalCard';

interface EvidenceItem {
  reference_id: string;
  reference_type: 'detected' | 'momentum' | 'manual';
  linked_at: string;
  ingestion: {
    id: string;
    content: string;
    url: string;
    ingested_at: string;
    source: {
      id: string;
      name: string;
      platform: string;
    };
  };
}

interface SignalDetailModalProps {
  signal: Signal | null;
  isOpen: boolean;
  onClose: () => void;
  onArchive: (signalId: string) => void;
}

// Helper function to format relative time in Spanish
function formatRelativeTime(isoString: string): string {
  const now = new Date();
  const then = new Date(isoString);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Ahora';
  if (diffMins < 60) return `Hace ${diffMins} min`;
  if (diffHours < 24) return `Hace ${diffHours} hora${diffHours !== 1 ? 's' : ''}`;
  if (diffDays < 7) return `Hace ${diffDays} día${diffDays !== 1 ? 's' : ''}`;
  return then.toLocaleDateString('es-ES');
}

export default function SignalDetailModal({
  signal,
  isOpen,
  onClose,
  onArchive,
}: SignalDetailModalProps) {
  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
  const [isLoadingEvidence, setIsLoadingEvidence] = useState(false);
  const [evidenceError, setEvidenceError] = useState<string | null>(null);

  // Fetch evidence when modal opens with a signal
  useEffect(() => {
    if (!signal?.id) {
      setEvidence([]);
      return;
    }

    const fetchEvidence = async () => {
      setIsLoadingEvidence(true);
      setEvidenceError(null);

      try {
        console.log('[SignalDetailModal] Fetching evidence for signal:', signal.id);

        const response = await fetch(`/api/signals/${signal.id}/evidence`);

        if (!response.ok) {
          throw new Error('Error al cargar evidencia');
        }

        const data = await response.json();
        console.log('[SignalDetailModal] Loaded', data.evidence?.length || 0, 'evidence items');

        setEvidence(data.evidence || []);
      } catch (err) {
        console.error('[SignalDetailModal] Error fetching evidence:', err);
        setEvidenceError('Error al cargar la evidencia');
        setEvidence([]);
      } finally {
        setIsLoadingEvidence(false);
      }
    };

    fetchEvidence();
  }, [signal?.id]);

  if (!isOpen || !signal) return null;

  const isAccelerating = signal.status === 'Accelerating';
  const isNew = signal.status === 'New';

  const handleArchive = () => {
    console.log('Archiving signal:', signal.id);
    onArchive(signal.id);
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="bg-gray-950 border border-gray-800 rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden pointer-events-auto animate-in zoom-in-95 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div
            className={`
              px-6 py-4 border-b flex items-center justify-between
              ${isAccelerating ? 'border-signal-500/30 bg-signal-500/5' : 'border-gray-800'}
            `}
          >
            <div className="flex items-center gap-3">
              {/* Status Badge */}
              <div
                className={`
                  inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold tracking-wide
                  ${isAccelerating
                    ? 'bg-signal-500/10 text-signal-500 border border-signal-500/30'
                    : isNew
                      ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/30'
                      : 'bg-gray-800 text-gray-400 border border-gray-700'
                  }
                `}
              >
                {isAccelerating && <TrendingUp className="h-3.5 w-3.5" />}
                {(signal.status === 'Stabilizing' || isNew) && <Minus className="h-3.5 w-3.5" />}
                {isAccelerating ? 'ACELERANDO' : isNew ? 'NUEVO' : 'ESTABILIZADO'}
              </div>

              {/* Timestamp */}
              <div className="flex items-center gap-1.5 text-sm text-gray-500">
                <Clock className="h-4 w-4" />
                <span>{formatRelativeTime(signal.detected_at)}</span>
              </div>
            </div>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-gray-900 transition-colors"
              aria-label="Cerrar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="overflow-y-auto max-h-[calc(85vh-160px)]">
            <div className="p-6 space-y-6">
              {/* Headline */}
              <div>
                <h2
                  className={`
                    text-2xl font-bold mb-2
                    ${isAccelerating ? 'text-signal-100' : 'text-gray-100'}
                  `}
                >
                  {signal.headline}
                </h2>
              </div>

              {/* Orientation Summary */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-signal-500" />
                  <h3 className="text-lg font-semibold text-gray-200">Resumen de Orientación</h3>
                </div>

                <div className="bg-black border border-gray-800 rounded-lg p-4">
                  <div className="space-y-3">
                    <div>
                      <h4 className="text-sm font-semibold text-signal-500 mb-1">QUÉ</h4>
                      <p className="text-sm text-gray-300 leading-relaxed">{signal.summary}</p>
                    </div>

                    <div className="border-t border-gray-800 pt-3">
                      <h4 className="text-sm font-semibold text-signal-500 mb-1">DÓNDE</h4>
                      <p className="text-sm text-gray-300 leading-relaxed">
                        Detectado en {signal.source_name || 'múltiples fuentes'}
                      </p>
                    </div>

                    <div className="border-t border-gray-800 pt-3">
                      <h4 className="text-sm font-semibold text-signal-500 mb-1">POR QUÉ ES RELEVANTE</h4>
                      <p className="text-sm text-gray-300 leading-relaxed">
                        Esta señal muestra {signal.momentum === 'high' ? 'alto' : signal.momentum === 'medium' ? 'medio' : 'bajo'} momentum
                        y requiere {isAccelerating ? 'seguimiento prioritario' : 'monitoreo general'}.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Evidence/Source */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">
                    Evidencia ({evidence.length})
                  </h3>
                  {isLoadingEvidence && (
                    <Loader2 className="h-4 w-4 text-signal-500 animate-spin" />
                  )}
                </div>

                {/* Loading State */}
                {isLoadingEvidence && evidence.length === 0 && (
                  <div className="flex items-center justify-center py-8">
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="h-8 w-8 text-signal-500 animate-spin" />
                      <p className="text-sm text-gray-500">Cargando evidencia...</p>
                    </div>
                  </div>
                )}

                {/* Error State */}
                {evidenceError && !isLoadingEvidence && (
                  <div className="flex items-center justify-center py-8 bg-red-500/5 border border-red-500/20 rounded-lg">
                    <p className="text-sm text-red-400">{evidenceError}</p>
                  </div>
                )}

                {/* Empty State */}
                {!isLoadingEvidence && !evidenceError && evidence.length === 0 && (
                  <div className="flex items-center justify-center py-8 bg-gray-900/50 border border-gray-800 rounded-lg">
                    <p className="text-sm text-gray-500">No hay evidencia disponible</p>
                  </div>
                )}

                {/* Evidence Items */}
                {!isLoadingEvidence && !evidenceError && evidence.length > 0 && (
                  <div className="space-y-3">
                    {evidence.map((item) => (
                      <div
                        key={item.reference_id}
                        className="bg-black border border-gray-800 rounded-lg p-4 hover:border-gray-700 transition-colors"
                      >
                        {/* Source Info */}
                        <div className="flex items-center gap-2 mb-2">
                          <FileText className="h-4 w-4 text-signal-500" />
                          <span className="text-sm font-medium text-gray-300">
                            {item.ingestion.source.name}
                          </span>
                          <span className="text-xs text-gray-600">•</span>
                          <span className="text-xs text-gray-500 capitalize">
                            {item.ingestion.source.platform}
                          </span>
                          <span className="text-xs text-gray-600">•</span>
                          <span className="text-xs text-gray-500">
                            {formatRelativeTime(item.ingestion.ingested_at)}
                          </span>
                        </div>

                        {/* Content Preview */}
                        <p className="text-sm text-gray-400 leading-relaxed mb-3 line-clamp-3">
                          {item.ingestion.content.substring(0, 200)}
                          {item.ingestion.content.length > 200 ? '...' : ''}
                        </p>

                        {/* Link */}
                        <a
                          href={item.ingestion.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs text-signal-500 hover:text-signal-400 transition-colors group"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          <span className="group-hover:underline">Ver fuente original</span>
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="px-6 py-4 border-t border-gray-800 bg-black/50 flex items-center justify-between">
            <button
              onClick={handleArchive}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-900 border border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white hover:border-gray-600 transition-colors"
            >
              <Archive className="h-4 w-4" />
              <span className="font-medium">Archivar</span>
            </button>

            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-signal-500 text-white font-medium hover:bg-signal-600 transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
