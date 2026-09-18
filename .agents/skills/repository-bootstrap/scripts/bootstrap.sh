#!/usr/bin/env bash
set -euo pipefail

if (( $# < 3 )); then
  echo "usage: bootstrap.sh SOURCE TARGET PROFILE [PROFILE ...]" >&2
  exit 2
fi

source_root=$1
target_root=$2
shift 2
manifest="$source_root/managed-files.txt"

test -f "$manifest"
test -d "$target_root"
git -C "$target_root" rev-parse --is-inside-work-tree >/dev/null

paths=()
while IFS= read -r path; do
  [[ -z "$path" || "$path" == "#"* ]] && continue
  paths+=("$path")
done < "$manifest"

support_paths=(
  ".agents/skills/github-work-management/scripts/audit-labels.sh"
  ".agents/skills/governance-sync/scripts/sync.sh"
  ".agents/skills/repository-bootstrap/scripts/bootstrap.sh"
)
for support_path in "${support_paths[@]}"; do
  test -f "$source_root/$support_path"
  listed=0
  for path in "${paths[@]}"; do
    if [[ "$path" == "$support_path" ]]; then
      listed=1
      break
    fi
  done
  (( listed )) || paths+=("$support_path")
done

paths+=("docs/governance/repository.md")

for profile in "$@"; do
  test -f "$source_root/seeds/profiles/$profile.md"
  paths+=("docs/governance/profiles/$profile.md")
done

for path in "${paths[@]}"; do
  if [[ -e "$target_root/$path" ]]; then
    echo "conflict: $path" >&2
    exit 1
  fi
done

for path in "${paths[@]}"; do
  mkdir -p "$(dirname "$target_root/$path")"
  case "$path" in
    docs/governance/repository.md)
      cp "$source_root/seeds/repository/repository.md" "$target_root/$path"
      ;;
    docs/governance/profiles/*.md)
      profile_name=${path##*/}
      cp "$source_root/seeds/profiles/$profile_name" "$target_root/$path"
      ;;
    *) cp "$source_root/$path" "$target_root/$path" ;;
  esac
done

printf 'initialized %s governance files\n' "${#paths[@]}"
