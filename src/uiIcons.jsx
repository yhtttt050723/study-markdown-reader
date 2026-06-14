/** 内联 SVG 图标（ui-ux-pro-max：不用 emoji 作图标） */

const base = {
  width: 22,
  height: 22,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
};

export function IconReader(props) {
  return (
    <svg {...base} {...props}>
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H18v18H6.5A2.5 2.5 0 0 1 4 18.5v-13Z" />
      <path d="M8 7h8M8 11h8M8 15h5" />
    </svg>
  );
}

export function IconNotes(props) {
  return (
    <svg {...base} {...props}>
      <path d="M8 3h8l4 4v14H8V3Z" />
      <path d="M16 3v4h4M10 12h8M10 16h6" />
    </svg>
  );
}

export function IconProgress(props) {
  return (
    <svg {...base} {...props}>
      <path d="M4 19V5M4 19h16" />
      <path d="M8 15l3-4 3 3 5-7" />
    </svg>
  );
}

export function IconMemorize(props) {
  return (
    <svg {...base} {...props}>
      <path d="M12 3a5 5 0 0 1 5 5v2H9V8a5 5 0 0 1 3-5Z" />
      <path d="M7 10h10v11H7V10Z" />
      <path d="M10 14h4" />
    </svg>
  );
}

export function IconVideo(props) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m10 9 6 4-6 4V9Z" />
    </svg>
  );
}

export function IconCalendar(props) {
  return (
    <svg {...base} {...props}>
      <rect x="4" y="5" width="16" height="15" rx="2" />
      <path d="M8 3v4M16 3v4M4 10h16" />
    </svg>
  );
}

export function IconPath(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="6" cy="18" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="18" cy="6" r="2" />
      <path d="M8 16.5 10.5 13.5 14 10.5 16.5 8" />
    </svg>
  );
}

export function IconQuiz(props) {
  return (
    <svg {...base} {...props}>
      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
      <path d="M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2M9 14h6M9 10h6" />
    </svg>
  );
}

export function IconWallet(props) {
  return (
    <svg {...base} {...props}>
      <path d="M4 8h16v11H4V8Z" />
      <path d="M4 8V6a2 2 0 0 1 2-2h12v4" />
      <circle cx="16" cy="13.5" r="1" />
    </svg>
  );
}

export function IconSchool(props) {
  return (
    <svg {...base} {...props}>
      <path d="M3 10 12 5l9 5-9 5-9-5Z" />
      <path d="M6 12v5c0 1 2.5 2 6 2s6-1 6-2v-5" />
    </svg>
  );
}

export function IconPlan(props) {
  return (
    <svg {...base} {...props}>
      <path d="M8 4h8l3 3v13H5V7l3-3Z" />
      <path d="M9 12h6M9 16h4" />
    </svg>
  );
}

export function IconStatus(props) {
  return (
    <svg {...base} {...props}>
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
      <circle cx="12" cy="12" r="4" />
      <path d="M8 16c1.2 1.5 2.6 2 4 2s2.8-.5 4-2" />
    </svg>
  );
}

const PROGRESS_ICONS = {
  study: IconProgress,
  video: IconVideo,
  weekly: IconCalendar,
  time: IconCalendar,
  path: IconPath,
  status: IconStatus,
  quiz: IconQuiz,
  finance: IconWallet,
  school: IconSchool,
  plan: IconPlan,
};

export function ProgressHubIcon({ id, className }) {
  const Cmp = PROGRESS_ICONS[id] ?? IconProgress;
  return <Cmp className={className} />;
}
