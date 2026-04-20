import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { queryClient, useMutation, useQuery } from "@/lib/ReactQuery";
import UserHeader from "@/components/UserHeader";
import { Button, Collapse, Empty, message, Spin, Tooltip } from "antd";
import {
  CloudUploadOutlined,
  DatabaseOutlined,
  FileTextOutlined,
  HistoryOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import { PUBLIC_API_BASE_URL } from "@/constants/constant";
import { logger } from "@/utils/logger";
import { ChatService } from "./chat/chatService";
import { MessageFormatter } from "./chat/formatters";
import { Utility } from "./chat/utils";
import {
  chatService,
  useAIChat,
  useConversationKey,
  useGraphRAGHistory,
  useWebSocket,
} from "./chat/hooks";
import {
  buildGeneratorChartData,
  buildRetrieverChartData,
  METRIC_TOOLTIP_TEXT,
  isBetter,
  metricDescription,
  normalizeUnitScore,
  readGeneratorScores,
  readRetrieverScores,
} from "./chat/metrics";
import { CompareRunsTable } from "./chat/components/compare/CompareRunsTable";
import { CompareRunDetailsCard } from "./chat/components/compare/CompareRunDetailsCard";
import {
  CitationModal,
  MessageBubble,
} from "./chat/presentation";
import { AIChatComponent } from "./chat/AIChatComponent";
import { NormalChatComponent } from "./chat/NormalChatComponent";
import type {
  ChatModeToggleProps,
  ChatState,
  CitationModalState,
  CompareRun,
  CompareTab,
  Message,
  QueryMetrics,
  RetrievedPassage,
  TypingState,
  WebSocketHookReturn,
} from "./chat/types";

export type {
  ChatModeToggleProps,
  ChatState,
  CitationModalState,
  CompareRun,
  CompareTab,
  Message,
  QueryMetrics,
  RetrievedPassage,
  TypingState,
  WebSocketHookReturn,
};
export { ChatService, MessageFormatter, Utility, METRIC_TOOLTIP_TEXT, isBetter, metricDescription, normalizeUnitScore, readGeneratorScores, readRetrieverScores };

// Keep the layout constants local for now; they still encode component-specific styling decisions.
export class CONSTANT {
  static MAX_FILE_SIZE = 5 * 1024 * 1024;

  static STYLES = {
    messageBubble: (isFromUser: boolean) => ({
      maxWidth: "70%",
      padding: "10px 14px",
      borderRadius: "0",
      background: isFromUser ? "#1890ff" : "#fff",
      color: isFromUser ? "#fff" : "#000",
      boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
      wordBreak: "break-word" as const,
      border: isFromUser ? "none" : "1px solid #f0f0f0"
    }),
    messageContainer: (isFromUser: boolean) => ({
      marginBottom: "16px",
      display: "flex",
      justifyContent: isFromUser ? "flex-end" : "flex-start",
      gap: "8px"
    }),
    chatHeader: {
      padding: "16px",
      borderBottom: "1px solid #f0f0f0",
      background: "#fafafa",
      display: "flex",
      alignItems: "center",
      gap: "12px"
    },
    messagesArea: {
      flex: 1,
      padding: "16px",
      overflowY: "auto",
      background: "#fafafa",
    },
    filePreview: {
      image: {
        width: "60px",
        height: "60px",
        objectFit: "cover" as const,
        borderRadius: "5px"
      },
      fileIcon: {
        width: "48px",
        height: "48px",
        borderRadius: "50%",
        backgroundColor: "#0D0D0D",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      },
      fileIconSvg: {
        fontSize: "24px",
        color: "#F5F5F5",
        WebkitTextStroke: "1px #000000"
      },
      fileName: {
        width: "80px",
        wordBreak: "break-word" as const,
        fontSize: "12px",
        lineHeight: "1.2",
        maxHeight: "40px",
        overflow: "hidden",
        display: "-webkit-box",
        WebkitLineClamp: 2,
        WebkitBoxOrient: "vertical"
      },
      fileWrapper: {
        display: "flex",
        gap: "8px",
        alignItems: "center"
      },
      container: {
        position: "relative" as const
      },
      removeBtn: {
        position: "absolute",
        top: "-6px",
        right: "-6px",
        minWidth: "auto"
      }
    }
  } as const;
}

// Hooks and network helpers are extracted into chat/hooks.ts so this file can focus on page-level orchestration.

// ===== UI COMPONENTS =====


// Main User Chat Component
export function UserPortalChat() {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMode, setChatMode] = useState<'ai' | 'chat'>('chat');
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [AIMessages, setAIMessages] = useState<Message[]>([]);

  const userId = "anonymous";

  const { data: conKeyData, isLoading: isLoadingConKey } = useConversationKey(userId, isChatOpen);

  const conversationKey = conKeyData?.data?.conversation_key || "";

  // Nhận message realtime từ socket và append vào luồng chat thường.
  const handleChatMessage = (msg: Message) => {
    setChatMessages(prev => [...prev, msg]);
  }

  const { isConnected, sendChatMessage } = useWebSocket(
    userId,
    conversationKey,
    handleChatMessage
  );

  // Chuyển nhanh giữa hai chế độ chat thường và AI.
  const toggleMode = useCallback(() => {
    setChatMode(prev => prev === 'ai' ? 'chat' : 'ai');
  }, []);

  return (
    <div className="fixed bottom-4 right-4 z-50 pointer-events-none">
      {!isChatOpen ? (
        <button
          onClick={() => {
            logger.info(`[UserChat] Opening chat. Current mode: ${chatMode}`);
            setIsChatOpen(true);
          }}
          className="pointer-events-auto w-14 h-14 rounded-full bg-blue-500 text-white shadow-2xl flex items-center justify-center hover:bg-blue-600 transition-all"
          aria-label="Open chat"
        >
          💬
        </button>
      ) : (
        <div
          className={`pointer-events-auto max-w-[calc(100vw-1rem)] h-[520px] bg-white rounded-2xl shadow-2xl flex flex-col border border-gray-200 ${
            chatMode === 'ai' ? 'w-[760px]' : 'w-[360px]'
          }`}
        >
          <div className={`px-4 py-3 text-white flex items-center justify-between ${chatMode === 'ai' ? 'bg-green-500' : 'bg-blue-500'
            }`}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center font-semibold">
                {chatMode === 'ai' ? 'AI' : 'U'}
              </div>
              <div>
                <div className="font-semibold leading-5">
                  {chatMode === 'ai' ? 'AI Assistant' : 'Messenger'}
                </div>
                <div className="text-xs text-white/80">
                  {chatMode === 'ai' ? 'Trả lời tự động' : 'Đang online'}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={toggleMode}
                className="px-2 py-1 rounded-md text-xs bg-white/15 hover:bg-white/25 transition"
              >
                {chatMode === 'ai' ? 'Chat' : 'AI'}
              </button>
              <button
                onClick={() => {
                  logger.info(`[UserChat] Closing chat`);
                  setIsChatOpen(false);
                }}
                className="w-8 h-8 rounded-md hover:bg-white/15 transition"
                aria-label="Close chat"
              >
                ×
              </button>
            </div>
          </div>

          {chatMode === 'ai' ? (
            <AIChatComponent
              userId={userId}
              messages={AIMessages}
              setMessages={setAIMessages}
            />
          ) : (
            isLoadingConKey ? <>
              <div className="flex items-center justify-center h-full">
                <Spin />
              </div>
            </> :
              <NormalChatComponent
                userId={userId}
                messages={chatMessages}
                setMessages={setChatMessages}
                isConnected={isConnected}
                sendMessage={sendChatMessage}
                conversationKey={conversationKey}
              />
          )}
        </div>
      )}
    </div>
  );
}

