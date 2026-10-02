# Bounded dependency remediation

The pinned v0.2.52 deployment has 61 audit findings, including 3 critical transitive packages. This issue is bounded dependency hardening after local MCP cutover.

Evidence: docs/LOCAL_DEPENDENCY_AUDIT.md and docs/evidence/local-mcp-*-audit-20261002.json on nexus/local-mcp-integration-plan. npm audit --omit=dev distinguishes the runtime graph; npm explain chains are retained.

Scope: prioritize the direct runtime MCP SDK and runtime critical chains; review advisory applicability; update compatible versions in isolated groups; independently handle build-only packages and optional PDF/browser/image paths. Preserve upstream tool behavior and the 26-tool baseline unless a separately reviewed change admits a surface update. Do not run npm audit fix --force.

Acceptance: publish before/after raw audits; explain remaining findings; pass build, stdio handshake/tools, file/process/search/tmux smoke and affected format tests. Gemini OAuth and provider routing are outside scope.

Repository issues are disabled; this existing-fork work package is the durable follow-up. No dependency changes are admitted by the MCP cutover itself.
