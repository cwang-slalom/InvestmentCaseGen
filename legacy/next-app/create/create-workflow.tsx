"use client";

import Link from "next/link";
import { useMemo, useState, type ChangeEvent, type ReactNode } from "react";

import { VoiceTextInput } from "@/app/_components/voice-text-input";
import type { OutputType } from "@/domain";

import {
  audienceFamiliarityOptions,
  audienceScaleOptions,
  investorSegments,
  narrativeAngleOptions,
  narrativeToneOptions,
} from "../generation-options";

type CreateWorkflowProps = {
  maxUploadMb: number;
  message?: string;
  status?: string;
  userEmail: string;
  userName: string;
};

type StepId = 1 | 2 | 3 | 4;

type TaskOption = {
  id: string;
  icon: IconName;
  title: string;
  description: string;
};

type OutputCard = {
  value: OutputType;
  title: string;
  description: string;
  defaultSelected?: boolean;
};

type IconName =
  | "arrowLeft"
  | "arrowRight"
  | "bell"
  | "book"
  | "brief"
  | "calendar"
  | "check"
  | "chevron"
  | "deck"
  | "document"
  | "folder"
  | "help"
  | "home"
  | "library"
  | "mail"
  | "plus"
  | "review"
  | "search"
  | "shield"
  | "sparkle"
  | "talk";

const steps = [
  {
    id: 1,
    label: "Describe task",
    description: "What are you preparing?",
  },
  {
    id: 2,
    label: "Opportunity & audience",
    description: "Select source materials and audience",
  },
  {
    id: 3,
    label: "Review setup",
    description: "Confirm the recommended approach",
  },
  {
    id: 4,
    label: "Generate",
    description: "Generate your materials",
  },
] satisfies Array<{ id: StepId; label: string; description: string }>;

const taskOptions = [
  {
    id: "donor_meeting",
    icon: "talk",
    title: "Prepare for a donor meeting",
    description: "Create a deck, one-pager, and talking points",
  },
  {
    id: "donor_deck",
    icon: "deck",
    title: "Create a donor deck",
    description: "Presentation outline with speaker notes",
  },
  {
    id: "opportunity_brief",
    icon: "document",
    title: "Draft an opportunity brief",
    description: "Source-backed summary and rationale",
  },
  {
    id: "proposal",
    icon: "brief",
    title: "Develop a proposal",
    description: "Concept note or full investment case",
  },
  {
    id: "rfp_package",
    icon: "mail",
    title: "Create an RFP package",
    description: "Structured materials for funder response",
  },
  {
    id: "update_work",
    icon: "review",
    title: "Update existing work",
    description: "Refresh prior materials with new sources",
  },
] satisfies TaskOption[];

