const C = {
  ink: "#17202A",
  muted: "#5E6B7A",
  line: "#D8DEE7",
  bg: "#F7F8FA",
  panel: "#FFFFFF",
  teal: "#1D7F7A",
  blue: "#3A6EA5",
  green: "#4C8A5A",
  gold: "#C8952D",
  red: "#B85042",
  lavender: "#7C6AAE",
};

const milestones = [
  {
    id: "01",
    title: "Product Alignment",
    dates: "Jul 27-Aug 7",
    start: 0,
    end: 1,
    color: C.teal,
    outcome: "Users, source docs, output formats, and MVP success criteria confirmed.",
  },
  {
    id: "02",
    title: "Document Intake + Discovery",
    barTitle: "Intake + Discovery",
    dates: "Aug 10-Aug 21",
    start: 2,
    end: 3,
    color: C.blue,
    outcome: "Ingest source documents and identify investable concepts with citations.",
  },
  {
    id: "03",
    title: "Evidence Model",
    dates: "Aug 24-Sep 4",
    start: 4,
    end: 5,
    color: C.green,
    outcome: "Structure facts, rationale, risks, roles, unresolved fields, and source evidence.",
  },
  {
    id: "04",
    title: "Narrative Generation",
    dates: "Sep 7-Sep 18",
    start: 6,
    end: 7,
    color: C.gold,
    outcome: "Create donor- and investor-ready draft narratives from selected concepts.",
  },
  {
    id: "05",
    title: "Review + Export",
    dates: "Sep 21-Oct 2",
    start: 8,
    end: 9,
    color: C.lavender,
    outcome: "Enable editing, claim review, unresolved assumptions, and client-ready exports.",
  },
  {
    id: "06",
    title: "Guardrails + Validation",
    dates: "Oct 5-Oct 16",
    start: 10,
    end: 11,
    color: C.red,
    outcome: "Strengthen schema validation, citation checks, and no-fabrication safeguards.",
  },
  {
    id: "07",
    title: "Pilot Demo",
    dates: "Oct 19-Oct 30",
    start: 12,
    end: 13,
    color: C.teal,
    outcome: "Run representative documents through the workflow and deliver pilot demo.",
  },
];

const weeks = [
  "Jul 27",
  "Aug 3",
  "Aug 10",
  "Aug 17",
  "Aug 24",
  "Aug 31",
  "Sep 7",
  "Sep 14",
  "Sep 21",
  "Sep 28",
  "Oct 5",
  "Oct 12",
  "Oct 19",
  "Oct 26",
];

