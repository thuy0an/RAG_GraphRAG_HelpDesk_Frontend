import { PUBLIC_API_BASE_URL } from "@/shared/constants/constant";
import { logger } from "@/shared/utils/logger";

export class CompareService {
  COMPARE_URL = {
    UPLOAD: `${PUBLIC_API_BASE_URL}/langchain/compare/upload`,
    QUERY: `${PUBLIC_API_BASE_URL}/langchain/compare/query`,
    HISTORY: (sessionId: string) => `${PUBLIC_API_BASE_URL}/langchain/compare/history/${sessionId}`,
    DELETE: (runId: string) => `${PUBLIC_API_BASE_URL}/langchain/compare/history/${runId}`,
  }

  async compareUpload(file: File) {
    const formData = new FormData();
    formData.append('file', file);

    const url = this.COMPARE_URL.UPLOAD;
    logger.api('POST', url);

    const response = await fetch(url, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Failed to compare upload: ${response.status}`);
    }

    return response.json();
  }

  async getCompareHistory(sessionId: string) {
    const url = this.COMPARE_URL.HISTORY(sessionId);
    logger.api('GET', url);

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to get compare history: ${response.status}`);
    }

    return response.json();
  }

  // Alias for getCompareHistory for compatibility
  async fetchCompareHistory(sessionId: string) {
    return this.getCompareHistory(sessionId);
  }

  async uploadCompare(sessionId: string, files: File[], config: any) {
    const url = this.COMPARE_URL.UPLOAD;
    logger.api('POST', url);

    const formData = new FormData();
    formData.append("session_id", sessionId);
    files.forEach(f => formData.append("files", f));
    formData.append("parent_chunk_size", config.parent_chunk_size.toString());
    formData.append("parent_chunk_overlap", config.parent_chunk_overlap.toString());
    formData.append("child_chunk_size", config.child_chunk_size.toString());
    formData.append("child_chunk_overlap", config.child_chunk_overlap.toString());

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
      },
      body: formData
    });

    if (!response.ok) {
      throw new Error(`Failed to upload for comparison: ${response.status}`);
    }

    return response.json();
  }

  async compareQuery(sessionId: string, runId: string, query: string) {
    const url = this.COMPARE_URL.QUERY;
    logger.api('POST', url);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        session_id: sessionId,
        run_id: runId,
        query: query
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to compare query: ${response.status}`);
    }

    return response.json();
  }

  async deleteCompareRun(runId: string) {
    const url = this.COMPARE_URL.DELETE(runId);
    logger.api('DELETE', url);

    const response = await fetch(url, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error(`Failed to delete compare run: ${response.status}`);
    }

    return response.json();
  }
}
