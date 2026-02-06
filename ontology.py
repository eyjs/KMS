"""
GA 지식체계 온톨로지 정의

기존 taxonomy_v2_extended.py의 flat dictionary를
클래스 계층, 개념 관계, 동의어 시소러스로 확장한다.

설계→시뮬레이션→검증 사이클의 '설계' 단계 산출물.
"""

from taxonomy import (
    CARRIERS, PRODUCTS, PRODUCT_CATEGORIES, DOC_TYPES,
    PROCESSES, AUDIENCES, CERTIFICATIONS, DEFAULT_RELATIONS,
    DATA_TIERS, REGULATION_TIMELINE, COMMISSION_TYPES,
    CHARGEBACK_RULES, KPI_METRICS
)

# ═══════════════════════════════════════════════════════════════════════════════
# 1. 클래스 계층 (Class Hierarchy)
# ═══════════════════════════════════════════════════════════════════════════════

CLASS_HIERARCHY = {
    "ga:Thing": {
        "ga:Entity": {
            "ga:Carrier": {
                "ga:LifeInsurer": {
                    "ga:MajorLifeInsurer": {},
                    "ga:MidLifeInsurer": {},
                },
                "ga:NonLifeInsurer": {
                    "ga:MajorNonLifeInsurer": {},
                    "ga:MidNonLifeInsurer": {},
                },
                "ga:CommonEntity": {},
            },
            "ga:Role": {
                "ga:AgentRole": {
                    "ga:NewAgent": {},
                    "ga:GeneralAgent": {},
                    "ga:SeniorAgent": {},
                    "ga:GoldAgent": {},
                },
                "ga:ManagerRole": {
                    "ga:TeamLeader": {},
                    "ga:BranchManager": {},
                    "ga:HeadOfficeManager": {},
                },
                "ga:SpecialistRole": {
                    "ga:Underwriter": {},
                    "ga:ComplianceOfficer": {},
                    "ga:Trainer": {},
                },
            },
        },
        "ga:Product": {
            "ga:LifeProduct": {
                "ga:WholeLifeInsurance": {},
                "ga:TermInsurance": {},
                "ga:VariableInsurance": {},
                "ga:UniversalInsurance": {},
                "ga:ChildInsurance": {},
                "ga:EducationInsurance": {},
            },
            "ga:HealthProduct": {
                "ga:CIInsurance": {},
                "ga:CancerInsurance": {},
                "ga:MedicalExpenseInsurance": {},
                "ga:LTCInsurance": {},
                "ga:DentalInsurance": {},
                "ga:SimplifiedUWInsurance": {},
            },
            "ga:NonLifeProduct": {
                "ga:AutoInsurance": {},
                "ga:FireInsurance": {},
                "ga:LiabilityInsurance": {},
                "ga:MarineInsurance": {},
                "ga:TravelInsurance": {},
            },
            "ga:AnnuityProduct": {
                "ga:TaxQualifiedAnnuity": {},
                "ga:GeneralAnnuity": {},
                "ga:VariableAnnuity": {},
                "ga:SavingsInsurance": {},
            },
        },
        "ga:DocumentType": {
            "ga:InsurerDocument": {
                "ga:ProductDocument": {
                    "ga:PolicyTerms": {},
                    "ga:SpecialTerms": {},
                    "ga:ProductGuide": {},
                    "ga:RateTable": {},
                    "ga:ProductSummary": {},
                    "ga:Brochure": {},
                },
                "ga:SalesDocument": {
                    "ga:Incentive": {},
                    "ga:CommissionStructure": {},
                    "ga:CommissionCalcRule": {},
                    "ga:Notice": {},
                },
                "ga:UWDocument": {
                    "ga:UWGuideline": {},
                    "ga:UWRule": {},
                    "ga:DiseaseUWCriteria": {},
                    "ga:OccupationUWCriteria": {},
                    "ga:Exclusion": {},
                },
                "ga:ContractDocument": {
                    "ga:Application": {},
                    "ga:Disclosure": {},
                    "ga:Confirmation": {},
                },
            },
            "ga:GADocument": {
                "ga:SalesScript": {},
                "ga:ComparisonChart": {},
                "ga:ComplianceGuide": {},
                "ga:ProcessGuide": {},
                "ga:InternalMemo": {},
                "ga:Settlement": {},
                "ga:PerformanceReport": {},
                "ga:ChargebackRule": {},
                "ga:FAQ": {},
            },
            "ga:TrainingDocument": {
                "ga:TrainingMaterial": {},
                "ga:OnboardingGuide": {},
                "ga:ComplianceTraining": {},
                "ga:CertificationTraining": {},
            },
            "ga:AgentDocument": {
                "ga:Proposal": {},
                "ga:CustomerCard": {},
                "ga:NeedsAnalysis": {},
            },
            "ga:RegulatoryDocument": {
                "ga:InsuranceBizAct": {},
                "ga:ConsumerProtectionAct": {},
                "ga:SupervisoryRegulation": {},
            },
            "ga:ExpertKnowledge": {
                "ga:BestPractice": {},
                "ga:ExpertTip": {},
                "ga:CaseStudy": {},
            },
        },
        "ga:BusinessProcess": {
            "ga:SalesProcess": {
                "ga:Prospecting": {},
                "ga:NeedArousal": {},
                "ga:Presentation": {},
                "ga:ApplicationProcess": {},
                "ga:GAScreening": {},
                "ga:UnderwritingProcess": {},
                "ga:PolicyIssuance": {},
            },
            "ga:PostSalesProcess": {
                "ga:HappyCall": {},
                "ga:ContractMaintenance": {},
                "ga:ClaimProcess": {},
            },
            "ga:SettlementProcess": {
                "ga:CommissionCalc": {},
                "ga:CommissionPayment": {},
                "ga:ChargebackProcess": {},
            },
            "ga:HRProcess": {
                "ga:Recruiting": {},
                "ga:Registration": {},
                "ga:EducationProcess": {},
            },
            "ga:ComplianceProcess": {
                "ga:InternalControl": {},
                "ga:IncompleteSaleCheck": {},
            },
        },
        "ga:Regulation": {
            "ga:Law": {
                "ga:InsuranceBizLaw": {},
                "ga:ConsumerProtLaw": {},
            },
            "ga:SupervisoryGuideline": {
                "ga:Rule1200Percent": {},
                "ga:InstallmentPayment": {},
                "ga:ArbitrageProhibition": {},
            },
            "ga:RegulationEvent": {},
        },
        "ga:Concept": {
            "ga:PremiumConcept": {
                "ga:GrossPremium": {},
                "ga:NetPremium": {},
                "ga:RiskPremium": {},
                "ga:SavingsPremium": {},
                "ga:LoadingPremium": {},
            },
            "ga:CommissionConcept": {
                "ga:FYC": {},
                "ga:RenewalCommission": {},
                "ga:OverrideComm": {},
                "ga:MaintenanceFee": {},
                "ga:APE": {},
            },
            "ga:ContractConcept": {
                "ga:Lapse": {},
                "ga:Reinstatement": {},
                "ga:SurrenderValue": {},
                "ga:CoolingOff": {},
                "ga:PersistencyRate": {},
            },
            "ga:UWConcept": {
                "ga:DutyOfDisclosure": {},
                "ga:StandardBody": {},
                "ga:SubstandardBody": {},
                "ga:ExclusionPeriod": {},
                "ga:SimplifiedUW": {},
            },
            "ga:ComplianceConcept": {
                "ga:IncompleteSale": {},
                "ga:ChurnContract": {},
                "ga:HappyCallConcept": {},
            },
        },
    }
}


