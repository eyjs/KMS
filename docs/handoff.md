# 세션 핸드오프 - 2026-02-13

## 완료된 작업

### 1. 직전 작업 커밋 & 푸시

- [x] 커밋: `0ecb167` — `refactor: 그래프 더블클릭 re-center + 코드 리뷰 수정`
- [x] 푸시 완료

변경 파일 (8개):
- `packages/api/src/documents/documents.service.ts` — placements 필드명 통일
- `packages/web/src/api/documents.ts` — domainTags → placements 타입 정리
- `packages/web/src/components/graph/RelationGraph.vue` — mergeGraphData/mergeData/defineExpose 제거
- `packages/web/src/views/DocumentCompareView.vue` — 더블클릭 → loadGraph 재로드
- `packages/web/src/views/DomainWorkspace.vue` — 더블클릭 핸들러 추가
- `packages/web/src/views/GlobalGraphView.vue` — 더블클릭 → 그래프 재로드
- `packages/web/src/views/MyDocumentsView.vue` — getOrphans → getMyDocuments(orphan=true)
- `packages/web/src/views/SearchView.vue` — domainTags → placements

### 2. 로깅/에러 핸들링 고도화

- [x] `LoggingInterceptor` 개선 — NestJS Logger 사용, 에러 케이스 catchError 추가, 느린 요청(>3s) 경고
- [x] `GlobalExceptionFilter` 개선 — 메타데이터 보존(ConflictException 등), 요청 path 포함, 4xx=warn/5xx=error 로그 레벨 구분, 스택 트레이스 출력
- [x] `main.ts` — console.log → Logger('Bootstrap') 전환
- [x] `web/main.ts` — app.config.errorHandler 설정 (Vue 렌더링 에러 글로벌 처리)
- [x] API + Web 빌드 통과 확인

변경 파일 (4개):
- `packages/api/src/common/interceptors/logging.interceptor.ts`
- `packages/api/src/common/filters/http-exception.filter.ts`
- `packages/api/src/main.ts`
- `packages/web/src/main.ts`

### 3. Wrapsody 기능 분석 + 역공학

아래 별도 섹션 참조.

---

## Wrapsody 분석 — KMS 적용 가능 기능

### Wrapsody 핵심 아키텍처

**VCI (Virtual Content Infrastructure) — 문서가상화:**
- 모든 문서에 **Persistent ID** (고유 콘텐츠 ID)를 영구 부착
- 파일의 물리적 위치와 관계없이 논리적으로 통합 관리
- 모든 복사본/파생본을 원본과 연결 (**Pac-n-Tag** 기술)
- 체크인/체크아웃 없이 자동 버전 관리
- 파일 단위 암호화 (DRM) — 폴더가 아닌 개별 파일에 보안 적용
- 이미 배포된 문서의 권한을 사후에도 회수 가능
- 문서가 어디에 위치하든 동일 보안 정책 유지 (Zero Trust)

**제품 라인업:** Wrapsody (내부 관리) / Wrapsody Drive (문서중앙화) / Wrapsody SE (보안 강화) / Wrapsody eCo (외부 협업)

**AI 기능:** GenAI 기반 문서 요약/비교/검색/보고서 생성, Domain K-Master (문서 간 정보 연결 Q&A)

### 기능별 분석

| # | Wrapsody 기능 | KMS 현재 상태 | 적용 가능성 | 우선순위 |
|---|-------------|-------------|-----------|---------|
| 1 | **파일 해시 중복 방지** | O (SHA-256) | 이미 구현됨 | - |
| 2 | **문서 원본+바로가기** | O (DocumentPlacement) | 이미 구현됨 (VCI의 핵심 개념과 동일) | - |
| 3 | **버전 관리 (자동)** | △ (row_version 낙관적 잠금) | 파일 버전 이력 관리 필요 | **높음** |
| 4 | **ROT 데이터 탐지** | X | 미사용/오래된/중복 문서 자동 탐지 | 중간 |
| 5 | **감사 로그 (Audit)** | △ (document_history 테이블) | 사용자 활동 통계/대시보드 확장 | 중간 |
| 6 | **문서 DRM/암호화** | X | 범위 밖 (외주 위임 영역) | 낮음 |
| 7 | **실시간 백업** | X | Docker volume 백업으로 대체 가능 | 낮음 |
| 8 | **외부 협업 (eCo)** | X | 범위 밖 | - |
| 9 | **AI 검색/요약/비교** | X | Phase 3 후보 (외주 위임) | 향후 |
| 10 | **CAD 파일 보안** | X | 범위 밖 (PDF/MD/CSV만) | - |

