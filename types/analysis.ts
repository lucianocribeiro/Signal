/**
 * Analysis Type Definitions
 * Types for the Intelligence layer ("The Brain") data fetching and AI analysis
 */

/**
 * Raw ingestion data prepared for AI analysis
 * Combines raw_ingestions data with source context
 */
export interface RawIngestionForAnalysis {
  /** Ingestion ID */
  id: string;

  /** Source ID that this ingestion came from */
  source_id: string;

  /** The scraped text content */
  content: string;

  /** Original URL of the scraped content */
  url: string;

  /** Title of the scraped content */
  title: string;

  /** Timestamp when content was ingested */
  ingested_at: string;

  /** Platform type (e.g., 'x_twitter', 'reddit', 'news') */
  platform: string;

  /** Word count of the content */
  word_count: number;

  /** Content hash for deduplication tracking */
  content_hash?: string;

  /** Source information */
  source: {
    /** Source name/display name */
    name: string;
    /** Source URL */
    url: string;
    /** Platform type */
    platform: string;
  };

  /** Additional metadata from scraping operation */
  metadata?: {
    extractionMethod?: string;
    selectorsFound?: string[];
    scrolled?: boolean;
    [key: string]: any;
  };
}

/**
 * Project analysis context for AI guidance
 * Contains project-level information to guide AI signal detection
 */
export interface ProjectAnalysisContext {
  /** Project ID */
  id: string;

  /** Project name */
  name: string;

  /** AI instructions for signal detection specific to this project */
  signal_instructions: string | null;

  /** Active sources for this project */
  sources: Array<{
    id: string;
    name: string;
    platform: string;
    url: string;
  }>;
}

/**
 * Statistics about the fetched data
 */
export interface AnalysisDataStats {
  /** Total number of unprocessed ingestions */
  total_items: number;

  /** Start of time range (oldest ingestion) */
  time_range_start: string | null;

  /** End of time range (newest ingestion) */
  time_range_end: string | null;

  /** Hours of data included */
  hours_included: number;

  /** Breakdown by platform */
  platforms: Record<string, number>;
}

/**
 * Complete API response for analysis data
 */
export interface AnalysisDataResponse {
  /** Success status */
  success: boolean;

  /** Array of raw ingestions ready for AI analysis */
  ingestions: RawIngestionForAnalysis[];

  /** Project context for AI guidance */
  project: ProjectAnalysisContext;

  /** Statistics about the data */
  stats: AnalysisDataStats;

  /** Error message (if success is false) */
  error?: string;
}

/**
 * Database row type for raw_ingestions with joined source data
 */
export interface RawIngestionRow {
  id: string;
  source_id: string;
  raw_data: {
    text: string;
    title: string;
    url: string;
    wordCount: number;
    platform: string;
    scrapedAt: string;
  };
  ingested_at: string;
  metadata: {
    contentHash?: string;
    extractionMethod?: string;
    selectorsFound?: string[];
    scrolled?: boolean;
    [key: string]: any;
  };
  sources: {
    name: string;
    url: string;
    platform: string;
  };
}

/**
 * Database row type for projects with sources
 */
export interface ProjectRow {
  id: string;
  name: string;
  signal_instructions: string | null;
  sources: Array<{
    id: string;
    name: string;
    platform: string;
    url: string;
    is_active: boolean;
  }>;
}

/**
 * Signal status types (matches database ENUM)
 */
export type SignalStatus = 'New' | 'Accelerating' | 'Stabilizing' | 'Archived';

/**
 * Signal momentum types (matches database ENUM)
 */
export type SignalMomentum = 'high' | 'medium' | 'low';

/**
 * Detected signal from AI analysis
 * Matches the output format expected from Gemini
 */
export interface DetectedSignal {
  /** Clear, concise headline (max 100 chars) */
  headline: string;

  /** 2-3 sentence summary of the signal */
  summary: string;

  /** Array of source URLs where this signal was found */
  sources: string[];

  /** Array of raw_ingestion IDs that support this signal */
  raw_ingestion_ids: string[];

  /** Suggested initial status */
  suggested_status: SignalStatus;

  /** Suggested momentum level */
  suggested_momentum: SignalMomentum;

  /** Relevant keywords/tags */
  tags: string[];
}

/**
 * AI response from signal detection
 */
export interface AISignalDetectionResponse {
  /** Array of detected signals */
  signals: DetectedSignal[];

  /** Brief notes about the analysis */
  analysis_notes: string;
}

/**
 * Created signal record from database
 */
export interface CreatedSignal {
  /** Signal ID */
  id: string;

  /** Project ID */
  project_id: string;

  /** Signal headline */
  headline: string;

  /** Signal summary */
  summary: string;

  /** Status */
  status: SignalStatus;

  /** Momentum */
  momentum: SignalMomentum;

  /** Tags */
  tags: string[];

  /** When detected */
  detected_at: string;

  /** Metadata (includes supporting evidence) */
  metadata: {
    raw_ingestion_ids: string[];
    sources: string[];
    ai_model: string;
    [key: string]: any;
  };
}

/**
 * Result of signal detection operation
 */
export interface SignalDetectionResult {
  /** Success status */
  success: boolean;

  /** Number of ingestions analyzed */
  ingestions_analyzed: number;

