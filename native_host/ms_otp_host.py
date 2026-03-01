#!/usr/bin/env python3
"""Native messaging host for MS OTP Automator Chrome extension."""

import json
import struct
import subprocess
import sys


def read_message():
    """Read a message from stdin using Chrome's native messaging protocol."""
    raw_length = sys.stdin.buffer.read(4)
    if not raw_length:
        return None
    length = struct.unpack("@I", raw_length)[0]
    data = sys.stdin.buffer.read(length)
    return json.loads(data.decode("utf-8"))


def send_message(msg):
    """Send a message to stdout using Chrome's native messaging protocol."""
    encoded = json.dumps(msg).encode("utf-8")
    sys.stdout.buffer.write(struct.pack("@I", len(encoded)))
    sys.stdout.buffer.write(encoded)
    sys.stdout.buffer.flush()


def main():
    msg = read_message()
    if not msg:
        send_message({"error": "No message received"})
        return

    command = msg.get("command")
    if not command:
        send_message({"error": "No command provided"})
        return

    try:
        result = subprocess.run(
            command,
            shell=True,
            capture_output=True,
            text=True,
            timeout=10,
        )

        if result.returncode != 0:
            stderr = result.stderr.strip()
            send_message({"error": f"Command failed (exit {result.returncode}): {stderr}"})
            return

        otp = result.stdout.strip()
        if not otp:
            send_message({"error": "Command produced no output"})
            return

        send_message({"otp": otp})

    except FileNotFoundError:
        send_message({"error": "oathtool not found. Install it with: sudo apt install oathtool"})
    except subprocess.TimeoutExpired:
        send_message({"error": "Command timed out after 10 seconds"})
    except Exception as e:
        send_message({"error": str(e)})


if __name__ == "__main__":
    main()
