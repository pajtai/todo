#!/bin/sh
# Runs every self-checking SQL test against the linked project. Each test rolls
# itself back. `supabase test db` isn't used because it needs local Docker.
status=0
for file in supabase/tests/*.test.sql; do
  if output=$(npx supabase db query --linked -f "$file" </dev/null 2>&1); then
    echo "ok   $file"
  else
    echo "FAIL $file"
    echo "$output"
    status=1
  fi
done
exit $status