# ═══════════════════════════════════════════════════════════════════════════════
# 2. ID → 온톨로지 클래스 매핑
# ═══════════════════════════════════════════════════════════════════════════════

# 보험사 → 클래스
CARRIER_CLASS_MAP = {
    "INS-SAMSUNG": ["ga:Carrier", "ga:LifeInsurer", "ga:MajorLifeInsurer"],
    "INS-HANWHA": ["ga:Carrier", "ga:LifeInsurer", "ga:MajorLifeInsurer"],
    "INS-KYOBO": ["ga:Carrier", "ga:LifeInsurer", "ga:MajorLifeInsurer"],
    "INS-SHINHAN": ["ga:Carrier", "ga:LifeInsurer", "ga:MajorLifeInsurer"],
    "INS-NH": ["ga:Carrier", "ga:LifeInsurer", "ga:MidLifeInsurer"],
    "INS-DONGYANG": ["ga:Carrier", "ga:LifeInsurer", "ga:MidLifeInsurer"],
    "INS-MIRAE": ["ga:Carrier", "ga:LifeInsurer", "ga:MidLifeInsurer"],
    "INS-ABL": ["ga:Carrier", "ga:LifeInsurer", "ga:MidLifeInsurer"],
    "INS-HEUNGKUK": ["ga:Carrier", "ga:LifeInsurer", "ga:MidLifeInsurer"],
    "INS-SAMSUNGF": ["ga:Carrier", "ga:NonLifeInsurer", "ga:MajorNonLifeInsurer"],
    "INS-HYUNDAI": ["ga:Carrier", "ga:NonLifeInsurer", "ga:MajorNonLifeInsurer"],
    "INS-DB": ["ga:Carrier", "ga:NonLifeInsurer", "ga:MajorNonLifeInsurer"],
    "INS-KB": ["ga:Carrier", "ga:NonLifeInsurer", "ga:MajorNonLifeInsurer"],
    "INS-MERITZ": ["ga:Carrier", "ga:NonLifeInsurer", "ga:MajorNonLifeInsurer"],
    "INS-HANWHA-D": ["ga:Carrier", "ga:NonLifeInsurer", "ga:MidNonLifeInsurer"],
    "INS-HEUNGKUK-D": ["ga:Carrier", "ga:NonLifeInsurer", "ga:MidNonLifeInsurer"],
    "INS-LOTTE": ["ga:Carrier", "ga:NonLifeInsurer", "ga:MidNonLifeInsurer"],
    "INS-COMMON": ["ga:Carrier", "ga:CommonEntity"],
}

