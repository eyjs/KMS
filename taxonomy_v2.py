"""
iFA 지식체계 마스터 데이터 v2.0 (확장된 6-Facet Taxonomy)

확장 내용:
- 3-Axis → 6-Facet 체계로 확장
- 보험사: 3개 → 12개 (생명 6, 손해 6)
- 상품군: 2개 → 15개 (생명 6, 건강 4, 손해 3, 연금 2)
- 문서유형: 6개 → 20개
- 업무프로세스: 신규 (8개)
- 대상역할: 신규 (7개)

Single Source of Truth for KMS Taxonomy
"""

# ═══════════════════════════════════════════════════════════════════════════════
# FACET 1: 보험사 (Carrier) - WHO
# ═══════════════════════════════════════════════════════════════════════════════

CARRIERS = {
    # ── 생명보험사 ──
    "INS-SAMSUNG": {
        "name": "삼성생명",
        "alias": ["삼성", "SL", "삼성생명보험"],
        "type": "life",
        "tier": "major"  # major = 대형사
    },
    "INS-HANWHA": {
        "name": "한화생명",
        "alias": ["한화", "HL", "한화생명보험"],
        "type": "life",
        "tier": "major"
    },
    "INS-KYOBO": {
        "name": "교보생명",
        "alias": ["교보", "KL", "교보생명보험"],
        "type": "life",
        "tier": "major"
    },
    "INS-SHINHAN": {
        "name": "신한라이프",
        "alias": ["신한", "SHL", "신한생명"],
        "type": "life",
        "tier": "major"
    },
    "INS-NH": {
        "name": "NH농협생명",
        "alias": ["농협", "NHL", "농협생명"],
        "type": "life",
        "tier": "mid"
    },
    "INS-DONGYANG": {
        "name": "동양생명",
        "alias": ["동양", "DYL"],
        "type": "life",
        "tier": "mid"
    },
    
    # ── 손해보험사 ──
    "INS-SAMSUNGF": {
        "name": "삼성화재",
        "alias": ["삼성화재해상", "SF"],
        "type": "non-life",
        "tier": "major"
    },
    "INS-HYUNDAI": {
        "name": "현대해상",
        "alias": ["현대", "HM", "현대해상화재"],
        "type": "non-life",
        "tier": "major"
    },
    "INS-DB": {
        "name": "DB손해보험",
        "alias": ["DB손보", "DB", "동부화재"],
        "type": "non-life",
        "tier": "major"
    },
    "INS-KB": {
        "name": "KB손해보험",
        "alias": ["KB손보", "KB"],
        "type": "non-life",
        "tier": "major"
    },
    "INS-MERITZ": {
        "name": "메리츠화재",
        "alias": ["메리츠", "MZ", "메리츠손해"],
        "type": "non-life",
        "tier": "major"
    },
    "INS-HANHWA-D": {
        "name": "한화손해보험",
        "alias": ["한화손보", "HWD"],
        "type": "non-life",
        "tier": "mid"
    },
    
    # ── 특수 코드 ──
    "INS-COMMON": {
        "name": "공통",
        "alias": ["전체", "ALL"],
        "type": "common",
        "tier": "common",
        "description": "보험사 무관 공통 자료"
    },
}


# ═══════════════════════════════════════════════════════════════════════════════
# FACET 2: 상품군 (Product Line) - WHAT
# 2단계 계층: 대분류 > 세분류
# ═══════════════════════════════════════════════════════════════════════════════

PRODUCT_CATEGORIES = {
    "LIFE": {"name": "생명보험", "order": 1},
    "HEALTH": {"name": "건강보험", "order": 2},
    "NON-LIFE": {"name": "손해보험", "order": 3},
    "ANNUITY": {"name": "연금보험", "order": 4},
    "COMMON": {"name": "공통", "order": 99},
}

