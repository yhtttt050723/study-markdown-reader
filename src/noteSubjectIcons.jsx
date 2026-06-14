/** 学习笔记 · 科目块快捷插入图标 */

const base = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
};

export function IconSubjectDs(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="6" cy="18" r="2" />
      <circle cx="18" cy="6" r="2" />
      <path d="M8 16 14 10M10 8l4 4" />
    </svg>
  );
}

export function IconSubjectCo(props) {
  return (
    <svg {...base} {...props}>
      <rect x="5" y="5" width="14" height="14" rx="2" />
      <path d="M9 9h6M9 12h4M9 15h6" />
    </svg>
  );
}

export function IconSubjectNet(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="5" cy="12" r="2" />
      <circle cx="19" cy="6" r="2" />
      <circle cx="19" cy="18" r="2" />
      <path d="M7 12h6l6-6M13 12l6 6" />
    </svg>
  );
}

export function IconSubjectOs(props) {
  return (
    <svg {...base} {...props}>
      <path d="M4 8h16v3H4zM4 13h16v3H4z" />
      <path d="M8 5v14" />
    </svg>
  );
}

export function IconSubjectCalc(props) {
  return (
    <svg {...base} {...props}>
      <path d="M4 7h16M4 12h10M4 17h6" />
      <path d="M16 14c2 0 3 1 3 3s-1 3-3 3" />
    </svg>
  );
}

export function IconSubjectProb(props) {
  return (
    <svg {...base} {...props}>
      <rect x="4" y="4" width="8" height="8" rx="1.5" />
      <rect x="12" y="12" width="8" height="8" rx="1.5" />
      <path d="M8 12v4h4" />
    </svg>
  );
}

export function IconSubjectLinalg(props) {
  return (
    <svg {...base} {...props}>
      <path d="M5 5h5v5H5zM14 5h5v5h-5zM5 14h5v5H5zM14 14h5v5h-5z" />
    </svg>
  );
}

export function IconSubject408(props) {
  return (
    <svg {...base} {...props}>
      <path d="M6 4h12v16H6z" />
      <path d="M9 8h6M9 12h6M9 16h4" />
    </svg>
  );
}

export function IconSubjectCustom(props) {
  return (
    <svg {...base} {...props}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

const ICON_BY_KEY = {
  ds: IconSubjectDs,
  co: IconSubjectCo,
  net: IconSubjectNet,
  os: IconSubjectOs,
  calc: IconSubjectCalc,
  prob: IconSubjectProb,
  linalg: IconSubjectLinalg,
  "408": IconSubject408,
};

export function NoteSubjectIcon({ iconKey, className }) {
  const Cmp = ICON_BY_KEY[iconKey] ?? IconSubjectCustom;
  return <Cmp className={className} />;
}
