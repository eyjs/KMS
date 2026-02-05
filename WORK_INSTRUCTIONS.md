# KMS v2.1 작업 지시서

> 작성일: 2026-02-05
> 프로젝트: iFA 지식관리체계 (KMS)
> 단계: Phase A-2 (Admin 페이지 확장)

---

## 배경

도메인 지식 문서 (`docs/core/domain_knowledge.md`) 분석 결과, 기존 분류체계에 누락된 중요 항목들이 발견되었습니다. `taxonomy_v2_extended.py`로 확장된 분류체계가 생성되었으며, 이를 Admin 페이지에 반영해야 합니다.

## 확장된 분류체계 요약

| 항목 | v2.0 | **v2.1** |
|------|------|----------|
| 보험사 | 12 | **17** (생명 9, 손해 8) |
| 상품 | 15 | **21** (건강보험 확장) |
| 문서유형 | 20 | **41** (법률, 청약, 정산 추가) |
| 업무프로세스 | 7 | **11** (해피콜, 교육 등 추가) |
| 대상역할 | 6 | **10** (팀장, 컴플라이언스 등 추가) |
| 설계사 자격증 | - | **7** (신규) |
| GA 유형 | - | **5** (신규) |
| 규제 일정 | - | **5** (신규) |

---

## 작업 목록

### Task 1: Admin 페이지 v2.1 업데이트

**파일**: `kms-admin.html` → `kms-admin-v2.html` (새 파일)

**요구사항**:
1. `taxonomy_v2.1.json` 데이터 로드
2. 사이드바 탭 확장:
   - 기존: 보험사 / 상품 / 문서유형
   - 추가: **프로세스** / **역할** / **자격증**
3. 문서 필터 추가:
   - 업무프로세스 선택
   - 대상역할 선택
   - 문서출처 (insurer/ga/agent/regulator/expert)
4. 규제 일정 표시:
   - 우측 상단에 "규제 일정" 패널
   - 다가오는 규제 변경 알림 (2026-07 1200%룰 등)

**UI 컴포넌트**:
```html
<!-- 프로세스 필터 -->
<select v-model="filters.process">
  <option value="">전체 프로세스</option>
  <option v-for="(p, id) in processes" :value="id">{{ p.name }}</option>
</select>

<!-- 역할 필터 -->
<select v-model="filters.audience">
  <option value="">전체 대상</option>
  <option v-for="(a, id) in audiences" :value="id">{{ a.name }}</option>
</select>
```

### Task 2: 샘플 데이터 확장

**파일**: `simulator_v2_extended.py` (새 파일)

**요구사항**:
1. `taxonomy_v2_extended.py` 기반 데이터 생성
2. 새 문서유형 샘플 추가:
   - 법률/규정: `DOC-LAW-INSURANCE`, `DOC-LAW-CONSUMER`, `DOC-REGULATION`
   - 청약/계약: `DOC-APPLICATION`, `DOC-DISCLOSURE`, `DOC-CONFIRMATION`
   - 정산: `DOC-SETTLEMENT`, `DOC-PERFORMANCE`, `DOC-CHARGEBACK`
3. 출력: `knowledge_graph_v2.1.json`

**추가 샘플 구조**:
```
docs/samples_v2.1/
├── COMMON/                    # 공통 문서 (규정, 교육)
│   ├── DOC-LAW-INSURANCE.md   # 보험업법 주요 조항
│   ├── DOC-LAW-CONSUMER.md    # 금소법 6대 원칙
│   └── DOC-REGULATION.md      # 감독규정
├── INS-SAMSUNG/
│   ├── PRD-LIFE-WHOLE/
│   │   └── (기존 + 확장)
...
```

### Task 3: 검증 스크립트 확장

**파일**: `verify_v2_extended.py` (새 파일)

**추가 검증 항목**:
1. 모든 문서유형이 DATA_TIERS에 포함되어 있는지
2. 프로세스/역할 매핑 완전성
3. 자격증 요구 상품 (변액) 검증
4. 규제 일정 상태 검증 (upcoming/active/expired)

### Task 4: RAG 시뮬레이션 확장

**파일**: `rag_simulator.py` (새 파일)