PRODUCTS = {
    # ── 생명보험 ──
    "PRD-LIFE-WHOLE": {
        "name": "종신보험",
        "category": "LIFE",
        "description": "사망 시 보험금 지급, 종신 보장",
        "alias": ["whole life", "종신"]
    },
    "PRD-LIFE-TERM": {
        "name": "정기보험",
        "category": "LIFE",
        "description": "일정 기간 내 사망 시 보험금 지급",
        "alias": ["term", "정기"]
    },
    "PRD-LIFE-VARIABLE": {
        "name": "변액보험",
        "category": "LIFE",
        "description": "펀드 투자형 보험",
        "alias": ["variable", "변액", "VUL", "VA"]
    },
    "PRD-LIFE-SAVING": {
        "name": "저축보험",
        "category": "LIFE",
        "description": "목돈 마련 저축형 보험",
        "alias": ["저축"]
    },
    "PRD-LIFE-EDU": {
        "name": "교육보험",
        "category": "LIFE",
        "description": "자녀 교육자금 마련",
        "alias": ["교육"]
    },
    "PRD-CHILD": {
        "name": "어린이보험",
        "category": "LIFE",
        "description": "어린이/태아 전용 종합보험",
        "alias": ["child", "태아", "어린이", "자녀"]
    },
    
    # ── 건강보험 (제3보험) ──
    "PRD-HEALTH-CI": {
        "name": "CI보험",
        "category": "HEALTH",
        "description": "중대질병 진단 시 일시금 지급",
        "alias": ["CI", "중대질병", "critical illness"]
    },
    "PRD-HEALTH-CANCER": {
        "name": "암보험",
        "category": "HEALTH",
        "description": "암 진단/치료비 보장",
        "alias": ["cancer", "암"]
    },
    "PRD-HEALTH-MEDICAL": {
        "name": "실손의료보험",
        "category": "HEALTH",
        "description": "실제 의료비 보상",
        "alias": ["실손", "의료실비", "medical"]
    },
    "PRD-HEALTH-LTC": {
        "name": "간병보험",
        "category": "HEALTH",
        "description": "장기요양 상태 보장",
        "alias": ["LTC", "간병", "장기요양"]
    },
    
    # ── 손해보험 ──
    "PRD-NONLIFE-AUTO": {
        "name": "자동차보험",
        "category": "NON-LIFE",
        "description": "자동차 관련 손해/배상 보장",
        "alias": ["자동차", "auto"]
    },
    "PRD-NONLIFE-FIRE": {
        "name": "화재보험",
        "category": "NON-LIFE",
        "description": "화재로 인한 손해 보장",
        "alias": ["화재", "fire"]
    },
    "PRD-NONLIFE-LIAB": {
        "name": "배상책임보험",
        "category": "NON-LIFE",
        "description": "제3자에 대한 배상책임 보장",
        "alias": ["배상책임", "liability"]
    },
    
    # ── 연금보험 ──
    "PRD-ANNUITY-TAX": {
        "name": "세제적격연금",
        "category": "ANNUITY",
        "description": "연말정산 세액공제 가능 연금",
        "alias": ["연금저축", "세제적격"]
    },
    "PRD-ANNUITY-GEN": {
        "name": "일반연금",
        "category": "ANNUITY",
        "description": "세제비적격 일반 연금",
        "alias": ["일반연금", "세제비적격"]
    },
    
    # ── 공통 ──
    "PRD-COMMON": {
        "name": "공통",
        "category": "COMMON",
        "description": "상품 무관 공통 자료",
        "alias": ["전체", "ALL"]
    },
}


# ═══════════════════════════════════════════════════════════════════════════════
# FACET 3: 문서유형 (Document Type) - WHICH
# ═══════════════════════════════════════════════════════════════════════════════

