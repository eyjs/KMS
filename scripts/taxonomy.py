"""
KMS 문서관리 프레임워크 v3.0

시스템 프레임워크(불변) + 도메인 설정(가변) 분리.
GA 보험영업은 첫 번째 도메인(박스)이며,
프레임워크의 틀 안에서 도메인 전문가가 내부 체계를 정의한다.
"""

import json
from datetime import datetime


# ═══════════════════════════════════════════════════════════════════════════════
# 시스템 프레임워크 (도메인 무관, 불변 규칙)
# ═══════════════════════════════════════════════════════════════════════════════

SYSTEM_CONFIG = {
    # 라이프사이클 상태 머신
    "lifecycle_states": ["DRAFT", "REVIEW", "ACTIVE", "STALE", "DEPRECATED", "ARCHIVED"],
    "lifecycle_transitions": {
        "DRAFT": ["REVIEW"],
        "REVIEW": ["ACTIVE", "REJECTED"],
        "REJECTED": ["DRAFT"],
        "ACTIVE": ["STALE", "DEPRECATED"],
        "STALE": ["ACTIVE", "DEPRECATED"],
        "DEPRECATED": ["ARCHIVED"],
        "ARCHIVED": [],
    },
    # 신선도 기본값 (일)
    "freshness_defaults": {
        "HOT": 30,
        "WARM": 90,
        "COLD": 365,
    },
    # 신선도 판정 기준
    "freshness_thresholds": {
        "FRESH": 0.7,    # daysSince < maxDays * 0.7
        "WARNING": 1.0,  # daysSince < maxDays
        # EXPIRED: daysSince >= maxDays → STALE 전환
    },
    # 관계 타입
    "relationship_types": {
        "PARENT_OF": {"inverse": "CHILD_OF", "scope": "same_domain", "bidirectional": True},
        "CHILD_OF": {"inverse": "PARENT_OF", "scope": "same_domain", "bidirectional": True},
        "SIBLING": {"inverse": "SIBLING", "scope": "same_domain", "bidirectional": True},
        "REFERENCE": {"inverse": None, "scope": "cross_domain", "bidirectional": False},
        "SUPERSEDES": {"inverse": "SUPERSEDED_BY", "scope": "cross_domain", "bidirectional": False},
    },
    # 버전 규칙
    "version_scheme": "MAJOR.MINOR",
}


# ═══════════════════════════════════════════════════════════════════════════════
# 사업(Business) 등록
# ═══════════════════════════════════════════════════════════════════════════════

BUSINESSES = {
    "GA": {"name": "GA 보험영업", "description": "보험대리점 영업/계약/정산"},
    "MEDI": {"name": "메디코드", "description": "AI 보험설계 서비스"},
    "COMMON": {"name": "공통", "description": "전사 공통 규제/시스템"},
}


# ═══════════════════════════════════════════════════════════════════════════════
# 도메인(Business×Function) 등록
# ═══════════════════════════════════════════════════════════════════════════════

DOMAINS = {
    "GA-SALES": {
        "business": "GA",
        "function": "SALES",
        "name": "GA 영업/상담",
        "facets": [
            {"id": "carrier", "name": "보험사", "required": True},
            {"id": "product", "name": "상품", "required": True},
            {"id": "docType", "name": "문서유형", "required": True},
        ],
        "optionalMeta": [
            {"id": "audience", "name": "역할"},
        ],
        "freshnessOverrides": {"DOC-INCENTIVE": 14},
        "ssotKey": ["carrier", "product", "docType"],
    },
    "GA-COMM": {
        "business": "GA",
        "function": "COMM",
        "name": "GA 수수료/정산",
        "facets": [
            {"id": "carrier", "name": "보험사", "required": True},
            {"id": "product", "name": "상품", "required": True},
            {"id": "docType", "name": "문서유형", "required": True},
        ],
        "optionalMeta": [],
        "freshnessOverrides": {"DOC-COMMISSION": 30, "DOC-COMMISSION-CALC": 30},
        "ssotKey": ["carrier", "product", "docType"],
    },
    "GA-CONTRACT": {
        "business": "GA",
        "function": "CONTRACT",
        "name": "GA 계약관리",
        "facets": [
            {"id": "carrier", "name": "보험사", "required": True},
            {"id": "product", "name": "상품", "required": True},
            {"id": "docType", "name": "문서유형", "required": True},
        ],
        "optionalMeta": [],
        "freshnessOverrides": {},
        "ssotKey": ["carrier", "product", "docType"],
    },
    "GA-COMP": {
        "business": "GA",
        "function": "COMP",
        "name": "GA 컴플라이언스",
        "facets": [
            {"id": "carrier", "name": "보험사", "required": True},
            {"id": "docType", "name": "문서유형", "required": True},
        ],
        "optionalMeta": [],
        "freshnessOverrides": {},
        "ssotKey": ["carrier", "docType"],
    },
    "GA-EDU": {
        "business": "GA",
        "function": "EDU",
        "name": "GA 교육/역량",
        "facets": [
            {"id": "docType", "name": "문서유형", "required": True},
        ],
        "optionalMeta": [
            {"id": "audience", "name": "대상 역할"},
        ],
        "freshnessOverrides": {},
        "ssotKey": ["docType"],
    },
    "COMMON-COMP": {
        "business": "COMMON",
        "function": "COMP",
        "name": "공통 규제/법률",
        "facets": [
            {"id": "docType", "name": "문서유형", "required": True},
        ],
        "optionalMeta": [],
        "freshnessOverrides": {"DOC-REGULATION": 365},
        "ssotKey": ["docType"],
    },
}

