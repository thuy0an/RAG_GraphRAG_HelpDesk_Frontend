import { useCallback, useEffect, useRef, useState } from "react";
import { queryClient, useMutation, useQuery } from "@/shared/lib/ReactQuery";
import { Button, Empty, message, Spin } from "antd";
import { CONSTANT } from "../../types";
import { ChatService, AIService, CompareService, GraphService } from "../../service";
import { useAIChat } from "../../hooks";
import { MessageBubble } from "../components";
import { FileUploadPanel } from "../FileUploadPanel";
import { ChunkConfigPanel } from "../ChunkConfigPanel";
import { CompareMetricsPanel } from "../CompareMetricsPanel";

// Message Role Types
export enum MessageRole {
  USER = 'user',
  PACRAG_ASSISTANT = 'adv-assistant',
  GRAPHRAG_ASSISTANT = 'graph-assistant'
}

const chatService = new ChatService();
const aiService = new AIService();
const compareService = new CompareService();
const graphService = new GraphService();

interface ChunkConfig {
  parent_chunk_size: number;
  parent_chunk_overlap: number;
  child_chunk_size: number;
  child_chunk_overlap: number;
}

interface AIChatComponentProps {
  userId: string;
  messages: any[];
  setMessages: React.Dispatch<React.SetStateAction<any[]>>;
}

