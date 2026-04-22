// Shared chat contracts for the user portal chat feature.
// Keep this file limited to data shapes so the UI and service layers can depend on it safely.

export interface Message {
  id: string;
  sender_id: string;
  content: string;
  created_at?: string;
  conversation_key?: string;
  role?: "user" | "ai";
}

export interface TypingState {
  isTyping: boolean;
  sender_id?: string;
}

export interface WebSocketHookReturn {
  isConnected: boolean;
  typingState: TypingState;
  sendMessage: (content: string) => void;
}

export interface ChatModeToggleProps {
  mode: "ai" | "chat";
  onToggle: () => void;
  disabled?: boolean;
}

export interface ChatState {
  response: string;
  isStreaming: boolean;
  error: string | null;
}

export interface RetrievedPassage {
  content: string;
  filename: string;
  pages: number[];
}

export interface QueryMetrics {
  answer?: string;
  time_total_s?: number | null;
  answer_tokens?: number | null;
  word_count?: number | null;
  relevance_score?: number | null;
  source_coverage?: number | null;
  retrieved_chunk_count?: number | null;
  retrieved_source_count?: number | null; // Added from evaluation results
  retrieved_chunks?: RetrievedPassage[];
  doc_passages?: RetrievedPassage[];
  sources?: { filename: string; pages: number[] }[];
  confidence_score?: number | null;
  reranking_scores?: number[] | null;
  reranking_time_s?: number | null;
  latency_breakdown_json?: string | null; // Added from evaluation results
  metric_groups_json?: string | null; // Added from evaluation results
  metric_groups?: {
    retrieval_metrics?: {
      context_relevance?: number | null;
      context_recall?: number | null;
      context_precision?: number | null;
      source_coverage?: number | null;
      source_diversity?: number | null; // Added from PaCRAG evaluation
      reranking_summary?: {
        avg?: number | null;
      } | null;
    };
    generation_metrics?: {
      faithfulness_groundedness?: number | null;
      answer_relevancy?: number | null;
      answer_correctness?: number | null;
      faithfulness_proxy?: number | null;
      answer_relevance_proxy?: number | null;
    };
    graph_metrics?: {
      doc_passage_count?: number | null; // Added from GraphRAG evaluation
      entity_count?: number | null; // Added from GraphRAG evaluation
      graph_fact_count?: number | null; // Added from GraphRAG evaluation
      source_count?: number | null; // Added from GraphRAG evaluation
    };
    system_metrics?: {
      answer_tokens?: number | null; // Added from evaluation results
      time_total_s?: number | null; // Added from evaluation results
      word_count?: number | null; // Added from evaluation results
    };
  };
}

export interface CitationModalState {
  open: boolean;
  passage: RetrievedPassage | null;
  query: string;
}

export type CompareTab = "metrics" | "sources";

export interface CompareRunIngest {
  time_total_s?: number | null;
  parent_chunks?: number | null;
  child_chunks?: number | null;
  chunks?: number | null;
  sections?: number | null;
  entities?: number | null;
  relations?: number | null;
}

// Unified compare payload used across table, detail card, and chart tabs.
export interface CompareRun {
  id: string;
  query_text?: string;
  file_name?: string;
  created_at?: string;
  pac_ingest?: CompareRunIngest | null;
  graphrag_ingest?: CompareRunIngest | null;
  pac_query?: QueryMetrics | null;
  graphrag_query?: QueryMetrics | null;
}
