export type IconName =
    | "plus"
    | "home"
    | "folder"
    | "library"
    | "profile"
    | "book"
    | "template"
    | "help"
    | "collapse"
    | "arrow"
    | "arrow-left"
    | "check"
    | "circle-check"
    | "refresh"
    | "save"
    | "edit"
    | "close"
    | "warning"
    | "search"
    | "bell"
    | "chevron-down"
    | "sparkles"
    | "users"
    | "presentation"
    | "document"
    | "clipboard"
    | "mail"
    | "mic"
    | "sliders"
    | "heart"
    | "flask"
    | "pin"
    | "shield"
    | "upload"
    | "lightbulb"
    | "info"
    | "external"
    | "target"
    | "globe"
    | "lock"
    | "file"
    | "pdf"
    | "docx"
    | "xlsx"
    | "clock"
    | "people"
    | "box";

type IconProps = {
  name: IconName;
};

export function Icon({ name }: IconProps) {
  const common = {
    "aria-hidden": true,
    viewBox: "0 0 24 24",
    className: "icon",
  };

  if (name === "plus") return <svg {...common}><path d="M12 5v14M5 12h14" /></svg>;
  if (name === "home") return <svg {...common}><path d="m4 11 8-7 8 7" /><path d="M7 10.5V20h10v-9.5" /></svg>;
  if (name === "folder") return <svg {...common}><path d="M4 6.5h6l1.8 2H20v9.8H4z" /><path d="M4 8.5v-2A1.5 1.5 0 0 1 5.5 5H10" /></svg>;
  if (name === "library") return <svg {...common}><path d="M5 4h10.5A3.5 3.5 0 0 1 19 7.5V20H8.2A3.2 3.2 0 0 1 5 16.8z" /><path d="M8.2 16.8H19" /><path d="M8 8h7M8 11h7" /></svg>;
  if (name === "profile") return <svg {...common}><circle cx="12" cy="8" r="3.2" /><path d="M5.5 20a6.5 6.5 0 0 1 13 0" /></svg>;
  if (name === "book") return <svg {...common}><path d="M6 4h9.5A2.5 2.5 0 0 1 18 6.5V20H8a2 2 0 0 1-2-2z" /><path d="M9 8h5M9 11h5" /></svg>;
  if (name === "template") return <svg {...common}><path d="M5 4h14v16H5z" /><path d="M8 8h8M8 12h8M8 16h5" /></svg>;
  if (name === "help") return <svg {...common}><circle cx="12" cy="12" r="8" /><path d="M10 9.5a2.2 2.2 0 1 1 3.3 1.9c-.8.5-1.2 1-1.2 2" /><path d="M12 17h.1" /></svg>;
  if (name === "collapse") return <svg {...common}><path d="M4 5h16M4 12h16M4 19h16" /></svg>;
  if (name === "arrow") return <svg {...common}><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></svg>;
  if (name === "arrow-left") return <svg {...common}><path d="M19 12H5" /><path d="m11 6-6 6 6 6" /></svg>;
  if (name === "check") return <svg {...common}><path d="m5 12 4 4L19 6" /></svg>;
  if (name === "circle-check") return <svg {...common}><circle cx="12" cy="12" r="8.2" /><path d="m8.5 12.2 2.2 2.3 4.8-5" /></svg>;
  if (name === "refresh") return <svg {...common}><path d="M20 12a8 8 0 0 1-14.4 4.8" /><path d="M4 12A8 8 0 0 1 18.4 7.2" /><path d="M18 3v4h-4M6 21v-4h4" /></svg>;
  if (name === "save") return <svg {...common}><path d="M5 4h12l2 2v14H5z" /><path d="M8 4v6h8V4" /><path d="M8 20v-6h8v6" /></svg>;
  if (name === "edit") return <svg {...common}><path d="M5 19h4L19 9l-4-4L5 15z" /><path d="m14 6 4 4" /></svg>;
  if (name === "close") return <svg {...common}><path d="m6 6 12 12M18 6 6 18" /></svg>;
  if (name === "search") return <svg {...common}><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></svg>;
  if (name === "bell") return <svg {...common}><path d="M18 9a6 6 0 0 0-12 0c0 7-2.5 7-2.5 7h17S18 16 18 9" /><path d="M9.8 20a2.4 2.4 0 0 0 4.4 0" /></svg>;
  if (name === "chevron-down") return <svg {...common}><path d="m6 9 6 6 6-6" /></svg>;
  if (name === "sparkles") return <svg {...common}><path d="m12 3 1.8 5.1L19 10l-5.2 1.9L12 17l-1.8-5.1L5 10l5.2-1.9z" /><path d="m19 3 .8 2.2L22 6l-2.2.8L19 9l-.8-2.2L16 6l2.2-.8z" /></svg>;
  if (name === "users") return <svg {...common}><circle cx="9" cy="9" r="3" /><path d="M3.8 19a5.2 5.2 0 0 1 10.4 0" /><circle cx="17" cy="10" r="2.4" /><path d="M14.8 15.5A4.6 4.6 0 0 1 21 19" /></svg>;
  if (name === "presentation") return <svg {...common}><path d="M4 5h16v10H4z" /><path d="M12 15v5M9 20h6M8 9h8" /></svg>;
  if (name === "document") return <svg {...common}><path d="M7 3h7l4 4v14H7z" /><path d="M14 3v5h5M10 12h5M10 16h5" /></svg>;
  if (name === "clipboard") return <svg {...common}><path d="M8 5h8v3H8z" /><path d="M7 6H5v15h14V6h-2" /><path d="M9 13h6M9 17h6" /></svg>;
  if (name === "mail") return <svg {...common}><path d="M4 6h16v12H4z" /><path d="m4 7 8 6 8-6" /></svg>;
  if (name === "mic") return <svg {...common}><path d="M12 3.5a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0v-5a3 3 0 0 0-3-3Z" /><path d="M19 10.5v1a7 7 0 0 1-14 0v-1" /><path d="M12 18.5V21" /><path d="M8.5 21h7" /></svg>;
  if (name === "sliders") return <svg {...common}><path d="M4 7h10M18 7h2M4 17h2M10 17h10M8 14v6M16 4v6" /></svg>;
  if (name === "heart") return <svg {...common}><path d="M20 8.8c0 5.2-8 9.2-8 9.2s-8-4-8-9.2A4.3 4.3 0 0 1 11.4 6l.6.7.6-.7A4.3 4.3 0 0 1 20 8.8Z" /></svg>;
  if (name === "flask") return <svg {...common}><path d="M9 3h6M10 3v6l-5 8.5A2.2 2.2 0 0 0 7 21h10a2.2 2.2 0 0 0 2-3.5L14 9V3" /><path d="M8 15h8" /></svg>;
  if (name === "pin") return <svg {...common}><path d="M12 21s7-4.6 7-11a7 7 0 1 0-14 0c0 6.4 7 11 7 11Z" /><circle cx="12" cy="10" r="2.4" /></svg>;
  if (name === "shield") return <svg {...common}><path d="M12 3 19 6v5c0 4.8-2.8 8.2-7 10-4.2-1.8-7-5.2-7-10V6z" /><path d="M12 8v5" /><path d="M12 16h.1" /></svg>;
  if (name === "upload") return <svg {...common}><path d="M12 15V4" /><path d="m7 9 5-5 5 5" /><path d="M5 15v4h14v-4" /></svg>;
  if (name === "lightbulb") return <svg {...common}><path d="M9 18h6" /><path d="M10 22h4" /><path d="M8 14a6 6 0 1 1 8 0c-.9.7-1 1.5-1 2H9c0-.5-.1-1.3-1-2Z" /></svg>;
  if (name === "info") return <svg {...common}><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5M12 8h.1" /></svg>;
  if (name === "external") return <svg {...common}><path d="M14 4h6v6" /><path d="m20 4-9 9" /><path d="M11 6H5v13h13v-6" /></svg>;
  if (name === "target") return <svg {...common}><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></svg>;
  if (name === "globe") return <svg {...common}><circle cx="12" cy="12" r="8.5" /><path d="M3.5 12h17M12 3.5c2.2 2.3 3.2 5.2 3.2 8.5s-1 6.2-3.2 8.5c-2.2-2.3-3.2-5.2-3.2-8.5s1-6.2 3.2-8.5Z" /></svg>;
  if (name === "lock") return <svg {...common}><path d="M7 10V8a5 5 0 0 1 10 0v2" /><path d="M6 10h12v10H6z" /></svg>;
  if (name === "file") return <svg {...common}><path d="M7 3h7l4 4v14H7z" /><path d="M14 3v5h5" /></svg>;
  if (name === "pdf") return <svg {...common}><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v5h4" /><path d="M8 16h8M8 12h8" /></svg>;
  if (name === "docx") return <svg {...common}><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v5h4" /><path d="M9 12h6M9 15h6M9 18h4" /></svg>;
  if (name === "xlsx") return <svg {...common}><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v5h4" /><path d="M9 12h6M9 16h6M12 12v8" /></svg>;
  if (name === "clock") return <svg {...common}><circle cx="12" cy="12" r="8" /><path d="M12 7v5l3 2" /></svg>;
  if (name === "people") return <svg {...common}><circle cx="8.5" cy="9" r="3" /><circle cx="16" cy="10" r="2.5" /><path d="M3.5 20a5 5 0 0 1 10 0M13.5 16.5A4.3 4.3 0 0 1 21 20" /></svg>;
  if (name === "box") return <svg {...common}><path d="m4 7 8-4 8 4-8 4z" /><path d="M4 7v10l8 4 8-4V7" /><path d="M12 11v10" /></svg>;
  return <svg {...common}><path d="M12 4 21 20H3z" /><path d="M12 9v5" /><path d="M12 17h.1" /></svg>;
}