# 문서유형 → 도메인 자동 매핑
DOC_TYPE_DOMAIN_MAP = {
    # 영업/상담 문서
    "DOC-TERMS": "GA-SALES",
    "DOC-TERMS-SPECIAL": "GA-SALES",
    "DOC-GUIDE": "GA-SALES",
    "DOC-RATE-TABLE": "GA-SALES",
    "DOC-BROCHURE": "GA-SALES",
    "DOC-PRODUCT-SUMMARY": "GA-SALES",
    "DOC-SCRIPT": "GA-SALES",
    "DOC-COMPARISON": "GA-SALES",
    "DOC-PROPOSAL": "GA-SALES",
    "DOC-UW-GUIDE": "GA-SALES",
    "DOC-UW-RULE": "GA-SALES",
    "DOC-UW-DISEASE": "GA-SALES",
    "DOC-UW-JOB": "GA-SALES",
    "DOC-EXCLUSION": "GA-SALES",
    "DOC-CUSTOMER-CARD": "GA-SALES",
    "DOC-NEEDS-ANALYSIS": "GA-SALES",
    "DOC-BEST-PRACTICE": "GA-SALES",
    "DOC-EXPERT-TIP": "GA-SALES",
    "DOC-CASE-STUDY": "GA-SALES",
    "DOC-FAQ": "GA-SALES",
    "DOC-NOTICE": "GA-SALES",
    "DOC-INTERNAL-MEMO": "GA-SALES",
    # 수수료/정산
    "DOC-INCENTIVE": "GA-COMM",
    "DOC-COMMISSION": "GA-COMM",
    "DOC-COMMISSION-CALC": "GA-COMM",
    "DOC-SETTLEMENT": "GA-COMM",
    "DOC-PERFORMANCE": "GA-COMM",
    "DOC-CHARGEBACK": "GA-COMM",
    # 계약관리
    "DOC-APPLICATION": "GA-CONTRACT",
    "DOC-DISCLOSURE": "GA-CONTRACT",
    "DOC-CONFIRMATION": "GA-CONTRACT",
    # 컴플라이언스
    "DOC-COMPLIANCE-GUIDE": "GA-COMP",
    "DOC-PROCESS": "GA-COMP",
    "DOC-SYSTEM-MANUAL": "GA-COMP",
    # 교육
    "DOC-TRAINING": "GA-EDU",
    "DOC-ONBOARDING": "GA-EDU",
    "DOC-COMPLIANCE": "GA-EDU",
    "DOC-CERTIFICATION": "GA-EDU",
    # 공통 규제
    "DOC-LAW-INSURANCE": "COMMON-COMP",
    "DOC-LAW-CONSUMER": "COMMON-COMP",
    "DOC-REGULATION": "COMMON-COMP",
}


# ═══════════════════════════════════════════════════════════════════════════════
# GA 도메인 데이터 (첫 번째 박스)
# ═══════════════════════════════════════════════════════════════════════════════

# ── FACET: 보험사 (Carrier) ──

