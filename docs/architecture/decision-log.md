# 아키텍처 의사결정 기록 (Decision Log)

> 왜 이렇게 만들었는가? 어떤 선택지가 있었고, 왜 그걸 골랐는가?
> 나중에 다시 읽으면 새로운 아이디어가 떠오를 수 있도록, 고민의 과정을 남긴다.

---

## ADR-001: Python 단독 vs 풀스택 TypeScript (2026-02-05)

**상황**: Phase 1을 Python + JSON + HTML로 만들었다. Phase 2를 어떤 언어로 할 것인가.

**선택지:**
| 방안 | 장점 | 단점 |
|------|------|------|
| A. Python 풀스택 (Django/FastAPI) | Phase 1 자산 재활용, NLP 직결 | 프론트엔드 약함, 운영팀 Python 역량 없음 |
| B. .NET + Vue (기존 IT팀 역량) | 팀이 유지보수 가능, 안정적 | 문서 처리 역량 부재 |
| C. NestJS + Vue (풀스택 TS) | 타입 공유, 프론트/백 동일 언어 | 팀 학습 필요, NLP 불가 |

**결정**: **C. NestJS + Vue 3 (풀스택 TypeScript)**

**이유:**
- 핵심 통찰: "문서 처리"와 "문서 체계 관리"는 다른 문제. 우리가 풀 문제는 **체계 관리**
- 문서 파싱/NLP/벡터화는 어차피 외주 → 그쪽이 Python 쓰면 됨
- 체계 관리는 CRUD + 관계 + 분류 → TypeScript로 충분하고, **타입 공유가 크게 유리**
- `@kms/shared`에 타입/상수를 한번 정의하면 프론트/백 모두 사용 → 정합성 확보
- Python은 Phase 3에서 조건부 도입 (예산 5천만+, 인력 확보 시)

**교훈**: 기술 선택은 "뭘 할 수 있는가"보다 "뭘 풀어야 하는가"에 맞춰야 한다.

→ 상세 비교: [`tech-stack-decision.md`](./tech-stack-decision.md)

---

## ADR-002: Monorepo 패키지 관리자 전쟁 (2026-02-09)

**상황**: 모노레포를 pnpm + Turborepo로 세팅했는데 Vercel 배포에서 계속 실패.

**삽질 타임라인:**
1. pnpm + Turbo로 시작 → Vercel에서 `pnpm --filter` 인식 못함
2. Vercel outputDirectory 경로 수정 → 여전히 실패
3. Turbo 감지 우회 시도 → Vercel이 turbo.json을 자동 감지해서 빌드 파이프라인 변경
4. vite outDir을 루트로 직접 지정 → 빌드는 되는데 경로 꼬임
5. **pnpm → npm 전환** → 조금 나아짐
6. Turbo 완전 제거, npm 순정 워크스페이스 → Vercel이 workspaces 감지해서 Root Directory를 자동 변경
7. **npm workspaces도 제거** → Vercel이 캐싱한 설정이 남아있어서 여전히 실패
8. Vercel 프로젝트 삭제 후 재생성 → **성공**

**결정**: **npm (workspaces 미사용) + vite alias로 shared 해결**

**최종 구조:**
```
web  → vite alias + tsconfig paths → ../shared/src (TS 소스 직접 컴파일)
api  → "file:../shared" → ../shared/dist (CommonJS 빌드)
```

**교훈:**
- Vercel은 monorepo 도구를 **자동 감지**하고 자기만의 빌드 파이프라인을 강제한다
- pnpm, Turbo, npm workspaces 모두 Vercel과 궁합이 안 맞을 수 있다
- 가장 단순한 구조(순정 npm + alias)가 가장 안정적이었다
- Vercel의 캐싱은 프로젝트 삭제-재생성으로만 초기화된다
- **단순함을 과소평가하지 말 것.** 도구가 많을수록 깨질 곳도 많다

---

## ADR-003: 도메인을 flat에서 트리로 (2026-02-09)

**상황**: 처음에 도메인을 `GA-SALES`, `GA-COMM` 같은 flat 코드로 만들었다. 사용자에게 계층이 안 보임.

