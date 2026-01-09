'use client';

import React, { useMemo, useState } from 'react';
import { Loader2, X } from 'lucide-react';

interface SourceRecord {
  id: string;
  project_id: string;
  url: string;
  name: string | null;
  source_type: 'x_twitter' | 'twitter' | 'reddit' | 'news' | 'other';
  is_active: boolean;
  last_scraped_at: string | null;
  created_at: string;
  updated_at: string;
}

interface AddSourceModalProps {
  isOpen: boolean;
  projectId: string;
  onClose: () => void;
  onSourceAdded: (source: SourceRecord) => void;
}

type SourceTypeOption = 'x_twitter' | 'reddit' | 'news';

const SOURCE_TYPE_OPTIONS: { value: SourceTypeOption; label: string }[] = [
  { value: 'x_twitter', label: 'Twitter/X' },
  { value: 'reddit', label: 'Reddit' },
  { value: 'news', label: 'Noticias' },
];

function isValidUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export default function AddSourceModal({
  isOpen,
  projectId,
  onClose,
  onSourceAdded,
}: AddSourceModalProps) {
  const [url, setUrl] = useState('');
  const [sourceType, setSourceType] = useState<SourceTypeOption>('news');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validationError = useMemo(() => {
    if (!url.trim()) return 'URL inválida';
    if (!isValidUrl(url)) return 'URL inválida';
    const lowerUrl = url.toLowerCase();

    if (sourceType === 'x_twitter' && !(lowerUrl.includes('x.com') || lowerUrl.includes('twitter.com'))) {
      return 'La URL debe ser de Twitter/X';
    }
    if (sourceType === 'reddit' && !lowerUrl.includes('reddit.com')) {
      return 'La URL debe ser de Reddit';
    }
    return null;
  }, [url, sourceType]);

  const handleClose = () => {
    setUrl('');
    setSourceType('news');
    setError(null);
    onClose();
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (validationError) {
      setError(validationError === 'URL inválida' ? 'URL inválida' : validationError);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          url: url.trim(),
          source_type: sourceType,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const apiError = data.error || 'Error al agregar fuente';
        if (typeof apiError === 'string' && apiError.toLowerCase().includes('ya existe')) {
          throw new Error('Esta fuente ya existe en el proyecto');
        }
        throw new Error(apiError);
      }

      onSourceAdded(data.source);
      handleClose();
    } catch (err) {
      console.error('[AddSourceModal] Error adding source:', err);
      setError(err instanceof Error ? err.message : 'Error al agregar fuente');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 backdrop-blur-sm px-4">
      <div className="w-full max-w-lg rounded-xl border border-gray-800 bg-gray-950 shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-800 px-6 py-4">
          <h3 className="text-lg font-semibold text-white">Agregar Nueva Fuente</h3>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-200"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 px-6 py-5">
          <div className="space-y-2">
            <label htmlFor="source-url" className="text-sm text-gray-400">
              URL
            </label>
            <input
              id="source-url"
              type="url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              className="w-full rounded-lg border border-gray-700 bg-black px-4 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
              placeholder="https://x.com/ejemplo"
              required
            />
            {validationError && <p className="text-xs text-red-400">{validationError}</p>}
          </div>

          <div className="space-y-2">
            <span className="text-sm text-gray-400">Tipo</span>
            <div className="grid gap-3 sm:grid-cols-3">
              {SOURCE_TYPE_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className={`flex cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                    sourceType === option.value
                      ? 'border-sky-500 text-sky-400 bg-sky-500/10'
                      : 'border-gray-800 text-gray-300 hover:border-gray-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="sourceType"
                    value={option.value}
                    checked={sourceType === option.value}
                    onChange={() => setSourceType(option.value)}
                    className="sr-only"
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-300 transition-colors hover:bg-gray-900"
              disabled={isSubmitting}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-600 disabled:cursor-not-allowed disabled:bg-sky-500/60"
              disabled={isSubmitting}
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {isSubmitting ? 'Agregando...' : 'Agregar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
