# GA 지식체계 온톨로지 설계서

> Version 1.0 · 2026-02-05
> 목적: flat taxonomy → 온톨로지 기반 전환 설계

---

## 1. 현재 상태 진단

### 1.1 현행 구조의 한계

현재 `taxonomy_v2_extended.py`는 **flat dictionary** 구조로, 분류체계로서는 유효하지만
**온톨로지**(개념 간 의미적 관계망)로서는 근본적 한계가 있다.

| 항목 | 현행 (v2.1) | 온톨로지 목표 |
|------|------------|-------------|
| 데이터 구조 | Python dict (key-value) | 클래스 계층 + 속성 + 관계 |
| 개념 관계 | `DEFAULT_RELATIONS` (1단계 매핑) | 다중 관계, 추론 가능 |
| 동의어 | `alias` 필드 (배열) | `owl:sameAs`, 시소러스 |
| 상위-하위 | 없음 (카테고리 필드로 암시) | `rdfs:subClassOf` 명시적 계층 |
| 도메인 범위 | 보험상품 중심 + 일부 법률/교육 | 전체 GA 운영 도메인 |
| 추론 | 불가 | "약관 변경 → 설명서 갱신 필요" 자동 추론 |
| 교차 참조 | 문서↔문서만 | 개념↔개념↔문서↔프로세스 다층 |

### 1.2 누락된 도메인 영역

`domain_knowledge.md`에서 식별된 8대 도메인 vs 현행 커버리지:

```
[GA 지식체계 전체 도메인]

1. 보험상품 체계        ███████████░  90% ← 현재 Phase A 주력
2. 영업/판매 프로세스    ████████░░░  70% ← 프로세스 정의는 있으나 상세 부족
3. 언더라이팅/심사      ██████░░░░░  55% ← 문서유형만 정의, 심사기준 체계 미구축
4. 법규/규제           ████░░░░░░░  40% ← 규제 일정만 있음, 조항 단위 미분류
5. 수수료/정산         ████░░░░░░░  35% ← 유형 정의만, 계산 로직 미구축
6. 교육/자격           ███░░░░░░░░  30% ← 문서유형만, 커리큘럼 체계 없음
7. 내부 운영           ██░░░░░░░░░  20% ← 시스템매뉴얼, 공지 유형만
8. 용어/개념 체계       █░░░░░░░░░░  10% ← alias만 존재, 온톨로지 없음
```

---

## 2. 온톨로지 아키텍처

### 2.1 설계 원칙

1. **도메인 주도**: domain_knowledge.md를 SSOT(Single Source of Truth)로 삼아 클래스 도출
2. **점진적 확장**: 보험상품(현행) → 프로세스 → 법규 → 수수료 → ... 순서로 확장
3. **시뮬레이션 검증**: 각 도메인 추가 시 RAG 시뮬레이션으로 검색 품질 검증
4. **실용주의**: 학술적 OWL 완전성보다 GA 실무에서 "질문 → 답변 연결"이 되는지가 기준

### 2.2 상위 온톨로지 구조

```
                        ga:Thing
                           │
          ┌────────────────┼────────────────────┐
          │                │                    │
     ga:Entity        ga:Document          ga:Process
          │                │                    │
    ┌─────┼─────┐    ┌────┼────┐         ┌─────┼─────┐
    │     │     │    │    │    │         │     │     │
 Carrier Product Role  DocType Version  BizProc  Rule  Event
    │     │     │    │              │         │
    │     │     │    │         Regulation    KPI
    │     │     │    │
    │     │     │   DocInstance ← 실제 문서 (602개)
    │     │     │
    └──┬──┘     │
       │        │
   Offering  Certification
```

### 2.3 핵심 클래스 정의

#### Layer 1: 엔티티 (WHO)

