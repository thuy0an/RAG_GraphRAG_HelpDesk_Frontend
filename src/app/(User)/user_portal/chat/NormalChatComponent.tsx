import { useCallback, useEffect, useRef, useState } from "react";
import type { Message } from "./types";
import { useMessages, uploadFiles } from "./hooks";
import { queryClient, useMutation } from "@/lib/ReactQuery";
import { Button, message } from "antd";
import { CloseOutlined, PaperClipOutlined } from "@ant-design/icons";
import { MessageBubble, renderPreviewAttachment } from "./presentation";

export interface NormalChatComponentProps {
  userId: string;
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  isConnected: boolean;
  sendMessage: (content: string) => void;
  conversationKey: string;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024;

// Component chế độ chat thường:
// - đồng bộ lịch sử hội thoại theo conversation key,
// - gửi tin nhắn realtime qua WebSocket,
// - upload file đính kèm rồi phát URL file vào phòng chat.
export function NormalChatComponent({
  userId,
  messages,
  setMessages,
  isConnected,
  sendMessage,
  conversationKey,
}: NormalChatComponentProps) {
  const [input, setInput] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const messagesAreaRef = useRef<HTMLDivElement>(null);

  const { data: chatroomMessages, isLoading: isLoadingChatroomMessages } = useMessages(conversationKey);

  const { mutateAsync: upload, isPending } = useMutation(
    {
      mutationFn: (files: File[]) => uploadFiles(files),
    },
    queryClient
  );

  useEffect(() => {
    if (chatroomMessages?.data) {
      setMessages(chatroomMessages.data);
    }
  }, [chatroomMessages?.data, setMessages]);

  useEffect(() => {
    const el = messagesAreaRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  // Nhận danh sách file từ input, lọc trùng + chặn file quá dung lượng trước khi đưa vào state.
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);

    setFiles((prevFiles) => {
      const existingKeys = new Set(prevFiles.map((f) => `${f.name}_${f.size}_${f.lastModified}`));
      const newFiles: File[] = [];

      selected.forEach((file) => {
        const key = `${file.name}_${file.size}_${file.lastModified}`;

        if (file.size > MAX_FILE_SIZE) {
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

  // Xóa 1 file khỏi danh sách đính kèm theo vị trí hiển thị.
  const removeFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  // Gửi text và/hoặc file đính kèm theo đúng thứ tự thao tác của người dùng.
  // Nếu text có nội dung: render optimistic trước, sau đó đẩy qua WebSocket.
  // Nếu có file: upload xong mới gửi URL từng file vào phòng chat.
  const handleSendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text && files.length === 0) return;

    if (text) {
      const newMessage: Message = {
        id: crypto.randomUUID(),
        sender_id: userId,
        content: text,
        created_at: new Date().toISOString(),
        conversation_key: conversationKey,
      };

      // FIX: Đảm bảo message được add vào state trước khi gửi WebSocket
      setMessages((prev: any) => [...prev, newMessage]);
      setInput(""); // Clear input ngay lập tức

      // Đợi một tick để đảm bảo state đã được update
      await new Promise(resolve => setTimeout(resolve, 0));

      if (isConnected) {
        sendMessage(text);
      } else {
        message.error("WebSocket chưa kết nối");
      }
    }

    if (files.length > 0) {
      try {
        const res = await upload(files);
        
        // Process files sequentially để tránh race condition
        for (const url of res.data.urls) {
          const fileMessage: Message = {
            id: crypto.randomUUID(),
            sender_id: userId,
            content: url,
            created_at: new Date().toISOString(),
            conversation_key: conversationKey,
          };

          setMessages((prev: any) => [...prev, fileMessage]);
          
          // Đợi một tick trước khi gửi WebSocket
          await new Promise(resolve => setTimeout(resolve, 0));

          if (isConnected) {
            sendMessage(url);
          }
        }

        setFiles([]);
      } catch {
        message.error("Tải lên thất bại!");
      }
    }
  }, [input, files, upload, userId, conversationKey, isConnected, sendMessage, setMessages]);

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
            {messages?.map((m: any, index: number) => (
              <MessageBubble key={m.id || `message-${index}`} msg={m} currentUserId={userId} />
            ))}
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
            onChange={handleFile}
            className="hidden"
            id="fileInput"
          />
          <Button
            type="text"
            icon={<PaperClipOutlined />}
            aria-label="Mở chọn tệp đính kèm"
            onClick={() => document.getElementById("fileInput")?.click()}
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
