'use client';

import React from 'react';
import { X, Archive, ExternalLink, TrendingUp, Minus, Clock, AlertCircle } from 'lucide-react';
import { Signal } from './SignalCard';

interface SignalDetailModalProps {
  signal: Signal | null;
  isOpen: boolean;
  onClose: () => void;
  onArchive: (signalId: string) => void;
}

export default function SignalDetailModal({
  signal,
  isOpen,
  onClose,
  onArchive,
}: SignalDetailModalProps) {
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
                <span>{signal.detectedAt}</span>
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
                        Detectado en {signal.source}
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
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">Evidencia</h3>
                <a
                  href={signal.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-3 bg-black border border-gray-800 rounded-lg text-signal-500 hover:border-signal-500/50 hover:bg-signal-500/5 transition-colors group"
                >
                  <ExternalLink className="h-4 w-4" />
                  <span className="flex-1 text-sm font-medium truncate">{signal.sourceUrl}</span>
                  <span className="text-xs text-gray-500 group-hover:text-signal-400">Abrir fuente</span>
                </a>
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