# 상품 → 클래스
PRODUCT_CLASS_MAP = {
    "PRD-LIFE-WHOLE": ["ga:Product", "ga:LifeProduct", "ga:WholeLifeInsurance"],
    "PRD-LIFE-TERM": ["ga:Product", "ga:LifeProduct", "ga:TermInsurance"],
    "PRD-LIFE-VARIABLE": ["ga:Product", "ga:LifeProduct", "ga:VariableInsurance"],
    "PRD-LIFE-UNIVERSAL": ["ga:Product", "ga:LifeProduct", "ga:UniversalInsurance"],
    "PRD-CHILD": ["ga:Product", "ga:LifeProduct", "ga:ChildInsurance"],
    "PRD-LIFE-EDU": ["ga:Product", "ga:LifeProduct", "ga:EducationInsurance"],
    "PRD-HEALTH-CI": ["ga:Product", "ga:HealthProduct", "ga:CIInsurance"],
    "PRD-HEALTH-CANCER": ["ga:Product", "ga:HealthProduct", "ga:CancerInsurance"],
    "PRD-HEALTH-MEDICAL": ["ga:Product", "ga:HealthProduct", "ga:MedicalExpenseInsurance"],
    "PRD-HEALTH-LTC": ["ga:Product", "ga:HealthProduct", "ga:LTCInsurance"],
    "PRD-HEALTH-DENTAL": ["ga:Product", "ga:HealthProduct", "ga:DentalInsurance"],
    "PRD-HEALTH-SIMPLE": ["ga:Product", "ga:HealthProduct", "ga:SimplifiedUWInsurance"],
    "PRD-NONLIFE-AUTO": ["ga:Product", "ga:NonLifeProduct", "ga:AutoInsurance"],
    "PRD-NONLIFE-FIRE": ["ga:Product", "ga:NonLifeProduct", "ga:FireInsurance"],
    "PRD-NONLIFE-LIAB": ["ga:Product", "ga:NonLifeProduct", "ga:LiabilityInsurance"],
    "PRD-NONLIFE-MARINE": ["ga:Product", "ga:NonLifeProduct", "ga:MarineInsurance"],
    "PRD-NONLIFE-TRAVEL": ["ga:Product", "ga:NonLifeProduct", "ga:TravelInsurance"],
    "PRD-ANNUITY-TAX": ["ga:Product", "ga:AnnuityProduct", "ga:TaxQualifiedAnnuity"],
    "PRD-ANNUITY-GEN": ["ga:Product", "ga:AnnuityProduct", "ga:GeneralAnnuity"],
    "PRD-ANNUITY-VAR": ["ga:Product", "ga:AnnuityProduct", "ga:VariableAnnuity"],
    "PRD-SAVING": ["ga:Product", "ga:AnnuityProduct", "ga:SavingsInsurance"],
    "PRD-COMMON": ["ga:Product"],
}

