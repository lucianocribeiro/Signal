'use client';

import { InfoIcon } from 'lucide-react';

export function UrlBestPracticesInfo() {
  return (
    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
      <div className="flex items-start gap-3">
        <InfoIcon className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
        <div className="space-y-3 text-sm">
          <div>
            <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
              📌 Mejores Prácticas para URLs
            </h3>
            <p className="text-blue-800 dark:text-blue-200 mb-3">
              Para obtener los mejores resultados, usa URLs específicas en lugar de páginas de inicio:
            </p>
          </div>

          <div className="space-y-3">
            <div>
              <p className="font-medium text-blue-900 dark:text-blue-100 mb-1">
                ✅ RECOMENDADO: RSS Feeds
              </p>
              <p className="text-blue-700 dark:text-blue-300 mb-1">
                Los feeds RSS son la mejor opción - proporcionan múltiples artículos actualizados:
              </p>
              <div className="bg-white dark:bg-gray-800 rounded p-2 font-mono text-xs space-y-1">
                <div>La Nación: <code className="text-green-600">https://www.lanacion.com.ar/arc/outboundfeeds/rss/</code></div>
                <div>Clarín: <code className="text-green-600">https://www.clarin.com/rss/lo-ultimo/</code></div>
                <div>Infobae: <code className="text-green-600">https://www.infobae.com/feeds/rss/</code></div>
                <div>Página/12: <code className="text-green-600">https://www.pagina12.com.ar/rss/portada</code></div>
              </div>
            </div>

            <div>
              <p className="font-medium text-blue-900 dark:text-blue-100 mb-1">
                ✅ ALTERNATIVA: URLs de Artículos Específicos
              </p>
              <p className="text-blue-700 dark:text-blue-300 mb-1">
                URLs directas a artículos individuales:
              </p>
              <div className="bg-white dark:bg-gray-800 rounded p-2 font-mono text-xs">
                <code className="text-green-600">https://www.lanacion.com.ar/politica/titulo-articulo-nid...</code>
              </div>
            </div>

            <div>
              <p className="font-medium text-blue-900 dark:text-blue-100 mb-1">
                ✅ Reddit
              </p>
              <p className="text-blue-700 dark:text-blue-300 mb-1">
                URLs de subreddits o posts individuales:
              </p>
              <div className="bg-white dark:bg-gray-800 rounded p-2 font-mono text-xs space-y-1">
                <div>Subreddit: <code className="text-green-600">https://www.reddit.com/r/argentina</code></div>
                <div>Post: <code className="text-green-600">https://www.reddit.com/r/argentina/comments/...</code></div>
              </div>
            </div>

            <div>
              <p className="font-medium text-red-900 dark:text-red-100 mb-1">
                ❌ EVITAR: Páginas de Inicio
              </p>
              <p className="text-red-700 dark:text-red-300 mb-1">
                Estas URLs capturan metadata del sitio, no contenido de artículos:
              </p>
              <div className="bg-white dark:bg-gray-800 rounded p-2 font-mono text-xs space-y-1">
                <div><code className="text-red-600">https://www.lanacion.com.ar/</code> ❌</div>
                <div><code className="text-red-600">https://www.clarin.com/</code> ❌</div>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-blue-200 dark:border-blue-700">
            <p className="font-medium text-blue-900 dark:text-blue-100 text-xs">
              💡 Tip: Para encontrar RSS feeds, prueba agregar <code className="bg-white dark:bg-gray-800 px-1 rounded">/rss</code> o <code className="bg-white dark:bg-gray-800 px-1 rounded">/feed</code> al final de la URL del sitio.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
