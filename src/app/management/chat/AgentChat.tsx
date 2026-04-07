import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, queryClient } from "@/lib/ReactQuery";
import { ManagementLayout } from "@/layouts/ManagementLayout";
import { Layout, Avatar, Typography, Empty, Spin, Button, Image, message, Badge } from "antd";
import { MessageOutlined, SendOutlined, PaperClipOutlined, UserOutlined, RobotOutlined, CloseOutlined, FileTextOutlined } from "@ant-design/icons";
import { PUBLIC_API_BASE_URL, PUBLIC_WS_BASE_URL } from "@/constants/constant"
import { useAuthStore } from "@/app/auth/authStore";
import { logger } from "@/utils/logger";

// INTERFACES
export interface Message {
  sender_id: string;
  conversation_key: string;
  content: string;
  timestamp?: string;
}

export interface Conversation {
  conversation_key: string;
  username: string
  last_message?: string;
  timestamp?: string;
}

export interface ConversationItemProps {
  conv: Conversation;
  active: boolean;
  onClick: (key: string) => void;
}

interface MessageBubbleProps {
  msg: Message;
  agentId: string;
}

export interface ChatRoomProps {
  userId: string
  conversationKey: string;
  initialMessages: Message[];
}

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const API = {
  MESSAGES: (conversation_key: string) => `${PUBLIC_API_BASE_URL}/chatroom/messages/${conversation_key}`,
  CONVERSATION_KEY: (user_id: string) => `${PUBLIC_API_BASE_URL}/chatroom/conversation_key/agent/${user_id}`,
  UPLOAD: () => `${PUBLIC_API_BASE_URL}/storage/files/upload`,
} as const

const WS = {
  websocket: (agentId: string, conversationKey: string) => `${PUBLIC_WS_BASE_URL}/ws/${agentId}/${conversationKey}`
} as const

const STYLES = {
  sidebar: { background: "#fff", borderRight: "1px solid #f0f0f0" } as const,
  sidebarHeader: { padding: "16px", borderBottom: "1px solid #f0f0f0", background: "#fafafa" } as const,
  conversationItem: (active: boolean) => ({
    padding: "12px 16px",
    borderBottom: "1px solid #f0f0f0",
    cursor: "pointer",
    background: active ? "#e6f7ff" : "transparent",
    borderLeft: active ? "3px solid #1890ff" : "none"
  }) as const,
  chatHeader: { padding: "16px", borderBottom: "1px solid #f0f0f0", background: "#fafafa", display: "flex", alignItems: "center", gap: "12px" } as const,
  messagesArea: { flex: 1, padding: "16px", overflowY: "auto", background: "#fafafa" } as const,
  messageBubble: (isAgent: boolean) => ({
    maxWidth: "70%",
    padding: "10px 14px",
    borderRadius: "0",
    background: isAgent ? "#1890ff" : "#fff",
    color: isAgent ? "#fff" : "#000",
    boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
    wordBreak: "break-all"
  }) as const,
  inputArea: { padding: "16px", borderTop: "1px solid #f0f0f0", background: "#fff" } as const,
  filePreview: { position: "relative" } as const,
  fileRemoveBtn: { position: "absolute", top: "-6px", right: "-6px", minWidth: "auto" } as const
} as const;

// 4. UTILITY FUNCTIONS
const createPayload = (type: string, content: string, key: string, senderId: string) =>
  JSON.stringify({ type, sender_id: senderId, conversation_key: key, content });

const getFilenameFromUrl = (url: string) => {
  const parts = url.split('/');
  const lastPart = parts[parts.length - 1];
  return lastPart.split('?')[0];
};

const getFileExtension = (url: string) => {
  const filename = getFilenameFromUrl(url);
  const parts = filename.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
};

const isImageUrl = (url: string) => {
  const ext = getFileExtension(url);
  return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext);
};

const isDocumentUrl = (url: string) => {
  const ext = getFileExtension(url);
  return ['pdf', 'doc', 'docx'].includes(ext);
};