CARRIERS = {
    # ── 생명보험사 (대형) ──
    "INS-SAMSUNG": {"name": "삼성생명", "alias": ["삼성", "SL"], "type": "life", "tier": "major"},
    "INS-HANWHA": {"name": "한화생명", "alias": ["한화", "HL"], "type": "life", "tier": "major"},
    "INS-KYOBO": {"name": "교보생명", "alias": ["교보", "KL"], "type": "life", "tier": "major"},
    "INS-SHINHAN": {"name": "신한라이프", "alias": ["신한", "SHL"], "type": "life", "tier": "major"},

    # ── 생명보험사 (중형) ──
    "INS-NH": {"name": "NH농협생명", "alias": ["농협", "NHL"], "type": "life", "tier": "mid"},
    "INS-DONGYANG": {"name": "동양생명", "alias": ["동양", "DYL"], "type": "life", "tier": "mid"},
    "INS-MIRAE": {"name": "미래에셋생명", "alias": ["미래에셋"], "type": "life", "tier": "mid"},
    "INS-ABL": {"name": "ABL생명", "alias": ["ABL"], "type": "life", "tier": "mid"},
    "INS-HEUNGKUK": {"name": "흥국생명", "alias": ["흥국"], "type": "life", "tier": "mid"},

    # ── 손해보험사 (대형) ──
    "INS-SAMSUNGF": {"name": "삼성화재", "alias": ["삼성화재해상", "SF"], "type": "non-life", "tier": "major"},
    "INS-HYUNDAI": {"name": "현대해상", "alias": ["현대", "HM"], "type": "non-life", "tier": "major"},
    "INS-DB": {"name": "DB손해보험", "alias": ["DB손보", "DB", "동부화재"], "type": "non-life", "tier": "major"},
    "INS-KB": {"name": "KB손해보험", "alias": ["KB손보", "KB"], "type": "non-life", "tier": "major"},
    "INS-MERITZ": {"name": "메리츠화재", "alias": ["메리츠", "MZ"], "type": "non-life", "tier": "major"},

    # ── 손해보험사 (중형) ──
    "INS-HANWHA-D": {"name": "한화손해보험", "alias": ["한화손보", "HWD"], "type": "non-life", "tier": "mid"},
    "INS-HEUNGKUK-D": {"name": "흥국화재", "alias": ["흥국화재"], "type": "non-life", "tier": "mid"},
    "INS-LOTTE": {"name": "롯데손해보험", "alias": ["롯데손보"], "type": "non-life", "tier": "mid"},

    # ── 공통 ──
    "INS-COMMON": {"name": "공통", "alias": ["전체", "ALL"], "type": "common", "tier": "common"},
}


# ── FACET: 상품군 (Product Line) ──

PRODUCT_CATEGORIES = {
    "LIFE": {"name": "생명보험", "order": 1},
    "HEALTH": {"name": "건강/제3보험", "order": 2},
    "NON-LIFE": {"name": "손해보험", "order": 3},
    "ANNUITY": {"name": "연금/저축", "order": 4},
    "COMMON": {"name": "공통", "order": 99},
}

PRODUCTS = {
    # ── 생명보험 ──
    "PRD-LIFE-WHOLE": {"name": "종신보험", "category": "LIFE", "alias": ["whole life", "종신"]},
    "PRD-LIFE-TERM": {"name": "정기보험", "category": "LIFE", "alias": ["term", "정기"]},
    "PRD-LIFE-VARIABLE": {"name": "변액보험", "category": "LIFE", "alias": ["variable", "변액", "VUL"], "requires_license": "변액"},
    "PRD-LIFE-UNIVERSAL": {"name": "유니버셜보험", "category": "LIFE", "alias": ["universal", "UL"]},
    "PRD-CHILD": {"name": "어린이보험", "category": "LIFE", "alias": ["child", "태아", "어린이"]},
    "PRD-LIFE-EDU": {"name": "교육보험", "category": "LIFE", "alias": ["교육"]},

    # ── 건강/제3보험 ──
    "PRD-HEALTH-CI": {"name": "CI보험", "category": "HEALTH", "alias": ["CI", "중대질병"]},
    "PRD-HEALTH-CANCER": {"name": "암보험", "category": "HEALTH", "alias": ["cancer", "암"], "exemption_period": 90},
    "PRD-HEALTH-MEDICAL": {"name": "실손의료보험", "category": "HEALTH", "alias": ["실손", "의료실비"], "generation": 4},
    "PRD-HEALTH-LTC": {"name": "간병보험", "category": "HEALTH", "alias": ["LTC", "간병", "장기요양"]},
    "PRD-HEALTH-DENTAL": {"name": "치아보험", "category": "HEALTH", "alias": ["치아", "dental"]},
    "PRD-HEALTH-SIMPLE": {"name": "간편심사보험", "category": "HEALTH", "alias": ["간편", "간편고지"], "uw_type": "simplified"},

    # ── 손해보험 ──
    "PRD-NONLIFE-AUTO": {"name": "자동차보험", "category": "NON-LIFE", "alias": ["자동차", "auto"], "mandatory": True},
    "PRD-NONLIFE-FIRE": {"name": "화재보험", "category": "NON-LIFE", "alias": ["화재", "fire"]},
    "PRD-NONLIFE-LIAB": {"name": "배상책임보험", "category": "NON-LIFE", "alias": ["배상책임", "liability"]},
    "PRD-NONLIFE-MARINE": {"name": "해상보험", "category": "NON-LIFE", "alias": ["해상", "marine"]},
    "PRD-NONLIFE-TRAVEL": {"name": "여행자보험", "category": "NON-LIFE", "alias": ["여행", "travel"]},

    # ── 연금/저축 ──
    "PRD-ANNUITY-TAX": {"name": "세제적격연금", "category": "ANNUITY", "alias": ["연금저축"], "tax_benefit": True},
    "PRD-ANNUITY-GEN": {"name": "일반연금", "category": "ANNUITY", "alias": ["일반연금"]},
    "PRD-ANNUITY-VAR": {"name": "변액연금", "category": "ANNUITY", "alias": ["변액연금"], "requires_license": "변액"},
    "PRD-SAVING": {"name": "저축보험", "category": "ANNUITY", "alias": ["저축"]},

    # ── 공통 ──
    "PRD-COMMON": {"name": "공통", "category": "COMMON", "alias": ["전체", "ALL"]},

    # ── 버전/개편 상품 ──
    "PRD-LIFE-WHOLE-R2602": {"name": "종신보험 리뉴얼(2026-02)", "category": "LIFE", "alias": ["종신 리뉴얼"], "supersedes": "PRD-LIFE-WHOLE"},
    "PRD-CHILD-R2602": {"name": "어린이보험 리뉴얼(2026-02)", "category": "LIFE", "alias": ["어린이 리뉴얼"], "supersedes": "PRD-CHILD"},
    "PRD-HEALTH-CANCER-V2": {"name": "암보험 2세대", "category": "HEALTH", "alias": ["암보험2세대", "암보험V2"], "supersedes": "PRD-HEALTH-CANCER", "exemption_period": 90},
    "PRD-HEALTH-CI-PLUS": {"name": "CI보험 플러스", "category": "HEALTH", "alias": ["CI플러스"], "supersedes": "PRD-HEALTH-CI"},
    "PRD-HEALTH-MEDICAL-5G": {"name": "실손의료보험 5세대", "category": "HEALTH", "alias": ["실손5세대", "5세대실손"], "supersedes": "PRD-HEALTH-MEDICAL", "generation": 5},
}


