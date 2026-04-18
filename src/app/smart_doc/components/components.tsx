import React from "react";
import ReactMarkdown from "react-markdown";
import { Button, Collapse, Empty, Image, message, Modal, Spin, Tooltip } from "antd";
import {
  CloudUploadOutlined,
  CloseOutlined,
  DatabaseOutlined,
  FileTextOutlined,
  HistoryOutlined,
  PaperClipOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import type { Message, ChatModeToggleProps } from "../types";
import { CONSTANT, MessageRole } from "../types";

// ===== MESSAGE COMPONENTS =====
export const MessageBubble: React.FC<{
  message: Message;
  currentUserId: string;
}> = ({ message, currentUserId }) => {
  console.log(currentUserId)
  console.log(message.role)
  const isFromUser = message.role?.includes('user') ? true : false

  return (
    <div style={CONSTANT.STYLES.messageContainer(isFromUser)}>
      <div style={CONSTANT.STYLES.messageBubble(isFromUser)}>
        <ReactMarkdown>{message.content}</ReactMarkdown>
        <div style={{
          fontSize: '12px',
          opacity: 0.7,
          marginTop: '8px',
          textAlign: isFromUser ? 'right' : 'left'
        }}>
          {message.created_at && dayjs(message.created_at).format('HH:mm')}
        </div>
      </div>
    </div>
  );
};

export const MessageList: React.FC<{
  messages: Message[];
  currentUserId: string;
  isLoading?: boolean;
}> = ({ messages, currentUserId, isLoading }) => {
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (messages.length === 0 && !isLoading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100%',
        flexDirection: 'column'
      }}>
        <Empty 
          description="Start a conversation" 
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      </div>
    );
  }

  return (
    <div style={CONSTANT.STYLES.messagesArea}>
      {messages.map((message, index) => (
        <MessageBubble
          key={`${message.id}-${message.role || 'unknown'}-${index}`}
          message={message}
          currentUserId={currentUserId}
        />
      ))}
      {isLoading && (
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <Spin size="small" />
          <span style={{ marginLeft: '8px' }}>AI is thinking...</span>
        </div>
      )}
      <div ref={messagesEndRef} />
    </div>
  );
};

// ===== INPUT COMPONENTS =====
export const ChatInput: React.FC<{
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onFileUpload: (files: File[]) => void;
  disabled?: boolean;
  isStreaming?: boolean;
}> = ({ value, onChange, onSend, onFileUpload, disabled, isStreaming }) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      onFileUpload(files);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div style={CONSTANT.STYLES.inputArea}>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileSelect}
          style={{ display: 'none' }}
          accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.gif"
        />
        
        <Button
          icon={<PaperClipOutlined />}
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || isStreaming}
        />
        
        <div style={{ flex: 1 }}>
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your message..."
            disabled={disabled || isStreaming}
            style={{
              width: '100%',
              minHeight: '40px',
              maxHeight: '120px',
              padding: '8px 12px',
              border: '1px solid #d9d9d9',
              borderRadius: '6px',
              resize: 'none',
              fontFamily: 'inherit',
              fontSize: '14px',
              lineHeight: '1.4',
            }}
            rows={1}
          />
        </div>
        
        <Button
          type="primary"
          onClick={onSend}
          disabled={!value.trim() || disabled || isStreaming}
          style={{ height: '40px' }}
        >
          Send
        </Button>
      </div>
    </div>
  );
};

// ===== HEADER COMPONENTS =====
export const ChatHeader: React.FC<{
  mode: 'ai' | 'chat';
  onToggle: () => void;
  onClearHistory: () => void;
  onClearVectorStore: () => void;
  disabled?: boolean;
  isClearingHistory?: boolean;
  isClearingVectorStore?: boolean;
}> = ({ 
  mode, 
  onToggle, 
  onClearHistory, 
  onClearVectorStore, 
  disabled,
  isClearingHistory,
  isClearingVectorStore
}) => {
  return (
    <div style={CONSTANT.STYLES.chatHeader}>
      <div style={{ flex: 1, fontWeight: 'bold' }}>
        {mode === 'ai' ? 'AI Assistant' : 'Chat'}
      </div>
      
      <Button
        size="small"
        onClick={onToggle}
        disabled={disabled}
      >
        Switch to {mode === 'ai' ? 'Chat' : 'AI'}
      </Button>
      
      <Tooltip title="Clear History">
        <Button
          size="small"
          icon={<HistoryOutlined />}
          onClick={onClearHistory}
          disabled={disabled}
          loading={isClearingHistory}
        />
      </Tooltip>
      
      <Tooltip title="Clear Vector Store">
        <Button
          size="small"
          icon={<DatabaseOutlined />}
          onClick={onClearVectorStore}
          disabled={disabled}
          loading={isClearingVectorStore}
        />
      </Tooltip>
    </div>
  );
};

// ===== FILE COMPONENTS =====
export const FileUploadArea: React.FC<{
  onDrop: (files: File[]) => void;
  isUploading?: boolean;
  uploadProgress?: number;
}> = ({ onDrop, isUploading, uploadProgress }) => {
  const [isDragging, setIsDragging] = React.useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      onDrop(files);
    }
  };

  return (
    <div
      style={{
        ...CONSTANT.STYLES.fileUploadArea,
        borderColor: isDragging ? '#1890ff' : '#d9d9d9',
        backgroundColor: isDragging ? '#f0f8ff' : '#fafafa',
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isUploading ? (
        <div>
          <Spin />
          <div style={{ marginTop: '8px' }}>Uploading... {uploadProgress}%</div>
        </div>
      ) : (
        <div>
          <CloudUploadOutlined style={{ fontSize: '48px', color: '#d9d9d9' }} />
          <div style={{ marginTop: '16px' }}>
            Drag and drop files here, or click to browse
          </div>
          <div style={{ marginTop: '8px', fontSize: '12px', color: '#999' }}>
            Supported: PDF, DOC, DOCX, TXT, Images (Max 5MB per file)
          </div>
        </div>
      )}
    </div>
  );
};

