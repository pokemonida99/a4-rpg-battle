#!/bin/zsh
# gpt.sh <prompt 檔> <輸出檔>
# 用本機 ChatGPT.app 的 codex 問 GPT 文字問題（潤稿、討論看點），只把最後回答存到輸出檔
# stdin 接 /dev/null：在背景跑時 codex 才不會卡在「Reading additional input from stdin」
in=$1; out=$2
CODEX=/Applications/ChatGPT.app/Contents/Resources/codex-cli/bin/codex
$CODEX exec --skip-git-repo-check -o "$out" "$(cat "$in")

（只用文字回答，不要執行任何 shell 指令。）" < /dev/null > "$out.log" 2>&1
[ -s "$out" ] && echo "ok $out" || echo "FAIL $out（看 $out.log）"
