import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { PLAN_PATH_D, samplePointsOnPath } from "./studyPlanPath.js";

/** @typedef {{ id: string, label: string, subtitle?: string }} PlanPathNode */

export function StudyPathDashboard({ nodes, doneMap, onToggleDone, onClose }) {
  const pathRef = useRef(null);
  const [points, setPoints] = useState([]);

  useLayoutEffect(() => {
    const el = pathRef.current;
    if (!el || !nodes?.length) {
      setPoints([]);
      return;
    }
    setPoints(samplePointsOnPath(el, nodes.length));
  }, [nodes]);

  useEffect(() => {
    const onResize = () => {
      const el = pathRef.current;
      if (!el || !nodes?.length) return;
      setPoints(samplePointsOnPath(el, nodes.length));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [nodes]);

  return (
    <div
      className="study-path-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="study-path-title"
    >
      <div className="study-path-panel">
        <div className="study-path-toolbar">
          <h2 id="study-path-title" className="study-path-title">
            学习计划路径
          </h2>
          <button type="button" className="ghost-btn" onClick={onClose}>
            关闭（Esc）
          </button>
        </div>
        <p className="study-path-lead">
          沿路径查看阶段节点；点击节点标记<strong>已完成</strong>（保存在本机{" "}
          <code>smr-plan-path-done</code>）。可在「学习计划路径.md」中用{" "}
          <code>smr-plan-path</code> 自定义节点列表。
        </p>

        <div className="study-path-scene">
          <svg
            className="study-path-svg"
            viewBox="0 0 820 400"
            preserveAspectRatio="xMidYMid meet"
            aria-hidden
          >
            <defs>
              <linearGradient id="study-path-road" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#64748b" />
                <stop offset="100%" stopColor="#475569" />
              </linearGradient>
              <filter id="study-path-shadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="4" stdDeviation="6" floodOpacity="0.25" />
              </filter>
            </defs>

            <path
              ref={pathRef}
              d={PLAN_PATH_D}
              fill="none"
              stroke="#334155"
              strokeWidth="22"
              strokeLinecap="round"
              strokeLinejoin="round"
              filter="url(#study-path-shadow)"
            />
            <path
              d={PLAN_PATH_D}
              fill="none"
              stroke="url(#study-path-road)"
              strokeWidth="14"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d={PLAN_PATH_D}
              fill="none"
              stroke="#fde047"
              strokeWidth="2"
              strokeDasharray="10 14"
              opacity="0.85"
            />

            {nodes.map((node, i) => {
              const pt = points[i];
              if (!pt) return null;
              const done = Boolean(doneMap[node.id]);
              return (
                <g key={node.id}>
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r="18"
                    className={
                      done ? "study-path-node-ring study-path-node-ring--done" : "study-path-node-ring"
                    }
                  />
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r="11"
                    className={
                      done ? "study-path-node-dot study-path-node-dot--done" : "study-path-node-dot"
                    }
                  />
                </g>
              );
            })}
          </svg>

          <div className="study-path-labels">
            {nodes.map((node, i) => {
              const pt = points[i];
              if (!pt) return null;
              const done = Boolean(doneMap[node.id]);
              const leftPct = `${(pt.x / 820) * 100}%`;
              const topPct = `${(pt.y / 400) * 100}%`;
              return (
                <button
                  key={node.id}
                  type="button"
                  className={
                    done ? "study-path-card study-path-card--done" : "study-path-card"
                  }
                  style={{ left: leftPct, top: topPct }}
                  onClick={() => onToggleDone(node.id)}
                >
                  <span className="study-path-card-label">{node.label}</span>
                  {node.subtitle ? (
                    <span className="study-path-card-sub">{node.subtitle}</span>
                  ) : null}
                  <span className="study-path-card-hint">
                    {done ? "已完成 · 再点取消" : "点击标记完成"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="study-path-finish">
          <span className="study-path-flag" aria-hidden>
            🏁
          </span>
          <span>路径终点代表「阶段目标闭环」；详细任务可对照周期记录中的备考路线图。</span>
        </div>
      </div>
    </div>
  );
}
