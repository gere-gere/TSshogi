// TSshogi.js の末尾に起動処理 Main.main(); を追記する（ビルドの最終工程）
const fs = require('fs');
fs.appendFileSync('TSshogi.js', '\nMain.main();\n');
