// Metric labels, normalization helpers, and comparison helpers for the compare view.
// Keeping this logic isolated makes the chart data mapping easier to test and reuse.

import type { QueryMetrics } from "./types";

export type MetricKey = "time_total_s" | "relevance_score" | "source_coverage" | "word_count" | "retrieved_chunk_count" | "retrieved_source_count" | "confidence_score" | "answer_tokens";

export interface ChartMetricDatum {
  metric: string;
  model: string;
  score: number;
  description: string;
}

export interface RetrieverScoreSet {
  context_relevance: number | null;
  context_recall: number | null;
  context_precision: number | null;
}

export interface GeneratorScoreSet {
  faithfulness_groundedness: number | null;
  answer_relevancy: number | null;
  answer_correctness: number | null;
}

export interface LatencyBreakdownEntry {
  key: string;
  label: string;
  seconds: number;
}

export const BENCHMARK_TUNING_PRESET = {
  pac_chunk_config: {
    parent_chunk_size: 1024,
    parent_chunk_overlap: 50,
    child_chunk_size: 128,
    child_chunk_overlap: 50,
  },
  graph_chunk_reference: {
    graph_chunk_size: 800,
    graph_chunk_overlap: 100,
  },
  retrieval_ensemble: {
    strategy: "Ensemble",
    weight_bm25: 0.5,
    avg_point_recall: 0.85,
    avg_latency_s: 0.9029,
  },
  summary_baseline: {
    pac_avg_latency_s: 45.27,
    graph_avg_latency_s: 30.58,
    pac_point_recall: 0.9,
    graph_point_recall: 0.6167,
  },
  recommended_reranking_enabled: true,
} as const;

export const METRIC_TOOLTIP_TEXT: Record<string, string> = {
  relevance_score: "Độ tương đồng ngữ nghĩa giữa câu hỏi và câu trả lời.",
  source_coverage: "Tỷ lệ nguồn truy xuất hữu ích được dùng để tạo câu trả lời.",
  confidence_score: "Mức tự tin của hệ thống cho câu trả lời hiện tại (0-100%).",
  retrieved_chunk_count: "Số lượng đoạn văn bản được truy xuất từ kho tri thức.",
  retrieved_source_count: "Số lượng nguồn tài liệu khác nhau được truy xuất.",
  source_diversity: "Mức độ đa dạng của các nguồn được truy xuất (PaCRAG).",
  doc_passage_count: "Số lượng đoạn văn bản được xử lý (GraphRAG).",
  entity_count: "Số lượng thực thể được trích xuất từ đồ thị tri thức (GraphRAG).",
  graph_fact_count: "Số lượng sự kiện được truy xuất từ đồ thị tri thức (GraphRAG).",
  source_count: "Tổng số nguồn tài liệu có sẵn trong hệ thống (GraphRAG).",
  context_relevance: "Mức độ các đoạn được truy xuất thực sự liên quan đến câu hỏi.",
  context_recall: "Khả năng tìm đủ thông tin cần thiết trong kho tri thức.",
  context_precision: "Mức độ tài liệu liên quan được xếp hạng cao trong top-K.",
  faithfulness_groundedness: "Mức độ câu trả lời bám sát ngữ cảnh truy xuất, giảm hallucination.",
  answer_relevancy: "Mức độ câu trả lời giải quyết trực tiếp câu hỏi người dùng.",
  answer_correctness: "Mức độ đúng của câu trả lời so với đáp án chuẩn (ground truth/proxy).",
  time_total_s: "Tổng thời gian xử lý câu hỏi (giây).",
  answer_tokens: "Số lượng token trong câu trả lời được tạo.",
  word_count: "Số lượng từ trong câu trả lời được tạo.",
  latency_breakdown: "Phân rã thời gian xử lý theo từng công đoạn pipeline.",
};

