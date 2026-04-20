// Metric labels, normalization helpers, and comparison helpers for the compare view.
// Keeping this logic isolated makes the chart data mapping easier to test and reuse.

import type { QueryMetrics } from "./types";

export type MetricKey = "time_total_s" | "relevance_score" | "source_coverage" | "word_count";

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

export const METRIC_TOOLTIP_TEXT: Record<string, string> = {
  relevance_score: "Độ tương đồng ngữ nghĩa giữa câu hỏi và câu trả lời.",
  source_coverage: "Tỷ lệ nguồn truy xuất hữu ích được dùng để tạo câu trả lời.",
  confidence_score: "Mức tự tin của hệ thống cho câu trả lời hiện tại (0-100%).",
  context_relevance: "Mức độ các đoạn được truy xuất thực sự liên quan đến câu hỏi.",
  context_recall: "Khả năng tìm đủ thông tin cần thiết trong kho tri thức.",
  context_precision: "Mức độ tài liệu liên quan được xếp hạng cao trong top-K.",
  faithfulness_groundedness: "Mức độ câu trả lời bám sát ngữ cảnh truy xuất, giảm hallucination.",
  answer_relevancy: "Mức độ câu trả lời giải quyết trực tiếp câu hỏi người dùng.",
  answer_correctness: "Mức độ đúng của câu trả lời so với đáp án chuẩn (ground truth/proxy).",
};

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
  const groups = metrics?.metric_groups?.retrieval_metrics;
  const rerankingAvg = groups?.reranking_summary?.avg;
  const fallbackPrecision = normalizeUnitScore(rerankingAvg) ?? normalizeUnitScore(metrics?.source_coverage);

  return {
    context_relevance: normalizeUnitScore(groups?.context_relevance) ?? normalizeUnitScore(metrics?.relevance_score),
    context_recall: normalizeUnitScore(groups?.context_recall) ?? normalizeUnitScore(metrics?.source_coverage),
    context_precision: normalizeUnitScore(groups?.context_precision) ?? fallbackPrecision,
  };
}

// Trích xuất nhóm điểm generator; answer_correctness có fallback trung bình khi thiếu dữ liệu trực tiếp.
export function readGeneratorScores(metrics: QueryMetrics | null | undefined): GeneratorScoreSet {
  const groups = metrics?.metric_groups?.generation_metrics;
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