```
ga:Carrier (보험사)
  ├── ga:LifeInsurer         # 생명보험사
  │   ├── ga:MajorLifeInsurer    # 대형 (삼성, 한화, 교보, 신한)
  │   └── ga:MidLifeInsurer      # 중형 (농협, 동양, 미래에셋...)
  ├── ga:NonLifeInsurer      # 손해보험사
  │   ├── ga:MajorNonLifeInsurer # 대형 (삼성화재, 현대해상, DB...)
  │   └── ga:MidNonLifeInsurer   # 중형 (한화손보, 흥국화재...)
  └── ga:CommonEntity        # 공통 (규제기관, 업계 공통)
      ├── ga:Regulator           # 금감원, 금융위
      └── ga:IndustryBody        # 생보협회, 손보협회

ga:Role (역할)
  ├── ga:AgentRole           # 설계사 계열
  │   ├── ga:NewAgent            # 신입 (1년 미만)
  │   ├── ga:GeneralAgent        # 일반
  │   ├── ga:SeniorAgent         # 시니어 (3년+)
  │   └── ga:GoldAgent           # 골드 (상위 10%)
  ├── ga:ManagerRole         # 관리자 계열
  │   ├── ga:TeamLeader
  │   ├── ga:BranchManager
  │   └── ga:HeadOfficeManager
  └── ga:SpecialistRole      # 전문직 계열
      ├── ga:Underwriter
      ├── ga:ComplianceOfficer
      └── ga:Trainer
```

#### Layer 2: 상품 (WHAT)

```
ga:Product (보험상품)
  ├── ga:LifeProduct             # 생명보험
  │   ├── ga:WholeLifeInsurance      # 종신보험
  │   ├── ga:TermInsurance           # 정기보험
  │   ├── ga:VariableInsurance       # 변액보험 → requires(CERT-VARIABLE)
  │   ├── ga:UniversalInsurance      # 유니버셜
  │   ├── ga:ChildInsurance          # 어린이보험
  │   └── ga:EducationInsurance      # 교육보험
  │
  ├── ga:HealthProduct           # 건강/제3보험
  │   ├── ga:CIInsurance             # CI보험
  │   ├── ga:CancerInsurance         # 암보험 → exemptionPeriod(90일)
  │   ├── ga:MedicalExpenseInsurance # 실손 → generation(4세대)
  │   ├── ga:LTCInsurance            # 간병보험
  │   ├── ga:DentalInsurance         # 치아보험
  │   └── ga:SimplifiedUWInsurance   # 간편심사 → uwType(3-N-5)
  │
  ├── ga:NonLifeProduct          # 손해보험
  │   ├── ga:AutoInsurance           # 자동차 → mandatory(대인I, 대물)
  │   ├── ga:FireInsurance           # 화재
  │   ├── ga:LiabilityInsurance      # 배상책임
  │   ├── ga:MarineInsurance         # 해상
  │   └── ga:TravelInsurance         # 여행자
  │
  └── ga:AnnuityProduct          # 연금/저축
      ├── ga:TaxQualifiedAnnuity     # 세제적격 → taxBenefit(연400만)
      ├── ga:GeneralAnnuity          # 일반연금
      ├── ga:VariableAnnuity         # 변액연금 → requires(CERT-VARIABLE)
      └── ga:SavingsInsurance        # 저축보험
```

#### Layer 3: 문서 (WHICH)

