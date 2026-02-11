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