# 문서유형 → 클래스
DOC_TYPE_CLASS_MAP = {
    "DOC-TERMS": ["ga:DocumentType", "ga:InsurerDocument", "ga:ProductDocument", "ga:PolicyTerms"],
    "DOC-TERMS-SPECIAL": ["ga:DocumentType", "ga:InsurerDocument", "ga:ProductDocument", "ga:SpecialTerms"],
    "DOC-GUIDE": ["ga:DocumentType", "ga:InsurerDocument", "ga:ProductDocument", "ga:ProductGuide"],
    "DOC-RATE-TABLE": ["ga:DocumentType", "ga:InsurerDocument", "ga:ProductDocument", "ga:RateTable"],
    "DOC-BROCHURE": ["ga:DocumentType", "ga:InsurerDocument", "ga:ProductDocument", "ga:Brochure"],
    "DOC-PRODUCT-SUMMARY": ["ga:DocumentType", "ga:InsurerDocument", "ga:ProductDocument", "ga:ProductSummary"],
    "DOC-SCRIPT": ["ga:DocumentType", "ga:GADocument", "ga:SalesScript"],
    "DOC-COMPARISON": ["ga:DocumentType", "ga:GADocument", "ga:ComparisonChart"],
    "DOC-PROPOSAL": ["ga:DocumentType", "ga:AgentDocument", "ga:Proposal"],
    "DOC-INCENTIVE": ["ga:DocumentType", "ga:InsurerDocument", "ga:SalesDocument", "ga:Incentive"],
    "DOC-COMMISSION": ["ga:DocumentType", "ga:InsurerDocument", "ga:SalesDocument", "ga:CommissionStructure"],
    "DOC-COMMISSION-CALC": ["ga:DocumentType", "ga:InsurerDocument", "ga:SalesDocument", "ga:CommissionCalcRule"],
    "DOC-APPLICATION": ["ga:DocumentType", "ga:InsurerDocument", "ga:ContractDocument", "ga:Application"],
    "DOC-DISCLOSURE": ["ga:DocumentType", "ga:InsurerDocument", "ga:ContractDocument", "ga:Disclosure"],
    "DOC-CONFIRMATION": ["ga:DocumentType", "ga:AgentDocument", "ga:Confirmation"],
    "DOC-CUSTOMER-CARD": ["ga:DocumentType", "ga:AgentDocument", "ga:CustomerCard"],
    "DOC-NEEDS-ANALYSIS": ["ga:DocumentType", "ga:AgentDocument", "ga:NeedsAnalysis"],
    "DOC-UW-GUIDE": ["ga:DocumentType", "ga:InsurerDocument", "ga:UWDocument", "ga:UWGuideline"],
    "DOC-UW-RULE": ["ga:DocumentType", "ga:InsurerDocument", "ga:UWDocument", "ga:UWRule"],
    "DOC-UW-DISEASE": ["ga:DocumentType", "ga:InsurerDocument", "ga:UWDocument", "ga:DiseaseUWCriteria"],
    "DOC-UW-JOB": ["ga:DocumentType", "ga:InsurerDocument", "ga:UWDocument", "ga:OccupationUWCriteria"],
    "DOC-EXCLUSION": ["ga:DocumentType", "ga:InsurerDocument", "ga:UWDocument", "ga:Exclusion"],
    "DOC-LAW-INSURANCE": ["ga:DocumentType", "ga:RegulatoryDocument", "ga:InsuranceBizAct"],
    "DOC-LAW-CONSUMER": ["ga:DocumentType", "ga:RegulatoryDocument", "ga:ConsumerProtectionAct"],
    "DOC-REGULATION": ["ga:DocumentType", "ga:RegulatoryDocument", "ga:SupervisoryRegulation"],
    "DOC-COMPLIANCE-GUIDE": ["ga:DocumentType", "ga:GADocument", "ga:ComplianceGuide"],
    "DOC-TRAINING": ["ga:DocumentType", "ga:TrainingDocument", "ga:TrainingMaterial"],
    "DOC-ONBOARDING": ["ga:DocumentType", "ga:TrainingDocument", "ga:OnboardingGuide"],
    "DOC-COMPLIANCE": ["ga:DocumentType", "ga:TrainingDocument", "ga:ComplianceTraining"],
    "DOC-CERTIFICATION": ["ga:DocumentType", "ga:TrainingDocument", "ga:CertificationTraining"],
    "DOC-SYSTEM-MANUAL": ["ga:DocumentType", "ga:GADocument"],
    "DOC-PROCESS": ["ga:DocumentType", "ga:GADocument", "ga:ProcessGuide"],
    "DOC-INTERNAL-MEMO": ["ga:DocumentType", "ga:GADocument", "ga:InternalMemo"],
    "DOC-NOTICE": ["ga:DocumentType", "ga:InsurerDocument", "ga:SalesDocument", "ga:Notice"],
    "DOC-SETTLEMENT": ["ga:DocumentType", "ga:GADocument", "ga:Settlement"],
    "DOC-PERFORMANCE": ["ga:DocumentType", "ga:GADocument", "ga:PerformanceReport"],
    "DOC-CHARGEBACK": ["ga:DocumentType", "ga:GADocument", "ga:ChargebackRule"],
    "DOC-BEST-PRACTICE": ["ga:DocumentType", "ga:ExpertKnowledge", "ga:BestPractice"],
    "DOC-EXPERT-TIP": ["ga:DocumentType", "ga:ExpertKnowledge", "ga:ExpertTip"],
    "DOC-CASE-STUDY": ["ga:DocumentType", "ga:ExpertKnowledge", "ga:CaseStudy"],
    "DOC-FAQ": ["ga:DocumentType", "ga:GADocument", "ga:FAQ"],
}