```
ga:DocumentType (문서유형)
  │
  ├── ga:InsurerDocument         # 보험사 발행
  │   ├── ga:ProductDocument         # 상품 관련
  │   │   ├── ga:PolicyTerms             # 보통약관
  │   │   ├── ga:SpecialTerms            # 특별약관 → childOf(PolicyTerms)
  │   │   ├── ga:ProductGuide            # 상품설명서
  │   │   ├── ga:RateTable               # 보험료표
  │   │   ├── ga:ProductSummary          # 상품요약서
  │   │   └── ga:Brochure                # 브로슈어
  │   │
  │   ├── ga:SalesDocument           # 영업 관련
  │   │   ├── ga:Incentive               # 시책
  │   │   ├── ga:CommissionStructure     # 수수료체계
  │   │   ├── ga:CommissionCalcRule      # 수수료계산기준 (1200%룰)
  │   │   └── ga:Notice                  # 공문
  │   │
  │   ├── ga:UWDocument              # 심사 관련
  │   │   ├── ga:UWGuideline             # 심사가이드라인
  │   │   ├── ga:UWRule                  # 심사기준
  │   │   ├── ga:DiseaseUWCriteria       # 질병별 심사기준
  │   │   ├── ga:OccupationUWCriteria    # 직업별 심사기준
  │   │   └── ga:Exclusion               # 면책조항
  │   │
  │   └── ga:ContractDocument        # 계약 관련
  │       ├── ga:Application             # 청약서
  │       ├── ga:Disclosure              # 고지사항
  │       └── ga:Confirmation            # 확인서
  │
  ├── ga:GADocument              # GA 내부 생산
  │   ├── ga:SalesScript             # 판매스크립트
  │   ├── ga:ComparisonChart         # 상품비교표
  │   ├── ga:TrainingMaterial        # 교육자료
  │   ├── ga:OnboardingGuide         # 신입교육
  │   ├── ga:ComplianceTraining      # 컴플라이언스교육
  │   ├── ga:ComplianceGuide         # 컴플라이언스가이드
  │   ├── ga:SystemManual            # 시스템매뉴얼
  │   ├── ga:ProcessGuide            # 업무프로세스
  │   ├── ga:InternalMemo            # 내부공지
  │   ├── ga:Settlement              # 정산자료
  │   ├── ga:PerformanceReport       # 실적보고서
  │   ├── ga:ChargebackRule          # 환수기준
  │   └── ga:FAQ                     # 자주묻는질문
  │
  ├── ga:AgentDocument           # 설계사 사용
  │   ├── ga:Proposal                # 가입설계서
  │   ├── ga:CustomerCard            # 고객관리카드
  │   └── ga:NeedsAnalysis           # 니즈분석표
  │
  ├── ga:RegulatoryDocument      # 규제기관 발행
  │   ├── ga:InsuranceBizAct         # 보험업법
  │   ├── ga:ConsumerProtectionAct   # 금융소비자보호법
  │   └── ga:SupervisoryRegulation   # 감독규정
  │
  └── ga:ExpertKnowledge         # 전문가 지식 (암묵지)
      ├── ga:BestPractice            # 베스트프랙티스
      ├── ga:ExpertTip               # 전문가팁
      └── ga:CaseStudy               # 케이스스터디
```

#### Layer 4: 프로세스 (HOW)

```
ga:BusinessProcess (업무프로세스)
  │
  ├── ga:SalesProcess            # 판매 프로세스 (7단계)
  │   ├── ga:Prospecting             # 1. 가망고객 발굴
  │   ├── ga:NeedArousal             # 2. 니즈환기
  │   ├── ga:Presentation            # 3. 상품설명
  │   ├── ga:Application             # 4. 청약
  │   ├── ga:GAScreening             # 5. GA 1차심사
  │   ├── ga:Underwriting            # 6. 보험사 심사
  │   └── ga:PolicyIssuance          # 7. 승낙/증권발급
  │
  ├── ga:PostSalesProcess        # 판매 후 프로세스
  │   ├── ga:HappyCall               # 해피콜 (완전판매 모니터링)
  │   ├── ga:ContractMaintenance     # 보전 (변경/해지/부활)
  │   └── ga:ClaimProcess            # 보험금 청구/지급
  │
  ├── ga:SettlementProcess       # 수수료 프로세스
  │   ├── ga:CommissionCalc          # 수수료 계산
  │   ├── ga:CommissionPayment       # 수수료 지급
  │   └── ga:Chargeback              # 환수
  │
  ├── ga:HRProcess               # 인사 프로세스
  │   ├── ga:Recruiting              # 리크루팅
  │   ├── ga:Registration            # 설계사 등록
  │   └── ga:Education               # 교육 (법정/상품/자격)
  │
  └── ga:ComplianceProcess       # 컴플라이언스
      ├── ga:InternalControl         # 내부통제
      ├── ga:IncompleteSaleCheck     # 불완전판매 점검
      └── ga:RegulatoryReporting     # 규제 보고
```

#### Layer 5: 규범/규칙 (WHY)

