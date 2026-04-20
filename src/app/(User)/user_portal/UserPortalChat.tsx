import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import { queryClient, useMutation, useQuery } from "@/lib/ReactQuery";
import UserHeader from "@/components/UserHeader";
import { Button, Collapse, Empty, Image, message, Spin, Tooltip } from "antd";
import { Column } from "@ant-design/charts";
import {
  CloudUploadOutlined,
  CloseOutlined,
  DatabaseOutlined,
  FileTextOutlined,
  HistoryOutlined,
  PaperClipOutlined,
  QuestionCircleOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import { PUBLIC_API_BASE_URL, PUBLIC_WS_BASE_URL } from "@/constants/constant";
import dayjs from "dayjs";
import { logger } from "@/utils/logger";


// ===== TYPES =====
interface Message {
  id: string;
  sender_id: string;
  content: string;
  created_at?: string;
  conversation_key?: string;
  role?: 'user' | 'ai';
}

// interface AIChatHistoryHook {
//   messages: Message[];
//   isLoading: boolean;
//   error: string | null;
//   pageInfo: {
//     page_number: number;
//     page_size: number;
//     total_elements: number;
//   };
//   fetchMessages: (page?: number) => void;
//   clearMessages: () => void;
//   loadMore: () => void;
// }

interface TypingState {
  isTyping: boolean;
  sender_id?: string;
}

interface WebSocketHookReturn {
  isConnected: boolean;
  typingState: TypingState;
  sendMessage: (content: string) => void;
}

interface ChatModeToggleProps {
  mode: 'ai' | 'chat';
  onToggle: () => void;
  disabled?: boolean;
}

interface ChatState {
  response: string;
  isStreaming: boolean;
  error: string | null;
}

export type {
  ChatState,
  Message,
  TypingState,
  WebSocketHookReturn,
  ChatModeToggleProps
}

interface RetrievedPassage {
  content: string;
  filename: string;
  pages: number[];
}

interface QueryMetrics {
  answer?: string;
  time_total_s?: number | null;
  answer_tokens?: number | null;
  word_count?: number | null;
  relevance_score?: number | null;
  source_coverage?: number | null;
  retrieved_chunk_count?: number | null;
  retrieved_chunks?: RetrievedPassage[];   // PaCRAG
  doc_passages?: RetrievedPassage[];       // GraphRAG
  sources?: { filename: string; pages: number[] }[];
  confidence_score?: number | null;
  reranking_scores?: number[] | null;
  reranking_time_s?: number | null;
  metric_groups?: {
    retrieval_metrics?: {
      context_relevance?: number | null;
      context_recall?: number | null;
      context_precision?: number | null;
      source_coverage?: number | null;
      reranking_summary?: {
        avg?: number | null;
      } | null;
    };
    generation_metrics?: {
      faithfulness_groundedness?: number | null;
      answer_relevancy?: number | null;
      answer_correctness?: number | null;
      faithfulness_proxy?: number | null;
      answer_relevance_proxy?: number | null;
    };
  };
}

interface CitationModalState {
  open: boolean;
  passage: RetrievedPassage | null;
  query: string;
}

// ===== CONSTANTS =====
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

// ===== UTILITIES =====
export class Utility {
  static formatVietnameseDate = (dateString: string) => {
    if (!dateString) return "";
    const date = dayjs(dateString);
    return date.isValid() ? `${date.date()} Tháng ${date.month() + 1} ${date.year()}` : "";
  };

  static getFilenameFromUrl = (url: string) => {
    const parts = url.split('/');
    const lastPart = parts[parts.length - 1];
    return lastPart.split('?')[0];
  };

  static getFileExtension = (url: string) => {
    const filename = this.getFilenameFromUrl(url);
    const parts = filename.split('.');
    return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
  };

  static isImageUrl = (url: string) => {
    const ext = this.getFileExtension(url);
    return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext);
  };

  static isDocumentUrl = (url: string) => {
    const ext = this.getFileExtension(url);
    return ['pdf', 'doc', 'docx'].includes(ext);
  };
}

type MetricKey = 'time_total_s' | 'relevance_score' | 'source_coverage' | 'word_count';

const METRIC_TOOLTIP_TEXT: Record<string, string> = {
  relevance_score: "Độ tương đồng ngữ nghĩa giữa câu hỏi và câu trả lời.  ",
  source_coverage: "Tỷ lệ nguồn truy xuất hữu ích được dùng để tạo câu trả lời.  ",
  confidence_score: "Mức tự tin của hệ thống cho câu trả lời hiện tại (0-100%).  ",
  context_relevance: "Mức độ các đoạn được truy xuất thực sự liên quan đến câu hỏi.",
  context_recall: "Khả năng tìm đủ thông tin cần thiết trong kho tri thức.",
  context_precision: "Mức độ tài liệu liên quan được xếp hạng cao trong top-K.",
  faithfulness_groundedness: "Mức độ câu trả lời bám sát ngữ cảnh truy xuất, giảm hallucination.",
  answer_relevancy: "Mức độ câu trả lời giải quyết trực tiếp câu hỏi người dùng.",
  answer_correctness: "Mức độ đúng của câu trả lời so với đáp án chuẩn (ground truth/proxy).",
};

function normalizeUnitScore(value: unknown): number | null {
  if (typeof value !== "number" || Number.isNaN(value)) return null;
  if (value <= 0) return 0;
  if (value <= 1) return value;
  if (value <= 10) return value / 10;
  if (value <= 100) return value / 100;
  return 1;
}

function metricDescription(metricKey: string) {
  return METRIC_TOOLTIP_TEXT[metricKey] || "";
}

interface ChartMetricDatum {
  metric: string;
  model: string;
  score: number;
  description: string;
}

function readRetrieverScores(metrics: QueryMetrics | null | undefined) {
  const groups = metrics?.metric_groups?.retrieval_metrics;
  const rerankingAvg = groups?.reranking_summary?.avg;
  const fallbackPrecision = normalizeUnitScore(rerankingAvg) ?? normalizeUnitScore(metrics?.source_coverage);

  return {
    context_relevance: normalizeUnitScore(groups?.context_relevance) ?? normalizeUnitScore(metrics?.relevance_score),
    context_recall: normalizeUnitScore(groups?.context_recall) ?? normalizeUnitScore(metrics?.source_coverage),
    context_precision: normalizeUnitScore(groups?.context_precision) ?? fallbackPrecision,
  };
}

function readGeneratorScores(metrics: QueryMetrics | null | undefined) {
  const groups = metrics?.metric_groups?.generation_metrics;
  const faithfulness = normalizeUnitScore(groups?.faithfulness_groundedness)
    ?? normalizeUnitScore(groups?.faithfulness_proxy)
    ?? normalizeUnitScore(metrics?.confidence_score);
  const answerRelevancy = normalizeUnitScore(groups?.answer_relevancy)
    ?? normalizeUnitScore(groups?.answer_relevance_proxy)
    ?? normalizeUnitScore(metrics?.relevance_score);
  const answerCorrectness = normalizeUnitScore(groups?.answer_correctness)
    ?? ((faithfulness != null && answerRelevancy != null) ? (faithfulness + answerRelevancy) / 2 : null);

  return {
    faithfulness_groundedness: faithfulness,
    answer_relevancy: answerRelevancy,
    answer_correctness: answerCorrectness,
  };
}

export function isBetter(
  metric: MetricKey,
  side: 'pac' | 'graph',
  pac: QueryMetrics | null | undefined,
  graph: QueryMetrics | null | undefined
): boolean {
  const pacVal = pac?.[metric] ?? null;
  const graphVal = graph?.[metric] ?? null;
  if (pacVal === null || graphVal === null) return false;
  if (pacVal === graphVal) return false;
  // time_total_s: thấp hơn là tốt hơn
  if (metric === 'time_total_s') {
    return side === 'pac' ? pacVal < graphVal : graphVal < pacVal;
  }
  // Các metric còn lại: cao hơn là tốt hơn
  return side === 'pac' ? pacVal > graphVal : graphVal > pacVal;
}

