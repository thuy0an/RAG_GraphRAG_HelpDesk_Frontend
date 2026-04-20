import { Spin } from "antd";
import {
  ConfidenceBadge,
  MetricLabelWithTooltip,
  MetricRow,
} from "../../presentation";
import { METRIC_EXPLANATION_ITEMS } from "../../copy";
import {
  isBetter,
  METRIC_TOOLTIP_TEXT,
  type ChartMetricDatum,
} from "../../metrics";
import type { CompareRun, CompareTab, RetrievedPassage } from "../../types";
import { GeneratorMetricsChart } from "./GeneratorMetricsChart";
import { RetrieverMetricsChart } from "./RetrieverMetricsChart";

export interface CompareResultTabsProps {
  activeRun: CompareRun;
  isComparingQuery: boolean;
  compareTab: CompareTab;
  onCompareTabChange: (tab: CompareTab) => void;
  retrieverChartData: ChartMetricDatum[];
  generatorChartData: ChartMetricDatum[];
  lastQuery: string;
  onOpenCitation: (passage: RetrievedPassage, query: string) => void;
}

// Gom passages theo tên file để nguồn cùng tài liệu được nhóm lại khi hiển thị.
function groupPassagesByFilename(passages: RetrievedPassage[]): Array<[string, RetrievedPassage[]]> {
  const grouped = new Map<string, RetrievedPassage[]>();
  passages.forEach((passage) => {
    const key = passage.filename || "Không rõ";
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)?.push(passage);
  });
  return Array.from(grouped.entries());
}

