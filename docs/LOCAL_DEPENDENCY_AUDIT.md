# Local dependency audit — 2026-10-02

Captured with npm audit --json and npm audit --omit=dev --json. Neither command modified dependencies. npm returned 1 because advisories are present. No audit fix command was run.

Full installation: {"info": 0, "low": 5, "moderate": 20, "high": 33, "critical": 3, "total": 61}.

Runtime dependency graph: {"info": 0, "low": 0, "moderate": 12, "high": 24, "critical": 2, "total": 38}.

| Direct package | Highest severity | Dependency class | In runtime audit |
|---|---|---|---|
| @anthropic-ai/mcpb | low | development direct | no |
| @modelcontextprotocol/sdk | high | runtime direct | yes |
| @opendocsg/pdf2md | high | runtime direct | yes |
| @tiptap/core | high | runtime direct | yes |
| @tiptap/extension-table | moderate | runtime direct | yes |
| @tiptap/extension-table-cell | moderate | runtime direct | yes |
| @tiptap/extension-table-header | moderate | runtime direct | yes |
| @tiptap/extension-table-row | moderate | runtime direct | yes |
| exceljs | moderate | runtime direct | yes |
| file-type | moderate | runtime direct | yes |
| jsdom | high | development direct | no |
| markdown-it | moderate | runtime direct | yes |
| nexe | moderate | development direct | no |
| sharp | high | runtime direct | yes |

The critical packages are transitive: basic-ftp, decompress, tar. Exact npm explain chains are preserved alongside both raw audit reports in docs/evidence/. Runtime audit inclusion means reachable in the installed production dependency graph; it does not demonstrate exploitability in the local stdio path.

The MCP SDK is a direct runtime dependency used during server startup. PDF/browser and image/document dependencies serve optional tool paths. Build/packaging dependencies require separate classification from stdio exposure. System ripgrep fallback does not by itself remove vulnerable packages from the lockfile.

Follow-up must review each advisory and runtime chain, prioritize SDK and runtime critical packages, apply bounded compatible updates, and test handshake/tool schemas, file/process/search/tmux behavior and affected optional formats. Do not accept forced major downgrades proposed by npm audit as an automatic fix.

Tracked follow-up: https://github.com/DBoz-308/DesktopCommanderMCP/blob/nexus/local-mcp-integration-plan/docs/work-packages/dependency-audit-20261002.md