// ===== SERVICES =====
export class ChatService {
  CHAT_URL = {
    STREAM: `${PUBLIC_API_BASE_URL}/langchain/retrieve_document`,
    UPLOAD_PAC: `${PUBLIC_API_BASE_URL}/langchain/load_document_pdf_PaC`,
    CLEAR_HISTORY: (sessionId: string) => `${PUBLIC_API_BASE_URL}/langchain/clear_history/${sessionId}`,
    CLEAR_VECTOR_STORE: `${PUBLIC_API_BASE_URL}/langchain/clear_vector_store`,
    COMPARE_UPLOAD: `${PUBLIC_API_BASE_URL}/langchain/compare/upload`,
    COMPARE_QUERY: `${PUBLIC_API_BASE_URL}/langchain/compare/query`,
    COMPARE_HISTORY: (sessionId: string) => `${PUBLIC_API_BASE_URL}/langchain/compare/history/${sessionId}`,
    COMPARE_DELETE: (runId: string) => `${PUBLIC_API_BASE_URL}/langchain/compare/history/${runId}`,

    GRAPH_QUERY: `${PUBLIC_API_BASE_URL}/langchain/graph/query`,

    DELETE_PAC: `${PUBLIC_API_BASE_URL}/langchain/delete_document`,
    DELETE_GRAPH: (source: string) => `${PUBLIC_API_BASE_URL}/langchain/graph/${encodeURIComponent(source)}`,

    CONVERSATION_KEY: (userId: string) => `${PUBLIC_API_BASE_URL}/chatroom/conversation_key/${userId}`,

    MESSAGES: (conversation_key: string) => `${PUBLIC_API_BASE_URL}/chatroom/messages/${conversation_key}`,

    AI_HISTORY: (sessionId: string) => `${PUBLIC_API_BASE_URL}/langchain/chat_history/${sessionId}`,
  }

  STORAGE_URL =  {
    GET_FILES: `${PUBLIC_API_BASE_URL}/storage/files`,

    UPLOAD_FILES: `${PUBLIC_API_BASE_URL}/storage/files/upload`,

    DELETE_FILES: (id: string) => `${PUBLIC_API_BASE_URL}/storage/files/${id}`,
  }

  WS_URL = {
    CHAT: {
      USER_ROOM: (userId: string) => `${PUBLIC_WS_BASE_URL}/ws/${userId}`,
      CONVERSATION_ROOM: (userId: string, conversationKey: string) =>
        `${PUBLIC_WS_BASE_URL}/ws/${userId}/${conversationKey}`,
    }
  }

  async *streamChat(prompt: string, sessionId: string, turnId?: string, sourceFilter?: string | null, sourceFilters?: string[] | null) {
    const res = await fetch(this.CHAT_URL.STREAM, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: prompt,
        session_id: sessionId || 'anonymous',
        // Nếu có turn_id (từ compare flow), truyền xuống để không tạo turn mới
        ...(turnId ? { turn_id: turnId, save_history: false } : {}),
        ...(sourceFilter ? { source_filter: sourceFilter } : {}),
        ...(sourceFilters && sourceFilters.length > 0 ? { source_filters: sourceFilters } : {}),
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Failed to start chat stream: ${res.status} ${errText || ""}`.trim());
    }

    const reader = res.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) {
      throw new Error('No response body');
    }

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        yield chunk;
      }
    } finally {
      reader.releaseLock();
    }
  }

  async fetchConversationKey(user_id: string) {
    if (!user_id) return [];

    const url = this.CHAT_URL.CONVERSATION_KEY(user_id)
    logger.api('GET', url);

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error("Lỗi khi tải dữ liệu conversation");
    }

    let result = await response.json();

    return result;
  }

  async fetchMessages(conversation_key: string) {
    if (!conversation_key || conversation_key === "None") return [];

    const url = this.CHAT_URL.MESSAGES(conversation_key)

    const response = await fetch(url);
    logger.api('GET', url);


    if (!response.ok) {
      throw new Error("Lỗi khi tải dữ liệu messages");
    }

    let data = await response.json();

    logger.success('[fetchMessages] data:', data);
    return data
  }

  async fetchAIChatHistory(sessionId: string) {
    const url = this.CHAT_URL.AI_HISTORY(sessionId);
    logger.api('GET', url);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch AI chat history: ${response.status}`);
    }
    logger.info('[fetchAIChatHistory] status:', response.status);

    const data = await response.json();

    logger.success('[fetchAIChatHistory] data:', data);
    return data;
  }

  async fetchGraphRAGHistory(sessionId: string) {
    const url = `${PUBLIC_API_BASE_URL}/langchain/graph/history/${sessionId}`;
    logger.api('GET', url);
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) throw new Error(`Failed to fetch GraphRAG history: ${response.status}`);
    return response.json();
  }

  async sendChatMessage(sessionId: string, message: string) {
    const url = this.CHAT_URL.STREAM;
    logger.api('POST', url);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        session_id: sessionId || 'anonymous',
        query: message
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to send chat message');
    }
    logger.info('[sendChatMessage] status:', response.status);

    const data = await response.text();
    logger.success('[sendChatMessage] data received');

    return data;
  }

  async uploadPaCDocuments(
    files: File[],
    chunkConfig: {
      parent_chunk_size?: number;
      parent_chunk_overlap?: number;
      child_chunk_size?: number;
      child_chunk_overlap?: number;
    }
  ) {
    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));

    if (chunkConfig.parent_chunk_size) {
      formData.append("parent_chunk_size", String(chunkConfig.parent_chunk_size));
    }
    if (chunkConfig.parent_chunk_overlap) {
      formData.append("parent_chunk_overlap", String(chunkConfig.parent_chunk_overlap));
    }
    if (chunkConfig.child_chunk_size) {
      formData.append("child_chunk_size", String(chunkConfig.child_chunk_size));
    }
    if (chunkConfig.child_chunk_overlap) {
      formData.append("child_chunk_overlap", String(chunkConfig.child_chunk_overlap));
    }

    const response = await fetch(this.CHAT_URL.UPLOAD_PAC, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error("Upload documents failed");
    }

    return response.json();
  }

  async uploadCompare(
    sessionId: string,
    files: File[],
    chunkConfig: {
      parent_chunk_size?: number;
      parent_chunk_overlap?: number;
      child_chunk_size?: number;
      child_chunk_overlap?: number;
    }
  ) {
    const formData = new FormData();
    formData.append("session_id", sessionId || "anonymous");
    files.forEach((file) => formData.append("files", file));

    if (chunkConfig.parent_chunk_size) {
      formData.append("parent_chunk_size", String(chunkConfig.parent_chunk_size));
    }
    if (chunkConfig.parent_chunk_overlap) {
      formData.append("parent_chunk_overlap", String(chunkConfig.parent_chunk_overlap));
    }
    if (chunkConfig.child_chunk_size) {
      formData.append("child_chunk_size", String(chunkConfig.child_chunk_size));
    }
    if (chunkConfig.child_chunk_overlap) {
      formData.append("child_chunk_overlap", String(chunkConfig.child_chunk_overlap));
    }

    const response = await fetch(this.CHAT_URL.COMPARE_UPLOAD, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error("Compare upload failed");
    }

    return response.json();
  }

  async compareQuery(sessionId: string, runId: string, query: string, rerankingEnabled: boolean = false, sourceFilter: string | null = null, sourceFilters: string[] | null = null) {
    const response = await fetch(this.CHAT_URL.COMPARE_QUERY, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        session_id: sessionId || "anonymous",
        run_id: runId,
        query,
        reranking_enabled: rerankingEnabled,
        ...(sourceFilter ? { source_filter: sourceFilter } : {}),
        ...(sourceFilters && sourceFilters.length > 0 ? { source_filters: sourceFilters } : {}),
      }),
    });

    if (!response.ok) {
      throw new Error("Compare query failed");
    }

    return response.json();
  }

  async graphQuery(query: string, sessionId: string, source?: string | null, turnId?: string) {
    const response = await fetch(this.CHAT_URL.GRAPH_QUERY, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        source: source || null,
        session_id: sessionId,
        // Nếu có turn_id, truyền xuống để update graphrag_content vào đúng turn
        ...(turnId ? { turn_id: turnId, save_history: false } : {}),
      }),
    });

    if (!response.ok) {
      throw new Error("Graph query failed");
    }

    return response.json();
  }

  async fetchCompareHistory(sessionId: string) {
    const response = await fetch(this.CHAT_URL.COMPARE_HISTORY(sessionId));
    if (!response.ok) {
      throw new Error("Fetch compare history failed");
    }
    return response.json();
  }

  async deleteCompareRun(runId: string) {
    const response = await fetch(this.CHAT_URL.COMPARE_DELETE(runId), {
      method: "DELETE",
    });
    if (!response.ok) {
      throw new Error("Delete compare run failed");
    }
    return response.json();
  }

  async clearHistory(sessionId: string) {
    const response = await fetch(this.CHAT_URL.CLEAR_HISTORY(sessionId), {
      method: "DELETE",
    });

    if (!response.ok) {
      throw new Error("Clear history failed");
    }

    return response.json();
  }

  async clearVectorStore(source?: string) {
    const url = source
      ? `${this.CHAT_URL.CLEAR_VECTOR_STORE}?source=${encodeURIComponent(source)}`
      : this.CHAT_URL.CLEAR_VECTOR_STORE;

    const response = await fetch(url, { method: "DELETE" });

    if (!response.ok) {
      throw new Error("Clear vector store failed");
    }

    return response.json();
  }

  async deletePaCDocument(filename: string) {
    const response = await fetch(this.CHAT_URL.DELETE_PAC, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ filename }),
    });

    if (!response.ok) {
      throw new Error("Delete PaCRAG document failed");
    }

    return response.json();
  }

  async deleteGraphDocument(source: string) {
    const response = await fetch(this.CHAT_URL.DELETE_GRAPH(source), {
      method: "DELETE",
    });

    if (!response.ok) {
      throw new Error("Delete GraphRAG document failed");
    }

    return response.json();
  }

  async deleteAllGraph() {
    const response = await fetch(`${PUBLIC_API_BASE_URL}/langchain/graph`, {
      method: "DELETE",
    });

    if (!response.ok) {
      throw new Error("Delete all GraphRAG data failed");
    }

    return response.json();
  }
}

