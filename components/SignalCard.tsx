'use client';

import React from 'react';
import { TrendingUp, Minus, Clock, ExternalLink, FileText } from 'lucide-react';

export interface Signal {
  id: string;
  project_id: string;
  status: 'Accelerating' | 'Stabilizing' | 'New' | 'Archived';
  headline: string;
  summary: string;
  source_name: string | null;
  source_url: string | null;
  detected_at: string; // ISO timestamp
  momentum: 'high' | 'medium' | 'low';
  tags: string[];
  evidence_count?: number;
  created_at?: string;
}

// Helper function to format relative time in Spanish
function formatRelativeTime(isoString: string): string {
  const now = new Date();
  const then = new Date(isoString);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Ahora';
  if (diffMins < 60) return `Hace ${diffMins} min`;
  if (diffHours < 24) return `Hace ${diffHours} hora${diffHours !== 1 ? 's' : ''}`;
  if (diffDays < 7) return `Hace ${diffDays} día${diffDays !== 1 ? 's' : ''}`;
  return then.toLocaleDateString('es-ES');
}

interface SignalCardProps {
  signal: Signal;
  onClick: () => void;
}

export default function SignalCard({ signal, onClick }: SignalCardProps) {
  const isAccelerating = signal.status === 'Accelerating';
  const isNew = signal.status === 'New';

  return (
    <div
      onClick={onClick}
      className={`
        relative group cursor-pointer rounded-lg p-4 transition-all duration-200
        ${isAccelerating
          ? 'bg-black border-l border-signal-500 border-t border-r border-b border-gray-800 hover:border-l-4 hover:shadow-signal-500/20 hover:shadow-lg'
          : 'bg-gray-950 border border-gray-800 hover:border-2 hover:border-gray-600'
        }
      `}
    >
      {/* Status Badge */}
      <div className="flex items-center justify-between mb-3">
        <div
          className={`
            inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold tracking-wide
            ${isAccelerating
              ? 'bg-signal-500/10 text-signal-500 border border-signal-500/30'
              : isNew
                ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/30'
                : 'bg-gray-800 text-gray-400 border border-gray-700'
            }
          `}
        >
          {isAccelerating && <TrendingUp className="h-3 w-3" />}
          {(signal.status === 'Stabilizing' || isNew) && <Minus className="h-3 w-3" />}
          {isAccelerating ? 'ACELERANDO' : isNew ? 'NUEVO' : 'ESTABILIZADO'}
        </div>

        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <Clock className="h-3.5 w-3.5" />
          <span>{formatRelativeTime(signal.detected_at)}</span>
        </div>
      </div>

      {/* Headline */}
      <h3
        className={`
          text-lg font-semibold mb-2 line-clamp-2
          ${isAccelerating ? 'text-gray-300 group-hover:text-signal-100' : 'text-gray-200 group-hover:text-white'}
          transition-colors
        `}
      >
        {signal.headline}
      </h3>

      {/* Summary */}
      <p className="text-sm text-gray-400 mb-3 line-clamp-2">
        {signal.summary}
      </p>

      {/* Source and Evidence */}
      <div className="flex items-center justify-between pt-3 border-t border-gray-800">
        <div className="flex items-center gap-3">
          {signal.source_name && (
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <ExternalLink className="h-3.5 w-3.5" />
              <span className="truncate max-w-[150px]">{signal.source_name}</span>
            </div>
          )}
          {signal.evidence_count !== undefined && signal.evidence_count > 0 && (
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <FileText className="h-3.5 w-3.5" />
              <span>{signal.evidence_count} fuente{signal.evidence_count !== 1 ? 's' : ''}</span>
            </div>
          )}
        </div>

        {/* Momentum Indicator */}
        {isAccelerating && (
          <div className="flex gap-1">
            {[1, 2, 3].map((bar) => (
              <div
                key={bar}
                className={`w-1 rounded-full ${
                  signal.momentum === 'high'
                    ? 'h-4 bg-signal-500'
                    : bar <= 2 && signal.momentum === 'medium'
                    ? 'h-3 bg-signal-500'
                    : bar === 1 && signal.momentum === 'low'
                    ? 'h-2 bg-signal-500'
                    : 'h-2 bg-gray-700'
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Glow Effect for Accelerating */}
      {isAccelerating && (
        <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-signal-500/5 via-transparent to-transparent pointer-events-none" />
      )}
    </div>
  );
}
