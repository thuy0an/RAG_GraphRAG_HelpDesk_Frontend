import { Tooltip } from "antd";
import { QuestionCircleOutlined } from "@ant-design/icons";
import { ConfidenceBadge } from "../../presentation";
import { METRIC_TOOLTIP_TEXT, isBetter } from "../../metrics";
import type { CompareRun } from "../../types";

export interface CompareRunsTableProps {
  runs: CompareRun[];
  activeRunId: string | null;
  onSelectRun: (runId: string) => void;
  onDeleteRun: (runId: string) => void;
}

// Bảng tổng quan các compare run để người dùng quét nhanh kết quả theo từng câu hỏi.
// Component chỉ xử lý hiển thị + callback chọn/xóa run, không chứa business logic API.
export function CompareRunsTable(props: CompareRunsTableProps) {
  const { runs, activeRunId, onSelectRun, onDeleteRun } = props;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="bg-gray-50 text-gray-500 text-[11px] uppercase tracking-wide">
            <th className="text-left px-3 py-2 font-medium border-b border-gray-200 w-[30%]">Câu hỏi</th>
            <th className="text-center px-2 py-2 font-medium border-b border-gray-200 text-blue-600">PaC Time</th>
            <th className="text-center px-2 py-2 font-medium border-b border-gray-200 text-blue-600">
              <Tooltip title={METRIC_TOOLTIP_TEXT.relevance_score}>
                <span className="inline-flex items-center gap-1 cursor-help">PaC Relevance <QuestionCircleOutlined /></span>
              </Tooltip>
            </th>
            <th className="text-center px-2 py-2 font-medium border-b border-gray-200 text-blue-600">
              <Tooltip title={METRIC_TOOLTIP_TEXT.source_coverage}>
                <span className="inline-flex items-center gap-1 cursor-help">PaC Coverage <QuestionCircleOutlined /></span>
              </Tooltip>
            </th>
            <th className="text-center px-2 py-2 font-medium border-b border-gray-200 text-blue-600">
              <Tooltip title={METRIC_TOOLTIP_TEXT.confidence_score}>
                <span className="inline-flex items-center gap-1 cursor-help">PaC Confidence <QuestionCircleOutlined /></span>
              </Tooltip>
            </th>
            <th className="text-center px-2 py-2 font-medium border-b border-gray-200 text-purple-600">Graph Time</th>
            <th className="text-center px-2 py-2 font-medium border-b border-gray-200 text-purple-600">
              <Tooltip title={METRIC_TOOLTIP_TEXT.relevance_score}>
                <span className="inline-flex items-center gap-1 cursor-help">Graph Relevance <QuestionCircleOutlined /></span>
              </Tooltip>
            </th>
            <th className="text-center px-2 py-2 font-medium border-b border-gray-200 text-purple-600">
              <Tooltip title={METRIC_TOOLTIP_TEXT.source_coverage}>
                <span className="inline-flex items-center gap-1 cursor-help">Graph Coverage <QuestionCircleOutlined /></span>
              </Tooltip>
            </th>
            <th className="text-center px-2 py-2 font-medium border-b border-gray-200 text-purple-600">
              <Tooltip title={METRIC_TOOLTIP_TEXT.confidence_score}>
                <span className="inline-flex items-center gap-1 cursor-help">Graph Confidence <QuestionCircleOutlined /></span>
              </Tooltip>
            </th>
            <th className="px-2 py-2 border-b border-gray-200"></th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => (
            <tr
              key={run.id}
              className={`border-b border-gray-100 cursor-pointer transition-colors ${activeRunId === run.id ? "bg-blue-50" : "hover:bg-gray-50"}`}
              onClick={() => onSelectRun(run.id)}
            >
              <td className="px-3 py-2">
                <div className="font-medium line-clamp-2 leading-tight text-gray-700" title={run.query_text}>
                  <span className="text-blue-400 mr-1">Q:</span>{run.query_text}
                </div>
                <div className="text-[10px] text-gray-400 truncate mt-0.5">{run.file_name}</div>
                <div className="text-[10px] text-gray-300">{run.created_at || ""}</div>
              </td>
              <td className="text-center px-2 py-2">
                {run.pac_query?.time_total_s != null
                  ? <span className={`font-medium ${isBetter("time_total_s", "pac", run.pac_query, run.graphrag_query) ? "text-green-600" : "text-gray-600"}`}>{run.pac_query.time_total_s}s</span>
                  : <span className="text-gray-300">-</span>}
              </td>
              <td className="text-center px-2 py-2">
                {run.pac_query?.relevance_score != null
                  ? <span className={`font-medium ${isBetter("relevance_score", "pac", run.pac_query, run.graphrag_query) ? "text-green-600" : "text-gray-600"}`}>{run.pac_query.relevance_score.toFixed(3)}</span>
                  : <span className="text-gray-300">-</span>}
              </td>
              <td className="text-center px-2 py-2">
                {run.pac_query?.source_coverage != null
                  ? <span className={`font-medium ${isBetter("source_coverage", "pac", run.pac_query, run.graphrag_query) ? "text-green-600" : "text-gray-600"}`}>{(run.pac_query.source_coverage * 100).toFixed(1)}%</span>
                  : <span className="text-gray-300">-</span>}
              </td>
              <td className="text-center px-2 py-2">
                <ConfidenceBadge score={run.pac_query?.confidence_score} />
              </td>
              <td className="text-center px-2 py-2">
                {run.graphrag_query?.time_total_s != null
                  ? <span className={`font-medium ${isBetter("time_total_s", "graph", run.pac_query, run.graphrag_query) ? "text-green-600" : "text-gray-600"}`}>{run.graphrag_query.time_total_s}s</span>
                  : <span className="text-gray-300">-</span>}
              </td>
              <td className="text-center px-2 py-2">
                {run.graphrag_query?.relevance_score != null
                  ? <span className={`font-medium ${isBetter("relevance_score", "graph", run.pac_query, run.graphrag_query) ? "text-green-600" : "text-gray-600"}`}>{run.graphrag_query.relevance_score.toFixed(3)}</span>
                  : <span className="text-gray-300">-</span>}
              </td>
              <td className="text-center px-2 py-2">
                {run.graphrag_query?.source_coverage != null
                  ? <span className={`font-medium ${isBetter("source_coverage", "graph", run.pac_query, run.graphrag_query) ? "text-green-600" : "text-gray-600"}`}>{(run.graphrag_query.source_coverage * 100).toFixed(1)}%</span>
                  : <span className="text-gray-300">-</span>}
              </td>
              <td className="text-center px-2 py-2">
                <ConfidenceBadge score={run.graphrag_query?.confidence_score} />
              </td>
              <td className="px-2 py-2">
                <button
                  className="text-red-600 hover:text-red-700 font-semibold text-[10px] whitespace-nowrap"
                  onClick={(e) => { e.stopPropagation(); onDeleteRun(run.id); }}
                >
                  Xóa
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
