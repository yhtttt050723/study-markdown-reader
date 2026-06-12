/** 各分区统一顶栏：返回首页 + 标题 + 右侧插槽 */
export function WorkspaceBackBar({ onBack, title, children }) {
  return (
    <header className="workspace-back-bar">
      <button type="button" className="topbar-btn topbar-btn--secondary" onClick={onBack}>
        ← 返回首页
      </button>
      <h1 className="workspace-back-bar-title">{title}</h1>
      <div className="workspace-back-bar-extra">{children}</div>
    </header>
  );
}
