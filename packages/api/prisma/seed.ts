import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcrypt'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  // 1. 도메인 마스터
  const domains = [
    { code: 'GA-SALES', displayName: 'GA 영업지원', requiredFacets: ['carrier', 'product', 'docType'], ssotKey: ['carrier', 'product', 'docType'] },
    { code: 'GA-COMM', displayName: 'GA 수수료', requiredFacets: ['carrier', 'product', 'docType'], ssotKey: ['carrier', 'product', 'docType'] },
    { code: 'GA-CONTRACT', displayName: 'GA 계약관리', requiredFacets: ['carrier', 'product', 'docType'], ssotKey: ['carrier', 'product', 'docType'] },
    { code: 'GA-COMP', displayName: 'GA 보상', requiredFacets: ['carrier', 'product', 'docType'], ssotKey: ['carrier', 'product', 'docType'] },
    { code: 'GA-EDU', displayName: 'GA 교육', requiredFacets: ['carrier', 'product', 'docType'], ssotKey: ['carrier', 'product', 'docType'] },
    { code: 'COMMON-COMP', displayName: '공통 규정', requiredFacets: ['docType'], ssotKey: ['docType'] },
  ]

  for (const d of domains) {
    await prisma.domainMaster.upsert({
      where: { code: d.code },
      update: {},
      create: d,
    })
  }
  console.log(`  ${domains.length} domains seeded`)

  // 2. 분류 마스터 — 보험사
  const carriers = [
    { code: 'INS-SAMSUNG', displayName: '삼성화재' },
    { code: 'INS-HANWHA', displayName: '한화생명' },
    { code: 'INS-KB', displayName: 'KB손해보험' },
    { code: 'INS-KYOBO', displayName: '교보생명' },
    { code: 'INS-DONGBU', displayName: 'DB손해보험' },
    { code: 'INS-HYUNDAI', displayName: '현대해상' },
    { code: 'INS-MERITZ', displayName: '메리츠화재' },
    { code: 'INS-SHINHAN', displayName: '신한라이프' },
  ]

  for (const c of carriers) {
    await prisma.facetMaster.upsert({
      where: { facetType_code: { facetType: 'carrier', code: c.code } },
      update: {},
      create: { facetType: 'carrier', ...c },
    })
  }
  console.log(`  ${carriers.length} carriers seeded`)

  // 3. 분류 마스터 — 상품 (예시)
  const products = [
    { code: 'PROD-LIFE', displayName: '종신보험' },
    { code: 'PROD-HEALTH', displayName: '건강보험' },
    { code: 'PROD-AUTO', displayName: '자동차보험' },
    { code: 'PROD-FIRE', displayName: '화재보험' },
    { code: 'PROD-PENSION', displayName: '연금보험' },
    { code: 'PROD-CHILD', displayName: '어린이보험' },
    { code: 'PROD-DRIVER', displayName: '운전자보험' },
    { code: 'PROD-TRAVEL', displayName: '여행자보험' },
  ]

  for (const p of products) {
    await prisma.facetMaster.upsert({
      where: { facetType_code: { facetType: 'product', code: p.code } },
      update: {},
      create: { facetType: 'product', ...p },
    })
  }
  console.log(`  ${products.length} products seeded`)

  // 4. 분류 마스터 — 문서유형 (tier + maxAgeDays 포함)
  const docTypes = [
    { code: 'DOC-INCENTIVE', displayName: '시책', tier: 'HOT', maxAgeDays: 30 },
    { code: 'DOC-COMMISSION', displayName: '수수료표', tier: 'HOT', maxAgeDays: 30 },
    { code: 'DOC-RATE', displayName: '요율표', tier: 'HOT', maxAgeDays: 30 },
    { code: 'DOC-SUMMARY', displayName: '상품요약본', tier: 'WARM', maxAgeDays: 90 },
    { code: 'DOC-SCRIPT', displayName: '판매스크립트', tier: 'WARM', maxAgeDays: 90 },
    { code: 'DOC-GUIDE', displayName: '상품설명서', tier: 'WARM', maxAgeDays: 90 },
    { code: 'DOC-COMPARE', displayName: '상품비교표', tier: 'WARM', maxAgeDays: 90 },
    { code: 'DOC-UW', displayName: '언더라이팅가이드', tier: 'WARM', maxAgeDays: 90 },
    { code: 'DOC-TERMS', displayName: '약관', tier: 'COLD', maxAgeDays: 365 },
    { code: 'DOC-TRAINING', displayName: '교육자료', tier: 'COLD', maxAgeDays: 365 },
    { code: 'DOC-REGULATION', displayName: '사내규정', tier: 'COLD', maxAgeDays: 365 },
    { code: 'DOC-COMPLIANCE', displayName: '컴플라이언스', tier: 'COLD', maxAgeDays: 365 },
    { code: 'DOC-CONTRACT', displayName: '계약관리매뉴얼', tier: 'WARM', maxAgeDays: 90 },
    { code: 'DOC-CLAIM', displayName: '보상매뉴얼', tier: 'WARM', maxAgeDays: 90 },
  ]

  for (const dt of docTypes) {
    await prisma.facetMaster.upsert({
      where: { facetType_code: { facetType: 'docType', code: dt.code } },
      update: {},
      create: { facetType: 'docType', ...dt },
    })
  }
  console.log(`  ${docTypes.length} doc types seeded`)

  // 5. 기본 관리자 사용자
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
  console.log('  Admin user seeded')

  console.log('Seeding complete!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
