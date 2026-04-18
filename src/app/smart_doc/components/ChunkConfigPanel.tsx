import React from "react";

interface ChunkConfig {
  parent_chunk_size: number;
  parent_chunk_overlap: number;
  child_chunk_size: number;
  child_chunk_overlap: number;
}

interface ChunkConfigPanelProps {
  chunkConfig: ChunkConfig;
  setChunkConfig: React.Dispatch<React.SetStateAction<ChunkConfig>>;
}

export function ChunkConfigPanel({ chunkConfig, setChunkConfig }: ChunkConfigPanelProps) {
  return (
    <div className="grid grid-cols-2 gap-2 text-xs">
      <label className="flex flex-col gap-1">
        Parent chunk size
        <input
          type="number"
          value={chunkConfig.parent_chunk_size}
          min={200}
          onChange={(e) =>
            setChunkConfig((prev) => ({
              ...prev,
              parent_chunk_size: Number(e.target.value),
            }))
          }
          className="border border-gray-300 rounded px-2 py-1"
        />
      </label>
      <label className="flex flex-col gap-1">
        Parent overlap
        <input
          type="number"
          value={chunkConfig.parent_chunk_overlap}
          min={0}
          onChange={(e) =>
            setChunkConfig((prev) => ({
              ...prev,
              parent_chunk_overlap: Number(e.target.value),
            }))
          }
          className="border border-gray-300 rounded px-2 py-1"
        />
      </label>
      <label className="flex flex-col gap-1">
        Child chunk size
        <input
          type="number"
          value={chunkConfig.child_chunk_size}
          min={100}
          onChange={(e) =>
            setChunkConfig((prev) => ({
              ...prev,
              child_chunk_size: Number(e.target.value),
            }))
          }
          className="border border-gray-300 rounded px-2 py-1"
        />
      </label>
      <label className="flex flex-col gap-1">
        Child overlap
        <input
          type="number"
          value={chunkConfig.child_chunk_overlap}
          min={0}
          onChange={(e) =>
            setChunkConfig((prev) => ({
              ...prev,
              child_chunk_overlap: Number(e.target.value),
            }))
          }
          className="border border-gray-300 rounded px-2 py-1"
        />
      </label>
    </div>
  );
}
