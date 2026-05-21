import { NavLink, Route, Routes } from 'react-router-dom'
import { ImportPage } from './pages/ImportPage'
import { PracticePage } from './pages/PracticePage'
import { SettingsPage } from './pages/SettingsPage'

export default function App() {
  return (
    <>
      <header className="app-header">
        <h1>Drillly 做题本</h1>
        <nav>
          <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')}>
            练习
          </NavLink>
          <NavLink to="/import" className={({ isActive }) => (isActive ? 'active' : '')}>
            PDF 导入
          </NavLink>
          <NavLink to="/settings" className={({ isActive }) => (isActive ? 'active' : '')}>
            设置
          </NavLink>
        </nav>
        <span style={{ marginLeft: 'auto', fontSize: '0.85rem', color: 'var(--muted)' }}>
          Study 工作台 · API :5213
        </span>
      </header>
      <Routes>
        <Route path="/" element={<PracticePage />} />
        <Route path="/import" element={<ImportPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
    </>
  )
}
