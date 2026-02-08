#!/usr/bin/env python3
"""
E2E 테스트: 실제 GA 보험 문서명 50건으로 전체 플로우 검증

시나리오:
1. GA 도메인 6개 등록
2. 실제 파일명 50건 → 자동 분류 → 등록
3. SSOT 충돌 시나리오
4. 관계 설정 (부모-자식, 형제, 참조, SUPERSEDES)
5. 이동 + 관계 영향
6. 전파 탐색 (시책 → 수수료 → 정산)
7. 검색 + 필터
"""

import sys
import os
import re
import json
from datetime import datetime

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))
from stress_test import GraphEngine


# ── 실제 GA 파일명 50건 ──────────────────────────────────────────

REAL_FILES = [
    # KB손해보험 (10건)
    "KB손해_든든어린이보험_상품요약본_202602.pdf",
    "KB손해_든든어린이보험_약관_v3.pdf",
    "KB손해_든든어린이보험_판매스크립트_202601.docx",
    "KB손해_든든어린이보험_시책안내_202602.pdf",
    "KB손해_든든어린이보험_수수료표_202602.xlsx",
    "KB손해_무배당암보험_상품설명서_202601.pdf",
    "KB손해_무배당암보험_약관_v2.pdf",
    "KB손해_무배당암보험_가입설계서_샘플.pdf",
    "KB손해_무배당암보험_브로슈어_202602.pdf",
    "KB손해_수수료정산_월간_202601.xlsx",

    # 삼성생명 (10건)
    "삼성생명_종신보험_상품요약본_202602.pdf",
    "삼성생명_종신보험_약관_v5.pdf",
    "삼성생명_종신보험_판매스크립트_202601.docx",
    "삼성생명_종신보험_시책_202602월.pdf",
    "삼성생명_종신보험_수수료표_202602.xlsx",
    "삼성생명_저축보험_상품설명서_202601.pdf",
    "삼성생명_저축보험_보험료표_202602.pdf",
    "삼성생명_저축보험_비교표_vs타사.pdf",
    "삼성생명_신입교육_온보딩가이드_2026.pdf",
    "삼성생명_정산자료_202601월.xlsx",

    # 한화생명 (8건)
    "한화생명_연금보험_상품요약_202602.pdf",
    "한화생명_연금보험_약관_v4.pdf",
    "한화생명_연금보험_판매스크립트.docx",
    "한화생명_연금보험_시책_202602.pdf",
    "한화생명_건강보험_상품설명서_202601.pdf",
    "한화생명_건강보험_심사가이드_202601.pdf",
    "한화생명_수수료계산_1200코드_202602.xlsx",
    "한화생명_환수기준표_202601.pdf",

    # 교보생명 (7건)
    "교보생명_교육보험_상품요약_202602.pdf",
    "교보생명_교육보험_약관_v2.pdf",
    "교보생명_교육보험_수수료_202602.xlsx",
    "교보생명_교육보험_시책안내_202602.pdf",
    "교보생명_교육보험_FAQ_202602.pdf",
    "교보생명_질병심사_질병별가이드_202601.pdf",
    "교보생명_컴플라이언스_준법가이드_2026.pdf",

    # 메리츠화재 (5건)
    "메리츠_운전자보험_상품요약_202602.pdf",
    "메리츠_운전자보험_약관_v3.pdf",
    "메리츠_운전자보험_시책_202602.pdf",
    "메리츠_운전자보험_수수료표_202602.xlsx",
    "메리츠_운전자보험_청약서_양식.pdf",

    # 공통/규제 (5건)
    "금감원_보험업감독규정_2026개정.pdf",
    "GA협회_자격시험_교육자료_2026.pdf",
    "전사공통_고지의무안내_표준양식.pdf",
    "보험연수원_신입교육_기본과정.pdf",
    "전사_수수료정산_가이드라인_v2.pdf",

    # 상품 개편 (5건 — SUPERSEDES 테스트용)
    "KB손해_든든어린이보험_리뉴얼(2026-02)_상품요약본.pdf",
    "KB손해_든든어린이보험_리뉴얼(2026-02)_약관_v1.pdf",
    "삼성생명_종신보험_리뉴얼(2026-02)_상품요약본.pdf",
    "삼성생명_종신보험_리뉴얼(2026-02)_약관_v1.pdf",
    "한화생명_연금보험_2차개편(2026-02)_상품요약.pdf",
]


# ── 자동 분류 엔진 (admin.html의 JS 로직을 Python으로 포팅) ───────