# 프로세스 → 클래스
PROCESS_CLASS_MAP = {
    "BIZ-PROSPECT": ["ga:BusinessProcess", "ga:SalesProcess", "ga:Prospecting"],
    "BIZ-CONSULT": ["ga:BusinessProcess", "ga:SalesProcess", "ga:Presentation"],
    "BIZ-UW": ["ga:BusinessProcess", "ga:SalesProcess", "ga:UnderwritingProcess"],
    "BIZ-ISSUE": ["ga:BusinessProcess", "ga:SalesProcess", "ga:PolicyIssuance"],
    "BIZ-HAPPYCALL": ["ga:BusinessProcess", "ga:PostSalesProcess", "ga:HappyCall"],
    "BIZ-MAINTAIN": ["ga:BusinessProcess", "ga:PostSalesProcess", "ga:ContractMaintenance"],
    "BIZ-CLAIM": ["ga:BusinessProcess", "ga:PostSalesProcess", "ga:ClaimProcess"],
    "BIZ-SETTLE": ["ga:BusinessProcess", "ga:SettlementProcess"],
    "BIZ-RECRUIT": ["ga:BusinessProcess", "ga:HRProcess", "ga:Recruiting"],
    "BIZ-EDUCATION": ["ga:BusinessProcess", "ga:HRProcess", "ga:EducationProcess"],
    "BIZ-COMPLIANCE": ["ga:BusinessProcess", "ga:ComplianceProcess"],
    "BIZ-COMMON": ["ga:BusinessProcess"],
}


# ═══════════════════════════════════════════════════════════════════════════════
# 3. 동의어 시소러스 (Synonym Thesaurus)
# ═══════════════════════════════════════════════════════════════════════════════

SYNONYM_MAP = {
    # 문서유형 동의어 → 문서유형 코드
    "약관": ["DOC-TERMS", "DOC-TERMS-SPECIAL"],
    "보통약관": ["DOC-TERMS"],
    "특약": ["DOC-TERMS-SPECIAL"],
    "특별약관": ["DOC-TERMS-SPECIAL"],
    "설명서": ["DOC-GUIDE"],
    "상품설명서": ["DOC-GUIDE"],
    "가이드": ["DOC-GUIDE", "DOC-UW-GUIDE", "DOC-COMPLIANCE-GUIDE"],
    "보험료": ["DOC-RATE-TABLE"],
    "보험료표": ["DOC-RATE-TABLE"],
    "요약": ["DOC-PRODUCT-SUMMARY"],
    "스크립트": ["DOC-SCRIPT"],
    "화법": ["DOC-SCRIPT"],
    "비교": ["DOC-COMPARISON"],
    "비교표": ["DOC-COMPARISON"],
    "상품비교": ["DOC-COMPARISON"],
    "시책": ["DOC-INCENTIVE"],
    "인센티브": ["DOC-INCENTIVE"],
    "수수료": ["DOC-COMMISSION", "DOC-COMMISSION-CALC", "DOC-SETTLEMENT"],
    "커미션": ["DOC-COMMISSION"],
    "1200%": ["DOC-COMMISSION-CALC", "DOC-REGULATION"],
    "1200%룰": ["DOC-COMMISSION-CALC", "DOC-REGULATION"],
    "분급제": ["DOC-COMMISSION-CALC", "DOC-REGULATION"],
    "청약": ["DOC-APPLICATION"],
    "청약서": ["DOC-APPLICATION"],
    "고지": ["DOC-DISCLOSURE"],
    "고지의무": ["DOC-DISCLOSURE"],
    "확인서": ["DOC-CONFIRMATION"],
    "심사": ["DOC-UW-GUIDE", "DOC-UW-RULE", "DOC-UW-DISEASE", "DOC-UW-JOB"],
    "언더라이팅": ["DOC-UW-GUIDE", "DOC-UW-RULE"],
    "심사기준": ["DOC-UW-RULE"],
    "질병": ["DOC-UW-DISEASE"],
    "직업": ["DOC-UW-JOB"],
    "당뇨": ["DOC-UW-DISEASE"],
    "고혈압": ["DOC-UW-DISEASE"],
    "면책": ["DOC-EXCLUSION"],
    "법률": ["DOC-LAW-INSURANCE", "DOC-LAW-CONSUMER"],
    "보험업법": ["DOC-LAW-INSURANCE"],
    "금소법": ["DOC-LAW-CONSUMER"],
    "금융소비자보호법": ["DOC-LAW-CONSUMER"],
    "규제": ["DOC-REGULATION", "DOC-LAW-INSURANCE"],
    "규정": ["DOC-REGULATION"],
    "감독규정": ["DOC-REGULATION"],
    "컴플라이언스": ["DOC-COMPLIANCE-GUIDE", "DOC-COMPLIANCE"],
    "교육": ["DOC-TRAINING", "DOC-ONBOARDING", "DOC-CERTIFICATION"],
    "신입": ["DOC-ONBOARDING"],
    "온보딩": ["DOC-ONBOARDING"],
    "자격증": ["DOC-CERTIFICATION"],
    "변액자격": ["DOC-CERTIFICATION"],
    "정산": ["DOC-SETTLEMENT"],
    "환수": ["DOC-CHARGEBACK"],
    "실적": ["DOC-PERFORMANCE"],
    "베스트프랙티스": ["DOC-BEST-PRACTICE"],
    "전문가": ["DOC-BEST-PRACTICE", "DOC-EXPERT-TIP"],
}


