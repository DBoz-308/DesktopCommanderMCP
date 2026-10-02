# Local stdio deployment and visible terminal

This workflow keeps Desktop Commander generic and preserves its upstream 26-tool surface. Agent, provider, project, and graph operations remain outside this server.

The configured client launches the persisted deployment directly:

```toml
[mcp_servers.desktop_commander]
command = "/usr/bin/node"
args = ["/home/dan/code/tools/desktop-commander-mcp/dist/index.js"]
startup_timeout_sec = 120
```

Build once after an intentional source/dependency update:

```bash
cd /home/dan/code/tools/desktop-commander-mcp
bash scripts/deploy-local-mcp.sh --install
```

Dependencies and generated `dist/` stay on disk across client restart and reboot. Startup does not download, install, or compile anything. `dist/` is deployment output, never canonical source. The ignored `dist/.local-build.json` records the source digest and build identity. Do not clean the active deployment without rebuilding it.

On this machine, `npm ci --ignore-scripts` avoids the known ripgrep download failure. The existing server falls back to system `rg`; the deployment script requires it. Dependency lifecycle scripts are not needed for the validated file/process/search smoke test. Other optional formats need their own acceptance when used.

Prefer the existing Chat Terminal Dock tmux socket:

```bash
python3 scripts/tmux-workspace.py discover
python3 scripts/tmux-workspace.py capture workspace-tools-2 --lines 40
python3 scripts/tmux-workspace.py send workspace-tools-2 "printf 'LOCAL_VISIBLE_TERMINAL_OK\\n'"
```

Run these commands with Desktop Commander's `start_process`. Use stable `workspace-*` identities. Discovery does not return ephemeral client session identities. Capture is safe for busy panes; send refuses a busy foreground process or nonempty shell input. For an interactive TUI, inspect and deliberately use tmux keystrokes instead of sending a new shell command.

The helper is a convenience guard, not a lock: a human can start typing between inspection and send. Coordinate ownership of the pane during command submission.

Run a real local stdio MCP test from a different pane than its target:

```bash
node scripts/local-mcp-smoke.mjs --workspace workspace-nexus --hermes /home/dan/.local/bin/hermes
```

It checks config, 26 tools, create/read/edit/list/delete in a unique `/tmp` directory, streamed process output, content search, stable workspace discovery, pane capture, and command execution in the same human-visible pane. The marker is split in the sent command so echoed input cannot masquerade as executed output. Hermes initialization, 10 tools, and a read-only permission query are checked separately.

The standalone client is independent local MCP proof. It does **not** establish that a particular ChatGPT conversation exposes local tools. For client acceptance, verify the actual ChatGPT app-server children and make local tool calls from the intended local conversation; a cloud Work Mode conversation can expose only cloud connectors even with correct laptop config.

After independent local stdio acceptance, disable the registered cloud device service. Keep any remaining Desktop-conversation acceptance gap explicit:

```bash
systemctl --user disable --now desktop-commander-remote.service
node scripts/local-mcp-smoke.mjs --workspace workspace-nexus --hermes /home/dan/.local/bin/hermes --require-remote-stopped
```

Recovery (credentials and device registration remain installed):

```bash
systemctl --user enable --now desktop-commander-remote.service
```

A successful final test must run locally while the service reports `disabled` and `inactive`. Do not reconnect the cloud service just to collect final proof. Store the evidence on GitHub through the local GitHub client if the controlling conversation cannot access the laptop after cutover.
