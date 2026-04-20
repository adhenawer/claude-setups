// === Shared primitives ===

const SPECIALTIES = [
  { id: "all",      label: "Todos" },
  { id: "fullstack",label: "Fullstack" },
  { id: "frontend", label: "Frontend" },
  { id: "mobile",   label: "Mobile" },
  { id: "devops",   label: "DevOps" },
  { id: "data",     label: "Data" },
  { id: "research", label: "Research" },
];

function Logo({ size = 32 }) {
  return (
    <div
      className="logo-mark"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <div className="logo-inner">
        <span>{"{"}</span>
        <span className="logo-dot" />
        <span>{"}"}</span>
      </div>
    </div>
  );
}

function Avatar({ setup, size = 40 }) {
  return (
    <div
      className="avatar"
      style={{
        width: size,
        height: size,
        background: setup.avatarBg,
        fontSize: Math.round(size * 0.42),
      }}
      aria-label={setup.authorName}
    >
      {setup.avatar}
    </div>
  );
}

function Badge({ children, muted }) {
  return <span className={"badge " + (muted ? "badge-muted" : "")}>{children}</span>;
}

function StatPill({ n, label, icon }) {
  if (!n) return null;
  return (
    <div className="stat-pill" title={`${n} ${label}`}>
      <span className="stat-icon">{icon}</span>
      <span className="stat-n">{n}</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}

// tiny glyph icons (no external deps)
const Icons = {
  plug: "⚡",
  mcp: "◉",
  hook: "⚓",
  skill: "✦",
  search: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
  ),
  sun: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>
  ),
  moon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
  ),
  arrow: "→",
  github: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 .5C5.73.5.77 5.47.77 11.75c0 4.94 3.2 9.12 7.64 10.6.56.1.76-.24.76-.54 0-.27-.01-1.17-.02-2.12-3.11.68-3.77-1.31-3.77-1.31-.51-1.3-1.25-1.65-1.25-1.65-1.02-.7.08-.69.08-.69 1.13.08 1.72 1.16 1.72 1.16 1 1.72 2.63 1.22 3.27.93.1-.72.39-1.22.71-1.5-2.48-.28-5.09-1.24-5.09-5.52 0-1.22.44-2.22 1.15-3-.12-.28-.5-1.42.1-2.96 0 0 .94-.3 3.08 1.15a10.7 10.7 0 0 1 5.61 0c2.14-1.45 3.08-1.15 3.08-1.15.61 1.54.23 2.68.11 2.96.72.78 1.15 1.78 1.15 3 0 4.29-2.62 5.23-5.11 5.51.4.34.76 1.02.76 2.06 0 1.49-.01 2.69-.01 3.05 0 .3.2.65.77.54 4.43-1.48 7.63-5.66 7.63-10.6C23.23 5.47 18.27.5 12 .5z"/></svg>
  ),
  copy: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>
  ),
  file: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>
  ),
  folder: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
  ),
  back: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
  ),
};

function CopyCmd({ cmd, size = "md" }) {
  const [copied, setCopied] = React.useState(false);
  const onClick = () => {
    navigator.clipboard?.writeText(cmd).then(
      () => { setCopied(true); setTimeout(() => setCopied(false), 1600); },
      () => {}
    );
  };
  return (
    <button className={"copy-cmd copy-cmd-" + size} onClick={onClick} title="Copiar">
      <span className="copy-cmd-dollar">$</span>
      <code className="copy-cmd-text">{cmd}</code>
      <span className="copy-cmd-btn">
        {copied ? "copiado!" : Icons.copy}
      </span>
    </button>
  );
}

Object.assign(window, {
  SPECIALTIES, Logo, Avatar, Badge, StatPill, Icons, CopyCmd,
});