// ===== FORMATTERS =====
export class MessageFormatter {
  static formatAIHistoryMessages(response: any): Message[] {
    const items: any[] = response?.data || [];
    return items.map((item: any) => ({
      id: `${item.id}`,
      turn_id: item.turn_id,
      sender_id: item.role === 'user' ? 'user' :
                 item.role === 'assistant_rag' ? 'ai-rag' :
                 item.role === 'assistant_graphrag' ? 'ai-graphrag' : 'ai-assistant',
      content: item.content,
      timestamp: item.timestamp,
      created_at: item.timestamp,
      role: item.role === 'user' ? 'user' : 'ai',
    }));
  }

  static isFromUser(message: any, currentUserId: string): boolean {
    const senderId = message.sender_id;
    return senderId === currentUserId || message.role === 'user';
  }
}

// ===== HOOKS =====
const chatService = new ChatService();

// export function useAIChatHistoryPagination(sessionId: string) {
//   const [curPage, setCurPage] = useState(1);
//   const [allMessages, setAllMessages] = useState<Message[]>([]);

//   const {
//     data,
//     isLoading,
//     isFetching,
//     isError,
//     error,
//   } = useQuery({
//     queryKey: ["ai_chat_history", sessionId, curPage],
//     queryFn: () => chatService.fetchAIChatHistory(sessionId, curPage),
//     enabled: !!sessionId,
//   }, queryClient);

//   const newMessages = useMemo(() => {
//     if (!data) return [];

//     const formatted = MessageFormatter.formatAIHistoryMessages(data);

//     return formatted;
//   }, [data]);

//   useEffect(() => {
//     if (!data) return;

//     if (curPage === 1) {
//       setAllMessages(newMessages);
//     } else {
//       setAllMessages((prev) => [...newMessages, ...prev]);
//     }
//   }, [newMessages, curPage, data]);

//   // 👉 load more
//   const hasMore = useMemo(() => {
//     if (!data) return false;
//     return curPage < Math.ceil(data.data.total_elements / data.data.page_size);
//   }, [data, curPage]);

//   const loadMore = useCallback(() => {
//     if (!hasMore || isFetching) return;
//     setCurPage((prev) => prev + 1);
//   }, [hasMore, isFetching]);

//   return {
//     messages: allMessages,
//     isLoading,
//     isFetching,
//     isLoadingMore: isFetching && curPage > 1,
//     error: error?.message || null,
//     loadMore,
//     hasMore,
//   };
// }

// export function useAIChat(sessionId: string) {
//   const {
//     messages: historyMessages,
//     isLoading,
//     isFetching,
//     isLoadingMore,
//     loadMore,
//     hasMore,
//   } = useAIChatHistoryPagination(sessionId);

//   const [isStreaming, setIsStreaming] = useState(false);

//   const sendMessage = useCallback(async (text: string, onUpdate: (msg: Message) => void) => {
//     if (!text.trim()) return;

//     const userMsg: Message = {
//       id: crypto.randomUUID(),
//       content: text,
//       senderId: sessionId,
//       role: "user",
//       timestamp: new Date().toISOString(),
//     };

//     onUpdate(userMsg);

//     setIsStreaming(true);

//     let aiMsg: Message = {
//       id: crypto.randomUUID(),
//       content: "",
//       senderId: "ai-assistant",
//       role: "ai",
//       timestamp: new Date().toISOString(),
//     };

//     onUpdate(aiMsg);

//     try {
//       for await (const chunk of chatService.streamChat(text, sessionId)) {
//         aiMsg.content += chunk;

//         onUpdate({ ...aiMsg });
//       }
//     } catch (err) {
//       console.error(err);
//     } finally {
//       setIsStreaming(false);
//     }
//   }, [sessionId]);

//   return {
//     historyMessages,
//     isLoading,
//     isFetching,
//     isLoadingMore,
//     isStreaming,
//     sendMessage,
//     loadMore,
//     hasMore,
//   };
// }

export function useAIChatHistory(sessionId: string) {
  const {
    data,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["ai_chat_history", sessionId],
    queryFn: () => chatService.fetchAIChatHistory(sessionId),
    enabled: !!sessionId,
  }, queryClient);

  const messages = useMemo(() => {
    if (!data) return [];
    return MessageFormatter.formatAIHistoryMessages(data);
  }, [data]);

  return {
    messages,
    isLoading,
    refetch,
    error: (error as Error)?.message || null,
  };
}

export function useGraphRAGHistory(sessionId: string) {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["graph_chat_history", sessionId],
    queryFn: () => chatService.fetchGraphRAGHistory(sessionId),
    enabled: !!sessionId,
  }, queryClient);

  const messages = useMemo(() => {
    if (!data) return [];
    return MessageFormatter.formatAIHistoryMessages(data);
  }, [data]);

  return { messages, isLoading, refetch };
}

export function useAIChat(sessionId: string) {
  const {
    messages: historyMessages,
    isLoading,
  } = useAIChatHistory(sessionId);

  const [isStreaming, setIsStreaming] = useState(false);

  const sendMessage = useCallback(async (
    text: string,
    onUpdate: (msg: Message) => void,
    sourceFilter?: string | null,
    sourceFilters?: string[] | null,
  ): Promise<string> => {
    if (!text.trim()) return "";

    setIsStreaming(true);

    const aiMsgId = crypto.randomUUID();
    let accumulatedContent = "";

    onUpdate({
      id: aiMsgId,
      content: "",
      sender_id: "ai-assistant",
      role: "ai",
      created_at: new Date().toISOString(),
    });

    try {
      for await (const chunk of chatService.streamChat(text, sessionId, undefined, sourceFilter, sourceFilters)) {
        accumulatedContent += chunk;
        onUpdate({
          id: aiMsgId,
          content: accumulatedContent,
          sender_id: "ai-assistant",
          role: "ai",
          created_at: new Date().toISOString(),
        });
      }
    } catch (err) {
      console.error(err);
      const errMsg = err instanceof Error ? err.message : "PaCRAG không phản hồi.";
      // Nếu server trả 200 nhưng stream rỗng thì accumulatedContent đã có nội dung
      // Chỉ hiện lỗi nếu thực sự không có gì
      if (!accumulatedContent) {
        const errorContent = `PaCRAG không trả lời được: ${errMsg}`;
        onUpdate({
          id: aiMsgId,
          content: errorContent,
          sender_id: "ai-assistant",
          role: "ai",
          created_at: new Date().toISOString(),
        });
        accumulatedContent = errorContent;
      }
    } finally {
      setIsStreaming(false);
    }

    // Trả về full answer để caller dùng cho save_turn
    return accumulatedContent;
  }, [sessionId]);

  return {
    historyMessages,
    isLoading,
    isStreaming,
    sendMessage,
  };
}

