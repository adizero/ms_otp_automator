#!/usr/bin/env python3
"""Native messaging host for MS OTP Automator Chrome extension."""

import base64
import hmac
import json
import os
import shlex
import shutil
import struct
import subprocess
import sys
import time

# Browsers may launch native messaging hosts with a stripped environment, so the
# inherited PATH may not contain the directory oathtool lives in (exit 127,
# "oathtool: command not found").  Append the standard locations to whatever
# PATH we are given.
DEFAULT_PATH_DIRS = [
    "/usr/local/bin",
    "/usr/bin",
    "/bin",
    "/usr/local/sbin",
    "/usr/sbin",
    "/sbin",
    os.path.expanduser("~/.local/bin"),
    os.path.expanduser("~/bin"),
]

SUPPORTED_ALGORITHMS = ("sha1", "sha256", "sha512")


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


def build_env():
    """Return a copy of the environment with standard bin dirs on PATH."""
    env = os.environ.copy()
    dirs = [d for d in env.get("PATH", "").split(os.pathsep) if d]
    for d in DEFAULT_PATH_DIRS:
        if d not in dirs:
            dirs.append(d)
    env["PATH"] = os.pathsep.join(dirs)
    return env


def command_program(command):
    """Return the program name a command invokes, or None if it is unclear."""
    try:
        argv = shlex.split(command)
    except ValueError:
        return None
    return argv[0] if argv else None


def parse_totp_command(command):
    """Parse an `oathtool --totp` command line into TOTP parameters.

    Returns a params dict, or None if the command is anything we do not fully
    understand.  Bailing out is deliberate: reporting the original error beats
    silently computing a code from a misread command line.
    """
    try:
        argv = shlex.split(command)
    except ValueError:
        return None
    if len(argv) < 2 or os.path.basename(argv[0]) != "oathtool":
        return None

    totp = False
    base32 = False
    algorithm = "sha1"
    digits = "6"
    period = "30"
    secret = None

    args = argv[1:]
    i = 0
    while i < len(args):
        arg = args[i]
        i += 1

        if arg.startswith("--"):
            name, sep, value = arg[2:].partition("=")
            if name == "totp":
                totp = True
                if sep:
                    algorithm = value.lower()
            elif name == "base32":
                base32 = True
            elif name in ("digits", "time-step-size"):
                if not sep:
                    if i >= len(args):
                        return None
                    value = args[i]
                    i += 1
                if name == "digits":
                    digits = value
                else:
                    period = value
            else:
                return None
        elif arg.startswith("-") and len(arg) > 1:
            flags = arg[1:]
            j = 0
            while j < len(flags):
                flag = flags[j]
                j += 1
                if flag == "b":
                    base32 = True
                elif flag in ("d", "s"):
                    value = flags[j:]
                    j = len(flags)
                    if not value:
                        if i >= len(args):
                            return None
                        value = args[i]
                        i += 1
                    if flag == "d":
                        digits = value
                    else:
                        period = value
                else:
                    return None
        else:
            if secret is not None:
                return None
            secret = arg

    if not totp or secret is None:
        return None

    try:
        digits = int(digits)
        # oathtool accepts durations such as "30s".
        period = int(str(period).rstrip("sS"))
    except ValueError:
        return None

    if algorithm not in SUPPORTED_ALGORITHMS or not 1 <= digits <= 10 or period <= 0:
        return None

    return {
        "secret": secret,
        "base32": base32,
        "digits": digits,
        "period": period,
        "algorithm": algorithm,
    }


def compute_totp(params, now=None):
    """Compute a TOTP code (RFC 6238) without shelling out to oathtool."""
    secret = params["secret"].replace(" ", "")
    if params["base32"]:
        padded = secret.upper() + "=" * (-len(secret) % 8)
        key = base64.b32decode(padded, casefold=True)
    else:
        key = bytes.fromhex(secret)

    counter = int((time.time() if now is None else now) // params["period"])
    digest = hmac.new(key, struct.pack(">Q", counter), params["algorithm"]).digest()
    offset = digest[-1] & 0x0F
    code = struct.unpack(">I", digest[offset:offset + 4])[0] & 0x7FFFFFFF
    return str(code % 10 ** params["digits"]).zfill(params["digits"])


def main():
    msg = read_message()
    if not msg:
        send_message({"error": "No message received"})
        return

    command = msg.get("command")
    if not command:
        send_message({"error": "No command provided"})
        return

    env = build_env()
    params = parse_totp_command(command)

    try:
        # The browser may be sandboxed (Conty, Flatpak, Snap) in a container
        # whose filesystem has no oathtool at all, in which case no PATH will
        # ever find it.  When the command is a plain `oathtool --totp` we can
        # compute the code ourselves instead of failing.
        program = command_program(command)
        if params and program and shutil.which(program, path=env["PATH"]) is None:
            send_message({
                "otp": compute_totp(params),
                "source": "builtin",
                "reason": f"{program} not found on PATH",
            })
            return

        result = subprocess.run(
            command,
            shell=True,
            capture_output=True,
            text=True,
            timeout=10,
            env=env,
        )

        if result.returncode != 0:
            if result.returncode == 127 and params:
                send_message({
                    "otp": compute_totp(params),
                    "source": "builtin",
                    "reason": f"{program} exited 127 (command not found)",
                })
                return
            stderr = result.stderr.strip()
            if result.returncode == 127:
                stderr += f"\nPATH used: {env['PATH']}"
            send_message({"error": f"Command failed (exit {result.returncode}): {stderr}"})
            return

        otp = result.stdout.strip()
        if not otp:
            send_message({"error": "Command produced no output"})
            return

        send_message({"otp": otp, "source": "command"})

    except FileNotFoundError:
        send_message({"error": "oathtool not found. Install it with: sudo apt install oathtool"})
    except subprocess.TimeoutExpired:
        send_message({"error": "Command timed out after 10 seconds"})
    except Exception as e:
        send_message({"error": str(e)})


if __name__ == "__main__":
    main()
