import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcrypt'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  // ============================================================
  // 1. 기본 관리자 사용자
  // ============================================================
  const adminPassword = await bcrypt.hash('admin', 10)
  await prisma.user.upsert({
    where: { email: 'admin' },
    update: {},
    create: {
      email: 'admin',
      passwordHash: adminPassword,
      name: '관리자',
      role: 'ADMIN',
    },
  })
  console.log('  ✓ Admin user')

  // ============================================================
  // 2. 도메인 계층 구조 (범용)
  //    ROOT (루트) → GENERAL, ADMIN, TECH (하위)
  // ============================================================
  const domains = [
    {
      code: 'ROOT',
      displayName: '문서관리',
      parentCode: null,
      description: '최상위 도메인',
      requiredFacets: [] as string[],
      ssotKey: [] as string[],
      sortOrder: 0,
    },
    {
      code: 'GENERAL',
      displayName: '일반',
      parentCode: 'ROOT',
      description: '일반 업무 문서',
      requiredFacets: ['docType'],
      ssotKey: ['docType'],
      sortOrder: 1,
    },
    {
      code: 'ADMIN',
      displayName: '경영/관리',
      parentCode: 'ROOT',
      description: '경영, 인사, 총무 문서',
      requiredFacets: ['docType'],
      ssotKey: ['docType'],
      sortOrder: 2,
    },
    {
      code: 'TECH',
      displayName: '기술',
      parentCode: 'ROOT',
      description: '기술, 개발, 운영 문서',
      requiredFacets: ['docType'],
      ssotKey: ['docType'],
      sortOrder: 3,
    },
  ]

  for (const d of domains) {
    await prisma.domainMaster.upsert({
      where: { code: d.code },
      update: {
        displayName: d.displayName,
        parentCode: d.parentCode,
        description: d.description,
        requiredFacets: d.requiredFacets,
        ssotKey: d.ssotKey,
        sortOrder: d.sortOrder,
      },
      create: d,
    })
  }
  console.log('  ✓ Domains (ROOT + 3 children)')

  // ============================================================
  // 3. Facet 유형 마스터 — docType만 시스템 코어
  //    carrier, product 등은 관리자가 필요 시 추가
  // ============================================================
  const facetTypes = [
    { code: 'docType', displayName: '문서유형', codePrefix: 'T', description: '문서 종류 분류', sortOrder: 1, isSystem: true },
  ]

  for (const ft of facetTypes) {
    await prisma.facetTypeMaster.upsert({
      where: { code: ft.code },
      update: {
        displayName: ft.displayName,
        codePrefix: ft.codePrefix,
        description: ft.description,
        sortOrder: ft.sortOrder,
        isSystem: ft.isSystem,
      },
      create: ft,
    })
  }
  console.log('  ✓ Facet types (docType — system)')

  // ============================================================
  // 4. Facet 마스터 — 범용 문서유형 (docType)
  // ============================================================
  const facets = [
    { facetType: 'docType', code: 'DOC-CONTRACT', displayName: '계약서', tier: 'COLD', sortOrder: 1 },
    { facetType: 'docType', code: 'DOC-PROPOSAL', displayName: '제안서', tier: 'WARM', sortOrder: 2 },
    { facetType: 'docType', code: 'DOC-PRICE', displayName: '가격표', tier: 'HOT', sortOrder: 3 },
    { facetType: 'docType', code: 'DOC-GUIDE', displayName: '안내서', tier: 'WARM', sortOrder: 4 },
    { facetType: 'docType', code: 'DOC-COMPARE', displayName: '비교분석', tier: 'WARM', sortOrder: 5 },
    { facetType: 'docType', code: 'DOC-SETTLE', displayName: '정산서', tier: 'HOT', sortOrder: 6 },
    { facetType: 'docType', code: 'DOC-REPORT', displayName: '보고서', tier: 'HOT', sortOrder: 7 },
    { facetType: 'docType', code: 'DOC-FORM', displayName: '신청서', tier: 'COLD', sortOrder: 8 },
    { facetType: 'docType', code: 'DOC-NOTICE', displayName: '공문/안내', tier: 'HOT', sortOrder: 9 },
    { facetType: 'docType', code: 'DOC-RULE', displayName: '규정집', tier: 'COLD', sortOrder: 10 },
    { facetType: 'docType', code: 'DOC-TRAINING', displayName: '교육자료', tier: 'COLD', sortOrder: 11 },
    { facetType: 'docType', code: 'DOC-FAQ', displayName: 'FAQ', tier: 'WARM', sortOrder: 12 },
  ]

  for (const f of facets) {
    await prisma.facetMaster.upsert({
      where: { facetType_code: { facetType: f.facetType, code: f.code } },
      update: {
        displayName: f.displayName,
        tier: f.tier ?? null,
        sortOrder: f.sortOrder,
      },
      create: {
        facetType: f.facetType,
        code: f.code,
        displayName: f.displayName,
        tier: f.tier ?? null,
        sortOrder: f.sortOrder,
      },
    })
  }
  console.log('  ✓ Facet masters (docType: 12)')

  console.log('\nSeeding complete!')
  console.log('  도메인 구조: ROOT → GENERAL / ADMIN / TECH')
  console.log('  추가 분류 유형(부서, 지역 등)은 관리자 UI에서 생성하세요.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
