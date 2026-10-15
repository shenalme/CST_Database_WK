#!/usr/bin/env bash
# Loads every CSV in data/csv/ into the database, in file-name order (parents before children).
#
#   export DATABASE_URL='postgresql://postgres.<ref>:<PASSWORD>@<host>:5432/postgres'   # Supabase: Connect -> Session pooler
#   tools/load_csvs.sh              # add the rows (tables must be empty or the ids must not clash)
#   tools/load_csvs.sh --replace    # empty all data tables first (supabase/clear_sample_data.sql), then load
#   tools/load_csvs.sh --dry-run    # only print what would be done
#
# Needs psql (macOS: brew install libpq && brew link --force libpq). Runs as ONE transaction:
# if any file fails, nothing is loaded. Empty CSV cells become NULL.
set -euo pipefail
cd "$(dirname "$0")/.."
REPLACE=0; DRY=0
for a in "$@"; do case "$a" in --replace) REPLACE=1;; --dry-run) DRY=1;; *) echo "unknown option $a"; exit 2;; esac; done
: "${DATABASE_URL:?set DATABASE_URL first (see the comment at the top of this script)}"

sql=$(mktemp); trap 'rm -f "$sql"' EXIT
{
  echo "\\set ON_ERROR_STOP on"
  echo "begin;"
  [ "$REPLACE" = 1 ] && grep -v '^--' supabase/clear_sample_data.sql
  for f in data/csv/*.csv; do
    t=$(basename "$f" .csv); t=${t#[0-9][0-9]_}
    cols=$(head -1 "$f" | tr -d '\r')
    n=$(( $(wc -l < "$f") - 1 ))
    [ "$n" -gt 0 ] || continue
    echo "\\echo loading $t ($n rows)"
    echo "\\copy public.$t ($cols) from '$f' with (format csv, header true)"
  done
  echo "select public.reset_identity_sequences();"
  echo "commit;"
} > "$sql"

if [ "$DRY" = 1 ]; then cat "$sql"; exit 0; fi
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$sql"
echo "done."
