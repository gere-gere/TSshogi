interface Player {
  getNextTe(k: Kyokumen, legalTe: Te[]): Te;
}

/* 入力ルール
  1）盤上の駒を動かす場合、移動元の位置を二桁の数字で
　　続けて移動先の位置を二桁の数字で、合わせて四桁の数字で入力する。
    初手２六歩の場合は「2726」となる。
  2)成る時は末尾に「*」を付ける。
    ２三歩成の場合は「2423*」となる。
  3)持駒を打つ際は移動元の代わりに先頭二桁で駒種を表す。
    ３三角打の場合は「0633」となる。
  4)投了の際は「%TORYO」と入力する。
  5)デバッグ用：「p」で合法手一覧を生成
*/

class Human implements Player {
  getNextTe(k: Kyokumen, legalTe: Te[]): Te {
    // 指し手を格納する変数。投了で初期化済。
    // 正しい入力があれば合法手で書き換えられる。
    const toryoPosi: Position = new Position(0, 0);
    let te = new Te(0, toryoPosi, toryoPosi, false);

    do {
      console.log(k.teban === SENTE ? '先手番です\n' : '後手番です\n');

      // 入力待ち
      let input: string = readlineSync.question('move?: ');
      
      // 入力が投了であれば投了となる手を生成して終了
      if(input.toUpperCase() === '%TORYO') {
        break;
      }
      // コマンドpであれば合法手一覧を出力
      if(input === 'p') {
        let teStr: string = '';
        console.log(`可能手：${legalTe.length}手`);
        for(let i: number = 0; i < legalTe.length; i++) {
          if(i !== 0) teStr += ', ';
          teStr += legalTe[i].toString();
        }
        console.log(teStr);
        continue;
      }

      // 入力内容を解析
      let promote: boolean = false;
      if(input.length === 5) {
        if(input.charAt(4) === '*') {
          promote = true;
        } else {
          console.log('入力内容が不正です（再入力）');
          continue;
        }
      }

      let fromSuji: number = 0, fromDan: number = 0,toSuji: number = 0,toDan: number = 0;
      fromSuji = parseInt(input.charAt(0));
      fromDan = parseInt(input.charAt(1));
      toSuji = parseInt(input.charAt(2));
      toDan = parseInt(input.charAt(3));
      if(Number.isNaN(fromSuji) || Number.isNaN(fromDan) || Number.isNaN(toSuji) || Number.isNaN(toDan)) {
        console.log('入力内容が不正です（再入力）');
        continue;  
      }

      let koma: number = 0;
      // 先頭が0ならば駒打ち
      if(fromSuji === 0) {
        koma = fromDan | k.teban;
        fromDan = 0;
      }
      const from: Position = new Position(fromSuji, fromDan);
      const to: Position = new Position(toSuji, toDan);
      if(fromSuji !== 0) {
        // 駒を打つ手でない場合は駒を取得
        koma = k.getKomaData(from);
      }
      te = new Te(koma, from, to, promote);
      if(!te.contains(legalTe)) {
        console.log('合法手ではありません（再入力）');
        continue;
      }

      // 全て問題なければループを抜ける
      break;
    } while(true);
    return te;
  }
}

class Sikou implements Player {
  getNextTe(k: Kyokumen, legalTe: Te[]): Te {
    return legalTe[Math.floor(Math.random() * legalTe.length)];
  }
}