# ═══════════════════════════════════════════════════════════════════════════════
# 4. 개념 노드 정의 (Concept Nodes)
# ═══════════════════════════════════════════════════════════════════════════════

CONCEPTS = {
    # 보험료 구조
    "CONCEPT-GROSS-PREMIUM": {
        "name": "영업보험료",
        "class": "ga:GrossPremium",
        "synonyms": ["총보험료", "gross premium"],
        "narrower": ["CONCEPT-NET-PREMIUM", "CONCEPT-LOADING-PREMIUM"],
        "related_docs": ["DOC-RATE-TABLE", "DOC-GUIDE"],
    },
    "CONCEPT-NET-PREMIUM": {
        "name": "순보험료",
        "class": "ga:NetPremium",
        "synonyms": ["net premium"],
        "broader": "CONCEPT-GROSS-PREMIUM",
        "narrower": ["CONCEPT-RISK-PREMIUM", "CONCEPT-SAVINGS-PREMIUM"],
    },
    "CONCEPT-RISK-PREMIUM": {
        "name": "위험보험료",
        "class": "ga:RiskPremium",
        "broader": "CONCEPT-NET-PREMIUM",
    },
    "CONCEPT-SAVINGS-PREMIUM": {
        "name": "저축보험료",
        "class": "ga:SavingsPremium",
        "broader": "CONCEPT-NET-PREMIUM",
    },
    "CONCEPT-LOADING-PREMIUM": {
        "name": "부가보험료",
        "class": "ga:LoadingPremium",
        "broader": "CONCEPT-GROSS-PREMIUM",
        "description": "신계약비 + 유지비 + 수금비",
    },
    # 수수료 관련
    "CONCEPT-FYC": {
        "name": "초년도수수료",
        "class": "ga:FYC",
        "synonyms": ["FYC", "First Year Commission", "초회수수료"],
        "related_docs": ["DOC-COMMISSION", "DOC-SETTLEMENT"],
        "related_concepts": ["CONCEPT-1200-RULE"],
    },
    "CONCEPT-RENEWAL-COMM": {
        "name": "유지수수료",
        "class": "ga:RenewalCommission",
        "synonyms": ["차년도수수료", "renewal commission"],
        "related_docs": ["DOC-COMMISSION"],
    },
    "CONCEPT-OVERRIDE": {
        "name": "오버라이드",
        "class": "ga:OverrideComm",
        "synonyms": ["override", "조직장수수료"],
        "description": "하위 설계사 실적 기반 추가 수수료",
    },
    "CONCEPT-MAINTENANCE-FEE": {
        "name": "유지관리수수료",
        "class": "ga:MaintenanceFee",
        "synonyms": ["maintenance fee"],
        "description": "2027년 신설, 최대 7년 분할 지급",
        "related_concepts": ["CONCEPT-INSTALLMENT"],
    },
    "CONCEPT-APE": {
        "name": "환산보험료",
        "class": "ga:APE",
        "synonyms": ["APE", "Annual Premium Equivalent"],
        "description": "정기납 + (일시납 x 10%)",
    },
    # 규제 관련
    "CONCEPT-1200-RULE": {
        "name": "1200%룰",
        "class": "ga:Rule1200Percent",
        "synonyms": ["1200퍼센트룰", "수수료 상한"],
        "description": "초년도 모집수수료 월납보험료의 12배 이내",
        "related_docs": ["DOC-COMMISSION-CALC", "DOC-REGULATION"],
        "regulation_event": "2026-07-01",
    },
    "CONCEPT-INSTALLMENT": {
        "name": "분급제",
        "class": "ga:InstallmentPayment",
        "synonyms": ["수수료분급제", "분할지급"],
        "description": "4년(2027) → 7년(2029) 분할 지급",
        "related_docs": ["DOC-COMMISSION-CALC", "DOC-REGULATION"],
    },
    # 계약 관련
    "CONCEPT-LAPSE": {
        "name": "실효",
        "class": "ga:Lapse",
        "synonyms": ["lapse", "효력상실"],
        "description": "보험료 2개월 연속 미납 시",
        "related": ["CONCEPT-REINSTATEMENT"],
    },
    "CONCEPT-REINSTATEMENT": {
        "name": "부활",
        "class": "ga:Reinstatement",
        "synonyms": ["reinstatement", "효력회복"],
        "description": "실효 후 3년 이내",
        "related": ["CONCEPT-LAPSE"],
    },
    "CONCEPT-SURRENDER-VALUE": {
        "name": "해약환급금",
        "class": "ga:SurrenderValue",
        "synonyms": ["해지환급금", "surrender value", "환급금"],
        "related_docs": ["DOC-TERMS", "DOC-GUIDE"],
    },
    "CONCEPT-COOLING-OFF": {
        "name": "청약철회",
        "class": "ga:CoolingOff",
        "synonyms": ["cooling off", "철회"],
        "description": "보험증권 수령 후 15일 이내",
        "related_docs": ["DOC-APPLICATION", "DOC-LAW-CONSUMER"],
    },
    "CONCEPT-PERSISTENCY": {
        "name": "유지율",
        "class": "ga:PersistencyRate",
        "synonyms": ["persistency rate", "계약유지율"],
        "description": "13/25/37/61회차",
        "related_docs": ["DOC-PERFORMANCE", "DOC-SETTLEMENT"],
    },
    # 심사 관련
    "CONCEPT-DISCLOSURE-DUTY": {
        "name": "고지의무",
        "class": "ga:DutyOfDisclosure",
        "synonyms": ["duty of disclosure", "고지"],
        "description": "상법 제651조, 중요사항 사실대로 고지",
        "related_docs": ["DOC-DISCLOSURE", "DOC-APPLICATION"],
    },
    "CONCEPT-STANDARD-BODY": {
        "name": "표준체",
        "class": "ga:StandardBody",
        "synonyms": ["standard body", "일반체"],
        "antonym": "CONCEPT-SUBSTANDARD-BODY",
    },
    "CONCEPT-SUBSTANDARD-BODY": {
        "name": "부표준체",
        "class": "ga:SubstandardBody",
        "synonyms": ["substandard body", "조건부체"],
        "antonym": "CONCEPT-STANDARD-BODY",
    },
    "CONCEPT-EXCLUSION-PERIOD": {
        "name": "면책기간",
        "class": "ga:ExclusionPeriod",
        "synonyms": ["exclusion period"],
        "description": "보장 시작 전 기간 (암보험 90일)",
        "related": ["CONCEPT-REDUCTION-PERIOD"],
    },
    "CONCEPT-SIMPLIFIED-UW": {
        "name": "간편심사",
        "class": "ga:SimplifiedUW",
        "synonyms": ["간편고지", "simplified underwriting", "3-N-5"],
        "related_docs": ["DOC-UW-GUIDE"],
    },
    # 컴플라이언스
    "CONCEPT-INCOMPLETE-SALE": {
        "name": "불완전판매",
        "class": "ga:IncompleteSale",
        "synonyms": ["incomplete sale", "불완전판매비율"],
        "description": "(품보해지+민원해지+무효)/신계약×100",
        "related_docs": ["DOC-COMPLIANCE-GUIDE", "DOC-COMPLIANCE"],
    },
    "CONCEPT-CHURN": {
        "name": "승환계약",
        "class": "ga:ChurnContract",
        "synonyms": ["churning", "승환", "전환계약"],
        "description": "기존 해지 후 1개월 내 신계약 시 승환 간주",
        "related_docs": ["DOC-LAW-INSURANCE"],
    },
    "CONCEPT-HAPPY-CALL": {
        "name": "해피콜",
        "class": "ga:HappyCallConcept",
        "synonyms": ["happy call", "완전판매모니터링"],
        "description": "청약 후 설명의무 이행 확인",
        "related_docs": ["DOC-COMPLIANCE-GUIDE"],
    },
}


