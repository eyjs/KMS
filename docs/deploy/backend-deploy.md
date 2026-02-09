# KMS 백엔드 배포 가이드 (Mac OS Docker Desktop)

## 환경 정보

- 배포 서버: Mac Studio (Mac OS)
- 런타임: Docker Desktop
- 호스트 포트 배정: PostgreSQL `5436`, API `3001`
- 레포지토리: https://github.com/eyjs/KMS.git

---

## Gemini CLI에 복사해서 실행할 명령어

아래 전체를 Gemini CLI에 프롬프트로 붙여넣으면 됩니다.

---

### 프롬프트 시작

```
아래 순서대로 KMS 백엔드를 Docker로 배포해줘. 각 단계마다 실행 결과를 확인하고 문제가 있으면 알려줘.

## 1단계: 레포지토리 클론

WorkSpace 디렉토리에서 실행:

cd ~/WorkSpace
git clone https://github.com/eyjs/KMS.git kms
cd kms

## 2단계: 환경변수 파일 생성

프로젝트 루트에 .env 파일을 생성해:

DB_PASSWORD=kms_secure_2024
JWT_SECRET=kms-jwt-secret-change-me-2024-prod-key-32chars
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d
CORS_ORIGIN=*

## 3단계: Docker 이미지 빌드 및 컨테이너 실행

docker compose -f docker-compose.prod.yml up -d --build

이 명령어가 하는 일:
- PostgreSQL 16 컨테이너 시작 (호스트 포트 5436)
- API용 Docker 이미지 빌드 (멀티스테이지: shared 빌드 → Prisma generate → API 빌드)
- API 컨테이너 시작 (호스트 포트 3001)

빌드에 2-3분 정도 소요됩니다.

## 4단계: DB 마이그레이션 실행

컨테이너가 뜬 후 마이그레이션을 실행해:

docker exec kms-api npx prisma migrate deploy --schema=./packages/api/prisma/schema.prisma

## 5단계: DB 트리거 적용

PostgreSQL에 트리거를 적용해야 해. 트리거 SQL 파일이 컨테이너 안에 있어:

docker exec kms-api cat /app/packages/api/prisma/triggers.sql | docker exec -i kms-postgres psql -U kms -d kms

## 6단계: 시드 데이터 (초기 데이터)

관리자 계정과 마스터 데이터를 넣어:

docker exec -w /app/packages/api kms-api npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed.ts

만약 ts-node가 없다는 에러가 나면, 다음으로 대체해:

docker exec kms-api node -e "
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();
async function main() {
  const hash = await bcrypt.hash('admin123', 10);
  await prisma.user.upsert({
    where: { email: 'admin@company.com' },
    update: {},
    create: { email: 'admin@company.com', passwordHash: hash, name: '관리자', role: 'ADMIN' }
  });
  console.log('Admin user created');

  const domains = [
    { code: 'GA-SALES', displayName: '영업(GA)', requiredFacets: ['carrier','product','docType'], ssotKeys: ['carrier','product','docType'] },
    { code: 'GA-COMM', displayName: '수수료(GA)', requiredFacets: ['carrier','product','docType'], ssotKeys: ['carrier','product','docType'] },
    { code: 'GA-CONTRACT', displayName: '계약관리(GA)', requiredFacets: ['carrier','product','docType'], ssotKeys: ['carrier','product','docType'] },
    { code: 'GA-COMP', displayName: '보상(GA)', requiredFacets: ['carrier','product','docType'], ssotKeys: ['carrier','product','docType'] },
    { code: 'GA-EDU', displayName: '교육(GA)', requiredFacets: ['carrier','docType'], ssotKeys: ['carrier','docType'] },
    { code: 'COMMON-COMP', displayName: '공통(보상)', requiredFacets: ['docType'], ssotKeys: ['docType'] },
  ];
  for (const d of domains) {
    await prisma.domainMaster.upsert({ where: { code: d.code }, update: {}, create: d });
  }
  console.log('Domains seeded:', domains.length);

  const carriers = [
    { facetType: 'carrier', code: 'INS-SAMSUNG', displayName: '삼성화재', sortOrder: 1 },
    { facetType: 'carrier', code: 'INS-HYUNDAI', displayName: '현대해상', sortOrder: 2 },
    { facetType: 'carrier', code: 'INS-DB', displayName: 'DB손해보험', sortOrder: 3 },
    { facetType: 'carrier', code: 'INS-KB', displayName: 'KB손해보험', sortOrder: 4 },
    { facetType: 'carrier', code: 'INS-MERITZ', displayName: '메리츠화재', sortOrder: 5 },
    { facetType: 'carrier', code: 'INS-HANA', displayName: '하나손해보험', sortOrder: 6 },
    { facetType: 'carrier', code: 'INS-HEUNGKUK', displayName: '흥국화재', sortOrder: 7 },
    { facetType: 'carrier', code: 'INS-LOTTE', displayName: '롯데손해보험', sortOrder: 8 },
  ];
  for (const c of carriers) {
    await prisma.facetMaster.upsert({ where: { facetType_code: { facetType: c.facetType, code: c.code } }, update: {}, create: c });
  }
  console.log('Carriers seeded:', carriers.length);
  console.log('Seed complete!');
}
main().catch(console.error).finally(() => prisma.\$disconnect());
"

## 7단계: 동작 확인

1. 컨테이너 상태 확인:
docker ps | grep kms

두 컨테이너(kms-postgres, kms-api)가 Up 상태여야 합니다.

2. API 헬스체크:
curl http://localhost:3001/api

3. Swagger 문서 확인:
curl -s http://localhost:3001/api/docs-json | head -c 200

브라우저에서도 확인 가능: http://localhost:3001/api/docs

4. 로그인 테스트:
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@company.com","password":"admin123"}'

accessToken이 반환되면 성공입니다.

## 8단계: 로그 확인

문제가 있으면 로그를 확인해:

docker logs kms-api --tail 50
docker logs kms-postgres --tail 50

## 트러블슈팅

### API 컨테이너가 바로 죽는 경우
- docker logs kms-api 로 에러 확인
- JWT_SECRET 미설정 시 시작 실패함 (.env 확인)
- DB 연결 실패 시 postgres 컨테이너 healthy 상태 확인

### 마이그레이션 실패
- kms-postgres가 healthy 상태인지 확인: docker inspect kms-postgres | grep Health
- DB URL이 맞는지 확인

### 포트 충돌
- 현재 사용 중인 포트: 5433, 5435, 6380, 8002, 8081, 8100, 8101
- KMS는 5436(DB), 3001(API) 사용 → 충돌 없음

## 초기 계정
- 이메일: admin@company.com
- 비밀번호: admin123
- 역할: ADMIN (전체 권한)

배포 완료 후 Swagger(http://localhost:3001/api/docs)에서 API를 테스트할 수 있어.
```

