import { Spin } from "antd";
import type { ChartMetricDatum } from "../../metrics";
import type { CompareRun, CompareTab, RetrievedPassage } from "../../types";
import { CompareResultTabs } from "./CompareResultTabs";

export interface CompareRunDetailsCardProps {
  activeRun: CompareRun;
  isComparingQuery: boolean;
  compareTab: CompareTab;
  onCompareTabChange: (tab: CompareTab) => void;
  retrieverChartData: ChartMetricDatum[];
  generatorChartData: ChartMetricDatum[];
  lastQuery: string;
  onOpenCitation: (passage: RetrievedPassage, query: string) => void;
}

// Card chi tiết cho run đang chọn: gồm header, tóm tắt ingest và tab metrics/sources.
// Mục tiêu là gom toàn bộ layout chi tiết về một nơi để parent chỉ còn orchestration.
export function CompareRunDetailsCard(props: CompareRunDetailsCardProps) {
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
    <div className="border border-gray-200 rounded-xl bg-white overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50">
        <div className="flex-1 min-w-0">
          {activeRun.query_text ? (
            <div className="font-semibold text-sm text-gray-700 line-clamp-2" title={activeRun.query_text}>
              <span className="text-blue-500 mr-1">Q:</span>{activeRun.query_text}
            </div>
          ) : (
            <div className="font-semibold text-sm truncate text-gray-700" title={activeRun.file_name}>
              📄 {activeRun.file_name}
            </div>
          )}
          <div className="text-[10px] text-gray-400 mt-0.5 truncate">📄 {activeRun.file_name} · {activeRun.created_at || ""}</div>
        </div>
        {isComparingQuery && (
          <div className="flex items-center gap-1.5 text-[11px] text-blue-500 ml-3">
            <Spin size="small" />
            <span>Đang tính...</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-4 gap-0 text-xs border-b border-gray-100 divide-x divide-gray-100">
        <div className="px-3 py-2">
          <div className="text-[10px] text-gray-400 mb-0.5">PaC Ingest</div>
          <div className="font-medium text-blue-600">{activeRun.pac_ingest?.time_total_s ?? "-"}s</div>
          <div className="text-gray-400">{activeRun.pac_ingest?.child_chunks ?? "-"} child chunks</div>
        </div>
        <div className="px-3 py-2">
          <div className="text-[10px] text-gray-400 mb-0.5">Graph Ingest</div>
          <div className="font-medium text-purple-600">{activeRun.graphrag_ingest?.time_total_s ?? "-"}s</div>
          <div className="text-gray-400">{activeRun.graphrag_ingest?.chunks ?? "-"} chunks · {activeRun.graphrag_ingest?.entities ?? "-"} entities</div>
        </div>
        <div className="px-3 py-2">
          <div className="text-[10px] text-gray-400 mb-0.5">PaC Chunks</div>
          <div className="font-medium text-blue-600">{activeRun.pac_ingest?.parent_chunks ?? "-"} parent</div>
          <div className="text-gray-400">{activeRun.pac_ingest?.child_chunks ?? "-"} child</div>
        </div>
        <div className="px-3 py-2">
          <div className="text-[10px] text-gray-400 mb-0.5">Graph Graph</div>
          <div className="font-medium text-purple-600">{activeRun.graphrag_ingest?.sections ?? "-"} sections</div>
          <div className="text-gray-400">{activeRun.graphrag_ingest?.relations ?? "-"} relations</div>
        </div>
      </div>

      <CompareResultTabs
        activeRun={activeRun}
        isComparingQuery={isComparingQuery}
        compareTab={compareTab}
        onCompareTabChange={onCompareTabChange}
        retrieverChartData={retrieverChartData}
        generatorChartData={generatorChartData}
        lastQuery={lastQuery}
        onOpenCitation={onOpenCitation}
      />
    </div>
  );
}
