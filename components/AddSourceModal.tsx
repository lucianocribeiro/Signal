'use client';

import React, { useState } from 'react';
import { X, Plus, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

interface AddSourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  onSourceAdded: () => void;
}

// Platform options
const platformOptions = [
  { value: 'news', label: 'Noticias (RSS/Artículos)' },
  { value: 'twitter', label: 'Twitter' },
  { value: 'reddit', label: 'Reddit' },
  { value: 'marketplace', label: 'Marketplace/Búsquedas' }
];

// Auto-detect platform from URL
function detectPlatformFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();

    // Twitter detection
    if (hostname.includes('x.com') || hostname.includes('twitter.com')) {
      return 'twitter';
    }

    // Reddit detection
    if (hostname.includes('reddit.com')) {
      return 'reddit';
    }

    // Marketplace detection
    const marketplaceDomains = ['mercadolibre.com', 'zonaprop.com', 'properati.com', 'olx.com'];
    if (marketplaceDomains.some(domain => hostname.includes(domain))) {
      return 'marketplace';
    }

    // RSS/News detection (common patterns)
    if (url.includes('/rss') || url.includes('/feed') || url.includes('.xml')) {
      return 'news';
    }

    // Default to news for known news domains
    const newsDomains = ['lanacion.com.ar', 'clarin.com', 'infobae.com', 'pagina12.com.ar'];
    if (newsDomains.some(domain => hostname.includes(domain))) {
      return 'news';
    }

    return 'news'; // Default to news instead of 'other'
  } catch {
    return 'news';
  }
}

export default function AddSourceModal({ isOpen, onClose, projectId, onSourceAdded }: AddSourceModalProps) {
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [platform, setPlatform] = useState('news');
  const [manuallySelectedPlatform, setManuallySelectedPlatform] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Reset form
  const resetForm = () => {
    setUrl('');
    setName('');
    setPlatform('news');
    setManuallySelectedPlatform(false);
    setError(null);
    setSuccess(false);
  };

  // Handle close
  const handleClose = () => {
    resetForm();
    onClose();
  };

  // Validate URL format
  const isValidUrl = (urlString: string): boolean => {
    try {
      const urlObj = new URL(urlString);
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch {
      return false;
    }
  };

  // Handle submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    // Validate URL
    if (!url.trim()) {
      setError('La URL es requerida');
      return;
    }

    if (!isValidUrl(url)) {
      setError('URL inválida. Debe comenzar con http:// o https://');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/sources', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          project_id: projectId,
          url: url.trim(),
          name: name.trim() || null,
          source_type: platform,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Error al agregar fuente');
        setIsSubmitting(false);
        return;
      }

      // Success
      setSuccess(true);
      setIsSubmitting(false);

      // Wait a bit to show success message, then close and refresh
      setTimeout(() => {
        onSourceAdded();
        handleClose();
      }, 1500);

    } catch (err) {
      console.error('Error adding source:', err);
      setError('Error al agregar fuente. Intenta nuevamente.');
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-950 border border-gray-800 rounded-xl w-full max-w-lg shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <h2 className="text-xl font-bold text-white">Agregar Nueva Fuente</h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-200 transition-colors"
            disabled={isSubmitting}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* URL Input */}
          <div>
            <label htmlFor="url" className="block text-sm font-medium text-gray-300 mb-2">
              URL de la Fuente <span className="text-red-400">*</span>
            </label>
            <input
              type="url"
              id="url"
              value={url}
              onChange={(e) => {
                const newUrl = e.target.value;
                setUrl(newUrl);

                // Auto-detect and set platform if not manually selected
                if (newUrl && !manuallySelectedPlatform) {
                  const detected = detectPlatformFromUrl(newUrl);
                  setPlatform(detected);
                }
              }}
              placeholder="https://x.com/LANACION"
              className="w-full px-4 py-2.5 bg-black border border-gray-800 rounded-lg text-gray-100 placeholder-gray-600 focus:outline-none focus:border-signal-500 focus:ring-1 focus:ring-signal-500 transition-colors"
              disabled={isSubmitting || success}
              required
            />
            <p className="mt-1.5 text-xs text-gray-500">
              Ejemplos: Twitter, Reddit, o cualquier sitio web de noticias
            </p>
          </div>

          {/* Platform Selector */}
          <div>
            <label htmlFor="platform" className="block text-sm font-medium text-gray-300 mb-2">
              Tipo de Plataforma <span className="text-red-400">*</span>
            </label>
            <select
              id="platform"
              value={platform}
              onChange={(e) => {
                setPlatform(e.target.value);
                setManuallySelectedPlatform(true);
              }}
              className="w-full px-4 py-2.5 bg-black border border-gray-800 rounded-lg text-gray-100 focus:outline-none focus:border-signal-500 focus:ring-1 focus:ring-signal-500 transition-colors"
              disabled={isSubmitting || success}
              required
            >
              {platformOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {platform === 'twitter' && !manuallySelectedPlatform && (
              <p className="text-sm text-green-400 mt-1.5 flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4" />
                Detectado como fuente de Twitter
              </p>
            )}
            {platform === 'reddit' && !manuallySelectedPlatform && (
              <p className="text-sm text-green-400 mt-1.5 flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4" />
                Detectado como fuente de Reddit
              </p>
            )}
            {platform === 'marketplace' && !manuallySelectedPlatform && (
              <p className="text-sm text-green-400 mt-1.5 flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4" />
                Detectado como Marketplace
              </p>
            )}
            {platform === 'news' && !manuallySelectedPlatform && url && (
              <p className="text-sm text-green-400 mt-1.5 flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4" />
                Detectado como fuente de noticias
              </p>
            )}
          </div>

          {/* Name Input (Optional) */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-2">
              Nombre (Opcional)
            </label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Cuenta oficial del candidato"
              maxLength={200}
              className="w-full px-4 py-2.5 bg-black border border-gray-800 rounded-lg text-gray-100 placeholder-gray-600 focus:outline-none focus:border-signal-500 focus:ring-1 focus:ring-signal-500 transition-colors"
              disabled={isSubmitting || success}
            />
            <p className="mt-1.5 text-xs text-gray-500">
              Un nombre descriptivo para identificar esta fuente fácilmente
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="flex items-start gap-3 p-4 bg-red-950/20 border border-red-900/30 rounded-lg">
              <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-400">Error</p>
                <p className="text-sm text-red-300 mt-1">{error}</p>
              </div>
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="flex items-start gap-3 p-4 bg-signal-500/10 border border-signal-500/30 rounded-lg">
              <CheckCircle2 className="h-5 w-5 text-signal-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-signal-500">¡Fuente agregada!</p>
                <p className="text-sm text-signal-400 mt-1">La fuente se agregó correctamente al proyecto</p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting || success}
              className="flex-1 px-4 py-2.5 bg-gray-900 border border-gray-700 text-gray-300 rounded-lg hover:bg-gray-800 hover:border-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || success}
              className="flex-1 px-4 py-2.5 bg-signal-500 text-white rounded-lg hover:bg-signal-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Agregando...</span>
                </>
              ) : success ? (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Agregada</span>
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  <span>Agregar Fuente</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
