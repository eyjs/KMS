import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcrypt'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  // ============================================================
  // 관리자 계정 (유일한 시드 데이터)
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
  console.log('  ✓ Admin user (admin / admin)')

  // ============================================================
  // 온톨로지: 관계 유형 마스터 (ADR-016)
  // ============================================================
  const relationTypes = [
    {
      code: 'PARENT_OF',
      label: 'Parent Of',
      labelKo: '상위 문서',
      inverseCode: 'CHILD_OF',
      isBidirectional: false,
      requiresDomain: true,
      description: '계층 구조에서 상위 문서를 나타냅니다. (예: 약관 → 상품요약서)',
      sortOrder: 1,
    },
    {
      code: 'CHILD_OF',
      label: 'Child Of',
      labelKo: '하위 문서',
      inverseCode: 'PARENT_OF',
      isBidirectional: false,
      requiresDomain: true,
      description: '계층 구조에서 하위 문서를 나타냅니다.',
      sortOrder: 2,
    },
    {
      code: 'SIBLING',
      label: 'Sibling',
      labelKo: '형제 문서',
      inverseCode: null,
      isBidirectional: true,
      requiresDomain: true,
      description: '같은 레벨의 관련 문서입니다. (예: 유사 상품)',
      sortOrder: 3,
    },
    {
      code: 'REFERENCE',
      label: 'References',
      labelKo: '참조 문서',
      inverseCode: 'REFERENCED_BY',
      isBidirectional: false,
      requiresDomain: true,
      description: '다른 문서를 참조합니다. (예: 법규, 가이드라인)',
      sortOrder: 4,
    },
    {
      code: 'REFERENCED_BY',
      label: 'Referenced By',
      labelKo: '피참조 문서',
      inverseCode: 'REFERENCE',
      isBidirectional: false,
      requiresDomain: true,
      description: '다른 문서에 의해 참조됩니다.',
      sortOrder: 5,
    },
    {
      code: 'SUPERSEDES',
      label: 'Supersedes',
      labelKo: '대체 문서',
      inverseCode: 'SUPERSEDED_BY',
      isBidirectional: false,
      requiresDomain: false,
      description: '이전 버전을 대체합니다.',
      sortOrder: 6,
    },
    {
      code: 'SUPERSEDED_BY',
      label: 'Superseded By',
      labelKo: '피대체 문서',
      inverseCode: 'SUPERSEDES',
      isBidirectional: false,
      requiresDomain: false,
      description: '새 버전에 의해 대체되었습니다.',
      sortOrder: 7,
    },
  ]

  // 1단계: inverseCode 없이 먼저 삽입
  for (const rt of relationTypes) {
    const { inverseCode, ...rest } = rt
    await prisma.relationTypeMaster.upsert({
      where: { code: rt.code },
      update: rest,
      create: rest,
    })
  }
  // 2단계: inverseCode 업데이트
  for (const rt of relationTypes) {
    if (rt.inverseCode) {
      await prisma.relationTypeMaster.update({
        where: { code: rt.code },
        data: { inverseCode: rt.inverseCode },
      })
    }
  }
  console.log('  ✓ Relation type master (7 types)')

  // 도메인, facet, 분류 유형 등은 시드하지 않음
  // → ADR-013: 프레임워크 전환 — 사용자가 직접 구성
  console.log('\nSeeding complete!')
  console.log('  도메인/카테고리는 관리자 UI에서 직접 생성하세요.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