### KMS에 적용할 만한 아이디어 (우선순위순)

#### 1. 파일 버전 이력 (높음)
현재 KMS는 `row_version`으로 동시성만 제어. Wrapsody처럼 파일 재업로드 시 이전 버전을 보존하는 기능이 필요.
- `document_versions` 테이블 추가 (document_id, version, file_path, file_hash, created_at)
- 파일 교체 시 이전 파일을 versions에 보관
- 문서 상세 뷰에 "버전 이력" 탭 추가

#### 2. ROT 데이터 탐지 대시보드 (중간)
- DRAFT 상태에서 N일 이상 방치된 문서 목록
- 배치되지 않은(orphan) 문서 중 오래된 것
- 같은 제목의 중복 문서 탐지
- 대시보드 "조치 필요" 섹션에 통합

#### 3. 감사 로그 + 사용 통계 확장 (중간)
현재 `document_history`는 문서 변경만 기록. Wrapsody처럼:
- 문서 열람(조회)/다운로드 로그 기록
- 사용자별 활동 통계
- "가장 많이 조회된 문서", "죽은 문서" 인사이트
- 관리자 대시보드에 "감사 로그" 뷰 추가

#### 4. 외부 공유 링크 (낮음 — 향후)
Wrapsody eCo에서 영감. 만료 기한 있는 외부 공유 링크 생성.
- `document_shares` 테이블 (document_id, token, expires_at, revoked_at, download_count)
- API Key 인증과 결합하여 외부 파트너에게 문서 공유 가능

#### 5. 보안 등급별 행위 제어 세분화 (낮음 — 향후)
현재는 보안 등급별 접근 가능 여부만 제어. Wrapsody처럼 등급별로:
- "열람만 허용" / "다운로드 차단" / "인쇄 차단" 세분화 가능
- 구현 예: 보안 등급에 따라 다운로드 링크 노출 여부 제어

#### 6. 배치(Placement)별 독립 메타데이터 (낮음 — 향후)
Wrapsody는 동일 문서가 다른 워크그룹에서 다른 권한/정책을 가짐.
- `DocumentPlacement`에 도메인별 태그, 도메인별 메모 등 추가 메타데이터 부여 가능

### Wrapsody vs KMS 설계 철학 비교

| 관점 | Wrapsody | KMS |
|------|----------|-----|
| 핵심 가치 | 보안 + AI 데이터 준비 | 체계 관리 프레임워크 |
| 문서 저장 | 중앙 서버 강제 | 서버 저장 (자유 업로드) |
| 복사본 관리 | Pac-n-Tag로 추적 | file_hash 중복 차단 |
| 보안 모델 | DRM + 암호화 + 화면캡처 차단 | 역할 기반 접근 제어 |
| 도메인 개념 | 없음 (폴더 구조) | 도메인 + 카테고리 트리 |
| 배치 모델 | 파일 = 폴더에 속함 | 원본 + 바로가기 (M:N) |
| 외부 협업 | eCo (공급망 보안) | 외부 API (API Key) |

**결론**: KMS의 "원본+바로가기" 모델은 Wrapsody VCI의 핵심 개념과 본질적으로 동일하며, 이미 올바른 방향. 파일 버전 이력과 ROT 탐지가 가장 실용적인 확장 포인트.

---

## 미커밋 변경 파일 (4개 — 로깅/에러 핸들링)

```
M packages/api/src/main.ts
M packages/api/src/common/filters/http-exception.filter.ts
M packages/api/src/common/interceptors/logging.interceptor.ts
M packages/web/src/main.ts
```

## 빌드 상태

- API: `nest build` 통과
- Web: `vue-tsc + vite build` 통과

## 다음 세션 TODO

1. 로깅/에러 핸들링 변경사항 커밋 & 푸시
2. 배포 (backend Docker rebuild + Vercel auto-deploy)
3. 파일 버전 이력 기능 설계/구현 검토
4. ROT 데이터 탐지 대시보드 확장 검토