```
ga:Regulation (법규/규제)
  │
  ├── ga:Law                     # 법률
  │   ├── ga:InsuranceBizLaw         # 보험업법
  │   │   ├── ga:Article87               # 제87조 (모집자 등록)
  │   │   ├── ga:Article87_3             # 제87조의3 (대형GA 공시)
  │   │   ├── ga:Article95_5             # 제95조의5 (비교설명의무)
  │   │   ├── ga:Article97               # 제97조 (승환계약 금지)
  │   │   └── ga:Article98               # 제98조 (특별이익 금지)
  │   │
  │   └── ga:ConsumerProtLaw         # 금융소비자보호법
  │       ├── ga:SuitabilityPrinciple    # 적합성 원칙 (제17조)
  │       ├── ga:AppropriatenessPrinciple # 적정성 원칙 (제18조)
  │       ├── ga:ExplanationDuty         # 설명의무 (제19조)
  │       ├── ga:UnfairPracticeProhibition # 불공정영업 금지 (제20조)
  │       ├── ga:ImproperSolicitProhibition # 부당권유 금지
  │       └── ga:AdvertisingRegulation   # 광고규제
  │
  ├── ga:SupervisoryGuideline    # 감독규정
  │   ├── ga:Rule1200Percent         # 1200%룰
  │   ├── ga:InstallmentPayment      # 분급제 (4년→7년)
  │   ├── ga:ArbitrageProhibition    # 차익거래 금지
  │   └── ga:InternalControlEval     # 내부통제 실태평가
  │
  └── ga:RegulationEvent         # 규제 이벤트/시행일정
      ├── ga:Event2024_InternalControl   # 2024 내부통제 시행
      ├── ga:Event2026_01_Arbitrage      # 2026.01 차익거래 확대
      ├── ga:Event2026_07_1200Rule       # 2026.07 1200%룰 GA 확대
      ├── ga:Event2027_Installment4Y     # 2027.01 4년 분급제
      └── ga:Event2029_Installment7Y     # 2029.01 7년 분급제
```

#### Layer 6: 용어/개념 (WHAT IT MEANS)

```
ga:Concept (보험 용어/개념)
  │
  ├── ga:PremiumConcept          # 보험료 관련
  │   ├── ga:GrossPremium            # 영업보험료
  │   │   ├── ga:NetPremium              # 순보험료
  │   │   │   ├── ga:RiskPremium             # 위험보험료
  │   │   │   └── ga:SavingsPremium          # 저축보험료
  │   │   └── ga:LoadingPremium          # 부가보험료
  │   │       ├── ga:AcquisitionCost         # 신계약비
  │   │       ├── ga:MaintenanceCost         # 유지비
  │   │       └── ga:CollectionCost          # 수금비
  │   └── ga:AssumedRate             # 3대 예정률
  │       ├── ga:AssumedInterestRate     # 예정이율 (~2.0-2.25%)
  │       ├── ga:AssumedMortalityRate    # 예정위험률
  │       └── ga:AssumedExpenseRatio     # 예정사업비율
  │
  ├── ga:CommissionConcept       # 수수료 관련
  │   ├── ga:FYC                     # 초년도수수료
  │   ├── ga:RenewalCommission       # 유지수수료
  │   ├── ga:Override                # 오버라이드
  │   ├── ga:SettlementSupport       # 정착지원금
  │   ├── ga:MaintenanceFee          # 유지관리수수료 (2027~)
  │   └── ga:APE                     # 환산보험료
  │
  ├── ga:ContractConcept         # 계약 관련
  │   ├── ga:Lapse                   # 실효
  │   ├── ga:Reinstatement           # 부활
  │   ├── ga:SurrenderValue          # 해약환급금
  │   │   ├── ga:LowSurrenderValue       # 저해지환급금
  │   │   └── ga:ZeroSurrenderValue      # 무해지환급금
  │   ├── ga:CoolingOffPeriod        # 청약철회 (15일)
  │   └── ga:PersistencyRate         # 유지율 (13/25/37/61회차)
  │
  ├── ga:UWConcept               # 심사 관련
  │   ├── ga:DutyOfDisclosure        # 고지의무 (상법 651조)
  │   ├── ga:DutyOfNotification      # 통지의무 (상법 652조)
  │   ├── ga:StandardBody            # 표준체
  │   ├── ga:SubstandardBody         # 부표준체
  │   ├── ga:ExclusionPeriod         # 면책기간
  │   ├── ga:ReductionPeriod         # 감액기간
  │   └── ga:SimplifiedUW            # 간편심사 (3-N-5)
  │
  └── ga:ComplianceConcept       # 컴플라이언스
      ├── ga:IncompleteSale          # 불완전판매
      ├── ga:ChurnContract           # 승환계약
      ├── ga:HappyCallSystem         # 해피콜
      └── ga:IllegalContractCancellation # 위법계약해지권 (5년)
```

