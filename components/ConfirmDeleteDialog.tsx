'use client';

import React from 'react';

interface ConfirmDeleteDialogProps {
  isOpen: boolean;
  isLoading?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function ConfirmDeleteDialog({
  isOpen,
  isLoading = false,
  onCancel,
  onConfirm,
}: ConfirmDeleteDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 backdrop-blur-sm px-4">
      <div className="w-full max-w-md rounded-lg border border-gray-800 bg-gray-950 p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-white mb-2">¿Eliminar señal?</h3>
        <p className="text-sm text-gray-400 mb-6">
          Esta acción eliminará la señal de forma permanente.
        </p>
        <div className="flex items-center justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200 transition-colors disabled:text-gray-600"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors disabled:bg-red-500/60 disabled:text-red-200"
          >
            {isLoading ? 'Eliminando...' : 'Eliminar'}
          </button>
        </div>
      </div>
    </div>
  );
}
