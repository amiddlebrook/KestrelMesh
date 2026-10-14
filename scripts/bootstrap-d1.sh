#!/usr/bin/env bash
set -euo pipefail
DB_NAME="portfolio-kestrelmesh-db"
# GitHub-hosted Ubuntu includes jq. Wrangler authenticates through workflow secrets.
listing="$(npx wrangler d1 list --json)"
uuid="$(printf '%s' "$listing" | jq -r --arg name "$DB_NAME" '[.[] | select(.name == $name) | (.uuid // .id)] | first // empty')"
if [[ -z "$uuid" ]]; then
  echo "Provisioning free-tier D1 database $DB_NAME"
  npx wrangler d1 create "$DB_NAME"
  listing="$(npx wrangler d1 list --json)"
  uuid="$(printf '%s' "$listing" | jq -r --arg name "$DB_NAME" '[.[] | select(.name == $name) | (.uuid // .id)] | first // empty')"
fi
if [[ ! "$uuid" =~ ^[0-9a-fA-F-]{36}$ ]]; then
  echo "Could not resolve D1 database UUID" >&2; exit 1
fi
node -e 'const fs=require("fs");const path="wrangler.jsonc";const cfg=JSON.parse(fs.readFileSync(path,"utf8"));cfg.d1_databases[0].database_id=process.argv[1];fs.writeFileSync(path,JSON.stringify(cfg,null,2)+"\n")' "$uuid"
echo "D1 binding resolved; applying database migrations"
npx wrangler d1 migrations apply DB --remote