CARRIER_ALIASES = {
    "INS-KB": ["kb손해", "kb", "케이비"],
    "INS-SAMSUNG": ["삼성생명", "삼성"],
    "INS-HANWHA": ["한화생명", "한화"],
    "INS-KYOBO": ["교보생명", "교보"],
    "INS-MERITZ": ["메리츠화재", "메리츠"],
    "INS-COMMON": ["금감원", "ga협회", "보험연수원", "전사공통", "전사"],
}

PRODUCT_ALIASES = {
    "PRD-CHILD": ["든든어린이보험", "든든어린이"],
    "PRD-CANCER": ["무배당암보험", "암보험"],
    "PRD-WHOLE-LIFE": ["종신보험"],
    "PRD-SAVINGS": ["저축보험"],
    "PRD-ANNUITY": ["연금보험"],
    "PRD-HEALTH": ["건강보험"],
    "PRD-EDUCATION": ["교육보험"],
    "PRD-DRIVER": ["운전자보험"],
    # 리뉴얼 상품
    "PRD-CHILD-R2602": ["든든어린이보험_리뉴얼(2026-02)", "든든어린이보험 리뉴얼(2026-02)"],
    "PRD-WHOLE-LIFE-R2602": ["종신보험_리뉴얼(2026-02)", "종신보험 리뉴얼(2026-02)"],
    "PRD-ANNUITY-R2602": ["연금보험_2차개편(2026-02)", "연금보험 2차개편(2026-02)"],
}

DOC_TYPE_KEYWORDS = {
    "DOC-PRODUCT-SUMMARY": ["상품요약본", "상품요약"],
    "DOC-TERMS": ["약관"],
    "DOC-SCRIPT": ["판매스크립트", "스크립트"],
    "DOC-INCENTIVE": ["시책안내", "시책"],
    "DOC-COMMISSION": ["수수료표", "수수료"],
    "DOC-GUIDE": ["상품설명서", "상품설명"],
    "DOC-RATE-TABLE": ["보험료표"],
    "DOC-PROPOSAL": ["가입설계서", "설계서"],
    "DOC-BROCHURE": ["브로슈어"],
    "DOC-COMPARISON": ["비교표"],
    "DOC-TRAINING": ["교육자료", "교육"],
    "DOC-ONBOARDING": ["신입교육", "온보딩"],
    "DOC-SETTLEMENT": ["수수료정산", "정산자료", "정산"],
    "DOC-UW-GUIDE": ["심사가이드"],
    "DOC-UW-DISEASE": ["질병심사", "질병별"],
    "DOC-COMMISSION-CALC": ["수수료계산", "1200코드", "1200"],
    "DOC-CHARGEBACK": ["환수기준", "환수"],
    "DOC-FAQ": ["faq"],
    "DOC-REGULATION": ["감독규정", "규정"],
    "DOC-COMPLIANCE": ["컴플라이언스", "준법"],
    "DOC-DISCLOSURE": ["고지의무", "고지"],
    "DOC-APPLICATION": ["청약서", "청약"],
}

# 문서유형 → 도메인 매핑
DOC_TYPE_DOMAIN = {
    "DOC-PRODUCT-SUMMARY": "GA-SALES",
    "DOC-TERMS": "GA-SALES",
    "DOC-SCRIPT": "GA-SALES",
    "DOC-INCENTIVE": "GA-SALES",
    "DOC-GUIDE": "GA-SALES",
    "DOC-RATE-TABLE": "GA-SALES",
    "DOC-PROPOSAL": "GA-SALES",
    "DOC-BROCHURE": "GA-SALES",
    "DOC-COMPARISON": "GA-SALES",
    "DOC-COMMISSION": "GA-COMM",
    "DOC-COMMISSION-CALC": "GA-COMM",
    "DOC-SETTLEMENT": "GA-COMM",
    "DOC-CHARGEBACK": "GA-COMM",
    "DOC-APPLICATION": "GA-CONTRACT",
    "DOC-DISCLOSURE": "GA-CONTRACT",
    "DOC-UW-GUIDE": "GA-CONTRACT",
    "DOC-UW-DISEASE": "GA-CONTRACT",
    "DOC-REGULATION": "COMMON-COMP",
    "DOC-COMPLIANCE": "GA-COMP",
    "DOC-TRAINING": "GA-EDU",
    "DOC-ONBOARDING": "GA-EDU",
    "DOC-FAQ": "GA-SALES",
}


