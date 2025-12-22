'use client';

import React, { useState } from 'react';
import { X, Trash2, Loader2, AlertTriangle } from 'lucide-react';

interface DeleteSourceConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  source: {
    id: string;
    url: string;
    name: string | null;
  } | null;
  onConfirmDelete: (sourceId: string) => Promise<void>;
}

export default function DeleteSourceConfirmModal({
  isOpen,
  onClose,
  source,
  onConfirmDelete,
}: DeleteSourceConfirmModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Handle delete confirmation
  const handleDelete = async () => {
    if (!source) return;

    setIsDeleting(true);
    setError(null);

    try {
      await onConfirmDelete(source.id);
      // Success - parent will close modal and refresh list
    } catch (err) {
      console.error('Error deleting source:', err);
      setError(err instanceof Error ? err.message : 'Error al eliminar fuente. Intenta nuevamente.');
      setIsDeleting(false);
    }
  };

  // Handle close
  const handleClose = () => {
    if (!isDeleting) {
      setError(null);
      onClose();
    }
  };

  if (!isOpen || !source) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-950 border border-gray-800 rounded-xl w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-red-400" />
            </div>
            <h2 className="text-xl font-bold text-white">¿Eliminar fuente?</h2>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-200 transition-colors"
            disabled={isDeleting}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <p className="text-gray-300">
            ¿Estás seguro de que deseas eliminar esta fuente? Esta acción no se puede deshacer.
          </p>

          {/* Source Info */}
          <div className="bg-black border border-gray-800 rounded-lg p-4">
            <p className="text-sm text-gray-500 mb-1">Fuente a eliminar:</p>
            {source.name && (
              <p className="text-base font-semibold text-gray-200 mb-1">
                {source.name}
              </p>
            )}
            <p className="text-sm text-gray-400 break-all">
              {source.url}
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-950/20 border border-red-900/30 rounded-lg p-4">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* Warning Note */}
          <div className="bg-orange-950/20 border border-orange-900/30 rounded-lg p-4">
            <p className="text-sm text-orange-300">
              <strong>Nota:</strong> Esta fuente dejará de ser monitoreada y no se generarán más señales desde ella.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 p-6 border-t border-gray-800">
          <button
            type="button"
            onClick={handleClose}
            disabled={isDeleting}
            className="flex-1 px-4 py-2.5 bg-gray-900 border border-gray-700 text-gray-300 rounded-lg hover:bg-gray-800 hover:border-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2"
          >
            {isDeleting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Eliminando...</span>
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4" />
                <span>Eliminar</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