export const FileItem: React.FC<{
  file: {
    id: string;
    file_name: string;
    url: string;
    size?: number;
  };
  onDelete?: (fileId: string) => void;
  isDeleting?: boolean;
}> = ({ file, onDelete, isDeleting }) => {
  const isImage = CONSTANT.isImageUrl(file.url);
  const isDocument = CONSTANT.isDocumentUrl(file.url);

  const handleDelete = () => {
    Modal.confirm({
      title: 'Xác nhận xóa',
      content: `Bạn có chắc chắn muốn xóa file "${file.file_name}" không?`,
      okText: 'Xóa',
      okType: 'danger',
      cancelText: 'Hủy',
      onOk: () => onDelete?.(file.id)
    });
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      padding: '8px',
      border: '1px solid #f0f0f0',
      borderRadius: '6px',
      marginBottom: '8px',
      backgroundColor: '#fafafa'
    }}>
      <div style={{ marginRight: '12px' }}>
        {isImage ? (
          <Image
            width={40}
            height={40}
            src={file.url}
            preview={false}
            style={{ objectFit: 'cover', borderRadius: '4px' }}
          />
        ) : (
          <FileTextOutlined style={{ fontSize: '24px', color: '#1890ff' }} />
        )}
      </div>
      
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ 
          fontWeight: 'bold', 
          fontSize: '14px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}>
          {file.file_name}
        </div>
        {file.size && (
          <div style={{ fontSize: '12px', color: '#999' }}>
            {(file.size / 1024).toFixed(1)} KB
          </div>
        )}
      </div>
      
      {onDelete && (
        <Button
          size="small"
          icon={<CloseOutlined />}
          onClick={handleDelete}
          type="text"
          danger
          loading={isDeleting}
          disabled={isDeleting}
        />
      )}
    </div>
  );
};

// ===== SIDEBAR COMPONENTS =====
export const FileSidebar: React.FC<{
  files: Array<{
    id: string;
    file_name: string;
    url: string;
    size?: number;
  }>;
  onDeleteFile?: (fileId: string) => void;
  onUploadFiles?: (files: File[]) => void;
  isUploading?: boolean;
  isDeletingFile?: boolean;
  deletingFileId?: string | null;
}> = ({ files, onDeleteFile, onUploadFiles, isUploading, isDeletingFile, deletingFileId }) => {
  return (
    <div style={CONSTANT.STYLES.sidebar}>
      <div style={CONSTANT.STYLES.sidebarSection}>
        <div style={{ fontWeight: 'bold', marginBottom: '12px' }}>
          Files ({files.length})
        </div>

        {onUploadFiles && (
          <FileUploadArea
            onDrop={onUploadFiles}
            isUploading={isUploading}
          />
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
        {files.map((file) => (
          <FileItem
            key={file.id}
            file={file}
            onDelete={onDeleteFile}
            isDeleting={isDeletingFile && deletingFileId === file.id}
          />
        ))}
        
        {files.length === 0 && !isUploading && (
          <Empty
            description="No files uploaded"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        )}
      </div>
    </div>
  );
};

// ===== SETTINGS COMPONENTS =====
export const ChatModeToggle: React.FC<ChatModeToggleProps> = ({ 
  mode, 
  onToggle, 
  disabled 
}) => {
  return (
    <div style={{ 
      display: 'flex', 
      alignItems: 'center', 
      gap: '8px',
      padding: '8px 12px',
      backgroundColor: '#f5f5f5',
      borderRadius: '6px'
    }}>
      <span style={{ fontSize: '14px', fontWeight: 'bold' }}>Mode:</span>
      <Button
        size="small"
        type={mode === 'ai' ? 'primary' : 'default'}
        onClick={onToggle}
        disabled={disabled}
      >
        AI
      </Button>
      <Button
        size="small"
        type={mode === 'chat' ? 'primary' : 'default'}
        onClick={onToggle}
        disabled={disabled}
      >
        Chat
      </Button>
    </div>
  );
};

export const SettingsPanel: React.FC<{
  visible: boolean;
  onClose: () => void;
  onClearHistory: () => void;
  onClearVectorStore: () => void;
  isClearingHistory?: boolean;
  isClearingVectorStore?: boolean;
}> = ({ 
  visible, 
  onClose, 
  onClearHistory, 
  onClearVectorStore,
  isClearingHistory,
  isClearingVectorStore
}) => {
  if (!visible) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        padding: '24px',
        minWidth: '400px',
        maxWidth: '90%'
      }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '20px'
        }}>
          <h3 style={{ margin: 0 }}>Settings</h3>
          <Button
            icon={<CloseOutlined />}
            onClick={onClose}
            type="text"
          />
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <h4>Chat Management</h4>
            <p style={{ margin: '8px 0', color: '#666', fontSize: '14px' }}>
              Clear your chat history and vector store data
            </p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button
                icon={<HistoryOutlined />}
                onClick={onClearHistory}
                loading={isClearingHistory}
                danger
              >
                Clear History
              </Button>
              <Button
                icon={<DatabaseOutlined />}
                onClick={onClearVectorStore}
                loading={isClearingVectorStore}
                danger
              >
                Clear Vector Store
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
