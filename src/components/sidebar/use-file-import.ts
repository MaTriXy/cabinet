"use client";

import { useCallback, useState } from "react";
import { useTreeStore } from "@/stores/tree-store";

async function uploadOne(targetVirtualPath: string, file: File): Promise<void> {
  const form = new FormData();
  form.append("file", file);
  const encoded = targetVirtualPath
    .split("/")
    .filter(Boolean)
    .map(encodeURIComponent)
    .join("/");
  const res = await fetch(`/api/upload/${encoded}`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || `Upload failed (${res.status})`);
  }
}

export function useFileImport() {
  const loadTree = useTreeStore((s) => s.loadTree);
  const expandPath = useTreeStore((s) => s.expandPath);
  const [importing, setImporting] = useState(false);

  const importFilesList = useCallback(
    async (targetVirtualPath: string, files: FileList | File[]) => {
      const list = Array.from(files);
      if (list.length === 0) return;
      setImporting(true);
      let error: unknown = null;
      try {
        for (const file of list) {
          await uploadOne(targetVirtualPath, file);
        }
      } catch (err) {
        error = err;
      }
      try {
        if (targetVirtualPath) expandPath(targetVirtualPath);
        await loadTree();
      } finally {
        setImporting(false);
      }
      if (error) {
        const msg = error instanceof Error ? error.message : String(error);
        alert(`Import failed: ${msg}`);
      }
    },
    [loadTree, expandPath]
  );

  const importFiles = useCallback(
    (targetVirtualPath: string) => {
      const input = document.createElement("input");
      input.type = "file";
      input.multiple = true;
      input.style.display = "none";
      input.addEventListener("change", () => {
        const files = input.files;
        if (files && files.length > 0) {
          void importFilesList(targetVirtualPath, files);
        }
        input.remove();
      });
      input.addEventListener("cancel", () => {
        input.remove();
      });
      document.body.appendChild(input);
      input.click();
    },
    [importFilesList]
  );

  return { importFiles, importFilesList, importing };
}