function parseOptionalJsonObject(raw: unknown): Record<string, unknown> | null {
  if (raw == null) return null;
  if (typeof raw === "object") {
    return raw as Record<string, unknown>;
  }
  if (typeof raw !== "string" || !raw.trim()) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function readMetricGroups(metrics: QueryMetrics | null | undefined): Record<string, unknown> | null {
  const direct = parseOptionalJsonObject(metrics?.metric_groups);
  if (direct) return direct;
  return parseOptionalJsonObject(metrics?.metric_groups_json);
}

// Trả về mô tả hiển thị tương ứng với khóa metric để dùng trong tooltip/chart.
export function metricDescription(metricKey: string) {
  return METRIC_TOOLTIP_TEXT[metricKey] || "";
}

// Chuẩn hóa điểm metric về thang 0..1 từ nhiều kiểu dữ liệu đầu vào (1, 10, 100).
export function normalizeUnitScore(value: unknown): number | null {
  if (typeof value !== "number" || Number.isNaN(value)) return null;
  if (value <= 0) return 0;
  if (value <= 1) return value;
  if (value <= 10) return value / 10;
  if (value <= 100) return value / 100;
  return 1;
}

// Trích xuất nhóm điểm retriever và tự fallback về field legacy nếu backend chưa trả metric_groups.
export function readRetrieverScores(metrics: QueryMetrics | null | undefined): RetrieverScoreSet {
  const groups = (readMetricGroups(metrics)?.retrieval_metrics as Record<string, unknown> | undefined) || undefined;
  const rerankingSummary = parseOptionalJsonObject(groups?.reranking_summary);
  const rerankingAvg = rerankingSummary?.avg;
  const fallbackPrecision = normalizeUnitScore(rerankingAvg) ?? normalizeUnitScore(metrics?.source_coverage);

  return {
    context_relevance: normalizeUnitScore(groups?.context_relevance) ?? normalizeUnitScore(metrics?.relevance_score),
    context_recall: normalizeUnitScore(groups?.context_recall) ?? normalizeUnitScore(metrics?.source_coverage),
    context_precision: normalizeUnitScore(groups?.context_precision) ?? fallbackPrecision,
  };
}

// Trích xuất các metrics bổ sung từ evaluation results
export function readSystemMetrics(metrics: QueryMetrics | null | undefined) {
  const groups = readMetricGroups(metrics);
  const systemMetrics = (groups?.system_metrics as Record<string, unknown> | undefined) || undefined;
  const graphMetrics = (groups?.graph_metrics as Record<string, unknown> | undefined) || undefined;
  const retrievalMetrics = (groups?.retrieval_metrics as Record<string, unknown> | undefined) || undefined;
  
  return {
    // System metrics (có trong cả PaCRAG và GraphRAG)
    time_total_s: systemMetrics?.time_total_s ?? metrics?.time_total_s,
    answer_tokens: systemMetrics?.answer_tokens ?? metrics?.answer_tokens,
    word_count: systemMetrics?.word_count ?? metrics?.word_count,
    
    // Retrieval metrics
    retrieved_chunk_count: metrics?.retrieved_chunk_count,
    retrieved_source_count: metrics?.retrieved_source_count,
    source_diversity: retrievalMetrics?.source_diversity,
    
    // Graph-specific metrics (chỉ có trong GraphRAG)
    doc_passage_count: graphMetrics?.doc_passage_count,
    entity_count: graphMetrics?.entity_count,
    graph_fact_count: graphMetrics?.graph_fact_count,
    source_count: graphMetrics?.source_count,
    
    // Legacy metrics
    confidence_score: metrics?.confidence_score,
    relevance_score: metrics?.relevance_score,
    source_coverage: metrics?.source_coverage,
  };
}

// Trích xuất nhóm điểm generator; answer_correctness có fallback trung bình khi thiếu dữ liệu trực tiếp.
export function readGeneratorScores(metrics: QueryMetrics | null | undefined): GeneratorScoreSet {
  const groups = (readMetricGroups(metrics)?.generation_metrics as Record<string, unknown> | undefined) || undefined;
  const faithfulness =
    normalizeUnitScore(groups?.faithfulness_groundedness) ??
    normalizeUnitScore(groups?.faithfulness_proxy) ??
    normalizeUnitScore(metrics?.confidence_score);
  const answerRelevancy =
    normalizeUnitScore(groups?.answer_relevancy) ??
    normalizeUnitScore(groups?.answer_relevance_proxy) ??
    normalizeUnitScore(metrics?.relevance_score);
  const answerCorrectness =
    normalizeUnitScore(groups?.answer_correctness) ??
    (faithfulness != null && answerRelevancy != null ? (faithfulness + answerRelevancy) / 2 : null);

  return {
    faithfulness_groundedness: faithfulness,
    answer_relevancy: answerRelevancy,
    answer_correctness: answerCorrectness,
  };
}

export function readLatencyBreakdown(metrics: QueryMetrics | null | undefined): LatencyBreakdownEntry[] {
  const groups = readMetricGroups(metrics);
  const fromGroups = parseOptionalJsonObject(groups?.latency_breakdown);
  const fromField = parseOptionalJsonObject((metrics as QueryMetrics & { latency_breakdown?: unknown } | null | undefined)?.latency_breakdown);
  const fromLegacyJson = parseOptionalJsonObject(metrics?.latency_breakdown_json);
  const source = fromGroups || fromField || fromLegacyJson;

  if (!source) return [];

  return Object.entries(source)
    .map(([key, value]) => ({
      key,
      label: key.replaceAll("+", " + ").replaceAll("_", " "),
      seconds: typeof value === "number" ? value : Number(value),
    }))
    .filter((item) => Number.isFinite(item.seconds) && item.seconds >= 0)
    .sort((a, b) => b.seconds - a.seconds);
}

// Biến đổi điểm retriever của 2 hệ (PaCRAG/GraphRAG) thành dataset dùng trực tiếp cho biểu đồ nhóm cột.
export function buildRetrieverChartData(
  pacMetrics: QueryMetrics | null | undefined,
  graphMetrics: QueryMetrics | null | undefined
): ChartMetricDatum[] {
  const pac = readRetrieverScores(pacMetrics);
  const graph = readRetrieverScores(graphMetrics);

  const rows = [
    { metric: "Context Relevance", metricKey: "context_relevance", model: "PaCRAG", score: pac.context_relevance },
    { metric: "Context Relevance", metricKey: "context_relevance", model: "GraphRAG", score: graph.context_relevance },
    { metric: "Context Recall", metricKey: "context_recall", model: "PaCRAG", score: pac.context_recall },
    { metric: "Context Recall", metricKey: "context_recall", model: "GraphRAG", score: graph.context_recall },
    { metric: "Context Precision", metricKey: "context_precision", model: "PaCRAG", score: pac.context_precision },
    { metric: "Context Precision", metricKey: "context_precision", model: "GraphRAG", score: graph.context_precision },
  ];

  return rows
    .filter((row): row is { metric: string; metricKey: string; model: string; score: number } => row.score != null)
    .map((row) => ({
      metric: row.metric,
      model: row.model,
      score: Number((row.score * 100).toFixed(2)),
      description: metricDescription(row.metricKey),
    }));
}

// Biến đổi điểm generator của 2 hệ (PaCRAG/GraphRAG) thành dataset dùng trực tiếp cho biểu đồ nhóm cột.
export function buildGeneratorChartData(
  pacMetrics: QueryMetrics | null | undefined,
  graphMetrics: QueryMetrics | null | undefined
): ChartMetricDatum[] {
  const pac = readGeneratorScores(pacMetrics);
  const graph = readGeneratorScores(graphMetrics);

  const rows = [
    { metric: "Faithfulness", metricKey: "faithfulness_groundedness", model: "PaCRAG", score: pac.faithfulness_groundedness },
    { metric: "Faithfulness", metricKey: "faithfulness_groundedness", model: "GraphRAG", score: graph.faithfulness_groundedness },
    { metric: "Answer Relevancy", metricKey: "answer_relevancy", model: "PaCRAG", score: pac.answer_relevancy },
    { metric: "Answer Relevancy", metricKey: "answer_relevancy", model: "GraphRAG", score: graph.answer_relevancy },
    { metric: "Answer Correctness", metricKey: "answer_correctness", model: "PaCRAG", score: pac.answer_correctness },
    { metric: "Answer Correctness", metricKey: "answer_correctness", model: "GraphRAG", score: graph.answer_correctness },
  ];

  return rows
    .filter((row): row is { metric: string; metricKey: string; model: string; score: number } => row.score != null)
    .map((row) => ({
      metric: row.metric,
      model: row.model,
      score: Number((row.score * 100).toFixed(2)),
      description: metricDescription(row.metricKey),
    }));
}

// So sánh metric giữa 2 hệ theo quy tắc từng loại chỉ số để hiển thị badge "tốt hơn".
// - time_total_s: thấp hơn là tốt hơn.
// - retrieved_chunk_count, retrieved_source_count, answer_tokens, word_count: cao hơn là tốt hơn.
// - Các metric còn lại: cao hơn là tốt hơn.
export function isBetter(
  metric: MetricKey,
  side: "pac" | "graph",
  pac: QueryMetrics | null | undefined,
  graph: QueryMetrics | null | undefined
): boolean {
  const pacVal = pac?.[metric] ?? null;
  const graphVal = graph?.[metric] ?? null;
  if (pacVal === null || graphVal === null) return false;
  if (pacVal === graphVal) return false;
  // time_total_s: thấp hơn là tốt hơn.
  if (metric === "time_total_s") {
    return side === "pac" ? pacVal < graphVal : graphVal < pacVal;
  }
  // Các metric còn lại: cao hơn là tốt hơn.
  return side === "pac" ? pacVal > graphVal : graphVal > pacVal;
}
