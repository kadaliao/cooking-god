#!/usr/bin/env bash
# 部署：pnpm build → rsync 到 bj → 修权限 → 线上自检
#
# 用法：bash scripts/deploy.sh [host] [子路径] [站点根目录]
#   默认：bj  cooking-god  /var/www/html
#   线上地址：https://www.liaoxingyi.com/cooking-god/
#   换域名自检：DEPLOY_URL=https://xxx/ bash scripts/deploy.sh
set -euo pipefail

HOST="${1:-bj}"
SUBPATH="${2:-cooking-god}"
SITE_ROOT="${3:-/var/www/html}"
REMOTE_DIR="$SITE_ROOT/$SUBPATH"
STAGE="/tmp/deploy-$SUBPATH-$$"
URL="${DEPLOY_URL:-https://www.liaoxingyi.com/$SUBPATH/}"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "==> 构建"
pnpm build
[ -f dist/index.html ] || { echo "✗ dist/index.html 不存在，构建没产出" >&2; exit 1; }

echo "==> 上传到 $HOST:$REMOTE_DIR"
# 先传到临时目录，再在服务器上 sudo 搬进去：dist 内容原样替换，旧的 hash 资源会被清掉
rsync -az --delete --exclude '.DS_Store' dist/ "$HOST:$STAGE/"
ssh "$HOST" "set -e
  sudo mkdir -p '$REMOTE_DIR'
  sudo rsync -a --delete '$STAGE/' '$REMOTE_DIR/'
  sudo chown -R www-data:www-data '$REMOTE_DIR'
  rm -rf '$STAGE'"

echo "==> 自检 $URL"
code="$(curl -sS --compressed -o /dev/null -m 20 -w '%{http_code}' "$URL")"
[ "$code" = "200" ] || { echo "✗ 首页返回 $code" >&2; exit 1; }

local_sha="$(shasum -a 256 dist/index.html | cut -d' ' -f1)"
remote_sha="$(curl -sS --compressed -m 20 "$URL" | shasum -a 256 | cut -d' ' -f1)"
if [ "$local_sha" != "$remote_sha" ]; then
  echo "✗ index.html 与线上不一致（本地 $local_sha / 线上 $remote_sha）" >&2
  exit 1
fi

# 入口资源逐个探活：任一 404 说明 base 路径或部署目录不对
assets="$(sed -nE 's/.*(src|href)="\.\/?(assets\/[^"]+)".*/\1 \2/p' dist/index.html | awk '{print $2}' | sort -u)"
for a in $assets; do
  c="$(curl -sS -o /dev/null -m 20 -w '%{http_code}' "$URL$a")"
  [ "$c" = "200" ] || { echo "✗ $a 返回 $c" >&2; exit 1; }
done

echo "✓ 部署完成：${URL}（$(du -sh dist | cut -f1)）"