**시뮬레이션 시나리오**:
```python
SCENARIOS = [
    {
        "query": "2026년 7월 1200%룰 확대 적용 관련 문서",
        "expected_docs": ["DOC-COMMISSION-CALC", "DOC-REGULATION", "DOC-NOTICE"],
        "filters": {"regulation": "1200%룰"}
    },
    {
        "query": "신입 설계사가 알아야 할 컴플라이언스",
        "expected_docs": ["DOC-ONBOARDING", "DOC-COMPLIANCE", "DOC-LAW-CONSUMER"],
        "filters": {"audience": "AUD-AGENT-NEW", "process": "BIZ-COMPLIANCE"}
    },
    {
        "query": "변액보험 판매 자격 요건",
        "expected_docs": ["DOC-CERTIFICATION", "DOC-TRAINING"],
        "filters": {"certification": "CERT-VARIABLE"}
    },
    {
        "query": "삼성생명 종신보험 수수료 환수 기준",
        "expected_docs": ["DOC-COMMISSION", "DOC-CHARGEBACK", "DOC-SETTLEMENT"],
        "filters": {"carrier": "INS-SAMSUNG", "process": "BIZ-SETTLE"}
    },
]
```

---

## 기술 명세

### 파일 구조 (완료 후)

```
/KMS/
├── taxonomy_v2_extended.py    # 확장된 분류체계 ✓
├── taxonomy_v2.1.json         # JSON 내보내기 ✓
├── simulator_v2_extended.py   # 샘플 생성기 (TODO)
├── verify_v2_extended.py      # 검증 스크립트 (TODO)
├── rag_simulator.py           # RAG 시뮬레이션 (TODO)
├── kms-admin-v2.html          # Admin 페이지 v2.1 (TODO)
├── knowledge_graph_v2.1.json  # 그래프 데이터 (TODO)
└── docs/
    ├── samples_v2.1/          # 확장 샘플 (TODO)
    └── WORK_INSTRUCTIONS.md   # 이 문서 ✓
```

### 데이터 스키마

**문서 노드 속성 (v2.1)**:
```json
{
  "id": "DOC-COMMISSION-INS-SAMSUNG-PRD-LIFE-WHOLE-001",
  "labels": ["Document", "DOC-COMMISSION", "HOT"],
  "properties": {
    "name": "삼성생명 종신보험 수수료체계",
    "carrier": "INS-SAMSUNG",
    "product": "PRD-LIFE-WHOLE",
    "doc_type": "DOC-COMMISSION",
    "tier": "HOT",
    "source": "insurer",
    "processes": ["BIZ-SETTLE"],
    "audiences": ["AUD-AGENT", "AUD-MANAGER"],
    "related_regulations": ["1200%룰", "분급제"],
    "status": "active",
    "valid_from": "2026-02-01",
    "valid_to": "2026-03-31",
    "version": "1.0"
  }
}
```

---

## 우선순위

1. **[HIGH]** Admin 페이지 v2.1 (사용자가 바로 테스트 가능)
2. **[HIGH]** 샘플 데이터 확장 (법률/규정 문서 추가)
3. **[MID]** 검증 스크립트
4. **[MID]** RAG 시뮬레이션

---

## 실행 명령

```bash
# 1. taxonomy 확인
python3 taxonomy_v2_extended.py

# 2. 샘플 데이터 생성 (TODO)
python3 simulator_v2_extended.py

# 3. 검증 (TODO)
python3 verify_v2_extended.py

# 4. Admin 페이지 실행
npx serve . -p 8080
# http://localhost:8080/kms-admin-v2.html
```

---

## 완료 기준

- [ ] Admin 페이지에서 41개 문서유형 표시
- [ ] 프로세스/역할 필터 동작
- [ ] 규제 일정 패널 표시
- [ ] 법률/규정 샘플 문서 생성
- [ ] 검증 통과 (0 오류)
- [ ] RAG 시뮬레이션 4개 시나리오 통과

---

## 참고 자료

- `docs/core/domain_knowledge.md` - GA 도메인 지식
- `docs/architecture/document-pipeline.md` - 문서 파이프라인
- `taxonomy_v2_extended.py` - 확장 분류체계
- `taxonomy_v2.1.json` - JSON 데이터
