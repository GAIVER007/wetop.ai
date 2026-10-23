#!/bin/bash
# Запуск: bash scripts/ops/check-voice-schema.sh packages/database/prisma/migrations/20261022000145_voice_calls
# Нужен локальный Postgres 16 на 127.0.0.1:54329 (одноразовый кластер, не dev-база проекта). Роли создаются в кластере.
# Проверка миграции 145 на одноразовом кластере Postgres 16 со стабами родительских таблиц.
export LC_ALL=en_US.UTF-8
BIN=/opt/homebrew/opt/postgresql@16/bin
M=$1
base() { "$BIN/psql" -h 127.0.0.1 -p 54329 -U postgres -v ON_ERROR_STOP=1 -q -tA "$@"; }
P() { base -d vt "$@"; }
A=a0000000-0000-4000-8000-000000000001; B=b0000000-0000-4000-8000-000000000002
AB=a1000000-0000-4000-8000-000000000001; BB=b1000000-0000-4000-8000-000000000002
AG=a3000000-0000-4000-8000-000000000001; BG=b3000000-0000-4000-8000-000000000002
fails=0
refuse() { desc="$1"; shift; if out=$("$@" 2>&1); then echo "FAIL (разрешено, а не должно): $desc"; fails=$((fails+1)); else echo "ok  отказ: $desc  [$(echo "$out" | head -1 | cut -c1-90)]"; fi; }
allow() { desc="$1"; shift; if out=$("$@" 2>&1); then echo "ok  разрешено: $desc"; else echo "FAIL (отказ): $desc :: $out"; fails=$((fails+1)); fi; }
count() { P -c "SET ROLE wetop_app" -c "SET app.org_id='$1'" -c "$2" | tail -1; }

