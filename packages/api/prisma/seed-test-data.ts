import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcrypt'
import * as crypto from 'crypto'

const prisma = new PrismaClient()

// ============================================================
// 유틸리티
// ============================================================

function fakeHash(index: number): string {
  return crypto.createHash('sha256').update(`test-${index}`).digest('hex')
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 86400000)
}

function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * 86400000)
}

// ============================================================
// 데이터 정의
// ============================================================

interface UserSeed {
  email: string
  name: string
  role: string
  password: string
}

const USERS: UserSeed[] = [
  { email: 'admin', name: '관리자', role: 'ADMIN', password: 'admin' },
  { email: 'editor1', name: '김작성', role: 'EDITOR', password: 'test123' },
  { email: 'editor2', name: '이작성', role: 'EDITOR', password: 'test123' },
  { email: 'reviewer', name: '박검토', role: 'REVIEWER', password: 'test123' },
  { email: 'approver', name: '최승인', role: 'APPROVER', password: 'test123' },
  { email: 'viewer', name: '정조회', role: 'VIEWER', password: 'test123' },
]

interface DomainSeed {
  code: string
  displayName: string
  parentCode: string | null
  description: string
  sortOrder: number
}

const DOMAINS: DomainSeed[] = [
  { code: 'GA', displayName: '총무/일반관리', parentCode: null, description: '일반 행정 및 총무 업무', sortOrder: 0 },
  { code: 'SALES', displayName: '영업', parentCode: 'GA', description: '영업 관련 문서', sortOrder: 1 },
  { code: 'COMM', displayName: '커뮤니케이션', parentCode: 'GA', description: '대내외 소통 문서', sortOrder: 2 },
  { code: 'CONTRACT', displayName: '계약관리', parentCode: 'GA', description: '계약 관련 문서', sortOrder: 3 },
  { code: 'COMP', displayName: '보상/복리', parentCode: 'GA', description: '급여 및 복리후생 문서', sortOrder: 4 },
  { code: 'EDU', displayName: '교육', parentCode: 'GA', description: '교육 관련 문서', sortOrder: 5 },
]

interface CategorySeed {
  domainCode: string
  name: string
  sortOrder: number
}

const CATEGORIES: CategorySeed[] = [
  { domainCode: 'SALES', name: '제안서', sortOrder: 0 },
  { domainCode: 'SALES', name: '고객관리', sortOrder: 1 },
  { domainCode: 'SALES', name: '실적보고', sortOrder: 2 },
  { domainCode: 'COMM', name: '공지사항', sortOrder: 0 },
  { domainCode: 'COMM', name: '보도자료', sortOrder: 1 },
  { domainCode: 'COMM', name: '내부소통', sortOrder: 2 },
  { domainCode: 'CONTRACT', name: '표준계약', sortOrder: 0 },
  { domainCode: 'CONTRACT', name: '검토완료', sortOrder: 1 },
  { domainCode: 'CONTRACT', name: '진행중', sortOrder: 2 },
  { domainCode: 'COMP', name: '급여', sortOrder: 0 },
  { domainCode: 'COMP', name: '복리후생', sortOrder: 1 },
  { domainCode: 'COMP', name: '성과평가', sortOrder: 2 },
  { domainCode: 'EDU', name: '신입교육', sortOrder: 0 },
  { domainCode: 'EDU', name: '직무교육', sortOrder: 1 },
  { domainCode: 'EDU', name: '외부교육', sortOrder: 2 },
]

interface DocSeed {
  fileName: string
  fileType: string
  lifecycle: string
  securityLevel: string
  domainCode: string | null  // null = 고아
  categoryName: string | null
  /** validUntil 날짜 오프셋 (양수=미래, 음수=과거, null=미지정) */
  validUntilDays: number | null
  /** updatedAt 오프셋 (양수=일 전) */
  updatedDaysAgo: number
  /** 다중 배치 대상 도메인 코드 */
  extraDomains?: string[]
}

// 70건 문서 정의
// 분포: DRAFT 20, ACTIVE 40, DEPRECATED 10
// 보안: PUBLIC 15, INTERNAL 35, CONFIDENTIAL 15, SECRET 5
// 고아: 10건 (domainCode=null)
// 다중배치: 8건 (extraDomains)
// stale draft: 5건 (DRAFT + updatedDaysAgo >= 35)
// WARNING freshness: 10건 (ACTIVE + validUntil 15~29일 또는 updatedDaysAgo 31~89)
// EXPIRED freshness: 5건 (ACTIVE + validUntil 과거 또는 updatedDaysAgo >= 91)

