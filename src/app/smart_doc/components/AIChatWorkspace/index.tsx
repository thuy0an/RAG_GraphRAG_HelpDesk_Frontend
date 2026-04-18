import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { queryClient, useMutation, useQuery } from "@/shared/lib/ReactQuery";
import { useAuthStore } from "@/app/auth/store";
import UserHeader from "@/shared/components/UserHeader";
import { Button, Collapse, Empty, message, Popconfirm, Spin, Tooltip } from "antd";
import {
  CloudUploadOutlined,
  DatabaseOutlined,
  HistoryOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import type { Message } from "../../types";
import { MessageRole } from "../../types";
import { ChatService, CompareService, StorageService, AIService, GraphService } from "../../service";
import { useAIChat, usePACRAGHistory, useGraphRAGHistory, useStorageFiles, useChatActions } from "../../hooks";
import { MessageBubble } from "../components";

const chatService = new ChatService();
const compareService = new CompareService();
const storageService = new StorageService();
const aiService = new AIService();
const graphService = new GraphService();

interface ChunkConfig {
  parent_chunk_size: number;
  parent_chunk_overlap: number;
  child_chunk_size: number;
  child_chunk_overlap: number;
}

export function AIChatWorkspace() {
  const { payload } = useAuthStore();
  const userId = payload?.user_id || "";

  // Fetch files from storage API instead of localStorage
  const { data: storageFilesData, refetch: refetchStorageFiles } = useStorageFiles();
  const storageFiles = storageFilesData?.result?.content || [];

  // Get delete file action
  const { deleteFile, isDeletingFile } = useChatActions();

  const {
    isLoading,
    isStreaming,
    sendMessage
  } = useAIChat(userId);

  const pacragHistoryQuery = usePACRAGHistory(userId);
  const graphragHistoryQuery = useGraphRAGHistory(userId);

  const [input, setInput] = useState("");
  const [files, setFiles] = useState<Array<{ file: File; enabled: boolean; error?: string }>>([]);
  const [activeToolSections, setActiveToolSections] = useState<string[]>(["upload", "chunk", "files"]);
  const [docPanelOpen, setDocPanelOpen] = useState(true);
  const [chunkConfig, setChunkConfig] = useState<ChunkConfig>({
    parent_chunk_size: 2048,
    parent_chunk_overlap: 400,
    child_chunk_size: 512,
    child_chunk_overlap: 100,
  });

  const [graphMessages, setGraphMessages] = useState<Message[]>([]);
  const [pacMessages, setPacMessages] = useState<Message[]>([]);
  const [isPACRAGThinking, setIsPACRAGThinking] = useState(false);
  const [isGraphRAGThinking, setIsGraphRAGThinking] = useState(false);

  // Load conversation history for GraphRAG messages
  useEffect(() => {
    if (graphragHistoryQuery.data?.result) {
      const seen = new Set<string>();
      const uniqueMessages = graphragHistoryQuery.data.result.filter((msg: any) => {
        if (seen.has(msg.id)) return false;
        seen.add(msg.id);
        return true;
      }).map((msg: any) => ({
        ...msg,
        sender_id: msg.session_id,
      }));
      setGraphMessages(uniqueMessages);
    }
  }, [graphragHistoryQuery.data]);

  // Load conversation history for PaCRAG messages
  useEffect(() => {
    if (pacragHistoryQuery.data?.result) {
      const seen = new Set<string>();
      const uniqueMessages = pacragHistoryQuery.data.result.filter((msg: any) => {
        if (seen.has(msg.id)) return false;
        seen.add(msg.id);
        return true;
      }).map((msg: any) => ({
        ...msg,
        sender_id: msg.session_id,
      }));
      setPacMessages(uniqueMessages);
    }
  }, [pacragHistoryQuery.data]);
  
  const [isGraphThinking, setIsGraphThinking] = useState(false);
  // Track selected file names from storage API
  const [selectedFileNames, setSelectedFileNames] = useState<string[]>([]);

  const mergedPacMessages = useMemo(() => {
    const normalizeTime = (msg: any) => {
      const raw = msg.created_at || msg.timestamp || "";
      if (!raw) return "";
      const date = new Date(raw);
      if (Number.isNaN(date.getTime())) return "";
      return date.toISOString().slice(0, 16);
    };

    const seen = new Set<string>();
    const merged: Message[] = [];

    [...pacMessages].forEach((msg: any) => {
      const timeKey = normalizeTime(msg);
      const key = `${msg.id || ""}|${msg.role || ""}|${msg.sender_id || ""}|${msg.content || ""}|${timeKey}`;
      if (seen.has(key)) return;
      seen.add(key);
      merged.push(msg);
    });

    return merged;
  }, [pacMessages]);

  const messagesRef = useRef<HTMLDivElement>(null);
  const graphMessagesRef = useRef<HTMLDivElement>(null);
  const [showPacScrollBtn, setShowPacScrollBtn] = useState(false);
  const [showGraphScrollBtn, setShowGraphScrollBtn] = useState(false);

  const handleRagScroll = useCallback(() => {
    const el = messagesRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowPacScrollBtn(distFromBottom > 100);
  }, []);

  const handleGraphScroll = useCallback(() => {
    const el = graphMessagesRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowGraphScrollBtn(distFromBottom > 100);
  }, []);

  const scrollRagToBottom = useCallback(() => {
    const el = messagesRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, []);

  const scrollGraphToBottom = useCallback(() => {
    const el = graphMessagesRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, []);

  const [activeRunId, setActiveRunId] = useState<string | null>(null);

  const { data: compareHistory, isLoading: isCompareHistoryLoading } = useQuery({
    queryKey: ["compare_history", userId || "anonymous"],
    queryFn: () => compareService.fetchCompareHistory(userId || "anonymous"),
    enabled: true,
  }, queryClient);

  const compareRuns = compareHistory?.result?.runs || [];

  useEffect(() => {
    if (!activeRunId && compareRuns.length > 0) {
      setActiveRunId(compareRuns[0].id);
    }
  }, [compareRuns, activeRunId]);

  // Sync selected files with storage API data - select all new files by default
  useEffect(() => {
    if (storageFiles.length > 0) {
      setSelectedFileNames((prev) => {
        const existing = new Set(prev);
        storageFiles.forEach((file: any) => {
          if (file.file_name && !existing.has(file.file_name)) {
            existing.add(file.file_name);
          }
        });
        return Array.from(existing);
      });
    }
  }, [storageFiles]);

  const activeRun = compareRuns.find((run: any) => run.id === activeRunId) || null;

  const { mutateAsync: uploadDocs, isPending: isUploading } = useMutation({
    mutationFn: (payload: { files: File[]; config: ChunkConfig }) =>
      compareService.uploadCompare(userId || "anonymous", payload.files, payload.config),
    onSuccess: (data) => {
      const runs = data?.data?.runs || [];
      if (runs.length > 0) {
        setActiveRunId(runs[0].id);
      }
      queryClient.invalidateQueries({ queryKey: ["compare_history", userId] });
      // Refetch storage files after upload
      queryClient.invalidateQueries({ queryKey: ["storage_files"] });
    }
  }, queryClient);

  const { mutateAsync: compareQuery, isPending: isComparingQuery } = useMutation({
    mutationFn: (payload: { runId: string; query: string }) =>
      compareService.compareQuery(userId || "anonymous", payload.runId, payload.query),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["compare_history", userId] });
    }
  }, queryClient);

  const { mutateAsync: clearHistory, isPending: isClearingHistory } = useMutation({
    mutationFn: (sessionId: string) => chatService.clearHistory(sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai_chat_history", userId] });
      setPacMessages([]);
    }
  }, queryClient);

  const { mutateAsync: clearVectorStore, isPending: isClearingVector } = useMutation({
    mutationFn: () => aiService.clearVectorStore(),
  }, queryClient);

  useEffect(() => {
    const el = messagesRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [mergedPacMessages.length]);

  useEffect(() => {
    const el = graphMessagesRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [graphMessages.length]);

  const handleUploadDocs = async (overrideFiles?: File[]) => {
    const readyFiles = overrideFiles || files.filter((f) => f.enabled && !f.error).map((f) => f.file);
    if (readyFiles.length === 0) {
      message.error("Chưa có file hợp lệ để upload");
      return;
    }
    try {
      await uploadDocs({ files: readyFiles, config: chunkConfig });
      message.success("Tải tài liệu thành công (PaCRAG + GraphRAG)");
      // Add newly uploaded files to selected list
      setSelectedFileNames((prev) => {
        const existing = new Set(prev);
        readyFiles.forEach((file) => {
          if (!existing.has(file.name)) {
            existing.add(file.name);
          }
        });
        return Array.from(existing);
      });
      setFiles([]);
    } catch (err) {
      message.error("Tải tài liệu thất bại");
    }
  };

  const handleDeleteFile = async (fileId: string, fileName: string) => {
    try {
      await deleteFile(fileId);
      // Also remove from selected files if it was selected
      setSelectedFileNames((prev) => prev.filter((name) => name !== fileName));
      message.success(`Đã xóa file "${fileName}"`);
    } catch (err) {
      message.error(`Xóa file "${fileName}" thất bại`);
    }
  };

  const handleClearHistory = async () => {
    if (!window.confirm("Bạn có chắc muốn xóa toàn bộ lịch sử chat?")) return;
    try {
      await clearHistory(userId || "anonymous");
      message.success("Đã xóa lịch sử chat");
      setGraphMessages([]);
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
    if (!window.confirm("Xóa lần so sánh này?")) return;
    try {
      await compareService.deleteCompareRun(runId);
      queryClient.invalidateQueries({ queryKey: ["compare_history", userId] });
      if (activeRunId === runId) {
        setActiveRunId(null);
      }
    } catch (err) {
      message.error("Xóa thất bại");
    }
  };

  const handleSendMessage = useCallback(async () => {
    if (!input.trim()) return;

    const sharedUserMsgId = crypto.randomUUID();

    const graphUserMsg: Message = {
      id: sharedUserMsgId,
      content: input,
      role: MessageRole.GRAPHRAG_USER,
      sender_id: userId,
      created_at: new Date().toISOString(),
    };

    // Add user message to graphMessages only (PaCRAG will be handled by sendMessage callback)
    setGraphMessages(prev => [...prev, graphUserMsg]);
    setInput('');

    // Set loading states
    setIsPACRAGThinking(true);
    setIsGraphRAGThinking(true);

    let pacAiMessageId: string | null = null;

    // Call PaCRAG API
    sendMessage(input, (msg: any) => {
      setPacMessages(prev => {
        // If this is the AI message (not user message), track its ID
        if (msg.role === MessageRole.PACRAG_ASSISTANT || msg.sender_id === 'ai-assistant') {
          if (!pacAiMessageId) {
            pacAiMessageId = msg.id;
          }

          // Find and update existing AI message
          const existingIndex = prev.findIndex(m => m.id === pacAiMessageId);
          if (existingIndex >= 0) {
            const updated = [...prev];
            updated[existingIndex] = { ...msg, id: pacAiMessageId };
            return updated;
          } else {
            // Add new AI message
            return [...prev, { ...msg, id: pacAiMessageId }];
          }
        } else {
          // This is user message from sendMessage, add it
          const existingIndex = prev.findIndex(m => m.id === sharedUserMsgId);
          if (existingIndex >= 0) {
            return prev; // Already exists, don't duplicate
          }
          return [...prev, { ...msg, id: sharedUserMsgId }];
        }
      });

      // Only set loading = false when AI message is complete (has content)
      if (msg.role === MessageRole.PACRAG_ASSISTANT || msg.sender_id === 'ai-assistant') {
        if (msg.content && msg.content.length > 0) {
          setIsPACRAGThinking(false);
        }
      }
    });

    // Call GraphRAG API
    const appendGraphAnswer = (answer: string, sources?: string[]) => {
      const sourceLines = sources && sources.length > 0
        ? `\n\nNguồn: ${sources.join(", ")}`
        : "";
      setGraphMessages(prev => [
        ...prev,
        {
          id: crypto.randomUUID(),
          content: `${answer}${sourceLines}`,
          sender_id: "graph-rag",
          role: MessageRole.GRAPHRAG_ASSISTANT,
          created_at: new Date().toISOString(),
        },
      ]);
      setIsGraphRAGThinking(false);
    };

    void (async () => {
      try {
        const selectedSource = selectedFileNames.length > 0 ? selectedFileNames[0] : null;
        if (activeRunId) {
          const result = await compareQuery({ runId: activeRunId, query: input });
          const run = result?.result?.run;
          const graphAnswer = run?.graphrag_query?.answer || "";
          if (graphAnswer) {
            appendGraphAnswer(graphAnswer, run?.graphrag_query?.sources);
            return;
          }
        }

        const fallback = await graphService.graphQuery(input, userId || "anonymous");
        const answer = fallback?.result?.answer || "";
        if (answer) {
          appendGraphAnswer(answer, fallback?.result?.sources);
        } else {
          appendGraphAnswer("GraphRAG chưa có câu trả lời phù hợp.");
        }
      } catch (err) {
        appendGraphAnswer("GraphRAG không trả lời được.");
      }
    })();
  }, [input, userId, sendMessage, compareQuery, selectedFileNames, activeRunId, graphService]);

  if (isLoading && mergedPacMessages.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spin />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col smartchatbot-shell">
      <UserHeader />
      <div className="flex-1 p-4 min-h-0 flex flex-col">
        <div className="mb-3 rounded-2xl smartchatbot-frame p-3">
          <div
            className="flex flex-wrap items-center justify-between gap-3 cursor-pointer select-none"
            onClick={() => setDocPanelOpen((prev) => !prev)}
          >
            <div className="flex items-center gap-2">
              <span
                className="text-gray-400 transition-transform duration-200"
                style={{ display: "inline-block", transform: docPanelOpen ? "rotate(90deg)" : "rotate(0deg)" }}
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
                onChange={(e) => {
                  const incoming = Array.from(e.target.files || []);
                  let validCount = 0;
                  let invalidCount = 0;
                  setFiles((prev) => {
                    const existingKeys = new Set(
                      prev.map((f) => `${f.file.name}_${f.file.size}_${f.file.lastModified}`)
                    );
                    const next = [...prev];
                    incoming.forEach((file) => {
                      const key = `${file.name}_${file.size}_${file.lastModified}`;
                      const ext = file.name.split(".").pop()?.toLowerCase() || "";
                      const isSupported = ["pdf", "doc", "docx"].includes(ext);
                      if (existingKeys.has(key)) {
                        return;
                      }
                      next.push({
                        file,
                        enabled: isSupported,
                        error: isSupported ? undefined : "Định dạng không hỗ trợ",
                      });
                      if (isSupported) {
                        validCount++;
                      } else {
                        invalidCount++;
                      }
                    });
                    return next;
                  });
                  if (validCount > 0) {
                    message.success(`Đã chọn ${validCount} file`);
                  }
                  if (invalidCount > 0) {
                    message.warning(`${invalidCount} file không được hỗ trợ (chỉ nhận PDF, DOC, DOCX)`);
                  }
                  e.currentTarget.value = "";
                }}
                style={{ display: "none" }}
                id="aiWorkspaceUploadInput"
              />
            </div>
          </div>

          {docPanelOpen && (
          <div className="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-3">
            {/* File đã chọn (chưa upload) */}
            <div className="border border-blue-200 rounded-xl p-3 text-xs space-y-2 bg-blue-50">
              <div className="font-semibold text-blue-700">
                {files.length > 0 ? `File đã chọn (${files.length})` : "Chọn file để upload"}
              </div>
              {files.length === 0 ? (
                <div className="text-gray-500">Chưa có file nào được chọn</div>
              ) : (
                <div className="space-y-2 smartchatbot-scrollbox max-h-[150px]">
                  {files.map((item, idx) => (
                    <div key={`${item.file.name}_${idx}`} className="flex items-start gap-2 smartchatbot-file-row">
                      <input
                        type="checkbox"
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
              <div className="flex gap-2">
                <Button
                  size="small"
                  onClick={() => document.getElementById("aiWorkspaceUploadInput")?.click()}
                >
                  Chọn file
                </Button>
                {files.length > 0 && (
                  <Button
                    type="primary"
                    size="small"
                    onClick={() => handleUploadDocs()}
                    loading={isUploading}
                    disabled={files.length === 0}
                  >
                    {isUploading ? "Đang upload..." : `Upload ${files.length} file${files.length > 1 ? 's' : ''}`}
                  </Button>
                )}
              </div>
            </div>

            <div className="border border-gray-200 rounded-xl p-3 text-xs space-y-2 bg-white">
              <div className="font-semibold">File đã upload</div>
              {storageFiles.length === 0 ? (
                <div className="smartchatbot-muted">Chưa có file đã upload</div>
              ) : (
                <div className="space-y-2 smartchatbot-scrollbox">
                  {storageFiles.map((item: any, idx: number) => (
                    <div key={`${item.file_name}_${idx}`} className="flex items-start gap-2 smartchatbot-file-row">
                      <input
                        type="checkbox"
                        checked={selectedFileNames.includes(item.file_name)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedFileNames((prev) => [...prev, item.file_name]);
                          } else {
                            setSelectedFileNames((prev) => prev.filter((name) => name !== item.file_name));
                          }
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{item.file_name}</div>
                        <div className="text-green-600">Có thể đọc</div>
                      </div>
                      <Popconfirm
                        title="Xác nhận xóa"
                        description={`Xóa file "${item.file_name}"?`}
                        onConfirm={() => handleDeleteFile(item.id, item.file_name)}
                        okText="Xóa"
                        cancelText="Hủy"
                        okButtonProps={{ danger: true, size: "small" }}
                      >
                        <button
                          className="text-red-500 hover:underline shrink-0"
                          disabled={isDeletingFile}
                        >
                          Xóa
                        </button>
                      </Popconfirm>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          )}
        </div>
        <div className="flex-1 rounded-2xl smartchatbot-frame flex min-h-0">
          {/* Left tools */}
          <div className="w-[280px] border-r border-gray-200 smartchatbot-panel p-3 flex flex-col gap-3">
            <div className="smartchatbot-panel-header">Thanh công cụ</div>
            <div className="text-xs smartchatbot-muted">Các thao tác nhanh và cấu hình</div>
            <div className="flex-1 flex min-h-0 gap-3">
              <div className="smartchatbot-toolrail">
                <Tooltip title="Cấu hình chunk">
                  <button
                    className="smartchatbot-toolbtn"
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
                    className="smartchatbot-toolbtn"
                    onClick={handleClearHistory}
                    disabled={isClearingHistory}
                  >
                    <HistoryOutlined />
                  </button>
                </Tooltip>
                <Tooltip title="Xóa vector store">
                  <button
                    className="smartchatbot-toolbtn"
                    onClick={handleClearVectorStore}
                    disabled={isClearingVector}
                  >
                    <DatabaseOutlined />
                  </button>
                </Tooltip>
              </div>
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
                      ),
                    },
                  ]}
                />
              </div>
            </div>
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
                    {pacMessages.length === 0 ? (
                      <Empty description="Bắt đầu trò chuyện với PaCRAG" style={{ marginTop: "80px" }} />
                    ) : (
                      <>
                        {pacMessages.map((m: any, index: number) => (
                          <MessageBubble key={`${m.id}-${m.role || 'unknown'}-${index}`} message={m} currentUserId={userId} />
                        ))}
                        {isPACRAGThinking && (
                          <div className="flex justify-start">
                            <div className="max-w-[78%] p-3 bg-white border border-gray-200">
                              <div className="text-sm">PaCRAG đang gõ<span className="animate-pulse">...</span></div>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  {showPacScrollBtn && (
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
                    {graphMessages.length === 0 ? (
                      <Empty description="Bắt đầu trò chuyện với GraphRAG" style={{ marginTop: "80px" }} />
                    ) : (
                      <>
                        {graphMessages.map((m: any, index: number) => (
                          <MessageBubble key={`${m.id}-${m.role || 'unknown'}-${index}`} message={m} currentUserId={userId} />
                        ))}
                        {(isComparingQuery || isGraphRAGThinking) && (
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

          {/* Right: Compare metrics */}
          <div className="w-[300px] border-l border-gray-200 smartchatbot-panel flex flex-col">
            <div className="px-3 py-2 border-b border-gray-200 text-sm font-semibold bg-white">
              So sánh PaCRAG vs GraphRAG
            </div>
            <div className="flex-1 overflow-auto p-3 text-xs space-y-3">
              {isCompareHistoryLoading ? (
                <div>Đang tải lịch sử...</div>
              ) : compareRuns.length === 0 ? (
                <div>Chưa có dữ liệu so sánh</div>
              ) : (
                <div
                  className="space-y-2 smartchatbot-compare-scroll"
                >
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
          </div>
        </div>
      </div>
    </div>
  );
}
