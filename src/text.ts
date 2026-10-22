/** Traditional characters that show up on HK/TW bills, mapped just enough for the rules. */
const TRAD_PAIRS: [string, string][] = [
  ['險', '险'], ['單', '单'], ['賬', '账'], ['發', '发'], ['約', '约'],
  ['護', '护'], ['證', '证'], ['員', '员'], ['訂', '订'], ['閱', '阅'],
  ['費', '费'], ['幣', '币'], ['總', '总'], ['計', '计'], ['繳', '缴'],
  ['續', '续'], ['簽', '签'], ['書', '书'], ['務', '务'], ['電', '电'],
  ['話', '话'], ['價', '价'], ['銀', '银'], ['號', '号'], ['車', '车'],
  ['駕', '驾'], ['駛', '驶'], ['據', '据'], ['戶', '户'], ['門', '门'],
  ['開', '开'], ['關', '关'], ['時', '时'], ['間', '间'], ['後', '后'],
  ['過', '过'], ['這', '这'], ['個', '个'], ['為', '为'], ['於', '于'],
  ['與', '与'], ['從', '从'], ['將', '将'], ['對', '对'], ['應', '应'],
  ['該', '该'], ['並', '并'], ['無', '无'], ['萬', '万'], ['億', '亿'],
  ['圓', '圆'], ['實', '实'], ['條', '条'], ['業', '业'], ['東', '东'],
  ['長', '长'], ['國', '国'], ['壽', '寿'], ['醫', '医'], ['療', '疗'],
];

export function normalizeText(input: string): string {
  let text = input.normalize('NFKC').replace(/\u3000/g, ' ').replace(/\r/g, '');
  for (const [from, to] of TRAD_PAIRS) text = text.replaceAll(from, to);
  // Tesseract often inserts spaces between Chinese characters.
  text = text.replace(/([\u4e00-\u9fff])[ \t]+(?=[\u4e00-\u9fff])/g, '$1');
  return text.replace(/[ \t]+\n/g, '\n').replace(/[ \t]{2,}/g, ' ').trim();
}