// Render nội dung tab compare (metrics/sources) cho run đang active.
// Component này nhận full dữ liệu qua props để giữ nguyên tắc phụ thuộc abstraction từ parent.
export function CompareResultTabs(props: CompareResultTabsProps) {
  const {
    activeRun,
    isComparingQuery,
    compareTab,
    onCompareTabChange,
    retrieverChartData,
    generatorChartData,
    lastQuery,
    onOpenCitation,
  } = props;

  return (
    <>
      <div className="flex border-b border-gray-100 text-xs">
        {(["metrics", "sources"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => onCompareTabChange(tab)}
            className={`flex-1 py-2 font-medium transition-colors ${
              compareTab === tab
                ? "text-blue-600 border-b-2 border-blue-500 bg-white"
                : "text-gray-500 hover:text-gray-700 bg-gray-50"
            }`}
          >
            {tab === "metrics" ? "📊 Metrics" : "📎 Nguồn"}
          </button>
        ))}
      </div>

      <div className="p-3">
        {compareTab === "metrics" && (
          <div className="space-y-3 text-xs">
            {!activeRun.pac_query && !activeRun.graphrag_query && !isComparingQuery && (
              <div className="flex flex-col items-center py-6 text-gray-400 gap-1">
                <div className="text-xl">💬</div>
                <div className="font-medium text-sm">Chưa có kết quả query</div>
                <div className="text-[11px] text-center">Gửi câu hỏi ở trên để xem metrics so sánh</div>
              </div>
            )}
            {isComparingQuery && (
              <div className="flex items-center justify-center gap-2 py-4 text-blue-500">
                <Spin size="small" />
                <span>Đang chạy query trên cả hai hệ thống...</span>
              </div>
            )}
            {(activeRun.pac_query || activeRun.graphrag_query) && !isComparingQuery && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className="w-2 h-2 rounded-full bg-blue-500 inline-block"></span>
                      <span className="font-semibold text-blue-600">PaCRAG</span>
                      {activeRun.pac_query && (
                        <span className="ml-auto text-[10px] text-gray-400">{activeRun.pac_query.retrieved_chunk_count ?? 0} chunks</span>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <MetricRow label="Thời gian" value={activeRun.pac_query?.time_total_s != null ? `${activeRun.pac_query.time_total_s}s` : null} better={isBetter("time_total_s", "pac", activeRun.pac_query, activeRun.graphrag_query)} />
                      <MetricRow label="Tokens" value={activeRun.pac_query?.answer_tokens != null ? String(activeRun.pac_query.answer_tokens) : null} />
                      <MetricRow label="Số từ" value={activeRun.pac_query?.word_count != null ? String(activeRun.pac_query.word_count) : null} better={isBetter("word_count", "pac", activeRun.pac_query, activeRun.graphrag_query)} />
                      <MetricRow label="Relevance" labelTooltipText={METRIC_TOOLTIP_TEXT.relevance_score} value={activeRun.pac_query?.relevance_score != null ? activeRun.pac_query.relevance_score.toFixed(4) : null} better={isBetter("relevance_score", "pac", activeRun.pac_query, activeRun.graphrag_query)} />
                      <MetricRow label="Coverage" labelTooltipText={METRIC_TOOLTIP_TEXT.source_coverage} value={activeRun.pac_query?.source_coverage != null ? `${(activeRun.pac_query.source_coverage * 100).toFixed(1)}%` : null} better={isBetter("source_coverage", "pac", activeRun.pac_query, activeRun.graphrag_query)} />
                      <div className="flex items-center justify-between py-0.5">
                        <MetricLabelWithTooltip label="Confidence" tooltipText={METRIC_TOOLTIP_TEXT.confidence_score} />
                        <ConfidenceBadge score={activeRun.pac_query?.confidence_score} />
                      </div>
                      {activeRun.pac_query?.reranking_scores && activeRun.pac_query.reranking_scores.length > 0 && (
                        <div className="mt-1 pt-1 border-t border-gray-100">
                          <div className="text-gray-400 mb-0.5">Re-ranking scores</div>
                          <div className="flex flex-wrap gap-1">
                            {activeRun.pac_query.reranking_scores.map((s: number, i: number) => (
                              <span key={i} className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${s >= 7 ? "bg-green-100 text-green-700" : s >= 4 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"}`}>{s.toFixed(1)}</span>
                            ))}
                          </div>
                          {activeRun.pac_query.reranking_time_s != null && (
                            <div className="text-[10px] text-gray-400 mt-0.5">⏱ {activeRun.pac_query.reranking_time_s}s</div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className="w-2 h-2 rounded-full bg-purple-500 inline-block"></span>
                      <span className="font-semibold text-purple-600">GraphRAG</span>
                      {activeRun.graphrag_query && (
                        <span className="ml-auto text-[10px] text-gray-400">{activeRun.graphrag_query.retrieved_chunk_count ?? 0} chunks</span>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <MetricRow label="Thời gian" value={activeRun.graphrag_query?.time_total_s != null ? `${activeRun.graphrag_query.time_total_s}s` : null} better={isBetter("time_total_s", "graph", activeRun.pac_query, activeRun.graphrag_query)} />
                      <MetricRow label="Tokens" value={activeRun.graphrag_query?.answer_tokens != null ? String(activeRun.graphrag_query.answer_tokens) : null} />
                      <MetricRow label="Số từ" value={activeRun.graphrag_query?.word_count != null ? String(activeRun.graphrag_query.word_count) : null} better={isBetter("word_count", "graph", activeRun.pac_query, activeRun.graphrag_query)} />
                      <MetricRow label="Relevance" labelTooltipText={METRIC_TOOLTIP_TEXT.relevance_score} value={activeRun.graphrag_query?.relevance_score != null ? activeRun.graphrag_query.relevance_score.toFixed(4) : null} better={isBetter("relevance_score", "graph", activeRun.pac_query, activeRun.graphrag_query)} />
                      <MetricRow label="Coverage" labelTooltipText={METRIC_TOOLTIP_TEXT.source_coverage} value={activeRun.graphrag_query?.source_coverage != null ? `${(activeRun.graphrag_query.source_coverage * 100).toFixed(1)}%` : null} better={isBetter("source_coverage", "graph", activeRun.pac_query, activeRun.graphrag_query)} />
                      <div className="flex items-center justify-between py-0.5">
                        <MetricLabelWithTooltip label="Confidence" tooltipText={METRIC_TOOLTIP_TEXT.confidence_score} />
                        <ConfidenceBadge score={activeRun.graphrag_query?.confidence_score} />
                      </div>
                      {activeRun.graphrag_query?.reranking_scores && activeRun.graphrag_query.reranking_scores.length > 0 && (
                        <div className="mt-1 pt-1 border-t border-gray-100">
                          <div className="text-gray-400 mb-0.5">Re-ranking scores</div>
                          <div className="flex flex-wrap gap-1">
                            {activeRun.graphrag_query.reranking_scores.map((s: number, i: number) => (
                              <span key={i} className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${s >= 7 ? "bg-green-100 text-green-700" : s >= 4 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"}`}>{s.toFixed(1)}</span>
                            ))}
                          </div>
                          {activeRun.graphrag_query.reranking_time_s != null && (
                            <div className="text-[10px] text-gray-400 mt-0.5">⏱ {activeRun.graphrag_query.reranking_time_s}s</div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mt-4">
                  <RetrieverMetricsChart data={retrieverChartData} />
                  <GeneratorMetricsChart data={generatorChartData} />
                </div>

                <div className="mt-2 rounded-lg border border-dashed border-gray-200 bg-white/70 p-3 text-[10px] text-gray-500 space-y-2">
                  <div className="font-semibold text-gray-600">Các tham số biểu đồ:</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1.5 leading-relaxed">
                    {METRIC_EXPLANATION_ITEMS.map((item) => (
                      <div key={item.label}>
                        <span className="font-medium text-gray-600">{item.label}:</span> {item.description}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {compareTab === "sources" && (
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <div className="font-semibold text-blue-600 mb-1">PaCRAG</div>
              {!activeRun.pac_query?.retrieved_chunks?.length ? (
                <span className="text-gray-400 italic">Chưa có nguồn</span>
              ) : (
                groupPassagesByFilename(activeRun.pac_query.retrieved_chunks as RetrievedPassage[]).map(([filename, chunks]) => (
                  <div key={filename} className="mb-2">
                    <div className="font-medium text-gray-600 truncate" title={filename}>{filename}</div>
                    <div className="pl-2 space-y-0.5">
                      {chunks.map((chunk, i) => (
                        <button key={i} className="text-left text-blue-500 hover:text-blue-700 block text-[10px]" onClick={() => onOpenCitation(chunk, lastQuery)}>
                          tr. {chunk.pages?.length ? chunk.pages.join(",") : "?"}
                        </button>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
            <div>
              <div className="font-semibold text-purple-600 mb-1">GraphRAG</div>
              {!activeRun.graphrag_query?.doc_passages?.length ? (
                <span className="text-gray-400 italic">Chưa có nguồn</span>
              ) : (
                groupPassagesByFilename(activeRun.graphrag_query.doc_passages as RetrievedPassage[]).map(([filename, passages]) => (
                  <div key={filename} className="mb-2">
                    <div className="font-medium text-gray-600 truncate" title={filename}>{filename}</div>
                    <div className="pl-2 space-y-0.5">
                      {passages.map((passage, i) => (
                        <button key={i} className="text-left text-purple-500 hover:text-purple-700 block text-[10px]" onClick={() => onOpenCitation(passage, lastQuery)}>
                          tr. {passage.pages?.length ? passage.pages.join(",") : "?"}
                        </button>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
