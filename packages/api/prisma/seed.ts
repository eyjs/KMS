import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcrypt'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  // 기본 관리자 사용자
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
  console.log('  도메인/분류 데이터는 관리자 UI에서 직접 생성하세요.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
