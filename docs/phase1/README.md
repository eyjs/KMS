# Phase 1: 분류체계 검증

> **Version** 3.0 | 2026-02 | 현재 단계

---

## 문서 구조

```
docs/phase1/
├── project-overview.md    ← 1. 기획서 (큰그림, 문제, 해결)
├── framework-spec.md      ← 2. 아키텍처 설계서 (구현 상세)
├── domain-template.md     ← 3. 도메인 추가 템플릿
├── ga-domain-example.md   ← 4. GA 도메인 구현 예시
└── README.md              ← 5. 실행 가이드 (현재 문서)
```

| 순서 | 문서 | 목적 | 대상 |
|------|------|------|------|
| 1 | **project-overview.md** | 왜 만드는가? 무엇을 해결하는가? | 의사결정자, 신규 합류자 |
| 2 | **framework-spec.md** | 어떻게 만드는가? (구현 명세) | 개발자, 설계자 |
| 3 | **domain-template.md** | 새 도메인 어떻게 추가? | 도메인 전문가 |
| 4 | **ga-domain-example.md** | 첫 번째 구현 사례 | 개발자 |

---

## 1. 목표

**JSON 기반 문서관리 프레임워크의 분류체계를 검증한다.**

서버 없이 브라우저에서 동작하는 Admin 페이지로:
- 시스템 프레임워크(불변)와 도메인 설정(가변) 분리 검증
- SSOT(Single Source of Truth) 유니크 제약 검증
- 문서 관계 전파 및 라이프사이클 동작 검증

---

## 2. 핵심 검증 항목

| 검증 항목 | 질문 | 현재 상태 |
|----------|------|----------|
| **프레임워크 분리** | 시스템/도메인이 명확히 분리되었는가? | SYSTEM_CONFIG + DOMAINS |
| **도메인 확장성** | 새 도메인 추가가 쉬운가? | DOMAINS dict에 추가만 |
| **분류 커버리지** | 모든 GA 문서를 분류 가능한가? | 6개 도메인, 60+ 문서유형 |
| **SSOT 보장** | 동일 경로에 중복이 방지되는가? | 유니크 제약 검증 |
| **라이프사이클** | 상태 전이가 올바르게 동작하는가? | 6단계 상태 머신 |
| **신선도 자동화** | 만료 시 자동 전환되는가? | HOT/WARM/COLD 티어별 |
| **관계 전파** | 연관 문서가 함께 조회되는가? | 5종 관계 타입 |

---

## 3. 기술 스택

| 영역 | 기술 | 비고 |
|------|------|------|
| 프레임워크 | Vue 3 CDN | 단일 HTML 파일 |
| 스타일링 | Tailwind CSS | CDN |
| 그래프 시각화 | vis-network | CDN |
| 데이터 저장 | localStorage + JSON | 서버 불필요 |
| 시뮬레이션 | Python | 데이터 생성 및 검증 |

---

## 4. 산출물

### 문서 산출물

| 산출물 | 파일 | 역할 |
|--------|------|------|
| 프로젝트 기획서 | `project-overview.md` | 큰그림, 문제, 해결 방안 |
| 아키텍처 설계서 | `framework-spec.md` | 구현 명세 (What + How) |
| 도메인 템플릿 | `domain-template.md` | 새 도메인 추가 가이드 |
| GA 도메인 예시 | `ga-domain-example.md` | 첫 번째 구현 사례 |
| 검증 결과 | `results/` | 온톨로지 검증 결과 |

### 코드 산출물

| 산출물 | 파일 | 역할 |
|--------|------|------|
| 시스템+도메인 정의 | `src/taxonomy.py` | 프레임워크의 마스터 정의 |
| 온톨로지 메타데이터 | `src/ontology.py` | 클래스 계층, 개념, 관계 |
| 문서 템플릿 | `src/doc_templates.py` | 60+ 문서 내용 템플릿 |
| 지식 그래프 생성 | `src/simulator.py` | 검증용 데이터 생성기 |
| 데이터 검증 | `src/verifier.py` | 무결성 검증 |
| 구조 검증 | `src/ontology_validator.py` | 온톨로지 6/6 테스트 |
| 관리 UI | `ui/admin-v3.html` | 계층 탐색 Admin 페이지 |

---

## 5. 검증 시나리오

### 시나리오 1: 문서 전파
```
시책 문서 선택 → 연관된 수수료, 상품설명서가 함께 조회되는가?
```

### 시나리오 2: SSOT 검증
```
같은 분류 경로에 ACTIVE 문서 2개 등록 시도
→ 기존 문서 자동 DEPRECATED 또는 중복 경고 발생
```

### 시나리오 3: 상품 개편
```
"든든 어린이보험 리뉴얼(2026-02)" 업로드
→ 기존 "든든 어린이보험"과 별개로 등록
→ 두 상품 간 "SUPERSEDES" 관계 설정 가능
```

### 시나리오 4: 자동 분류
```
"KB손해_든든어린이_상품요약_202602.pdf" 업로드
→ 보험사: KB손해보험
→ 상품: 든든 어린이보험
→ 유형: 상품요약본
→ 자동 제안
```

---

## 6. 완료 기준

| 기준 | 상태 |
|------|------|
| 시스템/도메인 분리 구조 검증 | Done |
| 6개 GA 도메인 정의 완료 | Done |
| 온톨로지 구조 검증 6/6 통과 | Done |
| 지식 그래프 840노드/2439엣지 생성 | Done |
| Admin UI 계층 탐색 동작 | Done |

---

## 7. 실행 명령어

```bash
# 데이터 생성
python src/taxonomy.py              # 분류체계 JSON 내보내기
python src/simulator.py             # 지식 그래프 + 샘플 문서 생성
python src/simulator_ontology.py    # 온톨로지 그래프 생성

# 검증
python src/verifier.py              # 데이터 무결성 검증
python src/ontology_validator.py    # 온톨로지 구조 검증

# UI 확인
npx serve . -p 8080
# http://localhost:8080/ui/admin-v3.html
```

---

## 8. 다음 단계

Phase 1 완료 후 → **Phase 2: 백엔드 구축**
- Vue 3 앱 + REST API
- Neo4j 그래프 DB
- Qdrant 벡터 DB
