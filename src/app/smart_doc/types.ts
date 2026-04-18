// ===== TYPES =====
export enum MessageRole {
  PACRAG_USER = 'adv-user',
  PACRAG_ASSISTANT = 'adv-assistant',
  GRAPHRAG_USER = 'graph-user',
  GRAPHRAG_ASSISTANT = 'graph-assistant'
}

export interface Message {
  id: string;
  sender_id: string;
  content: string;
  created_at?: string;
  conversation_key?: string;
  role?: MessageRole;
}

export interface AIChatHistoryResponse {
  message: string;
  result: Array<{
    id: string;
    session_id: string;
    role: 'adv-user' | 'adv-assistant' | 'graph-user' | 'graph-assistant';
    content: string;
    timestamp: string;
  }>;
  status_code: number;
}

export interface TypingState {
  isTyping: boolean;
  sender_id?: string;
}

export interface WebSocketHookReturn {
  isConnected: boolean;
  typingState: TypingState;
  sendMessage: (content: string) => void;
}

export interface ChatModeToggleProps {
  mode: 'ai' | 'chat';
  onToggle: () => void;
  disabled?: boolean;
}

export interface ChatState {
  response: string;
  isStreaming: boolean;
  error: string | null;
  setStreaming: (isStreaming: boolean) => void;
  setResponse: (response: string) => void;
  setError: (error: string | null) => void;
  reset: () => void;
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
    inputArea: {
      padding: "16px",
      borderTop: "1px solid #f0f0f0",
      background: "#fff"
    },
    sidebar: {
      width: "300px",
      borderRight: "1px solid #f0f0f0",
      background: "#fff",
      display: "flex",
      flexDirection: "column"
    },
    sidebarSection: {
      padding: "16px",
      borderBottom: "1px solid #f0f0f0"
    },
    fileUploadArea: {
      border: "2px dashed #d9d9d9",
      borderRadius: "8px",
      padding: "24px",
      textAlign: "center",
      cursor: "pointer",
      backgroundColor: "#fafafa"
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

  static getFileExtension = (url: string) => {
    return url.split('.').pop()?.toLowerCase() || '';
  };

  static isImageUrl = (url: string) => {
    const ext = this.getFileExtension(url);
    return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext);
  };

  static isVideoUrl = (url: string) => {
    const ext = this.getFileExtension(url);
    return ['mp4', 'webm', 'ogg'].includes(ext);
  };

  static isDocumentUrl = (url: string) => {
    const ext = this.getFileExtension(url);
    return ['pdf', 'doc', 'docx'].includes(ext);
  };
}
