/**
 * 知识树大图：一级标签为大结点 → 二级标签 → 笔记条目
 */
export function NoteKnowledgeMap({ tree, activeId, onPickNote, filterL1, filterL2, onFilterL1, onFilterL2 }) {
  if (!tree?.length) {
    return <p className="kb-map-empty">暂无标签树。为笔记设置一级/二级标签后，将在此聚合显示。</p>;
  }

  return (
    <div className="kb-map" role="tree" aria-label="知识树">
      {tree.map((l1) => (
        <section
          key={l1.tagL1}
          className={`kb-map-l1 ${filterL1 === l1.tagL1 ? "kb-map-l1--focus" : ""}`}
        >
          <button
            type="button"
            className="kb-map-l1-head"
            onClick={() => onFilterL1(filterL1 === l1.tagL1 ? null : l1.tagL1)}
          >
            <span className="kb-map-l1-label">{l1.tagL1}</span>
            <span className="kb-map-l1-meta">{l1.children?.length ?? 0} 个分支</span>
          </button>
          <div className="kb-map-l2-row">
            {(l1.children || []).map((l2) => (
              <div key={`${l1.tagL1}::${l2.tagL2}`} className="kb-map-l2">
                <button
                  type="button"
                  className={`kb-map-l2-head ${filterL2 === l2.tagL2 && filterL1 === l1.tagL1 ? "kb-map-l2-head--on" : ""}`}
                  onClick={() => {
                    onFilterL1(l1.tagL1);
                    onFilterL2(l2.tagL2);
                  }}
                >
                  {l2.tagL2}
                  <span className="kb-map-l2-count">{l2.notes?.length ?? 0}</span>
                </button>
                <ul className="kb-map-notes">
                  {(l2.notes || []).map((n) => (
                    <li key={n.id}>
                      <button
                        type="button"
                        className={n.id === activeId ? "active" : ""}
                        onClick={() => onPickNote(n.id)}
                      >
                        <span className="kb-map-imp" aria-label={`重点${n.importance}`}>
                          {"★".repeat(Math.min(5, Math.max(1, Number(n.importance) || 3)))}
                        </span>
                        {n.title || "无标题"}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

/** 由本地 notes 数组构造与 /api/tree 相近的结构 */
export function buildTreeFromNotes(notes) {
  const byL1 = new Map();
  for (const n of notes) {
    const l1 = n.tagL1 || "未分类";
    const l2 = n.tagL2 || "未分类";
    if (!byL1.has(l1)) byL1.set(l1, new Map());
    const m2 = byL1.get(l1);
    if (!m2.has(l2)) m2.set(l2, []);
    m2.get(l2).push({
      id: n.id,
      title: n.title,
      importance: n.importance ?? 3,
      keywords: n.keywords || [],
      vectorCluster: n.vectorCluster || "",
      updatedAt: n.updatedAt,
    });
  }
  return [...byL1.entries()].map(([tagL1, l2map]) => ({
    tagL1,
    children: [...l2map.entries()].map(([tagL2, arr]) => ({
      tagL2,
      notes: arr,
    })),
  }));
}
