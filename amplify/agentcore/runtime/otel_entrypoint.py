"""AgentCore runtime OTEL entrypoint.

Runs the runtime app through OpenTelemetry auto-instrumentation.
"""

from __future__ import annotations

import os
import sys


def main() -> None:
    command = ["opentelemetry-instrument", "python", "main.py"]
    os.execvp(command[0], command)


if __name__ == "__main__":
    try:
        main()
    except FileNotFoundError:
        print(
            "opentelemetry-instrument command was not found. "
            "Ensure aws-opentelemetry-distro is packaged in the runtime artifact.",
            file=sys.stderr,
        )
        raise