# ── FACET: 문서유형 (Document Type) ──

DOC_TYPES = {
    # ── 상품 문서 (보험사 발행) ──
    "DOC-TERMS": {"name": "보통약관", "tier": "COLD", "source": "insurer", "retention_years": 10},
    "DOC-TERMS-SPECIAL": {"name": "특별약관", "tier": "COLD", "source": "insurer"},
    "DOC-GUIDE": {"name": "상품설명서", "tier": "WARM", "source": "insurer"},
    "DOC-RATE-TABLE": {"name": "보험료표", "tier": "HOT", "source": "insurer"},
    "DOC-BROCHURE": {"name": "브로슈어", "tier": "WARM", "source": "insurer"},
    "DOC-PRODUCT-SUMMARY": {"name": "상품요약서", "tier": "WARM", "source": "insurer"},

    # ── 영업 문서 ──
    "DOC-SCRIPT": {"name": "판매스크립트", "tier": "WARM", "source": "ga"},
    "DOC-COMPARISON": {"name": "상품비교표", "tier": "WARM", "source": "ga"},
    "DOC-PROPOSAL": {"name": "가입설계서", "tier": "HOT", "source": "agent", "description": "보장내역, 보험료, 환급금 예시"},

    # ── 수수료/시책 ──
    "DOC-INCENTIVE": {"name": "시책", "tier": "HOT", "source": "insurer"},
    "DOC-COMMISSION": {"name": "수수료체계", "tier": "HOT", "source": "insurer"},
    "DOC-COMMISSION-CALC": {"name": "수수료계산기준", "tier": "HOT", "source": "insurer", "description": "1200%룰, 분급제 적용"},

    # ── 청약/계약 문서 ──
    "DOC-APPLICATION": {"name": "청약서", "tier": "COLD", "source": "insurer", "retention_years": 10},
    "DOC-DISCLOSURE": {"name": "고지사항", "tier": "COLD", "source": "insurer"},
    "DOC-CONFIRMATION": {"name": "확인서", "tier": "COLD", "source": "agent", "description": "비교·설명의무 이행 증빙"},
    "DOC-CUSTOMER-CARD": {"name": "고객관리카드", "tier": "WARM", "source": "agent"},
    "DOC-NEEDS-ANALYSIS": {"name": "니즈분석표", "tier": "WARM", "source": "agent"},

    # ── 심사 문서 ──
    "DOC-UW-GUIDE": {"name": "심사가이드라인", "tier": "WARM", "source": "insurer"},
    "DOC-UW-RULE": {"name": "심사기준", "tier": "COLD", "source": "insurer"},
    "DOC-UW-DISEASE": {"name": "질병별심사기준", "tier": "COLD", "source": "insurer"},
    "DOC-UW-JOB": {"name": "직업별심사기준", "tier": "COLD", "source": "insurer"},
    "DOC-EXCLUSION": {"name": "면책조항", "tier": "COLD", "source": "insurer"},

    # ── 법률/규정 문서 ──
    "DOC-LAW-INSURANCE": {"name": "보험업법", "tier": "COLD", "source": "regulator"},
    "DOC-LAW-CONSUMER": {"name": "금융소비자보호법", "tier": "COLD", "source": "regulator"},
    "DOC-REGULATION": {"name": "감독규정", "tier": "COLD", "source": "regulator"},
    "DOC-COMPLIANCE-GUIDE": {"name": "컴플라이언스가이드", "tier": "WARM", "source": "ga"},

    # ── 교육 문서 ──
    "DOC-TRAINING": {"name": "교육자료", "tier": "COLD", "source": "ga"},
    "DOC-ONBOARDING": {"name": "신입교육", "tier": "COLD", "source": "ga"},
    "DOC-COMPLIANCE": {"name": "컴플라이언스교육", "tier": "COLD", "source": "ga"},
    "DOC-CERTIFICATION": {"name": "자격증교육", "tier": "COLD", "source": "ga", "description": "AFPK, CFP, 변액자격"},

    # ── 내부 운영 문서 ──
    "DOC-SYSTEM-MANUAL": {"name": "시스템매뉴얼", "tier": "COLD", "source": "ga"},
    "DOC-PROCESS": {"name": "업무프로세스", "tier": "WARM", "source": "ga"},
    "DOC-INTERNAL-MEMO": {"name": "내부공지", "tier": "HOT", "source": "ga"},
    "DOC-NOTICE": {"name": "공문", "tier": "HOT", "source": "insurer", "description": "상품 개정/판매중단 안내"},

    # ── 정산/실적 문서 ──
    "DOC-SETTLEMENT": {"name": "정산자료", "tier": "HOT", "source": "ga", "retention_years": 5},
    "DOC-PERFORMANCE": {"name": "실적보고서", "tier": "HOT", "source": "ga"},
    "DOC-CHARGEBACK": {"name": "환수기준", "tier": "WARM", "source": "ga"},

    # ── 전문가 지식 ──
    "DOC-BEST-PRACTICE": {"name": "베스트프랙티스", "tier": "WARM", "source": "expert"},
    "DOC-EXPERT-TIP": {"name": "전문가팁", "tier": "WARM", "source": "expert"},
    "DOC-CASE-STUDY": {"name": "케이스스터디", "tier": "WARM", "source": "expert"},
    "DOC-FAQ": {"name": "자주묻는질문", "tier": "WARM", "source": "ga"},
}