// Full-page AI workspace
export function AIChatWorkspace() {
  const userId = "anonymous";
  const storageKey = `smartchatbot_uploaded_files_anonymous`;

  const {
    historyMessages,
    isLoading,
    isStreaming,
    sendMessage
  } = useAIChat(userId);

  const { messages: graphHistoryMessages } = useGraphRAGHistory(userId);

  const [input, setInput] = useState("");
  const [files, setFiles] = useState<Array<{ file: File; enabled: boolean; error?: string }>>([]);
  const [activeToolSections, setActiveToolSections] = useState<string[]>(["upload", "chunk", "files"]);
  const [docPanelOpen, setDocPanelOpen] = useState(true);
  const [toolPanelOpen, setToolPanelOpen] = useState(true);
  const [chunkConfig, setChunkConfig] = useState({
    parent_chunk_size: 2048,
    parent_chunk_overlap: 400,
    child_chunk_size: 512,
    child_chunk_overlap: 100,
  });
  const [pendingChunkConfig, setPendingChunkConfig] = useState(chunkConfig);

  const [graphMessages, setGraphMessages] = useState<Message[]>([]);
  const [ragMessages, setRagMessages] = useState<Message[]>([]);
  const [isGraphThinking, setIsGraphThinking] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [showHistorySidebar, setShowHistorySidebar] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<Array<{ name: string; selected: boolean }>>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter((f) => typeof f?.name === "string");
      }
      return [];
    } catch {
      return [];
    }
  });

  // Xóa một tài liệu đã upload khỏi PaCRAG/GraphRAG và dọn compare run liên quan nếu có.
  const handleDeleteUploadedFile = async (filename: string) => {
    if (!window.confirm(`Bạn có chắc muốn xóa "${filename}" và toàn bộ dữ liệu nguồn liên quan?`)) return;
    try {
      // Xóa PaCRAG vector store và GraphRAG graph song song
      await Promise.allSettled([
        chatService.deletePaCDocument(filename),
        chatService.deleteGraphDocument(filename),
      ]);

      // Xóa compareRun tương ứng nếu có
      const matchRun = compareRuns.find((run) => run.file_name === filename);
      if (matchRun) {
        await chatService.deleteCompareRun(matchRun.id).catch(() => {});
        queryClient.invalidateQueries({ queryKey: ["compare_history", userId] });
        if (activeRunId === matchRun.id) setActiveRunId(null);
      }

      // Xóa khỏi state local
      setUploadedFiles((prev) => prev.filter((f) => f.name !== filename));
      message.success(`Đã xóa "${filename}" và dữ liệu nguồn`);
    } catch (err) {
      message.error("Xóa file thất bại");
    }
  };

  // Không clear local messages - luôn giữ nội dung, dedup theo id khi merge với history

  // Hợp nhất history GraphRAG và message local; khử trùng để tránh hiển thị lặp.
  const mergedGraphMessages = useMemo(() => {
    // Dedup: history từ server là source of truth
    // Local messages chỉ hiển thị trong lúc chờ save xong
    const seen = new Set<string>();
    return [...graphHistoryMessages, ...graphMessages].filter((m: Message) => {
      const key = `${m.role}::${m.content}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [graphHistoryMessages, graphMessages]);

  // Hợp nhất history PaCRAG và message local; khử trùng theo role+content.
  const mergedRagMessages = useMemo(() => {
    const seen = new Set<string>();
    return [...historyMessages, ...ragMessages].filter((m: Message) => {
      const key = `${m.role}::${m.content}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [historyMessages, ragMessages]);

  const messagesRef = useRef<HTMLDivElement>(null);
  const graphMessagesRef = useRef<HTMLDivElement>(null);
  const [showRagScrollBtn, setShowRagScrollBtn] = useState(false);
  const [showGraphScrollBtn, setShowGraphScrollBtn] = useState(false);

  // Theo dõi vị trí cuộn khung PaCRAG để quyết định có hiện nút "cuộn xuống" hay không.
  const handleRagScroll = useCallback(() => {
    const el = messagesRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowRagScrollBtn(distFromBottom > 100);
  }, []);

  // Theo dõi vị trí cuộn khung GraphRAG để quyết định có hiện nút "cuộn xuống" hay không.
  const handleGraphScroll = useCallback(() => {
    const el = graphMessagesRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowGraphScrollBtn(distFromBottom > 100);
  }, []);

  // Cuộn mượt khung PaCRAG xuống đáy khi cần.
  const scrollRagToBottom = useCallback(() => {
    const el = messagesRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, []);

  // Cuộn mượt khung GraphRAG xuống đáy khi cần.
  const scrollGraphToBottom = useCallback(() => {
    const el = graphMessagesRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, []);

  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [lastQuery, setLastQuery] = useState("");
  const [citationModal, setCitationModal] = useState<CitationModalState>({ open: false, passage: null, query: "" });
  const [compareTab, setCompareTab] = useState<CompareTab>("metrics");
  const [rerankingEnabled, setRerankingEnabled] = useState(false);

  const { data: compareHistory, isLoading: isCompareHistoryLoading } = useQuery({
    queryKey: ["compare_history", userId || "anonymous"],
    queryFn: () => chatService.fetchCompareHistory(userId || "anonymous"),
    enabled: true,
  }, queryClient);

  const compareRuns: CompareRun[] = (compareHistory?.data?.runs ?? []) as CompareRun[];
  // Chỉ hiển thị các run đã có câu hỏi (query_text) trong bảng so sánh
  const queryRuns = compareRuns.filter((run) => !!run.query_text);
  const activeRun = compareRuns.find((run) => run.id === activeRunId) || null;

  // Tính dataset biểu đồ retriever từ run đang active.
  const retrieverChartData = useMemo(() => {
    if (!activeRun) return [];
    return buildRetrieverChartData(activeRun.pac_query, activeRun.graphrag_query);
  }, [activeRun]);

  // Tính dataset biểu đồ generator từ run đang active.
  const generatorChartData = useMemo(() => {
    if (!activeRun) return [];
    return buildGeneratorChartData(activeRun.pac_query, activeRun.graphrag_query);
  }, [activeRun]);

  // Chọn run đầu tiên có query nếu người dùng chưa chọn run nào.
  useEffect(() => {
    if (!activeRunId && queryRuns.length > 0) {
      setActiveRunId(queryRuns[0].id);
    }
  }, [queryRuns, activeRunId]);

  // Ở màn nhỏ, mặc định thu gọn tool panel để tối ưu không gian đọc.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.innerWidth < 1280) {
      setToolPanelOpen(false);
    }
  }, []);

  // Đồng bộ danh sách file đã upload từ compare history vào state local (nếu localStorage còn tồn tại).
  useEffect(() => {
    // Chỉ sync từ compareRuns nếu localStorage vẫn còn data
    // (tránh thêm lại sau khi user đã xóa vector store)
    if (compareRuns.length === 0) return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return; // localStorage đã bị xóa → không thêm lại
    } catch {}
    setUploadedFiles((prev) => {
      const existing = new Map(prev.map((f) => [f.name, f]));
      compareRuns.forEach((run) => {
        const name = run.file_name;
        if (!name) return;
        if (!existing.has(name)) {
          existing.set(name, { name, selected: false });
        }
      });
      return Array.from(existing.values());
    });
  }, [compareRuns]);

  // Lưu trạng thái file đã upload vào localStorage để giữ trải nghiệm khi reload.
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(uploadedFiles));
    } catch {
      // ignore storage errors
    }
  }, [uploadedFiles, storageKey]);

  const { mutateAsync: compareQuery, isPending: isComparingQuery } = useMutation({
    mutationFn: (payload: { runId: string; query: string; rerankingEnabled?: boolean; sourceFilter?: string | null; sourceFilters?: string[] | null }) =>
      chatService.compareQuery(userId || "anonymous", payload.runId, payload.query, payload.rerankingEnabled ?? false, payload.sourceFilter ?? null, payload.sourceFilters ?? null),
    onSuccess: (data) => {
      const newRunId = data?.data?.run?.id;
      if (newRunId) {
        setActiveRunId(newRunId);
      }
      queryClient.invalidateQueries({ queryKey: ["compare_history", userId] });
    }
  }, queryClient);

  const { mutateAsync: clearHistory, isPending: isClearingHistory } = useMutation({
    mutationFn: (sessionId: string) => chatService.clearHistory(sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai_chat_history", userId] });
      setRagMessages([]);
    }
  }, queryClient);

  const { mutateAsync: clearVectorStore, isPending: isClearingVector } = useMutation({
    mutationFn: () => chatService.clearVectorStore(),
  }, queryClient);

  // Auto-scroll khung PaCRAG khi số lượng message thay đổi.
  useEffect(() => {
    const el = messagesRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [mergedRagMessages.length]);

  // Auto-scroll khung GraphRAG khi số lượng message thay đổi.
  useEffect(() => {
    const el = graphMessagesRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [graphMessages.length]);

  // Upload tài liệu cho flow compare; hỗ trợ truyền danh sách override khi upload tức thì từ input.
  const handleUploadDocs = async (overrideFiles?: File[]) => {
    const readyFiles = overrideFiles || files.filter((f) => f.enabled && !f.error).map((f) => f.file);
    if (readyFiles.length === 0) {
      message.error("Chưa có file hợp lệ để upload");
      return;
    }

    setUploadStatus("Đang upload...");
    let successCount = 0;

    // Upload từng file một — chuyển sang "đã upload" ngay khi file đó xong
    for (const file of readyFiles) {
      try {
        const data = await chatService.uploadCompare(userId || "anonymous", [file], chunkConfig);
        const runs = data?.data?.runs || [];
        if (runs.length > 0) {
          setActiveRunId(runs[0].id);
        }
        queryClient.invalidateQueries({ queryKey: ["compare_history", userId] });

        // Chuyển file này sang danh sách đã upload ngay lập tức
        setUploadedFiles((prev) => {
          const existing = new Map(prev.map((f) => [f.name, f]));
          if (!existing.has(file.name)) {
            existing.set(file.name, { name: file.name, selected: true });
          }
          return Array.from(existing.values());
        });

        // Xóa file này khỏi danh sách chờ
        setFiles((prev) => prev.filter((f) => f.file.name !== file.name));

        successCount++;
        message.success(`"${file.name}" đã upload xong`);
      } catch (err) {
        message.error(`"${file.name}" upload thất bại`);
      }
    }

    setUploadStatus(successCount > 0 ? "Upload xong" : "Upload thất bại");
  };

  // Xóa toàn bộ lịch sử chat của cả PaCRAG và GraphRAG trong session hiện tại.
  const handleClearHistory = async () => {
    if (!window.confirm("Bạn có chắc muốn xóa toàn bộ lịch sử chat (PaCRAG + GraphRAG)?")) return;
    try {
      await Promise.allSettled([
        clearHistory(userId || "anonymous"),
        chatService.fetchGraphRAGHistory(userId).then(() =>
          fetch(`${PUBLIC_API_BASE_URL}/langchain/graph/history/${userId || "anonymous"}`, { method: "DELETE" })
        ),
      ]);
      queryClient.invalidateQueries({ queryKey: ["ai_chat_history", userId] });
      queryClient.invalidateQueries({ queryKey: ["graph_chat_history", userId] });
      setRagMessages([]);
      setGraphMessages([]);
      message.success("Đã xóa lịch sử chat (PaCRAG + GraphRAG)");
    } catch (err) {
      message.error("Xóa lịch sử thất bại");
    }
  };

  // Xóa toàn bộ vector store/graph store và dọn compare runs + trạng thái local liên quan.
  const handleClearVectorStore = async () => {
    if (!window.confirm("Bạn có chắc muốn xóa toàn bộ vector store (PaCRAG + GraphRAG)?")) return;
    try {
      // Lấy danh sách compare runs hiện tại để xóa hết
      const currentRuns = compareRuns || [];

      await Promise.allSettled([
        clearVectorStore(),
        chatService.deleteAllGraph(),
        // Xóa toàn bộ compare runs trên server
        ...currentRuns.map((run) => chatService.deleteCompareRun(run.id)),
      ]);

      // Xóa state local và localStorage
      setUploadedFiles([]);
      try { localStorage.removeItem(storageKey); } catch {}

      queryClient.invalidateQueries({ queryKey: ["compare_history", userId] });
      setActiveRunId(null);
      message.success("Đã xóa toàn bộ vector store (PaCRAG + GraphRAG)");
    } catch (err) {
      message.error("Xóa vector store thất bại");
    }
  };

  // Xóa một compare run cụ thể khỏi lịch sử.
  const handleDeleteCompareRun = async (runId: string) => {
    if (!window.confirm("Xóa lần so sánh này?")) return;
    try {
      await chatService.deleteCompareRun(runId);
      queryClient.invalidateQueries({ queryKey: ["compare_history", userId] });
      if (activeRunId === runId) {
        setActiveRunId(null);
      }
    } catch (err) {
      message.error("Xóa thất bại");
    }
  };

  // Render cụm action nhanh cho panel công cụ.
  const renderToolButtons = () => (
    <div className="smartchatbot-toolrail">
      <Tooltip title="Cấu hình chunk">
        <button
          className="smartchatbot-toolbtn"
          title="Cấu hình chunk"
          aria-label="Cấu hình chunk"
          onClick={() =>
            setActiveToolSections((prev) =>
              prev.includes("chunk")
                ? prev.filter((key) => key !== "chunk")
                : [...prev, "chunk"]
            )
          }
        >
          <SettingOutlined />
        </button>
      </Tooltip>
      <Tooltip title="Xóa lịch sử">
        <button
          className="smartchatbot-toolbtn smartchatbot-toolbtn-danger"
          title="Xóa lịch sử"
          aria-label="Xóa lịch sử"
          onClick={handleClearHistory}
          disabled={isClearingHistory}
        >
          <HistoryOutlined />
        </button>
      </Tooltip>
      <Tooltip title={showHistorySidebar ? "Ẩn lịch sử" : "Xem lịch sử chat"}>
        <button
          className={`smartchatbot-toolbtn ${showHistorySidebar ? "border-green-400 bg-green-50" : ""}`}
          title={showHistorySidebar ? "Ẩn lịch sử" : "Xem lịch sử chat"}
          aria-label={showHistorySidebar ? "Ẩn lịch sử" : "Xem lịch sử chat"}
          onClick={() => setShowHistorySidebar((prev) => !prev)}
        >
          <FileTextOutlined />
        </button>
      </Tooltip>
      <Tooltip title="Xóa vector store">
        <button
          className="smartchatbot-toolbtn smartchatbot-toolbtn-danger"
          title="Xóa vector store"
          aria-label="Xóa vector store"
          onClick={handleClearVectorStore}
          disabled={isClearingVector}
        >
          <DatabaseOutlined />
        </button>
      </Tooltip>
    </div>
  );

  // Gửi câu hỏi đồng thời cho PaCRAG (stream) và GraphRAG, sau đó lưu một turn hợp nhất.
  const handleSendMessage = async () => {
    if (!input.trim()) return;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      content: input,
      sender_id: userId,
      role: "user",
      created_at: new Date().toISOString(),
    };

    setGraphMessages((prev) => [...prev, userMsg]);
    setRagMessages((prev) => [...prev, userMsg]);

    const currentInput = input;
    setLastQuery(input);
    setInput("");

    // Dựng message trả lời GraphRAG kèm danh sách nguồn để hiển thị đầy đủ bằng chứng.
    const appendGraphAnswer = (answer: string, sources?: Array<string | { filename?: string; pages?: Array<number | string> }>) => {
      const sourceLines = sources && sources.length > 0
        ? "\n\n" + sources.flatMap((source) => {
            if (typeof source === "string") return [`- Nguồn: ${source}`];
            const filename = source?.filename || "Không rõ";
            const pages = Array.isArray(source?.pages) ? source.pages : [];
            const pageText = pages.length > 0 ? pages.join(", ") : "không xác định";
            return [`- Nguồn: ${filename}`, `- Trang: ${pageText}`];
          }).join("\n")
        : "";
      const fullAnswer = `${answer}${sourceLines}`;
      setGraphMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          content: fullAnswer,
          sender_id: "graph-rag",
          role: "ai",
          created_at: new Date().toISOString(),
        },
      ]);
      return fullAnswer;
    };

    // Chạy PaCRAG stream và GraphRAG song song
    // sendMessage trả về Promise<string> với full answer khi stream xong
    const selectedFiles = uploadedFiles.filter((f) => f.selected);
    // Nếu không có file nào được tích → search toàn bộ (không filter)
    // Nếu có 1 file tích → single filter
    // Nếu có nhiều file tích → multi-source OR filter
    const activeSourceFilter = selectedFiles.length === 1 ? selectedFiles[0].name : null;
    const activeSourceFilters = selectedFiles.length > 1 ? selectedFiles.map((f) => f.name) : null;

    const ragPromise = sendMessage(currentInput, (msg: Message) => {
      if (msg.role === "user") return;
      setRagMessages((prev) => {
        const exist = prev.find((m) => m.id === msg.id);
        if (exist) return prev.map((m) => (m.id === msg.id ? msg : m));
        return [...prev, msg];
      });
    }, activeSourceFilter, activeSourceFilters);

    const graphPromise = (async (): Promise<string> => {
      setIsGraphThinking(true);
      try {
        if (activeRunId) {
          const result = await compareQuery({ runId: activeRunId, query: currentInput, rerankingEnabled, sourceFilter: activeSourceFilter, sourceFilters: activeSourceFilters });
          const run = result?.data?.run;
          const ans = run?.graphrag_query?.answer || "";
          if (ans) {
            const fullAnswer = appendGraphAnswer(ans, run?.graphrag_query?.sources);
            return fullAnswer;
          }
        }
        const fallback = await chatService.graphQuery(currentInput, userId || "anonymous", activeSourceFilter);
        const ans = fallback?.data?.answer || "";
        const fullAnswer = appendGraphAnswer(ans || "GraphRAG chưa có câu trả lời phù hợp.", fallback?.data?.sources);
        return fullAnswer;
      } catch {
        const fullAnswer = appendGraphAnswer("GraphRAG không trả lời được.");
        return fullAnswer;
      } finally {
        setIsGraphThinking(false);
      }
    })();

    // Đợi cả 2 xong → save 1 lần duy nhất vào history
    const [ragFinalAnswer, graphFinalAnswer] = await Promise.all([ragPromise, graphPromise]);

    try {
      await fetch(`${PUBLIC_API_BASE_URL}/langchain/save_turn`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: userId || "anonymous",
          user_content: currentInput,
          rag_content: ragFinalAnswer || null,
          graphrag_content: graphFinalAnswer || null,
        }),
      });

      // Fetch lại history từ server, sau đó clear local state
      // Thứ tự quan trọng: fetch trước → data đã có → clear local → không flash trắng
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ["ai_chat_history", userId] }),
        queryClient.refetchQueries({ queryKey: ["graph_chat_history", userId] }),
      ]);

      // Sau khi history đã load xong, clear local state để tránh duplicate
      setRagMessages([]);
      setGraphMessages([]);
    } catch {
      // Lỗi save: giữ local state, không clear
    }
  };

  if (isLoading && mergedRagMessages.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spin />
      </div>
    );
  }

  return (
    <>
    <div className="min-h-screen flex flex-col smartchatbot-shell">
      <UserHeader />
      <div className="flex-1 flex flex-col min-h-0">
        <div className="p-4 pb-0">
        <div className="mb-3 rounded-2xl smartchatbot-frame p-3">
          <div
            className="flex flex-wrap items-center justify-between gap-3 cursor-pointer select-none"
            onClick={() => setDocPanelOpen((prev) => !prev)}
          >
            <div className="flex items-center gap-2">
              <span
                className={`text-gray-400 transition-transform duration-200 inline-block ${docPanelOpen ? "rotate-90" : "rotate-0"}`}
              >
                ▶
              </span>
              <div>
                <div className="smartchatbot-panel-header">Quản lý tài liệu</div>
                <div className="text-xs smartchatbot-muted">Upload và chọn file để đọc</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="file"
                accept=".pdf,.doc,.docx"
                multiple
                title="Tải tài liệu PDF, DOC, DOCX"
                aria-label="Tải tài liệu PDF, DOC, DOCX"
                onChange={(e) => {
                  const incoming = Array.from(e.target.files || []);
                  if (incoming.length === 0) return;

                  const readyFiles: File[] = [];

                  setFiles((prev) => {
                    const existingKeys = new Set(
                      prev.map((f) => `${f.file.name}_${f.file.size}_${f.file.lastModified}`)
                    );
                    const next = [...prev];
                    incoming.forEach((file) => {
                      const key = `${file.name}_${file.size}_${file.lastModified}`;
                      if (existingKeys.has(key)) return;
                      const ext = file.name.split(".").pop()?.toLowerCase() || "";
                      const mime = (file.type || "").toLowerCase();
                      const isSupported =
                        ["pdf", "doc", "docx"].includes(ext) ||
                        mime === "application/pdf" ||
                        mime === "application/msword" ||
                        mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
                      next.push({
                        file,
                        enabled: isSupported,
                        error: isSupported ? undefined : "Định dạng không hỗ trợ",
                      });
                      if (isSupported) {
                        readyFiles.push(file);
                      }
                    });
                    return next;
                  });

                  // Tính readyFiles độc lập với setFiles để tránh closure async
                  const validFiles = incoming.filter((file) => {
                    const ext = file.name.split(".").pop()?.toLowerCase() || "";
                    const mime = (file.type || "").toLowerCase();
                    return (
                      ["pdf", "doc", "docx"].includes(ext) ||
                      mime === "application/pdf" ||
                      mime === "application/msword" ||
                      mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    );
                  });

                  if (validFiles.length > 0) {
                    void handleUploadDocs(validFiles);
                  } else {
                    message.error("Không có file hợp lệ để upload (chỉ hỗ trợ PDF, DOC, DOCX)");
                  }
                  e.currentTarget.value = "";
                }}
                  className="hidden"
                id="aiWorkspaceUploadInput"
              />
              <Button
                size="small"
                icon={<CloudUploadOutlined />}
                onClick={(e) => {
                  e.stopPropagation();
                  document.getElementById("aiWorkspaceUploadInput")?.click();
                }}
              >
                Chọn file
              </Button>
              {uploadStatus && <div className="smartchatbot-pill" onClick={(e) => e.stopPropagation()}>{uploadStatus}</div>}
              {files.length > 0 && (
                <div className="text-xs smartchatbot-muted" onClick={(e) => e.stopPropagation()}>Đã chọn: {files.length} file</div>
              )}
            </div>
          </div>

          {docPanelOpen && (
          <div className="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="border border-gray-200 rounded-xl p-3 text-xs space-y-2 bg-white">
              <div className="font-semibold">Danh sách file đã chọn</div>
              {files.length === 0 ? (
                <div className="smartchatbot-muted">Chưa có file mới</div>
              ) : (
                <div className="space-y-2 smartchatbot-scrollbox">
                  {files.map((item, idx) => (
                    <div key={`${item.file.name}_${idx}`} className="flex items-start gap-2 smartchatbot-file-row">
                      <input
                        type="checkbox"
                        title={`Chọn đọc file ${item.file.name}`}
                        aria-label={`Chọn đọc file ${item.file.name}`}
                        checked={item.enabled}
                        disabled={!!item.error}
                        onChange={(e) =>
                          setFiles((prev) =>
                            prev.map((f, i) =>
                              i === idx ? { ...f, enabled: e.target.checked } : f
                            )
                          )
                        }
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{item.file.name}</div>
                        {item.error ? (
                          <div className="text-red-500">{item.error}</div>
                        ) : item.enabled ? (
                          <div className="text-green-600">Có thể đọc</div>
                        ) : (
                          <div className="text-gray-500">Bỏ qua khi đọc</div>
                        )}
                      </div>
                      <button
                        className="text-red-500 hover:underline shrink-0"
                        onClick={() => setFiles((prev) => prev.filter((_, i) => i !== idx))}
                      >
                        Xóa
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="border border-gray-200 rounded-xl p-3 text-xs space-y-2 bg-white">
              <div className="font-semibold">File đã upload</div>
              {uploadedFiles.length === 0 ? (
                <div className="smartchatbot-muted">Chưa có file đã upload</div>
              ) : (
                <div className="space-y-2 smartchatbot-scrollbox">
                  {uploadedFiles.map((item, idx) => (
                    <div key={`${item.name}_${idx}`} className="flex items-start gap-2 smartchatbot-file-row">
                      <input
                        type="checkbox"
                        title={`Chọn sử dụng file đã upload ${item.name}`}
                        aria-label={`Chọn sử dụng file đã upload ${item.name}`}
                        checked={item.selected}
                        onChange={(e) =>
                          setUploadedFiles((prev) =>
                            prev.map((f, i) =>
                              i === idx ? { ...f, selected: e.target.checked } : f
                            )
                          )
                        }
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{item.name}</div>
                        <div className="text-green-600">Có thể đọc</div>
                      </div>
                      <button
                        className="text-red-500 hover:underline shrink-0"
                        onClick={() => handleDeleteUploadedFile(item.name)}
                      >
                        Xóa
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          )}
        </div>
        <div className="flex-1 rounded-2xl smartchatbot-frame flex min-h-0 h-[calc(100vh-220px)]">
          {/* Left tools */}
          <div className={`${toolPanelOpen ? "w-[280px]" : "w-[78px]"} border-r border-gray-200 smartchatbot-panel p-3 flex flex-col gap-3 transition-all duration-200`}>
            <div
              className="flex items-center justify-between gap-2 cursor-pointer select-none"
              onClick={() => setToolPanelOpen((prev) => !prev)}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={`text-gray-400 transition-transform duration-200 inline-block ${toolPanelOpen ? "rotate-90" : "rotate-0"}`}
                >
                  ▶
                </span>
                {toolPanelOpen && <div className="smartchatbot-panel-header">Thanh công cụ</div>}
              </div>
            </div>

            {toolPanelOpen && <div className="text-xs smartchatbot-muted"></div>}

            {toolPanelOpen ? (
              <div className="flex-1 flex min-h-0 gap-3">
                {renderToolButtons()}
                <div className="flex-1 min-h-0 overflow-auto pr-1">
                  <Collapse
                    size="small"
                    bordered={false}
                    activeKey={activeToolSections}
                    onChange={(keys) =>
                      setActiveToolSections(Array.isArray(keys) ? keys : [keys])
                    }
                    items={[
                      {
                        key: "chunk",
                        label: "Cấu hình chunk",
                        children: (
                          <div className="grid grid-cols-1 gap-2 text-xs">
                            <label className="flex flex-col gap-1">
                              Parent chunk size
                              <input
                                type="number"
                                title="Parent chunk size"
                                aria-label="Parent chunk size"
                                value={pendingChunkConfig.parent_chunk_size}
                                min={200}
                                onChange={(e) =>
                                  setPendingChunkConfig((prev) => ({
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
                                title="Parent overlap"
                                aria-label="Parent overlap"
                                value={pendingChunkConfig.parent_chunk_overlap}
                                min={0}
                                onChange={(e) =>
                                  setPendingChunkConfig((prev) => ({
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
                                title="Child chunk size"
                                aria-label="Child chunk size"
                                value={pendingChunkConfig.child_chunk_size}
                                min={100}
                                onChange={(e) =>
                                  setPendingChunkConfig((prev) => ({
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
                                title="Child overlap"
                                aria-label="Child overlap"
                                value={pendingChunkConfig.child_chunk_overlap}
                                min={0}
                                onChange={(e) =>
                                  setPendingChunkConfig((prev) => ({
                                    ...prev,
                                    child_chunk_overlap: Number(e.target.value),
                                  }))
                                }
                                className="border border-gray-300 rounded px-2 py-1"
                              />
                            </label>
                            <button
                              className="mt-1 w-full py-1.5 rounded-lg text-xs font-semibold text-white smartchatbot-cta hover:brightness-110 transition"
                              onClick={() => {
                                setChunkConfig(pendingChunkConfig);
                                message.success("Đã áp dụng cấu hình chunk");
                              }}
                            >
                              Apply
                            </button>
                          </div>
                        ),
                      },
                    ]}
                  />
                </div>
              </div>
            ) : (
              <div className="flex-1 flex justify-center">
                {renderToolButtons()}
              </div>
            )}
          </div>

          {/* Middle: RAG + GraphRAG */}
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex-1 grid grid-cols-2 min-h-0">
              <div className="flex flex-col min-h-0 border-r border-gray-200">
                <div className="px-3 py-2 border-b border-gray-200 text-sm font-semibold bg-gray-50">
                  PaCRAG Chatbot
                </div>
                <div className="relative flex-1 min-h-0">
                  <div
                    className="absolute inset-0 overflow-y-auto p-3 smartchatbot-messages smartchatbot-chat-scroll"
                    ref={messagesRef}
                    onScroll={handleRagScroll}
                  >
                    {mergedRagMessages.length === 0 ? (
                      <Empty description="Bắt đầu trò chuyện với PaCRAG" style={{ marginTop: "80px" }} />
                    ) : (
                      <>
                        {mergedRagMessages.map((m: Message) => (
                          <MessageBubble key={m.id} msg={m} currentUserId={userId} />
                        ))}
                        {isStreaming && (
                          <div className="flex justify-start">
                            <div className="max-w-[78%] p-3 bg-white border border-gray-200">
                              <div className="text-sm">PaCRAG đang gõ<span className="animate-pulse">...</span></div>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  {showRagScrollBtn && (
                    <button
                      onClick={scrollRagToBottom}
                      className="smartchatbot-scroll-btn"
                      title="Cuộn xuống tin mới nhất"
                    >
                      ↓
                    </button>
                  )}
                </div>
              </div>
              <div className="flex flex-col min-h-0">
                <div className="px-3 py-2 border-b border-gray-200 text-sm font-semibold bg-gray-50">
                  GraphRAG Chatbot
                </div>
                <div className="relative flex-1 min-h-0">
                  <div
                    className="absolute inset-0 overflow-y-auto p-3 smartchatbot-messages smartchatbot-chat-scroll"
                    ref={graphMessagesRef}
                    onScroll={handleGraphScroll}
                  >
                    {mergedGraphMessages.length === 0 ? (
                      <Empty description="Bắt đầu trò chuyện với GraphRAG" style={{ marginTop: "80px" }} />
                    ) : (
                      <>
                        {mergedGraphMessages.map((m: Message) => (
                          <MessageBubble key={m.id} msg={m} currentUserId={userId} />
                        ))}
                        {(isComparingQuery || isGraphThinking) && (
                          <div className="flex justify-start">
                            <div className="max-w-[78%] p-3 bg-white border border-gray-200">
                              <div className="text-sm">GraphRAG đang gõ<span className="animate-pulse">...</span></div>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  {showGraphScrollBtn && (
                    <button
                      onClick={scrollGraphToBottom}
                      className="smartchatbot-scroll-btn"
                      title="Cuộn xuống tin mới nhất"
                    >
                      ↓
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="border-t border-gray-200 p-3 bg-white">
              <div className="flex flex-col gap-2">
                {/* Re-ranking toggle */}
                {activeRunId && (
                  <div className="flex items-center gap-2 text-xs">
                    <label className="flex items-center gap-1.5 cursor-pointer select-none text-gray-600">
                      <input
                        type="checkbox"
                        checked={rerankingEnabled}
                        onChange={(e) => setRerankingEnabled(e.target.checked)}
                        className="w-3.5 h-3.5 accent-blue-500"
                      />
                      <span
                        title="Re-ranking dùng LLM để chấm điểm lại từng đoạn văn bản sau khi truy xuất (0-10), sắp xếp lại theo mức độ liên quan với câu hỏi. Giúp cải thiện chất lượng câu trả lời nhưng tăng thời gian xử lý (~2-5s thêm mỗi đoạn)."
                        className="cursor-help border-b border-dashed border-gray-400"
                      >
                        Bật re-ranking
                      </span>
                    </label>
                    {rerankingEnabled && (
                      <span className="text-[10px] text-orange-500">⚠ Chậm hơn</span>
                    )}
                  </div>
                )}
                <textarea
                  className="w-full border border-gray-300 rounded-xl p-3 resize-none focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none text-sm"
                  rows={3}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  disabled={isStreaming}
                  placeholder="Nhập câu hỏi để gửi cả PaCRAG và GraphRAG..."
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleSendMessage}
                    disabled={isStreaming || !input.trim()}
                    className="flex-1 px-4 py-2 text-white rounded-xl smartchatbot-cta hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    {isStreaming ? "Đang trả lời..." : "Gửi"}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Right: History Sidebar */}
          {showHistorySidebar && (
            <div className="w-[280px] border-l border-gray-200 smartchatbot-panel flex flex-col">
              <div className="px-3 py-2 border-b border-gray-200 text-sm font-semibold bg-white flex items-center justify-between">
                <span>Lịch sử chat</span>
                <button
                  className="text-gray-400 hover:text-gray-600 text-xs"
                  onClick={() => setShowHistorySidebar(false)}
                >✕</button>
              </div>
              <div className="flex-1 overflow-y-auto p-2 text-xs space-y-1 smartchatbot-chat-scroll">
                {mergedRagMessages.length === 0 && mergedGraphMessages.length === 0 ? (
                  <div className="text-gray-400 p-2">Chưa có lịch sử chat</div>
                ) : (
                  <>
                    {/* PaCRAG history */}
                    {mergedRagMessages.filter((m: Message) => m.role === 'user').length > 0 && (
                      <div className="mb-2">
                        <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide px-1 mb-1">PaCRAG</div>
                        {mergedRagMessages
                          .filter((m: Message) => m.role === 'user')
                          .map((m: Message, i: number) => (
                            <div
                              key={m.id || i}
                              className="px-2 py-1.5 rounded-lg hover:bg-gray-100 cursor-pointer text-gray-700 truncate"
                              title={m.content}
                            >
                              <span className="text-blue-500 mr-1">Q:</span>
                              {m.content?.slice(0, 60)}{m.content?.length > 60 ? "..." : ""}
                            </div>
                          ))}
                      </div>
                    )}
                    {/* GraphRAG history */}
                    {mergedGraphMessages.filter((m: Message) => m.role === 'user').length > 0 && (
                      <div>
                        <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide px-1 mb-1">GraphRAG</div>
                        {mergedGraphMessages
                          .filter((m: Message) => m.role === 'user')
                          .map((m: Message, i: number) => (
                            <div
                              key={m.id || i}
                              className="px-2 py-1.5 rounded-lg hover:bg-gray-100 cursor-pointer text-gray-700 truncate"
                              title={m.content}
                            >
                              <span className="text-green-500 mr-1">Q:</span>
                              {m.content?.slice(0, 60)}{m.content?.length > 60 ? "..." : ""}
                            </div>
                          ))}
                      </div>
                    )}
                  </>
                )}
              </div>
              <div className="p-2 border-t border-gray-100">
                <button
                  className="w-full py-1.5 text-xs text-red-600 hover:text-red-700 hover:bg-red-100 rounded-lg transition disabled:text-red-300"
                  onClick={handleClearHistory}
                  disabled={isClearingHistory}
                >
                  Xóa toàn bộ lịch sử
                </button>
              </div>
            </div>
          )}

          {/* Right: Compare metrics - đã chuyển xuống dưới */}
        </div>
      </div>
        </div>{/* end p-4 pb-0 */}

      {/* So sánh PaCRAG vs GraphRAG - section riêng bên dưới */}
      <div className="mx-4 mb-4 rounded-2xl smartchatbot-frame">
        <div className="px-4 py-3 border-b border-gray-200 bg-white rounded-t-2xl flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold">So sánh PaCRAG vs GraphRAG</div>
            <div className="text-[11px] text-gray-400 mt-0.5"></div>
          </div>
          {isComparingQuery && (
            <div className="flex items-center gap-2 text-xs text-blue-500">
              <Spin size="small" />
              <span>Đang so sánh...</span>
            </div>
          )}
        </div>
        <div className="p-4 text-xs">
          {isCompareHistoryLoading ? (
            <div className="flex items-center gap-2 text-gray-400 py-4">
              <Spin size="small" />
              <span>Đang tải dữ liệu so sánh...</span>
            </div>
          ) : queryRuns.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-gray-400 gap-2">
              <div className="text-2xl">📊</div>
              <div className="font-medium">Chưa có dữ liệu so sánh</div>
              <div className="text-[11px] text-center">Gửi câu hỏi để xem kết quả so sánh PaCRAG vs GraphRAG tại đây</div>
            </div>
          ) : (
            <div className="space-y-4">
              <CompareRunsTable
                runs={queryRuns}
                activeRunId={activeRunId}
                onSelectRun={setActiveRunId}
                onDeleteRun={handleDeleteCompareRun}
              />

              {/* Chi tiết run đang chọn */}
              {activeRun && (
                <CompareRunDetailsCard
                  activeRun={activeRun}
                  isComparingQuery={isComparingQuery}
                  compareTab={compareTab}
                  onCompareTabChange={setCompareTab}
                  retrieverChartData={retrieverChartData}
                  generatorChartData={generatorChartData}
                  lastQuery={lastQuery}
                  onOpenCitation={(passage, query) => setCitationModal({ open: true, passage, query })}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
    <CitationModal state={citationModal} onClose={() => setCitationModal({ open: false, passage: null, query: "" })} />
    </>
  );
}