### 2.4 관계 유형 (Object Properties)

```
[문서 ↔ 문서]
  PARENT_OF / CHILD_OF         # 보통약관 → 특별약관
  SIBLINGS                     # 시책 ↔ 수수료
  REFERENCES / REFERENCED_BY   # 스크립트 → 설명서
  SUPERSEDES / SUPERSEDED_BY   # 신규약관 → 구약관
  REQUIRES / REQUIRED_BY       # 고지사항 → 청약서

[문서 ↔ 엔티티]
  ISSUED_BY                    # 문서 → 보험사 (발행 주체)
  APPLIES_TO                   # 문서 → 상품 (적용 대상)
  TARGETS_AUDIENCE             # 문서 → 역할 (대상 독자)
  USED_IN                      # 문서 → 프로세스 (사용 단계)

[엔티티 ↔ 엔티티]
  OFFERS                       # 보험사 → 상품
  REQUIRES_CERT                # 상품 → 자격증 (변액→변액자격)
  SIMILAR_TO                   # 상품 ↔ 상품 (유사 상품)
  COMPETES_WITH                # 보험사 ↔ 보험사 (경쟁 관계)

[프로세스 ↔ 프로세스]
  PRECEDES / FOLLOWS           # 청약 → 심사 → 발행 (순서)
  TRIGGERS                     # 만료 → 갱신 알림 (이벤트)

[규제 ↔ 모든 것]
  GOVERNS                      # 법 → 프로세스 (규율)
  RESTRICTS                    # 규제 → 상품/수수료 (제한)
  MANDATES                     # 법 → 문서 (의무 서류)

[개념 ↔ 개념]
  BROADER / NARROWER           # 영업보험료 → 순보험료 (상하위)
  RELATED_TO                   # 면책기간 ↔ 감액기간 (관련)
  SYNONYM_OF                   # 해약환급금 = 해지환급금
  ANTONYM_OF                   # 표준체 ↔ 부표준체
```

---

## 3. 설계→시뮬레이션→검증 사이클

### 3.1 전체 사이클

```
  ┌─────────────────────────────────────────────────────────┐
  │                                                         │
  │    ① 도메인 분석        ② 온톨로지 설계                   │
  │    (knowledge base)    (클래스/관계 정의)                  │
  │         │                    │                          │
  │         ▼                    ▼                          │
  │    ┌─────────┐         ┌──────────┐                     │
  │    │ 도메인   │────────▶│ 온톨로지  │                     │
  │    │ 문서 분석 │         │ 스키마    │                     │
  │    └─────────┘         └────┬─────┘                     │
  │                             │                           │
  │              ③ 데이터 생성   │                           │
  │              (시뮬레이션)     │                           │
  │                             ▼                           │
  │                       ┌──────────┐                      │
  │                       │ 샘플 문서  │                      │
  │                       │ + 그래프   │                      │
  │                       └────┬─────┘                      │
  │                            │                            │
  │             ④ 검증          │                            │
  │             (RAG 시뮬레이션) │                            │
  │                            ▼                            │
  │                      ┌───────────┐                      │
  │                      │ 검색 품질   │──── Pass ──▶ 다음    │
  │                      │ 평가       │            도메인    │
  │                      └─────┬─────┘                      │
  │                            │                            │
  │                          Fail                           │
  │                            │                            │
  │              ⑤ 피드백       │                            │
  │              (개선)         │                            │
  │                            ▼                            │
  │                      ┌───────────┐                      │
  │                      │ gap 분석   │────────────────┘     │
  │                      │ + 조정     │                      │
  │                      └───────────┘                      │
  │                                                         │
  └─────────────────────────────────────────────────────────┘
```

### 3.2 도메인별 확장 로드맵

