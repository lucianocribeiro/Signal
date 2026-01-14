'use client';

import React from 'react';
import { X, ExternalLink, AlertTriangle, TrendingUp, Clock, FileText } from 'lucide-react';
import { Signal } from './SignalCard';

interface SignalDetailModalProps {
  signal: Signal | null;
  isOpen: boolean;
  onClose: () => void;
  onDelete: (signal: Signal) => void;
  isDeleting?: boolean;
}

export default function SignalDetailModal({
  signal,
  isOpen,
  onClose,
  onDelete,
  isDeleting = false,
}: SignalDetailModalProps) {
  if (!isOpen || !signal) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-gray-950 border border-gray-800 rounded-lg w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <div
          className={`p-6 border-b ${
            signal.risk_level === 'watch_closely'
              ? 'border-red-500/30 bg-red-500/5'
              : 'border-gray-800'
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex flex-wrap gap-2 mb-3">
                {signal.risk_level === 'watch_closely' && (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-500 border border-red-500/20">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    REQUIERE ATENCION
                  </span>
                )}
                <span
                  className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                    signal.status === 'Accelerating'
                      ? 'bg-signal-500/10 text-signal-500 border border-signal-500/20'
                      : 'bg-gray-500/10 text-gray-400 border border-gray-500/20'
                  }`}
                >
                  {signal.status === 'Accelerating' && <TrendingUp className="h-3 w-3 mr-1" />}
                  {signal.status === 'Accelerating'
                    ? 'ACELERANDO'
                    : signal.status.toUpperCase()}
                </span>
              </div>

              <h2 className="text-xl font-bold text-white">{signal.headline}</h2>

              <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {new Date(signal.detected_at).toLocaleString('es-AR')}
                </span>
                {signal.source_name && <span>Fuente: {signal.source_name}</span>}
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
            >
              <X className="h-5 w-5 text-gray-400" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {signal.key_points && signal.key_points.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-signal-500 uppercase tracking-wide mb-3">
                Puntos Clave
              </h3>
              <ul className="space-y-2">
                {signal.key_points.map((point, index) => (
                  <li key={index} className="flex items-start gap-3 text-gray-300">
                    <span className="flex-shrink-0 h-5 w-5 rounded-full bg-signal-500/10 border border-signal-500/20 flex items-center justify-center text-xs text-signal-500">
                      {index + 1}
                    </span>
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
              Analisis Completo
            </h3>
            <div className="text-gray-300 leading-relaxed whitespace-pre-wrap">
              {signal.summary}
            </div>
          </div>

          {signal.source_url && (
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
                Fuente Original
              </h3>
              <a
                href={signal.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-signal-500 hover:text-signal-400 transition-colors"
              >
                <ExternalLink className="h-4 w-4" />
                <span className="underline break-all">{signal.source_url}</span>
              </a>
            </div>
          )}

          {signal.tags && signal.tags.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
                Etiquetas
              </h3>
              <div className="flex flex-wrap gap-2">
                {signal.tags.map((tag, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 bg-gray-800 text-gray-300 rounded-full text-sm"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-800 flex items-center justify-between">
          {signal.source_url ? (
            <a
              href={signal.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
              Abrir Fuente Original
            </a>
          ) : (
            <div className="flex items-center gap-2 text-gray-500 text-sm">
              <FileText className="h-4 w-4" />
              Fuente no disponible
            </div>
          )}

          <div className="flex items-center gap-3 ml-auto">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-400 hover:text-gray-200 transition-colors"
            >
              Cerrar
            </button>
            <button
              onClick={() => onDelete(signal)}
              disabled={isDeleting}
              className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors disabled:bg-red-500/60 disabled:text-red-200"
            >
              {isDeleting ? 'Eliminando...' : 'Eliminar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
