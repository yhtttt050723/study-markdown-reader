import { useEffect, useState } from 'react'
import { api, type PublicSettings } from '../api'

export function SettingsPage() {
  const [s, setS] = useState<PublicSettings | null>(null)
  const [tongyi, setTongyi] = useState('')
  const [deepseek, setDeepseek] = useState('')
  const [provider, setProvider] = useState('tongyi')
  const [msg, setMsg] = useState('')

  const load = () => {
    api.getSettings().then((data) => {
      setS(data)
      setProvider(data.llm_default_provider)
    })
  }

  useEffect(() => {
    load()
  }, [])

  const save = async () => {
    setMsg('')
    try {
      const body: Record<string, string | number> = { llm_default_provider: provider }
      if (tongyi.trim()) body.tongyi_api_key = tongyi.trim()
      if (deepseek.trim()) body.deepseek_api_key = deepseek.trim()
      const next = await api.patchSettings(body)
      setS(next)
      setTongyi('')
      setDeepseek('')
      setMsg('已保存；后端会写入 data/settings.json 与 .env，重启后仍有效。')
    } catch (e) {
      setMsg(e instanceof Error ? e.message : '保存失败')
    }
  }

  return (
    <div className="import-page">
      <h2>设置</h2>
      <div className="card">
        <h3>模型 API Key</h3>
        <p style={{ fontSize: '0.9rem', color: 'var(--muted)' }}>
          留空表示不修改。已配置时显示脱敏：{s?.tongyi_api_key_masked || '—'} /{' '}
          {s?.deepseek_api_key_masked || '—'}
        </p>
        <p>
          <label>
            通义千问 Key{' '}
            <input
              type="password"
              style={{ width: 360 }}
              placeholder={s?.tongyi_configured ? '已配置，输入新 Key 可覆盖' : 'sk-...'}
              value={tongyi}
              onChange={(e) => setTongyi(e.target.value)}
            />
          </label>
        </p>
        <p>
          <label>
            DeepSeek Key{' '}
            <input
              type="password"
              style={{ width: 360 }}
              placeholder={s?.deepseek_configured ? '已配置' : '可选'}
              value={deepseek}
              onChange={(e) => setDeepseek(e.target.value)}
            />
          </label>
        </p>
        <p>
          <label>
            默认模型{' '}
            <select value={provider} onChange={(e) => setProvider(e.target.value)}>
              <option value="tongyi">通义千问</option>
              <option value="deepseek">DeepSeek</option>
              <option value="mock">Mock 测试</option>
            </select>
          </label>
        </p>
        <button type="button" className="btn btn-primary" onClick={save}>
          保存 Key
        </button>
        {msg && <p style={{ marginTop: 8 }}>{msg}</p>}
      </div>

      <div className="card">
        <h3>Study 数据目录（与 md-reader-app 共用）</h3>
        <ul style={{ fontSize: '0.9rem', lineHeight: 1.7 }}>
          <li>
            <strong>PDF 待导入</strong>：{s?.pdf_inbox_dir}
            <br />
            将 PDF 放入该文件夹，在「PDF 导入」页一键批量转化。
          </li>
          <li>
            <strong>错题同步导出</strong>：{s?.study_export_wrongbook}
            <br />
            练习页「同步到 Reader」会生成 <code>### 题目：</code> 格式 md。
          </li>
          <li>
            <strong>视频进度</strong>：{s?.study_video_progress_file}
            <br />
            由 video-dash 写 BV 详情；Reader「视频进度」看板读取。
          </li>
        </ul>
      </div>
    </div>
  )
}