# ═══════════════════════════════════════════════════════════════════════════════
# 5. 관계 타입 정의
# ═══════════════════════════════════════════════════════════════════════════════

RELATION_TYPES = {
    # 문서 ↔ 문서
    "PARENT_OF": {"inverse": "CHILD_OF", "domain": "ga:DocumentType", "range": "ga:DocumentType"},
    "CHILD_OF": {"inverse": "PARENT_OF", "domain": "ga:DocumentType", "range": "ga:DocumentType"},
    "SIBLINGS": {"inverse": "SIBLINGS", "domain": "ga:DocumentType", "range": "ga:DocumentType"},
    "REFERENCES": {"inverse": "REFERENCED_BY", "domain": "ga:DocumentType", "range": "ga:DocumentType"},
    "REFERENCED_BY": {"inverse": "REFERENCES", "domain": "ga:DocumentType", "range": "ga:DocumentType"},
    "SUPERSEDES": {"inverse": "SUPERSEDED_BY", "domain": "ga:DocumentType", "range": "ga:DocumentType"},
    "SUPERSEDED_BY": {"inverse": "SUPERSEDES", "domain": "ga:DocumentType", "range": "ga:DocumentType"},
    # 엔티티 ↔ 문서
    "ISSUED_BY": {"domain": "ga:DocumentType", "range": "ga:Carrier"},
    "APPLIES_TO": {"domain": "ga:DocumentType", "range": "ga:Product"},
    "TARGETS_AUDIENCE": {"domain": "ga:DocumentType", "range": "ga:Role"},
    "USED_IN": {"domain": "ga:DocumentType", "range": "ga:BusinessProcess"},
    # 엔티티 ↔ 엔티티
    "OFFERS": {"domain": "ga:Carrier", "range": "ga:Product"},
    "REQUIRES_CERT": {"domain": "ga:Product", "range": "ga:Concept"},
    # 프로세스 순서
    "PRECEDES": {"inverse": "FOLLOWS", "domain": "ga:BusinessProcess", "range": "ga:BusinessProcess"},
    "FOLLOWS": {"inverse": "PRECEDES", "domain": "ga:BusinessProcess", "range": "ga:BusinessProcess"},
    # 규제
    "GOVERNS": {"domain": "ga:Regulation", "range": "ga:BusinessProcess"},
    "RESTRICTS": {"domain": "ga:Regulation", "range": "ga:DocumentType"},
    # 개념
    "BROADER": {"inverse": "NARROWER", "domain": "ga:Concept", "range": "ga:Concept"},
    "NARROWER": {"inverse": "BROADER", "domain": "ga:Concept", "range": "ga:Concept"},
    "SYNONYM_OF": {"domain": "ga:Concept", "range": "ga:Concept"},
    "RELATED_TO": {"domain": "ga:Concept", "range": "ga:Concept"},
    "EXPLAINS": {"domain": "ga:Concept", "range": "ga:DocumentType"},
}