**선택지:**
| 방안 | 장점 | 단점 |
|------|------|------|
| A. Flat 코드 유지 | 단순, 쿼리 쉬움 | 사용자가 구조를 인지 못함, 확장 어려움 |
| B. 고정 2레벨 (부모-자식) | 적당히 단순 | 3레벨 이상 필요할 때 한계 |
| C. 무제한 깊이 트리 (self-referencing) | 유연, 실제 업무 구조 반영 | 재귀 쿼리 필요, UI 복잡 |

**결정**: **C. 무제한 깊이 트리 (최대 4단계 제한)**

**이유:**
- 실제 업무 구조는 계층적: `사업영역 → 업무영역 → 세부업무 → 프로세스`
- `parentCode` 하나 추가로 구현 가능, Prisma가 self-relation 잘 지원
- 사이드바에서 트리로 탐색하면 직관적
- 4단계 제한은 과도한 깊이 방지 + 쿼리 성능 보장

**주의점**: "도메인 = 업무 단위"라는 원칙을 계속 강조해야 함. 사용자가 "영업본부", "법인팀" 같은 **조직 기반** 도메인을 만들려고 하면 안 됨. UI에 가이드 문구 추가함.

---

## ADR-004: EAV 패턴으로 분류 체계 설계 (2026-02-06~09)

**상황**: 문서에 붙는 분류가 도메인마다 다르다. 영업은 (보험사, 상품, 문서유형), 교육은 (문서유형)만 필요.

**선택지:**
| 방안 | 장점 | 단점 |
|------|------|------|
| A. 컬럼 추가 (carrier, product, docType) | 타입 안전, 쿼리 간단 | 도메인 추가 시 스키마 변경 필요 |
| B. JSON 필드 하나에 다 넣기 | 유연 | 인덱싱 어려움, 정합성 보장 불가 |
| C. EAV (facet_type + facet_value) | 유연 + 인덱싱 가능 | 조인 많음, 쿼리 복잡 |

**결정**: **C. EAV (Entity-Attribute-Value)**

**구현:**
```
classifications 테이블:
  document_id | facet_type | facet_value
  doc-001     | carrier    | INS-SAMSUNG
  doc-001     | product    | PRD-LIFE-WHOLE
  doc-001     | docType    | DOC-TERMS
```

**이유:**
- 도메인별 필수 분류가 다름 → 컬럼 방식은 NULL 범벅이 됨
- `facet_type_master`로 분류 유형을 동적 관리 → 스키마 변경 없이 확장
- `@@unique([documentId, facetType])` → 문서당 유형별 1개 값 보장
- SSOT는 classification_hash로 동일 분류 조합의 ACTIVE 문서를 1개로 제한

**고민했던 점:**
- EAV의 전통적 단점(쿼리 복잡성)이 걱정이었지만, 분류 유형이 3~5개 수준이라 조인이 감당 가능
- PostgreSQL의 JSONB 인덱싱도 고려했지만, 개별 facet 검색 시 EAV가 더 직관적
- classification_hash를 SHA256으로 만들어서 동일 분류 조합 탐지 → SSOT 트리거에 활용

---

## ADR-005: 권한 체계 — 직급이 아닌 업무 역할 (2026-02-10)

**상황**: 처음에 직급 기반(사원→대리→과장→부장)으로 설계했다가 고민이 생김.

**문제:**
- 직급은 조직마다 다르고, 바뀌기도 함 (직급 체계 개편)
- 실제로 "기밀 문서를 볼 수 있는가"는 직급이 아니라 **업무 역할**에 따름
- 신입이어도 보안 담당이면 기밀 문서를 봐야 하고, 부장이어도 다른 팀이면 안 됨

**결정**: **업무 역할 기반 5단계**
```
VIEWER(0) → EDITOR(1) → REVIEWER(2) → APPROVER(3) → ADMIN(4)
조회자      작성자       검토자        승인자        관리자
```

