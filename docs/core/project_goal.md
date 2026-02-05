# KMS 지식관리체계 프로젝트

> **Version** 1.0 · 2026-02 · iFA IT팀

---

## 프로젝트 개요

### 문제 정의

보험 GA(법인보험대리점)에서 설계사들이 겪는 7대 지식관리 결함:

| # | 결함 유형 | 현상 | 영향 |
|---|----------|------|------|
| 1 | 시책 미반영 | 만료된 시책 정보 제공 | 수수료 오산정, 민원 |
| 2 | 보험사 혼동 | A사 기준을 B사에 적용 | 청약 반려, 신뢰 하락 |
| 3 | 조건 누락 | 심사조건 불완전 안내 | 가입 거절, 재심사 |
| 4 | 근거 부재 | 출처 없는 답변 | 검증 불가, 컴플라이언스 위험 |
| 5 | 용어 불일치 | 동일 개념 다른 명칭 | 혼란, 오해 |
| 6 | 버전 혼재 | 구/신 정보 혼용 | 잘못된 의사결정 |
| 7 | 암묵지 유실 | 베테랑 노하우 미전수 | 지식 단절 |

### 핵심 목표

**JSON 기반 문서 분류 체계를 검증하고, 향후 RAG 시스템의 기반 데이터를 구축한다.**

---

## 현실적 접근 전략

### 3단계 분리 실행 (피드백 반영)

| 단계 | 기간 | 목표 | 산출물 |
|------|------|------|--------|
| **A. 문서 분류기** | 4주 | 문서 자동 분류 + 메타데이터 태깅 | CLI 도구, SQLite DB |
| **B. RAG 챗봇 PoC** | 6주 | 메타데이터 필터 + 벡터 검색 | 질의응답 데모 |
| **C. 그래프 확장** | 12주+ | Neo4j 도입, 참조관계 관리 | Knowledge Graph |

### Phase A 우선 (현재 단계)

**KMS Admin 페이지로 검증:**
- 도메인 분류체계 (보험사/상품/문서유형) CRUD
- 문서 메타데이터 관리
- 관계 설정 및 양방향 동기화
- JSON 기반 데이터 내보내기/가져오기

---

## 3-Axis Taxonomy (분류 체계)

### WHO: 보험사 (Carrier)

| 코드 | 이름 | 별칭 |
|------|------|------|
| INS-SAMSUNG | 삼성생명 | 삼성, SL |
| INS-HANWHA | 한화생명 | 한화, HL |
| INS-KYOBO | 교보생명 | 교보, KL |

### WHAT: 상품군 (Product)

| 코드 | 이름 | 카테고리 |
|------|------|----------|
| PRD-LIFE-WHOLE | 종신보험 | 생명 |
| PRD-CHILD | 어린이보험 | 어린이/태아 |

### WHICH: 문서유형 (Document Type)

| 코드 | 이름 | Tier | 변경빈도 |
|------|------|------|----------|
| DOC-TERMS | 약관 | COLD | 연 1회 |
| DOC-GUIDE | 상품설명서 | WARM | 분기 |
| DOC-SCRIPT | 판매스크립트 | WARM | 분기 |
| DOC-INCENTIVE | 시책 | HOT | 수시 |
| DOC-COMMISSION | 수수료 | HOT | 수시 |
| DOC-TRAINING | 교육자료 | COLD | 연 1회 |

---

## Hot-Warm-Cold 전략

### 데이터 티어 분류

```
HOT  (수시 변경)  → 시책, 수수료, 보험료표
WARM (분기 변경)  → 상품설명서, 판매스크립트, 심사기준
COLD (연간 고정) → 약관, 교육자료, 규정
```

### 적용 원칙

- **검색 우선순위**: HOT > WARM > COLD
- **캐시 정책**: HOT는 매일 갱신, WARM은 주간, COLD는 분기
- **알림 정책**: HOT 변경 시 즉시 알림

---

## 문서 ID 체계

### 명명 규칙

```
{DOC-TYPE}-{CARRIER}-{PRODUCT}-{SEQ}
```

### 예시

| 문서 ID | 설명 |
|---------|------|
| `DOC-TERMS-INS-SAMSUNG-PRD-LIFE-WHOLE-001` | 삼성생명 종신보험 약관 |
| `DOC-INCENTIVE-INS-HANWHA-PRD-CHILD-001` | 한화생명 어린이보험 시책 |

---

## 관계 유형

### 양방향 동기화

| 관계 | 설명 | 동기화 |
|------|------|--------|
| parent/children | 부모-자식 계층 | O (역방향 자동) |
| siblings | 동일 레벨 형제 | O (상호 참조) |
| references | 참조 관계 | X (단방향) |

### 표준 연결 규칙

```
DOC-GUIDE    → [DOC-TERMS, DOC-SCRIPT]
DOC-SCRIPT   → [DOC-GUIDE, DOC-INCENTIVE]
DOC-INCENTIVE → [DOC-COMMISSION]
DOC-TRAINING → [DOC-TERMS, DOC-GUIDE]
```

---

## 검증 체크리스트

### Phase A 완료 기준

- [ ] 보험사 CRUD 동작 확인
- [ ] 상품 CRUD 동작 확인
- [ ] 문서 생성/삭제 시 관계 자동 정리
- [ ] 부모-자식 관계 양방향 동기화
- [ ] 형제 관계 양방향 동기화
- [ ] JSON 내보내기/가져오기
- [ ] MD 파일 업로드 시 메타데이터 파싱

### 다음 단계 진입 조건

1. Admin 페이지로 데이터 CRUD 검증 완료
2. 기존 36개 문서 마이그레이션 완료
3. 경영진 데모 및 피드백 수집

---

## 기술 스택 (Phase A)

| 영역 | 기술 | 비고 |
|------|------|------|
| UI | Petite-Vue + Tailwind | 단일 HTML 파일 |
| 그래프 시각화 | vis-network | CDN |
| 데이터 저장 | localStorage + JSON | 서버 불필요 |
| 아이콘 | Lucide Icons | CDN |

---

## 참고 문서

- `docs/architecture/architecture-guide.md` - 전체 아키텍처 가이드
- `docs/architecture/document-pipeline.md` - 문서 파이프라인 설계
- `core/domain_knowledge.md` - GA 산업 도메인 지식