base -c "DROP DATABASE IF EXISTS vt" -c "CREATE DATABASE vt"
base -c "SELECT 1 FROM pg_roles WHERE rolname='wetop_app'" | grep -q 1 || base -c "CREATE ROLE wetop_app NOLOGIN" -c "CREATE ROLE wetop_service NOLOGIN BYPASSRLS"
P <<EOF
CREATE FUNCTION app_current_org() RETURNS uuid LANGUAGE sql STABLE AS \$\$ SELECT nullif(current_setting('app.org_id', true), '')::uuid \$\$;
CREATE TABLE organizations (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
CREATE TABLE businesses (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id));
CREATE TABLE locations (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), business_id uuid NOT NULL REFERENCES businesses(id));
CREATE TABLE seller_agents (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id));
CREATE TABLE users (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
GRANT USAGE ON SCHEMA public TO wetop_app, wetop_service;
GRANT SELECT ON organizations, businesses, locations, seller_agents, users TO wetop_app, wetop_service;
INSERT INTO organizations(id) VALUES ('$A'),('$B');
INSERT INTO businesses(id, organization_id) VALUES ('$AB','$A'),('$BB','$B');
INSERT INTO locations(id,business_id) VALUES ('a2000000-0000-4000-8000-000000000001','$AB'),('b2000000-0000-4000-8000-000000000002','$BB');
INSERT INTO seller_agents(id,organization_id) VALUES ('$AG','$A'),('$BG','$B');
EOF
echo "=== накат"; P -f "$M/migration.sql" && echo "up-ok"
P -c "select relname||' rls='||relrowsecurity||' force='||relforcerowsecurity from pg_class where relname in ('voice_calls','voice_callbacks','voice_profiles') order by 1"
P <<EOF
INSERT INTO voice_calls(organization_id,business_id,location_id,agent_id,external_call_id,state,received_at,caller_masked)
 VALUES ('$A','$AB','a2000000-0000-4000-8000-000000000001','$AG','room-1','RECEIVED','2026-10-22T10:00:00Z','***2233');
INSERT INTO voice_calls(organization_id,business_id,agent_id,external_call_id,state,received_at)
 VALUES ('$B','$BB','$BG','room-b','RECEIVED','2026-10-22T10:00:00Z');
INSERT INTO voice_callbacks(organization_id,business_id,voice_call_id,phone,name,note,created_at)
 SELECT organization_id,business_id,id,'+77001112233','Aidana','note','2026-10-22T10:01:00Z' FROM voice_calls WHERE external_call_id='room-1';
EOF
echo "=== RLS: видимость"
echo "org A видит звонки: $(count $A 'select count(*) from voice_calls') (ждём 1)"
echo "org B видит просьбы A: $(count $B 'select count(*) from voice_callbacks') (ждём 0)"
echo "без app.org_id видит: $(P -c 'SET ROLE wetop_app' -c 'select count(*) from voice_calls' | tail -1) (ждём 0)"
[ "$(count $A 'select count(*) from voice_calls')" = 1 ] || fails=$((fails+1))
[ "$(count $B 'select count(*) from voice_callbacks')" = 0 ] || fails=$((fails+1))
echo "=== права приложения"
refuse "app INSERT voice_calls" P -c "SET ROLE wetop_app" -c "SET app.org_id='$A'" -c "INSERT INTO voice_calls(organization_id,business_id,agent_id,external_call_id,state,received_at) VALUES ('$A','$AB','$AG','x','RECEIVED',now())"
refuse "app UPDATE voice_calls" P -c "SET ROLE wetop_app" -c "SET app.org_id='$A'" -c "UPDATE voice_calls SET state='ENDED'"
refuse "app UPDATE note просьбы (столбочная привилегия)" P -c "SET ROLE wetop_app" -c "SET app.org_id='$A'" -c "UPDATE voice_callbacks SET note='x'"
echo "чужая организация закрыла просьб: $(P -c 'SET ROLE wetop_app' -c "SET app.org_id='$B'" -c "WITH u AS (UPDATE voice_callbacks SET status='DONE', done_at=now() RETURNING 1) SELECT count(*) FROM u" | tail -1) (ждём 0)"
[ "$(P -c 'SET ROLE wetop_app' -c "SET app.org_id='$B'" -c "WITH u AS (UPDATE voice_callbacks SET status='DONE', done_at=now() RETURNING 1) SELECT count(*) FROM u" | tail -1)" = 0 ] || fails=$((fails+1))
allow "app закрывает просьбу своей организации" P -c "SET ROLE wetop_app" -c "SET app.org_id='$A'" -c "UPDATE voice_callbacks SET status='DONE', done_at=now()"
refuse "закрытая просьба не открывается" P -c "UPDATE voice_callbacks SET status='NEW', done_at=NULL"
refuse "DONE без done_at" P -c "INSERT INTO voice_callbacks(organization_id,business_id,voice_call_id,phone,status,created_at) SELECT organization_id,business_id,id,'+77004445566','DONE',now() FROM voice_calls WHERE external_call_id='room-1'"
echo "=== ограничения и триггеры"
refuse "дубль (agent, external_call_id)" P -c "INSERT INTO voice_calls(organization_id,business_id,agent_id,external_call_id,state,received_at) VALUES ('$A','$AB','$AG','room-1','RECEIVED',now())"
refuse "агент чужой организации" P -c "INSERT INTO voice_calls(organization_id,business_id,agent_id,external_call_id,state,received_at) VALUES ('$A','$AB','$BG','y','RECEIVED',now())"
refuse "бизнес чужой организации" P -c "INSERT INTO voice_calls(organization_id,business_id,agent_id,external_call_id,state,received_at) VALUES ('$A','$BB','$AG','z','RECEIVED',now())"
refuse "полный телефон в caller_masked" P -c "INSERT INTO voice_calls(organization_id,business_id,agent_id,external_call_id,state,received_at,caller_masked) VALUES ('$A','$AB','$AG','m','RECEIVED',now(),'+77001112233')"
refuse "телефон просьбы не E.164" P -c "INSERT INTO voice_callbacks(organization_id,business_id,voice_call_id,phone,created_at) SELECT organization_id,business_id,id,'8700',now() FROM voice_calls WHERE external_call_id='room-1'"
refuse "просьба к звонку другого бизнеса" P -c "INSERT INTO voice_callbacks(organization_id,business_id,voice_call_id,phone,created_at) SELECT organization_id,'$BB',id,'+77004445566',now() FROM voice_calls WHERE external_call_id='room-1'"
allow "RECEIVED -> ANSWERED -> ENDED" P -c "UPDATE voice_calls SET state='ANSWERED', answered_at='2026-10-22T10:00:05Z' WHERE external_call_id='room-1'" -c "UPDATE voice_calls SET state='ENDED', ended_at='2026-10-22T10:02:00Z', duration_seconds=115 WHERE external_call_id='room-1'"
refuse "конечное состояние не меняется" P -c "UPDATE voice_calls SET state='ANSWERED' WHERE external_call_id='room-1'"
refuse "ended_at раньше received_at" P -c "UPDATE voice_calls SET ended_at='2026-10-22T09:00:00Z' WHERE external_call_id='room-b'"
refuse "смена внешнего ID у звонка" P -c "UPDATE voice_calls SET external_call_id='other' WHERE external_call_id='room-b'"
refuse "локация чужого бизнеса" P -c "INSERT INTO voice_calls(organization_id,business_id,location_id,agent_id,external_call_id,state,received_at) VALUES ('$A','$AB','b2000000-0000-4000-8000-000000000002','$AG','loc','RECEIVED',now())" ; 
allow "локация своего бизнеса" P -c "INSERT INTO voice_calls(organization_id,business_id,location_id,agent_id,external_call_id,state,received_at) VALUES ('$A','$AB','a2000000-0000-4000-8000-000000000001','$AG','loc-ok','RECEIVED',now())"
refuse "смена агента у звонка" P -c "UPDATE voice_calls SET agent_id='$AG' WHERE external_call_id='room-b'"
allow "профиль агента своей организации" P -c "INSERT INTO voice_profiles(agent_id,organization_id,business_id,handoff_phone) VALUES ('$AG','$A','$AB','+77009990000')"
refuse "профиль: агент другой организации" P -c "INSERT INTO voice_profiles(agent_id,organization_id,business_id) VALUES ('$BG','$A','$AB')"
echo "=== откат"
if P -f "$M/down.sql" >/dev/null 2>&1; then echo "FAIL: откат прошёл при данных"; fails=$((fails+1)); else echo "ok  откат отказал, пока есть данные"; fi
P -c "TRUNCATE voice_callbacks, voice_calls, voice_profiles"
allow "откат на пустых таблицах" P -f "$M/down.sql"
echo "остались объекты после отката: $(P -c "select count(*) from pg_class where relname like 'voice_%'" | tail -1) таблиц/индексов, $(P -c "select count(*) from pg_proc where proname like 'voice_%'" | tail -1) функций, $(P -c "select count(*) from pg_type where typname like 'Voice%'" | tail -1) типов (ждём 0 0 0)"
allow "повторный накат после отката" P -f "$M/migration.sql"
echo "ИТОГ: провалов $fails"
