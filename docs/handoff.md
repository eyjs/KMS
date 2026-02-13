# 세션 핸드오프 - 2026-02-13

## 완료된 작업

### 1. 파일 버전 이력 관리

- [x] `DocumentVersion` 모델 추가 (schema.prisma)
- [x] `Document.fileHash`에서 `@unique` 제거 (버전별 해시 허용)
- [x] `attachFile()` 리팩토링 — 기존 파일 → document_versions 아카이빙, versionMinor 증가
- [x] `transitionLifecycle()` — DRAFT→ACTIVE 시 versionMajor++, versionMinor=0
- [x] `checkFileHashDuplicate()` — documents + document_versions 모두 체크
- [x] `getVersions()`, `findVersionInternal()` 서비스 메서드
- [x] API 엔드포인트: `GET :id/versions`, `GET :id/versions/:versionId/file`, `GET :id/versions/:versionId/preview`
- [x] 뷰어 확장 (PdfViewer, MarkdownViewer, CsvViewer) — `previewUrl` prop 추가
- [x] VersionHistoryDialog 컴포넌트 (테이블 + 미리보기 서브 다이얼로그)
- [x] DocumentDetailView — 버전 이력 보기 버튼 + 파일 교체 버튼
- [x] shared 타입: `DocumentVersionEntity` 인터페이스

### 2. ROT 탐지 확장

- [x] IssueType에 `long_orphan` (미배치 + 30일+ 방치) 추가
- [x] IssueType에 `duplicate_name` (동일 파일명 GROUP BY) 추가
- [x] `getIssueCounts()` — longOrphan, duplicateName 포함
- [x] `getIssueDocuments()` — duplicate_name 별도 raw query 처리
- [x] DashboardView — ISSUE_TABS에 2개 탭 추가 (장기 미배치, 파일명 중복)
- [x] shared 상수: `ISSUE_LABELS`, `ISSUE_TAG_TYPES` 추가

### 3. 감사 로그

- [x] `recordView()` — 5분 디바운스, 문서 상세 조회 시 비동기 호출
- [x] `recordDownload()` — 파일 다운로드 시 비동기 호출
- [x] `getAuditLog()` — 필터(action, userId, dateFrom, dateTo) + 페이지네이션
- [x] `getAuditStats()` — Top 10 조회 문서 + 사용자별 활동 (raw query)
- [x] API 엔드포인트: `GET audit/log` (ADMIN), `GET audit/stats` (ADMIN)
- [x] AdminAuditView 신규 — 통계 카드 + 필터 + 로그 테이블
- [x] 라우터: `/admin/audit` 추가
- [x] AppLayout: ADMIN 사이드바에 "감사 로그" 메뉴
- [x] shared 상수: ACTION_LABELS에 VIEW, DOWNLOAD, FILE_REPLACE 추가

### 4. 카테고리 이동/이름변경 UI

- [x] CategoryTree — 호버 시 "이름 변경" 버튼 (Edit 아이콘) + 다이얼로그
- [x] CategoryTree — 호버 시 "이동" 버튼 (Rank 아이콘) + el-tree-select 다이얼로그
- [x] 이동 대상에서 자기 자신 + 하위 노드 제외, "루트로 이동" 지원
- [x] `categoriesApi.update(id, { name })` / `categoriesApi.move(id, parentId)` 호출

---

## 변경 파일 (수정 16 + 신규 2)

**수정:**
- `packages/api/prisma/schema.prisma` — DocumentVersion 모델, fileHash unique 제거
- `packages/shared/src/types.ts` — DocumentVersionEntity
- `packages/shared/src/constants.ts` — ACTION_LABELS 확장, ISSUE_LABELS/ISSUE_TAG_TYPES
- `packages/api/src/documents/documents.service.ts` — 버전 관리, ROT 확장, 감사 로그
- `packages/api/src/documents/documents.controller.ts` — 버전/감사 엔드포인트
- `packages/api/src/documents/dto/documents.dto.ts` — VALID_ISSUE_TYPES 확장
- `packages/web/src/api/documents.ts` — 버전/감사 API, IssueCounts 확장
- `packages/web/src/views/DocumentDetailView.vue` — 버전 이력/파일 교체
- `packages/web/src/views/DashboardView.vue` — ROT 탭 확장
- `packages/web/src/router/index.ts` — /admin/audit 라우트
- `packages/web/src/components/layout/AppLayout.vue` — 감사 로그 메뉴
- `packages/web/src/components/viewer/PdfViewer.vue` — previewUrl prop
- `packages/web/src/components/viewer/MarkdownViewer.vue` — previewUrl prop
- `packages/web/src/components/viewer/CsvViewer.vue` — previewUrl prop
- `packages/web/src/components/domain/CategoryTree.vue` — 이동/이름변경 UI
- `docs/handoff.md` — 이 파일

**신규:**
- `packages/web/src/components/document/VersionHistoryDialog.vue`
- `packages/web/src/views/AdminAuditView.vue`

## 빌드 상태

- shared: tsc 통과
- API: nest build 통과
- Web: vue-tsc + vite build 통과

## 배포 전 필요 작업

1. DB 마이그레이션 실행: `npx prisma migrate dev --name add_document_versions`
   - document_versions 테이블 생성
   - documents.file_hash UNIQUE 제약 제거
2. Prisma generate (배포 시 자동)
3. Docker rebuild (backend)
4. Vercel auto-deploy (frontend)

## 다음 세션 TODO

- Phase 2 남은 과제 검토 (UX 최적화 등)
- 배포 후 기능 검증
- CLAUDE.md 구현 완료 기능 목록 업데이트
