import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import { queryClient, useMutation, useQuery } from "@/lib/ReactQuery";
import { useAuthStore } from "../../auth/authStore";
import UserHeader from "@/components/UserHeader";
import { Button, Collapse, Empty, Image, message, Spin, Tooltip } from "antd";
import {
  CloudUploadOutlined,
  CloseOutlined,
  DatabaseOutlined,
  FileTextOutlined,
  HistoryOutlined,
  PaperClipOutlined,
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
interface AIChatHistoryResponse {
  message: string;
  data: {
    content: Array<{
      id: string,
      role: 'user' | 'ai';
      content: string;
      timestamp: string;
    }>;
    page_number: number;
    page_size: number;
    total_elements: number;
  };
  status_code: number;
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

  async *streamChat(prompt: string, sessionId: string) {
    const res = await fetch(this.CHAT_URL.STREAM, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: prompt,
        session_id: sessionId || 'anonymous',
      }),
    });

    if (!res.ok) {
      throw new Error('Failed to start chat stream');
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

  async compareQuery(sessionId: string, runId: string, query: string) {
    const response = await fetch(this.CHAT_URL.COMPARE_QUERY, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        session_id: sessionId || "anonymous",
        run_id: runId,
        query,
      }),
    });

    if (!response.ok) {
      throw new Error("Compare query failed");
    }

    return response.json();
  }

  async graphQuery(query: string, source?: string | null) {
    const response = await fetch(this.CHAT_URL.GRAPH_QUERY, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, source: source || null }),
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
}