DOC_TYPES = {
    # ── 상품 관련 문서 (보험사 발행) ──
    "DOC-TERMS": {
        "name": "보통약관",
        "tier": "COLD",
        "source": "insurer",
        "description": "법적 구속력 있는 보험계약 기본 조건"
    },
    "DOC-TERMS-SPECIAL": {
        "name": "특별약관",
        "tier": "COLD",
        "source": "insurer",
        "description": "추가 담보/특약 조건"
    },
    "DOC-GUIDE": {
        "name": "상품설명서",
        "tier": "WARM",
        "source": "insurer",
        "description": "고객용 상품 안내 자료"
    },
    "DOC-RATE-TABLE": {
        "name": "보험료표",
        "tier": "HOT",
        "source": "insurer",
        "description": "연령/조건별 보험료 테이블"
    },
    "DOC-COMPARISON": {
        "name": "상품비교표",
        "tier": "WARM",
        "source": "ga",
        "description": "보험사 간 상품 비교 자료"
    },
    "DOC-BROCHURE": {
        "name": "브로슈어",
        "tier": "WARM",
        "source": "insurer",
        "description": "마케팅용 제품 안내서"
    },
    
    # ── 영업 관련 문서 ──
    "DOC-SCRIPT": {
        "name": "판매스크립트",
        "tier": "WARM",
        "source": "ga",
        "description": "설계사 상담용 스크립트"
    },
    "DOC-INCENTIVE": {
        "name": "시책",
        "tier": "HOT",
        "source": "insurer",
        "description": "판매 촉진 인센티브 정책"
    },
    "DOC-COMMISSION": {
        "name": "수수료체계",
        "tier": "HOT",
        "source": "insurer",
        "description": "설계사 수수료 구조"
    },
    
    # ── 심사 관련 문서 ──
    "DOC-UW-GUIDE": {
        "name": "심사가이드라인",
        "tier": "WARM",
        "source": "insurer",
        "description": "인수심사 기준 안내"
    },
    "DOC-UW-RULE": {
        "name": "심사기준",
        "tier": "COLD",
        "source": "insurer",
        "description": "질병/직업별 세부 심사 기준"
    },
    "DOC-EXCLUSION": {
        "name": "면책조항",
        "tier": "COLD",
        "source": "insurer",
        "description": "보험금 지급 제외 사유"
    },
    
    # ── 교육/훈련 문서 ──
    "DOC-TRAINING": {
        "name": "교육자료",
        "tier": "COLD",
        "source": "ga",
        "description": "설계사 교육용 자료"
    },
    "DOC-ONBOARDING": {
        "name": "신입교육",
        "tier": "COLD",
        "source": "ga",
        "description": "신입 설계사 온보딩 자료"
    },
    "DOC-COMPLIANCE": {
        "name": "컴플라이언스",
        "tier": "COLD",
        "source": "ga",
        "description": "법규 준수 교육 자료"
    },
    
    # ── 내부 운영 문서 ──
    "DOC-SYSTEM-MANUAL": {
        "name": "시스템매뉴얼",
        "tier": "COLD",
        "source": "ga",
        "description": "내부 시스템 사용 가이드"
    },
    "DOC-PROCESS": {
        "name": "업무프로세스",
        "tier": "WARM",
        "source": "ga",
        "description": "업무 절차 안내"
    },
    "DOC-INTERNAL-MEMO": {
        "name": "내부공지",
        "tier": "HOT",
        "source": "ga",
        "description": "내부 메모/회의록/공지"
    },
    
    # ── 전문가 지식 (암묵지) ──
    "DOC-BEST-PRACTICE": {
        "name": "베스트프랙티스",
        "tier": "WARM",
        "source": "expert",
        "description": "검증된 실무 노하우"
    },
    "DOC-EXPERT-TIP": {
        "name": "전문가팁",
        "tier": "WARM",
        "source": "expert",
        "description": "전문가 경험 기반 팁"
    },
}


# ═══════════════════════════════════════════════════════════════════════════════
# FACET 4: 업무프로세스 (Business Process)
# ═══════════════════════════════════════════════════════════════════════════════

PROCESSES = {
    "BIZ-CONSULT": {
        "name": "상담/청약",
        "description": "고객 상담, 니즈 파악, 청약서 작성",
        "order": 1
    },
    "BIZ-UW": {
        "name": "심사",
        "description": "언더라이팅, 위험 평가, 승낙/거절 결정",
        "order": 2
    },
    "BIZ-ISSUE": {
        "name": "계약발행",
        "description": "보험증권 발행, 계약 체결 완료",
        "order": 3
    },
    "BIZ-MAINTAIN": {
        "name": "보전",
        "description": "계약 변경, 해지, 부활, 갱신",
        "order": 4
    },
    "BIZ-CLAIM": {
        "name": "보험금청구",
        "description": "보험금 청구, 심사, 지급",
        "order": 5
    },
    "BIZ-SETTLE": {
        "name": "수수료정산",
        "description": "수수료 계산, 정산, 환수",
        "order": 6
    },
    "BIZ-RECRUIT": {
        "name": "리크루팅",
        "description": "설계사 채용, 등록, 위촉",
        "order": 7
    },
    "BIZ-COMMON": {
        "name": "공통",
        "description": "프로세스 무관 공통",
        "order": 99
    },
}


# ═══════════════════════════════════════════════════════════════════════════════
# FACET 5: 대상역할 (Audience Role)
# ═══════════════════════════════════════════════════════════════════════════════