const DOCUMENTS: DocSeed[] = [
  // ===== SALES (12건) =====
  { fileName: '2026 상반기 영업전략.pdf', fileType: 'pdf', lifecycle: 'ACTIVE', securityLevel: 'INTERNAL', domainCode: 'SALES', categoryName: '제안서', validUntilDays: 180, updatedDaysAgo: 5 },
  { fileName: '거래처 목록.csv', fileType: 'csv', lifecycle: 'ACTIVE', securityLevel: 'INTERNAL', domainCode: 'SALES', categoryName: '고객관리', validUntilDays: null, updatedDaysAgo: 3 },
  { fileName: '제안서 작성 가이드.md', fileType: 'md', lifecycle: 'ACTIVE', securityLevel: 'PUBLIC', domainCode: 'SALES', categoryName: '제안서', validUntilDays: null, updatedDaysAgo: 10 },
  { fileName: '2025 하반기 실적보고.pdf', fileType: 'pdf', lifecycle: 'ACTIVE', securityLevel: 'CONFIDENTIAL', domainCode: 'SALES', categoryName: '실적보고', validUntilDays: null, updatedDaysAgo: 15, extraDomains: ['GA'] },
  { fileName: 'VIP 고객 관리 매뉴얼.pdf', fileType: 'pdf', lifecycle: 'ACTIVE', securityLevel: 'CONFIDENTIAL', domainCode: 'SALES', categoryName: '고객관리', validUntilDays: 20, updatedDaysAgo: 40 },  // WARNING (validUntil 20일 후)
  { fileName: '신규 거래처 제안서 템플릿.md', fileType: 'md', lifecycle: 'DRAFT', securityLevel: 'INTERNAL', domainCode: 'SALES', categoryName: '제안서', validUntilDays: null, updatedDaysAgo: 2 },
  { fileName: '2025 연간 영업보고서.pdf', fileType: 'pdf', lifecycle: 'DEPRECATED', securityLevel: 'INTERNAL', domainCode: 'SALES', categoryName: '실적보고', validUntilDays: null, updatedDaysAgo: 120 },
  { fileName: '2026 Q1 목표 설정.csv', fileType: 'csv', lifecycle: 'ACTIVE', securityLevel: 'INTERNAL', domainCode: 'SALES', categoryName: '실적보고', validUntilDays: null, updatedDaysAgo: 50 },  // WARNING (updatedDaysAgo 50)
  { fileName: '고객 세그먼트 분석.csv', fileType: 'csv', lifecycle: 'DRAFT', securityLevel: 'INTERNAL', domainCode: 'SALES', categoryName: '고객관리', validUntilDays: null, updatedDaysAgo: 40 },  // stale draft
  { fileName: '경쟁사 비교 분석.pdf', fileType: 'pdf', lifecycle: 'ACTIVE', securityLevel: 'CONFIDENTIAL', domainCode: 'SALES', categoryName: '제안서', validUntilDays: -5, updatedDaysAgo: 100 },  // EXPIRED (validUntil 과거)
  { fileName: '대기업 영업 전략.pdf', fileType: 'pdf', lifecycle: 'ACTIVE', securityLevel: 'SECRET', domainCode: 'SALES', categoryName: '제안서', validUntilDays: 200, updatedDaysAgo: 5, extraDomains: ['CONTRACT'] },
  { fileName: '해외 시장 진출 보고서.pdf', fileType: 'pdf', lifecycle: 'DRAFT', securityLevel: 'CONFIDENTIAL', domainCode: 'SALES', categoryName: '실적보고', validUntilDays: null, updatedDaysAgo: 1 },

  // ===== COMM (10건) =====
  { fileName: '사내 공지 템플릿.md', fileType: 'md', lifecycle: 'ACTIVE', securityLevel: 'PUBLIC', domainCode: 'COMM', categoryName: '공지사항', validUntilDays: null, updatedDaysAgo: 7 },
  { fileName: '2026 보도자료 모음.pdf', fileType: 'pdf', lifecycle: 'ACTIVE', securityLevel: 'PUBLIC', domainCode: 'COMM', categoryName: '보도자료', validUntilDays: null, updatedDaysAgo: 14 },
  { fileName: '미디어 가이드라인.md', fileType: 'md', lifecycle: 'ACTIVE', securityLevel: 'INTERNAL', domainCode: 'COMM', categoryName: '보도자료', validUntilDays: 365, updatedDaysAgo: 20, extraDomains: ['GA'] },
  { fileName: '2025 사내 뉴스레터.pdf', fileType: 'pdf', lifecycle: 'DEPRECATED', securityLevel: 'PUBLIC', domainCode: 'COMM', categoryName: '내부소통', validUntilDays: null, updatedDaysAgo: 200 },
  { fileName: '브랜드 가이드.pdf', fileType: 'pdf', lifecycle: 'ACTIVE', securityLevel: 'INTERNAL', domainCode: 'COMM', categoryName: '보도자료', validUntilDays: null, updatedDaysAgo: 25 },
  { fileName: '위기 대응 매뉴얼.pdf', fileType: 'pdf', lifecycle: 'ACTIVE', securityLevel: 'CONFIDENTIAL', domainCode: 'COMM', categoryName: '내부소통', validUntilDays: 15, updatedDaysAgo: 60 },  // WARNING (validUntil 15일 후)
  { fileName: '내부 소통 가이드.md', fileType: 'md', lifecycle: 'DRAFT', securityLevel: 'INTERNAL', domainCode: 'COMM', categoryName: '내부소통', validUntilDays: null, updatedDaysAgo: 36 },  // stale draft
  { fileName: '2026 홍보 계획.pdf', fileType: 'pdf', lifecycle: 'DRAFT', securityLevel: 'INTERNAL', domainCode: 'COMM', categoryName: '보도자료', validUntilDays: null, updatedDaysAgo: 3 },
  { fileName: 'SNS 운영 가이드.md', fileType: 'md', lifecycle: 'DEPRECATED', securityLevel: 'INTERNAL', domainCode: 'COMM', categoryName: '공지사항', validUntilDays: null, updatedDaysAgo: 140 },
  { fileName: '임직원 커뮤니케이션 규정.pdf', fileType: 'pdf', lifecycle: 'ACTIVE', securityLevel: 'PUBLIC', domainCode: 'COMM', categoryName: '내부소통', validUntilDays: null, updatedDaysAgo: 45 },  // WARNING

  // ===== CONTRACT (12건) =====
  { fileName: '표준 용역계약서.pdf', fileType: 'pdf', lifecycle: 'ACTIVE', securityLevel: 'CONFIDENTIAL', domainCode: 'CONTRACT', categoryName: '표준계약', validUntilDays: 365, updatedDaysAgo: 10, extraDomains: ['SALES'] },
  { fileName: 'NDA 템플릿.pdf', fileType: 'pdf', lifecycle: 'ACTIVE', securityLevel: 'CONFIDENTIAL', domainCode: 'CONTRACT', categoryName: '표준계약', validUntilDays: 180, updatedDaysAgo: 30 },
  { fileName: '업무 위탁 계약서.pdf', fileType: 'pdf', lifecycle: 'ACTIVE', securityLevel: 'CONFIDENTIAL', domainCode: 'CONTRACT', categoryName: '표준계약', validUntilDays: null, updatedDaysAgo: 55 },  // WARNING
  { fileName: '2025 연간 계약 현황.csv', fileType: 'csv', lifecycle: 'DEPRECATED', securityLevel: 'INTERNAL', domainCode: 'CONTRACT', categoryName: '검토완료', validUntilDays: null, updatedDaysAgo: 150 },
  { fileName: 'SW 라이선스 계약.pdf', fileType: 'pdf', lifecycle: 'ACTIVE', securityLevel: 'INTERNAL', domainCode: 'CONTRACT', categoryName: '진행중', validUntilDays: -10, updatedDaysAgo: 90 },  // EXPIRED
  { fileName: '파견 근로자 계약서.pdf', fileType: 'pdf', lifecycle: 'ACTIVE', securityLevel: 'CONFIDENTIAL', domainCode: 'CONTRACT', categoryName: '진행중', validUntilDays: 60, updatedDaysAgo: 20 },
  { fileName: '계약 검토 체크리스트.md', fileType: 'md', lifecycle: 'ACTIVE', securityLevel: 'INTERNAL', domainCode: 'CONTRACT', categoryName: '검토완료', validUntilDays: null, updatedDaysAgo: 12 },
  { fileName: '공급업체 계약 조건표.csv', fileType: 'csv', lifecycle: 'DRAFT', securityLevel: 'INTERNAL', domainCode: 'CONTRACT', categoryName: '진행중', validUntilDays: null, updatedDaysAgo: 5 },
  { fileName: '보안 서약서 양식.pdf', fileType: 'pdf', lifecycle: 'ACTIVE', securityLevel: 'SECRET', domainCode: 'CONTRACT', categoryName: '표준계약', validUntilDays: 365, updatedDaysAgo: 8, extraDomains: ['COMP'] },
  { fileName: '외주 개발 계약서 초안.pdf', fileType: 'pdf', lifecycle: 'DRAFT', securityLevel: 'INTERNAL', domainCode: 'CONTRACT', categoryName: '진행중', validUntilDays: null, updatedDaysAgo: 38 },  // stale draft
  { fileName: '계약 해지 절차 가이드.md', fileType: 'md', lifecycle: 'ACTIVE', securityLevel: 'INTERNAL', domainCode: 'CONTRACT', categoryName: '검토완료', validUntilDays: null, updatedDaysAgo: 92 },  // EXPIRED (updatedDaysAgo >= 91)
  { fileName: '2026 계약 관리 방침.pdf', fileType: 'pdf', lifecycle: 'DRAFT', securityLevel: 'CONFIDENTIAL', domainCode: 'CONTRACT', categoryName: '진행중', validUntilDays: null, updatedDaysAgo: 4 },

  // ===== COMP (12건) =====
  { fileName: '2026년 급여체계.csv', fileType: 'csv', lifecycle: 'ACTIVE', securityLevel: 'SECRET', domainCode: 'COMP', categoryName: '급여', validUntilDays: 365, updatedDaysAgo: 10 },
  { fileName: '복리후생 안내.md', fileType: 'md', lifecycle: 'ACTIVE', securityLevel: 'INTERNAL', domainCode: 'COMP', categoryName: '복리후생', validUntilDays: null, updatedDaysAgo: 15, extraDomains: ['GA'] },
  { fileName: '2025 성과평가 결과.csv', fileType: 'csv', lifecycle: 'DEPRECATED', securityLevel: 'SECRET', domainCode: 'COMP', categoryName: '성과평가', validUntilDays: null, updatedDaysAgo: 180 },
  { fileName: '퇴직금 산정 기준.pdf', fileType: 'pdf', lifecycle: 'ACTIVE', securityLevel: 'CONFIDENTIAL', domainCode: 'COMP', categoryName: '급여', validUntilDays: null, updatedDaysAgo: 35 },  // WARNING
  { fileName: '건강검진 안내.md', fileType: 'md', lifecycle: 'ACTIVE', securityLevel: 'PUBLIC', domainCode: 'COMP', categoryName: '복리후생', validUntilDays: 25, updatedDaysAgo: 30 },  // WARNING (validUntil 25일 후)
  { fileName: '인센티브 지급 기준.pdf', fileType: 'pdf', lifecycle: 'ACTIVE', securityLevel: 'CONFIDENTIAL', domainCode: 'COMP', categoryName: '성과평가', validUntilDays: null, updatedDaysAgo: 20 },
  { fileName: '4대보험 가입 안내.pdf', fileType: 'pdf', lifecycle: 'ACTIVE', securityLevel: 'CONFIDENTIAL', domainCode: 'COMP', categoryName: '복리후생', validUntilDays: null, updatedDaysAgo: 18 },
  { fileName: '2026 성과평가 기준 초안.md', fileType: 'md', lifecycle: 'DRAFT', securityLevel: 'CONFIDENTIAL', domainCode: 'COMP', categoryName: '성과평가', validUntilDays: null, updatedDaysAgo: 42 },  // stale draft
  { fileName: '연차 사용 가이드.md', fileType: 'md', lifecycle: 'ACTIVE', securityLevel: 'PUBLIC', domainCode: 'COMP', categoryName: '복리후생', validUntilDays: null, updatedDaysAgo: 5 },
  { fileName: '임금 피크제 규정.pdf', fileType: 'pdf', lifecycle: 'DEPRECATED', securityLevel: 'INTERNAL', domainCode: 'COMP', categoryName: '급여', validUntilDays: null, updatedDaysAgo: 250 },
  { fileName: '통근버스 노선 안내.csv', fileType: 'csv', lifecycle: 'DEPRECATED', securityLevel: 'INTERNAL', domainCode: 'COMP', categoryName: '복리후생', validUntilDays: null, updatedDaysAgo: 160 },
  { fileName: '직원 할인 프로그램.md', fileType: 'md', lifecycle: 'DRAFT', securityLevel: 'INTERNAL', domainCode: 'COMP', categoryName: '복리후생', validUntilDays: null, updatedDaysAgo: 6 },

  // ===== EDU (14건) =====
  { fileName: '신입사원 OJT 가이드.md', fileType: 'md', lifecycle: 'ACTIVE', securityLevel: 'INTERNAL', domainCode: 'EDU', categoryName: '신입교육', validUntilDays: null, updatedDaysAgo: 12 },
  { fileName: '정보보안 교육자료.pdf', fileType: 'pdf', lifecycle: 'ACTIVE', securityLevel: 'INTERNAL', domainCode: 'EDU', categoryName: '직무교육', validUntilDays: 90, updatedDaysAgo: 20, extraDomains: ['GA'] },
  { fileName: '리더십 교육 과정 안내.pdf', fileType: 'pdf', lifecycle: 'DRAFT', securityLevel: 'CONFIDENTIAL', domainCode: 'EDU', categoryName: '외부교육', validUntilDays: null, updatedDaysAgo: 22 },
  { fileName: 'Excel 활용 교육.pdf', fileType: 'pdf', lifecycle: 'DRAFT', securityLevel: 'INTERNAL', domainCode: 'EDU', categoryName: '직무교육', validUntilDays: null, updatedDaysAgo: 28 },
  { fileName: '2025 교육 이수 현황.csv', fileType: 'csv', lifecycle: 'DEPRECATED', securityLevel: 'INTERNAL', domainCode: 'EDU', categoryName: '직무교육', validUntilDays: null, updatedDaysAgo: 130 },
  { fileName: '컴플라이언스 교육.pdf', fileType: 'pdf', lifecycle: 'ACTIVE', securityLevel: 'PUBLIC', domainCode: 'EDU', categoryName: '직무교육', validUntilDays: 18, updatedDaysAgo: 50 },  // WARNING (validUntil 18일 후)
  { fileName: '신입교육 일정표.csv', fileType: 'csv', lifecycle: 'DRAFT', securityLevel: 'INTERNAL', domainCode: 'EDU', categoryName: '신입교육', validUntilDays: null, updatedDaysAgo: 7 },
  { fileName: '외부 교육 기관 목록.csv', fileType: 'csv', lifecycle: 'ACTIVE', securityLevel: 'INTERNAL', domainCode: 'EDU', categoryName: '외부교육', validUntilDays: null, updatedDaysAgo: 60 },  // WARNING
  { fileName: '사이버 보안 실습 가이드.md', fileType: 'md', lifecycle: 'ACTIVE', securityLevel: 'INTERNAL', domainCode: 'EDU', categoryName: '직무교육', validUntilDays: -3, updatedDaysAgo: 95 },  // EXPIRED
  { fileName: '2026 교육 계획.pdf', fileType: 'pdf', lifecycle: 'DRAFT', securityLevel: 'INTERNAL', domainCode: 'EDU', categoryName: '직무교육', validUntilDays: null, updatedDaysAgo: 37 },  // stale draft
  { fileName: 'AI 활용 교육 자료.md', fileType: 'md', lifecycle: 'ACTIVE', securityLevel: 'PUBLIC', domainCode: 'EDU', categoryName: '외부교육', validUntilDays: null, updatedDaysAgo: 4, extraDomains: ['COMM'] },
  { fileName: '멘토링 프로그램 안내.md', fileType: 'md', lifecycle: 'DRAFT', securityLevel: 'INTERNAL', domainCode: 'EDU', categoryName: '신입교육', validUntilDays: null, updatedDaysAgo: 9 },
  { fileName: '직무전환 교육 절차.pdf', fileType: 'pdf', lifecycle: 'ACTIVE', securityLevel: 'PUBLIC', domainCode: 'EDU', categoryName: '직무교육', validUntilDays: null, updatedDaysAgo: 70 },  // WARNING
  { fileName: '교육 만족도 설문 양식.md', fileType: 'md', lifecycle: 'DRAFT', securityLevel: 'PUBLIC', domainCode: 'EDU', categoryName: '외부교육', validUntilDays: null, updatedDaysAgo: 2 },

  // ===== 고아 문서 10건 (배치 없음) =====
  { fileName: '미분류 보고서 1.pdf', fileType: 'pdf', lifecycle: 'DRAFT', securityLevel: 'INTERNAL', domainCode: null, categoryName: null, validUntilDays: null, updatedDaysAgo: 14 },
  { fileName: '미분류 데이터.csv', fileType: 'csv', lifecycle: 'DRAFT', securityLevel: 'PUBLIC', domainCode: null, categoryName: null, validUntilDays: null, updatedDaysAgo: 20 },
  { fileName: '임시 메모.md', fileType: 'md', lifecycle: 'DRAFT', securityLevel: 'PUBLIC', domainCode: null, categoryName: null, validUntilDays: null, updatedDaysAgo: 30 },
  { fileName: '테스트 문서.pdf', fileType: 'pdf', lifecycle: 'ACTIVE', securityLevel: 'SECRET', domainCode: null, categoryName: null, validUntilDays: null, updatedDaysAgo: 5 },
  { fileName: '참고자료 모음.pdf', fileType: 'pdf', lifecycle: 'ACTIVE', securityLevel: 'PUBLIC', domainCode: null, categoryName: null, validUntilDays: null, updatedDaysAgo: 18 },
  { fileName: '회의록 초안.md', fileType: 'md', lifecycle: 'DRAFT', securityLevel: 'INTERNAL', domainCode: null, categoryName: null, validUntilDays: null, updatedDaysAgo: 25 },
  { fileName: '구버전 양식.pdf', fileType: 'pdf', lifecycle: 'DEPRECATED', securityLevel: 'PUBLIC', domainCode: null, categoryName: null, validUntilDays: null, updatedDaysAgo: 200 },
  { fileName: '외부 수집 데이터.csv', fileType: 'csv', lifecycle: 'ACTIVE', securityLevel: 'INTERNAL', domainCode: null, categoryName: null, validUntilDays: null, updatedDaysAgo: 65 },
  { fileName: '삭제 예정 문서.pdf', fileType: 'pdf', lifecycle: 'DEPRECATED', securityLevel: 'INTERNAL', domainCode: null, categoryName: null, validUntilDays: null, updatedDaysAgo: 300 },
  { fileName: '스캔 문서.pdf', fileType: 'pdf', lifecycle: 'ACTIVE', securityLevel: 'INTERNAL', domainCode: null, categoryName: null, validUntilDays: null, updatedDaysAgo: 10 },
]