각 도메인을 **독립 사이클**로 추가하되, 이전 사이클의 검증 결과를 반영한다.

```
Cycle 0 (현행): 보험상품 기본
  └─ 검증 결과: 27.1% 매칭률, 전파 0건
     └─ 원인: edge 파싱 버그 + 키워드 한계

Cycle 1: 보험상품 관계 수정
  ├─ edge 버그 수정 (type 필드)
  ├─ 키워드 동의어 확장
  └─ 목표: 매칭률 60%+, 전파 검색 동작

Cycle 2: 영업 프로세스 도메인
  ├─ 판매 7단계 프로세스 온톨로지화
  ├─ 프로세스 ↔ 문서 ↔ 역할 관계 구축
  ├─ 시나리오: "신입 설계사 청약 절차는?"
  └─ 목표: 프로세스 기반 문서 검색

Cycle 3: 법규/규제 도메인
  ├─ 보험업법 주요 조항 개별 노드화
  ├─ 금소법 6대 원칙 ↔ 프로세스 매핑
  ├─ 규제 이벤트 → 영향받는 문서/프로세스 연결
  ├─ 시나리오: "1200%룰 관련 문서 전체?"
  └─ 목표: 규제 질의 매칭률 70%+

Cycle 4: 수수료/정산 도메인
  ├─ 수수료 유형 (FYC, 유지, 시책, 오버라이드) 관계
  ├─ 환수 규칙 ↔ 유지율 ↔ 정산 연결
  ├─ 시나리오: "삼성생명 종신보험 환수 기준?"
  └─ 목표: 수수료 질의 완전성

Cycle 5: 심사/UW 도메인
  ├─ 질병별/직업별 심사기준 노드화
  ├─ 간편심사 (3-N-5) 체계 구조화
  ├─ 심사 관련 개념 온톨로지 (표준체/부표준체)
  ├─ 시나리오: "고혈압 환자 종신보험 가입 가능?"
  └─ 목표: 심사 질의 정확성

Cycle 6: 용어/개념 온톨로지
  ├─ 보험료 구조 (영업보험료 → 순보험료 → ...)
  ├─ 동의어/유의어 시소러스
  ├─ 상위-하위 개념 계층
  ├─ 시나리오: "순보험료가 뭐야?" → 관련 개념 함께 반환
  └─ 목표: 용어 질의 시 개념 맵 제공

Cycle 7: 교육/자격 도메인
  ├─ 법정교육 커리큘럼 구조화
  ├─ 자격증 ↔ 상품 ↔ 설계사등급 관계
  ├─ 시나리오: "변액보험 판매하려면?"
  └─ 목표: 교육 경로 추천

Cycle 8: 통합 검증
  ├─ 전체 도메인 교차 질의 테스트
  ├─ 관계 전파 다중 홉 검증
  └─ 목표: 전체 매칭률 80%+
```

### 3.3 사이클별 검증 시나리오 템플릿

각 사이클은 아래 형식의 시나리오 세트를 정의하고, 시뮬레이션으로 검증한다.

```python
CYCLE_SCENARIOS = {
    "cycle_id": "cycle-3-regulation",
    "domain": "법규/규제",
    "scenarios": [
        {
            "id": "REG-001",
            "query": "2026년 7월 시행되는 수수료 규제 변경사항",
            "intent": "regulation_lookup",
            "expected_concepts": ["1200%룰", "GA 확대"],
            "expected_docs": ["DOC-REGULATION", "DOC-COMMISSION-CALC", "DOC-NOTICE"],
            "expected_relations": [
                "ga:Event2026_07_1200Rule → RESTRICTS → DOC-COMMISSION",
                "ga:Event2026_07_1200Rule → GOVERNS → BIZ-SETTLE"
            ],
            "pass_criteria": {
                "doc_recall": 0.7,     # 기대 문서 70% 이상 반환
                "relation_count": 1,   # 관계 전파 1건 이상
                "concept_match": True  # 핵심 개념 매칭
            }
        },
        {
            "id": "REG-002",
            "query": "금소법 설명의무 위반 시 제재는?",
            "intent": "regulation_detail",
            "expected_concepts": ["설명의무", "제19조", "계약취소"],
            "expected_docs": ["DOC-LAW-CONSUMER", "DOC-COMPLIANCE-GUIDE"],
            "pass_criteria": {
                "doc_recall": 0.7,
                "concept_match": True
            }
        }
    ],
    "success_threshold": 0.7  # 시나리오 70% 통과 시 다음 사이클
}
```

