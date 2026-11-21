#!/bin/zsh
# 規則的機制測試（不用瀏覽器）：zsh tools/tests/run.sh　全部要印「全部通過」或沒有 BAD
cd "$(dirname "$0")/../.."
for f in villtest twtest c2test m2test m3test helltest ottest v20test shoptest v23test swaptest jobtest twmintest replaytest recruittest guesttest backtest newhero pettest cycletest benchtest storetest supertest; do echo "── $f"; node tools/tests/$f.mjs | grep -v '^OK'; done