**이유:**
- "누가 어떤 등급의 문서를 볼 수 있는가"만 제어하면 됨
- 문서 보안 등급(PUBLIC~SECRET)과 역할 수준을 매핑하면 깔끔
- 조직이 바뀌어도 역할 재부여만 하면 됨
- ADMIN 자기보호: 관리자가 실수로 자기 역할을 내리거나 비활성화하는 것 방지

**미래 고민:**
- 팀/부서별 접근 제어가 필요해지면? → Phase 3에서 RBAC 확장 검토
- 현재는 역할이 "전역"인데, 도메인별 역할이 필요해질 수도 있음
- 하지만 지금 단계에서 과설계하면 복잡성만 증가 → **YAGNI 원칙 적용**

---

## ADR-006: .NET에서 NestJS로 전환 (2026-02-09)

**상황**: 원래 기술 검토(`tech-stack-decision.md`)에서는 .NET Core를 계획했지만, 실제 구현을 시작하면서 재검토.

**전환 이유:**
1. **타입 공유의 실질적 이점**: `@kms/shared`에서 DTO/Enum을 한번 정의하면 프론트/백 동시 사용. .NET은 C# ↔ TypeScript 타입 변환이 필요
2. **Prisma ORM**: TypeScript 네이티브, 스키마 자동 생성, 마이그레이션 일체형. .NET의 EF Core보다 스키마 관리가 편리
3. **1인 개발**: 풀스택 TypeScript면 컨텍스트 스위칭 없음
4. **NestJS의 구조**: 모듈/서비스/컨트롤러 패턴이 .NET과 유사해서 구조적 장점은 유지

**트레이드오프:**
- .NET의 성능 우위를 포기 → 하지만 이 시스템은 동시 사용자 10명 이내, 성능이 병목이 아님
- 기존 IT팀의 .NET 역량을 활용 못함 → 하지만 어차피 1인 개발, 유지보수 인수인계 시 재교육 필요

---

## ADR-007: Facet Type을 하드코딩에서 동적 관리로 (2026-02-11)

**상황**: 처음에 분류 유형(carrier, product, docType)을 코드에 직접 박아놨다. 관리자가 새 분류 유형을 추가하려면 개발자가 코드를 수정해야 함.

**고민:**
- 보험 업종 전용 시스템에서 범용 문서관리 프레임워크로 전환하고 싶음
- "부서", "지역", "프로젝트" 같은 분류 유형을 관리자가 직접 추가할 수 있어야 함
- 하지만 `docType`은 시스템 핵심 — 삭제되면 안 됨

**결정**: **Facet Type Registry + isSystem 플래그**

**구현:**
- `facet_type_master` 테이블에 `is_system` 컬럼 추가
- `isSystem=true`: 삭제 불가, 코드 접두어 변경 불가 (시스템 보호)
- `isSystem=false`: 관리자가 자유롭게 CRUD
- `/admin/settings` UI에서 분류 유형 관리
- 시드 데이터: `docType`만 시스템으로, 나머지는 관리자가 필요에 따라 추가

**동시에 진행한 변경:**
- 보험 업종 특화 시드(보험사 10, 상품 9) → 범용 시드(문서유형 12종만)로 교체
- 도메인: GA/SALES/COMM 등 → ROOT/GENERAL/ADMIN/TECH로 범용화
- **핵심**: 프레임워크는 업종 무관해야 한다. 업종 특화는 시드 데이터로.

**교훈**: 처음부터 범용으로 만들면 추상적이 됨. **특화된 것을 먼저 만들고, 패턴이 보이면 범용화**하는 게 실전적.

---

## ADR-008: CJS/ESM 충돌 해결 — shared 패키지 이중 전략 (2026-02-09)

**상황**: `@kms/shared`를 API(NestJS, CommonJS)와 Web(Vite, ESM) 양쪽에서 써야 하는데, 모듈 시스템이 다름.

**증상:**
- shared를 ESM으로 빌드 → NestJS에서 `require()` 실패
- shared를 CJS로 빌드 → Vite에서 tree-shaking 안 됨
- dual export(CJS + ESM) 시도 → 패키지 설정 복잡, Vercel에서 깨짐

