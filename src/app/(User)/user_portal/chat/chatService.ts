// Lớp service gom toàn bộ gọi API/chat/storage cho user portal.
// Tách riêng tầng này giúp component UI chỉ còn lo render + state orchestration.

import { PUBLIC_API_BASE_URL, PUBLIC_WS_BASE_URL } from "@/constants/constant";
import { logger } from "@/utils/logger";

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
  };

  STORAGE_URL = {
    GET_FILES: `${PUBLIC_API_BASE_URL}/storage/files`,
    UPLOAD_FILES: `${PUBLIC_API_BASE_URL}/storage/files/upload`,
    DELETE_FILES: (id: string) => `${PUBLIC_API_BASE_URL}/storage/files/${id}`,
  };

  WS_URL = {
    CHAT: {
      USER_ROOM: (userId: string) => `${PUBLIC_WS_BASE_URL}/ws/${userId}`,
      CONVERSATION_ROOM: (userId: string, conversationKey: string) =>
        `${PUBLIC_WS_BASE_URL}/ws/${userId}/${conversationKey}`,
    },
  };

  // Stream câu trả lời PaCRAG theo từng chunk để UI có thể hiển thị realtime.
  async *streamChat(
    prompt: string,
    sessionId: string,
    turnId?: string,
    sourceFilter?: string | null,
    sourceFilters?: string[] | null
  ) {
    const res = await fetch(this.CHAT_URL.STREAM, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: prompt,
        session_id: sessionId || "anonymous",
        // If compare flow already created a turn, keep streaming into that turn instead of creating a new one.
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
      throw new Error("No response body");
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

  // Lấy conversation key theo user để map vào đúng phòng chat.
  async fetchConversationKey(user_id: string) {
    if (!user_id) return [];

    const url = this.CHAT_URL.CONVERSATION_KEY(user_id);
    logger.api("GET", url);

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error("Lỗi khi tải dữ liệu conversation");
    }

    const result = await response.json();
    return result;
  }

  // Lấy toàn bộ message của một conversation room.
  async fetchMessages(conversation_key: string) {
    if (!conversation_key || conversation_key === "None") return [];

    const url = this.CHAT_URL.MESSAGES(conversation_key);
    const response = await fetch(url);
    logger.api("GET", url);

    if (!response.ok) {
      throw new Error("Lỗi khi tải dữ liệu messages");
    }

    const data = await response.json();
    logger.success("[fetchMessages] data:", data);
    return data;
  }

  // Lấy lịch sử hội thoại AI đã lưu cho session hiện tại.
  async fetchAIChatHistory(sessionId: string) {
    const url = this.CHAT_URL.AI_HISTORY(sessionId);
    logger.api("GET", url);

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch AI chat history: ${response.status}`);
    }
    logger.info("[fetchAIChatHistory] status:", response.status);

    const data = await response.json();

    logger.success("[fetchAIChatHistory] data:", data);
    return data;
  }

  // Lấy lịch sử hội thoại GraphRAG cho session hiện tại.
  async fetchGraphRAGHistory(sessionId: string) {
    const url = `${PUBLIC_API_BASE_URL}/langchain/graph/history/${sessionId}`;
    logger.api("GET", url);
    const response = await fetch(url, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    if (!response.ok) throw new Error(`Failed to fetch GraphRAG history: ${response.status}`);
    return response.json();
  }

  // Gửi một câu chat dạng request/response đơn giản (không stream).
  async sendChatMessage(sessionId: string, message: string) {
    const url = this.CHAT_URL.STREAM;
    logger.api("POST", url);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        session_id: sessionId || "anonymous",
        query: message,
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to send chat message");
    }
    logger.info("[sendChatMessage] status:", response.status);

    const data = await response.text();
    logger.success("[sendChatMessage] data received");

    return data;
  }

  // Upload tài liệu cho pipeline PaCRAG kèm cấu hình chunking.
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

  // Upload tài liệu cho flow compare (PaCRAG + GraphRAG cùng lúc).
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

  // Thực thi truy vấn compare cho một run cụ thể.
  async compareQuery(
    sessionId: string,
    runId: string,
    query: string,
    rerankingEnabled: boolean = false,
    sourceFilter: string | null = null,
    sourceFilters: string[] | null = null
  ) {
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

  // Gọi truy vấn GraphRAG độc lập (fallback hoặc chạy song song với PaCRAG).
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
        // If compare history already has a turn, keep the graph response attached to that turn.
        ...(turnId ? { turn_id: turnId, save_history: false } : {}),
      }),
    });

    if (!response.ok) {
      throw new Error("Graph query failed");
    }

    return response.json();
  }

  // Lấy lịch sử các compare run của session.
  async fetchCompareHistory(sessionId: string) {
    const response = await fetch(this.CHAT_URL.COMPARE_HISTORY(sessionId));
    if (!response.ok) {
      throw new Error("Fetch compare history failed");
    }
    return response.json();
  }

  // Xóa một compare run theo runId.
  async deleteCompareRun(runId: string) {
    const response = await fetch(this.CHAT_URL.COMPARE_DELETE(runId), {
      method: "DELETE",
    });
    if (!response.ok) {
      throw new Error("Delete compare run failed");
    }
    return response.json();
  }

  // Xóa toàn bộ lịch sử chat của session.
  async clearHistory(sessionId: string) {
    const response = await fetch(this.CHAT_URL.CLEAR_HISTORY(sessionId), {
      method: "DELETE",
    });

    if (!response.ok) {
      throw new Error("Clear history failed");
    }

    return response.json();
  }

  // Xóa vector store toàn cục hoặc theo source cụ thể.
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

  // Xóa tài liệu khỏi kho PaCRAG theo tên file.
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

  // Xóa tài liệu/nguồn khỏi GraphRAG theo source name.
  async deleteGraphDocument(source: string) {
    const response = await fetch(this.CHAT_URL.DELETE_GRAPH(source), {
      method: "DELETE",
    });

    if (!response.ok) {
      throw new Error("Delete GraphRAG document failed");
    }

    return response.json();
  }

  // Xóa toàn bộ dữ liệu GraphRAG (graph store) để reset hệ thống.
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