const outputCards = [
  {
    value: "donor_deck",
    title: "Donor deck",
    description: "Slide outline and speaker notes",
    defaultSelected: true,
  },
  {
    value: "donor_one_pager",
    title: "1-page opportunity summary",
    description: "Concise donor pre-read",
    defaultSelected: true,
  },
  {
    value: "meeting_talking_points",
    title: "Meeting talking points",
    description: "Conversation guide",
    defaultSelected: true,
  },
  {
    value: "executive_investment_case",
    title: "Full investment case",
    description: "Detailed donor-facing draft",
  },
  {
    value: "concept_note",
    title: "Concept note",
    description: "Structured diligence note",
  },
  {
    value: "source_appendix",
    title: "Source appendix",
    description: "Evidence and claim references",
    defaultSelected: true,
  },
] satisfies OutputCard[];

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function Icon({ name }: { name: IconName }) {
  const common = {
    "aria-hidden": true,
    viewBox: "0 0 24 24",
  };

  if (name === "home") {
    return (
      <svg {...common}>
        <path d="m3.5 11 8.5-7 8.5 7" />
        <path d="M6.5 10.4v9.1h11v-9.1" />
        <path d="M10 19.5v-5.2h4v5.2" />
      </svg>
    );
  }

  if (name === "folder") {
    return (
      <svg {...common}>
        <path d="M3.8 6.5h5.9l1.8 2h8.7v9.7a1.5 1.5 0 0 1-1.5 1.5H5.3a1.5 1.5 0 0 1-1.5-1.5z" />
        <path d="M3.8 8.5v-2A1.5 1.5 0 0 1 5.3 5h4" />
      </svg>
    );
  }

  if (name === "library" || name === "book") {
    return (
      <svg {...common}>
        <path d="M5 4.5h9.5A3.5 3.5 0 0 1 18 8v11.5H8.2A3.2 3.2 0 0 1 5 16.3z" />
        <path d="M8.2 16.3H18" />
        <path d="M8 8h6.5M8 11h6.5" />
      </svg>
    );
  }

  if (name === "shield") {
    return (
      <svg {...common}>
        <path d="M12 3.6 19 6v5.4c0 4.3-2.8 7.3-7 9-4.2-1.7-7-4.7-7-9V6z" />
        <path d="m9 12 2 2 4-4" />
      </svg>
    );
  }

  if (name === "sparkle") {
    return (
      <svg {...common}>
        <path d="m12 3 1.5 5.2L18.7 10l-5.2 1.8L12 17l-1.5-5.2L5.3 10l5.2-1.8z" />
        <path d="m18.5 15.3.6 2 2 .7-2 .7-.6 2-.7-2-2-.7 2-.7z" />
      </svg>
    );
  }

  if (name === "search") {
    return (
      <svg {...common}>
        <circle cx="10.5" cy="10.5" r="5.5" />
        <path d="m15 15 4.2 4.2" />
      </svg>
    );
  }

  if (name === "bell") {
    return (
      <svg {...common}>
        <path d="M6.5 16.5h11l-1.2-2.2v-3.8a4.3 4.3 0 0 0-8.6 0v3.8z" />
        <path d="M10 19a2.2 2.2 0 0 0 4 0" />
      </svg>
    );
  }

  if (name === "help") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M9.8 9.7a2.4 2.4 0 0 1 4.6 1c0 1.8-2.1 2.1-2.1 3.6" />
        <path d="M12.3 17.4h.1" />
      </svg>
    );
  }

  if (name === "plus") {
    return (
      <svg {...common}>
        <path d="M12 5v14" />
        <path d="M5 12h14" />
      </svg>
    );
  }

  if (name === "deck") {
    return (
      <svg {...common}>
        <path d="M5 5.5h14v10H5z" />
        <path d="M9 19h6" />
        <path d="M12 15.5V19" />
        <path d="M8 9h8" />
      </svg>
    );
  }

  if (name === "document") {
    return (
      <svg {...common}>
        <path d="M6.5 3.5h7l4 4v13h-11z" />
        <path d="M13.5 3.8v4h4" />
        <path d="M9 12h6M9 15h6" />
      </svg>
    );
  }

  if (name === "brief") {
    return (
      <svg {...common}>
        <path d="M7 7.5V5.8A1.8 1.8 0 0 1 8.8 4h6.4A1.8 1.8 0 0 1 17 5.8v1.7" />
        <path d="M4.5 7.5h15v11h-15z" />
        <path d="M9.5 12h5" />
      </svg>
    );
  }

  if (name === "mail") {
    return (
      <svg {...common}>
        <path d="M4.5 6.5h15v11h-15z" />
        <path d="m5 7 7 5.6L19 7" />
      </svg>
    );
  }

  if (name === "review") {
    return (
      <svg {...common}>
        <path d="M5 12a7 7 0 0 1 12-4.9l1.5 1.5" />
        <path d="M18.5 5.5v3.1h-3.1" />
        <path d="M19 12a7 7 0 0 1-12 4.9l-1.5-1.5" />
        <path d="M5.5 18.5v-3.1h3.1" />
      </svg>
    );
  }

  if (name === "talk") {
    return (
      <svg {...common}>
        <path d="M8 13.5H6.5a3.5 3.5 0 0 1 0-7H8" />
        <path d="M16 6.5h1.5a3.5 3.5 0 0 1 0 7H16" />
        <path d="M8 17.5a4 4 0 0 1 8 0" />
        <circle cx="12" cy="10" r="3" />
      </svg>
    );
  }

  if (name === "calendar") {
    return (
      <svg {...common}>
        <path d="M6 5h12v14H6z" />
        <path d="M8.5 3.5v3M15.5 3.5v3M6 9h12" />
      </svg>
    );
  }

  if (name === "check") {
    return (
      <svg {...common}>
        <path d="m5 12 4.2 4.2L19 6.5" />
      </svg>
    );
  }

  if (name === "arrowLeft") {
    return (
      <svg {...common}>
        <path d="M19 12H5" />
        <path d="m11 6-6 6 6 6" />
      </svg>
    );
  }

  if (name === "arrowRight") {
    return (
      <svg {...common}>
        <path d="M5 12h14" />
        <path d="m13 6 6 6-6 6" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <path d="m8 9 4 4 4-4" />
    </svg>
  );
}

