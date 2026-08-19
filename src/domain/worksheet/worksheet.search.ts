export function normalizeSearchKey(value: string): string {
  return value
    .normalize("NFC")
    .replace(/[！-～]/gu, (character) => String.fromCodePoint(character.codePointAt(0)! - 0xfee0))
    .replace(/　/gu, " ")
    .toLocaleLowerCase("ja-JP")
    .trim();
}