export function AIChatComponent(props: AIChatComponentProps) {
  const {
    historyMessages,
    isLoading,
    isStreaming,
    sendMessage
  } = useAIChat(props.userId);

  const mergedMessages = [...historyMessages, ...props.messages];
  console.log(mergedMessages);

  const [input, setInput] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [activeToolSections, setActiveToolSections] = useState<string[]>(["chunk"]);
  const [showChunkConfig, setShowChunkConfig] = useState(false);
  const [chunkConfig, setChunkConfig] = useState<ChunkConfig>({
    parent_chunk_size: 2048,
    parent_chunk_overlap: 400,
    child_chunk_size: 512,
    child_chunk_overlap: 100,
  });
  const messagesRef = useRef<HTMLDivElement>(null);

  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [isDeletingRun, setIsDeletingRun] = useState(false);
  const [deletingRunId, setDeletingRunId] = useState<string | null>(null);

  const { data: compareHistory, isLoading: isCompareHistoryLoading } = useQuery({
    queryKey: ["compare_history", props.userId || "anonymous"],
    queryFn: () => compareService.fetchCompareHistory(props.userId || "anonymous"),
    enabled: true,
  }, queryClient);

  const compareRuns = compareHistory?.result?.runs || [];

  useEffect(() => {
    if (!activeRunId && compareRuns.length > 0) {
      setActiveRunId(compareRuns[0].id);
    }
  }, [compareRuns, activeRunId]);

  const activeRun = compareRuns.find((run: any) => run.id === activeRunId) || null;

  const { mutateAsync: uploadDocs, isPending: isUploading } = useMutation({
    mutationFn: (payload: { files: File[]; config: ChunkConfig }) =>
      compareService.uploadCompare(props.userId || "anonymous", payload.files, payload.config),
    onSuccess: (data) => {
      const runs = data?.result?.runs || [];
      if (runs.length > 0) {
        setActiveRunId(runs[0].id);
      }
      queryClient.invalidateQueries({ queryKey: ["compare_history", props.userId] });
    }
  }, queryClient);

  const { mutateAsync: compareQuery, isPending: isComparingQuery } = useMutation({
    mutationFn: (payload: { runId: string; query: string }) =>
      compareService.compareQuery(props.userId || "anonymous", payload.runId, payload.query),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["compare_history", props.userId] });
    }
  }, queryClient);

  const { mutateAsync: clearHistory, isPending: isClearingHistory } = useMutation({
    mutationFn: (sessionId: string) => chatService.clearHistory(sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai_chat_history", props.userId] });
      props.setMessages([]);
    }
  }, queryClient);

  const { mutateAsync: clearVectorStore, isPending: isClearingVector } = useMutation({
    mutationFn: () => aiService.clearVectorStore(),
  }, queryClient);

  useEffect(() => {
    const el = messagesRef.current;
    if (!el) return;

    el.scrollTop = el.scrollHeight;
  }, [mergedMessages.length]);

  const handleSendMessage = () => {
    if (!input.trim()) return;

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

  const handleUploadDocs = async () => {
    if (files.length === 0) return;
    try {
      await uploadDocs({ files, config: chunkConfig });
      message.success("Tải tài liệu thành công (PaCRAG + GraphRAG)");
      setFiles([]);
    } catch (err) {
      message.error("Tải tài liệu thất bại");
    }
  };

  const handleClearHistory = async () => {
    if (!window.confirm("Bạn có chắc muốn xóa toàn bộ lịch sử chat?")) return;
    try {
      await clearHistory(props.userId || "anonymous");
      message.success("Đã xóa lịch sử chat");
    } catch (err) {
      message.error("Xóa lịch sử thất bại");
    }
  };

  const handleClearVectorStore = async () => {
    if (!window.confirm("Bạn có chắc muốn xóa toàn bộ vector store?")) return;
    try {
      await clearVectorStore();
      message.success("Đã xóa vector store");
    } catch (err) {
      message.error("Xóa vector store thất bại");
    }
  };

  const handleDeleteCompareRun = async (runId: string) => {
    setIsDeletingRun(true);
    setDeletingRunId(runId);
    try {
      await compareService.deleteCompareRun(runId);
      queryClient.invalidateQueries({ queryKey: ["compare_history", props.userId] });
      if (activeRunId === runId) {
        setActiveRunId(null);
      }
    } catch (err) {
      message.error("Xóa thất bại");
    } finally {
      setIsDeletingRun(false);
      setDeletingRunId(null);
    }
  };

  if (isLoading && mergedMessages.length === 0) {
    return <div className="flex items-center justify-center h-full">
      <Spin />
    </div>;
  }

  return (
    <div className="flex h-full">
      <div className="flex flex-col flex-1">
        <div style={CONSTANT.STYLES.messagesArea} ref={messagesRef}>
        {mergedMessages.length === 0 ? (
          <Empty description="Bắt đầu trò chuyện với AI" style={{ marginTop: "100px" }} />
        ) : (
          <>
            {mergedMessages?.map((m: any, index: number) => (
              <MessageBubble
                key={`${m.id}-${m.role || 'unknown'}-${index}`}
                message={m}
                currentUserId={props.userId}
              />
            ))}

            {isStreaming && (
              <div className="flex justify-start">
                <div style={{
                  maxWidth: "78%",
                  padding: "10px 12px",
                  borderRadius: "0",
                  background: "#ffffff",
                  color: "#111",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.08)",
                  border: "1px solid #e5e7eb"
                }}>
                  <div className="text-sm">AI đang gõ<span className="animate-pulse">...</span></div>
                </div>
              </div>
            )}
          </>
        )}
        </div>

        <div className="p-3 bg-white border-t border-gray-200">
          <div className="flex flex-col gap-2">
          <FileUploadPanel
            files={files}
            isUploading={isUploading}
            showChunkConfig={showChunkConfig}
            isClearingHistory={isClearingHistory}
            isClearingVector={isClearingVector}
            onChooseFiles={(e) => setFiles(Array.from(e.target.files || []))}
            onUploadDocs={handleUploadDocs}
            onToggleChunkConfig={() => setShowChunkConfig((prev) => !prev)}
            onClearHistory={handleClearHistory}
            onClearVectorStore={handleClearVectorStore}
          />

          {showChunkConfig && (
            <ChunkConfigPanel 
              chunkConfig={chunkConfig} 
              setChunkConfig={setChunkConfig} 
            />
          )}

          {files.length > 0 && (
            <div className="text-xs text-gray-500">
              Đã chọn: {files.map((f) => f.name).join(", ")}
            </div>
          )}
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
              {isStreaming ? 'Đang trả lời...' : 'Gửi'}
            </button>
          </div>
          </div>
        </div>
      </div>

      <div className="w-[260px] border-l border-gray-200 bg-white flex flex-col">
        <div className="px-3 py-2 border-b border-gray-200 text-sm font-semibold">
          So sánh PaCRAG vs GraphRAG
        </div>
        <CompareMetricsPanel
          compareRuns={compareRuns}
          activeRunId={activeRunId}
          setActiveRunId={setActiveRunId}
          isCompareHistoryLoading={isCompareHistoryLoading}
          isComparingQuery={isComparingQuery}
          handleDeleteCompareRun={handleDeleteCompareRun}
          isDeletingRun={isDeletingRun}
          deletingRunId={deletingRunId}
        />
      </div>
    </div>
  );
}
