#!/bin/zsh
# gen.sh <out.png> <prompt> [ref]：用 GPT（ChatGPT.app 的 codex）生一張圖。7 分鐘沒回來就砍掉重試一次。
# 用 --json 拿 thread id，只拿 ~/.codex/generated_images/<thread id>/ 的圖；stdin 接 /dev/null 才不會卡住
out=$1; prompt=$2; ref=$3
CODEX=/Applications/ChatGPT.app/Contents/Resources/codex-cli/bin/codex
args=(exec --skip-git-repo-check --json "Generate one image with your image generation tool: $prompt. Do not run any shell commands.")
[ -n "$ref" ] && args+=(-i "$ref")
for try in 1 2; do
  perl -e 'alarm 420; exec @ARGV' $CODEX $args < /dev/null > "$out.log" 2>&1
  tid=$(grep -o '"thread_id":"[^"]*"' "$out.log" | head -1 | cut -d'"' -f4)
  img=$(ls -t ~/.codex/generated_images/$tid/*.png 2>/dev/null | head -1)
  if [ -n "$tid" ] && [ -n "$img" ]; then cp "$img" "$out"; echo "ok $out ($tid)"; exit 0; fi
  echo "retry $out (try $try)"
done
echo "FAIL $out"; exit 1