**결정**: **이중 전략**
```
API  → "file:../shared"  → dist/ (CJS 빌드)     ← tsconfig: module=CommonJS
Web  → vite alias         → src/ (TS 소스 직접)  ← Vite가 자체 컴파일
```

**이유:**
- Vite는 TypeScript 소스를 직접 컴파일할 수 있음 → shared의 빌드 결과물이 필요 없음
- NestJS는 CommonJS 필요 → shared를 CJS로 빌드하면 충분
- 두 경로가 완전히 분리되어 있어서 충돌 자체가 발생하지 않음

**핵심 깨달음**: "하나의 패키지로 두 세계를 만족시키려" 하지 말고, **각자의 방식으로 소비하게** 하면 된다.

---

## ADR-009: SSOT 구현 — 트리거 vs 애플리케이션 레벨 (2026-02-06~09)

**상황**: "동일 분류 경로에 ACTIVE 문서는 1개만" 규칙을 어디서 강제할 것인가.

**선택지:**
| 방안 | 장점 | 단점 |
|------|------|------|
| A. 애플리케이션에서만 검증 | 구현 쉬움, 에러 메시지 친절 | 직접 DB 접근 시 우회 가능 |
| B. DB 트리거에서만 강제 | 우회 불가능, 데이터 무결성 확실 | 에러 메시지 불친절, 디버깅 어려움 |
| C. 양쪽 모두 (이중 검증) | 완벽한 보장 | 로직 중복, 불일치 위험 |

**결정**: **C. 양쪽 모두**, 단 역할을 분리
- **애플리케이션**: 사전 검증 + 친절한 에러 메시지 + 자동 DEPRECATED 전환
- **DB 트리거**: 최종 안전장치 (classification_hash + lifecycle = ACTIVE 유니크 체크)

**이유:**
- SSOT 위반은 데이터 오염 → DB 레벨 보장 필수
- 하지만 트리거 에러는 "unique violation"뿐이라 사용자가 이해 못함
- 애플리케이션에서 먼저 체크하고 "기존 ACTIVE 문서를 만료 처리할까요?" 물어보는 게 UX상 좋음

---

## ADR-010: 피드백 채널 — 별도 서비스 vs 내장 (2026-02-11)

**상황**: 사용자 피드백을 받을 채널이 필요. 이메일? 별도 서비스(JIRA)? 시스템 내장?

**선택지:**
| 방안 | 장점 | 단점 |
|------|------|------|
| A. 이메일/슬랙 링크 | 구현 0 | 추적 불가, 흩어짐 |
| B. 외부 서비스 연동 (JIRA 등) | 이슈 트래킹 | 추가 비용, 연동 복잡 |
| C. 시스템 내장 | 즉시 피드백, 페이지 URL 자동 캡처 | 별도 구현 필요 |

**결정**: **C. 시스템 내장 (플로팅 버튼)**

**이유:**
- 사용자가 문제를 발견한 **그 순간, 그 페이지에서** 바로 보낼 수 있어야 함
- 현재 페이지 URL이 자동 첨부되면 "어디서 문제가 생겼는지" 추적이 쉬움
- 구현 비용이 낮음 (Feedback 테이블 + CRUD + 플로팅 버튼)
- 나중에 JIRA 연동이 필요하면 Feedback → JIRA webhook만 추가하면 됨

---

## ADR-011: 문서-도메인 관계 재설계 — 소속에서 바로가기로 (검토중, 2026-02-11)

> **시연 후 착수 예정** — 시스템 근간을 건드리는 수술이므로, 현재 버전 시연 완료 후 진행

**현재 구조의 문제:**
```
현재: Document --belongs_to--> Domain (1:1, FK 직접 소속)
      업로드 시 도메인 선택 필수 → 문서가 도메인에 "갇힘"
```
- 같은 문서를 영업팀과 계약팀에서 모두 봐야 하면? → 복사본 생성 → **"최종_최최종" 문제 발생**
- 원본이 갱신되면 복사본은 그대로 → 정보 불일치
- 도메인 간 문서 이동이 어려움 (FK 변경 + 분류 재설정 필요)

