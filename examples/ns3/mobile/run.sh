#!/usr/bin/env bash
set -euo pipefail
scenario_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
exec bash "$scenario_dir/../../run.sh" ns3 mobile "$@"
