import { WorkspaceBackBar } from "./WorkspaceChrome.jsx";

export function ProgressHub({
  onBack,
  onOpenStudyProgress,
  onOpenWeekly,
  onOpenPath,
  onOpenQuizStats,
  onOpenFinance,
  onOpenSchoolTargets = () => {},
  onOpenPlanBoard = () => {},
  currentScore,
}) {
  const cards = [
    {
      title: "学习进度",
      desc: "数学 / 408 / 英语 / 政治等条目化进度",
      onClick: onOpenStudyProgress,
    },
    {
      title: "本周进度",
      desc: "七日快照与推进幅度",
      onClick: onOpenWeekly,
    },
    {
      title: "学习路径",
      desc: "计划路径节点与完成勾选",
      onClick: onOpenPath,
    },
    {
      title: "练习统计",
      desc: "随机练习做题记录汇总",
      onClick: onOpenQuizStats,
    },
    {
      title: "记账",
      desc: "支出与余额、月预算",
      onClick: onOpenFinance,
    },
    {
      title: "择校目标",
      desc: "11408 / 22408 院校对比看板（择校目标.md）",
      onClick: onOpenSchoolTargets,
    },
    {
      title: "进度规划看板",
      desc: "阶段性计划 + 周计划勾选进度（进度规划看板.md）",
      onClick: onOpenPlanBoard,
    },
  ];

  return (
    <div className="progress-hub">
      <WorkspaceBackBar onBack={onBack} title="进度中心" />

      <div className="progress-hub-body">
        {currentScore != null && (
          <p className="progress-hub-score">
            当前综合进度分：<strong>{Math.round(currentScore)}</strong> / 100
          </p>
        )}
        <div className="progress-hub-grid">
          {cards.map((c) => (
            <button key={c.title} type="button" className="progress-hub-card" onClick={c.onClick}>
              <span className="progress-hub-card-title">{c.title}</span>
              <span className="progress-hub-card-desc">{c.desc}</span>
            </button>
          ))}
        </div>
        <p className="progress-hub-hint">
          打开看板后按 Esc 关闭；在「Markdown 浏览器」顶栏也可快速进入同一功能。
        </p>
      </div>
    </div>
  );
}
