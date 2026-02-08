# Phase 1: 온톨로지 설계

> **Version** 3.0 | 2026-02-08
> **목적**: 문서관리 프레임워크의 온톨로지 구조 정의

---

## 1. 온톨로지 아키텍처

### 1.1 설계 원칙

1. **도메인 주도**: domain-knowledge.md를 SSOT로 삼아 클래스 도출
2. **점진적 확장**: 보험상품 → 프로세스 → 법규 순서로 확장
3. **시뮬레이션 검증**: 각 도메인 추가 시 RAG 시뮬레이션으로 검증
4. **실용주의**: GA 실무에서 "질문 → 답변 연결"이 되는지가 기준

### 1.2 상위 온톨로지 구조

```
                    ga:Thing
                       │
      ┌────────────────┼────────────────────┐
      │                │                    │
 ga:Entity        ga:Document          ga:Process
      │                │                    │
┌─────┼─────┐    ┌────┼────┐         ┌─────┼─────┐
│     │     │    │    │    │         │     │     │
Carrier Product Role DocType Version BizProc Rule Event
```

---

## 2. 클래스 정의

### 2.1 Layer 1: 엔티티 (WHO)

```
ga:Carrier (보험사)
  ├── ga:LifeInsurer         # 생명보험사
  │   ├── ga:MajorLifeInsurer    # 대형 (삼성, 한화, 교보, 신한)
  │   └── ga:MidLifeInsurer      # 중형 (농협, 동양...)
  ├── ga:NonLifeInsurer      # 손해보험사
  │   ├── ga:MajorNonLifeInsurer # 대형 (삼성화재, 현대해상...)
  │   └── ga:MidNonLifeInsurer   # 중형
  └── ga:CommonEntity        # 공통 (규제기관, 업계 공통)

ga:Role (역할)
  ├── ga:AgentRole           # 설계사 계열
  │   ├── ga:NewAgent            # 신입 (1년 미만)
  │   ├── ga:GeneralAgent        # 일반
  │   └── ga:SeniorAgent         # 시니어 (3년+)
  ├── ga:ManagerRole         # 관리자 계열
  └── ga:SpecialistRole      # 전문직 계열
      ├── ga:Underwriter
      └── ga:ComplianceOfficer
```

### 2.2 Layer 2: 상품 (WHAT)

```
ga:Product (보험상품)
  ├── ga:LifeProduct             # 생명보험
  │   ├── ga:WholeLifeInsurance      # 종신보험
  │   ├── ga:TermInsurance           # 정기보험
  │   └── ga:VariableInsurance       # 변액보험
  │
  ├── ga:HealthProduct           # 건강/제3보험
  │   ├── ga:CIInsurance             # CI보험
  │   ├── ga:CancerInsurance         # 암보험
  │   └── ga:MedicalExpenseInsurance # 실손
  │
  ├── ga:NonLifeProduct          # 손해보험
  │   ├── ga:AutoInsurance           # 자동차
  │   └── ga:FireInsurance           # 화재
  │
  └── ga:AnnuityProduct          # 연금/저축
      ├── ga:TaxQualifiedAnnuity     # 세제적격
      └── ga:GeneralAnnuity          # 일반연금
```

### 2.3 Layer 3: 문서 (WHICH)

```
ga:DocumentType (문서유형)
  │
  ├── ga:InsurerDocument         # 보험사 발행
  │   ├── ga:ProductDocument         # 상품 관련
  │   │   ├── ga:PolicyTerms             # 보통약관
  │   │   ├── ga:SpecialTerms            # 특별약관
  │   │   ├── ga:ProductGuide            # 상품설명서
  │   │   └── ga:RateTable               # 보험료표
  │   │
  │   ├── ga:SalesDocument           # 영업 관련
  │   │   ├── ga:Incentive               # 시책
  │   │   └── ga:CommissionStructure     # 수수료체계
  │   │
  │   └── ga:UWDocument              # 심사 관련
  │       ├── ga:UWGuideline             # 심사가이드라인
  │       └── ga:UWRule                  # 심사기준
  │
  └── ga:GADocument              # GA 내부 생산
      ├── ga:SalesScript             # 판매스크립트
      ├── ga:TrainingMaterial        # 교육자료
      └── ga:BestPractice            # 베스트프랙티스
```

