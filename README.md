# KMS - 지식관리체계 시스템

> GA(법인보험대리점) 문서/지식 분류체계 검증 시스템

AI RAG 시스템 구축 전, 전사 지식체계를 수립하고 검증하기 위한 프로젝트입니다.

## 프로젝트 단계

| 단계 | 목표 | 상태 |
|------|------|------|
| **Phase A** | 문서 분류체계 검증 (Admin 페이지) | 진행중 |
| **Phase B** | 전사 지식관리 시스템 구축 (Vue 앱) | 예정 |
| **Phase C** | AI RAG 시스템 연동 | 예정 |

## 핵심 기능

### 3-Axis Taxonomy (문서 분류 체계)

```
WHO (보험사)  →  WHAT (상품)  →  WHICH (문서유형)
   삼성생명        종신보험           약관
   한화생명        어린이보험         상품설명서
   교보생명        든든어린이         시책/수수료
   KB손해보험      ...               교육자료
```

### 문서 관계

| 관계 | 설명 | 방향 |
|------|------|------|
| siblings | 형제 문서 | 양방향 |
| references | 참조 문서 | 단방향 |
| supersedes | 상품 개편 (신→구) | 단방향 |

### Hot-Warm-Cold 티어

| Tier | 문서유형 | 변경빈도 |
|------|----------|----------|
| HOT | 시책, 수수료 | 수시 |
| WARM | 상품설명서, 스크립트 | 분기 |
| COLD | 약관, 교육자료 | 연간 |

## 실행 방법

### Admin 페이지 (Phase A)

```bash
# 방법 1: 직접 열기
start kms-admin.html

# 방법 2: 로컬 서버
npx serve . -p 8080
# http://localhost:8080/kms-admin.html 접속
```

### 테스트 실행

```bash
npm install
npx serve . -p 8080 &
node test-scenarios.js
```

## 화면 구성

### 그래프 뷰
- vis-network 기반 문서 관계 시각화
- 보험사(보라) → 상품(파랑) → 문서(HOT/WARM/COLD 색상)
- 노드 클릭 시 상세 정보 표시

### 목록 뷰
- 문서 테이블 (36개 샘플)
- 문서 클릭 → 중앙에 내용 편집, 오른쪽에 메타데이터
- CRUD 지원 (생성/조회/수정/삭제)

### 검증 뷰
- 유니크 검증: 중복 문서 감지
- 전파 검증: 연관 문서 하이라이트
- 관계 규칙 표시
- 통계 대시보드

## 검증 시나리오

1. **문서 전파**: 시책 문서 선택 → 연관된 수수료 문서 조회
2. **유니크 검증**: 동일 경로 중복 등록 시 경고
3. **상품 개편**: 신규 상품에 supersedes 관계 설정
4. **자동 분류**: 파일명에서 보험사/상품/문서유형 자동 추출

## 기술 스택

- **Frontend**: Vue 3 (CDN), Tailwind CSS
- **그래프**: vis-network
- **데이터**: localStorage + JSON
- **테스트**: Playwright

## 디렉토리 구조

```
KMS/
├── kms-admin.html      # 메인 Admin 페이지
├── viewer.html         # 그래프 뷰어
├── knowledge_graph.json # 그래프 데이터
├── CLAUDE.md           # 프로젝트 규칙
├── test-scenarios.js   # Playwright 테스트
├── taxonomy.py         # 마스터 데이터 정의
├── simulator.py        # 샘플 데이터 생성
└── docs/
    ├── core/           # 핵심 문서
    ├── architecture/   # 설계 문서
    └── samples/        # 샘플 보험 문서 (36개)
```

## 라이선스

Private - Internal Use Only
