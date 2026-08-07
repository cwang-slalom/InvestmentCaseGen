import { useEffect, useRef, useState, type CSSProperties } from "react";

import { Icon } from "./Icons";
import {
  DICTATION_INITIAL_STOP_MS,
  DICTATION_SILENCE_STOP_MS,
  mergeDictationTextWithCursor,
} from "./voiceText";

type SpeechRecognitionAlternativeLike = {
  transcript: string;
};

type SpeechRecognitionResultLike = {
  isFinal: boolean;
  [index: number]: SpeechRecognitionAlternativeLike | undefined;
};

type SpeechRecognitionResultListLike = {
  length: number;
  [index: number]: SpeechRecognitionResultLike | undefined;
};

type SpeechRecognitionEventLike = Event & {
  results: SpeechRecognitionResultListLike;
};

type SpeechRecognitionErrorEventLike = Event & {
  error: string;
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onend: (() => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

type SpeechRecognitionWindow = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
};

type TextControl = HTMLInputElement | HTMLTextAreaElement;
type VoiceTarget = TextControl | HTMLElement;

type DictationSession = {
  target: VoiceTarget;
  before: string;
  after: string;
  maxLength?: number;
};

type ControlPosition = {
  left: number;
  top: number;
  size: number;
};

const TEXT_INPUT_TYPES = new Set([
  "",
  "email",
  "search",
  "tel",
  "text",
  "url",
]);

function getSpeechRecognition() {
  if (typeof window === "undefined") {
    return undefined;
  }

  const speechWindow = window as SpeechRecognitionWindow;

  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
}

function isTextControl(target: VoiceTarget): target is TextControl {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
}

function isCompatibleInput(target: Element): target is HTMLInputElement {
  if (!(target instanceof HTMLInputElement)) {
    return false;
  }

  return TEXT_INPUT_TYPES.has(target.type);
}

function isCompatibleVoiceTarget(target: Element | null): target is VoiceTarget {
  if (!target || !(target instanceof HTMLElement)) {
    return false;
  }

  if (target.closest("[data-voice-input='off']")) {
    return false;
  }

  if (target instanceof HTMLTextAreaElement) {
    return !target.disabled && !target.readOnly;
  }

  if (isCompatibleInput(target)) {
    return !target.disabled && !target.readOnly;
  }

  return target.isContentEditable && target.getAttribute("contenteditable") !== "false";
}

function readTranscripts(results: SpeechRecognitionResultListLike) {
  let finalTranscript = "";
  let interimTranscript = "";

  for (let index = 0; index < results.length; index += 1) {
    const result = results[index];
    const transcript = result?.[0]?.transcript ?? "";

    if (result?.isFinal) {
      finalTranscript = `${finalTranscript} ${transcript}`;
    } else {
      interimTranscript = `${interimTranscript} ${transcript}`;
    }
  }

  return `${finalTranscript} ${interimTranscript}`;
}

function getMaxLength(target: VoiceTarget) {
  if (!isTextControl(target) || target.maxLength < 0) {
    return undefined;
  }

  return target.maxLength;
}

function getSelectionSession(target: VoiceTarget): DictationSession {
  if (isTextControl(target)) {
    const value = target.value;
    let selectionStart = value.length;
    let selectionEnd = value.length;

    try {
      selectionStart = target.selectionStart ?? value.length;
      selectionEnd = target.selectionEnd ?? value.length;
    } catch {
      selectionStart = value.length;
      selectionEnd = value.length;
    }

    return {
      target,
      before: value.slice(0, selectionStart),
      after: value.slice(selectionEnd),
      maxLength: getMaxLength(target),
    };
  }

  return {
    target,
    before: target.textContent ?? "",
    after: "",
  };
}

function setNativeTextControlValue(target: TextControl, value: string) {
  const prototype = target instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype
    : HTMLInputElement.prototype;
  const valueSetter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;

  if (valueSetter) {
    valueSetter.call(target, value);
  } else {
    target.value = value;
  }
}

function placeCaretInEditable(target: HTMLElement, cursor: number) {
  const selection = window.getSelection();
  const textNode = target.firstChild;

  if (!selection || !textNode || textNode.nodeType !== Node.TEXT_NODE) {
    return;
  }

  const range = document.createRange();
  range.setStart(textNode, Math.min(cursor, textNode.textContent?.length ?? 0));
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

function updateTargetValue(target: VoiceTarget, value: string, cursor: number) {
  if (isTextControl(target)) {
    setNativeTextControlValue(target, value);
    target.dispatchEvent(
      new InputEvent("input", { bubbles: true, inputType: "insertText" }),
    );

    try {
      target.setSelectionRange(cursor, cursor);
    } catch {
      // Some text-like input types do not expose editable selection ranges.
    }
    return;
  }

  target.textContent = value;
  target.dispatchEvent(
    new InputEvent("input", { bubbles: true, inputType: "insertText" }),
  );
  placeCaretInEditable(target, cursor);
}

function calculateControlPosition(target: VoiceTarget): ControlPosition | null {
  const rect = target.getBoundingClientRect();

  if (rect.width <= 0 || rect.height <= 0) {
    return null;
  }

  const size = Math.max(28, Math.min(34, rect.height - 6));
  const insideOffset = 7;
  const left = Math.max(8, Math.min(window.innerWidth - size - 8, rect.right - size - insideOffset));
  const fieldTop = target instanceof HTMLTextAreaElement || target.isContentEditable
    ? rect.top + insideOffset
    : rect.top + (rect.height - size) / 2;
  const top = Math.max(8, Math.min(window.innerHeight - size - 8, fieldTop));

  return { left, top, size };
}

function statusTextFor(errorMessage: string, isListening: boolean) {
  if (errorMessage) {
    return errorMessage;
  }

  if (isListening) {
    return "Listening...";
  }

  return "";
}

export function VoiceInputEnhancer() {
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const autoStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionRef = useRef<DictationSession | null>(null);
  const [activeTarget, setActiveTarget] = useState<VoiceTarget | null>(null);
  const [position, setPosition] = useState<ControlPosition | null>(null);
  const [isSupported, setIsSupported] = useState(() => Boolean(getSpeechRecognition()));
  const [isListening, setIsListening] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const statusText = statusTextFor(errorMessage, isListening);

  useEffect(() => {
    setIsSupported(Boolean(getSpeechRecognition()));
  }, []);

  useEffect(() => {
    return () => {
      if (autoStopTimerRef.current) {
        clearTimeout(autoStopTimerRef.current);
      }

      recognitionRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!activeTarget) {
      setPosition(null);
      return;
    }

    activeTarget.classList.add("voice-input-enhanced");
    setPosition(calculateControlPosition(activeTarget));

    return () => {
      activeTarget.classList.remove("voice-input-enhanced");
    };
  }, [activeTarget]);

  useEffect(() => {
    function refreshActiveTarget(target: Element | null) {
      if (!isCompatibleVoiceTarget(target)) {
        if (!isListening) {
          setActiveTarget(null);
          setErrorMessage("");
        }
        return;
      }

      if (!isListening) {
        setActiveTarget(target);
        setErrorMessage("");
      }
    }

    function handleFocusIn(event: FocusEvent) {
      refreshActiveTarget(event.target as Element | null);
    }

    function handleFocusOut() {
      window.setTimeout(() => {
        if (!isCompatibleVoiceTarget(document.activeElement) && !isListening) {
          setActiveTarget(null);
          setErrorMessage("");
        }
      }, 0);
    }

    function handleInput() {
      if (activeTarget && !isCompatibleVoiceTarget(activeTarget)) {
        setActiveTarget(null);
        return;
      }

      if (activeTarget) {
        setPosition(calculateControlPosition(activeTarget));
      }
    }

    function handleViewportChange() {
      if (activeTarget) {
        setPosition(calculateControlPosition(activeTarget));
      }
    }

    document.addEventListener("focusin", handleFocusIn);
    document.addEventListener("focusout", handleFocusOut);
    document.addEventListener("input", handleInput);
    document.addEventListener("selectionchange", handleViewportChange);
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);

    refreshActiveTarget(document.activeElement);

    return () => {
      document.removeEventListener("focusin", handleFocusIn);
      document.removeEventListener("focusout", handleFocusOut);
      document.removeEventListener("input", handleInput);
      document.removeEventListener("selectionchange", handleViewportChange);
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [activeTarget, isListening]);

  function scheduleAutoStop(delayMs: number) {
    if (autoStopTimerRef.current) {
      clearTimeout(autoStopTimerRef.current);
    }

    autoStopTimerRef.current = setTimeout(() => {
      recognitionRef.current?.stop();
    }, delayMs);
  }

  function stopListening() {
    if (autoStopTimerRef.current) {
      clearTimeout(autoStopTimerRef.current);
      autoStopTimerRef.current = null;
    }

    recognitionRef.current?.stop();
  }

  function startListening() {
    const Recognition = getSpeechRecognition();

    if (!Recognition) {
      setErrorMessage("Voice input is not available in this browser.");
      return;
    }

    if (!activeTarget || !isCompatibleVoiceTarget(activeTarget)) {
      setErrorMessage("Focus an editable text field to use voice input.");
      return;
    }

    const recognition = new Recognition();
    sessionRef.current = getSelectionSession(activeTarget);
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = navigator.language || "en-US";
    recognition.onresult = (event) => {
      const session = sessionRef.current;

      if (!session || !isCompatibleVoiceTarget(session.target)) {
        return;
      }

      const nextValue = mergeDictationTextWithCursor(
        session.before,
        readTranscripts(event.results),
        session.after,
        session.maxLength,
      );

      updateTargetValue(session.target, nextValue.value, nextValue.cursor);
      setPosition(calculateControlPosition(session.target));
      scheduleAutoStop(DICTATION_SILENCE_STOP_MS);
    };
    recognition.onerror = (event) => {
      if (event.error === "no-speech") {
        setErrorMessage("");
      } else if (
        event.error === "not-allowed" ||
        event.error === "service-not-allowed"
      ) {
        setErrorMessage("Microphone permission was blocked.");
      } else {
        setErrorMessage("Voice input stopped unexpectedly.");
      }
    };
    recognition.onend = () => {
      if (autoStopTimerRef.current) {
        clearTimeout(autoStopTimerRef.current);
        autoStopTimerRef.current = null;
      }

      recognitionRef.current = null;
      sessionRef.current = null;
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    setErrorMessage("");
    setIsListening(true);

    try {
      recognition.start();
      scheduleAutoStop(DICTATION_INITIAL_STOP_MS);
    } catch {
      recognitionRef.current = null;
      sessionRef.current = null;
      setIsListening(false);
      setErrorMessage("Voice input could not start.");
    }
  }

  function handleButtonClick() {
    if (isListening) {
      stopListening();
      return;
    }

    startListening();
  }

  if (!activeTarget || !position) {
    return null;
  }

  const controlStyle = {
    left: position.left,
    top: position.top,
    "--voice-control-size": `${position.size}px`,
  } as CSSProperties;
  const buttonLabel = isListening ? "Stop voice input" : "Use voice input";
  const buttonTitle = isSupported
    ? "Use voice input in this field"
    : "Voice input is not available in this browser";

  return (
    <div
      className={`voice-input-affordance ${isListening ? "is-listening" : ""} ${!isSupported ? "is-unavailable" : ""}`}
      style={controlStyle}
    >
      <button
        aria-label={buttonLabel}
        aria-pressed={isListening}
        className="voice-input-button"
        onClick={handleButtonClick}
        onMouseDown={(event) => event.preventDefault()}
        title={buttonTitle}
        type="button"
      >
        <Icon name="mic" />
      </button>
      {statusText ? (
        <span className="voice-input-status" role="status">
          {statusText}
        </span>
      ) : null}
    </div>
  );
}
