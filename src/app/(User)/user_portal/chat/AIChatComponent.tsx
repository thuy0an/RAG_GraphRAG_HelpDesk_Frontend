import { useEffect, useMemo, useRef, useState } from "react";
import { queryClient, useMutation, useQuery } from "@/lib/ReactQuery";
import { Button, Empty, Spin, message } from "antd";
import type { CitationModalState, Message, RetrievedPassage } from "./types";
import {
  buildGeneratorChartData,
  buildRetrieverChartData,
  isBetter,
} from "./metrics";
import { chatService, useAIChat } from "./hooks";
import {
  CitationModal,
  MessageBubble,
  QualityBadge,
} from "./presentation";
import { METRIC_EXPLANATION_ITEMS } from "./copy";
import { RetrieverMetricsChart } from "./components/compare/RetrieverMetricsChart";
import { GeneratorMetricsChart } from "./components/compare/GeneratorMetricsChart";

export interface AIChatComponentProps {
  userId: string;
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
}

// Component chế độ AI:
// - điều phối stream trả lời từ PaCRAG,
// - quản lý vòng đời compare run (upload/query/delete),
// - hiển thị so sánh PaCRAG vs GraphRAG cho run đang được chọn.
export function AIChatComponent(props: AIChatComponentProps) {
  const { historyMessages, isLoading, isStreaming, sendMessage } = useAIChat(props.userId);

  // Hợp nhất history từ server và message local; khử trùng để tránh render lặp.
  const mergedMessages = useMemo(() => {
    // FIX: Sử dụng ID làm khóa chính, fallback về role+content nếu không có ID
    const seen = new Set<string>();
    const seenContent = new Set<string>();
    
    return [...historyMessages, ...props.messages].filter((m: any) => {
      // Ưu tiên sử dụng ID nếu có
      if (m.id) {
        if (seen.has(m.id)) return false;
        seen.add(m.id);
        return true;
      }
      
      // Fallback về content-based dedup nhưng chỉ cho messages không có ID
      const contentKey = `${m.role || 'user'}::${m.content}::${m.sender_id || ''}`;
      if (seenContent.has(contentKey)) return false;
      seenContent.add(contentKey);
      return true;
    });
  }, [historyMessages, props.messages]);

  const [input, setInput] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [showChunkConfig, setShowChunkConfig] = useState(false);
  const [chunkConfig, setChunkConfig] = useState({
    parent_chunk_size: 2048,
    parent_chunk_overlap: 400,
    child_chunk_size: 512,
    child_chunk_overlap: 100,
  });
  const messagesRef = useRef<HTMLDivElement>(null);

  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [citationModal, setCitationModal] = useState<CitationModalState>({ open: false, passage: null, query: "" });
  const [lastQuery, setLastQuery] = useState("");

  const { data: compareHistory, isLoading: isCompareHistoryLoading } = useQuery(
    {
      queryKey: ["compare_history", props.userId || "anonymous"],
      queryFn: () => chatService.fetchCompareHistory(props.userId || "anonymous"),
      enabled: true,
    },
    queryClient
  );

  const compareRuns = compareHistory?.data?.runs || [];

  useEffect(() => {
    if (!activeRunId && compareRuns.length > 0) {
      setActiveRunId(compareRuns[0].id);
    }
  }, [compareRuns, activeRunId]);

  const activeRun = compareRuns.find((run: any) => run.id === activeRunId) || null;

  const { mutateAsync: uploadDocs, isPending: isUploading } = useMutation(
    {
      mutationFn: (payload: { files: File[]; config: typeof chunkConfig }) =>
        chatService.uploadCompare(props.userId || "anonymous", payload.files, payload.config),
      onSuccess: (data) => {
        const runs = data?.data?.runs || [];
        if (runs.length > 0) {
          setActiveRunId(runs[0].id);
        }
        queryClient.invalidateQueries({ queryKey: ["compare_history", props.userId] });
      },
    },
    queryClient
  );

  const { mutateAsync: compareQuery, isPending: isComparingQuery } = useMutation(
    {
      mutationFn: (payload: { runId: string; query: string }) =>
        chatService.compareQuery(props.userId || "anonymous", payload.runId, payload.query),
      onSuccess: (data) => {
        const newRunId = data?.data?.run?.id;
        if (newRunId) {
          setActiveRunId(newRunId);
        }
        queryClient.invalidateQueries({ queryKey: ["compare_history", props.userId] });
      },
    },
    queryClient
  );

  const { mutateAsync: clearHistory, isPending: isClearingHistory } = useMutation(
    {
      mutationFn: (sessionId: string) => chatService.clearHistory(sessionId),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["ai_chat_history", props.userId] });
        props.setMessages([]);
      },
    },
    queryClient
  );

  const { mutateAsync: clearVectorStore, isPending: isClearingVector } = useMutation(
    {
      mutationFn: () => chatService.clearVectorStore(),
    },
    queryClient
  );

  useEffect(() => {
    const el = messagesRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [mergedMessages.length]);

  // Gửi câu hỏi mới: cập nhật lastQuery, stream PaCRAG và kích hoạt compare query nếu đang có run.
  const handleSendMessage = () => {
    if (!input.trim()) return;
    setLastQuery(input);

    sendMessage(input, (msg: any) => {
      props.setMessages((prev: any) => {
        const exist = prev.find((m: any) => m.id === msg.id);
        if (exist) {
          return prev.map((m: any) => (m.id === msg.id ? msg : m));
        }
        return [...prev, msg];
      });
    });

    if (activeRunId) {
      compareQuery({ runId: activeRunId, query: input });
    }

    setInput("");
  };

  // Upload tài liệu cho cả PaCRAG và GraphRAG theo chunk config hiện tại.
  const handleUploadDocs = async () => {
    if (files.length === 0) return;
    try {
      await uploadDocs({ files, config: chunkConfig });
      message.success("Tải tài liệu thành công (PaCRAG + GraphRAG)");
      setFiles([]);
    } catch {
      message.error("Tải tài liệu thất bại");
    }
  };

  // Xóa toàn bộ lịch sử chat AI của session hiện tại.
  const handleClearHistory = async () => {
    if (!window.confirm("Bạn có chắc muốn xóa toàn bộ lịch sử chat?")) return;
    try {
      await clearHistory(props.userId || "anonymous");
      message.success("Đã xóa lịch sử chat");
    } catch {
      message.error("Xóa lịch sử thất bại");
    }
  };

  // Xóa toàn bộ vector store để reset ngữ cảnh truy xuất.
  const handleClearVectorStore = async () => {
    if (!window.confirm("Bạn có chắc muốn xóa toàn bộ vector store?")) return;
    try {
      await clearVectorStore();
      message.success("Đã xóa vector store");
    } catch {
      message.error("Xóa vector store thất bại");
    }
  };

  // Xóa 1 run compare cụ thể khỏi lịch sử.
  const handleDeleteCompareRun = async (runId: string) => {
    if (!window.confirm("Xóa lần so sánh này?")) return;
    try {
      await chatService.deleteCompareRun(runId);
      queryClient.invalidateQueries({ queryKey: ["compare_history", props.userId] });
      if (activeRunId === runId) {
        setActiveRunId(null);
      }
    } catch {
      message.error("Xóa thất bại");
    }
  };

  if (isLoading && mergedMessages.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spin />
      </div>
    );
  }

  // Dữ liệu biểu đồ retriever được tính từ run đang active.
  const retrieverChartData = activeRun
    ? buildRetrieverChartData(activeRun.pac_query, activeRun.graphrag_query)
    : [];

  // Dữ liệu biểu đồ generator được tính từ run đang active.
  const generatorChartData = activeRun
    ? buildGeneratorChartData(activeRun.pac_query, activeRun.graphrag_query)
    : [];

  return (
    <div className="flex h-full">
      <div className="flex flex-col flex-1">
        <div className="smartchatbot-messages-area" ref={messagesRef}>
          {mergedMessages.length === 0 ? (
            <Empty description="Bắt đầu trò chuyện với AI" style={{ marginTop: "100px" }} />
          ) : (
            <>
              {mergedMessages?.map((m: any) => (
                <MessageBubble key={m.id} msg={m} currentUserId={props.userId} />
              ))}

              {isStreaming && (
                <div className="flex justify-start">
                  <div className="smartchatbot-message-bubble smartchatbot-message-bubble-ai">
                    <div className="text-sm">
                      AI đang gõ<span className="animate-pulse">...</span>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="p-3 bg-white border-t border-gray-200">
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="file"
                accept=".pdf,.doc,.docx"
                multiple
                title="Chọn tài liệu PDF DOC DOCX"
                aria-label="Chọn tài liệu PDF DOC DOCX"
                onChange={(e) => setFiles(Array.from(e.target.files || []))}
                className="hidden"
                id="aiUploadInput"
              />
              <Button size="small" onClick={() => document.getElementById("aiUploadInput")?.click()}>
                Chọn file
              </Button>
              <Button size="small" type="primary" onClick={handleUploadDocs} disabled={files.length === 0 || isUploading}>
                {isUploading ? "Đang upload..." : "Upload tài liệu"}
              </Button>
              <Button size="small" onClick={() => setShowChunkConfig((prev) => !prev)}>
                {showChunkConfig ? "Ẩn cấu hình chunk" : "Cấu hình chunk"}
              </Button>
              <Button size="small" danger onClick={handleClearHistory} disabled={isClearingHistory}>
                Xóa lịch sử
              </Button>
              <Button size="small" danger onClick={handleClearVectorStore} disabled={isClearingVector}>
                Xóa vector store
              </Button>
            </div>

            {showChunkConfig && (
              <div className="grid grid-cols-2 gap-2 text-xs">
                <label className="flex flex-col gap-1">
                  Parent chunk size
                  <input
                    type="number"
                    value={chunkConfig.parent_chunk_size}
                    min={200}
                    onChange={(e) =>
                      setChunkConfig((prev) => ({
                        ...prev,
                        parent_chunk_size: Number(e.target.value),
                      }))
                    }
                    className="border border-gray-300 rounded px-2 py-1"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  Parent overlap
                  <input
                    type="number"
                    value={chunkConfig.parent_chunk_overlap}
                    min={0}
                    onChange={(e) =>
                      setChunkConfig((prev) => ({
                        ...prev,
                        parent_chunk_overlap: Number(e.target.value),
                      }))
                    }
                    className="border border-gray-300 rounded px-2 py-1"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  Child chunk size
                  <input
                    type="number"
                    value={chunkConfig.child_chunk_size}
                    min={100}
                    onChange={(e) =>
                      setChunkConfig((prev) => ({
                        ...prev,
                        child_chunk_size: Number(e.target.value),
                      }))
                    }
                    className="border border-gray-300 rounded px-2 py-1"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  Child overlap
                  <input
                    type="number"
                    value={chunkConfig.child_chunk_overlap}
                    min={0}
                    onChange={(e) =>
                      setChunkConfig((prev) => ({
                        ...prev,
                        child_chunk_overlap: Number(e.target.value),
                      }))
                    }
                    className="border border-gray-300 rounded px-2 py-1"
                  />
                </label>
              </div>
            )}

            {files.length > 0 && <div className="text-xs text-gray-500">Đã chọn: {files.map((f) => f.name).join(", ")}</div>}
            <textarea
              className="w-full border border-gray-300 rounded-xl p-3 resize-none focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none text-sm"
              rows={3}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isStreaming}
              placeholder="Nhập tin nhắn cho AI..."
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSendMessage()}
            />
            <div className="flex gap-2">
              <button
                onClick={handleSendMessage}
                disabled={isStreaming || !input.trim()}
                className="flex-1 px-4 py-2 bg-green-500 text-white rounded-xl hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                {isStreaming ? "Đang trả lời..." : "Gửi"}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="w-[260px] border-l border-gray-200 bg-white flex flex-col">
        <div className="px-3 py-2 border-b border-gray-200 text-sm font-semibold">So sánh PaCRAG vs GraphRAG</div>
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
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteCompareRun(run.id);
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
                  {isComparingQuery ? (
                    <Spin size="small" />
                  ) : (
                    <>
                      <div className="flex items-center">
                        Time: {activeRun.pac_query?.time_total_s ?? "-"}s
                        <QualityBadge show={isBetter("time_total_s", "pac", activeRun.pac_query, activeRun.graphrag_query)} />
                      </div>
                      <div>Tokens: {activeRun.pac_query?.answer_tokens ?? "-"}</div>
                      <div className="flex items-center">
                        Words: {activeRun.pac_query?.word_count ?? "N/A"}
                        <QualityBadge show={isBetter("word_count", "pac", activeRun.pac_query, activeRun.graphrag_query)} />
                      </div>
                      <div className="flex items-center">
                        Relevance: {activeRun.pac_query?.relevance_score != null ? activeRun.pac_query.relevance_score.toFixed(4) : "N/A"}
                        <QualityBadge show={isBetter("relevance_score", "pac", activeRun.pac_query, activeRun.graphrag_query)} />
                      </div>
                      <div className="flex items-center">
                        Coverage: {activeRun.pac_query?.source_coverage != null ? `${(activeRun.pac_query.source_coverage * 100).toFixed(2)}%` : "N/A"}
                        <QualityBadge show={isBetter("source_coverage", "pac", activeRun.pac_query, activeRun.graphrag_query)} />
                      </div>
                    </>
                  )}
                </div>
                <div className="border rounded p-2">
                  <div className="font-semibold">GraphRAG</div>
                  {isComparingQuery ? (
                    <Spin size="small" />
                  ) : (
                    <>
                      <div className="flex items-center">
                        Time: {activeRun.graphrag_query?.time_total_s ?? "-"}s
                        <QualityBadge show={isBetter("time_total_s", "graph", activeRun.pac_query, activeRun.graphrag_query)} />
                      </div>
                      <div>Tokens: {activeRun.graphrag_query?.answer_tokens ?? "-"}</div>
                      <div className="flex items-center">
                        Words: {activeRun.graphrag_query?.word_count ?? "N/A"}
                        <QualityBadge show={isBetter("word_count", "graph", activeRun.pac_query, activeRun.graphrag_query)} />
                      </div>
                      <div className="flex items-center">
                        Relevance: {activeRun.graphrag_query?.relevance_score != null ? activeRun.graphrag_query.relevance_score.toFixed(4) : "N/A"}
                        <QualityBadge show={isBetter("relevance_score", "graph", activeRun.pac_query, activeRun.graphrag_query)} />
                      </div>
                      <div className="flex items-center">
                        Coverage: {activeRun.graphrag_query?.source_coverage != null ? `${(activeRun.graphrag_query.source_coverage * 100).toFixed(2)}%` : "N/A"}
                        <QualityBadge show={isBetter("source_coverage", "graph", activeRun.pac_query, activeRun.graphrag_query)} />
                      </div>
                    </>
                  )}
                </div>
              </div>
              {(activeRun.pac_query?.answer || activeRun.graphrag_query?.answer) && (
                <div>
                  <div className="font-semibold mt-2">Câu trả lời</div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="border rounded p-2">
                      <div className="font-semibold text-[10px] mb-1">PaCRAG</div>
                      {isComparingQuery ? (
                        <Spin size="small" />
                      ) : (
                        <div className="text-[10px] whitespace-pre-wrap max-h-32 overflow-y-auto">{activeRun.pac_query?.answer || "Không có câu trả lời"}</div>
                      )}
                    </div>
                    <div className="border rounded p-2">
                      <div className="font-semibold text-[10px] mb-1">GraphRAG</div>
                      {isComparingQuery ? (
                        <Spin size="small" />
                      ) : (
                        <div className="text-[10px] whitespace-pre-wrap max-h-32 overflow-y-auto">{activeRun.graphrag_query?.answer || "Không có câu trả lời"}</div>
                      )}
                    </div>
                  </div>
                </div>
              )}
              {activeRun.pac_query?.retrieved_chunks && activeRun.pac_query.retrieved_chunks.length > 0 && (
                <div>
                  <div className="font-semibold mt-2 text-[11px]">Nguồn PaCRAG</div>
                  <div className="space-y-0.5">
                    {activeRun.pac_query.retrieved_chunks.map((chunk: RetrievedPassage, i: number) => (
                      <button
                        key={i}
                        className="text-left text-blue-600 underline text-[10px] block truncate hover:text-blue-800 w-full"
                        onClick={() => setCitationModal({ open: true, passage: chunk, query: lastQuery })}
                      >
                        {chunk.filename}
                        {chunk.pages?.length ? ` (tr. ${chunk.pages.join(",")})` : ""}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {activeRun.graphrag_query?.doc_passages && activeRun.graphrag_query.doc_passages.length > 0 && (
                <div>
                  <div className="font-semibold mt-2 text-[11px]">Nguồn GraphRAG</div>
                  <div className="space-y-0.5">
                    {activeRun.graphrag_query.doc_passages.map((passage: RetrievedPassage, i: number) => (
                      <button
                        key={i}
                        className="text-left text-blue-600 underline text-[10px] block truncate hover:text-blue-800 w-full"
                        onClick={() => setCitationModal({ open: true, passage, query: lastQuery })}
                      >
                        {passage.filename}
                        {passage.pages?.length ? ` (tr. ${passage.pages.join(",")})` : ""}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mt-4">
                <RetrieverMetricsChart data={retrieverChartData} />
                <GeneratorMetricsChart data={generatorChartData} />
              </div>

              <div className="mt-3 text-[11px] text-gray-600 bg-gray-50 border border-gray-200 rounded p-2 space-y-1">
                <div className="font-semibold text-gray-700">Lưu ý ý nghĩa các tham số:</div>
                {METRIC_EXPLANATION_ITEMS.map((item) => (
                  <div key={item.label}>
                    <strong>{item.label}</strong>: {item.description}
                  </div>
                ))}
              </div>

              {isComparingQuery && <div className="text-xs text-blue-500">Đang so sánh query...</div>}
            </div>
          )}
        </div>
      </div>
      <CitationModal state={citationModal} onClose={() => setCitationModal({ open: false, passage: null, query: "" })} />
    </div>
  );
}
