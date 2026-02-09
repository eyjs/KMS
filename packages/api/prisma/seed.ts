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
  // 2. 도메인 계층 구조
  //    GA (루트) → SALES, COMM, CONTRACT, COMP, EDU (하위)
  // ============================================================
  const domains = [
    {
      code: 'GA',
      displayName: 'GA 보험영업',
      parentCode: null,
      description: 'GA(보험대리점) 보험영업 전체 도메인',
      requiredFacets: [],
      ssotKey: [],
      sortOrder: 0,
    },
    {
      code: 'SALES',
      displayName: '영업/상담',
      parentCode: 'GA',
      description: '상품 판매, 고객 상담, 청약 관련 문서',
      requiredFacets: ['carrier', 'product', 'docType'],
      ssotKey: ['carrier', 'product', 'docType'],
      sortOrder: 1,
    },
    {
      code: 'COMM',
      displayName: '수수료/정산',
      parentCode: 'GA',
      description: '수수료 체계, 시책, 정산, 실적 관련 문서',
      requiredFacets: ['carrier', 'product', 'docType'],
      ssotKey: ['carrier', 'product', 'docType'],
      sortOrder: 2,
    },
    {
      code: 'CONTRACT',
      displayName: '계약관리',
      parentCode: 'GA',
      description: '청약서, 고지사항, 확인서 등 계약 문서',
      requiredFacets: ['carrier', 'product', 'docType'],
      ssotKey: ['carrier', 'product', 'docType'],
      sortOrder: 3,
    },
    {
      code: 'COMP',
      displayName: '컴플라이언스',
      parentCode: 'GA',
      description: '법률, 규정, 컴플라이언스 가이드',
      requiredFacets: ['carrier', 'docType'],
      ssotKey: ['carrier', 'docType'],
      sortOrder: 4,
    },
    {
      code: 'EDU',
      displayName: '교육/역량',
      parentCode: 'GA',
      description: '교육자료, 신입교육, 자격증 관련 문서',
      requiredFacets: ['docType'],
      ssotKey: ['docType'],
      sortOrder: 5,
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
  console.log('  ✓ Domains (GA + 5 children)')

  // ============================================================
  // 3. Facet 마스터 — 대표 샘플 데이터
  // ============================================================
  const facets = [
    // ── 보험사 (carrier) ──
    { facetType: 'carrier', code: 'INS-SAMSUNG', displayName: '삼성생명', tier: 'HOT', sortOrder: 1 },
    { facetType: 'carrier', code: 'INS-HANWHA', displayName: '한화생명', tier: 'HOT', sortOrder: 2 },
    { facetType: 'carrier', code: 'INS-KYOBO', displayName: '교보생명', tier: 'HOT', sortOrder: 3 },
    { facetType: 'carrier', code: 'INS-SHINHAN', displayName: '신한라이프', tier: 'HOT', sortOrder: 4 },
    { facetType: 'carrier', code: 'INS-SAMSUNGF', displayName: '삼성화재', tier: 'HOT', sortOrder: 5 },
    { facetType: 'carrier', code: 'INS-HYUNDAI', displayName: '현대해상', tier: 'HOT', sortOrder: 6 },
    { facetType: 'carrier', code: 'INS-DB', displayName: 'DB손해보험', tier: 'HOT', sortOrder: 7 },
    { facetType: 'carrier', code: 'INS-KB', displayName: 'KB손해보험', tier: 'HOT', sortOrder: 8 },
    { facetType: 'carrier', code: 'INS-MERITZ', displayName: '메리츠화재', tier: 'HOT', sortOrder: 9 },
    { facetType: 'carrier', code: 'INS-COMMON', displayName: '공통', tier: null, sortOrder: 99 },

    // ── 상품 (product) ──
    { facetType: 'product', code: 'PRD-LIFE-WHOLE', displayName: '종신보험', tier: null, sortOrder: 1 },
    { facetType: 'product', code: 'PRD-LIFE-TERM', displayName: '정기보험', tier: null, sortOrder: 2 },
    { facetType: 'product', code: 'PRD-LIFE-VARIABLE', displayName: '변액보험', tier: null, sortOrder: 3 },
    { facetType: 'product', code: 'PRD-HEALTH-CI', displayName: 'CI보험', tier: null, sortOrder: 4 },
    { facetType: 'product', code: 'PRD-HEALTH-CANCER', displayName: '암보험', tier: null, sortOrder: 5 },
    { facetType: 'product', code: 'PRD-HEALTH-MEDICAL', displayName: '실손의료보험', tier: null, sortOrder: 6 },
    { facetType: 'product', code: 'PRD-NONLIFE-AUTO', displayName: '자동차보험', tier: null, sortOrder: 7 },
    { facetType: 'product', code: 'PRD-ANNUITY-TAX', displayName: '세제적격연금', tier: null, sortOrder: 8 },
    { facetType: 'product', code: 'PRD-COMMON', displayName: '공통', tier: null, sortOrder: 99 },

    // ── 문서유형 (docType) — 영업/상담 ──
    { facetType: 'docType', code: 'DOC-TERMS', displayName: '보통약관', tier: 'COLD', maxAgeDays: 3650, sortOrder: 1 },
    { facetType: 'docType', code: 'DOC-GUIDE', displayName: '상품설명서', tier: 'WARM', sortOrder: 2 },
    { facetType: 'docType', code: 'DOC-RATE-TABLE', displayName: '보험료표', tier: 'HOT', sortOrder: 3 },
    { facetType: 'docType', code: 'DOC-BROCHURE', displayName: '브로슈어', tier: 'WARM', sortOrder: 4 },
    { facetType: 'docType', code: 'DOC-SCRIPT', displayName: '판매스크립트', tier: 'WARM', sortOrder: 5 },
    { facetType: 'docType', code: 'DOC-COMPARISON', displayName: '상품비교표', tier: 'WARM', sortOrder: 6 },

    // ── 문서유형 — 수수료/정산 ──
    { facetType: 'docType', code: 'DOC-INCENTIVE', displayName: '시책', tier: 'HOT', maxAgeDays: 14, sortOrder: 10 },
    { facetType: 'docType', code: 'DOC-COMMISSION', displayName: '수수료체계', tier: 'HOT', maxAgeDays: 30, sortOrder: 11 },
    { facetType: 'docType', code: 'DOC-SETTLEMENT', displayName: '정산자료', tier: 'HOT', sortOrder: 12 },
    { facetType: 'docType', code: 'DOC-PERFORMANCE', displayName: '실적보고서', tier: 'HOT', sortOrder: 13 },

    // ── 문서유형 — 계약관리 ──
    { facetType: 'docType', code: 'DOC-APPLICATION', displayName: '청약서', tier: 'COLD', sortOrder: 20 },
    { facetType: 'docType', code: 'DOC-DISCLOSURE', displayName: '고지사항', tier: 'COLD', sortOrder: 21 },

    // ── 문서유형 — 컴플라이언스 ──
    { facetType: 'docType', code: 'DOC-COMPLIANCE-GUIDE', displayName: '컴플라이언스가이드', tier: 'WARM', sortOrder: 30 },
    { facetType: 'docType', code: 'DOC-REGULATION', displayName: '감독규정', tier: 'COLD', sortOrder: 31 },

    // ── 문서유형 — 교육 ──
    { facetType: 'docType', code: 'DOC-TRAINING', displayName: '교육자료', tier: 'COLD', sortOrder: 40 },
    { facetType: 'docType', code: 'DOC-ONBOARDING', displayName: '신입교육', tier: 'COLD', sortOrder: 41 },

    // ── 문서유형 — 공통 ──
    { facetType: 'docType', code: 'DOC-NOTICE', displayName: '공문', tier: 'HOT', sortOrder: 50 },
    { facetType: 'docType', code: 'DOC-FAQ', displayName: '자주묻는질문', tier: 'WARM', sortOrder: 51 },
  ]

  for (const f of facets) {
    await prisma.facetMaster.upsert({
      where: { facetType_code: { facetType: f.facetType, code: f.code } },
      update: {
        displayName: f.displayName,
        tier: f.tier ?? null,
        maxAgeDays: 'maxAgeDays' in f ? (f as { maxAgeDays: number }).maxAgeDays : null,
        sortOrder: f.sortOrder,
      },
      create: {
        facetType: f.facetType,
        code: f.code,
        displayName: f.displayName,
        tier: f.tier ?? null,
        maxAgeDays: 'maxAgeDays' in f ? (f as { maxAgeDays: number }).maxAgeDays : null,
        sortOrder: f.sortOrder,
      },
    })
  }
  console.log('  ✓ Facet masters (carrier: 10, product: 9, docType: 18)')

  console.log('\nSeeding complete!')
  console.log('  도메인 구조: GA → SALES / COMM / CONTRACT / COMP / EDU')
  console.log('  추가 보험사/상품/문서유형은 관리자 UI에서 생성하세요.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
