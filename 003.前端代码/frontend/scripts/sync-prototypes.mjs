/**
 * 同步「002.产品UI原型/1比1原型图」与前端实现。
 *
 * 原型目录不再是独立设计的静态稿，而是**实现的静态快照**：
 * 每个入口页 = dist/index.html + 一个预设的 hash 路由跳转，
 * 共用同一份构建产物，保证原型与实现视觉始终一致。
 *
 * 用法：
 *   npm run sync:prototypes      # 构建 + 同步
 *
 * 只维护 7 个页面（登录 / AI 建档 / 档案确认 / 计划总览 /
 * 今日训练 / GPS 训练执行 / 我的），其余实现页面不在原型目录中单独出图，
 * 可在应用内通过导航到达。
 */
import { readFile, writeFile, rm, cp, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'

const here = dirname(fileURLToPath(import.meta.url))
const frontendDir = resolve(here, '..')
const distDir = resolve(frontendDir, 'dist')
const targetDir = resolve(frontendDir, '../../002.产品UI原型/1比1原型图')

/** 原型目录维护的 7 个页面 */
const ROUTES = [
  { file: '01-登录页.html', hash: '#/login', title: '登录' },
  { file: '02-AI建档页.html', hash: '#/profile', title: 'AI 建档' },
  { file: '03-档案确认页.html', hash: '#/profile/confirm', title: '档案确认' },
  { file: '04-计划总览页.html', hash: '#/plan', title: '计划总览' },
  { file: '05-今日训练页.html', hash: '#/run/prep', title: '今日训练' },
  { file: '06-GPS训练执行页.html', hash: '#/run/live', title: 'GPS 训练执行' },
  { file: '07-我的页.html', hash: '#/me', title: '我的' },
]

async function main() {
  console.log('▶ 构建前端…')
  await build({ root: frontendDir, logLevel: 'warn' })

  const entryPath = resolve(distDir, 'index.html')
  if (!existsSync(entryPath)) {
    throw new Error('构建产物缺失：dist/index.html')
  }
  const distHtml = await readFile(entryPath, 'utf-8')

  // 去掉构建产物里的「源码入口自动跳转」脚本（原型页不需要，且会指向不存在的 ./dist）
  const template = distHtml.replace(
    /<script(?![^>]*\bsrc=)(?![^>]*\btype=)[^>]*>[\s\S]*?<\/script>/g,
    '',
  )

  console.log('▶ 同步构建产物到原型目录…')
  const assetsTarget = resolve(targetDir, 'assets')
  await rm(assetsTarget, { recursive: true, force: true })
  await mkdir(targetDir, { recursive: true })
  await cp(resolve(distDir, 'assets'), assetsTarget, { recursive: true })

  console.log('▶ 生成 7 个原型入口页…')
  for (const route of ROUTES) {
    const html = template.replace(
      '</body>',
      `    <script>window.location.hash = '${route.hash}'</script>\n  </body>`,
    )
    await writeFile(resolve(targetDir, route.file), html, 'utf-8')
    console.log(`   ✓ ${route.file.padEnd(22)} → ${route.hash}`)
  }

  console.log(`\n✔ 原型目录已同步：${targetDir}`)
}

main().catch((err) => {
  console.error('✖ 同步失败：', err.message)
  process.exit(1)
})