# ── 업무프로세스 (Business Process) ──

PROCESSES = {
    "BIZ-PROSPECT": {"name": "가망고객발굴", "order": 0, "description": "DB영업, 개척, 소개"},
    "BIZ-CONSULT": {"name": "상담/청약", "order": 1, "description": "니즈파악, 상품설명, 청약서 작성"},
    "BIZ-UW": {"name": "심사", "order": 2, "description": "언더라이팅, 승낙/거절"},
    "BIZ-ISSUE": {"name": "계약발행", "order": 3, "description": "증권발급, 책임개시"},
    "BIZ-HAPPYCALL": {"name": "해피콜", "order": 4, "description": "완전판매 모니터링"},
    "BIZ-MAINTAIN": {"name": "보전", "order": 5, "description": "변경, 해지, 부활, 갱신"},
    "BIZ-CLAIM": {"name": "보험금청구", "order": 6, "description": "청구, 심사, 지급"},
    "BIZ-SETTLE": {"name": "수수료정산", "order": 7, "description": "FYC, 유지수수료, 시책, 환수"},
    "BIZ-RECRUIT": {"name": "리크루팅", "order": 8, "description": "설계사 채용, 등록, 위촉"},
    "BIZ-EDUCATION": {"name": "교육", "order": 9, "description": "법정교육, 상품교육, 자격증"},
    "BIZ-COMPLIANCE": {"name": "컴플라이언스", "order": 10, "description": "내부통제, 불완전판매 방지"},
    "BIZ-COMMON": {"name": "공통", "order": 99},
}


# ── 대상역할 (Audience Role) ──

AUDIENCES = {
    "AUD-AGENT-NEW": {"name": "신입설계사", "level": 1, "description": "등록 1년 미만"},
    "AUD-AGENT": {"name": "일반설계사", "level": 2},
    "AUD-AGENT-SENIOR": {"name": "시니어설계사", "level": 3, "description": "3년 이상, 우수실적"},
    "AUD-AGENT-GOLD": {"name": "골드등급", "level": 4, "description": "상위 10%"},
    "AUD-TEAM-LEADER": {"name": "팀장", "level": 5, "description": "설계매니저"},
    "AUD-BRANCH-MGR": {"name": "지점장", "level": 6},
    "AUD-MANAGER": {"name": "본사관리자", "level": 7},
    "AUD-UW": {"name": "언더라이터", "level": 5, "description": "심사 담당"},
    "AUD-COMPLIANCE": {"name": "컴플라이언스담당", "level": 5},
    "AUD-TRAINER": {"name": "교육담당", "level": 5},
    "AUD-ALL": {"name": "전체", "level": 0},
}


