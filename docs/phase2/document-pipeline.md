# Phase 2: 문서 파이프라인 설계

> **Version** 3.0 | 2026-02-08
> **목적**: 문서 수집/처리/활성화 파이프라인 상세 설계

---

## 1. 전체 흐름

```
┌─────────────────────────────────────────────────────────────────┐
│                    문서 수집 파이프라인 (8단계)                      │
└─────────────────────────────────────────────────────────────────┘

[소스]              [Stage 1~3: 수집/검증]        [Stage 4~6: 처리]

보험사 포털 ─┐
이메일     ─┤     (1)      (2)      (3)      (4)      (5)      (6)
스프레드시트─┼──▶ 감지 ──▶ 검증 ──▶ 분류 ──▶ 추출 ──▶ 청킹 ──▶ 임베딩
내부 작성  ─┤    Gate1    Gate2    Gate3    Gate4    Gate5    Gate6
전문가 입력 ─┘
                                              │
[Stage 7~8: 활성화]                            ▼
                                         (7)       (8)
                                     ──▶ 활성화 ──▶ 알림
                                        Gate7

실패 시: ──────▶ [격리 큐] ──▶ 수동 검토 ──▶ 재처리 or 폐기
```

---

## 2. 단계별 상세 설계

### Stage 1: 감지 (Detection)

**목적**: 신규/변경 문서 인입 감지

| 항목 | 내용 |
|------|------|
| 입력 | 외부 소스 (포털 크롤링, 이메일 첨부, 수동 업로드) |
| 출력 | 원본 파일 + 수집 메타데이터 (소스, 수집일시) |
| 처리 | 파일 해시(SHA-256) 생성, 중복 체크 |

**Gate 1: 중복/무결성 검증**
```
- 파일 해시 중복 체크 → 기존 동일 해시 존재 시 SKIP
- 파일 크기 > 0 bytes
- 지원 포맷: PDF, DOCX, XLSX, PPTX, HWP
- 파일 손상 여부 (열기 테스트)
```

### Stage 2: 검증 (Validation)

**목적**: 문서 진위 확인 및 필수 정보 존재 여부 검증

**Gate 2: 문서 품질 검증**
```
[공통 검증]
- OCR 가독성 점수 >= 0.8
- 텍스트 추출 가능 여부
- 페이지 수 > 0

[문서유형별 검증]
DOC-INCENTIVE:
  - 보험사명 식별
  - 유효기간 존재
  - 수수료율/인센티브 조건 존재

DOC-COMMISSION:
  - 등급별 수수료율 테이블 존재
  - 적용기간 식별

DOC-TERMS:
  - 조항 번호 체계 존재
  - 보험사/상품 식별
```

### Stage 3: 분류 (Classification)

**목적**: 도메인 및 facet 분류 태깅

**분류 전략**:
```
1순위: 파일명/경로 기반 규칙 (정규식 매칭)
       예: "삼성생명_종신보험_수수료체계_202602.pdf"
       → domain: GA-COMM, carrier: INS-SAMSUNG, product: PRD-LIFE-WHOLE

2순위: 본문 키워드 기반 규칙 매칭
       예: "시책", "인센티브" → DOC-INCENTIVE

3순위: LLM 기반 분류 (신뢰도 점수 포함)
       신뢰도 < 0.7 → 수동 검토 플래그
```

**Gate 3: 분류 완전성 검증**
```
- domain 필수
- 해당 도메인의 ssotKey facet 모두 태깅
- 자동분류 신뢰도 >= 0.7
```

### Stage 4: 추출 (Extraction)

**목적**: 구조화 데이터 및 핵심 조건 추출

**문서유형별 추출 대상**:

```
DOC-INCENTIVE:
  - program_name: 시책명
  - effective_date / expiry_date
  - conditions[]: 조건 목록
  - target_products[], target_tiers[]

DOC-COMMISSION:
  - tier_rates[]: 등급별 수수료율
  - initial_rate, renewal_rate
  - effective_date / expiry_date

DOC-RATE-TABLE:
  - 테이블 구조 보존 (Markdown)
  - 행/열 헤더 식별

DOC-TERMS:
  - 조항 단위 분리
  - 조항 간 참조 관계 추출
```

### Stage 5: 청킹 (Chunking)

**목적**: 검색에 최적화된 단위로 문서 분할

**문서유형별 청킹 전략**:

| 문서유형 | 청킹 전략 | 청크 크기 | 오버랩 |
|---------|----------|----------|-------|
| 약관 | 조항 단위 우선 | 512~1024 토큰 | 15% |
| 상품설명서 | 섹션 기반 | 256~512 토큰 | 10% |
| 보험료표/수수료 | 테이블 단위 보존 | 전체 테이블 | N/A |
| 시책 | 문서 단위 + 조건 구조화 | 256~512 토큰 | 10% |

**테이블 처리 원칙**:
```
절대 원칙: 테이블을 일반 텍스트로 평탄화하지 않는다.

보존 방식:
  1. Markdown 테이블 형식 유지
  2. 테이블 설명 메타데이터 함께 임베딩
  3. 큰 테이블은 논리적 단위로 분할
```

### Stage 6: 임베딩 (Embedding)

**목적**: 벡터 생성 및 Qdrant 인덱스 적재

**티어별 인덱스 분리**:

| 티어 | Collection | 재인덱싱 | 문서유형 |
|------|-----------|---------|---------|
| HOT | `idx_hot` | 매일 | 시책, 수수료, 보험료표 |
| WARM | `idx_warm` | 주간 | 상품설명서, 심사가이드 |
| COLD | `idx_cold` | 분기 | 약관, 교육자료 |

### Stage 7: 활성화 (Activation)

**목적**: 문서를 검색 가능 상태로 전환

**처리 순서**:
```
1. effective_date 확인
   - <= 오늘 → 즉시 활성화
   - > 오늘 → APPROVED 상태 대기

2. SSOT 충돌 처리
   - 동일 분류 경로에 기존 ACTIVE 문서 존재 시
   - → 기존 문서 자동 DEPRECATED

3. 관계 설정
   - 이전 버전과 SUPERSEDES 관계
   - 관련 문서와 REFERENCE 관계

4. 캐시 무효화
```

### Stage 8: 알림 (Notification)

**목적**: 관련자에게 변경 사항 통지

```
알림 대상:
  DOC-INCENTIVE → 해당 보험사 담당 설계사
  DOC-COMMISSION → 전체 설계사 + 정산 담당자
  DOC-TERMS → 전체 공지

알림 내용:
  - 문서명, 변경 요약
  - 이전 버전과의 주요 차이
  - 유효기간
```

---

## 3. 청크 메타데이터 스키마

```json
{
  "chunk_id": "UUID",
  "document_id": "UUID",
  "chunk_sequence": 1,
  "chunk_type": "text | table | structured",

  "facet_tags": {
    "domain": "GA-SALES",
    "carrier": "INS-SAMSUNG",
    "product": "PRD-LIFE-WHOLE",
    "docType": "DOC-COMMISSION"
  },

  "temporal": {
    "valid_from": "2026-02-01",
    "valid_to": "2026-03-31"
  },

  "content": {
    "text": "청크 본문...",
    "parent_section": "3. 수수료 체계",
    "has_table": true
  },

  "data_tier": "hot"
}
```

---

## 4. 물리적 저장소 구조

```
/knowledge-base/
├── /originals/                    # 원본 파일 (불변)
│   └── /{YYYY}/{MM}/
│       └── {SHA256}_{원본파일명}
│
├── /processed/                    # 처리 완료 파일
│   └── /{domain}/
│       └── /{carrier}/
│           └── /{docType}/
│
├── /quarantine/                   # 격리 큐
│   └── /{YYYY-MM-DD}/
│
├── /extracted/                    # 추출된 구조화 데이터
│   └── /{DocumentID}/
│       └── chunks/
│
└── /archive/                      # 아카이브
    └── /{YYYY}/
```

---

## 5. 파일 명명 규칙

```
패턴: {carrier}_{docType}_{product}_{YYYYMMDD}_v{Major}.{Minor}.{ext}

예시:
  SAMSUNG_INCENTIVE_LIFE-WHOLE_20260201_v1.0.pdf
  KB_COMMISSION_COMMON_20260115_v2.0.xlsx
  COMMON_UW-GUIDE_HEALTH-CI_20260101_v1.1.pdf

특수 케이스:
  - 보험사 무관: COMMON
  - 상품 무관: COMMON
```

---

## 6. 참고 문서

- `docs/shared/framework-overview.md` - 프레임워크 개요
- `docs/phase2/README.md` - Phase 2 개요