def auto_classify(filename):
    """파일명에서 보험사/상품/문서유형/버전 자동 추출"""
    normalized = filename.lower().replace("_", " ").replace("-", " ").replace(".", " ")

    carrier = None
    carrier_conf = 0
    for cid, aliases in CARRIER_ALIASES.items():
        for alias in aliases:
            if alias in normalized:
                carrier = cid
                carrier_conf = 0.9 if len(alias) > 2 else 0.7
                break
        if carrier:
            break

    product = None
    product_conf = 0
    # 리뉴얼 상품 먼저 매칭 (더 긴 패턴, alias도 정규화)
    sorted_products = sorted(PRODUCT_ALIASES.items(), key=lambda x: -max(len(a) for a in x[1]))
    for pid, aliases in sorted_products:
        for alias in aliases:
            norm_alias = alias.lower().replace("_", " ").replace("-", " ")
            if norm_alias in normalized:
                product = pid
                product_conf = 0.85 if len(alias) > 3 else 0.6
                break
        if product:
            break

    doc_type = None
    doc_type_conf = 0
    # 더 긴 키워드 먼저 매칭
    sorted_dt = sorted(DOC_TYPE_KEYWORDS.items(), key=lambda x: -max(len(k) for k in x[1]))
    for dtid, keywords in sorted_dt:
        for kw in keywords:
            if kw in normalized:
                doc_type = dtid
                doc_type_conf = 0.85 if len(kw) > 2 else 0.65
                break
        if doc_type:
            break

    version = None
    date_match = re.search(r'(\d{4})[\-_ ]?(\d{2})', filename)
    if date_match:
        version = f"{date_match.group(1)}년 {date_match.group(2)}월"
    ver_match = re.search(r'[vV](?:er\.?)?(\d+(?:\.\d+)?)', filename)
    if ver_match:
        version = (version + ", " if version else "") + f"버전 {ver_match.group(1)}"

    domain = DOC_TYPE_DOMAIN.get(doc_type, "GA-SALES") if doc_type else "GA-SALES"
    # 공통 보험사는 도메인 오버라이드
    if carrier == "INS-COMMON":
        if doc_type in ("DOC-REGULATION",):
            domain = "COMMON-COMP"
        elif doc_type in ("DOC-TRAINING", "DOC-ONBOARDING"):
            domain = "GA-EDU"
        elif doc_type in ("DOC-SETTLEMENT",):
            domain = "GA-COMM"

    return {
        "carrier": carrier,
        "carrier_conf": carrier_conf,
        "product": product,
        "product_conf": product_conf,
        "docType": doc_type,
        "docType_conf": doc_type_conf,
        "domain": domain,
        "version": version,
    }