---

## 4. 구현 전략

### 4.1 Phase A (현재): JSON 기반 온톨로지 프로토타입

현재 인프라(JSON + HTML)를 그대로 활용하되, 데이터 구조를 온톨로지 방향으로 전환한다.

**변경 범위**:
- `taxonomy_v2_extended.py` → 클래스 계층 구조 추가
- `knowledge_graph_v2.1.json` → 노드에 `class_hierarchy` 속성 추가
- `rag_simulator.py` → 관계 전파 + 개념 추론 로직 추가
- 검증 시나리오 도메인별 확장

**JSON-LD 호환 노드 형식**:
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
    "source": "insurer",
    "processes": ["BIZ-SETTLE"],
    "audiences": ["AUD-AGENT", "AUD-MANAGER"],
    "related_regulations": ["ga:Rule1200Percent"],
    "related_concepts": ["ga:FYC", "ga:RenewalCommission"]
  }
}
```

### 4.2 Phase B (예정): Neo4j + Vue 앱

Phase A에서 검증된 온톨로지를 Neo4j로 마이그레이션한다.

```
JSON 온톨로지 프로토타입
       │
       ▼ (검증 완료된 스키마)
  Neo4j Cypher 스키마 생성
       │
       ▼
  Vue 앱에서 GraphQL/REST로 조회
       │
       ▼
  벡터 DB (Chroma/Qdrant) 연동
```

### 4.3 Phase C (예정): RAG 시스템 연동

온톨로지 기반 GraphRAG 파이프라인 구축.

```
사용자 질의
    │
    ▼
[의도 분류] → 어떤 도메인? 어떤 관계?
    │
    ├── 사실 조회 → 구조화 데이터 (Neo4j)
    ├── 문서 검색 → 벡터 DB + 메타데이터 필터
    └── 추론 질의 → 그래프 탐색 (관계 전파)
    │
    ▼
[결과 융합] → LLM 응답 생성 + 출처 인용
```

---

## 5. 다음 즉시 실행 항목

### Cycle 0→1 전환 (현재 버그 수정)

1. `rag_simulator.py`의 edge 파싱 버그 수정 (`'relationship'` → `'type'`)
2. RAG 시뮬레이션 재실행, 전파 동작 확인
3. 키워드 동의어 매핑 추가 ("비교" → DOC-COMPARISON 등)
4. COMMON 문서 가중치 조정
5. 수정 후 매칭률 측정 → Cycle 1 완료 기준: 60%+

### Cycle 2 준비 (영업 프로세스)

1. `domain_knowledge.md`의 "보험 판매 프로세스 7단계"를 노드로 구조화
2. 각 프로세스 단계 ↔ 관련 문서 ↔ 역할 관계 추가
3. 프로세스 기반 검색 시나리오 작성
4. 시뮬레이션 검증

---

## 6. 성공 지표

| 지표 | 현재 | Cycle 4 목표 | 최종 목표 |
|------|------|-------------|----------|
| RAG 매칭률 | 27.1% | 60% | 80%+ |
| 관계 전파 동작 | 0건 | 정상 | 다중 홉 |
| 커버 도메인 수 | 1 (상품) | 4 | 8 (전체) |
| 온톨로지 클래스 수 | 0 | 50+ | 150+ |
| 관계 유형 수 | 3 (실질) | 10 | 20+ |
| 용어 시소러스 | alias만 | 50+ 동의어 | 200+ |

---

## 7. 참고

- `docs/core/domain_knowledge.md` — 8대 도메인 상세 (SSOT)
- `docs/architecture/architecture-guide.md` — 목표 아키텍처
- `docs/architecture/document-pipeline.md` — 문서 처리 파이프라인
- `taxonomy_v2_extended.py` — 현행 6-Facet 분류체계
- `HANDOFF.md` — 현재 상태 및 발견된 문제점
