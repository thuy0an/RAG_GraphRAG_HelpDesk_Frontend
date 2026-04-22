import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";
import { queryClient, useQuery } from "@/lib/ReactQuery";
import { logger } from "@/utils/logger";
import { ChatService } from "./chatService";
import { MessageFormatter } from "./formatters";
import type { Message, TypingState } from "./types";

// Dùng chung một instance ChatService cho toàn bộ hooks trong user portal.
// Cách này tránh tạo lại object URL/config ở mỗi lần render component.
export const chatService = new ChatService();

// Lấy lịch sử chat AI đã lưu trên server và map về kiểu Message dùng trong UI.
export function useAIChatHistory(sessionId: string) {
  const { data, isLoading, error, refetch } = useQuery(
    {
      queryKey: ["ai_chat_history", sessionId],
      queryFn: () => chatService.fetchAIChatHistory(sessionId),
      enabled: !!sessionId,
    },
    queryClient
  );

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

// Lấy lịch sử GraphRAG và dùng cùng formatter để thống nhất schema message với PaCRAG.
export function useGraphRAGHistory(sessionId: string) {
  const { data, isLoading, refetch } = useQuery(
    {
      queryKey: ["graph_chat_history", sessionId],
      queryFn: () => chatService.fetchGraphRAGHistory(sessionId),
      enabled: !!sessionId,
    },
    queryClient
  );

  const messages = useMemo(() => {
    if (!data) return [];
    return MessageFormatter.formatAIHistoryMessages(data);
  }, [data]);

  return { messages, isLoading, refetch };
}

// Quản lý stream trả lời AI theo từng chunk và đẩy nội dung tăng dần cho caller.
// Hàm sendMessage trả về full text cuối cùng để layer trên có thể lưu compare turn.
export function useAIChat(sessionId: string) {
  const { messages: historyMessages, isLoading } = useAIChatHistory(sessionId);
  const [isStreaming, setIsStreaming] = useState(false);

  const sendMessage = useCallback(
    async (
      text: string,
      onUpdate: (msg: Message) => void,
      sourceFilter?: string | null,
      sourceFilters?: string[] | null
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
        const errMsg = err instanceof Error ? err.message : "PaCRAG không phản hồi.";
        // Chỉ render lỗi rõ ràng khi stream chưa trả về bất kỳ ký tự nào.
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

      return accumulatedContent;
    },
    [sessionId]
  );

  return {
    historyMessages,
    isLoading,
    isStreaming,
    sendMessage,
  };
}

// Chỉ lấy conversation key khi cần mở chat để giảm request không cần thiết.
export function useConversationKey(userId: string, enabled: boolean = true) {
  return useQuery(
    {
      queryKey: ["conversation_key", userId],
      queryFn: () => chatService.fetchConversationKey(userId),
      enabled: !!userId && enabled,
    },
    queryClient
  );
}

// Lấy message raw của chatroom khi conversation key hợp lệ.
export function useMessages(conversationKey: string, enabled: boolean = true) {
  return useQuery(
    {
      queryKey: ["messages", conversationKey],
      queryFn: () => chatService.fetchMessages(conversationKey),
      enabled: !!conversationKey && conversationKey !== "None" && enabled,
    },
    queryClient
  );
}

// Quản lý vòng đời WebSocket cho room chat và trạng thái typing indicator.
// Có thể truyền external ref khi caller cần thao tác trực tiếp với socket.
export function useWebSocket(
  userId: string,
  conversationKey: string | null,
  onMessage: (message: Message) => void,
  externalWsRef?: RefObject<WebSocket | null>
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
        logger.info("[useWebSocket] Message received:", data);

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

        // FIX: Sử dụng callback trực tiếp thay vì ref để tránh stale closure
        // Chỉ xử lý message nếu không phải echo từ chính user này
        if (data.echo && data.sender_id === userId) {
          logger.info("[useWebSocket] Ignoring echo message from self");
          return;
        }

        // Đảm bảo callback được gọi với data mới nhất
        const currentCallback = onMessageRef.current;
        if (currentCallback) {
          currentCallback(data);
        }
      } catch (error) {
        logger.error("[useWebSocket] Failed to parse WebSocket message:", error);
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

  const sendChatMessage = useCallback(
    (content: string) => {
      if (!content.trim() || !wsRef.current || !isConnected) return;

      logger.info("[useWebSocket] Sending message:", content);
      const messagePayload = JSON.stringify({
        type: "message",
        sender_id: userId,
        conversation_key: conversationKey,
        content: content.trim(),
      });

      wsRef.current.send(messagePayload);
    },
    [userId, conversationKey, isConnected]
  );

  return {
    isConnected,
    typingState,
    sendChatMessage,
  };
}

// Helper upload file đính kèm cho chat thường thông qua storage API.
export async function uploadFiles(files: File[]) {
  const formData = new FormData();
  files.forEach((f) => formData.append("files", f));
  const res = await fetch(chatService.STORAGE_URL.UPLOAD_FILES, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) throw new Error("Lỗi upload file");
  const data = await res.json();
  logger.info("[uploadFiles] Upload success:", data);
  return data;
}