function Brand() {
  return (
    <div className="icg-brand" aria-label="Gates Foundation">
      <strong>GATES</strong>
      <span>foundation</span>
    </div>
  );
}

function Stepper({
  currentStep,
  setStep,
}: {
  currentStep: StepId;
  setStep: (step: StepId) => void;
}) {
  return (
    <nav className="icg-stepper" aria-label="Generation steps">
      {steps.map((step) => {
        const isComplete = step.id < currentStep;
        const isActive = step.id === currentStep;

        return (
          <button
            aria-current={isActive ? "step" : undefined}
            className={`icg-step ${isActive ? "active" : ""} ${
              isComplete ? "complete" : ""
            }`}
            key={step.id}
            onClick={() => setStep(step.id)}
            type="button"
          >
            <span className="icg-step-index">
              {isComplete ? <Icon name="check" /> : step.id}
            </span>
            <span>
              <strong>{step.label}</strong>
              <small>{step.description}</small>
            </span>
          </button>
        );
      })}
    </nav>
  );
}

function FieldSelect({
  children,
  label,
  name,
  defaultValue,
}: {
  children: ReactNode;
  defaultValue?: string;
  label: string;
  name: string;
}) {
  return (
    <label className="icg-field">
      <span>{label}</span>
      <select defaultValue={defaultValue} name={name}>
        {children}
      </select>
    </label>
  );
}

