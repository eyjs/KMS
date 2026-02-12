# KMS 배포 가이드

## 아키텍처 개요

```
┌─────────────────────────────────────────────────────────────┐
│                        Vercel                                │
│                   (프론트엔드 자동 배포)                      │
│                   kms-web.vercel.app                         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼ API 호출
┌─────────────────────────────────────────────────────────────┐
│                     홈서버 (Docker)                          │
│                     kms.joonbi.co.kr                         │
│  ┌────────────────┐    ┌────────────────┐                   │
│  │   kms-api      │    │  kms-postgres  │                   │
│  │   :3001→3000   │───▶│   :5436→5432   │                   │
│  └────────────────┘    └────────────────┘                   │
└─────────────────────────────────────────────────────────────┘
```

---

## 1. 프론트엔드 배포 (Vercel)

**자동 배포**: `main` 브랜치에 푸시하면 Vercel이 자동으로 빌드 & 배포

### 수동 확인
```bash
# Vercel 대시보드에서 배포 상태 확인
# https://vercel.com/dashboard
```

### 환경 변수 (Vercel 설정)
| 변수 | 값 |
|------|-----|
| `VITE_API_BASE_URL` | `https://kms.joonbi.co.kr/api` |

---

## 2. 백엔드 배포 (Docker)

### 배포 절차

```bash
# 1. 프로젝트 루트로 이동
cd /Users/eyjs/Desktop/WorkSpace/KMS

# 2. 최신 코드 pull (이미 로컬에서 작업한 경우 생략)
git pull origin main

# 3. Docker 이미지 빌드 + 컨테이너 재시작
docker compose -f docker-compose.prod.yml up -d --build

# 4. 배포 확인
docker ps --filter "name=kms"
```

### 배포 확인 명령어

```bash
# 컨테이너 상태 확인
docker ps --filter "name=kms" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# API 로그 확인
docker logs kms-api --tail 50

# API 헬스체크 (로컬)
curl http://localhost:3001/api/documents?page=1&size=1

# DB 연결 확인
docker exec kms-postgres pg_isready -U kms
```

---

## 3. 장애 대응

### 3.1 API 컨테이너가 시작되지 않음

```bash
# 로그 확인
docker logs kms-api

# 일반적인 원인:
# - DB 연결 실패 → postgres 컨테이너 확인
# - 환경변수 누락 → .env 파일 확인
```

### 3.2 DB 마이그레이션 필요

```bash
# 컨테이너 내부에서 마이그레이션 실행
docker exec kms-api npx prisma migrate deploy

# 또는 로컬에서 직접 연결
DATABASE_URL="postgresql://kms:비밀번호@localhost:5436/kms?schema=public" \
  npx --prefix packages/api prisma migrate deploy
```

### 3.3 롤백

```bash
# 이전 이미지로 롤백 (태그가 있는 경우)
docker compose -f docker-compose.prod.yml down
docker image tag kms-kms-api:previous kms-kms-api:latest
docker compose -f docker-compose.prod.yml up -d

# 또는 git에서 이전 커밋으로 체크아웃 후 재빌드
git checkout HEAD~1
docker compose -f docker-compose.prod.yml up -d --build
```

---

## 4. 환경 변수

### docker-compose.prod.yml에서 사용

| 변수 | 설명 | 기본값 |
|------|------|--------|
| `DB_PASSWORD` | PostgreSQL 비밀번호 | `kms_secure_2024` |
| `JWT_SECRET` | JWT 서명 키 (필수) | - |
| `JWT_EXPIRES_IN` | 액세스 토큰 만료 | `1h` |
| `JWT_REFRESH_EXPIRES_IN` | 리프레시 토큰 만료 | `7d` |
| `CORS_ORIGIN` | 허용 Origin | `*` |

### .env 파일 예시

```bash
# /Users/eyjs/Desktop/WorkSpace/KMS/.env
DB_PASSWORD=실제_비밀번호_여기에
JWT_SECRET=32자_이상_랜덤_문자열
CORS_ORIGIN=https://kms-web.vercel.app
```

---

## 5. 포트 매핑

| 서비스 | 컨테이너 포트 | 호스트 포트 | 용도 |
|--------|--------------|-------------|------|
| kms-api | 3000 | 3001 | API 서버 |
| kms-postgres | 5432 | 5436 | PostgreSQL |

---

## 6. 볼륨

| 볼륨명 | 경로 | 용도 |
|--------|------|------|
| `kms-pgdata` | PostgreSQL 내부 | DB 데이터 영구 저장 |
| `kms-storage` | `/app/storage` | 업로드 파일 저장 |

### 볼륨 백업

```bash
# DB 백업
docker exec kms-postgres pg_dump -U kms kms > backup_$(date +%Y%m%d).sql

# 파일 스토리지 백업
docker cp kms-api:/app/storage ./storage_backup_$(date +%Y%m%d)
```

---

## 7. 자주 하는 실수

| 실수 | 증상 | 해결 |
|------|------|------|
| `--build` 빼먹음 | 코드 변경이 반영 안 됨 | `docker compose ... up -d --build` |
| 잘못된 compose 파일 | 개발 DB에 연결됨 | `-f docker-compose.prod.yml` 확인 |
| shared 빌드 안 함 | 타입 에러 | 로컬에서 `npm --prefix packages/shared run build` 먼저 |
| DB 마이그레이션 누락 | Prisma 에러 | `prisma migrate deploy` 실행 |

---

## 8. 전체 배포 체크리스트

```
[ ] 1. 코드 변경 완료 + 테스트 통과
[ ] 2. git commit + push
[ ] 3. Vercel 배포 확인 (자동)
[ ] 4. docker compose -f docker-compose.prod.yml up -d --build
[ ] 5. docker ps로 컨테이너 상태 확인
[ ] 6. API 로그 확인 (에러 없는지)
[ ] 7. 브라우저에서 기능 테스트
```