export async function slide01(presentation, ctx) {
  const slide = presentation.slides.add();
  const W = ctx.W;
  const H = ctx.H;

  ctx.addShape(slide, { x: 0, y: 0, w: W, h: H, fill: C.bg });

  ctx.addText(slide, {
    x: 58,
    y: 36,
    w: 770,
    h: 46,
    text: "Investment Case Generator MVP Roadmap",
    fontSize: 31,
    bold: true,
    color: C.ink,
    typeface: ctx.fonts.title,
  });
  ctx.addText(slide, {
    x: 60,
    y: 80,
    w: 860,
    h: 25,
    text: "10-week client plan | concept-first, source-grounded delivery",
    fontSize: 15,
    color: C.muted,
  });

  ctx.addShape(slide, { x: 1010, y: 42, w: 202, h: 38, fill: "#EAF2F2", line: ctx.line("#B7D0CF", 1) });
  ctx.addText(slide, {
    x: 1024,
    y: 51,
    w: 174,
    h: 21,
    text: "MVP demo: Oct 30, 2026",
    fontSize: 13,
    bold: true,
    color: C.teal,
    align: "center",
    valign: "middle",
  });

  const chart = { x: 70, y: 140, w: 1118, h: 380 };
  ctx.addShape(slide, { x: chart.x, y: chart.y, w: chart.w, h: chart.h, fill: C.panel, line: ctx.line("#E1E6EE", 1) });

  const labelW = 265;
  const timelineX = chart.x + labelW + 28;
  const timelineW = chart.w - labelW - 54;
  const rowH = 34;
  const rowGap = 7;
  const headerY = chart.y + 24;
  const rowsY = chart.y + 72;
  const weekW = timelineW / weeks.length;

  ctx.addText(slide, {
    x: chart.x + 24,
    y: headerY - 3,
    w: labelW,
    h: 26,
    text: "Milestone",
    fontSize: 12,
    bold: true,
    color: C.muted,
  });

  weeks.forEach((week, i) => {
    const x = timelineX + i * weekW;
    ctx.addShape(slide, { x, y: headerY + 26, w: 1, h: 278, fill: i % 2 === 0 ? "#E6EAF0" : "#F0F3F7" });
    if (i % 2 === 0) {
      ctx.addText(slide, {
        x: x - 7,
        y: headerY - 4,
        w: 56,
        h: 18,
        text: week,
        fontSize: 9.5,
        color: C.muted,
        align: "center",
      });
    }
  });

  milestones.forEach((m, idx) => {
    const y = rowsY + idx * (rowH + rowGap);
    const barX = timelineX + m.start * weekW + 2;
    const barW = Math.max(48, (m.end - m.start + 1) * weekW - 8);

    ctx.addShape(slide, { x: chart.x + 18, y: y - 2, w: chart.w - 36, h: rowH + 4, fill: idx % 2 === 0 ? "#FBFCFD" : "#FFFFFF" });
    ctx.addShape(slide, { x: chart.x + 28, y: y + 6, w: 25, h: 25, fill: m.color, line: ctx.line(m.color, 0) });
    ctx.addText(slide, {
      x: chart.x + 28,
      y: y + 9,
      w: 25,
      h: 14,
      text: m.id,
      fontSize: 9,
      bold: true,
      color: "#FFFFFF",
      align: "center",
      valign: "middle",
    });
    ctx.addText(slide, {
      x: chart.x + 64,
      y: y + 2,
      w: 186,
      h: 18,
      text: m.title,
      fontSize: 13,
      bold: true,
      color: C.ink,
    });
    ctx.addText(slide, {
      x: chart.x + 64,
      y: y + 21,
      w: 186,
      h: 15,
      text: m.dates,
      fontSize: 10,
      color: C.muted,
    });

    ctx.addShape(slide, { x: barX, y: y + 8, w: barW, h: 23, fill: m.color, line: ctx.line(m.color, 0) });
    ctx.addText(slide, {
      x: barX + 10,
      y: y + 12,
      w: barW - 20,
      h: 14,
      text: m.barTitle ?? m.title,
      fontSize: 9.5,
      bold: true,
      color: "#FFFFFF",
      align: "center",
      valign: "middle",
    });
  });

  const phasesY = 540;
  const phases = [
    { title: "Discovery & Alignment", x: timelineX, w: weekW * 2, color: C.teal },
    { title: "MVP Build", x: timelineX + weekW * 2, w: weekW * 8, color: C.blue },
    { title: "Validation & Pilot", x: timelineX + weekW * 10, w: weekW * 4, color: C.green },
  ];
  phases.forEach((p) => {
    ctx.addShape(slide, { x: p.x, y: phasesY, w: p.w - 7, h: 31, fill: "#FFFFFF", line: ctx.line(p.color, 1.2) });
    ctx.addShape(slide, { x: p.x, y: phasesY, w: 5, h: 31, fill: p.color, line: ctx.line(p.color, 0) });
    ctx.addText(slide, {
      x: p.x + 12,
    y: phasesY + 8,
      w: p.w - 23,
      h: 14,
      text: p.title,
      fontSize: 9.5,
      bold: true,
      color: C.ink,
      align: "center",
    });
  });

  ctx.addShape(slide, { x: timelineX + weekW * 11.4, y: phasesY + 34, w: 196, h: 22, fill: "#FFFFFF", line: ctx.line(C.gold, 1.2, "dashed") });
  ctx.addText(slide, {
    x: timelineX + weekW * 11.4 + 12,
    y: phasesY + 39,
    w: 172,
    h: 14,
    text: "Nov 2-Nov 20: pilot refinement",
    fontSize: 9.5,
    bold: true,
    color: C.ink,
    align: "center",
  });

  const guardrailX = 70;
  ctx.addShape(slide, { x: guardrailX, y: 600, w: 1118, h: 50, fill: "#FEFCF7", line: ctx.line("#E4D3AA", 1) });
  ctx.addText(slide, {
    x: guardrailX + 24,
    y: 615,
    w: 158,
    h: 18,
    text: "Client decision points",
    fontSize: 12,
    bold: true,
    color: C.gold,
  });
  ctx.addText(slide, {
    x: guardrailX + 200,
    y: 612,
    w: 860,
    h: 32,
    text:
      "Document types in scope | review and approval owner | priority output format | evidence threshold for client-ready drafts | unresolved funding recipient or investment vehicle fields",
    fontSize: 12,
    color: C.ink,
  });
  ctx.addText(slide, {
    x: 70,
    y: 670,
    w: 1060,
    h: 20,
    text:
      "Roadmap assumes kickoff on July 27, 2026. Generated investment cases remain draft materials requiring human review; unsupported impact, cost, partner, timeline, and funding claims stay unresolved.",
    fontSize: 9.5,
    color: C.muted,
  });

  return slide;
}
