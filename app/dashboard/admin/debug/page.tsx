'use client';

import { useState, useEffect } from 'react';
import { Bug, RefreshCw, Database, Clock, Link as LinkIcon } from 'lucide-react';

interface ScrapeResult {
  id: string;
  url: string;
  platform: string;
  source_name: string;
  scraped_at: string;
  has_content: boolean;
  content_length: number;
  processed: boolean;
  has_error: boolean;
  error_message?: string;
}

interface ScrapeStatusResponse {
  total_results: number;
  recent_scrapes: ScrapeResult[];
}

export default function DebugPage() {
  const [data, setData] = useState<ScrapeStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/debug/scrape-status');
      if (!response.ok) {
        throw new Error('Failed to fetch scrape status');
      }
      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Bug className="h-8 w-8 text-signal-500" />
          <h1 className="text-3xl font-bold text-gray-100">Debug Dashboard</h1>
        </div>
        <p className="text-gray-400">System diagnostics and scrape status monitoring</p>
      </div>

      {/* Scrape Status Card */}
      <div className="bg-gray-950 border border-gray-800 rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Database className="h-6 w-6 text-signal-500" />
            <h2 className="text-xl font-semibold text-gray-100">Scrape Results Status</h2>
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-signal-500 hover:bg-signal-600 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-950/20 border border-red-900/30 rounded-lg">
            <p className="text-red-400">Error: {error}</p>
          </div>
        )}

        {data && (
          <>
            {/* Summary */}
            <div className="mb-6 p-4 bg-gray-900 rounded-lg">
              <p className="text-gray-400">
                Total recent results: <span className="text-signal-500 font-semibold">{data.total_results}</span>
              </p>
            </div>

            {/* Results Table */}
            {data.recent_scrapes && data.recent_scrapes.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-800">
                      <th className="text-left py-3 px-4 text-gray-400 font-medium">Source</th>
                      <th className="text-left py-3 px-4 text-gray-400 font-medium">Platform</th>
                      <th className="text-left py-3 px-4 text-gray-400 font-medium">Ingested At</th>
                      <th className="text-left py-3 px-4 text-gray-400 font-medium">Status</th>
                      <th className="text-right py-3 px-4 text-gray-400 font-medium">Data Size</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recent_scrapes.map((scrape) => (
                      <tr key={scrape.id} className="border-b border-gray-800 hover:bg-gray-900/50">
                        <td className="py-3 px-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <LinkIcon className="h-4 w-4 text-gray-500 flex-shrink-0" />
                              <span className="text-gray-200 font-medium">{scrape.source_name}</span>
                            </div>
                            {scrape.url !== 'N/A' && (
                              <a
                                href={scrape.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-signal-500 hover:text-signal-400 truncate block max-w-md ml-6"
                              >
                                {scrape.url}
                              </a>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-800 text-gray-300">
                            {scrape.platform}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2 text-gray-400">
                            <Clock className="h-4 w-4" />
                            <span className="text-sm">
                              {new Date(scrape.scraped_at).toLocaleString()}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex flex-col gap-1">
                            <span
                              className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium w-fit ${
                                scrape.processed
                                  ? 'bg-blue-950/20 text-blue-400 border border-blue-900/30'
                                  : 'bg-yellow-950/20 text-yellow-400 border border-yellow-900/30'
                              }`}
                            >
                              {scrape.processed ? 'Processed' : 'Pending'}
                            </span>
                            {scrape.has_error && (
                              <span
                                className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-red-950/20 text-red-400 border border-red-900/30 w-fit"
                                title={scrape.error_message}
                              >
                                Error
                              </span>
                            )}
                            {scrape.has_content && (
                              <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-950/20 text-green-400 border border-green-900/30 w-fit">
                                Has Data
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right text-gray-300">
                          {scrape.content_length > 0 ? (
                            <span>{scrape.content_length.toLocaleString()} chars</span>
                          ) : (
                            <span className="text-gray-500">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12">
                <Database className="h-12 w-12 text-gray-700 mx-auto mb-3" />
                <p className="text-gray-500">No scrape results found</p>
              </div>
            )}
          </>
        )}

        {loading && !data && (
          <div className="text-center py-12">
            <RefreshCw className="h-12 w-12 text-gray-700 mx-auto mb-3 animate-spin" />
            <p className="text-gray-500">Loading scrape status...</p>
          </div>
        )}
      </div>
    </div>
  );
}
