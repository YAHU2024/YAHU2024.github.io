// 构建时抓取 GitHub 公开数据，刷新 src/data/snapshot.json
// 本地运行：node scripts/fetch-github.mjs        （匿名限额 60 次/小时）
// CI 运行： GITHUB_TOKEN=xxx node scripts/fetch-github.mjs（限额 1000+ 次/小时）
// 任一请求失败时保留旧值，绝不阻塞构建。
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const LOGIN = process.env.GH_LOGIN || 'YAHU2024'
const TOKEN = process.env.GITHUB_TOKEN || ''
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'src', 'data', 'snapshot.json')

const api = (pathName) =>
  fetch(`https://api.github.com${pathName}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
    },
  }).then((r) => {
    if (!r.ok) throw new Error(`${pathName} -> HTTP ${r.status}`)
    return r.json()
  })

async function main() {
  let prev = {
    fetchedAt: new Date().toISOString().slice(0, 10),
    contributionsLastYear: 0,
    user: { followers: 0, public_repos: 0 },
    repos: [],
  }
  try {
    prev = { ...prev, ...JSON.parse(await readFile(OUT, 'utf8')) }
  } catch {
    // 没有旧快照，继续
  }

  const next = { ...prev }

  try {
    const user = await api(`/users/${LOGIN}`)
    next.user = { followers: user.followers, public_repos: user.public_repos }
    console.log(`[github] user ok: ${user.public_repos} repos / ${user.followers} followers`)
  } catch (e) {
    console.warn(`[github] user 抓取失败，沿用旧值：${e.message}`)
  }

  try {
    const repos = await api(`/users/${LOGIN}/repos?per_page=100&sort=updated`)
    next.repos = repos.map((r) => ({
      name: r.name,
      description: r.description,
      language: r.language,
      stargazers_count: r.stargazers_count,
      forks_count: r.forks_count,
      html_url: r.html_url,
      updated_at: r.updated_at,
      topics: r.topics ?? [],
      fork: r.fork,
      homepage: r.homepage ?? null,
    }))
    console.log(`[github] repos ok: ${next.repos.length} 个`)
  } catch (e) {
    console.warn(`[github] repos 抓取失败，沿用旧值：${e.message}`)
  }

  if (TOKEN) {
    try {
      const res = await fetch('https://api.github.com/graphql', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: `query($login: String!) {
            user(login: $login) {
              contributionsCollection {
                contributionCalendar { totalContributions }
              }
            }
          }`,
          variables: { login: LOGIN },
        }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      const total = json?.data?.user?.contributionsCollection?.contributionCalendar?.totalContributions
      if (typeof total !== 'number') throw new Error('GraphQL 返回异常')
      next.contributionsLastYear = total
      console.log(`[github] contributions ok: ${total}`)
    } catch (e) {
      console.warn(`[github] 贡献数抓取失败，沿用旧值：${e.message}`)
    }
  } else {
    console.warn('[github] 无 GITHUB_TOKEN，跳过贡献数（GraphQL 需要 token）')
  }

  next.fetchedAt = new Date().toISOString().slice(0, 10)
  await writeFile(OUT, JSON.stringify(next, null, 2) + '\n', 'utf8')
  console.log(`[github] snapshot.json 已更新（${next.fetchedAt}）`)
}

main().catch((e) => {
  console.warn(`[github] 意外错误，保留旧快照：${e.message}`)
})
