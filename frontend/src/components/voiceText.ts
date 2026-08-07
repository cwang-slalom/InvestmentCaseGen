export const DICTATION_INITIAL_STOP_MS = 7000;
export const DICTATION_SILENCE_STOP_MS = 1800;

export type DictationMerge = {
  value: string;
  cursor: number;
  spokenText: string;
};

export function normalizeDictationText(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

export function clampTextToMaxLength(value: string, maxLength?: number) {
  if (typeof maxLength !== "number" || maxLength < 0) {
    return value;
  }

  return value.slice(0, maxLength);
}

export function mergeDictationTextWithCursor(
  before: string,
  transcript: string,
  after: string,
  maxLength?: number,
): DictationMerge {
  const spokenText = normalizeDictationText(transcript);

  if (!spokenText) {
    const value = clampTextToMaxLength(`${before}${after}`, maxLength);

    return {
      value,
      cursor: Math.min(before.length, value.length),
      spokenText,
    };
  }

  const leadingSpace = before.length > 0 && !/\s$/.test(before) ? " " : "";
  const trailingSpace =
    after.length > 0 && !/^\s|^[,.;:!?)]/.test(after) ? " " : "";
  const insertedText = `${leadingSpace}${spokenText}${trailingSpace}`;
  const value = clampTextToMaxLength(
    `${before}${insertedText}${after}`,
    maxLength,
  );

  return {
    value,
    cursor: Math.min(
      before.length + leadingSpace.length + spokenText.length,
      value.length,
    ),
    spokenText,
  };
}

export function mergeDictationText(
  before: string,
  transcript: string,
  after: string,
  maxLength?: number,
) {
  return mergeDictationTextWithCursor(before, transcript, after, maxLength)
    .value;
}
