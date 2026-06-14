import { WorkspaceBackBar } from "./WorkspaceChrome.jsx";
import { ProgressHubIcon } from "./uiIcons.jsx";

export function ProgressHub({
  onBack,
  onOpenStudyProgress,
  onOpenVideoProgress,
  onOpenWeekly,
  onOpenStudyTime,
  onOpenPath,
  onOpenQuizStats,
  onOpenFinance,
  onOpenSchoolTargets = () => {},
  onOpenPlanBoard = () => {},
  onOpenStatusBoard = () => {},
  currentScore,
}) {
  const cards = [
    {
      id: "study",
      title: "学习进度",
      desc: "数学 / 408 / 英语 / 政治等条目化进度",
      onClick: onOpenStudyProgress,
    },
    {
      id: "video",
      title: "视频进度",
      desc: "B 站课分 P 时长 + 本周观看分钟登记",
      onClick: onOpenVideoProgress,
    },
    {
      id: "weekly",
      title: "本周进度",
      desc: "七日快照与推进幅度",
      onClick: onOpenWeekly,
    },
    {
      id: "time",
      title: "学习时长",
      desc: "日历查看每日学习总时长（周期记录日报）",
      onClick: onOpenStudyTime,
    },
    {
      id: "path",
      title: "学习路径",
      desc: "计划路径节点与完成勾选",
      onClick: onOpenPath,
    },
    {
      id: "status",
      title: "个人状态情况看板",
      desc: "习惯画像、当前状态、反模式自检 · 周复盘后更新",
      onClick: onOpenStatusBoard,
    },
    {
      id: "plan",
      title: "进度规划看板",
      desc: "六月阶段、周验收、科目详规 · 可点击勾选写回 md",
      onClick: onOpenPlanBoard,
    },
    {
      id: "quiz",
      title: "练习统计",
      desc: "随机练习做题记录汇总",
      onClick: onOpenQuizStats,
    },
    {
      id: "finance",
      title: "记账",
      desc: "支出与余额、月预算",
      onClick: onOpenFinance,
    },
    {
      id: "school",
      title: "择校目标",
      desc: "11408 / 22408 院校对比看板（择校目标.md）",
      onClick: onOpenSchoolTargets,
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
            <button key={c.id} type="button" className="progress-hub-card" onClick={c.onClick}>
              <span className="progress-hub-card-icon" aria-hidden="true">
                <ProgressHubIcon id={c.id} />
              </span>
              <span className="progress-hub-card-text">
                <span className="progress-hub-card-title">{c.title}</span>
                <span className="progress-hub-card-desc">{c.desc}</span>
              </span>
            </button>
          ))}
        </div>
        <p className="progress-hub-hint">
          「个人状态」与「进度规划」看板内可直接勾选任务（自动保存到对应 .md）。按 Esc 关闭浮层。
        </p>
      </div>
    </div>
  );
}
