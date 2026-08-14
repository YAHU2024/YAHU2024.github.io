import { useEffect, useState } from 'react'
import { profile, snapshotRepos, type Repo } from '@/data/github'

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
  }
}

/** 拉取 GitHub 公开 API；失败时静默回退到 gh CLI 快照 */
export function useGitHub(): GitHubState {
  const [state, setState] = useState<GitHubState>({
    repos: snapshotRepos,
    followers: profile.followers,
    publicRepos: profile.publicRepos,
    live: false,
  })

  useEffect(() => {
    let cancelled = false
    const base = `https://api.github.com/users/${profile.login}`

    Promise.all([
      fetch(base).then((r) => (r.ok ? r.json() : Promise.reject(r.status))),
      fetch(`${base}/repos?per_page=100&sort=updated`).then((r) =>
        r.ok ? r.json() : Promise.reject(r.status),
      ),
    ])
      .then(([user, repos]: [ { followers: number; public_repos: number }, ApiRepo[] ]) => {
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

    return () => {
      cancelled = true
    }
  }, [])

  return state
}
