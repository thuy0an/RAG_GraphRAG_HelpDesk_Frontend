// Bộ helper dùng chung cho xử lý ngày tháng và URL/file trong UI chat.
// Các hàm này độc lập với React để có thể tái sử dụng ở nhiều nơi.

import dayjs from "dayjs";

export class Utility {
  // Định dạng ngày theo kiểu đọc tiếng Việt phục vụ tooltip/thời gian tin nhắn.
  static formatVietnameseDate = (dateString: string) => {
    if (!dateString) return "";
    const date = dayjs(dateString);
    return date.isValid() ? `${date.date()} Tháng ${date.month() + 1} ${date.year()}` : "";
  };

  // Lấy tên file thô từ URL (bỏ path và query string).
  static getFilenameFromUrl = (url: string) => {
    const parts = url.split("/");
    const lastPart = parts[parts.length - 1];
    return lastPart.split("?")[0];
  };

  // Trích xuất phần đuôi mở rộng của file từ URL.
  static getFileExtension = (url: string) => {
    const filename = this.getFilenameFromUrl(url);
    const parts = filename.split(".");
    return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "";
  };

  // Kiểm tra URL có phải file ảnh để render preview image hay không.
  static isImageUrl = (url: string) => {
    const ext = this.getFileExtension(url);
    return ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"].includes(ext);
  };

  // Kiểm tra URL có phải file tài liệu để render link tài liệu hay không.
  static isDocumentUrl = (url: string) => {
    const ext = this.getFileExtension(url);
    return ["pdf", "doc", "docx"].includes(ext);
  };
}