export function useConversationKey(userId: string, enabled: boolean = true) {
  return useQuery({
    queryKey: ["conversation_key", userId],
    queryFn: () => chatService.fetchConversationKey(userId),
    enabled: !!userId && enabled,
  }, queryClient);
}

export function useMessages(conversationKey: string, enabled: boolean = true) {
  return useQuery({
    queryKey: ["messages", conversationKey],
    queryFn: () => chatService.fetchMessages(conversationKey),
    enabled: !!conversationKey && conversationKey !== "None" && enabled,
  }, queryClient);
}

export function useWebSocket(
  userId: string,
  conversationKey: string | null,
  onMessage: (message: Message) => void,
  externalWsRef?: React.RefObject<WebSocket | null>
) {
  const [isConnected, setIsConnected] = useState(false);
  const [typingState, setTypingState] = useState<TypingState>({ isTyping: false });
  const wsRef = externalWsRef || useRef<WebSocket | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onMessageRef = useRef(onMessage);

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    logger.info(`[useWebSocket] Effect triggered. UserId: ${userId}, ConvKey: ${conversationKey}`);

    if (!userId || !conversationKey) return;

    const wsUrl = chatService.WS_URL.CHAT.CONVERSATION_ROOM(userId, conversationKey);
    logger.info(`[useWebSocket] Connecting to: ${wsUrl}`);

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      logger.info(`[useWebSocket] Connected to room: ${conversationKey}`);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        logger.info(`[useWebSocket] Message received:`, data);

        if (data.type === "typing") {
          setTypingState({ ...data, isTyping: true });

          if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
          }

          typingTimeoutRef.current = setTimeout(() => {
            setTypingState({ isTyping: false });
            typingTimeoutRef.current = null;
          }, 1500);
          return;
        }

        onMessageRef.current(data);
      } catch (error) {
        logger.error('[useWebSocket] Failed to parse WebSocket message:', error);
      }
    };

    ws.onclose = (event) => {
      logger.info(`[useWebSocket] Disconnected from ${conversationKey}. Code: ${event.code}`);
      setIsConnected(false);
    };

    ws.onerror = (error) => {
      logger.error("[useWebSocket] WebSocket error:", error);
      setIsConnected(false);
    };

    if (externalWsRef) {
      externalWsRef.current = ws;
    }

    return () => {
      logger.info(`[useWebSocket] Cleanup: Closing connection for ${conversationKey}`);
      ws.close();
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [userId, conversationKey, externalWsRef]);

  const sendChatMessage = useCallback((content: string) => {
    if (!content.trim() || !wsRef.current || !isConnected) return;

    logger.info(`[useWebSocket] Sending message:`, content);
    const messagePayload = JSON.stringify({
      type: 'message',
      sender_id: userId,
      conversation_key: conversationKey,
      content: content.trim()
    });

    wsRef.current.send(messagePayload);
  }, [userId, conversationKey, isConnected]);

  return {
    isConnected,
    typingState,
    sendChatMessage,
  };
}

// ===== FILE UTILITIES =====
export async function uploadFiles(files: File[]) {
  const formData = new FormData();
  files.forEach(f => formData.append("files", f));
  const res = await fetch(chatService.STORAGE_URL.UPLOAD_FILES, {
    method: "POST",
    body: formData
  });
  if (!res.ok) throw new Error("Lỗi upload file");
  let data = await res.json();
  logger.info('[uploadFiles] Upload success:', data);
  return data;
}

// ===== UI COMPONENTS =====
// MetricRow helper component
function MetricRow({ label, value, better, labelTooltipText }: { label: string; value: string | null; better?: boolean; labelTooltipText?: string }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <MetricLabelWithTooltip label={label} tooltipText={labelTooltipText} />
      {value == null
        ? <span className="text-gray-300">-</span>
        : <span className={`flex items-center gap-1 font-medium ${better ? "text-green-600" : "text-gray-700"}`}>
            {value}
            {better && <span className="text-[9px] text-green-600 font-semibold">✓</span>}
          </span>
      }
    </div>
  );
}

function MetricLabelWithTooltip({ label, tooltipText }: { label: string; tooltipText?: string }) {
  if (!tooltipText) {
    return <span className="text-gray-500">{label}</span>;
  }

  return (
    <Tooltip title={tooltipText}>
      <span className="inline-flex items-center gap-1 text-gray-500 cursor-help">
        {label}
        <QuestionCircleOutlined className="text-gray-400" />
      </span>
    </Tooltip>
  );
}

// Quality Badge Component
function QualityBadge({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-700">
      ✓ Tốt hơn
    </span>
  );
}

