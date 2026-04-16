import json
import os
import subprocess
import sys
import time


def send(proc, payload):
    proc.stdin.write((json.dumps(payload, ensure_ascii=False) + "\n").encode())
    proc.stdin.flush()


def read_response(proc, expected_id, timeout=20):
    start = time.time()
    while time.time() - start < timeout:
        line = proc.stdout.readline()
        if not line:
            continue
        text = line.decode(errors="ignore").strip()
        if not text:
            continue
        try:
            data = json.loads(text)
        except Exception:
            continue
        if data.get("id") == expected_id:
            return data
    raise TimeoutError(f"等待响应超时: {expected_id}")


def main():
    env = os.environ.copy()
    proc = subprocess.Popen(
        [os.path.expanduser("~/.local/bin/onchainos"), "mcp"],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        env=env,
    )

    try:
        init_id = 1
        send(
            proc,
            {
                "jsonrpc": "2.0",
                "id": init_id,
                "method": "initialize",
                "params": {
                    "protocolVersion": "2024-11-05",
                    "capabilities": {},
                    "clientInfo": {"name": "hwallet-debug", "version": "1.0.0"},
                },
            },
        )
        init_res = read_response(proc, init_id)
        print(json.dumps(init_res, ensure_ascii=False))

        send(proc, {"jsonrpc": "2.0", "method": "notifications/initialized"})

        list_id = 2
        send(proc, {"jsonrpc": "2.0", "id": list_id, "method": "tools/list", "params": {}})
        list_res = read_response(proc, list_id)
        print(json.dumps(list_res, ensure_ascii=False))
    finally:
        proc.kill()


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        sys.exit(1)
