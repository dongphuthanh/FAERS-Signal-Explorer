#!/bin/bash
# Runs ON the restore box (sent with SSM Run Command; see infra/README.md).
# Pulls the dump from S3 and restores it into RDS.
#
#   restore.sh <bucket> <db-secret-arn> <region>
set -uo pipefail
BUCKET=$1 SECRET=$2 REGION=$3

aws s3 cp "s3://$BUCKET/dumps/faers.dump" /tmp/faers.dump --region "$REGION" || exit 1

S=$(aws secretsmanager get-secret-value --secret-id "$SECRET" --region "$REGION" --query SecretString --output text) || exit 1
export PGHOST=$(jq -r .host <<<"$S") PGPORT=$(jq -r .port <<<"$S") PGUSER=$(jq -r .username <<<"$S") \
       PGPASSWORD=$(jq -r .password <<<"$S") PGDATABASE=$(jq -r .dbname <<<"$S") PGSSLMODE=require

# --no-owner: local objects belong to the docker postgres user; here everything
# belongs to the RDS master user. Ownership warnings are expected and harmless.
pg_restore --no-owner --no-privileges --jobs 2 --dbname "$PGDATABASE" /tmp/faers.dump
echo "pg_restore exit: $?"

# pg_restore refreshes materialized views with an empty search_path, so a view
# whose query names a table unqualified (lexeme_df reads "chunks") fails and is
# left unpopulated. Refresh those again with the normal search_path.
for v in $(psql -Atc "select schemaname || '.' || matviewname from pg_matviews where not ispopulated"); do
  psql -c "refresh materialized view $v"
done

psql -c 'analyze'
psql -Atc "select 'database ' || pg_size_pretty(pg_database_size(current_database())), (select 'cases ' || count(*) from cases), (select 'chunks ' || count(*) from chunks), (select 'vector ' || extversion from pg_extension where extname = 'vector')"
rm -f /tmp/faers.dump
