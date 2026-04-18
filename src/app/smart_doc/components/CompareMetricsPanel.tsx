import React from "react";
import { Button, Modal } from "antd";

interface CompareMetricsPanelProps {
  compareRuns: any[];
  activeRunId: string | null;
  setActiveRunId: (id: string) => void;
  isCompareHistoryLoading: boolean;
  isComparingQuery: boolean;
  handleDeleteCompareRun: (runId: string) => void;
  isDeletingRun?: boolean;
  deletingRunId?: string | null;
}

export function CompareMetricsPanel({
  compareRuns,
  activeRunId,
  setActiveRunId,
  isCompareHistoryLoading,
  isComparingQuery,
  handleDeleteCompareRun,
  isDeletingRun,
  deletingRunId
}: CompareMetricsPanelProps) {
  const activeRun = compareRuns.find((run: any) => run.id === activeRunId) || null;

  return (
    <div className="flex-1 overflow-auto p-3 text-xs space-y-3">
      {isCompareHistoryLoading ? (
        <div>Đang tải lịch sử...</div>
      ) : compareRuns.length === 0 ? (
        <div>Chưa có dữ liệu so sánh</div>
      ) : (
        <div className="space-y-2">
          {compareRuns.map((run: any) => (
            <div
              key={run.id}
              className={`border rounded p-2 cursor-pointer ${activeRunId === run.id ? "border-blue-500" : "border-gray-200"}`}
              onClick={() => setActiveRunId(run.id)}
            >
              <div className="font-semibold truncate">{run.file_name}</div>
              <div className="text-[10px] text-gray-500">{run.created_at || ""}</div>
              <div className="mt-1 flex justify-between">
                <span>PaC {run.pac_ingest?.time_total_s ?? "-"}s</span>
                <span>Graph {run.graphrag_ingest?.time_total_s ?? "-"}s</span>
              </div>
              <Button
                size="small"
                danger
                className="mt-2"
                loading={isDeletingRun && deletingRunId === run.id}
                disabled={isDeletingRun}
                onClick={(e) => {
                  e.stopPropagation();
                  Modal.confirm({
                    title: 'Xác nhận xóa',
                    content: `Bạn có chắc chắn muốn xóa run so sánh này không?`,
                    okText: 'Xóa',
                    okType: 'danger',
                    cancelText: 'Hủy',
                    onOk: () => handleDeleteCompareRun(run.id)
                  });
                }}
              >
                Xóa
              </Button>
            </div>
          ))}
        </div>
      )}

      {activeRun && (
        <div className="space-y-2">
          <div className="font-semibold">Kết quả ingest</div>
          <div className="grid grid-cols-2 gap-2">
            <div className="border rounded p-2">
              <div className="font-semibold">PaCRAG</div>
              <div>Time: {activeRun.pac_ingest?.time_total_s ?? "-"}s</div>
              <div>Parent: {activeRun.pac_ingest?.parent_chunks ?? "-"}</div>
              <div>Child: {activeRun.pac_ingest?.child_chunks ?? "-"}</div>
            </div>
            <div className="border rounded p-2">
              <div className="font-semibold">GraphRAG</div>
              <div>Time: {activeRun.graphrag_ingest?.time_total_s ?? "-"}s</div>
              <div>Chunks: {activeRun.graphrag_ingest?.chunks ?? "-"}</div>
              <div>Sections: {activeRun.graphrag_ingest?.sections ?? "-"}</div>
              <div>Entities: {activeRun.graphrag_ingest?.entities ?? "-"}</div>
              <div>Relations: {activeRun.graphrag_ingest?.relations ?? "-"}</div>
            </div>
          </div>

          <div className="font-semibold">Kết quả query</div>
          <div className="grid grid-cols-2 gap-2">
            <div className="border rounded p-2">
              <div className="font-semibold">PaCRAG</div>
              <div>Time: {activeRun.pac_query?.time_total_s ?? "-"}s</div>
              <div>Tokens: {activeRun.pac_query?.answer_tokens ?? "-"}</div>
            </div>
            <div className="border rounded p-2">
              <div className="font-semibold">GraphRAG</div>
              <div>Time: {activeRun.graphrag_query?.time_total_s ?? "-"}s</div>
              <div>Tokens: {activeRun.graphrag_query?.answer_tokens ?? "-"}</div>
            </div>
          </div>
          {isComparingQuery && (
            <div className="text-xs text-blue-500">Đang so sánh query...</div>
          )}
        </div>
      )}
    </div>
  );
}