AUDIENCES = {
    "AUD-AGENT": {
        "name": "설계사",
        "access_level": "standard",
        "description": "일반 설계사"
    },
    "AUD-AGENT-NEW": {
        "name": "신입설계사",
        "access_level": "standard",
        "description": "신입/수습 설계사"
    },
    "AUD-AGENT-SENIOR": {
        "name": "시니어설계사",
        "access_level": "enhanced",
        "description": "고성과 설계사"
    },
    "AUD-MANAGER": {
        "name": "지점장/팀장",
        "access_level": "manager",
        "description": "관리자급"
    },
    "AUD-UW": {
        "name": "언더라이터",
        "access_level": "enhanced",
        "description": "심사 담당자"
    },
    "AUD-ADMIN": {
        "name": "본사관리자",
        "access_level": "admin",
        "description": "본사 운영팀"
    },
    "AUD-ALL": {
        "name": "전체",
        "access_level": "public",
        "description": "전체 대상"
    },
}


# ═══════════════════════════════════════════════════════════════════════════════
# FACET 6: 유효기간/상태 (Validity Status)
# ═══════════════════════════════════════════════════════════════════════════════

VALIDITY_STATUS = {
    "draft": {"name": "임시저장", "searchable": False},
    "reviewing": {"name": "검토중", "searchable": False},
    "approved": {"name": "승인됨", "searchable": False},
    "active": {"name": "활성", "searchable": True, "default": True},
    "pending_expiry": {"name": "만료임박", "searchable": True},
    "expired": {"name": "만료", "searchable": False},
    "superseded": {"name": "대체됨", "searchable": True, "warning": True},
    "archived": {"name": "보관", "searchable": False},
}


# ═══════════════════════════════════════════════════════════════════════════════
# 문서 관계 유형 (Relationship Types)
# ═══════════════════════════════════════════════════════════════════════════════

RELATION_TYPES = {
    "PARENT_OF": {
        "name": "상위문서",
        "inverse": "CHILD_OF",
        "bidirectional": True,
        "description": "계층 관계 (약관 → 특약)"
    },
    "CHILD_OF": {
        "name": "하위문서",
        "inverse": "PARENT_OF",
        "bidirectional": True,
        "description": "계층 관계 (특약 → 약관)"
    },
    "SIBLINGS": {
        "name": "형제문서",
        "inverse": "SIBLINGS",
        "bidirectional": True,
        "description": "동일 레벨 관련 문서"
    },
    "REFERENCES": {
        "name": "참조",
        "inverse": "REFERENCED_BY",
        "bidirectional": False,
        "description": "단방향 참조 관계"
    },
    "REFERENCED_BY": {
        "name": "참조됨",
        "inverse": "REFERENCES",
        "bidirectional": False,
        "description": "역참조"
    },
    "SUPERSEDES": {
        "name": "대체함",
        "inverse": "SUPERSEDED_BY",
        "bidirectional": False,
        "description": "신규 버전이 기존 버전을 대체"
    },
    "SUPERSEDED_BY": {
        "name": "대체됨",
        "inverse": "SUPERSEDES",
        "bidirectional": False,
        "description": "기존 버전이 신규 버전으로 대체됨"
    },
    "REQUIRES": {
        "name": "필요함",
        "inverse": "REQUIRED_BY",
        "bidirectional": False,
        "description": "선행 문서 필요"
    },
}


# ═══════════════════════════════════════════════════════════════════════════════
# 문서유형 간 표준 연결 규칙 (Default Relations)
# ═══════════════════════════════════════════════════════════════════════════════

DEFAULT_RELATIONS = {
    # 상품설명서 → 약관, 스크립트 참조
    "DOC-GUIDE": {
        "REFERENCES": ["DOC-TERMS", "DOC-TERMS-SPECIAL"],
        "SIBLINGS": ["DOC-SCRIPT", "DOC-BROCHURE"],
    },
    
    # 판매스크립트 → 상품설명서, 시책 참조
    "DOC-SCRIPT": {
        "REFERENCES": ["DOC-GUIDE", "DOC-INCENTIVE"],
        "SIBLINGS": ["DOC-COMPARISON"],
    },
    
    # 시책 → 수수료 참조
    "DOC-INCENTIVE": {
        "REFERENCES": ["DOC-COMMISSION", "DOC-RATE-TABLE"],
    },
    
    # 수수료 → 보험료표 참조
    "DOC-COMMISSION": {
        "REFERENCES": ["DOC-RATE-TABLE"],
    },
    
    # 심사가이드 → 약관, 심사기준 참조
    "DOC-UW-GUIDE": {
        "REFERENCES": ["DOC-UW-RULE", "DOC-EXCLUSION"],
        "PARENT_OF": ["DOC-TERMS"],
    },
    
    # 특별약관 → 보통약관 하위
    "DOC-TERMS-SPECIAL": {
        "CHILD_OF": ["DOC-TERMS"],
    },
    
    # 교육자료 → 약관, 상품설명서 참조
    "DOC-TRAINING": {
        "REFERENCES": ["DOC-TERMS", "DOC-GUIDE", "DOC-SCRIPT"],
    },
    
    # 신입교육 → 교육자료, 컴플라이언스 참조
    "DOC-ONBOARDING": {
        "REFERENCES": ["DOC-TRAINING", "DOC-COMPLIANCE", "DOC-SYSTEM-MANUAL"],
    },
    
    # 베스트프랙티스 → 공식 문서 참조
    "DOC-BEST-PRACTICE": {
        "REFERENCES": ["DOC-GUIDE", "DOC-SCRIPT", "DOC-UW-GUIDE"],
    },
    
    # 전문가팁 → 공식 문서 참조
    "DOC-EXPERT-TIP": {
        "REFERENCES": ["DOC-GUIDE", "DOC-SCRIPT"],
    },
}


