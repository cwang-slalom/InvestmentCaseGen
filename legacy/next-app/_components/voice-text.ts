export const DICTATION_INITIAL_STOP_MS = 7000;
export const DICTATION_SILENCE_STOP_MS = 1800;

export function normalizeDictationText(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

export function mergeDictationText(
  before: string,
  transcript: string,
  after: string,
) {
  const spokenText = normalizeDictationText(transcript);

  if (!spokenText) {
    return `${before}${after}`;
  }

  const leadingSpace = before.length > 0 && !/\s$/.test(before) ? " " : "";
  const trailingSpace =
    after.length > 0 && !/^\s|^[,.;:!?)]/.test(after) ? " " : "";

  return `${before}${leadingSpace}${spokenText}${trailingSpace}${after}`;
}

export function clampTextToMaxLength(value: string, maxLength?: number) {
  if (typeof maxLength !== "number" || maxLength < 0) {
    return value;
  }

  return value.slice(0, maxLength);
}
