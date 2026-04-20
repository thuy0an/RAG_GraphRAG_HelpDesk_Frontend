import { create } from "zustand";

const PUBLIC_WS_BASE_URL = import.meta.env.PUBLIC_WS_BASE_URL;
const PUBLIC_API_BASE_URL = import.meta.env.PUBLIC_API_BASE_URL;
const PROJECT_ENV = import.meta.env.PUBLIC_PROJECT_ENV;

export { PUBLIC_WS_BASE_URL, PUBLIC_API_BASE_URL, PROJECT_ENV};

export const defaultParams = (params: URLSearchParams) => ({
  page: Number(params.get('page')) || 1,
  page_size: Number(params.get('page_size')) || 10,
});

const Dictionary = {
  actions: {
    delete: 'Xóa',
    add: 'Thêm',
    upload: `Thêm file mới`,
    download: `Tải file về`
  }
}

const Theme = {
  spacing: {
    small: '8px 0',
    medium: '16px 0',
    large: '24px 0'
  }
}

const AttachmentConfig = {
  style: {
    margin: Theme.spacing.small
  },
  labels: {
    upload: Dictionary.actions.upload,
    download: Dictionary.actions.download,
    delete: Dictionary.actions.delete,
  }
}

export const useAttachmentStore = create(() => AttachmentConfig)

export const STORAGE_TYPE = {
  SYSTEM: 'system'
}
