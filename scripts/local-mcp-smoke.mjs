#!/usr/bin/env node
// Standalone stdio protocol test; does not claim to be a ChatGPT-authored call.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const root = fileURLToPath(new URL('../', import.meta.url)).replace(/\/$/, '');
const options = process.argv.slice(2);
const value = (flag, fallback) => {
  const i = options.indexOf(flag);
  return i < 0 ? fallback : options[i + 1];
};
const workspace = value('--workspace', undefined);
assert(workspace, 'Pass --workspace with an idle stable workspace visible to the human.');
const socket = value('--socket', '/run/user/' + process.getuid() + '/chat-terminal-dock/tmux.sock');
const hermes = value('--hermes', undefined);
const quote = s => "'" + s.replace(/'/g, "'\\''") + "'";
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const report = { client: 'standalone-local-stdio-smoke', started: new Date().toISOString(), checks: [] };
const record = (name, data = {}) => {
  report.checks.push({ name, passed: true, ...data });
  console.log(JSON.stringify({ check: name, passed: true, ...data }));
};
const client = new Client({ name: 'desktop-commander-local-smoke', version: '1.0.0' });
const transport = new StdioClientTransport({ command: '/usr/bin/node', args: [root + '/dist/index.js'], stderr: 'pipe' });
let scratch;
let search;
const text = r => (r.content || []).filter(x => x.type === 'text').map(x => x.text).join('\n');
async function call(name, args = {}) {
  const r = await client.callTool({ name, arguments: args }, undefined, { timeout: 60000 });
  assert(!r.isError, name + ': ' + text(r));
  return text(r);
}
async function processCommand(command) {
  let output = await call('start_process', { command, timeout_ms: 1000 });
  const match = output.match(/PID\s+(\d+)/i);
  assert(match, 'No process PID: ' + output);
  for (let i = 0; i < 20 && !/finished|exit code|process exited/i.test(output); i++) {
    await pause(150);
    output += '\n' + await call('read_process_output', { pid: Number(match[1]), timeout_ms: 1000 });
  }
  assert(/finished|exit code|process exited/i.test(output), 'Process did not finish: ' + output);
  assert(!/exit code:?[ ]+[1-9]|Traceback \(most recent call last\)/i.test(output), output);
  return output;
}
try {
  await client.connect(transport, { timeout: 120000 });
  const { tools } = await client.listTools();
  assert.equal(tools.length, 26);
  report.desktopCommander = { command: '/usr/bin/node', args: [root + '/dist/index.js'], tools: tools.map(t => t.name) };
  record('desktop_commander_tools', { count: tools.length });
  await call('get_config');
  record('config_read');

  if (options.includes('--require-remote-stopped')) {
    const state = await processCommand("env XDG_RUNTIME_DIR=/run/user/" + process.getuid()
      + " DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/" + process.getuid() + "/bus python3 -c "
      + quote("import subprocess; enabled=subprocess.run(['systemctl','--user','is-enabled','desktop-commander-remote.service'],capture_output=True,text=True).stdout.strip(); active=subprocess.run(['systemctl','--user','is-active','desktop-commander-remote.service'],capture_output=True,text=True).stdout.strip(); assert enabled == 'disabled', enabled; assert active == 'inactive', active; print('REMOTE_DISABLED_INACTIVE')"));
    assert(state.includes('REMOTE_DISABLED_INACTIVE'));
    record('remote_disabled_inactive');
  }

  scratch = '/tmp/desktop-commander-local-smoke-' + randomUUID();
  const file = scratch + '/probe.txt';
  await call('create_directory', { path: scratch });
  await call('write_file', { path: file, content: 'LOCAL_MCP_ORIGINAL\n' });
  assert((await call('read_file', { path: file })).includes('LOCAL_MCP_ORIGINAL'));
  await call('edit_block', { file_path: file, old_string: 'LOCAL_MCP_ORIGINAL', new_string: 'LOCAL_MCP_EDITED', expected_replacements: 1 });
  assert((await call('read_file', { path: file })).includes('LOCAL_MCP_EDITED'));
  assert((await call('list_directory', { path: scratch, depth: 1 })).includes('probe.txt'));
  record('filesystem_create_read_edit_list');

  const searchStart = await call('start_search', { path: scratch, pattern: 'LOCAL_MCP_EDITED', searchType: 'content', literalSearch: true });
  const match = searchStart.match(/(?:session(?: ID)?[: ]+|ID: )([a-zA-Z0-9_-]+)/i);
  assert(match, searchStart);
  search = match[1];
  let found = '';
  for (let i = 0; i < 20 && !found.includes('LOCAL_MCP_EDITED'); i++) {
    await pause(150);
    found += await call('get_more_search_results', { sessionId: search });
  }
  assert(found.includes('LOCAL_MCP_EDITED'), found);
  await call('stop_search', { sessionId: search });
  search = undefined;
  record('content_search');

  const started = await call('start_process', {
    command: "python3 -c " + quote("import time; print('LOCAL_PROCESS_STARTED',flush=True); time.sleep(1.5); print('LOCAL_PROCESS_OUTPUT_OK',flush=True)"),
    timeout_ms: 100
  });
  const pid = Number(started.match(/PID\s+(\d+)/i)?.[1]);
  assert(Number.isFinite(pid), started);
  let output = started;
  for (let i = 0; i < 20 && !output.includes('LOCAL_PROCESS_OUTPUT_OK'); i++) {
    output += await call('read_process_output', { pid, timeout_ms: 1000 });
    await pause(100);
  }
  assert(output.includes('LOCAL_PROCESS_OUTPUT_OK'), output);
  record('process_execution_and_output');

  const wrapper = 'python3 ' + quote(root + '/scripts/tmux-workspace.py') + ' --socket ' + quote(socket);
  const discovered = await processCommand(wrapper + ' discover');
  assert(discovered.includes(workspace), discovered);
  const inspected = await processCommand(wrapper + ' capture ' + quote(workspace) + ' --lines 8');
  record('tmux_discover_capture', { workspace });
  const marker = 'LOCAL_TMUX_EXECUTED_' + randomUUID().replace(/-/g, '');
  // Fragment the marker so captured command echo alone cannot pass the check.
  const command = "printf '%s%s\\n' " + quote(marker.slice(0, 20)) + ' ' + quote(marker.slice(20));
  await processCommand(wrapper + ' send ' + quote(workspace) + ' ' + quote(command));
  let captured = '';
  for (let i = 0; i < 20 && !captured.includes(marker); i++) {
    await pause(100);
    captured = await processCommand(wrapper + ' capture ' + quote(workspace) + ' --lines 8');
  }
  assert(captured.includes(marker), captured);
  const last = captured.split('\n').map(x => x.trim()).filter(Boolean);
  assert(last.some(x => /[$#]$/.test(x)), 'No usable shell prompt after command.');
  record('tmux_send_and_capture', { workspace, marker });

  if (hermes) {
    const h = new Client({ name: 'hermes-local-smoke', version: '1.0.0' });
    const ht = new StdioClientTransport({ command: hermes, args: ['mcp', 'serve'], stderr: 'pipe' });
    try {
      await h.connect(ht, { timeout: 120000 });
      const { tools: htools } = await h.listTools();
      assert.equal(htools.length, 10);
      const permissions = await h.callTool({ name: 'permissions_list_open', arguments: {} });
      assert(!permissions.isError, text(permissions));
      report.hermes = { command: hermes, args: ['mcp', 'serve'], tools: htools.map(t => t.name) };
      record('hermes_tools_and_read_call', { count: htools.length });
    } finally { await h.close(); }
  }
} catch (error) {
  report.error = String(error);
  process.exitCode = 1;
} finally {
  try {
    if (search) await call('stop_search', { sessionId: search });
    if (scratch) {
      await processCommand('python3 -c ' + quote("from pathlib import Path; p=Path(" + JSON.stringify(scratch) + "); (p/'probe.txt').unlink(missing_ok=True); p.rmdir(); print('LOCAL_SCRATCH_REMOVED')"));
      record('tmp_cleanup');
    }
  } catch (e) { report.cleanupError = String(e); process.exitCode = 1; }
  await client.close();
}
report.passed = !report.error && !report.cleanupError;
report.finished = new Date().toISOString();
console.log(JSON.stringify(report));