# ── 자격증 ──

CERTIFICATIONS = {
    "CERT-LIFE": {"name": "생명보험자격", "mandatory": True, "hours": 20},
    "CERT-NONLIFE": {"name": "손해보험자격", "mandatory": True, "hours": 20},
    "CERT-VARIABLE": {"name": "변액보험판매자격", "mandatory": False, "products": ["PRD-LIFE-VARIABLE", "PRD-ANNUITY-VAR"]},
    "CERT-AFPK": {"name": "AFPK", "mandatory": False, "description": "재무설계사"},
    "CERT-CFP": {"name": "CFP", "mandatory": False, "description": "국제공인재무설계사"},
    "CERT-LOSS-ADJ": {"name": "손해사정사", "mandatory": False},
    "CERT-REFRESHER": {"name": "보수교육", "mandatory": True, "cycle_years": 2, "hours": 8},
}


# ── GA 유형 ──

GA_TYPES = {
    "GA-BRANCH": {"name": "지사형", "description": "연합, 독립채산제", "examples": ["GA코리아", "글로벌금융판매"], "control_rating": "low"},
    "GA-OWNER": {"name": "독립형/오너형", "description": "본점 중심 운영", "examples": ["인카금융서비스", "피플라이프"], "control_rating": "high"},
    "GA-SUBSIDIARY": {"name": "자회사형", "description": "보험사 설립 GA", "examples": ["한화생명금융서비스", "삼성화재금융서비스"], "control_rating": "mid", "risk": "모회사 상품 쏠림"},
    "GA-HOMESHOPPING": {"name": "홈쇼핑형", "description": "콜센터 아웃소싱", "control_rating": "mid"},
    "GA-DIGITAL": {"name": "디지털GA", "description": "앱 기반", "examples": ["굿리치(리치앤코)"], "control_rating": "high"},
}


# ── 규제 일정 ──

REGULATION_TIMELINE = [
    {"date": "2024-01-01", "name": "대형GA 내부통제 실태평가", "description": "500인 이상 GA 평가 시행", "status": "active"},
    {"date": "2026-01-01", "name": "차익거래 금지기간 확대", "description": "전기간 확대, 수수료율 비교공시", "status": "upcoming"},
    {"date": "2026-07-01", "name": "1200%룰 GA 확대", "description": "GA 소속 설계사에게도 적용", "status": "upcoming", "impact": "high"},
    {"date": "2027-01-01", "name": "4년 분급제 시행", "description": "선지급 수수료 제한, 유지관리수수료 신설", "status": "upcoming", "impact": "high"},
    {"date": "2029-01-01", "name": "7년 분급제 전면 시행", "description": "최대 7년간 분할 지급", "status": "upcoming", "impact": "critical"},
]


# ── 수수료 체계 ──

COMMISSION_TYPES = {
    "FYC": {"name": "초년도수수료", "description": "First Year Commission"},
    "RENEWAL": {"name": "유지수수료", "description": "차년도 이후"},
    "INCENTIVE": {"name": "시책", "description": "판매 촉진 인센티브"},
    "SETTLEMENT": {"name": "정착지원금", "description": "신규 설계사 지원"},
    "OVERRIDE": {"name": "오버라이드", "description": "조직장 추가 수수료"},
    "MAINTENANCE": {"name": "유지관리수수료", "description": "2027년 신설, 7년 분급"},
}

CHARGEBACK_RULES = {
    "3M": {"months": 3, "rate": 100, "description": "3개월 내 해지 시 100% 환수"},
    "6M": {"months": 6, "rate": 50, "description": "6개월 내 해지 시 50% 환수"},
    "12M": {"months": 12, "rate": 25, "description": "12개월 내 해지 시 25~30% 환수"},
}


# ── KPI 지표 ──

KPI_METRICS = {
    "PERSIST-13": {"name": "13회차 유지율", "description": "1년차 계약 유지", "benchmark": 88.3},
    "PERSIST-25": {"name": "25회차 유지율", "description": "2년차 계약 유지", "benchmark": 75.8},
    "PERSIST-37": {"name": "37회차 유지율", "description": "3년차 계약 유지", "benchmark": 49.4},
    "PERSIST-61": {"name": "61회차 유지율", "description": "5년차 계약 유지", "benchmark": 43.6},
    "INCOMPLETE-SALE": {"name": "불완전판매비율", "description": "(품보해지+민원해지+무효)/신계약", "target": "<3%"},
}


# ── 문서 관계 규칙 ──