// Confidence Badge Component
function ConfidenceBadge({ score }: { score: number | null | undefined }) {
  if (score == null) return <span className="text-gray-400 text-[10px]">N/A</span>;
  const colorClass = score > 0.7
    ? "text-green-700 bg-green-50 border border-green-200"
    : score >= 0.4
    ? "text-yellow-700 bg-yellow-50 border border-yellow-200"
    : "text-red-700 bg-red-50 border border-red-200";
  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${colorClass}`}>
      {(score * 100).toFixed(0)}%
    </span>
  );
}

// Citation Modal Component
function CitationModal({ state, onClose }: { state: CitationModalState; onClose: () => void }) {
  if (!state.open) return null;

  const highlightContent = (content: string, query: string): ReactNode => {
    const words = query.split(/\s+/).filter(w => w.length > 2);
    if (!words.length) return content;
    const escaped = words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const regex = new RegExp(`(${escaped.join('|')})`, 'gi');
    const parts = content.split(regex);
    return parts.map((part, i) =>
      regex.test(part) ? <mark key={i} className="bg-yellow-200 rounded">{part}</mark> : <span key={i}>{part}</span>
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <div className="font-semibold text-sm">{state.passage?.filename || "Không rõ nguồn"}</div>
            {state.passage?.pages && state.passage.pages.length > 0 && (
              <div className="text-xs text-gray-500">
                Trang: {state.passage.pages.join(", ")}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-lg leading-none"
            aria-label="Đóng"
          >
            ✕
          </button>
        </div>
        <div className="p-4 overflow-y-auto text-sm leading-relaxed">
          {state.passage
            ? highlightContent(state.passage.content, state.query)
            : <span className="text-gray-500">Không có nội dung chi tiết cho nguồn này.</span>
          }
        </div>
      </div>
    </div>
  );
}

const renderPreviewAttachment = (file: File) => {
  if (file.type.startsWith("image/")) {
    return (
      <img
        src={URL.createObjectURL(file)}
        alt={file.name}
        className="smartchatbot-preview-image"
      />
    );
  } else {
    return (
      <div className="smartchatbot-preview-file-wrapper">
        <div className="smartchatbot-preview-file-icon">
          <FileTextOutlined className="smartchatbot-preview-file-icon-svg" />
        </div>
        <div className="smartchatbot-preview-file-name">
          {file.name}
        </div>
      </div>
    );
  }
};

// Message Bubble Component
function MessageBubble({ msg, currentUserId }: { msg: Message; currentUserId: string }) {
  const isFromUser = MessageFormatter.isFromUser(msg, currentUserId);

  const isUrl = typeof msg.content === "string" && msg.content.startsWith("http");
  const isImage = isUrl && Utility.isImageUrl(msg.content);
  const isDocument = isUrl && Utility.isDocumentUrl(msg.content);

  // Tách phần nguồn ra khỏi nội dung chính (dòng bắt đầu bằng "- Nguồn:" hoặc "Nguồn:")
  const { mainContent, sourceLines } = (() => {
    if (isFromUser || !msg.content) return { mainContent: msg.content, sourceLines: [] };
    const lines = msg.content.split("\n");
    const sourceStart = lines.findIndex(l =>
      /^[-–]?\s*(Nguồn|Source)\s*:/i.test(l.trim())
    );
    if (sourceStart === -1) return { mainContent: msg.content, sourceLines: [] };
    return {
      mainContent: lines.slice(0, sourceStart).join("\n").trim(),
      sourceLines: lines.slice(sourceStart).filter(l => l.trim()),
    };
  })();

  return (
    <div className={`flex mb-3 ${isFromUser ? "justify-end" : "justify-start"}`}>
      {isImage ? (
        <div className="smartchatbot-bubble-image-wrap">
          <Image width={220} src={msg.content} preview />
        </div>
      ) : (
        <div
          className={`relative group smartchatbot-message-bubble ${isFromUser ? "smartchatbot-message-bubble-user" : "smartchatbot-message-bubble-ai"}`}
        >
          {isDocument ? (
            <a
              href={msg.content}
              target="_blank"
              rel="noopener noreferrer"
              className={`underline ${isFromUser ? "text-white" : "text-blue-600"}`}
            >
              {Utility.getFilenameFromUrl(msg.content)}
            </a>
          ) : isFromUser ? (
            <div className="text-sm">{msg.content}</div>
          ) : (
            <>
              <div className="text-sm markdown-body">
                <ReactMarkdown>{mainContent}</ReactMarkdown>
              </div>
              {sourceLines.length > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-100 text-[11px] text-gray-500 space-y-0.5">
                  {sourceLines.map((line, i) => (
                    <div key={i}>{line}</div>
                  ))}
                </div>
              )}
            </>
          )}

          {msg.created_at && (
            <div
              className={`absolute px-2 py-1 text-[10px] bg-gray-800 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none ${isFromUser
                ? "right-full top-1/2 -translate-y-1/2 -mr-[5px]"
                : "left-full top-1/2 -translate-y-1/2 -ml-[5px]"
                }`}
            >
              {Utility.formatVietnameseDate(msg.created_at)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// AI Chat Component
function AIChatComponent(props: any) {
  const {
    historyMessages,
    isLoading,
    isStreaming,
    sendMessage
  } = useAIChat(props.userId);

  const mergedMessages = useMemo(() => {
    // Dedup theo content+role để tránh duplicate khi local state và history cùng tồn tại
    const seen = new Set<string>();
    return [...historyMessages, ...props.messages].filter((m: any) => {
      const key = `${m.role}::${m.content}`;
      if (seen.has(key)) return false;
      seen.add(key);
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

  const { data: compareHistory, isLoading: isCompareHistoryLoading } = useQuery({
    queryKey: ["compare_history", props.userId || "anonymous"],
    queryFn: () => chatService.fetchCompareHistory(props.userId || "anonymous"),
    enabled: true,
  }, queryClient);

  const compareRuns = compareHistory?.data?.runs || [];

  useEffect(() => {
    if (!activeRunId && compareRuns.length > 0) {
      setActiveRunId(compareRuns[0].id);
    }
  }, [compareRuns, activeRunId]);

  const activeRun = compareRuns.find((run: any) => run.id === activeRunId) || null;

  const { mutateAsync: uploadDocs, isPending: isUploading } = useMutation({
    mutationFn: (payload: { files: File[]; config: typeof chunkConfig }) =>
      chatService.uploadCompare(props.userId || "anonymous", payload.files, payload.config),
    onSuccess: (data) => {
      const runs = data?.data?.runs || [];
      if (runs.length > 0) {
        setActiveRunId(runs[0].id);
      }
      queryClient.invalidateQueries({ queryKey: ["compare_history", props.userId] });
    }
  }, queryClient);

  const { mutateAsync: compareQuery, isPending: isComparingQuery } = useMutation({
    mutationFn: (payload: { runId: string; query: string }) =>
      chatService.compareQuery(props.userId || "anonymous", payload.runId, payload.query),
    onSuccess: (data) => {
      const newRunId = data?.data?.run?.id;
      if (newRunId) {
        setActiveRunId(newRunId);
      }
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
    mutationFn: () => chatService.clearVectorStore(),
  }, queryClient);

  // const isFirstLoadRef = useRef(true);
  // const isNearBottomRef = useRef(true);

  // 👉 SCROLL LOAD MORE
  // const handleScroll = useCallback(() => {
  //   const el = messagesRef.current;
  //   if (!el) return;

  //   isNearBottomRef.current =
  //     el.scrollHeight - el.scrollTop - el.clientHeight < 100;

  //   if (el.scrollTop < 50 && hasMore) {
  //     const prevHeight = el.scrollHeight;

  //     loadMore();

  //     requestAnimationFrame(() => {
  //       requestAnimationFrame(() => {
  //         if (!el) return;
  //         el.scrollTop = el.scrollHeight - prevHeight;
  //       });
  //     });
  //   }
  // }, [loadMore, hasMore]);

  // 👉 AUTO SCROLL
  // useEffect(() => {
  //   const el = messagesRef.current;
  //   if (!el) return;

  //   if (isFirstLoadRef.current) {
  //     logger.info("scroll bottom...")
  //     el.scrollTop = el.scrollHeight;
  //     isFirstLoadRef.current = false;
  //     return;
  //   }

  //   if (isNearBottomRef.current) {
  //     logger.info("scroll near...")
  //     el.scrollTop = el.scrollHeight;
  //   }
  // }, [mergedMessages.length]);

  useEffect(() => {
    const el = messagesRef.current;
    if (!el) return;

    el.scrollTop = el.scrollHeight;
  }, [mergedMessages.length]);

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
    if (!window.confirm("Xóa lần so sánh này?")) return;
    try {
      await chatService.deleteCompareRun(runId);
      queryClient.invalidateQueries({ queryKey: ["compare_history", props.userId] });
      if (activeRunId === runId) {
        setActiveRunId(null);
      }
    } catch (err) {
      message.error("Xóa thất bại");
    }
  };

  if (isLoading && mergedMessages.length === 0) {
    return <div className="flex items-center justify-center h-full">
      <Spin />
    </div>
  }

  return (
    <div className="flex h-full">
      <div className="flex flex-col flex-1">
        <div className="smartchatbot-messages-area" ref={messagesRef}>
        {mergedMessages.length === 0 ? (
          <Empty description="Bắt đầu trò chuyện với AI" style={{ marginTop: "100px" }} />
        ) : (
          <>
            {/* {isLoadingMore && (
              <div className="flex justify-center py-2">
                <Spin size="small" />
              </div>
            )} */}

            {mergedMessages?.map((m: any) => (
              <MessageBubble
                key={m.id}
                msg={m}
                currentUserId={props.userId}
              />
            ))}

            {isStreaming && (
              <div className="flex justify-start">
                <div className="smartchatbot-message-bubble smartchatbot-message-bubble-ai">
                  <div className="text-sm">AI đang gõ<span className="animate-pulse">...</span></div>
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
            <Button
              size="small"
              onClick={() => document.getElementById("aiUploadInput")?.click()}
            >
              Chọn file
            </Button>
            <Button
              size="small"
              type="primary"
              onClick={handleUploadDocs}
              disabled={files.length === 0 || isUploading}
            >
              {isUploading ? "Đang upload..." : "Upload tài liệu"}
            </Button>
            <Button
              size="small"
              onClick={() => setShowChunkConfig((prev) => !prev)}
            >
              {showChunkConfig ? "Ẩn cấu hình chunk" : "Cấu hình chunk"}
            </Button>
            <Button
              size="small"
              danger
              onClick={handleClearHistory}
              disabled={isClearingHistory}
            >
              Xóa lịch sử
            </Button>
            <Button
              size="small"
              danger
              onClick={handleClearVectorStore}
              disabled={isClearingVector}
            >
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
            {/* <button
              onClick={handleClear}
              className="px-4 py-2 bg-gray-500 text-white rounded-xl hover:bg-gray-600 text-sm"
            >
              Clear
            </button> */}
          </div>
          </div>
        </div>
      </div>

      <div className="w-[260px] border-l border-gray-200 bg-white flex flex-col">
        <div className="px-3 py-2 border-b border-gray-200 text-sm font-semibold">
          So sánh PaCRAG vs GraphRAG
        </div>
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
                  {isComparingQuery ? <Spin size="small" /> : (
                    <>
                      <div className="flex items-center">Time: {activeRun.pac_query?.time_total_s ?? "-"}s<QualityBadge show={isBetter("time_total_s", "pac", activeRun.pac_query, activeRun.graphrag_query)} /></div>
                      <div>Tokens: {activeRun.pac_query?.answer_tokens ?? "-"}</div>
                      <div className="flex items-center">Words: {activeRun.pac_query?.word_count ?? "N/A"}<QualityBadge show={isBetter("word_count", "pac", activeRun.pac_query, activeRun.graphrag_query)} /></div>
                      <div className="flex items-center">Relevance: {activeRun.pac_query?.relevance_score != null ? activeRun.pac_query.relevance_score.toFixed(4) : "N/A"}<QualityBadge show={isBetter("relevance_score", "pac", activeRun.pac_query, activeRun.graphrag_query)} /></div>
                      <div className="flex items-center">Coverage: {activeRun.pac_query?.source_coverage != null ? `${(activeRun.pac_query.source_coverage * 100).toFixed(2)}%` : "N/A"}<QualityBadge show={isBetter("source_coverage", "pac", activeRun.pac_query, activeRun.graphrag_query)} /></div>
                    </>
                  )}
                </div>
                <div className="border rounded p-2">
                  <div className="font-semibold">GraphRAG</div>
                  {isComparingQuery ? <Spin size="small" /> : (
                    <>
                      <div className="flex items-center">Time: {activeRun.graphrag_query?.time_total_s ?? "-"}s<QualityBadge show={isBetter("time_total_s", "graph", activeRun.pac_query, activeRun.graphrag_query)} /></div>
                      <div>Tokens: {activeRun.graphrag_query?.answer_tokens ?? "-"}</div>
                      <div className="flex items-center">Words: {activeRun.graphrag_query?.word_count ?? "N/A"}<QualityBadge show={isBetter("word_count", "graph", activeRun.pac_query, activeRun.graphrag_query)} /></div>
                      <div className="flex items-center">Relevance: {activeRun.graphrag_query?.relevance_score != null ? activeRun.graphrag_query.relevance_score.toFixed(4) : "N/A"}<QualityBadge show={isBetter("relevance_score", "graph", activeRun.pac_query, activeRun.graphrag_query)} /></div>
                      <div className="flex items-center">Coverage: {activeRun.graphrag_query?.source_coverage != null ? `${(activeRun.graphrag_query.source_coverage * 100).toFixed(2)}%` : "N/A"}<QualityBadge show={isBetter("source_coverage", "graph", activeRun.pac_query, activeRun.graphrag_query)} /></div>
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
                      {isComparingQuery ? <Spin size="small" /> : (
                        <div className="text-[10px] whitespace-pre-wrap max-h-32 overflow-y-auto">
                          {activeRun.pac_query?.answer || "Không có câu trả lời"}
                        </div>
                      )}
                    </div>
                    <div className="border rounded p-2">
                      <div className="font-semibold text-[10px] mb-1">GraphRAG</div>
                      {isComparingQuery ? <Spin size="small" /> : (
                        <div className="text-[10px] whitespace-pre-wrap max-h-32 overflow-y-auto">
                          {activeRun.graphrag_query?.answer || "Không có câu trả lời"}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
              {(activeRun.pac_query?.retrieved_chunks && activeRun.pac_query.retrieved_chunks.length > 0) && (
                <div>
                  <div className="font-semibold mt-2 text-[11px]">Nguồn PaCRAG</div>
                  <div className="space-y-0.5">
                    {activeRun.pac_query.retrieved_chunks.map((chunk: RetrievedPassage, i: number) => (
                      <button
                        key={i}
                        className="text-left text-blue-600 underline text-[10px] block truncate hover:text-blue-800 w-full"
                        onClick={() => setCitationModal({ open: true, passage: chunk, query: lastQuery })}
                      >
                        {chunk.filename}{chunk.pages?.length ? ` (tr. ${chunk.pages.join(",")})` : ""}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {(activeRun.graphrag_query?.doc_passages && activeRun.graphrag_query.doc_passages.length > 0) && (
                <div>
                  <div className="font-semibold mt-2 text-[11px]">Nguồn GraphRAG</div>
                  <div className="space-y-0.5">
                    {activeRun.graphrag_query.doc_passages.map((passage: RetrievedPassage, i: number) => (
                      <button
                        key={i}
                        className="text-left text-blue-600 underline text-[10px] block truncate hover:text-blue-800 w-full"
                        onClick={() => setCitationModal({ open: true, passage, query: lastQuery })}
                      >
                        {passage.filename}{passage.pages?.length ? ` (tr. ${passage.pages.join(",")})` : ""}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {isComparingQuery && (
                <div className="text-xs text-blue-500">Đang so sánh query...</div>
              )}
            </div>
          )}
        </div>
      </div>
      <CitationModal state={citationModal} onClose={() => setCitationModal({ open: false, passage: null, query: "" })} />
    </div>
  );
}

// Normal Chat Component
function NormalChatComponent({
  userId,
  messages,
  setMessages,
  isConnected,
  sendMessage,
  conversationKey
}: any) {
  console.log(`[NormalChatComponent] Render. Messages: ${messages.length}`);

  const [input, setInput] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const messagesAreaRef = useRef<HTMLDivElement>(null);

  const { data: chatroomMessages, isLoading: isLoadingChatroomMessages } = useMessages(conversationKey);

  const { mutateAsync: upload, isPending } = useMutation({
    mutationFn: (files: File[]) => uploadFiles(files)
  }, queryClient);

  useEffect(() => {
    console.log("[NormalChatComponent] chatroomMessages changed", chatroomMessages?.data);
    if (chatroomMessages?.data) {
      setMessages(chatroomMessages.data);
    }
  }, [chatroomMessages?.data]);

  useEffect(() => {
    const el = messagesAreaRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  useEffect(() => {
    if (!isConnected) return;
  }, [isConnected]);


  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    console.log("[NormalChatComponent] Files selected", selected);

    setFiles(prevFiles => {
      const existingKeys = new Set(prevFiles.map(f => `${f.name}_${f.size}_${f.lastModified}`));
      const newFiles: File[] = [];

      selected.forEach(file => {
        const key = `${file.name}_${file.size}_${file.lastModified}`;

        if (file.size > CONSTANT.MAX_FILE_SIZE) {
          message.error(`File "${file.name}" vượt quá 5MB`);
          return;
        }

        if (existingKeys.has(key)) return;

        existingKeys.add(key);
        newFiles.push(file);

      });

      return [...prevFiles, ...newFiles];
    });

    e.target.value = "";
  };


  const removeFile = (idx: number) => {
    setFiles(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text && files.length === 0) return;

    console.log(`[NormalChatComponent] Sending message. Text: ${text}, Files: ${files.length}`);

    if (text) {
      const newMessage: Message = {
        id: crypto.randomUUID(),
        sender_id: userId,
        content: text,
        created_at: new Date().toISOString(),
        conversation_key: conversationKey
      };

      setMessages((prev: any) => [...prev, newMessage]);

      if (isConnected) {
        sendMessage(text);
      } else {
        message.error("WebSocket chưa kết nối");
      }

      setInput("");
    }

    if (files.length > 0) {
      try {
        const res = await upload(files);
        res.data.urls.forEach((url: string) => {
          const fileMessage: Message = {
            id: crypto.randomUUID(),
            sender_id: userId,
            content: url,
            created_at: new Date().toISOString(),
            conversation_key: conversationKey
          };

          setMessages((prev: any) => [...prev, fileMessage]);

          if (isConnected) {
            sendMessage(url);
          }
        });

        setFiles([]);
      } catch {
        message.error("Tải lên thất bại!");
      }
    }
  }, [input, files, upload, userId, conversationKey, isConnected, sendMessage]);


  if (isLoadingChatroomMessages) {
    return <div>Loading...</div>;
  }

  return (
    <>
      <div className="smartchatbot-messages-area" ref={messagesAreaRef}>
        {messages.length === 0 ? (
          <div></div>
        ) : (
          <>
            {messages?.map((m: any, index: number) => {
              return (
                <MessageBubble
                  key={m.id || `message-${index}`}
                  msg={m}
                  currentUserId={userId}
                />
              );
            })}
          </>
        )}
      </div>

      {files.length > 0 && (
        <div className="px-3 pb-2">
          <div className="flex gap-2 overflow-x-auto py-2 pt-4">
            {files.map((file, i) => (
              <div key={i} className="smartchatbot-file-preview-container">
                {renderPreviewAttachment(file)}
                <Button
                  type="text"
                  danger
                  icon={<CloseOutlined />}
                  size="small"
                  onClick={() => removeFile(i)}
                  className="smartchatbot-file-preview-remove"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="p-3 bg-white border-t border-gray-200">
        <div className="flex items-center gap-2">
          <input
            type="file"
            accept="*"
            multiple
            title="Đính kèm tệp"
            aria-label="Đính kèm tệp"
            // Gán đúng handler
            onChange={handleFile}
            className="hidden"
            id="fileInput"
          />
          <Button
            type="text"
            icon={<PaperClipOutlined />}
            aria-label="Mở chọn tệp đính kèm"
            onClick={() => document.getElementById('fileInput')?.click()}
            disabled={!isConnected}
          />
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
            placeholder="Type a message..."
            className="flex-1 border border-gray-300 px-3 py-2 rounded-full focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
            disabled={!isConnected}
          />
          <button
            onClick={handleSendMessage}
            disabled={!isConnected || (!input.trim() && files.length === 0) || isPending}
            className="bg-blue-500 text-white px-4 py-2 rounded-full hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            Send
          </button>
        </div>
      </div>
    </>
  );
}

// Main User Chat Component
export function UserPortalChat() {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMode, setChatMode] = useState<'ai' | 'chat'>('chat');
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [AIMessages, setAIMessages] = useState<Message[]>([]);

  const userId = "anonymous";

  const { data: conKeyData, isLoading: isLoadingConKey } = useConversationKey(userId, isChatOpen);

  const conversationKey = conKeyData?.data?.conversation_key || "";

  const handleChatMessage = (msg: Message) => {
    setChatMessages(prev => [...prev, msg]);
  }

  const { isConnected, sendChatMessage } = useWebSocket(
    userId,
    conversationKey,
    handleChatMessage
  );

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

  const handleDeleteUploadedFile = async (filename: string) => {
    if (!window.confirm(`Bạn có chắc muốn xóa "${filename}" và toàn bộ dữ liệu nguồn liên quan?`)) return;
    try {
      // Xóa PaCRAG vector store và GraphRAG graph song song
      await Promise.allSettled([
        chatService.deletePaCDocument(filename),
        chatService.deleteGraphDocument(filename),
      ]);

      // Xóa compareRun tương ứng nếu có
      const matchRun = compareRuns.find((run: any) => run.file_name === filename);
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

  const mergedGraphMessages = useMemo(() => {
    // Dedup: history từ server là source of truth
    // Local messages chỉ hiển thị trong lúc chờ save xong
    const seen = new Set<string>();
    return [...graphHistoryMessages, ...graphMessages].filter((m: any) => {
      const key = `${m.role}::${m.content}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [graphHistoryMessages, graphMessages]);

  const mergedRagMessages = useMemo(() => {
    const seen = new Set<string>();
    return [...historyMessages, ...ragMessages].filter((m: any) => {
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

  const handleRagScroll = useCallback(() => {
    const el = messagesRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowRagScrollBtn(distFromBottom > 100);
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
  const [lastQuery, setLastQuery] = useState("");
  const [citationModal, setCitationModal] = useState<CitationModalState>({ open: false, passage: null, query: "" });
  const [compareTab, setCompareTab] = useState<'metrics' | 'sources'>('metrics');
  const [rerankingEnabled, setRerankingEnabled] = useState(false);

  const { data: compareHistory, isLoading: isCompareHistoryLoading } = useQuery({
    queryKey: ["compare_history", userId || "anonymous"],
    queryFn: () => chatService.fetchCompareHistory(userId || "anonymous"),
    enabled: true,
  }, queryClient);

  const compareRuns = compareHistory?.data?.runs || [];
  // Chỉ hiển thị các run đã có câu hỏi (query_text) trong bảng so sánh
  const queryRuns = compareRuns.filter((run: any) => !!run.query_text);
  const activeRun = compareRuns.find((run: any) => run.id === activeRunId) || null;

  const retrieverChartData = useMemo(() => {
    if (!activeRun) return [] as ChartMetricDatum[];

    const pac = readRetrieverScores(activeRun.pac_query);
    const graph = readRetrieverScores(activeRun.graphrag_query);

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
  }, [activeRun]);

  const generatorChartData = useMemo(() => {
    if (!activeRun) return [] as ChartMetricDatum[];

    const pac = readGeneratorScores(activeRun.pac_query);
    const graph = readGeneratorScores(activeRun.graphrag_query);

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
  }, [activeRun]);

  useEffect(() => {
    if (!activeRunId && queryRuns.length > 0) {
      setActiveRunId(queryRuns[0].id);
    }
  }, [queryRuns, activeRunId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.innerWidth < 1280) {
      setToolPanelOpen(false);
    }
  }, []);

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
      compareRuns.forEach((run: any) => {
        const name = run.file_name;
        if (!name) return;
        if (!existing.has(name)) {
          existing.set(name, { name, selected: false });
        }
      });
      return Array.from(existing.values());
    });
  }, [compareRuns]);

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

  useEffect(() => {
    const el = messagesRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [mergedRagMessages.length]);

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

  const handleClearVectorStore = async () => {
    if (!window.confirm("Bạn có chắc muốn xóa toàn bộ vector store (PaCRAG + GraphRAG)?")) return;
    try {
      // Lấy danh sách compare runs hiện tại để xóa hết
      const currentRuns: any[] = compareRuns || [];

      await Promise.allSettled([
        clearVectorStore(),
        chatService.deleteAllGraph(),
        // Xóa toàn bộ compare runs trên server
        ...currentRuns.map((run: any) => chatService.deleteCompareRun(run.id)),
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
    setRagMessages((prev: any) => [...prev, userMsg]);

    const currentInput = input;
    setLastQuery(input);
    setInput("");

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

    const ragPromise = sendMessage(currentInput, (msg: any) => {
      if (msg.role === "user") return;
      setRagMessages((prev: any) => {
        const exist = prev.find((m: any) => m.id === msg.id);
        if (exist) return prev.map((m: any) => (m.id === msg.id ? msg : m));
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
                        {mergedRagMessages.map((m: any) => (
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
                        {mergedGraphMessages.map((m: any) => (
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
                    {mergedRagMessages.filter((m: any) => m.role === 'user').length > 0 && (
                      <div className="mb-2">
                        <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide px-1 mb-1">PaCRAG</div>
                        {mergedRagMessages
                          .filter((m: any) => m.role === 'user')
                          .map((m: any, i: number) => (
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
                    {mergedGraphMessages.filter((m: any) => m.role === 'user').length > 0 && (
                      <div>
                        <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide px-1 mb-1">GraphRAG</div>
                        {mergedGraphMessages
                          .filter((m: any) => m.role === 'user')
                          .map((m: any, i: number) => (
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
              {/* Danh sách runs – dạng bảng ngang, hiển thị đầy đủ metrics ngay */}
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
                    {queryRuns.map((run: any) => {
                      return (
                        <tr
                          key={run.id}
                          className={`border-b border-gray-100 cursor-pointer transition-colors ${activeRunId === run.id ? "bg-blue-50" : "hover:bg-gray-50"}`}
                          onClick={() => setActiveRunId(run.id)}
                        >
                          <td className="px-3 py-2">
                            <div className="font-medium line-clamp-2 leading-tight text-gray-700" title={run.query_text}>
                              <span className="text-blue-400 mr-1">Q:</span>{run.query_text}
                            </div>
                            <div className="text-[10px] text-gray-400 truncate mt-0.5">{run.file_name}</div>
                            <div className="text-[10px] text-gray-300">{run.created_at || ""}</div>
                          </td>
                          {/* PaC metrics */}
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
                          {/* Graph metrics */}
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
                              onClick={(e) => { e.stopPropagation(); handleDeleteCompareRun(run.id); }}
                            >
                              Xóa
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Chi tiết run đang chọn */}
              {activeRun && (
                <div className="border border-gray-200 rounded-xl bg-white overflow-hidden">
                  {/* Header */}
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

                  {/* Ingest summary – 4-col compact */}
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

                  {/* Tabs */}
                  <div className="flex border-b border-gray-100 text-xs">
                    {(['metrics', 'sources'] as const).map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setCompareTab(tab as any)}
                        className={`flex-1 py-2 font-medium transition-colors ${
                          compareTab === tab
                            ? 'text-blue-600 border-b-2 border-blue-500 bg-white'
                            : 'text-gray-500 hover:text-gray-700 bg-gray-50'
                        }`}
                      >
                        {tab === 'metrics' ? '📊 Metrics' : '📎 Nguồn'}
                      </button>
                    ))}
                  </div>

                  {/* Tab content */}
                  <div className="p-3">
                    {/* METRICS TAB */}
                    {compareTab === 'metrics' && (
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
                            <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2 font-semibold text-blue-600">
                                  <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
                                  <span>Retriever Metrics</span>
                                </div>
                                <Tooltip title={METRIC_TOOLTIP_TEXT.context_relevance}>
                                  <QuestionCircleOutlined className="text-gray-400" />
                                </Tooltip>
                              </div>
                              {retrieverChartData.length > 0 ? (
                                <Column
                                  data={retrieverChartData}
                                  xField="metric"
                                  yField="score"
                                  seriesField="model"
                                  isGroup
                                  height={260}
                                  yAxis={{ min: 0, max: 100, title: { text: "Điểm (%)" } }}
                                  legend={{ position: "top" }}
                                  tooltip={{
                                    showTitle: true,
                                    customContent: (_title, items) => {
                                      const item = items?.[0]?.data as ChartMetricDatum | undefined;
                                      if (!item) return "";
                                      return `
                                        <div style="padding:12px 14px; min-width:240px;">
                                          <div style="font-weight:600; margin-bottom:4px;">${item.metric}</div>
                                          <div style="font-size:12px; color:#6b7280; margin-bottom:8px; line-height:1.4;">${item.description}</div>
                                          <div style="display:flex; justify-content:space-between; gap:12px; font-size:12px;">
                                            <span>${item.model}</span>
                                            <strong>${item.score.toFixed(1)}%</strong>
                                          </div>
                                        </div>
                                      `;
                                    },
                                  }}
                                  label={{
                                    position: "top",
                                    style: { fontSize: 10 },
                                    formatter: (datum: ChartMetricDatum) => `${datum.score.toFixed(0)}%`,
                                  }}
                                  colorField="model"
                                  color={['#2563eb', '#9333ea']}
                                />
                              ) : (
                                <div className="h-[260px] flex items-center justify-center text-gray-400 text-xs">
                                  Chưa có đủ dữ liệu Retriever metrics để hiển thị biểu đồ.
                                </div>
                              )}
                            </div>

                            <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2 font-semibold text-purple-600">
                                  <span className="w-2 h-2 rounded-full bg-purple-500 inline-block" />
                                  <span>Generator Metrics</span>
                                </div>
                                <Tooltip title={METRIC_TOOLTIP_TEXT.faithfulness_groundedness}>
                                  <QuestionCircleOutlined className="text-gray-400" />
                                </Tooltip>
                              </div>
                              {generatorChartData.length > 0 ? (
                                <Column
                                  data={generatorChartData}
                                  xField="metric"
                                  yField="score"
                                  seriesField="model"
                                  isGroup
                                  height={260}
                                  yAxis={{ min: 0, max: 100, title: { text: "Điểm (%)" } }}
                                  legend={{ position: "top" }}
                                  tooltip={{
                                    showTitle: true,
                                    customContent: (_title, items) => {
                                      const item = items?.[0]?.data as ChartMetricDatum | undefined;
                                      if (!item) return "";
                                      return `
                                        <div style="padding:12px 14px; min-width:240px;">
                                          <div style="font-weight:600; margin-bottom:4px;">${item.metric}</div>
                                          <div style="font-size:12px; color:#6b7280; margin-bottom:8px; line-height:1.4;">${item.description}</div>
                                          <div style="display:flex; justify-content:space-between; gap:12px; font-size:12px;">
                                            <span>${item.model}</span>
                                            <strong>${item.score.toFixed(1)}%</strong>
                                          </div>
                                        </div>
                                      `;
                                    },
                                  }}
                                  label={{
                                    position: "top",
                                    style: { fontSize: 10 },
                                    formatter: (datum: ChartMetricDatum) => `${datum.score.toFixed(0)}%`,
                                  }}
                                  colorField="model"
                                  color={['#2563eb', '#9333ea']}
                                />
                              ) : (
                                <div className="h-[260px] flex items-center justify-center text-gray-400 text-xs">
                                  Chưa có đủ dữ liệu Generator metrics để hiển thị biểu đồ.
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="mt-2 rounded-lg border border-dashed border-gray-200 bg-white/70 p-3 text-[10px] text-gray-500 space-y-2">
                            <div className="font-semibold text-gray-600">Các tham số biểu đồ:</div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1.5 leading-relaxed">
                              <div><span className="font-medium text-gray-600">Context Relevance:</span> Đo mức độ các đoạn truy xuất có thật sự liên quan đến câu hỏi.</div>
                              <div><span className="font-medium text-gray-600">Context Recall:</span> Đo khả năng tìm đủ thông tin cần thiết trong kho tri thức để trả lời.</div>
                              <div><span className="font-medium text-gray-600">Context Precision:</span> Đo việc các tài liệu liên quan có được xếp cao trong top-K kết quả hay không.</div>
                              <div><span className="font-medium text-gray-600">Faithfulness/Groundedness:</span> Đo câu trả lời có bám sát ngữ cảnh truy xuất hay không, hạn chế hallucination.</div>
                              <div><span className="font-medium text-gray-600">Answer Relevancy:</span> Đo câu trả lời có giải quyết trực tiếp câu hỏi của người dùng hay không.</div>
                              <div><span className="font-medium text-gray-600">Answer Correctness:</span> Đo mức độ đúng của câu trả lời so với ground truth hoặc giá trị proxy tương ứng.</div>
                            </div>
                            <div>
                                
                            </div>
                          </div>

                          </>
                        )}
                      </div>
                    )}

                    {/* SOURCES TAB */}
                    {compareTab === 'sources' && (
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <div className="font-semibold text-blue-600 mb-1">PaCRAG</div>
                          {!activeRun.pac_query?.retrieved_chunks?.length
                            ? <span className="text-gray-400 italic">Chưa có nguồn</span>
                            : (() => {
                                const grouped = new Map<string, RetrievedPassage[]>();
                                (activeRun.pac_query.retrieved_chunks as RetrievedPassage[]).forEach((chunk) => {
                                  const key = chunk.filename || "Không rõ";
                                  if (!grouped.has(key)) grouped.set(key, []);
                                  grouped.get(key)!.push(chunk);
                                });
                                return Array.from(grouped.entries()).map(([filename, chunks]) => (
                                  <div key={filename} className="mb-2">
                                    <div className="font-medium text-gray-600 truncate" title={filename}>{filename}</div>
                                    <div className="pl-2 space-y-0.5">
                                      {chunks.map((chunk, i) => (
                                        <button key={i} className="text-left text-blue-500 hover:text-blue-700 block text-[10px]" onClick={() => setCitationModal({ open: true, passage: chunk, query: lastQuery })}>
                                          tr. {chunk.pages?.length ? chunk.pages.join(",") : "?"}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                ));
                              })()
                          }
                        </div>
                        <div>
                          <div className="font-semibold text-purple-600 mb-1">GraphRAG</div>
                          {!activeRun.graphrag_query?.doc_passages?.length
                            ? <span className="text-gray-400 italic">Chưa có nguồn</span>
                            : (() => {
                                const grouped = new Map<string, RetrievedPassage[]>();
                                (activeRun.graphrag_query.doc_passages as RetrievedPassage[]).forEach((p) => {
                                  const key = p.filename || "Không rõ";
                                  if (!grouped.has(key)) grouped.set(key, []);
                                  grouped.get(key)!.push(p);
                                });
                                return Array.from(grouped.entries()).map(([filename, passages]) => (
                                  <div key={filename} className="mb-2">
                                    <div className="font-medium text-gray-600 truncate" title={filename}>{filename}</div>
                                    <div className="pl-2 space-y-0.5">
                                      {passages.map((p, i) => (
                                        <button key={i} className="text-left text-purple-500 hover:text-purple-700 block text-[10px]" onClick={() => setCitationModal({ open: true, passage: p, query: lastQuery })}>
                                          tr. {p.pages?.length ? p.pages.join(",") : "?"}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                ));
                              })()
                          }
                        </div>
                      </div>
                    )}
                  </div>
                </div>
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
