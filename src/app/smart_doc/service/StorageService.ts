import { PUBLIC_API_BASE_URL } from "@/shared/constants/constant";
import { logger } from "@/shared/utils/logger";

export class StorageService {
  STORAGE_URL = {
    GET_FILES: `${PUBLIC_API_BASE_URL}/storage/files`,
    UPLOAD_FILES: `${PUBLIC_API_BASE_URL}/storage/files/upload`,
    DELETE_FILES: (id: string) => `${PUBLIC_API_BASE_URL}/storage/files/${id}`,
  }

  async getFiles() {
    const url = this.STORAGE_URL.GET_FILES;
    logger.api('GET', url);

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to get files: ${response.status}`);
    }

    return response.json();
  }

  async uploadFiles(files: File[]) {
    const formData = new FormData();
    files.forEach(file => {
      formData.append('files', file);
    });

    const url = this.STORAGE_URL.UPLOAD_FILES;
    logger.api('POST', url);

    const response = await fetch(url, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Failed to upload files: ${response.status}`);
    }

    return response.json();
  }

  async deleteFile(fileId: string) {
    const url = this.STORAGE_URL.DELETE_FILES(fileId);
    logger.api('DELETE', url);

    const response = await fetch(url, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error(`Failed to delete file: ${response.status}`);
    }

    return response.json();
  }
}