export function CreateWorkflow({
  maxUploadMb,
  message,
  status,
  userEmail,
  userName,
}: CreateWorkflowProps) {
  const [currentStep, setCurrentStep] = useState<StepId>(1);
  const [selectedTask, setSelectedTask] = useState(taskOptions[0].id);
  const [fileName, setFileName] = useState("");
  const [selectedOutputs, setSelectedOutputs] = useState<OutputType[]>(
    outputCards
      .filter((output) => output.defaultSelected)
      .map((output) => output.value),
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const selectedOutputLabels = useMemo(
    () =>
      outputCards
        .filter((output) => selectedOutputs.includes(output.value))
        .map((output) => output.title),
    [selectedOutputs],
  );
  const selectedTaskLabel =
    taskOptions.find((task) => task.id === selectedTask)?.title ??
    taskOptions[0].title;
  const canContinueFromSources = Boolean(fileName && selectedOutputs.length);

  function toggleOutput(value: OutputType) {
    setSelectedOutputs((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value],
    );
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    setFileName(event.target.files?.[0]?.name ?? "");
  }

  function stepPanelClass(step: StepId) {
    return `icg-step-panel ${currentStep === step ? "active" : ""}`;
  }

  return (
    <main className="icg-app-shell">
      <aside className="icg-sidebar">
        <Brand />
        <Link className="icg-new-project" href="/create">
          <Icon name="plus" />
          New project
        </Link>
        <nav className="icg-side-nav" aria-label="Workspace navigation">
          <Link className="active" href="/">
            <Icon name="home" />
            Home
          </Link>
          <Link href="/">
            <Icon name="folder" />
            My projects
          </Link>
          <Link href="/">
            <Icon name="shield" />
            Opportunity library
          </Link>
          <span aria-disabled="true">
            <Icon name="talk" />
            Donor profiles
          </span>
          <span aria-disabled="true">
            <Icon name="book" />
            Knowledge base
          </span>
          <span aria-disabled="true">
            <Icon name="calendar" />
            Templates
          </span>
        </nav>
        <div className="icg-sidebar-footer">
          <Link href="/">
            <Icon name="help" />
            Help & resources
          </Link>
        </div>
      </aside>

      <section className="icg-workspace">
        <header className="icg-topbar">
          <strong>Investment Case Generator</strong>
          <label className="icg-search" aria-label="Search">
            <Icon name="search" />
            <input
              placeholder="Search opportunities, donors..."
              type="search"
            />
          </label>
          <div className="icg-topbar-actions">
            <button aria-label="Help" type="button">
              <Icon name="help" />
            </button>
            <button aria-label="Notifications" type="button">
              <Icon name="bell" />
            </button>
            <span className="icg-avatar">{initials(userName)}</span>
            <span>{userName}</span>
          </div>
        </header>

        <form
          action="/api/investment-case"
          className="icg-create-form"
          encType="multipart/form-data"
          method="post"
          onSubmit={() => setIsSubmitting(true)}
        >
          <input name="taskType" type="hidden" value={selectedTask} />

          <Stepper currentStep={currentStep} setStep={setCurrentStep} />

          {status === "error" && message ? (
            <p className="alert error">{message}</p>
          ) : null}

          <section className={stepPanelClass(1)} hidden={currentStep !== 1}>
            <div className="icg-page-heading">
              <p>Step 1 of 4</p>
              <h1>What are you preparing?</h1>
              <span>
                Start with the job to be done. The generator will use approved
                sources, audience context, and review guardrails before
                drafting.
              </span>
            </div>

            <div className="icg-task-layout">
              <section className="icg-card icg-task-card">
                <h2>What are you preparing?</h2>
                <div className="icg-task-grid">
                  {taskOptions.map((task) => (
                    <label
                      className={`icg-choice-card ${
                        selectedTask === task.id ? "selected" : ""
                      }`}
                      key={task.id}
                    >
                      <input
                        checked={selectedTask === task.id}
                        name="taskChoice"
                        onChange={() => setSelectedTask(task.id)}
                        type="radio"
                        value={task.id}
                      />
                      <span className="icg-choice-icon">
                        <Icon name={task.icon} />
                      </span>
                      <span>
                        <strong>{task.title}</strong>
                        <small>{task.description}</small>
                      </span>
                    </label>
                  ))}
                </div>
                <label className="icg-field">
                  <span>Or describe what you need</span>
                  <VoiceTextInput
                    as="textarea"
                    fieldLabel="Task description"
                    maxLength={500}
                    name="description"
                    placeholder="Create a deck for a donor cultivation meeting about a vaccine development opportunity..."
                    rows={4}
                    voiceLabel="Dictate task description"
                  />
                </label>
                <div className="icg-form-actions">
                  <button
                    className="icg-button primary"
                    onClick={() => setCurrentStep(2)}
                    type="button"
                  >
                    Continue
                    <Icon name="arrowRight" />
                  </button>
                </div>
              </section>

              <aside className="icg-assistant-card">
                <h2>
                  <Icon name="sparkle" />
                  Your Assistant
                </h2>
                <p>
                  I will keep source facts separate from generated narrative
                  framing and flag unresolved funding-pathway details.
                </p>
                <div>
                  <strong>What I can do:</strong>
                  <ul>
                    <li>Find investable concepts in approved sources</li>
                    <li>Build an Opportunity Card</li>
                    <li>Tailor materials by audience and stage</li>
                    <li>Generate multiple coordinated outputs</li>
                    <li>Preserve citations and review warnings</li>
                  </ul>
                </div>
              </aside>
            </div>
          </section>

          <section className={stepPanelClass(2)} hidden={currentStep !== 2}>
            <div className="icg-page-heading">
              <p>Step 2 of 4</p>
              <h1>Select opportunity and audience</h1>
              <span>
                Upload approved source materials, define the donor context, and
                choose the output package for this opportunity.
              </span>
            </div>

            <div className="icg-three-column">
              <section className="icg-card icg-source-card">
                <div className="icg-tabs">
                  <button className="active" type="button">
                    <Icon name="search" />
                    Create from approved materials
                  </button>
                  <button type="button">Opportunity library</button>
                </div>

                <label className="icg-upload-target">
                  <input
                    accept=".pdf,.docx,.pptx,.txt,.md,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                    name="file"
                    onChange={onFileChange}
                    type="file"
                  />
                  <span className="icg-upload-icon">
                    <Icon name="sparkle" />
                  </span>
                  <strong>
                    {fileName || "Select or upload approved source documents"}
                  </strong>
                  <small>
                    PDF, DOCX, PPTX, TXT, or Markdown - max {maxUploadMb} MB
                  </small>
                </label>

                <div className="icg-field-grid">
                  <label className="icg-field">
                    <span>Project name</span>
                    <VoiceTextInput
                      fieldLabel="Project name"
                      name="name"
                      placeholder="Vaccine platform"
                      type="text"
                      voiceLabel="Dictate project name"
                    />
                  </label>
                  <FieldSelect
                    defaultValue="philanthropic_foundation"
                    label="Audience profile"
                    name="investorSegment"
                  >
                    {investorSegments.map((segment) => (
                      <option key={segment.value} value={segment.value}>
                        {segment.label}
                      </option>
                    ))}
                  </FieldSelect>
                  <label className="icg-field">
                    <span>Donor or partner context</span>
                    <VoiceTextInput
                      fieldLabel="Donor or partner context"
                      maxLength={160}
                      name="intendedAudience"
                      placeholder="HKJC cultivation"
                      type="text"
                      voiceLabel="Dictate donor context"
                    />
                  </label>
                  <FieldSelect
                    defaultValue="new_to_topic"
                    label="Knowledge level"
                    name="audienceFamiliarity"
                  >
                    {audienceFamiliarityOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </FieldSelect>
                  <FieldSelect
                    defaultValue="exploratory"
                    label="Relationship stage"
                    name="audienceScale"
                  >
                    {audienceScaleOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </FieldSelect>
                  <label className="icg-field">
                    <span>Desired next action</span>
                    <VoiceTextInput
                      fieldLabel="Desired next action"
                      maxLength={240}
                      name="callToAction"
                      placeholder="Explore co-funding"
                      type="text"
                      voiceLabel="Dictate next action"
                    />
                  </label>
                </div>
              </section>

              <section className="icg-card icg-output-card">
                <h2>Outputs to generate</h2>
                <p>
                  Selected outputs are generated from the same Opportunity Card,
                  source claims, and audience setup.
                </p>
                <div className="icg-output-grid">
                  {outputCards.map((output) => {
                    const checked = selectedOutputs.includes(output.value);

                    return (
                      <label
                        className={`icg-output-option ${
                          checked ? "selected" : ""
                        }`}
                        key={output.value}
                      >
                        <input
                          checked={checked}
                          name="outputTypes"
                          onChange={() => toggleOutput(output.value)}
                          type="checkbox"
                          value={output.value}
                        />
                        <span>
                          <Icon name="document" />
                        </span>
                        <strong>{output.title}</strong>
                        <small>{output.description}</small>
                      </label>
                    );
                  })}
                </div>
              </section>

              <aside className="icg-card icg-how-card">
                <h2>
                  <Icon name="sparkle" />
                  How it works
                </h2>
                <ol>
                  <li>
                    <strong>Upload approved materials</strong>
                    <span>Sources retain review and external-use context.</span>
                  </li>
                  <li>
                    <strong>Extract the Opportunity Card</strong>
                    <span>Problem, solution, roles, outcomes, and gaps.</span>
                  </li>
                  <li>
                    <strong>Generate draft outputs</strong>
                    <span>Each draft keeps citations and review warnings.</span>
                  </li>
                </ol>
              </aside>
            </div>

            <div className="icg-bottom-nav">
              <button
                className="icg-button ghost"
                onClick={() => setCurrentStep(1)}
                type="button"
              >
                <Icon name="arrowLeft" />
                Back
              </button>
              <button
                className="icg-button primary"
                disabled={!canContinueFromSources}
                onClick={() => setCurrentStep(3)}
                type="button"
              >
                Continue to review setup
                <Icon name="arrowRight" />
              </button>
            </div>
          </section>

          <section className={stepPanelClass(3)} hidden={currentStep !== 3}>
            <div className="icg-page-heading">
              <p>Step 3 of 4</p>
              <h1>Review setup</h1>
              <span>
                Confirm the narrative approach, evidence settings, and human
                review plan before generation.
              </span>
            </div>

            <div className="icg-review-grid">
              <section className="icg-card">
                <h2>Approach summary</h2>
                <div className="icg-review-list">
                  <FieldSelect
                    defaultValue="innovation"
                    label="Narrative approach"
                    name="narrativeAngle"
                  >
                    {narrativeAngleOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </FieldSelect>
                  <FieldSelect
                    defaultValue="balanced"
                    label="Tone"
                    name="narrativeTone"
                  >
                    {narrativeToneOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </FieldSelect>
                  <label className="icg-field">
                    <span>Variant label</span>
                    <VoiceTextInput
                      fieldLabel="Variant label"
                      maxLength={120}
                      name="variantLabel"
                      placeholder="Optional saved variant label"
                      type="text"
                      voiceLabel="Dictate variant label"
                    />
                  </label>
                </div>
              </section>

              <section className="icg-card">
                <h2>Review plan</h2>
                <div className="icg-review-items">
                  <article>
                    <span className="required">Required</span>
                    <strong>PST review</strong>
                    <p>
                      Technical accuracy, strategy fit, and opportunity framing.
                    </p>
                  </article>
                  <article>
                    <span className="required">Required</span>
                    <strong>Communications review</strong>
                    <p>Narrative, tone, and external-use language.</p>
                  </article>
                  <article>
                    <span>As needed</span>
                    <strong>Legal and policy review</strong>
                    <p>Compliance, sensitive data, and risk considerations.</p>
                  </article>
                </div>
              </section>

              <section className="icg-card">
                <h2>Source and evidence plan</h2>
                <label className="icg-check-row">
                  <input
                    defaultChecked
                    name="strengthenNarrative"
                    type="checkbox"
                  />
                  <span>Strengthen donor-facing narrative after grounding</span>
                </label>
                <label className="icg-check-row">
                  <input name="externalWebSearch" type="checkbox" />
                  <span>Allow external web search for background context</span>
                </label>
                <label className="icg-field">
                  <span>Tailoring notes</span>
                  <VoiceTextInput
                    as="textarea"
                    fieldLabel="Tailoring notes"
                    maxLength={500}
                    name="tailoringNotes"
                    placeholder="Audience interests, sensitivities, regional lens, or technical depth..."
                    rows={4}
                    voiceLabel="Dictate tailoring notes"
                  />
                </label>
                <label className="icg-field">
                  <span>Positioning notes</span>
                  <VoiceTextInput
                    as="textarea"
                    fieldLabel="Positioning notes"
                    maxLength={700}
                    name="positioningNotes"
                    placeholder="Narrative direction only; not treated as source evidence."
                    rows={4}
                    voiceLabel="Dictate positioning notes"
                  />
                </label>
              </section>
            </div>

            <aside className="icg-next-card">
              <Icon name="help" />
              <div>
                <strong>What happens next?</strong>
                <p>
                  The app will upload the source package, extract the first
                  opportunity, generate selected outputs, and preserve review
                  warnings for human approval.
                </p>
              </div>
            </aside>

            <div className="icg-bottom-nav">
              <button
                className="icg-button ghost"
                onClick={() => setCurrentStep(2)}
                type="button"
              >
                <Icon name="arrowLeft" />
                Back
              </button>
              <button
                className="icg-button primary"
                onClick={() => setCurrentStep(4)}
                type="button"
              >
                Continue to generate
                <Icon name="arrowRight" />
              </button>
            </div>
          </section>

          <section className={stepPanelClass(4)} hidden={currentStep !== 4}>
            <div className="icg-page-heading">
              <p>Step 4 of 4</p>
              <h1>Generate materials</h1>
              <span>
                Review the generation package, then create drafts for human
                review and export.
              </span>
            </div>

            <div className="icg-generate-layout">
              <section className="icg-card icg-progress-card">
                <h2>Generation progress</h2>
                <ol>
                  <li className={isSubmitting ? "complete" : ""}>
                    <Icon name={isSubmitting ? "check" : "sparkle"} />
                    Preparing your request
                    <span>{isSubmitting ? "Completed" : "Ready"}</span>
                  </li>
                  <li>
                    <Icon name="library" />
                    Retrieving and synthesizing sources
                    <span>{fileName ? "Queued" : "Waiting"}</span>
                  </li>
                  <li>
                    <Icon name="document" />
                    Writing selected outputs
                    <span>{selectedOutputs.length} drafts</span>
                  </li>
                  <li>
                    <Icon name="shield" />
                    Flagging unsupported claims
                    <span>Review required</span>
                  </li>
                </ol>
              </section>

              <section className="icg-card icg-package-card">
                <h2>Outputs being generated</h2>
                <div className="icg-package-grid">
                  {selectedOutputLabels.map((label) => (
                    <article key={label}>
                      <Icon name="document" />
                      <strong>{label}</strong>
                      <span>Queued</span>
                    </article>
                  ))}
                </div>
                <div className="icg-settings-strip">
                  <strong>Generation settings</strong>
                  <span>{selectedTaskLabel}</span>
                  <span>{fileName}</span>
                  <span>Draft for human review</span>
                </div>
              </section>
            </div>

            <div className="icg-next-steps">
              <article>
                <Icon name="review" />
                <strong>1. Review outputs</strong>
                <span>Approve each draft before external use.</span>
              </article>
              <article>
                <Icon name="document" />
                <strong>2. Make edits</strong>
                <span>Regenerate sections or add reviewer notes.</span>
              </article>
              <article>
                <Icon name="shield" />
                <strong>3. Reuse and save</strong>
                <span>Store approved language as future exemplars.</span>
              </article>
            </div>

            <div className="icg-bottom-nav">
              <button
                className="icg-button ghost"
                onClick={() => setCurrentStep(3)}
                type="button"
              >
                <Icon name="arrowLeft" />
                Back
              </button>
              <button className="icg-button secondary" type="button">
                Save and exit
              </button>
              <button
                className="icg-button primary"
                disabled={!canContinueFromSources || isSubmitting}
                type="submit"
              >
                {isSubmitting ? "Generating..." : "Generate package"}
                <Icon name="arrowRight" />
              </button>
            </div>
          </section>
        </form>

        <p className="icg-user-note">
          Signed in as {userName} ({userEmail})
        </p>
      </section>
    </main>
  );
}