// ===== FORMATTERS =====
export class MessageFormatter {
  static formatAIHistoryMessages(response: any): Message[] {
    return response.data.map((item: any) => ({
      id: `${item.id}`,
      sender_id: item.role === 'user' ? 'user' : 'ai-assistant',
      content: item.content,
      timestamp: item.timestamp,
      conversation_key: 'ai-chat',
      role: item.role,
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
    isError,
    error,
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
    error: (error as Error)?.message || null,
  };
}

export function useAIChat(sessionId: string) {
  const {
    messages: historyMessages,
    isLoading,
  } = useAIChatHistory(sessionId);

  const [isStreaming, setIsStreaming] = useState(false);

  const sendMessage = useCallback(async (text: string, onUpdate: (msg: Message) => void) => {
    if (!text.trim()) return;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      content: text,
      sender_id: sessionId,
      role: "user",
      created_at: new Date().toISOString(),
    };

    onUpdate(userMsg);

    setIsStreaming(true);

    let aiMsg: Message = {
      id: crypto.randomUUID(),
      content: "",
      sender_id: "ai-assistant",
      role: "ai",
      created_at: new Date().toISOString(),
    };

    onUpdate(aiMsg);

    try {
      for await (const chunk of chatService.streamChat(text, sessionId)) {
        aiMsg.content += chunk;
        onUpdate({ ...aiMsg });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsStreaming(false);
    }
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
const renderPreviewAttachment = (file: File) => {
  if (file.type.startsWith("image/")) {
    return (
      <img
        src={URL.createObjectURL(file)}
        alt={file.name}
        style={CONSTANT.STYLES.filePreview.image}
      />
    );
  } else {
    return (
      <div style={CONSTANT.STYLES.filePreview.fileWrapper}>
        <div style={CONSTANT.STYLES.filePreview.fileIcon}>
          <FileTextOutlined style={CONSTANT.STYLES.filePreview.fileIconSvg} />
        </div>
        <div style={CONSTANT.STYLES.filePreview.fileName}>
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

  return (
    <div className={`flex ${isFromUser ? "justify-end" : "justify-start"}`}>
      {isImage ? (
        <div style={{
          maxWidth: "78%",
          borderRadius: "0",
          overflow: "hidden"
        }}>
          <Image width={220} src={msg.content} preview />
        </div>
      ) : (
        <div
          style={{
            maxWidth: "78%",
            padding: "10px 12px",
            borderRadius: "0",
            background: isFromUser ? "#1877f2" : "#ffffff",
            color: isFromUser ? "#fff" : "#111",
            boxShadow: "0 1px 2px rgba(0,0,0,0.08)",
            border: isFromUser ? "none" : "1px solid #e5e7eb",
            wordBreak: "break-word"
          }}
          className="relative group"
        >
          {isDocument ? (
            <a
              href={msg.content}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: isFromUser ? "#fff" : "#1877f2" }}
              className="underline"
            >
              {Utility.getFilenameFromUrl(msg.content)}
            </a>
          ) : isFromUser ? (
            <div className="text-sm">{msg.content}</div>
          ) : (
            <div className="text-sm markdown-body">
              <ReactMarkdown>{msg.content}</ReactMarkdown>
            </div>
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

  const mergedMessages = [...historyMessages, ...props.messages];
  console.log(mergedMessages)

  const [input, setInput] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [activeToolSections, setActiveToolSections] = useState<string[]>(["chunk"]);
  const [chunkConfig, setChunkConfig] = useState({
    parent_chunk_size: 2048,
    parent_chunk_overlap: 400,
    child_chunk_size: 512,
    child_chunk_overlap: 100,
  });
  const messagesRef = useRef<HTMLDivElement>(null);

  const [activeRunId, setActiveRunId] = useState<string | null>(null);

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
        <div style={CONSTANT.STYLES.messagesArea} ref={messagesRef}>
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
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="file"
              accept=".pdf,.doc,.docx"
              multiple
              onChange={(e) => setFiles(Array.from(e.target.files || []))}
              style={{ display: "none" }}
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
  );
}

// Normal Chat Component
function NormalChatComponent({
  isChatOpen,
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
  const [previews, setPreviews] = useState<string[]>([]);
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

        const reader = new FileReader();
        reader.onload = (ev) => {
          if (ev.target?.result) {
            setPreviews(prev => [...prev, ev.target!.result as string]);
          }
        };
        reader.readAsDataURL(file);
      });

      return [...prevFiles, ...newFiles];
    });

    e.target.value = "";
  };


  const removeFile = (idx: number) => {
    setFiles(prev => prev.filter((_, i) => i !== idx));
    setPreviews(prev => prev.filter((_, i) => i !== idx));
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

        setPreviews([]);
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
      <div style={CONSTANT.STYLES.messagesArea} ref={messagesAreaRef}>
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
              <div key={i} style={CONSTANT.STYLES.filePreview.container}>
                {renderPreviewAttachment(file)}
                <Button
                  type="text"
                  danger
                  icon={<CloseOutlined />}
                  size="small"
                  onClick={() => removeFile(i)}
                  style={CONSTANT.STYLES.filePreview.removeBtn}
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
            // Gán đúng handler
            onChange={handleFile}
            style={{ display: "none" }}
            id="fileInput"
          />
          <Button
            type="text"
            icon={<PaperClipOutlined />}
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

  const { payload } = useAuthStore();
  const userId = payload?.user_id || "";

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
                isChatOpen={isChatOpen}
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
  const { payload } = useAuthStore();
  const userId = payload?.user_id || "";
  const storageKey = `smartchatbot_uploaded_files_${userId || "anonymous"}`;

  const {
    historyMessages,
    isLoading,
    isStreaming,
    sendMessage
  } = useAIChat(userId);

  const [input, setInput] = useState("");
  const [files, setFiles] = useState<Array<{ file: File; enabled: boolean; error?: string }>>([]);
  const [activeToolSections, setActiveToolSections] = useState<string[]>(["upload", "chunk", "files"]);
  const [docPanelOpen, setDocPanelOpen] = useState(true);
  const [chunkConfig, setChunkConfig] = useState({
    parent_chunk_size: 2048,
    parent_chunk_overlap: 400,
    child_chunk_size: 512,
    child_chunk_overlap: 100,
  });

  const [graphMessages, setGraphMessages] = useState<Message[]>([]);
  const [ragMessages, setRagMessages] = useState<Message[]>([]);
  const [isGraphThinking, setIsGraphThinking] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
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

  const mergedRagMessages = useMemo(() => {
    const normalizeTime = (msg: any) => {
      const raw = msg.created_at || msg.timestamp || "";
      const date = new Date(raw);
      if (Number.isNaN(date.getTime())) return "";
      return date.toISOString().slice(0, 16);
    };

    const seen = new Set<string>();
    const merged: Message[] = [];

    [...historyMessages, ...ragMessages].forEach((msg: any) => {
      const timeKey = normalizeTime(msg);
      const key = `${msg.role || ""}|${msg.sender_id || ""}|${msg.content || ""}|${timeKey}`;
      if (seen.has(key)) return;
      seen.add(key);
      merged.push(msg);
    });

    return merged;
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

  const { data: compareHistory, isLoading: isCompareHistoryLoading } = useQuery({
    queryKey: ["compare_history", userId || "anonymous"],
    queryFn: () => chatService.fetchCompareHistory(userId || "anonymous"),
    enabled: true,
  }, queryClient);

  const compareRuns = compareHistory?.data?.runs || [];

  useEffect(() => {
    if (!activeRunId && compareRuns.length > 0) {
      setActiveRunId(compareRuns[0].id);
    }
  }, [compareRuns, activeRunId]);

  useEffect(() => {
    if (compareRuns.length === 0) return;
    setUploadedFiles((prev) => {
      const existing = new Map(prev.map((f) => [f.name, f]));
      compareRuns.forEach((run: any) => {
        const name = run.file_name;
        if (!name) return;
        if (!existing.has(name)) {
          existing.set(name, { name, selected: true });
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

  const activeRun = compareRuns.find((run: any) => run.id === activeRunId) || null;

  const { mutateAsync: uploadDocs, isPending: isUploading } = useMutation({
    mutationFn: (payload: { files: File[]; config: typeof chunkConfig }) =>
      chatService.uploadCompare(userId || "anonymous", payload.files, payload.config),
    onSuccess: (data) => {
      const runs = data?.data?.runs || [];
      if (runs.length > 0) {
        setActiveRunId(runs[0].id);
      }
      queryClient.invalidateQueries({ queryKey: ["compare_history", userId] });
    }
  }, queryClient);

  const { mutateAsync: compareQuery, isPending: isComparingQuery } = useMutation({
    mutationFn: (payload: { runId: string; query: string }) =>
      chatService.compareQuery(userId || "anonymous", payload.runId, payload.query),
    onSuccess: () => {
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
    try {
      setUploadStatus("Đang upload...");
      await uploadDocs({ files: readyFiles, config: chunkConfig });
      message.success("Tải tài liệu thành công (PaCRAG + GraphRAG)");
      setUploadStatus("Upload xong");
      setUploadedFiles((prev) => {
        const existing = new Map(prev.map((f) => [f.name, f]));
        readyFiles.forEach((file) => {
          if (!existing.has(file.name)) {
            existing.set(file.name, { name: file.name, selected: true });
          }
        });
        return Array.from(existing.values());
      });
      setFiles([]);
    } catch (err) {
      setUploadStatus("Upload thất bại");
      message.error("Tải tài liệu thất bại");
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
      await chatService.deleteCompareRun(runId);
      queryClient.invalidateQueries({ queryKey: ["compare_history", userId] });
      if (activeRunId === runId) {
        setActiveRunId(null);
      }
    } catch (err) {
      message.error("Xóa thất bại");
    }
  };

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

    sendMessage(input, (msg: any) => {
      setRagMessages((prev: any) => {
        const exist = prev.find((m: any) => m.id === msg.id);
        if (exist) {
          return prev.map((m: any) => (m.id === msg.id ? msg : m));
        }
        return [...prev, msg];
      });
    });

    const appendGraphAnswer = (answer: string, sources?: string[]) => {
      const sourceLines = sources && sources.length > 0
        ? `\n\nNguồn: ${sources.join(", ")}`
        : "";
      setGraphMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          content: `${answer}${sourceLines}`,
          sender_id: "graph-rag",
          role: "ai",
          created_at: new Date().toISOString(),
        },
      ]);
    };

    void (async () => {
      setIsGraphThinking(true);
      try {
        const selectedSource = uploadedFiles.find((f) => f.selected)?.name || null;
        if (activeRunId) {
          const result = await compareQuery({ runId: activeRunId, query: input });
          const run = result?.data?.run;
          const graphAnswer = run?.graphrag_query?.answer || "";
          if (graphAnswer) {
            appendGraphAnswer(graphAnswer, run?.graphrag_query?.sources);
            setIsGraphThinking(false);
            return;
          }
        }

        const fallback = await chatService.graphQuery(input, selectedSource);
        const answer = fallback?.data?.answer || "";
        if (answer) {
          appendGraphAnswer(answer, fallback?.data?.sources);
        } else {
          appendGraphAnswer("GraphRAG chưa có câu trả lời phù hợp.");
        }
      } catch (err) {
        appendGraphAnswer("GraphRAG không trả lời được.");
      }
      setIsGraphThinking(false);
    })();

    setInput("");
  };

  if (isLoading && mergedRagMessages.length === 0) {
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
                  let readyFiles: File[] = [];
                  setFiles((prev) => {
                    const existingKeys = new Set(
                      prev.map((f) => `${f.file.name}_${f.file.size}_${f.file.lastModified}`)
                    );
                    const next = [...prev];
                    incoming.forEach((file) => {
                      const key = `${file.name}_${file.size}_${file.lastModified}`;
                      if (existingKeys.has(key)) return;
                      const ext = file.name.split(".").pop()?.toLowerCase() || "";
                      const isSupported = ["pdf", "doc", "docx"].includes(ext);
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
                  if (readyFiles.length > 0) {
                    void handleUploadDocs(readyFiles);
                  } else if (incoming.length > 0) {
                    message.error("Không có file hợp lệ để upload");
                  }
                  e.currentTarget.value = "";
                }}
                style={{ display: "none" }}
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
                        onClick={() =>
                          setUploadedFiles((prev) => prev.filter((_, i) => i !== idx))
                        }
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
                    {graphMessages.length === 0 ? (
                      <Empty description="Bắt đầu trò chuyện với GraphRAG" style={{ marginTop: "80px" }} />
                    ) : (
                      <>
                        {graphMessages.map((m: any) => (
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