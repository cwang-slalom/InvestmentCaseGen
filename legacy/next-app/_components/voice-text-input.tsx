"use client";

import type { ChangeEvent, ComponentPropsWithoutRef, MouseEvent } from "react";
import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import {
  clampTextToMaxLength,
  DICTATION_INITIAL_STOP_MS,
  DICTATION_SILENCE_STOP_MS,
  mergeDictationText,
} from "./voice-text";

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

type SharedVoiceTextProps = {
  defaultValue?: string;
  fieldLabel?: string;
  voiceLabel?: string;
};

type VoiceInputProps = SharedVoiceTextProps &
  Omit<
    ComponentPropsWithoutRef<"input">,
    "defaultValue" | "onChange" | "type" | "value"
  > & {
    as?: "input";
    type?: "email" | "search" | "text";
  };

type VoiceTextareaProps = SharedVoiceTextProps &
  Omit<
    ComponentPropsWithoutRef<"textarea">,
    "defaultValue" | "onChange" | "value"
  > & {
    as: "textarea";
  };

type VoiceTextInputProps = VoiceInputProps | VoiceTextareaProps;

type DictationSession = {
  before: string;
  after: string;
};

function getSpeechRecognition() {
  if (typeof window === "undefined") {
    return undefined;
  }

  const speechWindow = window as SpeechRecognitionWindow;

  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
}

function subscribeToSpeechSupportChange() {
  return () => {};
}

function getSpeechSupportSnapshot() {
  return Boolean(getSpeechRecognition());
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

function voiceStatusFor(errorMessage: string, isListening: boolean) {
  if (errorMessage) {
    return errorMessage;
  }

  if (isListening) {
    return "Listening...";
  }

  return "";
}

function MicrophoneIcon() {
  return (
    <svg className="ui-icon" aria-hidden="true" viewBox="0 0 24 24">
      <path d="M12 3a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z" />
      <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
      <path d="M12 18v3" />
      <path d="M8 21h8" />
    </svg>
  );
}

export function VoiceTextInput(props: VoiceTextInputProps) {
  const {
    as = "input",
    defaultValue = "",
    disabled,
    fieldLabel,
    maxLength,
    voiceLabel = "Dictate text",
    ...fieldProps
  } = props;
  const generatedId = useId();
  const fieldRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const autoStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionRef = useRef<DictationSession | null>(null);
  const [value, setValue] = useState(defaultValue);
  const isSupported = useSyncExternalStore(
    subscribeToSpeechSupportChange,
    getSpeechSupportSnapshot,
    () => false,
  );
  const [isListening, setIsListening] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const statusText = voiceStatusFor(errorMessage, isListening);
  const statusId = `${generatedId}-voice-status`;
  const describedBy = [
    fieldProps["aria-describedby"],
    statusText ? statusId : undefined,
  ]
    .filter(Boolean)
    .join(" ");

  useEffect(() => {
    return () => {
      if (autoStopTimerRef.current) {
        clearTimeout(autoStopTimerRef.current);
      }

      recognitionRef.current?.abort();
    };
  }, []);

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

    const field = fieldRef.current;
    const selectionStart = field?.selectionStart ?? value.length;
    const selectionEnd = field?.selectionEnd ?? value.length;
    const recognition = new Recognition();

    sessionRef.current = {
      before: value.slice(0, selectionStart),
      after: value.slice(selectionEnd),
    };
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = navigator.language || "en-US";
    recognition.onresult = (event) => {
      const session = sessionRef.current;

      if (!session) {
        return;
      }

      const nextValue = clampTextToMaxLength(
        mergeDictationText(
          session.before,
          readTranscripts(event.results),
          session.after,
        ),
        maxLength,
      );

      setValue(nextValue);
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

  function handleVoiceButtonClick(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();

    if (isListening) {
      stopListening();
      return;
    }

    startListening();
  }

  function handleInputChange(
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) {
    setValue(event.currentTarget.value);
  }

  const sharedFieldProps = {
    ...fieldProps,
    "aria-describedby": describedBy || undefined,
    "aria-label": fieldProps["aria-label"] ?? fieldLabel,
    disabled,
    maxLength,
    onChange: handleInputChange,
    ref: fieldRef,
    value,
  };
  const voiceButtonLabel = isListening ? "Stop dictation" : voiceLabel;
  const voiceButtonTitle = isSupported
    ? voiceButtonLabel
    : "Voice input is not available in this browser";

  return (
    <span className="voice-text-control">
      <span
        className={`voice-input-shell ${as === "textarea" ? "textarea" : ""}`}
      >
        {as === "textarea" ? (
          <textarea
            {...(sharedFieldProps as ComponentPropsWithoutRef<"textarea">)}
          />
        ) : (
          <input
            {...(sharedFieldProps as ComponentPropsWithoutRef<"input">)}
            type={(props as VoiceInputProps).type ?? "text"}
          />
        )}
        <button
          aria-label={voiceButtonLabel}
          aria-pressed={isListening}
          className={`voice-button ${isListening ? "recording" : ""}`}
          disabled={disabled || !isSupported}
          onClick={handleVoiceButtonClick}
          onMouseDown={(event) => event.preventDefault()}
          title={voiceButtonTitle}
          type="button"
        >
          <MicrophoneIcon />
        </button>
      </span>
      {statusText ? (
        <span className="voice-status" id={statusId} role="status">
          {statusText}
        </span>
      ) : null}
    </span>
  );
}