DEFAULT_RELATIONS = {
    "DOC-GUIDE": {"REFERENCES": ["DOC-TERMS", "DOC-TERMS-SPECIAL"], "SIBLINGS": ["DOC-SCRIPT", "DOC-BROCHURE"]},
    "DOC-TERMS-SPECIAL": {"CHILD_OF": ["DOC-TERMS"]},
    "DOC-BROCHURE": {"REFERENCES": ["DOC-GUIDE"], "SIBLINGS": ["DOC-PRODUCT-SUMMARY"]},
    "DOC-PRODUCT-SUMMARY": {"REFERENCES": ["DOC-GUIDE", "DOC-TERMS"]},
    "DOC-RATE-TABLE": {"REFERENCES": ["DOC-TERMS"]},
    "DOC-COMPARISON": {"REFERENCES": ["DOC-GUIDE", "DOC-RATE-TABLE"]},
    "DOC-SCRIPT": {"REFERENCES": ["DOC-GUIDE", "DOC-INCENTIVE", "DOC-COMPARISON"]},
    "DOC-PROPOSAL": {"REFERENCES": ["DOC-GUIDE", "DOC-RATE-TABLE", "DOC-NEEDS-ANALYSIS"]},
    "DOC-NEEDS-ANALYSIS": {"SIBLINGS": ["DOC-CUSTOMER-CARD"]},
    "DOC-CUSTOMER-CARD": {"REFERENCES": ["DOC-NEEDS-ANALYSIS"]},
    "DOC-INCENTIVE": {"REFERENCES": ["DOC-COMMISSION", "DOC-RATE-TABLE"]},
    "DOC-COMMISSION": {"REFERENCES": ["DOC-RATE-TABLE", "DOC-COMMISSION-CALC"]},
    "DOC-COMMISSION-CALC": {"REFERENCES": ["DOC-CHARGEBACK"]},
    "DOC-APPLICATION": {"REFERENCES": ["DOC-DISCLOSURE", "DOC-TERMS"]},
    "DOC-DISCLOSURE": {"REFERENCES": ["DOC-TERMS"]},
    "DOC-CONFIRMATION": {"REFERENCES": ["DOC-COMPARISON", "DOC-GUIDE"]},
    "DOC-UW-GUIDE": {"REFERENCES": ["DOC-UW-RULE", "DOC-UW-DISEASE", "DOC-UW-JOB", "DOC-EXCLUSION"]},
    "DOC-UW-DISEASE": {"CHILD_OF": ["DOC-UW-RULE"], "SIBLINGS": ["DOC-UW-JOB"]},
    "DOC-UW-JOB": {"CHILD_OF": ["DOC-UW-RULE"]},
    "DOC-EXCLUSION": {"REFERENCES": ["DOC-TERMS"]},
    "DOC-COMPLIANCE": {"REFERENCES": ["DOC-LAW-INSURANCE", "DOC-LAW-CONSUMER", "DOC-REGULATION"]},
    "DOC-COMPLIANCE-GUIDE": {"REFERENCES": ["DOC-COMPLIANCE", "DOC-LAW-CONSUMER"]},
    "DOC-TRAINING": {"REFERENCES": ["DOC-TERMS", "DOC-GUIDE", "DOC-SCRIPT"]},
    "DOC-ONBOARDING": {"REFERENCES": ["DOC-TRAINING", "DOC-COMPLIANCE", "DOC-SYSTEM-MANUAL"]},
    "DOC-SETTLEMENT": {"REFERENCES": ["DOC-COMMISSION", "DOC-CHARGEBACK"]},
    "DOC-PERFORMANCE": {"REFERENCES": ["DOC-SETTLEMENT", "DOC-COMMISSION"]},
    "DOC-CHARGEBACK": {"REFERENCES": ["DOC-COMMISSION-CALC"]},
    "DOC-BEST-PRACTICE": {"REFERENCES": ["DOC-GUIDE", "DOC-SCRIPT", "DOC-UW-GUIDE"]},
    "DOC-EXPERT-TIP": {"SIBLINGS": ["DOC-BEST-PRACTICE", "DOC-CASE-STUDY"]},
    "DOC-CASE-STUDY": {"REFERENCES": ["DOC-BEST-PRACTICE"]},
    "DOC-FAQ": {"REFERENCES": ["DOC-GUIDE", "DOC-UW-GUIDE"]},
    "DOC-NOTICE": {"REFERENCES": ["DOC-COMMISSION", "DOC-INCENTIVE"]},
    "DOC-PROCESS": {"REFERENCES": ["DOC-SYSTEM-MANUAL"]},
}


# ── 티어 설정 ──