const renderPreviewAttachment = (file: File) => {
  if (file.type.startsWith("image/")) {
    return (
      <img
        src={URL.createObjectURL(file)}
        alt={file.name}
        style={{
          width: "60px",
          height: "60px",
          objectFit: "cover",
          borderRadius: "5px"
        }}
      />
    );
  } else {
    return (
      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
        <div style={{
          width: "48px",
          height: "48px",
          borderRadius: "50%",
          backgroundColor: "#0D0D0D",
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        }}>
          <FileTextOutlined
            style={{
              fontSize: '24px',
              color: '#F5F5F5',
              WebkitTextStroke: '1px #000000'
            }}
          />
        </div>
        <div style={{
          width: "80px",
          wordBreak: "break-word",
          fontSize: "12px",
          lineHeight: "1.2",
          maxHeight: "40px",
          overflow: "hidden",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical"
        }}>
          {file.name}
        </div>
      </div>
    );
  }
};

// 5. CUSTOM HOOKS
interface UseChatSocketReturn {
  sendMessage: (payload: string) => void;
}

function useWebSocket(
  agentId: string, 
  conversationKey: string, 
  onMessage: (msg: Message) => void
): UseChatSocketReturn {
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!conversationKey) return;

    wsRef.current?.close();

    const ws = new WebSocket(WS.websocket(agentId, conversationKey));
    wsRef.current = ws;

    // WebSocket event handlers
    ws.onopen = () => {
      console.log(`[WS] Connected to ${conversationKey}`);
    };

    ws.onmessage = (event: MessageEvent) => {
      try {
        const msg = JSON.parse(event.data) as Message;

        onMessage(msg);
      } catch (error) {
        console.error("[WS] Parse error:", error);
      }
    };

    ws.onerror = (error) => {
      console.error("[WS] Error:", error);
    };

    ws.onclose = () => {
      console.log(`[WS] Disconnected from ${conversationKey}`);
    };

    // Cleanup on unmount or conversationKey change
    return () => {
      ws.close();
    };
  }, [conversationKey]);

  const sendMessage = (payload: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(payload);
    } else {
      console.warn("[WS] Not connected, message not sent");
    }
  };

  return { sendMessage };
}

async function fetchConversationKeys(userId: string) {
  if (!userId) return { message: "", data: [], status_code: 400 };

  const response = await fetch(API.CONVERSATION_KEY(userId));

  if (!response.ok) {
    throw new Error("Lỗi tải danh sách cuộc trò chuyện");
  }

  const data = await response.json();
  logger.info(data)
  return data;
}

async function fetchConversationMessages(conversationKey: string) {
  if (!conversationKey) return { message: "", data: [], status_code: 400 };

  const response = await fetch(API.MESSAGES(conversationKey));

  if (!response.ok) {
    throw new Error("Lỗi tải tin nhắn");
  }

  const data = await response.json();

  return data;
}

async function uploadFilesToServer(files: File[]) {
  const formData = new FormData();
  files.forEach(file => formData.append("files", file));

  const response = await fetch(API.UPLOAD(), {
    method: "POST",
    body: formData
  });

  if (!response.ok) {
    throw new Error("Lỗi upload file");
  }

  const data = await response.json();
  return data;
}

export function useFileUpload() {
  const {
    mutateAsync: upload,
    isPending: isUploading,
    error: uploadError
  } = useMutation({
    mutationFn: uploadFilesToServer,
  }, queryClient);
  return {
    upload,
    isUploading,
    uploadError,
    hasUploadError: !!uploadError
  };
}

// 7. SUB-COMPONENTS
const ConversationItem = ({ conv, active, onClick }: ConversationItemProps) => (
  <div
    onClick={() => onClick(conv.conversation_key)}
    style={STYLES.conversationItem(active)}
  >
    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
      <Badge dot>
        <Avatar icon={<MessageOutlined />} style={{ background: "#1890ff" }} />
      </Badge>
      <div style={{ flex: 1, minWidth: 0 }}>
        <Typography.Text ellipsis>{conv.username}</Typography.Text>
      </div>
    </div>
  </div>
);

