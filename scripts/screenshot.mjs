import { chromium } from 'playwright'

const BASE = process.argv[2] || 'https://kms-gilt-kappa.vercel.app'
const OUT = 'C:/Users/USER/dev/지식체계프로젝트/screenshots'

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage()

// 로그인
console.log(`[1/8] 로그인 (${BASE})...`)
await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 })
await page.waitForTimeout(1000)

const loginCard = page.locator('.el-card:has-text("KMS")')
if (await loginCard.count() > 0) {
  const inputs = page.locator('.el-input__inner')
  await inputs.nth(0).fill('admin')
  await inputs.nth(1).fill('admin')
  await page.click('button:has-text("로그인")')
  await page.waitForTimeout(3000)
}

// 1. 대시보드
console.log('[2/8] 대시보드...')
await page.waitForTimeout(1000)
await page.screenshot({ path: `${OUT}/01-dashboard.png`, fullPage: false })

// 2. 도메인 워크스페이스 (URL 직접 이동)
console.log('[3/8] 도메인 워크스페이스 (SALES)...')
await page.goto(`${BASE}/d/SALES`, { waitUntil: 'networkidle', timeout: 15000 })
await page.waitForTimeout(2000)
await page.screenshot({ path: `${OUT}/02-workspace.png`, fullPage: false })

// 3. 업로드 다이얼로그
console.log('[4/8] 업로드 다이얼로그...')
const uploadBtn = page.locator('button:has-text("문서 추가"), button:has-text("업로드")')
if (await uploadBtn.count() > 0) {
  await uploadBtn.first().click()
  await page.waitForTimeout(1000)
  await page.screenshot({ path: `${OUT}/03-upload-dialog.png`, fullPage: false })
  // 다이얼로그 닫기
  const closeBtn = page.locator('.el-dialog__headerbtn')
  if (await closeBtn.count() > 0) await closeBtn.click()
  await page.waitForTimeout(500)
}

// 4. 통합 검색
console.log('[5/8] 통합 검색...')
await page.goto(`${BASE}/search`, { waitUntil: 'networkidle', timeout: 15000 })
await page.waitForTimeout(1000)
await page.screenshot({ path: `${OUT}/04-search.png`, fullPage: false })

// 5. 도메인 관리
console.log('[6/8] 도메인 관리...')
await page.goto(`${BASE}/admin/domains`, { waitUntil: 'networkidle', timeout: 15000 })
await page.waitForTimeout(1500)
await page.screenshot({ path: `${OUT}/05-admin-domains.png`, fullPage: false })

// 6. 도메인 관리 - 도메인 선택 (SALES 클릭)
console.log('[7/8] 도메인 관리 - SALES 선택...')
const salesRow = page.locator('tr:has-text("SALES")')
if (await salesRow.count() > 0) {
  await salesRow.click()
  await page.waitForTimeout(1000)
  await page.screenshot({ path: `${OUT}/06-admin-domain-detail.png`, fullPage: false })
}

// 7. 사용자 관리
console.log('[8/8] 사용자 관리...')
await page.goto(`${BASE}/admin/users`, { waitUntil: 'networkidle', timeout: 15000 })
await page.waitForTimeout(1000)
await page.screenshot({ path: `${OUT}/07-admin-users.png`, fullPage: false })

await browser.close()
console.log(`\n완료! 스크린샷 저장: ${OUT}/`)