### 2.4 Layer 4: 프로세스 (HOW)

```
ga:BusinessProcess (업무프로세스)
  │
  ├── ga:SalesProcess            # 판매 프로세스 (7단계)
  │   ├── ga:Prospecting             # 1. 가망고객 발굴
  │   ├── ga:NeedArousal             # 2. 니즈환기
  │   ├── ga:Presentation            # 3. 상품설명
  │   ├── ga:Application             # 4. 청약
  │   └── ga:PolicyIssuance          # 5. 승낙/증권발급
  │
  ├── ga:SettlementProcess       # 수수료 프로세스
  │   ├── ga:CommissionCalc          # 수수료 계산
  │   └── ga:Chargeback              # 환수
  │
  └── ga:ComplianceProcess       # 컴플라이언스
      └── ga:IncompleteSaleCheck     # 불완전판매 점검
```

---

## 3. 관계 유형 (Object Properties)

### 3.1 문서 ↔ 문서

| 관계 | 설명 | 양방향 |
|------|------|--------|
| PARENT_OF / CHILD_OF | 보통약관 → 특별약관 | O |
| SIBLING | 시책 ↔ 수수료 | O |
| REFERENCE / REFERENCED_BY | 스크립트 → 설명서 | X |
| SUPERSEDES / SUPERSEDED_BY | 신규약관 → 구약관 | X |

### 3.2 문서 ↔ 엔티티

| 관계 | 설명 |
|------|------|
| ISSUED_BY | 문서 → 보험사 (발행 주체) |
| APPLIES_TO | 문서 → 상품 (적용 대상) |
| TARGETS_AUDIENCE | 문서 → 역할 (대상 독자) |
| USED_IN | 문서 → 프로세스 (사용 단계) |

### 3.3 엔티티 ↔ 엔티티

| 관계 | 설명 |
|------|------|
| OFFERS | 보험사 → 상품 |
| SIMILAR_TO | 상품 ↔ 상품 (유사 상품) |

---

## 4. 구현 파일

### 4.1 소스 파일

| 파일 | 역할 |
|------|------|
| `src/ontology.py` | 클래스 계층, 관계 메타데이터, 시소러스 |
| `src/simulator_ontology.py` | @type 포함 그래프 생성 |
| `src/ontology_validator.py` | 온톨로지 구조 검증 |

### 4.2 JSON-LD 호환 노드 형식

```json
{
  "id": "DOC-COMMISSION-INS-SAMSUNG-PRD-LIFE-WHOLE-001",
  "@type": ["ga:CommissionStructure", "ga:InsurerDocument", "ga:Document"],
  "properties": {
    "name": "삼성생명 종신보험 수수료체계",
    "carrier": "INS-SAMSUNG",
    "product": "PRD-LIFE-WHOLE",
    "doc_type": "DOC-COMMISSION",
    "tier": "HOT",
    "processes": ["BIZ-SETTLE"],
    "audiences": ["AUD-AGENT", "AUD-MANAGER"]
  }
}
```

---

## 5. 검증 결과

### 5.1 온톨로지 구조 검증 (6/6)

| 검증 항목 | 상태 |
|----------|------|
| 클래스 계층 정합성 | Pass |
| 관계 타입 정의 완전성 | Pass |
| 필수 속성 존재 | Pass |
| 순환 참조 없음 | Pass |
| 고립 노드 없음 | Pass |
| 시소러스 유효성 | Pass |

### 5.2 실행 명령

```bash
python src/ontology_validator.py
```

---

## 6. 참고 문서

- `src/ontology.py` - 온톨로지 정의 코드
- `docs/shared/domain-knowledge.md` - GA 도메인 지식 (SSOT)
- `docs/shared/framework-overview.md` - 프레임워크 개요
