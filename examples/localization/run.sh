#!/usr/bin/env bash
# Run from any working directory; optionally load the user's local toolchain paths.
set -euo pipefail
examples_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
config_file="${FIELD2SIM_CONFIG:-$examples_dir/toolchains.env}"
if [[ -f "$config_file" ]]; then
    source "$config_file"
elif [[ -n "${FIELD2SIM_CONFIG:-}" ]]; then
    printf 'Configuration file not found: %s\n' "$config_file" >&2
    exit 2
fi
if ! command -v python3 >/dev/null 2>&1; then
    printf 'Python 3 is required. Install python3 and try again.\n' >&2
    exit 2
fi
exec python3 "$examples_dir/localization/run.py" "$@"