### 프롬프트 끝

---

## 수동 배포 (단계별)

Gemini CLI 없이 직접 실행할 경우:

```bash
# 1. 클론
cd ~/WorkSpace
git clone https://github.com/eyjs/KMS.git kms && cd kms

# 2. 환경변수
cat > .env << 'EOF'
DB_PASSWORD=kms_secure_2024
JWT_SECRET=kms-jwt-secret-change-me-2024-prod-key-32chars
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d
CORS_ORIGIN=*
EOF

# 3. 빌드 & 실행
docker compose -f docker-compose.prod.yml up -d --build

# 4. 마이그레이션
docker exec kms-api npx prisma migrate deploy --schema=./packages/api/prisma/schema.prisma

# 5. 트리거
docker exec kms-api cat /app/packages/api/prisma/triggers.sql | docker exec -i kms-postgres psql -U kms -d kms

# 6. 시드
docker exec -w /app/packages/api kms-api npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed.ts

# 7. 확인
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@company.com","password":"admin123"}'
```

---

## 업데이트 배포

코드 변경 후 재배포:

```bash
cd ~/WorkSpace/kms
git pull origin main
docker compose -f docker-compose.prod.yml up -d --build kms-api
docker exec kms-api npx prisma migrate deploy --schema=./packages/api/prisma/schema.prisma
```

---

## 컨테이너 관리

```bash
# 중지
docker compose -f docker-compose.prod.yml down

# 중지 + 데이터 삭제
docker compose -f docker-compose.prod.yml down -v

# API 로그 실시간
docker logs -f kms-api

# DB 직접 접속
docker exec -it kms-postgres psql -U kms -d kms
```

---

## 포트 매핑 요약

| 서비스 | 컨테이너명 | 컨테이너 포트 | 호스트 포트 |
|--------|-----------|-------------|-----------|
| PostgreSQL | kms-postgres | 5432 | 5436 |
| NestJS API | kms-api | 3000 | 3001 |

## 접속 URL

| 서비스 | 로컬 | 프로덕션 |
|--------|------|---------|
| API | http://localhost:3001/api | https://kms.joonbi.co.kr/api |
| Swagger | http://localhost:3001/api/docs | https://kms.joonbi.co.kr/api/docs |
| DB (내부) | localhost:5436 | kms-postgres:5432 |