**제안 구조:**
```
미래: Document (원본, 도메인 무관)
        ↑
      DocumentPlacement --shortcut--> Domain (N:M, 바로가기)

업로드 → "내 문서함" → 사용자가 도메인에 배치 (바로가기 생성)
```

**핵심 발상: Windows 바로가기 + 탐색기**
- 원본 파일은 한 곳에만 존재
- 여러 폴더에 "바로가기"를 만들어 배치
- 원본을 수정하면 모든 바로가기에서 최신 내용이 보임
- 바로가기를 삭제해도 원본은 안 사라짐

**사용자 워크플로우 변화:**
```
현재:  업로드(도메인 선택 필수) → 분류 → 끝
미래:  업로드(도메인 없이) → "내 문서함"에 쌓임
       → 도메인 생성/선택 → 분류 체계 설정
       → 문서를 도메인에 "배치" (바로가기)
       → 같은 문서를 다른 도메인에도 배치 가능
```

**새로 필요한 것:**
1. **내 문서함 뷰**: 본인이 업로드한 문서 모아보기 (미배치 문서 강조)
2. **DocumentPlacement 테이블**: `document_id + domain + classifications`
3. **업로드 플로우 변경**: 도메인 선택을 필수에서 선택으로
4. **배치 UI**: 도메인 트리에 드래그앤드롭 또는 배치 다이얼로그

**DB 변경 예상:**
```sql
-- 현재
documents.domain VARCHAR(20) FK → domain_master  -- 1:1 소속

-- 미래
document_placements (
  id UUID PK,
  document_id UUID FK → documents,
  domain VARCHAR(20) FK → domain_master,
  classifications JSONB,         -- 이 배치에서의 분류
  placed_by UUID FK → users,     -- 누가 배치했나
  placed_at TIMESTAMP,
  UNIQUE(document_id, domain)    -- 같은 도메인에 중복 배치 방지
)
-- documents.domain 컬럼 제거 또는 "primary_domain"으로 변경
```

**풀어야 할 설계 질문:**
- [ ] SSOT는 배치 단위? 원본 단위? (같은 원본이 영업 도메인에서 ACTIVE, 기술 도메인에서 DRAFT일 수 있나?)
- [ ] 분류(classification)는 원본에 붙나, 배치에 붙나, 둘 다?
- [ ] 라이프사이클은 원본 레벨? 배치 레벨?
- [ ] 검색 결과에서 원본으로 보여줄 것인가, 배치별로 보여줄 것인가?
- [ ] 배치를 삭제하면 원본은? (당연히 유지, 하지만 "고아 문서" 관리 정책은?)
- [ ] 기존 `documents.domain` FK에 의존하는 코드가 몇 개인가? (마이그레이션 범위)

**영향 범위 (크다):**
- DB 스키마: documents 테이블 변경 + 새 테이블
- API: 업로드/검색/목록 전부 수정
- Frontend: 업로드 플로우, 도메인 워크스페이스, 검색, 대시보드
- 트리거: SSOT 로직 재작성

**전략**: 시연 → 피드백 수렴 → 설계 확정 → 단계적 마이그레이션

---

## ADR-012: 문서 파싱 인프라 — 추상화 레이어 + 교체 가능 백엔드 (검토중, 2026-02-11)

**발상**: 문서 파싱(PDF → 텍스트/Markdown 변환)을 외주 대신 **직접 시도**해보되,
실패하면 솔루션이나 Google Document AI로 바꿀 수 있게 **인프라 레벨에서 추상화**.

### 핵심 원칙: KMS는 "어떻게 파싱하는지" 모른다

