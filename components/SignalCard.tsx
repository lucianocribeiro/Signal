'use client';

import React from 'react';
import { AlertTriangle, ExternalLink, TrendingUp, Minus, Clock } from 'lucide-react';

export type RiskLevel = 'watch_closely' | 'monitor';

export interface Signal {
  id: string;
  project_id: string;
  headline: string;
  summary: string;
  key_points?: string[];
  status: 'Accelerating' | 'Stabilizing' | 'New' | 'Fading' | 'Archived';
  momentum: 'high' | 'medium' | 'low';
  risk_level?: RiskLevel;
  source_name: string | null;
  source_url: string | null;
  detected_at: string;
  tags: string[];
  evidence_count?: number;
  created_at?: string;
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Ahora';
  if (diffMins < 60) return `hace ${diffMins}m`;
  if (diffHours < 24) return `hace ${diffHours}h`;
  if (diffDays < 7) return `hace ${diffDays}d`;
  return date.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
}

interface SignalCardProps {
  signal: Signal;
  onClick: () => void;
}

export default function SignalCard({ signal, onClick }: SignalCardProps) {
  return (
    <div
      onClick={onClick}
      className={`bg-black border rounded-lg p-4 cursor-pointer transition-all hover:border-gray-600 ${
        signal.risk_level === 'watch_closely'
          ? 'border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.1)]'
          : 'border-gray-800'
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex flex-wrap gap-2">
          {signal.risk_level === 'watch_closely' && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-500 border border-red-500/20">
              <AlertTriangle className="h-3 w-3 mr-1" />
              ATENCION
            </span>
          )}

          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
              signal.status === 'Accelerating'
                ? 'bg-signal-500/10 text-signal-500 border border-signal-500/20'
                : signal.status === 'New'
                ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                : 'bg-gray-500/10 text-gray-400 border border-gray-500/20'
            }`}
          >
            {signal.status === 'Accelerating' && <TrendingUp className="h-3 w-3 mr-1" />}
            {signal.status === 'Stabilizing' && <Minus className="h-3 w-3 mr-1" />}
            {signal.status === 'New' && <Clock className="h-3 w-3 mr-1" />}
            {signal.status === 'Accelerating'
              ? 'ACELERANDO'
              : signal.status === 'Stabilizing'
              ? 'ESTABILIZADO'
              : signal.status === 'New'
              ? 'NUEVO'
              : signal.status.toUpperCase()}
          </span>
        </div>

        <span className="text-xs text-gray-500">{formatRelativeTime(signal.detected_at)}</span>
      </div>

      <h3 className="text-lg font-semibold text-white mb-2 line-clamp-2">
        {signal.headline}
      </h3>

      <p className="text-sm text-gray-400 mb-3 line-clamp-3">
        {signal.summary}
      </p>

      {signal.key_points && signal.key_points.length > 0 && (
        <div className="mb-3">
          <ul className="text-xs text-gray-500 space-y-1">
            {signal.key_points.slice(0, 2).map((point, index) => (
              <li key={index} className="flex items-start gap-2">
                <span className="text-signal-500 mt-0.5">•</span>
                <span className="line-clamp-1">{point}</span>
              </li>
            ))}
            {signal.key_points.length > 2 && (
              <li className="text-gray-600 italic">
                +{signal.key_points.length - 2} puntos mas...
              </li>
            )}
          </ul>
        </div>
      )}

      <div className="flex items-center justify-between pt-3 border-t border-gray-800">
        {signal.source_url ? (
          <a
            href={signal.source_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1 text-xs text-signal-500 hover:text-signal-400 transition-colors"
          >
            <ExternalLink className="h-3 w-3" />
            <span>{signal.source_name || 'Ver fuente'}</span>
          </a>
        ) : (
          <span className="text-xs text-gray-600">
            {signal.source_name || 'Fuente no disponible'}
          </span>
        )}

        {signal.evidence_count && signal.evidence_count > 0 && (
          <span className="text-xs text-gray-500">
            {signal.evidence_count} fuente{signal.evidence_count !== 1 ? 's' : ''}
          </span>
        )}
      </div>
    </div>
  );
}
