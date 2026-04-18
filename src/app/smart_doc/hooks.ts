import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { queryClient, useMutation, useQuery } from "@/shared/lib/ReactQuery"
import { ChatService, AIService, CompareService, GraphService, WebSocketService, StorageService } from "./service";
import { logger } from "@/shared/utils/logger";
import { MessageRole } from "./types";
import type { Message, TypingState, WebSocketHookReturn, ChatState, AIChatHistoryResponse } from "./types";

// ===== SERVICES =====
const chatService = new ChatService();
const aiService = new AIService();
const compareService = new CompareService();
const graphService = new GraphService();
const webSocketService = new WebSocketService();
const storageService = new StorageService();

// ===== FORMATTERS =====
export class MessageFormatter {
  static formatAIHistoryMessages(response: AIChatHistoryResponse): Message[] {
    const content = response?.result || [];
    return content.map((item: any) => ({
      id: `${item.id}`,
      sender_id: item.role === 'user' ? 'user' : 'ai-assistant',
      content: item.content,
      timestamp: item.timestamp,
      conversation_key: 'ai-chat',
      role: item.role,
    }));
  }

  static isFromUser(message: Message, currentUserId: string): boolean {
    const senderId = message.sender_id;
    return senderId === currentUserId || message.role === 'adv-user' || message.role === 'graph-user';
  }
}

// ===== HOOKS =====

export function useWebSocket(userId: string, conversationKey?: string): WebSocketHookReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [typingState, setTypingState] = useState<TypingState>({ isTyping: false });
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!userId) return;

    const wsUrl = conversationKey
      ? webSocketService.getConversationRoomUrl(userId, conversationKey)
      : webSocketService.getUserRoomUrl(userId);

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      logger.info('WebSocket connected');
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'typing') {
          setTypingState({
            isTyping: data.isTyping,
            sender_id: data.senderId,
          });
        }
      } catch (error) {
        logger.error('WebSocket message parsing error:', error);
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      logger.info('WebSocket disconnected');
    };

    ws.onerror = (error) => {
      logger.error('WebSocket error:', error);
    };

    return () => {
      ws.close();
    };
  }, [userId, conversationKey]);

  const sendMessage = useCallback((content: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'message',
        content,
        timestamp: new Date().toISOString(),
      }));
    }
  }, []);

  return {
    isConnected,
    typingState,
    sendMessage,
  };
}

export function useAIChatHistory(sessionId: string) {
  const { data: historyData, isLoading } = useQuery({
    queryKey: ["ai_chat_history", sessionId],
    queryFn: () => aiService.fetchAIChatHistory(sessionId, "adv-user,adv-assistant"),
    enabled: !!sessionId,
  }, queryClient);

  return {
    data: historyData,
    isLoading
  };
}

export function useChatState(): ChatState {
  const [response, setResponse] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setStreaming = useCallback((isStreaming: boolean) => {
    setIsStreaming(isStreaming);
  }, []);

  const reset = useCallback(() => {
    setResponse("");
    setIsStreaming(false);
    setError(null);
  }, []);

  return {
    response,
    isStreaming,
    error,
    setStreaming,
    setResponse,
    setError,
    reset,
  };
}

export function useChatStreaming(sessionId: string) {
  const chatState = useChatState();
  const [messages, setMessages] = useState<Message[]>([]);

  const streamMutation = useMutation({
    mutationFn: async (prompt: string) => {
      chatState.setStreaming(true);
      chatState.setError(null);
      chatState.setResponse("");

      const stream = chatService.streamChat(prompt, sessionId);

      for await (const chunk of stream) {
        chatState.setResponse(chatState.response + chunk);
      }

      return chatState.response;
    },
    onSuccess: (response) => {
      const aiMessage: Message = {
        id: Date.now().toString(),
        sender_id: 'ai-assistant',
        content: response,
        created_at: new Date().toISOString(),
        role: MessageRole.PACRAG_ASSISTANT,
      };

      setMessages(prev => [...prev, aiMessage]);
      chatState.setStreaming(false);
    },
    onError: (error: Error) => {
      chatState.setError(error.message);
      chatState.setStreaming(false);
    },
  }, queryClient);

  const sendMessage = useCallback((prompt: string) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      sender_id: 'user',
      content: prompt,
      created_at: new Date().toISOString(),
      role: MessageRole.PACRAG_USER,
    };

    setMessages(prev => [...prev, userMessage]);
    streamMutation.mutate(prompt);
  }, [streamMutation]);

  return {
    messages,
    sendMessage,
    isLoading: streamMutation.isPending,
    ...chatState,
  };
}