```
┌──────────────────────────────────────────────────────┐
│  KMS (NestJS)                                        │
│                                                      │
│  DocumentsModule                                     │
│    └─ upload() → ParsingClient.parse(file) ──────┐   │
│                                                  │   │
│  ParsingClient (추상 인터페이스)                    │   │
│    - parse(file): Promise<ParseResult>           │   │
│    - getStatus(jobId): Promise<JobStatus>         │   │
└──────────────────────────────────────────┬───────────┘
                                           │
               ┌───────────────────────────┼──────────────────────┐
               │                           │                      │
     ┌─────────▼─────────┐   ┌────────────▼────────┐  ┌─────────▼──────────┐
     │ LocalPythonParser  │   │ GoogleDocAIParser   │  │ ExternalAPIParser  │
     │ (subprocess/HTTP)  │   │ (Document AI API)   │  │ (외주 솔루션)      │
     │                    │   │                     │  │                    │
     │ PyMuPDF + 직접구현 │   │ Google Cloud 호출   │  │ 벤더 API 호출     │
     └────────────────────┘   └─────────────────────┘  └────────────────────┘
```

### 인터페이스 계약 (구현체가 뭐든 이것만 지키면 됨)

```typescript
// packages/shared 또는 api 내부
interface ParseRequest {
  fileBuffer: Buffer
  fileType: 'pdf' | 'md' | 'csv'
  fileName: string
  options?: {
    extractImages?: boolean   // 이미지 추출 여부
    ocrLanguage?: string      // OCR 언어 힌트 ('ko', 'en')
  }
}

interface ParseResult {
  success: boolean
  markdown: string            // ★ 핵심: 모든 결과는 Markdown으로 통일
  metadata: {
    pageCount?: number
    wordCount?: number
    language?: string
    extractedImages?: string[] // 이미지 경로
  }
  rawText?: string            // 순수 텍스트 (검색 인덱싱용)
  confidence?: number         // 파싱 품질 점수 (0~1)
  processingTimeMs: number
}
```

**★ 모든 출력을 Markdown으로 통일하는 이유:**
- PDF → Markdown 변환이 핵심. 원본은 PDF로 보관, **파싱 결과는 Markdown으로 저장**
- Markdown이면 기존 MarkdownViewer로 바로 렌더링 가능
- 검색 인덱싱 시 rawText 사용
- CSV는 이미 텍스트이므로 Markdown 테이블로 변환하면 끝
- 나중에 벡터 임베딩(Phase 3)도 rawText에서 바로 추출

### 파싱 플로우

```
사용자 업로드
    │
    ▼
┌─ KMS API ──────────────────────────────────┐
│  1. 원본 파일 저장 (storage/originals/)     │
│  2. ParsingClient.parse(file) 호출          │
│  3. 결과 Markdown 저장 (storage/parsed/)    │
│  4. DB에 parsed_path, raw_text 기록        │
└────────────────────────────────────────────┘
    │
    ▼
┌─ Viewer 우선순위 ──────────────────────────┐
│  PDF  → parsed Markdown 있으면 → MD 뷰어   │
│         없으면 → pdf.js 뷰어 (기존)         │
│  MD   → 그대로 MD 뷰어                      │
│  CSV  → 테이블 뷰어 (기존)                  │
└────────────────────────────────────────────┘
```

### Python 스크립트 구현 계획 (1차: LocalPythonParser)

```
scripts/parser/
├── main.py              # FastAPI 또는 stdin/stdout CLI
├── parsers/
│   ├── __init__.py
│   ├── pdf_parser.py    # PyMuPDF (fitz) — 텍스트 추출 + 레이아웃 보존
│   ├── md_parser.py     # 패스스루 (이미 Markdown)
│   └── csv_parser.py    # CSV → Markdown 테이블 변환
├── converters/
│   └── to_markdown.py   # 추출 결과 → Markdown 정규화
└── requirements.txt     # pymupdf, fastapi (선택), uvicorn (선택)
```

**연결 방식 선택지:**
| 방식 | 장점 | 단점 |
|------|------|------|
| A. subprocess (CLI) | 가장 단순, 배포 쉬움 | 매 요청마다 프로세스 생성 오버헤드 |
| B. HTTP (FastAPI sidecar) | 상시 구동, 빠름, 독립 배포 | Docker 컨테이너 하나 더 |
| C. Message Queue (Redis) | 비동기, 대용량 적합 | 인프라 복잡, 현 단계에서 과설계 |

→ **B안 추천**: FastAPI sidecar로 시작. Docker Compose에 `parser` 서비스 추가하면 끝.