DATA_TIERS = {
    "HOT": {
        "name": "Hot",
        "refresh_cycle": "daily",
        "cache_ttl_minutes": 60,
        "search_priority": 1,
        "max_age_days": 30,
        "doc_types": [
            "DOC-RATE-TABLE", "DOC-INCENTIVE", "DOC-COMMISSION", "DOC-COMMISSION-CALC",
            "DOC-INTERNAL-MEMO", "DOC-NOTICE", "DOC-SETTLEMENT", "DOC-PERFORMANCE", "DOC-PROPOSAL"
        ]
    },
    "WARM": {
        "name": "Warm",
        "refresh_cycle": "weekly",
        "cache_ttl_minutes": 1440,
        "search_priority": 2,
        "max_age_days": 90,
        "doc_types": [
            "DOC-GUIDE", "DOC-SCRIPT", "DOC-COMPARISON", "DOC-BROCHURE", "DOC-PRODUCT-SUMMARY",
            "DOC-UW-GUIDE", "DOC-COMPLIANCE-GUIDE", "DOC-PROCESS", "DOC-CUSTOMER-CARD",
            "DOC-NEEDS-ANALYSIS", "DOC-CHARGEBACK", "DOC-BEST-PRACTICE", "DOC-EXPERT-TIP",
            "DOC-CASE-STUDY", "DOC-FAQ"
        ]
    },
    "COLD": {
        "name": "Cold",
        "refresh_cycle": "quarterly",
        "cache_ttl_minutes": 10080,
        "search_priority": 3,
        "max_age_days": 365,
        "doc_types": [
            "DOC-TERMS", "DOC-TERMS-SPECIAL", "DOC-UW-RULE", "DOC-UW-DISEASE", "DOC-UW-JOB",
            "DOC-EXCLUSION", "DOC-LAW-INSURANCE", "DOC-LAW-CONSUMER", "DOC-REGULATION",
            "DOC-TRAINING", "DOC-ONBOARDING", "DOC-COMPLIANCE", "DOC-CERTIFICATION",
            "DOC-SYSTEM-MANUAL", "DOC-APPLICATION", "DOC-DISCLOSURE", "DOC-CONFIRMATION"
        ]
    },
}


# ═══════════════════════════════════════════════════════════════════════════════
# 통계 / 내보내기
# ═══════════════════════════════════════════════════════════════════════════════

def get_taxonomy_stats():
    return {
        "version": "3.0",
        "framework": {
            "lifecycle_states": len(SYSTEM_CONFIG["lifecycle_states"]),
            "relationship_types": len(SYSTEM_CONFIG["relationship_types"]),
        },
        "businesses": len(BUSINESSES),
        "domains": len(DOMAINS),
        "carriers": {
            "total": len([c for c in CARRIERS if c != "INS-COMMON"]),
            "life": len([c for c, v in CARRIERS.items() if v.get("type") == "life"]),
            "non_life": len([c for c, v in CARRIERS.items() if v.get("type") == "non-life"]),
        },
        "products": {
            "total": len([p for p in PRODUCTS if p != "PRD-COMMON"]),
            "by_category": {cat: len([p for p, v in PRODUCTS.items() if v.get("category") == cat])
                          for cat in PRODUCT_CATEGORIES if cat != "COMMON"}
        },
        "doc_types": {
            "total": len(DOC_TYPES),
            "hot": len(DATA_TIERS["HOT"]["doc_types"]),
            "warm": len(DATA_TIERS["WARM"]["doc_types"]),
            "cold": len(DATA_TIERS["COLD"]["doc_types"]),
        },
        "processes": len([p for p in PROCESSES if p != "BIZ-COMMON"]),
        "audiences": len([a for a in AUDIENCES if a != "AUD-ALL"]),
        "certifications": len(CERTIFICATIONS),
        "ga_types": len(GA_TYPES),
        "regulations": len(REGULATION_TIMELINE),
    }


def export_to_json(filepath: str = "data/taxonomy.json"):
    """JSON으로 내보내기 (시스템 + 도메인 통합)"""
    data = {
        "version": "3.0",
        "generated_at": datetime.now().isoformat(),
        # 시스템 프레임워크
        "system": SYSTEM_CONFIG,
        "businesses": BUSINESSES,
        "domains": DOMAINS,
        "doc_type_domain_map": DOC_TYPE_DOMAIN_MAP,
        # GA 도메인 데이터
        "carriers": CARRIERS,
        "products": PRODUCTS,
        "product_categories": PRODUCT_CATEGORIES,
        "doc_types": DOC_TYPES,
        "processes": PROCESSES,
        "audiences": AUDIENCES,
        "certifications": CERTIFICATIONS,
        "ga_types": GA_TYPES,
        "regulation_timeline": REGULATION_TIMELINE,
        "commission_types": COMMISSION_TYPES,
        "chargeback_rules": CHARGEBACK_RULES,
        "kpi_metrics": KPI_METRICS,
        "default_relations": DEFAULT_RELATIONS,
        "data_tiers": DATA_TIERS,
    }
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    return filepath


if __name__ == "__main__":
    stats = get_taxonomy_stats()
    print("=" * 60)
    print("KMS Framework v3.0 Statistics")
    print("=" * 60)
    print(json.dumps(stats, indent=2, ensure_ascii=False))

    filepath = export_to_json()
    print(f"\n✓ Exported to {filepath}")