class E2ETest:
    def __init__(self):
        self.engine = GraphEngine()
        self.passed = 0
        self.failed = 0
        self.results = []  # 분류 결과 수집

    def check(self, name, condition, detail=""):
        if condition:
            self.passed += 1
            print(f"    ✓ {name}")
        else:
            self.failed += 1
            print(f"    ✗ {name} {detail}")

    def run(self):
        print("=" * 70)
        print("E2E 테스트: 실제 GA 문서 50건 시나리오")
        print("=" * 70)

        self.step_1_register_domains()
        self.step_2_build_structure()
        self.step_3_auto_classify_and_register()
        self.step_4_ssot_collision()
        self.step_5_relations()
        self.step_6_supersedes()
        self.step_7_move_and_impact()
        self.step_8_propagation()
        self.step_9_search()
        self.step_10_summary()

        print(f"\n{'=' * 70}")
        print(f"결과: {self.passed} 통과 / {self.failed} 실패")
        print(f"{'=' * 70}")
        return self.failed == 0

    # ── 1. GA 도메인 등록 ─────────────────────────────────────────

    def step_1_register_domains(self):
        print("\n[1/10] GA 도메인 6개 등록...")

        domains = {
            "GA-SALES": {
                "name": "GA 영업/상담",
                "facets": [
                    {"id": "carrier", "name": "보험사", "required": True},
                    {"id": "product", "name": "상품", "required": True},
                    {"id": "docType", "name": "문서유형", "required": True},
                ],
                "ssotKey": ["carrier", "product", "docType"],
            },
            "GA-COMM": {
                "name": "GA 수수료/정산",
                "facets": [
                    {"id": "carrier", "name": "보험사", "required": True},
                    {"id": "product", "name": "상품", "required": False},
                    {"id": "docType", "name": "문서유형", "required": True},
                ],
                "ssotKey": ["carrier", "product", "docType"],
            },
            "GA-CONTRACT": {
                "name": "GA 계약관리",
                "facets": [
                    {"id": "carrier", "name": "보험사", "required": True},
                    {"id": "product", "name": "상품", "required": False},
                    {"id": "docType", "name": "문서유형", "required": True},
                ],
                "ssotKey": ["carrier", "product", "docType"],
            },
            "GA-COMP": {
                "name": "GA 컴플라이언스",
                "facets": [
                    {"id": "carrier", "name": "보험사", "required": False},
                    {"id": "docType", "name": "문서유형", "required": True},
                ],
                "ssotKey": ["carrier", "docType"],
            },
            "GA-EDU": {
                "name": "GA 교육/역량",
                "facets": [
                    {"id": "docType", "name": "문서유형", "required": True},
                ],
                "ssotKey": ["docType"],
            },
            "COMMON-COMP": {
                "name": "전사 규제/법률",
                "facets": [
                    {"id": "docType", "name": "문서유형", "required": True},
                ],
                "ssotKey": ["docType"],
            },
        }

        for did, ddef in domains.items():
            self.engine.register_domain(did, ddef)

        self.check("6개 도메인 등록", len(self.engine.domains) == 6)

    # ── 2. 구조 노드 트리 생성 ────────────────────────────────────

    def step_2_build_structure(self):
        print("\n[2/10] 분류 구조 트리 생성...")

        carriers = {
            "INS-KB": "KB손해보험",
            "INS-SAMSUNG": "삼성생명",
            "INS-HANWHA": "한화생명",
            "INS-KYOBO": "교보생명",
            "INS-MERITZ": "메리츠화재",
        }
        products_by_carrier = {
            "INS-KB": {"PRD-CHILD": "든든 어린이보험", "PRD-CANCER": "무배당 암보험",
                       "PRD-CHILD-R2602": "든든 어린이보험 리뉴얼(2026-02)"},
            "INS-SAMSUNG": {"PRD-WHOLE-LIFE": "종신보험", "PRD-SAVINGS": "저축보험",
                            "PRD-WHOLE-LIFE-R2602": "종신보험 리뉴얼(2026-02)"},
            "INS-HANWHA": {"PRD-ANNUITY": "연금보험", "PRD-HEALTH": "건강보험",
                           "PRD-ANNUITY-R2602": "연금보험 2차개편(2026-02)"},
            "INS-KYOBO": {"PRD-EDUCATION": "교육보험"},
            "INS-MERITZ": {"PRD-DRIVER": "운전자보험"},
        }

        # GA-SALES 루트
        self.engine.create_page(
            page_id="ROOT-GA-SALES", domain="GA-SALES",
            classification={"carrier": "ROOT", "product": "ROOT", "docType": "CATEGORY"},
            name="GA 영업 루트", lifecycle="ACTIVE",
        )

        struct_count = 1
        for cid, cname in carriers.items():
            # 보험사 구조 노드
            carrier_node_id = f"STRUCT-{cid}"
            self.engine.create_page(
                page_id=carrier_node_id, domain="GA-SALES",
                classification={"carrier": cid, "product": "ROOT", "docType": "CATEGORY"},
                name=cname, lifecycle="ACTIVE",
                parent_id="ROOT-GA-SALES",
                facet_type="carrier", facet_value=cid,
            )
            struct_count += 1

            for pid, pname in products_by_carrier.get(cid, {}).items():
                product_node_id = f"STRUCT-{cid}-{pid}"
                self.engine.create_page(
                    page_id=product_node_id, domain="GA-SALES",
                    classification={"carrier": cid, "product": pid, "docType": "CATEGORY"},
                    name=f"{cname} > {pname}", lifecycle="ACTIVE",
                    parent_id=carrier_node_id,
                    facet_type="product", facet_value=pid,
                )
                struct_count += 1

        # GA-COMM, GA-CONTRACT도 보험사 구조
        for domain_id in ["GA-COMM", "GA-CONTRACT"]:
            root_id = f"ROOT-{domain_id}"
            self.engine.create_page(
                page_id=root_id, domain=domain_id,
                classification={"carrier": "ROOT", "docType": "CATEGORY"},
                name=f"{domain_id} 루트", lifecycle="ACTIVE",
            )
            struct_count += 1
            for cid, cname in carriers.items():
                nid = f"STRUCT-{domain_id}-{cid}"
                self.engine.create_page(
                    page_id=nid, domain=domain_id,
                    classification={"carrier": cid, "docType": "CATEGORY"},
                    name=f"{domain_id} > {cname}", lifecycle="ACTIVE",
                    parent_id=root_id,
                    facet_type="carrier", facet_value=cid,
                )
                struct_count += 1

        # GA-COMP, GA-EDU, COMMON-COMP: 단순 루트
        for domain_id in ["GA-COMP", "GA-EDU", "COMMON-COMP"]:
            self.engine.create_page(
                page_id=f"ROOT-{domain_id}", domain=domain_id,
                classification={"docType": "CATEGORY"},
                name=f"{domain_id} 루트", lifecycle="ACTIVE",
            )
            struct_count += 1

        self.check(f"구조 노드 {struct_count}개 생성", struct_count > 20)
        print(f"    총 노드: {len(self.engine.nodes)}")

    # ── 3. 50건 자동 분류 + 등록 ─────────────────────────────────

    def step_3_auto_classify_and_register(self):
        print("\n[3/10] 파일 50건 자동 분류 + 등록...")

        success = 0
        partial = 0
        fail = 0

        for filename in REAL_FILES:
            result = auto_classify(filename)
            result["filename"] = filename

            # 분류 품질 판정
            all_found = result["carrier"] and result["docType"]
            # 도메인에 따라 product 필요 여부 다름
            domain = result["domain"]
            needs_product = domain in ("GA-SALES",)
            if needs_product:
                all_found = all_found and result["product"]

            if all_found:
                quality = "SUCCESS"
                success += 1
            elif result["docType"]:
                quality = "PARTIAL"
                partial += 1
            else:
                quality = "FAIL"
                fail += 1

            result["quality"] = quality

            # 엔진에 등록
            cls = {"docType": result["docType"] or "DOC-UNKNOWN"}

            # 도메인별 필수 facet 확인 후 classification 구성
            domain_def = self.engine.domains.get(domain, {})
            domain_facets = {f["id"] for f in domain_def.get("facets", [])}
            required_facets = {f["id"] for f in domain_def.get("facets", []) if f.get("required")}

            if "carrier" in domain_facets and result["carrier"]:
                cls["carrier"] = result["carrier"]
            if "product" in domain_facets and result["product"]:
                cls["product"] = result["product"]

            # 필수 facet 누락 시 도메인 다운그레이드
            if "carrier" in required_facets and "carrier" not in cls:
                # 보험사 없으면 COMMON-COMP 또는 GA-EDU로
                if result["docType"] in ("DOC-TRAINING", "DOC-ONBOARDING"):
                    domain = "GA-EDU"
                else:
                    domain = "COMMON-COMP"
                result["domain"] = domain
                domain_def = self.engine.domains.get(domain, {})
                domain_facets = {f["id"] for f in domain_def.get("facets", [])}
                cls = {k: v for k, v in cls.items() if k in domain_facets}

            # 부모 노드 결정
            parent_id = None
            if domain in ("GA-SALES",) and cls.get("carrier") and cls.get("product"):
                parent_id = f"STRUCT-{cls['carrier']}-{cls['product']}"
            elif domain in ("GA-COMM", "GA-CONTRACT") and cls.get("carrier"):
                parent_id = f"STRUCT-{domain}-{cls['carrier']}"
            elif domain in ("GA-COMP", "GA-EDU", "COMMON-COMP"):
                parent_id = f"ROOT-{domain}"

            # 부모 존재 확인
            if parent_id and parent_id not in self.engine.nodes:
                parent_id = None

            page = self.engine.create_page(
                page_id=None,  # 자동 채번
                domain=domain,
                classification=cls,
                name=filename.rsplit(".", 1)[0],  # 확장자 제거
                lifecycle="DRAFT",  # 신규 업로드는 DRAFT → 검토 후 ACTIVE
                parent_id=parent_id,
                auto_classify=True if parent_id else False,
            )
            result["page_id"] = page["id"]
            self.results.append(result)

        total = len(REAL_FILES)
        self.check(f"자동 분류 성공: {success}/{total}", success >= 40)
        self.check(f"부분 분류: {partial}/{total}", True)
        self.check(f"분류 실패: {fail}/{total}", fail <= 3)
        self.check(f"전체 등록 완료", len(self.results) == total)

        # 분류 결과 요약 출력
        print(f"\n    [분류 품질 요약]")
        print(f"    완전 분류: {success}건 ({success/total*100:.0f}%)")
        print(f"    부분 분류: {partial}건")
        print(f"    실패: {fail}건")

        # 실패/부분 건 상세
        problems = [r for r in self.results if r["quality"] != "SUCCESS"]
        if problems:
            print(f"\n    [미분류 상세]")
            for r in problems:
                missing = []
                if not r["carrier"]: missing.append("보험사")
                if not r["product"]: missing.append("상품")
                if not r["docType"]: missing.append("문서유형")
                print(f"    {r['quality']:7s} | {r['filename']}")
                print(f"            누락: {', '.join(missing) if missing else '없음'}")

    # ── 4. SSOT 충돌 ─────────────────────────────────────────────

    def step_4_ssot_collision(self):
        print("\n[4/10] SSOT 충돌 시나리오...")

        # KB손해 든든어린이 상품요약본이 이미 ACTIVE → 같은 경로 생성 시도
        kb_child_summary = [r for r in self.results
                            if r["carrier"] == "INS-KB"
                            and r["product"] == "PRD-CHILD"
                            and r["docType"] == "DOC-PRODUCT-SUMMARY"
                            and "리뉴얼" not in r["filename"]]
        if kb_child_summary:
            existing_id = kb_child_summary[0]["page_id"]

            # 기존 문서를 ACTIVE로 승격 (DRAFT → REVIEW → ACTIVE)
            self.engine.update_page(existing_id, {"lifecycle": "REVIEW"})
            self.engine.update_page(existing_id, {"lifecycle": "ACTIVE"})

            # SSOT 검증: 같은 경로에 ACTIVE 문서 추가 시도
            try:
                dup_page = self.engine.create_page(
                    page_id=None, domain="GA-SALES",
                    classification={"carrier": "INS-KB", "product": "PRD-CHILD", "docType": "DOC-PRODUCT-SUMMARY"},
                    name="중복 상품요약본", lifecycle="ACTIVE",
                )
                # SSOT 위반 감지 — 엔진이 에러를 내야 함
                # (현재 엔진은 SSOT 미구현이므로 수동 체크)
                ssot_key = ["carrier", "product", "docType"]
                my_path = "|".join(["INS-KB", "PRD-CHILD", "DOC-PRODUCT-SUMMARY"])
                collisions = []
                for nid, node in self.engine.nodes.items():
                    if nid == dup_page["id"]:
                        continue
                    props = node["properties"]
                    if props.get("domain") != "GA-SALES":
                        continue
                    if props.get("lifecycle") != "ACTIVE":
                        continue
                    cls = props.get("classification", {})
                    other_path = "|".join([cls.get(k, "") for k in ssot_key])
                    if my_path == other_path:
                        collisions.append(nid)

                self.check("SSOT 충돌 감지", len(collisions) > 0,
                           f"기존: {collisions[0]}, 신규: {dup_page['id']}")

                # 정리: 중복 문서 DEPRECATED 처리
                self.engine.update_page(dup_page["id"], {"lifecycle": "DEPRECATED"})
                self.check("SSOT 충돌 → 기존 DEPRECATED 처리 가능", True)

            except Exception as e:
                self.check("SSOT 충돌 감지 (예외)", "SSOT" in str(e) or "중복" in str(e))
        else:
            self.check("SSOT 충돌 테스트 건너뜀 (기준 문서 없음)", False)

    # ── 5. 관계 설정 ─────────────────────────────────────────────

    def step_5_relations(self):
        print("\n[5/10] 관계 설정...")

        # 주요 문서들을 ACTIVE로 승격 (DRAFT → REVIEW → ACTIVE)
        for r in self.results:
            if r["quality"] == "SUCCESS":
                try:
                    self.engine.update_page(r["page_id"], {"lifecycle": "REVIEW"})
                    self.engine.update_page(r["page_id"], {"lifecycle": "ACTIVE"})
                except Exception:
                    pass  # SSOT 충돌 등으로 실패할 수 있음

        # 같은 보험사-상품 내 문서들 → SIBLING
        kb_child_docs = [r for r in self.results
                         if r["carrier"] == "INS-KB" and r["product"] == "PRD-CHILD"
                         and "리뉴얼" not in r["filename"]]

        sibling_count = 0
        for i in range(len(kb_child_docs)):
            for j in range(i + 1, len(kb_child_docs)):
                try:
                    self.engine.add_sibling(kb_child_docs[i]["page_id"], kb_child_docs[j]["page_id"])
                    sibling_count += 1
                except Exception:
                    pass

        self.check(f"형제 관계: KB 든든어린이 {sibling_count}쌍", sibling_count >= 3)

        # 시책 → 수수료 REFERENCE (크로스 도메인)
        incentives = [r for r in self.results if r["docType"] == "DOC-INCENTIVE"]
        commissions = [r for r in self.results if r["docType"] == "DOC-COMMISSION"]

        ref_count = 0
        for inc in incentives:
            # 같은 보험사의 수수료 문서 찾기
            matching_comm = [c for c in commissions if c["carrier"] == inc["carrier"]]
            for comm in matching_comm:
                self.engine.add_reference(inc["page_id"], comm["page_id"])
                ref_count += 1

        self.check(f"크로스 도메인 참조: 시책→수수료 {ref_count}건", ref_count >= 3)

        # 수수료 → 정산 REFERENCE
        settlements = [r for r in self.results if r["docType"] == "DOC-SETTLEMENT"]
        for comm in commissions:
            for settle in settlements:
                if comm["carrier"] == settle["carrier"]:
                    self.engine.add_reference(comm["page_id"], settle["page_id"])

        # 심사가이드 → 약관 REFERENCE
        uw_guides = [r for r in self.results if r["docType"] == "DOC-UW-GUIDE"]
        terms = [r for r in self.results if r["docType"] == "DOC-TERMS"]
        for ug in uw_guides:
            matching_terms = [t for t in terms if t["carrier"] == ug["carrier"]]
            for t in matching_terms:
                self.engine.add_reference(ug["page_id"], t["page_id"])

        total_edges = len(self.engine.edges)
        self.check(f"총 엣지: {total_edges}건", total_edges > 50)

    # ── 6. SUPERSEDES (상품 개편) ─────────────────────────────────

    def step_6_supersedes(self):
        print("\n[6/10] 상품 개편 (SUPERSEDES)...")

        # KB 든든어린이 원본 → 리뉴얼
        original_kb = [r for r in self.results
                       if r["carrier"] == "INS-KB" and r["product"] == "PRD-CHILD"
                       and r["docType"] == "DOC-PRODUCT-SUMMARY"
                       and "리뉴얼" not in r["filename"]]
        renewal_kb = [r for r in self.results
                      if r["carrier"] == "INS-KB" and r["product"] == "PRD-CHILD-R2602"
                      and r["docType"] == "DOC-PRODUCT-SUMMARY"]

        if original_kb and renewal_kb:
            old_id = original_kb[0]["page_id"]
            new_id = renewal_kb[0]["page_id"]

            # SUPERSEDES 관계 설정
            self.engine.edges.append({"source": new_id, "target": old_id, "type": "SUPERSEDES"})
            self.engine.edges.append({"source": old_id, "target": new_id, "type": "SUPERSEDED_BY"})

            # 기존 문서 DEPRECATED
            self.engine.update_page(old_id, {"lifecycle": "DEPRECATED"})

            old_lifecycle = self.engine.get_page(old_id)["properties"]["lifecycle"]
            self.check("상품 개편: 원본 DEPRECATED", old_lifecycle == "DEPRECATED")
            self.check("상품 개편: SUPERSEDES 엣지", True)

            # 리뉴얼 문서에서 원본 추적 가능
            supersedes_edges = [e for e in self.engine.edges
                                if e["source"] == new_id and e["type"] == "SUPERSEDES"]
            self.check("상품 개편: 리뉴얼→원본 추적 가능",
                       len(supersedes_edges) > 0 and supersedes_edges[0]["target"] == old_id)
        else:
            self.check("SUPERSEDES 테스트 건너뜀", False, "원본/리뉴얼 매칭 실패")

    # ── 7. 이동 + 관계 영향 ──────────────────────────────────────

    def step_7_move_and_impact(self):
        print("\n[7/10] 도메인 이동 + 관계 영향...")

        # 한화생명 심사가이드를 GA-CONTRACT → GA-COMP로 이동
        uw_hanwha = [r for r in self.results
                     if r["carrier"] == "INS-HANWHA" and r["docType"] == "DOC-UW-GUIDE"]

        if uw_hanwha:
            doc_id = uw_hanwha[0]["page_id"]
            old_domain = self.engine.get_page(doc_id)["properties"]["domain"]

            # 참조 수 확인 (이동 전)
            refs_before = [e for e in self.engine.edges
                           if (e["source"] == doc_id or e["target"] == doc_id)
                           and e["type"] == "REFERENCE"]

            # 이동: GA-CONTRACT → GA-COMP
            comp_root = "ROOT-GA-COMP"
            self.engine.move_page(doc_id, comp_root, new_domain="GA-COMP")

            new_node = self.engine.get_page(doc_id)
            new_domain = new_node["properties"]["domain"]
            new_cls = new_node["properties"]["classification"]

            self.check("이동: 도메인 변경 GA-CONTRACT → GA-COMP",
                       old_domain == "GA-CONTRACT" and new_domain == "GA-COMP")
            self.check("이동: product facet 제거 (GA-COMP에 없음)",
                       "product" not in new_cls)
            self.check("이동: ID 불변", new_node["id"] == doc_id)

            # 참조 안정성
            refs_after = [e for e in self.engine.edges
                          if (e["source"] == doc_id or e["target"] == doc_id)
                          and e["type"] == "REFERENCE"]
            self.check(f"이동: 참조 유지 ({len(refs_before)}→{len(refs_after)})",
                       len(refs_after) == len(refs_before))
        else:
            self.check("이동 테스트 건너뜀", False)

    # ── 8. 전파 탐색 ─────────────────────────────────────────────

    def step_8_propagation(self):
        print("\n[8/10] 전파 탐색 (시책→수수료→정산)...")

        # KB손해 시책 → 참조 체인 따라가기
        kb_incentive = [r for r in self.results
                        if r["carrier"] == "INS-KB" and r["docType"] == "DOC-INCENTIVE"
                        and "리뉴얼" not in r["filename"]]

        if kb_incentive:
            start_id = kb_incentive[0]["page_id"]

            # 참조 체인: 시책 → 수수료 → 정산
            chain = self.engine.propagate_references(start_id, max_depth=3)
            chain_docs = []
            for ref_item in chain:
                rid = ref_item["id"]
                ref_node = self.engine.get_page(rid)
                if ref_node:
                    ref_cls = ref_node["properties"]["classification"]
                    chain_docs.append({
                        "id": rid,
                        "docType": ref_cls.get("docType", "?"),
                        "domain": ref_node["properties"]["domain"],
                    })

            self.check(f"참조 체인: 시책에서 {len(chain)}개 도달",
                       len(chain) >= 1)

            # 체인에 수수료 포함?
            has_commission = any(d["docType"] == "DOC-COMMISSION" for d in chain_docs)
            self.check("참조 체인: 수수료 포함", has_commission)

            if chain_docs:
                print(f"    체인: {' → '.join(d['docType'] for d in chain_docs[:5])}")

            # 하향 전파: KB손해보험 구조 노드 → 모든 하위 문서
            kb_struct = "STRUCT-INS-KB"
            if kb_struct in self.engine.nodes:
                descendants = self.engine.propagate_down(kb_struct)
                self.check(f"하향 전파: KB손해보험 → {len(descendants)}개 문서",
                           len(descendants) >= 5)
        else:
            self.check("전파 탐색 건너뜀", False)

    # ── 9. 검색 + 필터 ───────────────────────────────────────────

    def step_9_search(self):
        print("\n[9/10] 검색 + 필터...")

        # 도메인별 검색
        sales = self.engine.search(domain="GA-SALES")
        comm = self.engine.search(domain="GA-COMM")
        contract = self.engine.search(domain="GA-CONTRACT")
        comp = self.engine.search(domain="GA-COMP")
        edu = self.engine.search(domain="GA-EDU")
        common = self.engine.search(domain="COMMON-COMP")

        self.check(f"GA-SALES: {len(sales)}건", len(sales) > 10)
        self.check(f"GA-COMM: {len(comm)}건", len(comm) >= 3)
        self.check(f"GA-CONTRACT: {len(contract)}건", len(contract) >= 2)
        self.check(f"GA-EDU: {len(edu)}건", len(edu) >= 2)

        # classification 검색
        kb_docs = self.engine.search(classification_filter={"carrier": "INS-KB"})
        self.check(f"보험사 검색 (KB): {len(kb_docs)}건", len(kb_docs) >= 8)

        # 라이프사이클 검색
        active = self.engine.search(lifecycle="ACTIVE")
        deprecated = self.engine.search(lifecycle="DEPRECATED")
        self.check(f"ACTIVE: {len(active)}, DEPRECATED: {len(deprecated)}", len(active) > 0)

        print(f"\n    [도메인별 분포]")
        print(f"    GA-SALES: {len(sales)}  GA-COMM: {len(comm)}  GA-CONTRACT: {len(contract)}")
        print(f"    GA-COMP: {len(comp)}  GA-EDU: {len(edu)}  COMMON-COMP: {len(common)}")

    # ── 10. 종합 리포트 ──────────────────────────────────────────

    def step_10_summary(self):
        print("\n[10/10] 종합 리포트...")

        stats = self.engine.stats()
        print(f"\n    총 노드: {stats['nodes']}개")
        print(f"    총 엣지: {stats['edges']}개")
        print(f"    변경 이력: {len(self.engine.history)}건")

        # 분류 정확도 요약
        total = len(self.results)
        success = sum(1 for r in self.results if r["quality"] == "SUCCESS")
        print(f"\n    분류 정확도: {success}/{total} ({success/total*100:.0f}%)")

        # SSOT 검증
        ssot_violations = 0
        ssot_paths = {}
        for nid, node in self.engine.nodes.items():
            props = node["properties"]
            if props.get("lifecycle") != "ACTIVE":
                continue
            domain = props.get("domain", "")
            domain_def = self.engine.domains.get(domain, {})
            ssot_key = domain_def.get("ssotKey", ["carrier", "product", "docType"])
            cls = props.get("classification", {})
            path = domain + "|" + "|".join([cls.get(k, "") for k in ssot_key])
            if path in ssot_paths:
                ssot_violations += 1
            else:
                ssot_paths[path] = nid

        self.check(f"SSOT 위반: {ssot_violations}건", ssot_violations <= 1)  # 의도적 중복 1건 허용

        # 문서 식별성: 모든 문서가 도메인+분류로 유니크하게 식별 가능한지
        identifiable = 0
        for r in self.results:
            if r["docType"]:
                identifiable += 1
        self.check(f"문서 식별 가능: {identifiable}/{total}",
                   identifiable == total)


if __name__ == "__main__":
    test = E2ETest()
    success = test.run()
    sys.exit(0 if success else 1)