# ═══════════════════════════════════════════════════════════════════════════════
# Hot-Warm-Cold 티어 설정
# ═══════════════════════════════════════════════════════════════════════════════

DATA_TIERS = {
    "HOT": {
        "name": "Hot",
        "refresh_cycle": "daily",
        "cache_ttl_minutes": 60,
        "search_priority": 1,
        "doc_types": ["DOC-INCENTIVE", "DOC-COMMISSION", "DOC-RATE-TABLE", "DOC-INTERNAL-MEMO"]
    },
    "WARM": {
        "name": "Warm",
        "refresh_cycle": "weekly",
        "cache_ttl_minutes": 1440,  # 1 day
        "search_priority": 2,
        "doc_types": [
            "DOC-GUIDE", "DOC-SCRIPT", "DOC-UW-GUIDE", "DOC-COMPARISON",
            "DOC-BROCHURE", "DOC-PROCESS", "DOC-BEST-PRACTICE", "DOC-EXPERT-TIP"
        ]
    },
    "COLD": {
        "name": "Cold",
        "refresh_cycle": "quarterly",
        "cache_ttl_minutes": 10080,  # 7 days
        "search_priority": 3,
        "doc_types": [
            "DOC-TERMS", "DOC-TERMS-SPECIAL", "DOC-UW-RULE", "DOC-EXCLUSION",
            "DOC-TRAINING", "DOC-ONBOARDING", "DOC-COMPLIANCE", "DOC-SYSTEM-MANUAL"
        ]
    },
}


# ═══════════════════════════════════════════════════════════════════════════════
# 확장 통계
# ═══════════════════════════════════════════════════════════════════════════════

def get_taxonomy_stats():
    """분류체계 통계 반환"""
    return {
        "version": "2.0",
        "facets": 6,
        "carriers": {
            "total": len([c for c in CARRIERS if c != "INS-COMMON"]),
            "life": len([c for c, v in CARRIERS.items() if v.get("type") == "life"]),
            "non_life": len([c for c, v in CARRIERS.items() if v.get("type") == "non-life"]),
        },
        "products": {
            "total": len([p for p in PRODUCTS if p != "PRD-COMMON"]),
            "life": len([p for p, v in PRODUCTS.items() if v.get("category") == "LIFE"]),
            "health": len([p for p, v in PRODUCTS.items() if v.get("category") == "HEALTH"]),
            "non_life": len([p for p, v in PRODUCTS.items() if v.get("category") == "NON-LIFE"]),
            "annuity": len([p for p, v in PRODUCTS.items() if v.get("category") == "ANNUITY"]),
        },
        "doc_types": {
            "total": len(DOC_TYPES),
            "hot": len([d for d, v in DOC_TYPES.items() if v.get("tier") == "HOT"]),
            "warm": len([d for d, v in DOC_TYPES.items() if v.get("tier") == "WARM"]),
            "cold": len([d for d, v in DOC_TYPES.items() if v.get("tier") == "COLD"]),
        },
        "processes": len([p for p in PROCESSES if p != "BIZ-COMMON"]),
        "audiences": len([a for a in AUDIENCES if a != "AUD-ALL"]),
        "relation_types": len(RELATION_TYPES),
    }


if __name__ == "__main__":
    import json
    stats = get_taxonomy_stats()
    print("=== iFA KMS Taxonomy v2.0 Statistics ===")
    print(json.dumps(stats, indent=2, ensure_ascii=False))
