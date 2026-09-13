#!/usr/bin/env bash
set -euo pipefail
HERE="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
CONFIG="${FIELD2SIM_CONFIG:-$HERE/../../toolchains.env}"
if [[ -f "$CONFIG" ]]; then set -a; source "$CONFIG"; set +a; fi
: "${NS3_ROOT:?Set NS3_ROOT to your ns-3.47 checkout (see README.md)}"
python3 "$HERE/speed-sweep.py" "$@"
