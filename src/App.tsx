import { Routes, Route } from 'react-router'
import Home from './pages/Home'
import BackToTop from './components/BackToTop'

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<Home />} />
      </Routes>
      {/* 全局：右下角一键回顶小猫徽章 */}
      <BackToTop />
    </>
  )
}
