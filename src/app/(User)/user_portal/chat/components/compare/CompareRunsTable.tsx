import { useState, useEffect } from "react";
import { Tooltip, Pagination } from "antd";
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

const ROWS_PER_PAGE = 5; // Giới hạn tối đa 5 dòng

// Bảng tổng quan các compare run để người dùng quét nhanh kết quả theo từng câu hỏi.
// Component chỉ xử lý hiển thị + callback chọn/xóa run, không chứa business logic API.
export function CompareRunsTable(props: CompareRunsTableProps) {
  const { runs, activeRunId, onSelectRun, onDeleteRun } = props;
  const [currentPage, setCurrentPage] = useState(1);

  // Tự động chuyển đến trang chứa active run
  useEffect(() => {
    if (activeRunId && runs.length > 0) {
      const activeIndex = runs.findIndex(run => run.id === activeRunId);
      if (activeIndex !== -1) {
        const targetPage = Math.floor(activeIndex / ROWS_PER_PAGE) + 1;
        setCurrentPage((prevPage) => (prevPage === targetPage ? prevPage : targetPage));
      }
    }
  }, [activeRunId, runs]);

  // Tính toán pagination
  const totalRuns = runs.length;
  const startIndex = (currentPage - 1) * ROWS_PER_PAGE;
  const endIndex = startIndex + ROWS_PER_PAGE;
  const currentRuns = runs.slice(startIndex, endIndex);

  // Reset về trang 1 khi số lượng runs thay đổi đáng kể
  useEffect(() => {
    const maxPage = Math.ceil(totalRuns / ROWS_PER_PAGE);
    if (currentPage > maxPage && maxPage > 0) {
      setCurrentPage(maxPage);
    }
  }, [totalRuns, currentPage]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleRowClick = (runId: string, event: React.MouseEvent) => {
    // Prevent row click if clicking on pagination area
    const target = event.target as HTMLElement;
    if (target.closest('.ant-pagination')) {
      return;
    }
    onSelectRun(runId);
  };

  return (
    <div className="space-y-4" onClick={(e) => {
      // Stop propagation for the entire table container
      if ((e.target as HTMLElement).closest('.ant-pagination')) {
        e.stopPropagation();
      }
    }}>
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-gray-50 text-gray-500 text-[11px] uppercase tracking-wide">
              <th className="text-left px-3 py-2 font-medium border-b border-gray-200 w-[30%]">Câu hỏi</th>
              <th className="text-center px-2 py-2 font-medium border-b border-gray-200 text-blue-600">PaC Time</th>
              <th className="text-center px-2 py-2 font-medium border-b border-gray-200 text-blue-600">
                <Tooltip title={METRIC_TOOLTIP_TEXT.retrieved_chunk_count}>
                  <span className="inline-flex items-center gap-1 cursor-help">PaC Chunks <QuestionCircleOutlined /></span>
                </Tooltip>
              </th>
              <th className="text-center px-2 py-2 font-medium border-b border-gray-200 text-blue-600">
                <Tooltip title={METRIC_TOOLTIP_TEXT.retrieved_source_count}>
                  <span className="inline-flex items-center gap-1 cursor-help">PaC Sources <QuestionCircleOutlined /></span>
                </Tooltip>
              </th>
              <th className="text-center px-2 py-2 font-medium border-b border-gray-200 text-blue-600">
                <Tooltip title={METRIC_TOOLTIP_TEXT.confidence_score}>
                  <span className="inline-flex items-center gap-1 cursor-help">PaC Confidence <QuestionCircleOutlined /></span>
                </Tooltip>
              </th>
              <th className="text-center px-2 py-2 font-medium border-b border-gray-200 text-purple-600">Graph Time</th>
              <th className="text-center px-2 py-2 font-medium border-b border-gray-200 text-purple-600">
                <Tooltip title={METRIC_TOOLTIP_TEXT.retrieved_chunk_count}>
                  <span className="inline-flex items-center gap-1 cursor-help">Graph Chunks <QuestionCircleOutlined /></span>
                </Tooltip>
              </th>
              <th className="text-center px-2 py-2 font-medium border-b border-gray-200 text-purple-600">
                <Tooltip title={METRIC_TOOLTIP_TEXT.retrieved_source_count}>
                  <span className="inline-flex items-center gap-1 cursor-help">Graph Sources <QuestionCircleOutlined /></span>
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
            {currentRuns.map((run) => (
              <tr
                key={run.id}
                className={`border-b border-gray-100 cursor-pointer transition-colors ${activeRunId === run.id ? "bg-blue-50" : "hover:bg-gray-50"}`}
                onClick={(e) => handleRowClick(run.id, e)}
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
                  {run.pac_query?.retrieved_chunk_count != null
                    ? <span className={`font-medium ${isBetter("retrieved_chunk_count", "pac", run.pac_query, run.graphrag_query) ? "text-green-600" : "text-gray-600"}`}>{run.pac_query.retrieved_chunk_count}</span>
                    : <span className="text-gray-300">-</span>}
                </td>
                <td className="text-center px-2 py-2">
                  {run.pac_query?.retrieved_source_count != null
                    ? <span className={`font-medium ${isBetter("retrieved_source_count", "pac", run.pac_query, run.graphrag_query) ? "text-green-600" : "text-gray-600"}`}>{run.pac_query.retrieved_source_count}</span>
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
                  {run.graphrag_query?.retrieved_chunk_count != null
                    ? <span className={`font-medium ${isBetter("retrieved_chunk_count", "graph", run.pac_query, run.graphrag_query) ? "text-green-600" : "text-gray-600"}`}>{run.graphrag_query.retrieved_chunk_count}</span>
                    : <span className="text-gray-300">-</span>}
                </td>
                <td className="text-center px-2 py-2">
                  {run.graphrag_query?.retrieved_source_count != null
                    ? <span className={`font-medium ${isBetter("retrieved_source_count", "graph", run.pac_query, run.graphrag_query) ? "text-green-600" : "text-gray-600"}`}>{run.graphrag_query.retrieved_source_count}</span>
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

      {/* Pagination - chỉ hiển thị khi có nhiều hơn ROWS_PER_PAGE */}
      {totalRuns > ROWS_PER_PAGE && (
        <div className="flex justify-center items-center mt-4 p-2">
          <Pagination
            current={currentPage}
            total={totalRuns}
            pageSize={ROWS_PER_PAGE}
            onChange={handlePageChange}
            showSizeChanger={false}
            showQuickJumper={false}
            showTotal={(total, range) => 
              `${range[0]}-${range[1]} của ${total} kết quả`
            }
            size="small"
            showLessItems={true}
            responsive={true}
          />
        </div>
      )}
    </div>
  );
}
