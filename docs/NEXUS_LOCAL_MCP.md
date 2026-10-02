# Nexus Local MCP Integration

Status: generic local deployment and protocol smoke implemented; Desktop client recovery pending
Scope: local developer machine integration around Desktop Commander MCP

## Purpose

This fork is the generic local-machine MCP substrate used by the Nexus development environment.

It is not the Nexus control plane and should not acquire Nexus, Steward, VoxForge, SignalForge, or project-specific semantics.

The intended split is:

```text
ChatGPT Desktop / Antigravity / other MCP clients
                  |
                  +---- Desktop Commander MCP
                  |       generic filesystem
                  |       terminal/process
                  |       search/edit
                  |       host-local capabilities
                  |
                  +---- Hermes MCP
                  |       conversations/messages/events
                  |       approvals
                  |       agent/provider bridge
                  |
                  +---- future Nexus MCP
                          admitted Nexus-domain operations
                          project/repository/graph state
                          provider orchestration
                          bounded work dispatch
```

Desktop Commander answers: "perform this generic operation on this machine."

Nexus should answer: "perform this admitted domain operation using the correct providers and policy."

## Canonical repository model

GitHub is canonical.

- canonical fork: `DBoz-308/DesktopCommanderMCP`
- `origin`: the DBoz-308 GitHub fork
- `upstream`: `wonderwhy-er/DesktopCommanderMCP`
- local checkouts are execution workspaces, not authorities
- changes intended for our deployment should be branches/PRs in the fork
- upstream changes should be fetched and intentionally reconciled

The uploaded `DesktopCommanderMCP-main-novid.zip` used to bootstrap this work was verified byte-for-byte against the fork's v0.2.52 source baseline for `src/`, `package.json`, and `package-lock.json`.

## Current laptop deployment

Primary checkout:

```text
/home/dan/code/tools/desktop-commander-mcp
```

ChatGPT Desktop MCP:

```toml
[mcp_servers.desktop_commander]
command = "/usr/bin/node"
args = ["/home/dan/code/tools/desktop-commander-mcp/dist/index.js"]
startup_timeout_sec = 120
```

The build was protocol-tested and exposes the same 26-tool surface as upstream v0.2.52.

The separately authenticated Desktop Commander remote-device service remains a published-version fallback until fork changes require remote-device testing.

## Internal type model

MCP uses JSON-RPC on the wire. That does not require the implementation to be organized as untyped JSON objects.

Use normal TypeScript types/classes/interfaces internally and generate or adapt MCP schemas at the boundary.

A useful conceptual hierarchy is:

```text
Capability
├── HostCapability
│   ├── FileCapability
│   ├── ProcessCapability
│   ├── SearchCapability
│   └── TerminalCapability
├── AgentCapability
│   ├── ConversationCapability
│   ├── ModelCallCapability
│   └── DelegationCapability
└── DomainCapability
    └── supplied by higher-level providers such as Nexus
```

Providers implement capabilities:

```text
Provider<TCapability>
├── DesktopCommanderProvider
├── HermesProvider
├── CodexProvider
├── GeminiProvider
├── VllmProvider
└── NexusProvider
```

The exact implementation does not need to use these names, but the important properties are:

- interfaces are typed;
- providers are replaceable;
- tool schemas are derived at the MCP boundary;
- transport is separate from capability semantics;
- one provider may implement several capabilities;
- one capability may have several providers;
- selection/routing policy belongs above the provider implementation.

Do not invent a second markup language merely to avoid JSON. JSON-RPC is transport syntax. Rich internal entities, inheritance/composition, validation, defaults, and schema generation should live in TypeScript/Python code or a typed IR.

## Model and agent calls

Model calls should not be hard-coded into Desktop Commander.

Preferred path:

```text
MCP client
   |
   v
Nexus/Hermes provider layer
   |
   +--> local vLLM/OpenAI-compatible endpoint
   +--> Ollama
   +--> Hermes agent
   +--> Codex
   +--> Gemini/Google provider
   +--> future providers
```

Desktop Commander may provide the generic process/filesystem operations required to run those providers, but it should not own model-selection policy.

Hermes already provides:

- MCP client support;
- `hermes mcp serve`;
- model/provider abstractions;
- delegation;
- Codex integration;
- Gemini provider support;
- local/OpenAI-compatible provider support.

Reuse those boundaries before creating another agent gateway.

## Terminal Dock / tmux

Chat Terminal Dock is a human-visible execution surface, not an MCP protocol replacement.

Current local tmux server:

```text
/run/user/1000/chat-terminal-dock/tmux.sock
```

An agent may:

1. locate the intended workspace/session;
2. inspect the active pane;
3. send commands through tmux;
4. capture output;
5. leave the same terminal visible and interactive for the human.

This is useful for interactive OAuth, TUIs, debuggers, long-running commands, and handoff between human and agent.

Prefer a stable workspace identity over transient dock-client session names.

Future tooling should expose tmux/workspace operations as typed generic capabilities rather than embedding Terminal Dock-specific shell snippets throughout higher layers.

## Nexus relationship

Nexus should consume generic execution providers rather than becoming coupled to Desktop Commander.

Possible future Nexus tool families:

```text
nexus.repository.*
nexus.project.*
nexus.graph.*
nexus.provider.*
nexus.work.*
nexus.evidence.*
```

Those tools should be implemented in a Nexus-owned MCP/provider package and may call Desktop Commander underneath when host execution is required.

Do not put these tools directly into Desktop Commander.

## Steward relationship

Steward remains the human-facing governance/work-coordination method.

Steward may select and dispatch work that uses MCP providers, but Steward is not an MCP transport layer and should not be installed inside Desktop Commander.

## Initial extension sequence

1. Keep upstream Desktop Commander tool behaviour unchanged.
2. Add tests around any local extension point before adding new tools.
3. Introduce a small typed provider/capability registry only when the first real non-upstream tool requires it.
4. Use Terminal Dock/tmux as a generic interactive-terminal provider.
5. Use Hermes for agent/model-provider integration before implementing duplicate machinery.
6. Add a Nexus-owned MCP surface only from admitted Nexus requirements.
7. Preserve published Desktop Commander remote mode as fallback while local fork changes are proven.
8. Keep GitHub PRs as the canonical review and integration path.

## Non-goals

This fork should not become:

- a second Nexus;
- a second Steward runtime;
- an autonomous scheduler;
- a project-state database;
- a model router;
- a CI system;
- a repository graph database.

Those concerns belong to their existing systems.

## Local cutover operations

Use [LOCAL_STDIO_OPERATIONS.md](LOCAL_STDIO_OPERATIONS.md) for persistent build, stable tmux helpers, standalone MCP smoke, and preserved cloud recovery. [LOCAL_DEPENDENCY_AUDIT.md](LOCAL_DEPENDENCY_AUDIT.md) and docs/evidence preserve the dependency follow-up. End-to-end Desktop client acceptance must be evidenced separately from standalone stdio tests.
