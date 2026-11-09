/* 局面ハッシュ（Zobrist hash）用の乱数表。
   局面を表す64bitのキーを、32bitずつ二つ（Hi/Lo）に分けて扱う。
   JavaScriptのnumberは64bitの整数ビット演算ができず、BigIntは遅いため。
   乱数は固定の種から生成するので、実行のたびに値が変わることはない
   （ハッシュ値を保存して後から使う場合も、同じ値が得られる）。 */
class Zobrist {
  // 持駒の枚数の上限+1（最も多い歩でも18枚なので、枚数は0～18）
  static readonly HAND_MAX: number = 19;
  // 盤上の升の数
  static readonly SQUARES: number = 81;
  // 駒コードの種類数（先手後手や成りのフラグを含めた0x00～0x3F）
  static readonly KOMA_KINDS: number = 64;

  // 盤上の駒用。添字は「駒コード × 81 + 升の番号」。升の番号は (筋-1)*9 + (段-1)。
  static readonly boardHi: Int32Array = Zobrist.makeKeys(Zobrist.KOMA_KINDS * Zobrist.SQUARES, 0x1badc0de, 0);
  static readonly boardLo: Int32Array = Zobrist.makeKeys(Zobrist.KOMA_KINDS * Zobrist.SQUARES, 0x2f6e2b1d, 0);

  // 持駒用。添字は「(先手後手 × 8 + 駒種) × HAND_MAX + 枚数」。
  // 枚数0のキーは0とする（持っていない駒は、ハッシュに何も寄与しない）。
  static readonly handHi: Int32Array = Zobrist.makeKeys(2 * 8 * Zobrist.HAND_MAX, 0x3c6ef372, Zobrist.HAND_MAX);
  static readonly handLo: Int32Array = Zobrist.makeKeys(2 * 8 * Zobrist.HAND_MAX, 0x4a7484aa, Zobrist.HAND_MAX);

  // 後手番のときだけ加えるキー
  static readonly tebanHi: number = Zobrist.makeKeys(1, 0x5cb0a9dc, 0)[0];
  static readonly tebanLo: number = Zobrist.makeKeys(1, 0x6dc7e0b3, 0)[0];

  // 乱数の生成（mulberry32）。
  // xorshift系の乱数はビット演算に対して線形で、キー同士のXORに規則性が残りやすいため、
  // 乗算を含む非線形の乱数を用いる。
  // zeroEveryが1以上の場合、その個数ごとの先頭（添字がzeroEveryの倍数）のキーを0にする。
  private static makeKeys(count: number, seed: number, zeroEvery: number): Int32Array {
    const keys: Int32Array = new Int32Array(count);
    let a: number = seed | 0;
    for(let i: number = 0; i < count; i++) {
      a = (a + 0x6d2b79f5) | 0;
      let t: number = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      keys[i] = (t ^ (t >>> 14)) | 0;
      if(zeroEvery > 0 && i % zeroEvery === 0) keys[i] = 0;
    }
    return keys;
  }
}
