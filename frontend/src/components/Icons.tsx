type IconProps = {
  name:
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
    | "check"
    | "refresh"
    | "save"
    | "edit"
    | "close"
    | "warning";
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
  if (name === "check") return <svg {...common}><path d="m5 12 4 4L19 6" /></svg>;
  if (name === "refresh") return <svg {...common}><path d="M20 12a8 8 0 0 1-14.4 4.8" /><path d="M4 12A8 8 0 0 1 18.4 7.2" /><path d="M18 3v4h-4M6 21v-4h4" /></svg>;
  if (name === "save") return <svg {...common}><path d="M5 4h12l2 2v14H5z" /><path d="M8 4v6h8V4" /><path d="M8 20v-6h8v6" /></svg>;
  if (name === "edit") return <svg {...common}><path d="M5 19h4L19 9l-4-4L5 15z" /><path d="m14 6 4 4" /></svg>;
  if (name === "close") return <svg {...common}><path d="m6 6 12 12M18 6 6 18" /></svg>;
  return <svg {...common}><path d="M12 4 21 20H3z" /><path d="M12 9v5" /><path d="M12 17h.1" /></svg>;
}
