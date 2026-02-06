#!/usr/bin/env python3
"""
Phase 1: 황금 데이터셋 (Golden Set)

"이 질문에는 이 API 파라미터 조합이 정답이다"를 정의한다.
구조 검증기(StructureValidator)가 이 정답지대로 창고 API를 호출하고 검증한다.

축적 목적:
  - Phase 1: "이 구조로 Phase 2 API를 만들어도 되는가?" 사전 검증
  - Phase 3: 미들웨어 학습 데이터 (질문→파라미터 자동 변환)
"""


# ═══════════════════════════════════════════════════════════════════════════════
# 황금 데이터셋
# ═══════════════════════════════════════════════════════════════════════════════

GOLDEN_SET = [
    # ── 수수료/정산 도메인 ──
    {
        "id": "GS-001",
        "question": "삼성생명 종신보험 수수료가 어떻게 되나요?",
        "intent": "settlement",
        "steps": [
            {
                "action": "fetch_documents",
                "params": {
                    "carrier": "INS-SAMSUNG",
                    "product": "PRD-LIFE-WHOLE",
                    "doc_type": ["DOC-COMMISSION", "DOC-COMMISSION-CALC"],
                },
                "role": "anchor",
            },
            {
                "action": "fetch_neighbors",
                "params": {
                    "depth": 1,
                    "edge_types": ["SIBLINGS", "REFERENCES"],
                    "node_label": "Document",
                },
                "role": "context",
                "note": "anchor 문서의 형제/참조 문서 확장",
            },
        ],
        "expected_doc_types": [
            "DOC-COMMISSION", "DOC-COMMISSION-CALC",
            "DOC-INCENTIVE", "DOC-SETTLEMENT",
        ],
        "expected_count_min": 3,
    },

    {
        "id": "GS-002",
        "question": "정산 프로세스에서 쓰는 문서가 뭐가 있나요?",
        "intent": "settlement",
        "steps": [
            {
                "action": "fetch_process_documents",
                "params": {"process_id": "BIZ-SETTLE"},
                "role": "anchor",
            },
        ],
        "expected_doc_types": [
            "DOC-COMMISSION", "DOC-COMMISSION-CALC",
            "DOC-SETTLEMENT", "DOC-CHARGEBACK",
        ],
        "expected_count_min": 4,
    },

    # ── 심사(UW) 도메인 ──
    {
        "id": "GS-003",
        "question": "당뇨 환자 심사 가능한가요?",
        "intent": "underwriting",
        "steps": [
            {
                "action": "fetch_documents",
                "params": {
                    "doc_type": ["DOC-UW-GUIDE", "DOC-UW-DISEASE", "DOC-UW-RULE"],
                },
                "role": "anchor",
            },
        ],
        "expected_doc_types": [
            "DOC-UW-GUIDE", "DOC-UW-DISEASE", "DOC-UW-RULE",
        ],
        "expected_count_min": 3,
    },

    # ── 규제 도메인 ──
    {
        "id": "GS-004",
        "question": "1200%룰 GA 적용 언제부터인가요?",
        "intent": "regulatory",
        "steps": [
            {
                "action": "fetch_regulation_impact",
                "params": {"reg_id": "REG-20260701"},
                "role": "anchor",
            },
            {
                "action": "fetch_documents",
                "params": {
                    "doc_type": ["DOC-REGULATION", "DOC-COMMISSION-CALC"],
                },
                "role": "context",
            },
        ],
        "expected_regulation": {
            "governed_processes_min": 1,
            "restricted_docs_min": 1,
        },
        "expected_doc_types": ["DOC-REGULATION", "DOC-COMMISSION-CALC"],
        "expected_count_min": 1,
    },

    # ── 프로세스 도메인 ──
    {
        "id": "GS-005",
        "question": "보험 가입 절차가 어떻게 되나요?",
        "intent": "process",
        "steps": [
            {
                "action": "fetch_process_chain",
                "params": {"start_id": "BIZ-PROSPECT"},
                "role": "anchor",
            },
        ],
        "expected_chain": [
            "BIZ-PROSPECT", "BIZ-CONSULT", "BIZ-UW",
            "BIZ-ISSUE", "BIZ-HAPPYCALL", "BIZ-MAINTAIN", "BIZ-CLAIM",
        ],
    },

    # ── 상품 비교 도메인 ──
    {
        "id": "GS-006",
        "question": "어린이보험 상품 비교해주세요",
        "intent": "sales_support",
        "steps": [
            {
                "action": "fetch_documents",
                "params": {
                    "product": "PRD-CHILD",
                    "doc_type": ["DOC-COMPARISON", "DOC-GUIDE"],
                },
                "role": "anchor",
            },
        ],
        "expected_doc_types": ["DOC-COMPARISON", "DOC-GUIDE"],
        "expected_count_min": 2,
    },

    # ── 개념/용어 도메인 ──
    {
        "id": "GS-007",
        "question": "보험료 구조가 어떻게 되나요?",
        "intent": "training",
        "steps": [
            {
                "action": "fetch_concept",
                "params": {"concept_id": "CONCEPT-GROSS-PREMIUM"},
                "role": "anchor",
            },
        ],
        "expected_concept": {
            "narrower_min": 2,
            "explains_min": 1,
        },
    },

    # ── 교육/온보딩 도메인 ──
    {
        "id": "GS-008",
        "question": "신입 설계사 교육자료 어디있나요?",
        "intent": "training",
        "steps": [
            {
                "action": "fetch_documents",
                "params": {
                    "doc_type": ["DOC-TRAINING", "DOC-ONBOARDING"],
                },
                "role": "anchor",
            },
        ],
        "expected_doc_types": ["DOC-TRAINING", "DOC-ONBOARDING"],
        "expected_count_min": 2,
    },

    # ── 특정 보험사 문서 조회 ──
    {
        "id": "GS-009",
        "question": "한화생명 CI보험 상품설명서 보여줘",
        "intent": "sales_support",
        "steps": [
            {
                "action": "fetch_documents",
                "params": {
                    "carrier": "INS-HANWHA",
                    "product": "PRD-HEALTH-CI",
                    "doc_type": ["DOC-GUIDE"],
                },
                "role": "anchor",
            },
            {
                "action": "fetch_neighbors",
                "params": {
                    "depth": 1,
                    "edge_types": ["REFERENCES"],
                    "node_label": "Document",
                },
                "role": "context",
            },
        ],
        "expected_doc_types": ["DOC-GUIDE"],
        "expected_count_min": 1,
    },

    # ── 복합 질문 (수수료+규제) ──
    {
        "id": "GS-010",
        "question": "KB손해보험 자동차보험 수수료 규정이 어떻게 되나요?",
        "intent": "settlement",
        "steps": [
            {
                "action": "fetch_documents",
                "params": {
                    "carrier": "INS-KB",
                    "product": "PRD-NONLIFE-AUTO",
                    "doc_type": ["DOC-COMMISSION", "DOC-COMMISSION-CALC"],
                },
                "role": "anchor",
            },
            {
                "action": "fetch_neighbors",
                "params": {
                    "depth": 1,
                    "edge_types": ["GOVERNS", "RESTRICTS", "SIBLINGS"],
                    "node_label": "Document",
                },
                "role": "context",
                "note": "규제 관련 문서도 함께 확장",
            },
        ],
        "expected_doc_types": ["DOC-COMMISSION", "DOC-COMMISSION-CALC"],
        "expected_count_min": 1,
    },
]


def get_golden_set():
    """Golden Set 반환"""
    return GOLDEN_SET


def get_golden_set_stats():
    """Golden Set 통계"""
    intents = {}
    for gs in GOLDEN_SET:
        intent = gs.get("intent", "unknown")
        intents[intent] = intents.get(intent, 0) + 1

    return {
        "total": len(GOLDEN_SET),
        "by_intent": intents,
    }


if __name__ == "__main__":
    stats = get_golden_set_stats()
    print(f"Golden Set: {stats['total']}개 항목")
    print(f"의도별: {stats['by_intent']}")