export function useFileUpload() {
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  const uploadMutation = useMutation({
    mutationFn: async (files: File[]) => {
      setIsUploading(true);
      setUploadProgress(0);
      
      const result = await storageService.uploadFiles(files);
      
      setUploadProgress(100);
      return result;
    },
    onSuccess: (data) => {
      logger.success('Files uploaded successfully:', data);
    },
    onError: (error: Error) => {
      logger.error('File upload failed:', error);
    },
    onSettled: () => {
      setIsUploading(false);
      setTimeout(() => setUploadProgress(0), 1000);
    },
  }, queryClient);

  const uploadFiles = useCallback((files: File[]) => {
    if (files.length === 0) return;
    
    const validFiles = files.filter(file => file.size <= 5 * 1024 * 1024); // 5MB limit
    if (validFiles.length !== files.length) {
      logger.warn('Some files were too large and were skipped');
    }
    
    if (validFiles.length > 0) {
      uploadMutation.mutate(validFiles);
    }
  }, [uploadMutation]);

  return {
    uploadFiles,
    isUploading: uploadMutation.isPending || isUploading,
    uploadProgress,
    error: uploadMutation.error?.message || null,
  };
}

export function useConversationHistory(userId: string) {
  const conversationQuery = useQuery({
    queryKey: ["conversation_key", userId],
    queryFn: () => chatService.fetchConversationKey(userId),
    enabled: !!userId,
  }, queryClient);

  const messagesQuery = useQuery({
    queryKey: ["messages", conversationQuery.data],
    queryFn: () => chatService.fetchMessages(conversationQuery.data),
    enabled: !!conversationQuery.data && conversationQuery.data !== "None",
  }, queryClient);

  return {
    conversationKey: conversationQuery.data,
    messages: messagesQuery.data || [],
    isLoading: conversationQuery.isLoading || messagesQuery.isLoading,
    error: conversationQuery.error || messagesQuery.error,
    refetch: () => {
      conversationQuery.refetch();
      messagesQuery.refetch();
    },
  };
}

export function useStorageFiles() {
  return useQuery({
    queryKey: ["storage_files"],
    queryFn: () => storageService.getFiles(),
    enabled: true,
  }, queryClient);
}

export function useChatActions() {
  const clearHistoryMutation = useMutation({
    mutationFn: (sessionId: string) => chatService.clearHistory(sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai_chat_history"] });
      logger.success('Chat history cleared');
    },
  }, queryClient);

  const clearVectorStoreMutation = useMutation({
    mutationFn: () => aiService.clearVectorStore(),
    onSuccess: () => {
      logger.success('Vector store cleared');
    },
  }, queryClient);

  const deleteFileMutation = useMutation({
    mutationFn: (fileId: string) => storageService.deleteFile(fileId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["storage_files"] });
      logger.success('File deleted');
    },
  }, queryClient);

  return {
    clearHistory: clearHistoryMutation.mutate,
    clearVectorStore: clearVectorStoreMutation.mutate,
    deleteFile: deleteFileMutation.mutate,
    isClearingHistory: clearHistoryMutation.isPending,
    isClearingVectorStore: clearVectorStoreMutation.isPending,
    isDeletingFile: deleteFileMutation.isPending,
  };
}

export function useAIChat(sessionId: string) {
  const {
    data,
    isLoading,
  } = useAIChatHistory(sessionId);

  const [isStreaming, setIsStreaming] = useState(false);

  const messages = useMemo(() => {
    if (!data) return [];
    return MessageFormatter.formatAIHistoryMessages(data);
  }, [data]);

  const sendMessage = useCallback(async (text: string, onUpdate: (msg: Message) => void) => {
    if (!text.trim()) return;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      content: text,
      sender_id: sessionId,
      role: MessageRole.PACRAG_USER,
      created_at: new Date().toISOString(),
    };

    onUpdate(userMsg);

    setIsStreaming(true);

    let aiMsg: Message = {
      id: crypto.randomUUID(),
      content: "",
      sender_id: "ai-assistant",
      role: MessageRole.PACRAG_ASSISTANT,
      created_at: new Date().toISOString(),
    };

    try {
      for await (const chunk of chatService.streamChat(text, sessionId)) {
        aiMsg.content += chunk;
        onUpdate({ ...aiMsg });
        if (aiMsg.content.length > 0) {
          setIsStreaming(false);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsStreaming(false);
    }
  }, [sessionId]);

  return {
    historyMessages: messages,
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

export function usePACRAGHistory(sessionId: string, enabled: boolean = true) {
  return useQuery({
    queryKey: ["pacrag_history", sessionId],
    queryFn: () => aiService.fetchPACRAGHistory(sessionId),
    enabled: !!sessionId && enabled,
  }, queryClient);
}

export function useGraphRAGHistory(sessionId: string, enabled: boolean = true) {
  return useQuery({
    queryKey: ["graphrag_history", sessionId],
    queryFn: () => aiService.fetchGraphRAGHistory(sessionId),
    enabled: !!sessionId && enabled,
  }, queryClient);
}
