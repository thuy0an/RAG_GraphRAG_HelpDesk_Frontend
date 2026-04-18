import React from "react";
import { FileTextOutlined } from "@ant-design/icons";
import { CONSTANT } from "../types";

interface FilePreviewProps {
  file: File;
}

export function FilePreview({ file }: FilePreviewProps) {
  if (file.type.startsWith("image/")) {
    return (
      <img
        src={URL.createObjectURL(file)}
        alt={file.name}
        style={CONSTANT.STYLES.filePreview.image}
      />
    );
  } else {
    return (
      <div style={CONSTANT.STYLES.filePreview.fileWrapper}>
        <div style={CONSTANT.STYLES.filePreview.fileIcon}>
          <FileTextOutlined style={CONSTANT.STYLES.filePreview.fileIconSvg} />
        </div>
        <div style={CONSTANT.STYLES.filePreview.fileName}>
          {file.name}
        </div>
      </div>
    );
  }
}
