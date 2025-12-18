'use client';

import React from 'react';
import { TrendingUp, Minus, Clock, ExternalLink } from 'lucide-react';

export interface Signal {
  id: string;
  status: 'Accelerating' | 'Stabilizing' | 'New';
  headline: string;
  summary: string;
  source: string;
  sourceUrl: string;
  detectedAt: string;
  momentum: 'high' | 'medium' | 'low';
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
          <span>{signal.detectedAt}</span>
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

      {/* Source */}
      <div className="flex items-center justify-between pt-3 border-t border-gray-800">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <ExternalLink className="h-3.5 w-3.5" />
          <span className="truncate max-w-[200px]">{signal.source}</span>
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
