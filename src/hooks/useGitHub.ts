import { useEffect, useState } from 'react'
import { profile, snapshot, snapshotRepos, type Repo } from '@/data/github'

interface GitHubState {
  repos: Repo[]
  followers: number
  publicRepos: number
  /** true = 数据来自实时 GitHub API；false = 离线快照兜底 */
  live: boolean
}

interface ApiRepo {
  name: string
  description: string | null
  language: string | null
  stargazers_count: number
  forks_count: number
  html_url: string
  updated_at: string
  topics: string[]
  fork: boolean
  homepage: string | null
}

function mapRepo(r: ApiRepo): Repo {
  return {
    name: r.name,
    description: r.description,
    language: r.language,
    stars: r.stargazers_count,
    forks: r.forks_count,
    url: r.html_url,
    updatedAt: r.updated_at?.slice(0, 10) ?? null,
    topics: r.topics ?? [],
    homepage: r.homepage ?? null,
  }
}

/** 快照超过该时长（48h）视为过期。CI 每天 22:17 重建并刷新快照，正常情况恒新鲜 */
const SNAPSHOT_STALE_MS = 48 * 60 * 60 * 1000
/** 实时兜底请求的超时时间 */
const FETCH_TIMEOUT_MS = 5000

function snapshotIsFresh(): boolean {
  const t = Date.parse(snapshot.fetchedAt)
  return Number.isFinite(t) && Date.now() - t < SNAPSHOT_STALE_MS
}

/**
 * 站点统计与仓库列表的数据源（Footer「实时 / 离线快照」指示灯同一套语义）。
 *
 * 快照由 CI 每日刷新，因此默认直接展示快照、不对 GitHub 发任何请求——
 * 匿名 API 按出口 IP 限流 60/h，访客侧几乎必然失败，为每个访客发两个必败请求纯属浪费。
 * 仅当快照过期（例如 CI 停摆超过 48h）时，才在浏览器空闲时兜底拉取一次实时数据：
 * 延迟到空闲发起（不抢首屏）+ AbortController 超时中止，失败仍静默回退快照。
 */
export function useGitHub(): GitHubState {
  const [state, setState] = useState<GitHubState>({
    repos: snapshotRepos,
    followers: snapshot.user.followers,
    publicRepos: snapshot.user.public_repos,
    live: false,
  })

  useEffect(() => {
    if (snapshotIsFresh()) return

    let cancelled = false
    const ctrl = new AbortController()
    const base = `https://api.github.com/users/${profile.login}`
    const timeoutId = window.setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS)

    const fetchLive = () => {
      Promise.all([
        fetch(base, { signal: ctrl.signal }).then((r) => (r.ok ? r.json() : Promise.reject(r.status))),
        fetch(`${base}/repos?per_page=100&sort=updated`, { signal: ctrl.signal }).then((r) =>
          r.ok ? r.json() : Promise.reject(r.status),
        ),
      ])
        .then(([user, repos]: [{ followers: number; public_repos: number }, ApiRepo[]]) => {
          if (cancelled) return
          const own = repos.filter((r) => !r.fork).map(mapRepo)
          setState({
            repos: own.length > 0 ? own : snapshotRepos,
            followers: user.followers,
            publicRepos: user.public_repos,
            live: true,
          })
        })
        .catch(() => {
          /* 保持快照数据 */
        })
        .finally(() => window.clearTimeout(timeoutId))
    }

    // 浏览器空闲时再发起，避免与首屏渲染抢带宽；requestIdleCallback 缺失时降级为延时
    const hasIdle = typeof window.requestIdleCallback === 'function'
    const idleId = hasIdle
      ? window.requestIdleCallback(fetchLive, { timeout: 4000 })
      : window.setTimeout(fetchLive, 2500)

    return () => {
      cancelled = true
      ctrl.abort()
      window.clearTimeout(timeoutId)
      if (hasIdle) window.cancelIdleCallback(idleId)
      else window.clearTimeout(idleId)
    }
  }, [])

  return state
}
