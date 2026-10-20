#!/usr/bin/env bash
# Включение домена сайтов клиентов (ADR-185, Q-271) одной командой, после покупки домена владельцем.
#   bash scripts/ops/sites-domain-setup.sh <домен> <адрес API, напр. https://api.wetop.ai>
# Что делает, по Cloudflare API (токен из ~/.config/wetop/cloudflare.env, нужны права Zone DNS:Edit и Workers:Edit):
#   1. находит зону домена в аккаунте (домен должен быть куплен или добавлен в Cloudflare);
#   2. заводит wildcard DNS `*.<домен>` и корень (AAAA 100:: proxied, origin это Worker);
#   3. выкладывает Worker `apps/sites` (production) с SITES_BASE_DOMAIN и SITES_API_URL и маршрутом `*.<домен>/*`;
#   4. печатает, что вписать в .env API на сервере (SITES_BASE_DOMAIN, SITE_PREVIEW_SECRET, SITES_RUNTIME_KEY).
# Секреты на экран не печатаются; SITES_RUNTIME_KEY и SITE_PREVIEW_SECRET создаются здесь и кладутся в файл 600.
set -euo pipefail
DOMAIN="${1:?домен, например wetop.site}"
API_URL="${2:?адрес API, например https://api.wetop.ai}"
case "$DOMAIN" in *wetop.ai) echo "Домен сайтов не может быть под wetop.ai (ADR-185: кука сессии на .wetop.ai)"; exit 2;; esac
set -a; . "$HOME/.config/wetop/cloudflare.env"; set +a
CF=https://api.cloudflare.com/client/v4
H=(-H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" -H "Content-Type: application/json")
cd "$(dirname "$0")/../.."

curl -s "${H[@]}" "$CF/zones?name=$DOMAIN" -o /tmp/sd-zone.json
ZONE=$(python3 -c "import json;r=json.load(open('/tmp/sd-zone.json'))['result'];print(r[0]['id'] if r else '')")
[ -n "$ZONE" ] || { echo "Зоны $DOMAIN нет в Cloudflare: купите домен в Cloudflare Registrar или добавьте зону"; exit 3; }
echo "зона $DOMAIN: найдена"

for NAME in "*.$DOMAIN" "$DOMAIN"; do
  curl -s "${H[@]}" "$CF/zones/$ZONE/dns_records?name=$NAME" -o /tmp/sd-dns.json
  if python3 -c "import json,sys;sys.exit(0 if json.load(open('/tmp/sd-dns.json'))['result'] else 1)"; then
    echo "DNS $NAME: уже есть"
  else
    curl -s "${H[@]}" -X POST "$CF/zones/$ZONE/dns_records" \
      --data "{\"type\":\"AAAA\",\"name\":\"$NAME\",\"content\":\"100::\",\"proxied\":true,\"comment\":\"WETOP sites Worker (ADR-185)\"}" -o /tmp/sd-dns-new.json
    python3 -c "import json;d=json.load(open('/tmp/sd-dns-new.json'));print('DNS $NAME:', 'создан' if d['success'] else d['errors'])"
  fi
done

SECRETS="$HOME/.config/wetop/sites-$DOMAIN.env"
if [ ! -f "$SECRETS" ]; then
  umask 077
  printf 'SITES_BASE_DOMAIN=%s\nSITES_RUNTIME_KEY=%s\nSITE_PREVIEW_SECRET=%s\n' "$DOMAIN" "$(openssl rand -hex 32)" "$(openssl rand -hex 32)" > "$SECRETS"
fi
set -a; . "$SECRETS"; set +a

cd apps/sites
export CLOUDFLARE_API_TOKEN CLOUDFLARE_ACCOUNT_ID
printf '%s' "$SITES_RUNTIME_KEY" | npx -y wrangler@4.148.0 secret put SITES_RUNTIME_KEY --env production >/dev/null
npx -y wrangler@4.148.0 deploy --env production \
  --var "SITES_API_URL:$API_URL" --var "SITES_BASE_DOMAIN:$DOMAIN" \
  --route "*.$DOMAIN/*" --route "$DOMAIN/*"

echo
echo "Готово на стороне Cloudflare. В .env API на сервере добавить строки из $SECRETS (файл 600, значения не печатаются):"
echo "  SITES_BASE_DOMAIN, SITES_RUNTIME_KEY, SITE_PREVIEW_SECRET; затем перезапуск API."