const MessageBubble = ({ msg, agentId }: MessageBubbleProps) => {
  const isAgent = msg.sender_id === agentId;
  const isUrl = typeof msg.content === "string" && msg.content.startsWith("http");
  const isImage = isUrl && isImageUrl(msg.content);
  const isDocument = isUrl && isDocumentUrl(msg.content);

  return (
    <div style={{ marginBottom: "16px", display: "flex", justifyContent: isAgent ? "flex-end" : "flex-start", gap: "8px" }}>
      {!isAgent && <Avatar icon={<UserOutlined />} size={32} />}
      <div style={STYLES.messageBubble(isAgent)}>
        {isImage ? (
          <Image width={200} src={msg.content} preview />
        ) : isDocument ? (
          <a href={msg.content} target="_blank" rel="noopener noreferrer" style={{ color: isAgent ? "#fff" : "#1890ff" }}>
            {getFilenameFromUrl(msg.content)}
          </a>
        ) : (
          <Typography.Text style={{ color: isAgent ? "#fff" : "#000" }}>
            {msg.content}
          </Typography.Text>
        )}
      </div>
      {isAgent && <Avatar icon={<RobotOutlined />} size={32} style={{ background: "#52c41a" }} />}
    </div>
  );
};

// 8. MAIN COMPONENTS
function ChatRoom({userId, conversationKey, initialMessages }: ChatRoomProps) {
  const [input, setInput] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleChatMessage = (msg: Message) => {
    setMessages(prev => [...prev, msg]);
  }

  const { sendMessage: sendWS } = useWebSocket(
    userId, 
    conversationKey, 
    handleChatMessage
  );
  const { upload, isUploading, uploadError } = useFileUpload();

  useEffect(() => {
    const el = scrollRef.current;
    console.log(el)
    if (!el) return;

    el.scrollTop = el.scrollHeight;
  }, [messages, conversationKey]);

  useEffect(() => {
    setMessages(initialMessages);
    setPreviews([]);
    setFiles([]);
  }, [conversationKey, initialMessages]);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);

    setFiles(prevFiles => {
      const existingKeys = new Set(prevFiles.map(f => `${f.name}_${f.size}_${f.lastModified}`));
      const newFiles: File[] = [];

      selected.forEach(file => {
        const key = `${file.name}_${file.size}_${file.lastModified}`;

        // chặn > 5MB
        if (file.size > MAX_FILE_SIZE) {
          message.error(`File "${file.name}" vượt quá 5MB`);
          return;
        }

        // nếu đã có thì bỏ qua (và thông báo nếu muốn)
        if (existingKeys.has(key)) {
          return;
        }

        existingKeys.add(key);
        newFiles.push(file);

        // tạo preview bất đồng bộ
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

    // reset input để có thể chọn lại cùng file nếu cần
    e.target.value = "";
  };

  const removeFile = (idx: number) => {
    setFiles(prev => prev.filter((_, i) => i !== idx));
    setPreviews(prev => prev.filter((_, i) => i !== idx));
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text && previews.length === 0) return;

    if (text) {
      const payload = createPayload("message", text, conversationKey, userId);
      sendWS(payload);
      console.log(payload);
      setMessages(prev => [...prev, JSON.parse(payload)]);
      setInput("");
    }

    if (previews.length > 0) {
      try {
        const res = await upload(files);
        res.data.urls.forEach((url: string) => {
          const payload = createPayload("file", url, conversationKey, userId);
          sendWS(payload);
          setMessages(prev => [...prev, JSON.parse(payload)]);
        });
        setPreviews([]);
        setFiles([]);
      } catch {
        message.error("Tải lên thất bại!");
      }
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={STYLES.chatHeader}>
        <Avatar icon={<MessageOutlined />} style={{ background: "#1890ff" }} />
        <div>
          <Typography.Text strong>{conversationKey}</Typography.Text>
          <br />
          <Typography.Text type="secondary" style={{ fontSize: "12px" }}>
            {/* Agent: {AGENT_ID} */}
          </Typography.Text>
        </div>
      </div>

      <div style={STYLES.messagesArea} ref={scrollRef}>
        {messages.length === 0 ? (
          <Empty description="Chưa có tin nhắn" style={{ marginTop: "100px" }} />
        ) : (
          <>
            {messages.map((m, i) => (
              <MessageBubble key={i} msg={m} agentId={userId}/>
            ))}
          </>
        )}
      </div>

      {files.length > 0 && (
        <div style={{ padding: "12px", borderTop: "1px solid #f0f0f0", display: "flex", gap: "8px", overflowX: "auto" }}>
          {files.map((file, i) => (
            <div key={i} style={STYLES.filePreview}>
              {renderPreviewAttachment(file)}
              <Button
                type="text"
                danger
                icon={<CloseOutlined />}
                size="small"
                onClick={() => removeFile(i)}
                style={STYLES.fileRemoveBtn}
              />
            </div>
          ))}
        </div>
      )}

      <div className="p-3 bg-white border-t border-gray-200">
        <div className="flex items-center gap-2">
          <input
            type="file"
            accept="*"
            multiple
            onChange={handleFile}
            style={{ display: "none" }}
            id="fileInput"
          />
          <Button
            type="text"
            icon={<PaperClipOutlined />}
            onClick={() => document.getElementById("fileInput")?.click()}
          />
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            placeholder="Nhập tin nhắn..."
            className="flex-1 border border-gray-300 px-3 py-2 rounded-full focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() && previews.length === 0 || isUploading}
            className="bg-blue-500 text-white px-4 py-2 rounded-full hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            Gửi
          </button>
        </div>
      </div>
    </div>
  );
}

function useConversationData(userId: string, activeKey: string) {
  const {
    data: convs_keys,
    isPending: convsLoading,
    error: convError
  } = useQuery({
    queryKey: ["conversation_keys", userId],
    queryFn: () => fetchConversationKeys(userId),
    staleTime: 5 * 60 * 1000,
  }, queryClient);

  const {
    data: msgs,
    isPending: msgsLoading,
    error: msgError
  } = useQuery({
    queryKey: ["messages", activeKey],
    queryFn: () => fetchConversationMessages(activeKey),
    enabled: !!activeKey,
    staleTime: 2 * 60 * 1000,
  }, queryClient);

  return {
    convs: convs_keys?.data || [],
    msgs: msgs?.data || [],

    convsLoading,
    msgsLoading,

    conversationError: convError,
    messageError: msgError,

    isLoading: convsLoading || msgsLoading,
    hasError: !!convError || !!msgError,
  };
}

export function ConversationLayout() {
  const [activeKey, setActiveKey] = useState("");
  const { payload } = useAuthStore()
  const userId = payload?.user_id || ""

  const {
    convs,
    msgs,
    convsLoading,
    msgsLoading,
    messageError,
  } = useConversationData(userId, activeKey);
  logger.info(convs)

  if (convsLoading) {
    return (
      <ManagementLayout>
        <Spin size="large" style={{ marginTop: "20vh" }} />
      </ManagementLayout>
    );
  }

  return (
    <ManagementLayout>
      <Layout style={{ height: "calc(100vh - 64px)" }}>
        <Layout.Sider width={320} style={STYLES.sidebar}>
          <div style={STYLES.sidebarHeader}>
            <Typography.Text strong>
              <MessageOutlined /> Danh sách
            </Typography.Text>
          </div>
          <div style={{ overflowY: "auto", height: "calc(100% - 60px)" }}>
            {convs.length === 0 ? (
              <Empty description="Chưa có cuộc trò chuyện" />
            ) : (
              convs.map((c: Conversation) => (
                <ConversationItem
                  key={c.conversation_key}
                  conv={c}
                  active={activeKey === c.conversation_key}
                  onClick={setActiveKey}
                />
              ))
            )}
          </div>
        </Layout.Sider>

        <Layout.Content style={{ background: "#fff" }}>
          {!activeKey ? (
            <Empty description="Chọn cuộc trò chuyện" style={{ margin: "60px 0" }} />
          ) : messageError ? (
            <div style={{ padding: '20px', textAlign: 'center' }}>
              <Typography.Text type="danger">
                Lỗi tải tin nhắn: {messageError.message}
              </Typography.Text>
            </div>
          ) : msgsLoading ? (
            <Spin size="large" tip="Đang tải..." />
          ) : (
            <ChatRoom
              key={activeKey}
              conversationKey={activeKey}
              initialMessages={msgs}
              userId={userId}
            />
          )}
        </Layout.Content>
      </Layout>
    </ManagementLayout>
  );
}