### 교체 시나리오

```
1차: LocalPythonParser (PyMuPDF)
     → PDF 텍스트 추출 시도
     → 한글 깨짐, 스캔 PDF 실패 시...

2차: GoogleDocAIParser (Google Document AI)
     → API 키만 설정하면 교체 완료
     → OCR 포함, 한글 지원
     → 비용: 페이지당 약 $0.01~0.065

3차: 외주 솔루션 (벤더 API)
     → 같은 인터페이스로 래핑
```

NestJS 쪽에서는 **환경변수 하나로 교체**:
```
PARSER_BACKEND=local    # 또는 google-docai, external
PARSER_URL=http://parser:8000  # local/sidecar용
GOOGLE_DOCAI_PROJECT=...       # Google용
```

### 풀어야 할 질문
- [ ] 파싱 실패 시 정책: 원본만 저장하고 "파싱 실패" 표시? 재시도?
- [ ] 파싱 결과 저장 위치: DB TEXT 컬럼? 파일 시스템? 둘 다?
- [ ] 비동기 처리: 대용량 PDF는 업로드 즉시 응답 + 백그라운드 파싱?
- [ ] 스캔 PDF (이미지만 있는 PDF): OCR 필수 → LocalParser로는 한계
- [ ] 파싱 결과 버전: 원본 재업로드 없이 파서만 업그레이드하면 재파싱 필요?

### 구현 순서 (단계적)
1. 인터페이스 정의 (`ParseRequest`, `ParseResult`)
2. Python CLI 스크립트 (`scripts/parser/`) — PyMuPDF로 PDF→MD
3. NestJS에 `ParsingClient` 추상 클래스 + `LocalPythonParser` 구현
4. 업로드 시 자동 파싱 → `storage/parsed/` 저장
5. 뷰어에서 파싱 결과 우선 표시
6. (실패 시) Google Document AI 백엔드 추가

---

## 미결 과제 / 향후 고민거리

### 도메인별 역할 (RBAC 확장)
현재 역할은 전역 (ADMIN이면 모든 도메인에 ADMIN). 도메인별로 다른 역할이 필요해지면?
- 예: 영업 도메인은 APPROVER, 기술 도메인은 EDITOR
- 접근: `user_domain_roles` 중간 테이블? 또는 attribute-based access control?

### 버전 관리 심화
현재 `versionMajor.versionMinor`만 있음. 진짜 "이전 버전 내용"을 보려면?
- 파일 자체를 버전별로 저장? 스토리지 비용
- SUPERSEDES 관계로 버전 체인만 유지? 내용 비교 불가

### 검색 고도화
현재 LIKE 검색. 문서가 1만건 넘어가면?
- PostgreSQL full-text search (ts_vector)?
- Elasticsearch 도입?
- pgvector + 임베딩 (Phase 3와 연결)?

### 알림 시스템
- 문서 만료 임박 알림
- 피드백 처리 완료 알림
- 이메일? 인앱 알림? 둘 다?

### 감사 로그 (Audit Trail)
- 현재 `document_history`가 문서 변경만 추적
- 로그인/로그아웃, 권한 변경, 시스템 설정 변경도 추적해야 하나?
- 규제 요건에 따라 결정

---

## 변경 이력

| 날짜 | ADR | 요약 |
|------|-----|------|
| 2026-02-05 | ADR-001 | Python → 풀스택 TS 결정 |
| 2026-02-06 | ADR-004, 009 | EAV 분류 + SSOT 이중 검증 |
| 2026-02-09 | ADR-002, 003, 006, 008 | Vercel 전쟁, 트리 도메인, NestJS 전환, CJS/ESM |
| 2026-02-10 | ADR-005 | 업무 역할 기반 권한 |
| 2026-02-11 | ADR-007, 010 | Facet Type 동적화 + 피드백 채널 |
| 2026-02-11 | ADR-011 | **검토중** — 문서-도메인 바로가기 모델 (시연 후 착수) |
| 2026-02-11 | ADR-012 | **검토중** — 문서 파싱 추상화 레이어 (업로드 고도화부터 시작) |
