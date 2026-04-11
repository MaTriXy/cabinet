"use client";

import { useEffect, useState, useCallback } from "react";
import { ExternalLink, Download, WrapText, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HeaderActions } from "@/components/layout/header-actions";

interface SourceViewerProps {
  path: string;
  title: string;
}

const EXT_TO_LANG: Record<string, string> = {
  ".js": "javascript", ".cjs": "javascript", ".mjs": "javascript",
  ".ts": "typescript", ".tsx": "tsx", ".jsx": "jsx",
  ".py": "python", ".rb": "ruby", ".php": "php",
  ".sh": "bash", ".bash": "bash", ".zsh": "bash", ".ps1": "powershell",
  ".css": "css", ".scss": "scss", ".html": "html",
  ".json": "json", ".jsonc": "json",
  ".yaml": "yaml", ".yml": "yaml", ".toml": "toml", ".ini": "ini",
  ".xml": "xml", ".sql": "sql", ".graphql": "graphql", ".gql": "graphql",
  ".go": "go", ".rs": "rust", ".swift": "swift",
  ".java": "java", ".kt": "kotlin", ".kts": "kotlin",
  ".c": "c", ".cpp": "cpp", ".h": "c",
  ".prisma": "prisma", ".env": "bash",
  ".txt": "plaintext", ".text": "plaintext", ".log": "plaintext",
  ".mdx": "markdown", ".rst": "plaintext",
};

function detectLanguage(filename: string): string {
  const ext = filename.includes(".") ? "." + filename.split(".").pop()!.toLowerCase() : "";
  return EXT_TO_LANG[ext] || "plaintext";
}

function formatBadge(filename: string): string {
  const ext = filename.includes(".") ? filename.split(".").pop()!.toUpperCase() : "TEXT";
  return ext;
}

export function SourceViewer({ path, title }: SourceViewerProps) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [wrap, setWrap] = useState(false);
  const [copied, setCopied] = useState(false);

  const assetUrl = `/api/assets/${path}`;
  const filename = path.split("/").pop() || path;
  const language = detectLanguage(filename);

  const fetchContent = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(assetUrl);
      if (res.ok) {
        const text = await res.text();
        setContent(text);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [assetUrl]);

  useEffect(() => {
    void fetchContent();
  }, [fetchContent]);

  const copyToClipboard = () => {
    if (!content) return;
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const lines = content?.split("\n") || [];

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div
        className="flex items-center justify-between border-b border-border px-4 py-2 bg-background/80 backdrop-blur-sm transition-[padding] duration-200"
        style={{ paddingLeft: `calc(1rem + var(--sidebar-toggle-offset, 0px))` }}
      >
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-medium">{title}</span>
          <span className="text-xs text-muted-foreground/50 bg-muted px-1.5 py-0.5 rounded">
            {formatBadge(filename)}
          </span>
          <span className="text-xs text-muted-foreground/40">
            {language}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className={`h-7 gap-1.5 text-xs ${wrap ? "bg-muted" : ""}`}
            onClick={() => setWrap((v) => !v)}
            title={wrap ? "Disable line wrap" : "Enable line wrap"}
          >
            <WrapText className="h-3.5 w-3.5" />
            Wrap
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 text-xs"
            onClick={copyToClipboard}
            title="Copy file contents"
          >
            {copied
              ? <Check className="h-3.5 w-3.5 text-green-500" />
              : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied" : "Copy"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 text-xs"
            onClick={() => {
              const a = document.createElement("a");
              a.href = assetUrl;
              a.download = filename;
              a.click();
            }}
            title="Download file"
          >
            <Download className="h-3.5 w-3.5" />
            Download
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 text-xs"
            onClick={() => window.open(assetUrl, "_blank")}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Raw
          </Button>
          <HeaderActions />
        </div>
      </div>
      <div className="flex-1 overflow-auto bg-[#1e1e1e]">
        {loading ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            Loading...
          </div>
        ) : (
          <pre className={`p-4 text-[13px] leading-relaxed font-mono ${wrap ? "whitespace-pre-wrap break-all" : ""}`}>
            <code>
              {lines.map((line, i) => (
                <div key={i} className="flex">
                  <span className="inline-block w-12 pr-4 text-right text-[#858585] select-none shrink-0">
                    {i + 1}
                  </span>
                  <span className="text-[#d4d4d4] flex-1">{line || "\n"}</span>
                </div>
              ))}
            </code>
          </pre>
        )}
      </div>
    </div>
  );
}