// ============================================================
// 메인 시드 함수
// ============================================================

async function main() {
  console.log('=== 테스트 데이터 시드 시작 ===\n')

  // 1. 기존 데이터 삭제 (역순 — FK 제약)
  console.log('기존 데이터 삭제...')
  await prisma.documentHistory.deleteMany()
  await prisma.relation.deleteMany()
  await prisma.documentPlacement.deleteMany()
  await prisma.document.deleteMany()
  await prisma.domainCategory.deleteMany()
  await prisma.domainMaster.deleteMany()
  await prisma.feedback.deleteMany()
  await prisma.user.deleteMany()
  console.log('  ✓ 기존 데이터 삭제 완료\n')

  // 2. 사용자 생성
  console.log('사용자 생성...')
  const userMap = new Map<string, string>() // email → id
  for (const u of USERS) {
    const hash = await bcrypt.hash(u.password, 10)
    const user = await prisma.user.create({
      data: {
        email: u.email,
        passwordHash: hash,
        name: u.name,
        role: u.role,
      },
    })
    userMap.set(u.email, user.id)
    console.log(`  ✓ ${u.name} (${u.email} / ${u.password}) — ${u.role}`)
  }
  console.log()

  // 3. 도메인 생성
  console.log('도메인 생성...')
  for (const d of DOMAINS) {
    await prisma.domainMaster.create({
      data: {
        code: d.code,
        displayName: d.displayName,
        parentCode: d.parentCode,
        description: d.description,
        sortOrder: d.sortOrder,
      },
    })
    console.log(`  ✓ ${d.code} — ${d.displayName}`)
  }
  console.log()

  // 4. 카테고리 생성
  console.log('카테고리 생성...')
  const categoryMap = new Map<string, number>() // "domainCode:name" → id
  for (const c of CATEGORIES) {
    const cat = await prisma.domainCategory.create({
      data: {
        domainCode: c.domainCode,
        name: c.name,
        sortOrder: c.sortOrder,
      },
    })
    categoryMap.set(`${c.domainCode}:${c.name}`, cat.id)
    console.log(`  ✓ ${c.domainCode} > ${c.name}`)
  }
  console.log()

  // 5. 문서 생성
  console.log('문서 생성...')
  const editorIds = [userMap.get('editor1')!, userMap.get('editor2')!]
  const docIds: string[] = []

  for (let i = 0; i < DOCUMENTS.length; i++) {
    const d = DOCUMENTS[i]
    const creatorId = editorIds[i % 2]
    const now = new Date()
    const yymm = `${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, '0')}`
    const docCode = `DOC-${yymm}-${String(i + 1).padStart(3, '0')}`
    const updatedAt = daysAgo(d.updatedDaysAgo)
    const createdAt = new Date(updatedAt.getTime() - 86400000) // 생성일 = 수정일 - 1일

    const doc = await prisma.document.create({
      data: {
        docCode,
        lifecycle: d.lifecycle,
        securityLevel: d.securityLevel,
        filePath: null,
        fileName: d.fileName,
        fileType: d.fileType,
        fileSize: null,
        fileHash: fakeHash(i),
        versionMajor: 1,
        versionMinor: 0,
        validUntil: d.validUntilDays != null ? (d.validUntilDays >= 0 ? daysFromNow(d.validUntilDays) : daysAgo(-d.validUntilDays)) : null,
        createdById: creatorId,
        updatedById: creatorId,
        createdAt,
        updatedAt,
      },
    })
    docIds.push(doc.id)

    if (i % 10 === 0) {
      console.log(`  ... ${i + 1}/${DOCUMENTS.length}`)
    }
  }
  console.log(`  ✓ 문서 ${DOCUMENTS.length}건 생성 완료\n`)

  // 6. 배치 생성
  console.log('배치 생성...')
  let placementCount = 0
  const adminId = userMap.get('admin')!

  for (let i = 0; i < DOCUMENTS.length; i++) {
    const d = DOCUMENTS[i]
    if (!d.domainCode) continue // 고아 문서는 배치 안 함

    const categoryId = d.categoryName ? categoryMap.get(`${d.domainCode}:${d.categoryName}`) ?? null : null

    await prisma.documentPlacement.create({
      data: {
        documentId: docIds[i],
        domainCode: d.domainCode,
        categoryId,
        placedBy: adminId,
      },
    })
    placementCount++

    // 다중 배치
    if (d.extraDomains) {
      for (const extraDomain of d.extraDomains) {
        await prisma.documentPlacement.create({
          data: {
            documentId: docIds[i],
            domainCode: extraDomain,
            categoryId: null,
            placedBy: adminId,
          },
        })
        placementCount++
      }
    }
  }
  console.log(`  ✓ 배치 ${placementCount}건 생성 완료\n`)

  // 7. 관계 생성 (서비스 레이어 우회 — 양방향 직접 insert)
  console.log('관계 생성...')
  let relationCount = 0

  // PARENT_OF/CHILD_OF 쌍 (8쌍 = 16건)
  const parentChildPairs: Array<[number, number, string]> = [
    [0, 5, 'SALES'],    // 영업전략 → 제안서 템플릿
    [0, 7, 'SALES'],    // 영업전략 → Q1 목표
    [12, 17, 'COMM'],   // 공지 템플릿 → SNS 운영 가이드
    [22, 28, 'CONTRACT'], // 용역계약서 → 해지 절차 가이드
    [23, 25, 'CONTRACT'], // NDA → 파견 계약서
    [34, 38, 'COMP'],   // 급여체계 → 연차 사용 가이드
    [42, 46, 'EDU'],    // OJT 가이드 → 신입교육 일정표
    [43, 48, 'EDU'],    // 정보보안 교육 → 사이버 보안 실습
  ]

  for (const [parentIdx, childIdx, domain] of parentChildPairs) {
    // PARENT_OF
    await prisma.relation.create({
      data: {
        sourceId: docIds[parentIdx],
        targetId: docIds[childIdx],
        relationType: 'PARENT_OF',
        domainCode: domain,
        createdById: adminId,
      },
    })
    // CHILD_OF (역방향)
    await prisma.relation.create({
      data: {
        sourceId: docIds[childIdx],
        targetId: docIds[parentIdx],
        relationType: 'CHILD_OF',
        domainCode: domain,
        createdById: adminId,
      },
    })
    relationCount += 2
  }

  // REFERENCE (5건 — 단방향)
  const referencePairs: Array<[number, number, string]> = [
    [3, 0, 'SALES'],    // 실적보고 → 영업전략
    [14, 12, 'COMM'],   // 미디어 가이드 → 공지 템플릿
    [26, 22, 'CONTRACT'], // 체크리스트 → 용역계약서
    [35, 34, 'COMP'],   // 복리후생 안내 → 급여체계
    [43, 42, 'EDU'],    // 정보보안 교육 → OJT 가이드
  ]

  for (const [srcIdx, tgtIdx, domain] of referencePairs) {
    await prisma.relation.create({
      data: {
        sourceId: docIds[srcIdx],
        targetId: docIds[tgtIdx],
        relationType: 'REFERENCE',
        domainCode: domain,
        createdById: adminId,
      },
    })
    relationCount++
  }

  // SUPERSEDES (2건 — 단방향, 도메인 무관)
  const supersedesPairs: Array<[number, number]> = [
    [1, 6],    // 거래처 목록 supersedes 2025 영업보고서
    [34, 36],  // 2026 급여체계 supersedes 2025 성과평가
  ]

  for (const [srcIdx, tgtIdx] of supersedesPairs) {
    await prisma.relation.create({
      data: {
        sourceId: docIds[srcIdx],
        targetId: docIds[tgtIdx],
        relationType: 'SUPERSEDES',
        domainCode: null,
        createdById: adminId,
      },
    })
    relationCount++
  }

  // SIBLING 쌍 (2쌍 = 4건)
  const siblingPairs: Array<[number, number, string]> = [
    [4, 9, 'SALES'],     // VIP 관리 매뉴얼 ↔ 경쟁사 비교 분석
    [44, 45, 'EDU'],     // 리더십 교육 ↔ Excel 교육
  ]

  for (const [aIdx, bIdx, domain] of siblingPairs) {
    await prisma.relation.create({
      data: {
        sourceId: docIds[aIdx],
        targetId: docIds[bIdx],
        relationType: 'SIBLING',
        domainCode: domain,
        createdById: adminId,
      },
    })
    await prisma.relation.create({
      data: {
        sourceId: docIds[bIdx],
        targetId: docIds[aIdx],
        relationType: 'SIBLING',
        domainCode: domain,
        createdById: adminId,
      },
    })
    relationCount += 2
  }

  console.log(`  ✓ 관계 ${relationCount}건 생성 완료\n`)

  // 8. 문서 이력 생성 (CREATE 이력)
  console.log('이력 생성...')
  for (let i = 0; i < DOCUMENTS.length; i++) {
    const d = DOCUMENTS[i]
    const creatorId = editorIds[i % 2]
    const updatedAt = daysAgo(d.updatedDaysAgo)
    const createdAt = new Date(updatedAt.getTime() - 86400000)

    await prisma.documentHistory.create({
      data: {
        documentId: docIds[i],
        action: 'CREATE',
        changes: { fileName: d.fileName },
        userId: creatorId,
        createdAt,
      },
    })
  }
  console.log(`  ✓ 이력 ${DOCUMENTS.length}건 생성 완료\n`)

  // ============================================================
  // 통계 요약
  // ============================================================
  console.log('=== 시드 완료 — 통계 요약 ===\n')

  const lifecycleCounts = { DRAFT: 0, ACTIVE: 0, DEPRECATED: 0 }
  const securityCounts = { PUBLIC: 0, INTERNAL: 0, CONFIDENTIAL: 0, SECRET: 0 }
  let orphanCount = 0
  let multiPlacementCount = 0

  for (const d of DOCUMENTS) {
    lifecycleCounts[d.lifecycle as keyof typeof lifecycleCounts]++
    securityCounts[d.securityLevel as keyof typeof securityCounts]++
    if (!d.domainCode) orphanCount++
    if (d.extraDomains && d.extraDomains.length > 0) multiPlacementCount++
  }

  console.log(`사용자: ${USERS.length}명`)
  console.log(`도메인: ${DOMAINS.length}개`)
  console.log(`카테고리: ${CATEGORIES.length}개`)
  console.log(`문서: ${DOCUMENTS.length}건`)
  console.log(`  - DRAFT: ${lifecycleCounts.DRAFT}, ACTIVE: ${lifecycleCounts.ACTIVE}, DEPRECATED: ${lifecycleCounts.DEPRECATED}`)
  console.log(`  - PUBLIC: ${securityCounts.PUBLIC}, INTERNAL: ${securityCounts.INTERNAL}, CONFIDENTIAL: ${securityCounts.CONFIDENTIAL}, SECRET: ${securityCounts.SECRET}`)
  console.log(`  - 고아 문서: ${orphanCount}건`)
  console.log(`  - 다중 배치: ${multiPlacementCount}건`)
  console.log(`배치: ${placementCount}건`)
  console.log(`관계: ${relationCount}건`)
  console.log(`이력: ${DOCUMENTS.length}건`)
  console.log()
  console.log('로그인 계정:')
  for (const u of USERS) {
    console.log(`  ${u.email} / ${u.password} (${u.role})`)
  }
}

main()
  .catch((e) => {
    console.error('시드 실패:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