# ═══════════════════════════════════════════════════════════════════════════════
# 6. 유틸리티
# ═══════════════════════════════════════════════════════════════════════════════

def get_class_hierarchy(class_name: str) -> list:
    """주어진 클래스의 전체 상위 클래스 경로를 반환"""
    def _find(tree, target, path):
        for key, children in tree.items():
            current_path = path + [key]
            if key == target:
                return current_path
            result = _find(children, target, current_path)
            if result:
                return result
        return None
    return _find(CLASS_HIERARCHY, class_name, []) or [class_name]


def get_all_subclasses(class_name: str) -> list:
    """주어진 클래스의 모든 하위 클래스를 반환"""
    def _find_subtree(tree, target):
        for key, children in tree.items():
            if key == target:
                return children
            result = _find_subtree(children, target)
            if result is not None:
                return result
        return None

    def _collect_all(tree):
        result = []
        for key, children in tree.items():
            result.append(key)
            result.extend(_collect_all(children))
        return result

    subtree = _find_subtree(CLASS_HIERARCHY, class_name)
    if subtree is None:
        return []
    return _collect_all(subtree)


def resolve_synonyms(keyword: str) -> list:
    """키워드의 동의어를 해석하여 관련 문서유형 코드 반환"""
    return SYNONYM_MAP.get(keyword, [])


def get_doc_type_classes(doc_type_id: str) -> list:
    """문서유형 ID에 대한 온톨로지 클래스 목록 반환"""
    return DOC_TYPE_CLASS_MAP.get(doc_type_id, [])


def get_related_concepts(keyword: str) -> list:
    """키워드 관련 개념 노드 반환"""
    results = []
    keyword_lower = keyword.lower()
    for concept_id, concept in CONCEPTS.items():
        if keyword_lower in concept["name"].lower():
            results.append(concept_id)
            continue
        for syn in concept.get("synonyms", []):
            if keyword_lower in syn.lower():
                results.append(concept_id)
                break
    return results


def get_ontology_stats():
    """온톨로지 통계"""
    def _count_classes(tree):
        count = 0
        for key, children in tree.items():
            count += 1
            count += _count_classes(children)
        return count

    return {
        "total_classes": _count_classes(CLASS_HIERARCHY),
        "carrier_mappings": len(CARRIER_CLASS_MAP),
        "product_mappings": len(PRODUCT_CLASS_MAP),
        "doc_type_mappings": len(DOC_TYPE_CLASS_MAP),
        "process_mappings": len(PROCESS_CLASS_MAP),
        "synonym_entries": len(SYNONYM_MAP),
        "concept_nodes": len(CONCEPTS),
        "relation_types": len(RELATION_TYPES),
    }


if __name__ == "__main__":
    import json
    stats = get_ontology_stats()
    print("=" * 60)
    print("GA 지식체계 온톨로지 통계")
    print("=" * 60)
    print(json.dumps(stats, indent=2, ensure_ascii=False))

    print("\n예시: DOC-COMMISSION 클래스 계층")
    for cls in DOC_TYPE_CLASS_MAP.get("DOC-COMMISSION", []):
        hierarchy = get_class_hierarchy(cls)
        print(f"  {cls}: {' > '.join(hierarchy)}")

    print("\n예시: '수수료' 동의어 해석")
    print(f"  {resolve_synonyms('수수료')}")

    print("\n예시: '수수료' 관련 개념")
    for c in get_related_concepts("수수료"):
        print(f"  {c}: {CONCEPTS[c]['name']}")