  /** Number of signals detected */
  signals_detected: number;

  /** Created signal records */
  signals: CreatedSignal[];

  /** Token usage statistics */
  token_usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    estimated_cost: number;
  };

  /** AI analysis notes */
  analysis_notes: string;

  /** Error message (if success is false) */
  error?: string;
}

/**
 * Usage log entry
 */
export interface UsageLogEntry {
  /** Log ID */
  id: string;

  /** Project ID */
  project_id: string;

  /** Action type (e.g., 'signal_detection') */
  action_type: string;

  /** AI model used */
  model: string;

  /** Input tokens */
  prompt_tokens: number;

  /** Output tokens */
  completion_tokens: number;

  /** Total tokens */
  total_tokens: number;

  /** Estimated cost in USD */
  estimated_cost: number;

  /** Additional metadata */
  metadata: Record<string, any>;

  /** When logged */
  created_at: string;
}

// ============================================================================
// MOMENTUM ANALYSIS TYPES (Story 4.3)
// ============================================================================

/**
 * Signal data formatted for momentum analysis
 * Includes current status and momentum for comparison
 */
export interface SignalForMomentumAnalysis {
  /** Signal ID */
  id: string;

  /** Signal headline */
  headline: string;

  /** Signal summary */
  summary: string;

  /** Current status */
  status: SignalStatus;

  /** Current momentum level */
  momentum: SignalMomentum;

  /** When signal was first detected */
  detected_at: string;

  /** Signal tags */
  tags: string[];
}

/**
 * Single momentum update from AI analysis
 */
export interface MomentumUpdate {
  /** Signal ID to update */
  signal_id: string;

  /** New status after momentum analysis */
  new_status: 'Accelerating' | 'Stabilizing';

  /** New momentum level */
  new_momentum: 'high' | 'medium' | 'low';

  /** Reason for the momentum change */
  reason: string;

  /** Ingestion IDs that support this update */
  supporting_ingestion_ids: string[];
}

/**
 * AI response from momentum analysis
 */
export interface AIMomentumAnalysisResponse {
  /** Array of signal updates with momentum changes */
  signal_updates: MomentumUpdate[];

  /** IDs of signals that remained unchanged */
  unchanged_signals: string[];

  /** Brief notes about the momentum analysis */
  analysis_notes: string;
}

/**
 * Updated signal record with before/after comparison
 */
export interface UpdatedSignal {
  /** Signal ID */
  id: string;

  /** Signal headline */
  headline: string;

  /** Previous status */
  old_status: SignalStatus;

  /** New status */
  new_status: SignalStatus;

  /** Previous momentum */
  old_momentum: SignalMomentum;

  /** New momentum */
  new_momentum: SignalMomentum;

  /** Reason for the change */
  reason: string;

  /** When updated */
  updated_at: string;
}

/**
 * Result of momentum analysis operation
 */
export interface MomentumAnalysisResult {
  /** Success status */
  success: boolean;

  /** Number of signals analyzed */
  signals_analyzed: number;

  /** Number of signals updated */
  signals_updated: number;

  /** Number of signals unchanged */
  signals_unchanged: number;

  /** Updated signal records */
  updated_signals: UpdatedSignal[];

  /** Token usage statistics */
  token_usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    estimated_cost: number;
  };

  /** AI analysis notes */
  analysis_notes: string;

  /** Error message (if success is false) */
  error?: string;
}

/**
 * Result of full analysis pipeline (detection + momentum)
 */
export interface FullAnalysisResult {
  /** Success status */
  success: boolean;

  /** Results from signal detection */
  new_signals: {
    /** Number of new signals created */
    count: number;
    /** Created signal records */
    signals: CreatedSignal[];
    /** Number of ingestions analyzed */
    ingestions_analyzed: number;
  };

  /** Results from momentum analysis */
  momentum_updates: {
    /** Number of signals updated */
    count: number;
    /** Updated signal records */
    updated_signals: UpdatedSignal[];
    /** Number of signals unchanged */
    unchanged_count: number;
  };

  /** Combined token usage */
  token_usage: {
    /** Token usage from detection */
    detection: {
      prompt_tokens: number;
      completion_tokens: number;
      total_tokens: number;
      estimated_cost: number;
    };
    /** Token usage from momentum */
    momentum: {
      prompt_tokens: number;
      completion_tokens: number;
      total_tokens: number;
      estimated_cost: number;
    };
    /** Total combined usage */
    total: {
      prompt_tokens: number;
      completion_tokens: number;
      total_tokens: number;
      estimated_cost: number;
    };
  };

  /** Error message (if partial or complete failure) */
  error?: string;
}

/**
 * Momentum history entry stored in signal metadata
 * Tracks the evolution of a signal's momentum over time
 */
export interface MomentumHistoryEntry {
  /** When this momentum check occurred */
  checked_at: string;

  /** Status before this check */
  previous_status: SignalStatus;

  /** Status after this check */
  new_status: SignalStatus;

  /** Momentum before this check */
  previous_momentum: SignalMomentum;

  /** Momentum after this check */
  new_momentum: SignalMomentum;

  /** Reason for the change */
  reason: string;

  /** Ingestions that supported this change */
  supporting_ingestion_ids: string[];

  /** Number of pieces of evidence */
  evidence_count: number;
}
