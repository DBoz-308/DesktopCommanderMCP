#!/usr/bin/env python3
"""Address stable tmux workspaces without depending on client-session names."""
import argparse
import json
import os
import re
import subprocess


def tmux(socket, *args):
    return subprocess.run(
        ["tmux", "-S", socket, *args],
        check=True, capture_output=True, text=True, timeout=10
    ).stdout


def panes(socket, workspace=None):
    args = ["list-panes", "-a"] if workspace is None else ["list-panes", "-t", "=" + workspace]
    fields = "#{session_name}\t#{pane_id}\t#{pane_active}\t#{pane_current_command}\t#{pane_current_path}\t#{pane_tty}"
    rows = []
    for line in tmux(socket, *args, "-F", fields).splitlines():
        name, pane, active, command, path, tty = line.split("\t", 5)
        if name.startswith("workspace-"):
            rows.append(dict(workspace=name, pane=pane, active=active == "1",
                             command=command, path=path, tty=tty))
    return rows


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    runtime = os.environ.get("XDG_RUNTIME_DIR", "/run/user/" + str(os.getuid()))
    parser.add_argument("--socket", default=runtime + "/chat-terminal-dock/tmux.sock")
    sub = parser.add_subparsers(dest="operation", required=True)
    sub.add_parser("discover")
    capture = sub.add_parser("capture")
    capture.add_argument("workspace")
    capture.add_argument("--lines", type=int, default=40)
    send = sub.add_parser("send")
    send.add_argument("workspace")
    send.add_argument("command")
    args = parser.parse_args()
    if args.operation == "discover":
        print(json.dumps(panes(args.socket)))
        return
    if not re.fullmatch(r"workspace-[A-Za-z0-9_-]+", args.workspace):
        parser.error("Use a stable workspace-* identity.")
    candidates = panes(args.socket, args.workspace)
    active = [p for p in candidates if p["active"]]
    if len(active) != 1:
        parser.error("Workspace must have exactly one active pane.")
    pane = active[0]
    if args.operation == "capture":
        if not 1 <= args.lines <= 10000:
            parser.error("--lines must be between 1 and 10000.")
        print(tmux(args.socket, "capture-pane", "-p", "-J", "-t", pane["pane"],
                   "-S", "-" + str(args.lines)), end="")
        return
    # Never interrupt a TUI or enqueue commands into a busy foreground process.
    if pane["command"] not in {"bash", "zsh", "fish", "sh", "dash"}:
        parser.error("Pane is busy; inspect it and interact explicitly with tmux.")
    text = tmux(args.socket, "capture-pane", "-p", "-J", "-t", pane["pane"])
    lines = [line.rstrip() for line in text.splitlines() if line.strip()]
    if not lines or not re.search(r"[$#]$", lines[-1]):
        parser.error("No empty shell prompt observed; refusing to overwrite input.")
    if any(c in args.command for c in ("\n", "\r", "\x00", "\x1b")):
        parser.error("Supply one command line without terminal control characters.")
    tmux(args.socket, "send-keys", "-t", pane["pane"], "-l", "--", args.command)
    tmux(args.socket, "send-keys", "-t", pane["pane"], "Enter")
    print(json.dumps(dict(sent=True, workspace=args.workspace, pane=pane["pane"])))


if __name__ == "__main__":
    main()
