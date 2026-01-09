'use client';

import React, { useEffect } from 'react';
import { CheckCircle, AlertTriangle } from 'lucide-react';

export type ToastType = 'success' | 'error';

interface ToastProps {
  type: ToastType;
  message: string;
  onClose: () => void;
  durationMs?: number;
}

export default function Toast({ type, message, onClose, durationMs = 4000 }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => onClose(), durationMs);
    return () => clearTimeout(timer);
  }, [onClose, durationMs]);

  return (
    <div className="fixed top-6 right-6 z-[100]">
      <div
        className={`flex items-center gap-3 rounded-lg border px-4 py-3 shadow-lg backdrop-blur-sm ${
          type === 'success'
            ? 'bg-green-500/10 border-green-500/30 text-green-400'
            : 'bg-red-500/10 border-red-500/30 text-red-400'
        }`}
        role="status"
        aria-live="polite"
      >
        {type === 'success' ? (
          <CheckCircle className="h-5 w-5 flex-shrink-0" />
        ) : (
          <AlertTriangle className="h-5 w-5 flex-shrink-0" />
        )}
        <span className="text-sm font-medium">{message}</span>
        <button
          onClick={onClose}
          className="ml-2 text-xs uppercase tracking-wide text-current/70 hover:text-current"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}
