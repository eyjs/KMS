# 문서관리 프레임워크 아키텍처

> **Version** 3.0 | 2026-02-08
> **문서 유형**: 아키텍처 설계서 (Architecture Specification)
> **Phase 1 산출물**: 도메인 무관한 문서관리 프레임워크 구조 및 구현 명세

---

## 목차

1. [설계 원칙](#1-설계-원칙)
2. [문서 관계 구조](#2-문서-관계-구조)
3. [시스템 규칙](#3-시스템-규칙)
4. [강제 vs 유도 메커니즘](#4-강제-vs-유도-메커니즘)
5. [구현 메커니즘 (How)](#5-구현-메커니즘-how)
6. [사용자 시나리오](#6-사용자-시나리오)
7. [문서 데이터 모델](#7-문서-데이터-모델)
8. [확장성](#8-확장성)
9. [참고](#9-참고)

---

## 1. 설계 원칙

### 1.1 핵심 가치

**"복잡한 건 시스템이, 사용자는 문서 작성과 연결만"**

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   "SSOT? 버전관리? 신선도? 라이프사이클?                       │
│    그런 복잡한 건 시스템이 알아서 할게.                        │
│                                                             │
│    너는 그냥:                                                │
│    1. 문서 작성해                                            │
│    2. 관련 문서 연결해 (GUI로 쉽게)                           │
│                                                             │
│    삭제할 때도 걱정마.                                        │
│    연결된 문서들 어떻게 할지 물어보고,                         │
│    네가 정리하면 그때 삭제해줄게."                             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 시스템 vs 사용자 역할

| 시스템이 담당 | 사용자가 하는 것 |
|-------------|----------------|
| SSOT 관리 (중복 방지) | 문서 작성 |
| 버전 자동 관리 | 문서 연결 (GUI 클릭) |
| 신선도 자동 계산 | 분류 선택 (드롭다운) |
| 라이프사이클 전이 | 승인/반려 결정 |
| 삭제 시 영향 분석 | 정리 후 삭제 확인 |
| 관계 무결성 유지 | - |

### 1.3 프레임워크 구조

```
┌─────────────────────────────────────────────────────────────┐
│                    프레임워크의 역할                          │
├─────────────────────────────────────────────────────────────┤
│  1. 구조 설계    →  "이렇게 분류해야 한다" (스키마)            │
│  2. 시스템 강제  →  "이것 없이는 저장 불가" (Validation)       │
│  3. 시스템 유도  →  "이렇게 하면 편하다" (Auto-suggest)        │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. 문서 관계 구조

### 2.1 세 가지 관계: 상하 / 좌우 / 참조

```
                              ┌─────────────────┐
                              │   보통약관       │ ◄── 부모 (Parent)
                              │   (원본)        │
                              └────────┬────────┘
                                       │
                      ┌────────────────┼────────────────┐
            상하      │                │                │      상하
          (PARENT_OF) │                │                │  (PARENT_OF)
                      ▼                ▼                ▼
               ┌───────────┐    ┌───────────┐    ┌───────────┐
               │ 특별약관   │◄──►│ 특별약관   │◄──►│ 특별약관   │
               │ (암)      │    │ (심장)    │    │ (뇌)      │
               └───────────┘    └───────────┘    └───────────┘
                     ▲                                  ▲
                     │         좌우 (SIBLING)           │
                     └──────────────────────────────────┘
                                자식들은 서로 형제


                              ┌─────────────────┐
                              │   판매스크립트   │
                              └────────┬────────┘
                                       │
                                       │ 참조 (REFERENCE)
                                       │ (전혀 다른 문서와 연결)
                                       ▼
               ┌───────────┐    ┌───────────┐    ┌───────────┐
               │ 상품설명서 │    │  시책     │    │ 교육자료   │
               └───────────┘    └───────────┘    └───────────┘
```

### 2.2 관계 유형 상세

| 관계 | 방향 | 의미 | 예시 |
|------|------|------|------|
| **상하 (부모↔자식)** | 수직 | 원본과 파생 문서 | 보통약관 → 특별약관 |
| **좌우 (형제)** | 수평 | 같은 레벨의 관련 문서 | 시책 ↔ 수수료 ↔ 보험료표 |
| **참조** | 단방향 | 전혀 다른 문서 인용 | 스크립트 → 상품설명서 |

### 2.3 관계별 특징

```
[상하 관계 - PARENT_OF / CHILD_OF]
• 양방향 자동 동기화 (부모 설정하면 자식도 자동)
• 부모 삭제 시 자식 처리 필요
• 같은 도메인 내에서만 가능

[좌우 관계 - SIBLING]
• 양방향 자동 동기화
• 하나 삭제해도 나머지 영향 없음
• 같은 도메인 내에서만 가능

[참조 관계 - REFERENCE]
• 단방향 (A→B 설정해도 B→A 자동 안됨)
• 참조 대상 삭제 시 끊어진 링크 경고
• 다른 도메인 문서도 참조 가능 ★
```

---

## 3. 시스템 규칙

### 3.1 SSOT (Single Source of Truth)

**"같은 분류 경로에 ACTIVE 문서는 하나만"**

```
[유효]
GA-SALES: KB손해보험 > 든든어린이 > 상품요약본 (ACTIVE)
GA-SALES: KB손해보험 > 든든어린이 > 판매스크립트 (ACTIVE)  ← 다른 문서유형

[SSOT 위반 → 자동 처리]
GA-SALES: KB손해보험 > 든든어린이 > 상품요약본 (ACTIVE)  ← 기존
GA-SALES: KB손해보험 > 든든어린이 > 상품요약본 (ACTIVE)  ← 신규 등록 시
                                                      ↓
                                              기존 문서 자동 DEPRECATED
```

### 3.2 라이프사이클 상태 머신

```
DRAFT ──► REVIEW ──► ACTIVE ──► STALE ──► DEPRECATED ──► ARCHIVED
            │                     ▲
            └── REJECTED          │
                            (신선도 만료 시 자동)
```

| 상태 | 설명 | 검색 가능 |
|------|------|----------|
| DRAFT | 임시 저장 | X |
| REVIEW | 검토 중 | X |
| ACTIVE | 현재 유효 | O |
| STALE | 신선도 만료 | O (경고) |
| DEPRECATED | 폐기 예정 | O (경고) |
| ARCHIVED | 보관 | X |

### 3.3 신선도 (Freshness)

```
경과일 = 현재일 - max(수정일, 검토일)

FRESH:   경과일 < 기준일 × 0.7
WARNING: 경과일 < 기준일
EXPIRED: 경과일 ≥ 기준일 → 자동 STALE 전환
```

| 티어 | 문서 특성 | 기준일 |
|------|----------|--------|
| HOT | 자주 변경 (시책, 수수료) | 30일 |
| WARM | 가끔 변경 (설명서, 가이드) | 90일 |
| COLD | 거의 안변경 (약관, 규정) | 365일 |

### 3.4 버전 규칙

```
버전: Major.Minor

Major 증가 (v1.0 → v2.0):
  - 내용 변경 (수수료율, 조건 등)
  - 새 문서로 취급 → SUPERSEDES 관계 생성

Minor 증가 (v1.0 → v1.1):
  - 오타 수정, 서식 변경
  - 같은 문서 업데이트
```

---

## 4. 강제 vs 유도 메커니즘

### 4.1 시스템이 강제하는 것

| 규칙 | 강제 내용 | 위반 시 |
|------|----------|--------|
| **필수 속성** | id, domain, lifecycle, version 없으면 저장 불가 | 오류 반환 |
| **SSOT** | 동일 분류 경로에 ACTIVE 문서 2개 불가 | 기존 문서 자동 DEPRECATED |
| **라이프사이클** | 허용된 상태 전이만 가능 | 오류 반환 |
| **버전** | Major.Minor 형식 필수 | 오류 반환 |
| **관계 타입** | 정의된 관계만 사용 가능 | 오류 반환 |
| **분류 완전성** | 도메인의 필수 facet 모두 입력 | 저장 불가 |

### 4.2 시스템이 유도하는 것

| 기능 | 유도 내용 | 방식 |
|------|----------|------|
| **자동 분류** | 파일명에서 분류 추출 | 제안 (수정 가능) |
| **관계 추천** | 문서유형 기반 연관 문서 제안 | 제안 (선택 가능) |
| **신선도 경고** | 만료 임박 문서 알림 | 경고 (무시 가능) |
| **중복 감지** | 유사 문서 존재 시 알림 | 경고 (진행 가능) |
| **기본값** | tier, audience 등 자동 설정 | 자동 (변경 가능) |

---

## 5. 구현 메커니즘 (How)

### 5.1 자동 분류 - 구현 방식

**Phase 1: 규칙 기반 (정규식 + 사전 매칭)**

```python
# 파일명 파싱 알고리즘
def parse_filename(filename: str) -> dict:
    result = {}

    # 1. 보험사 매칭 (별칭 사전)
    CARRIER_ALIASES = {
        "삼성생명": ["삼성", "SS", "samsung"],
        "KB손해보험": ["KB손해", "KB", "케이비"],
        "현대해상": ["현대", "HM", "hyundai"],
    }
    for carrier, aliases in CARRIER_ALIASES.items():
        if any(alias in filename for alias in aliases):
            result["carrier"] = carrier
            break

    # 2. 문서유형 매칭 (키워드 사전)
    DOCTYPE_KEYWORDS = {
        "DOC-TERMS": ["약관", "보통약관", "terms"],
        "DOC-GUIDE": ["상품설명", "설명서", "guide"],
        "DOC-INCENTIVE": ["시책", "인센티브", "incentive"],
        "DOC-COMMISSION": ["수수료", "커미션", "commission"],
    }
    for docType, keywords in DOCTYPE_KEYWORDS.items():
        if any(kw in filename for kw in keywords):
            result["docType"] = docType
            break

    # 3. 날짜 추출 (정규식)
    import re
    date_match = re.search(r'(\d{4})[-_]?(\d{2})', filename)
    if date_match:
        result["version_date"] = f"{date_match.group(1)}-{date_match.group(2)}"

    return result
```

**Phase 3 확장: LLM 기반 (의미 이해)**

```python
# Phase 3에서 추가될 LLM 분류
def parse_with_llm(filename: str, content: str) -> dict:
    # 본문 내용까지 분석하여 분류 정확도 향상
    # 규칙 기반으로 실패한 경우 LLM 폴백
    pass
```

### 5.2 관계 추천 - 구현 방식

**Phase 1: 규칙 기반 (사전 정의 + 컨텍스트 매칭)**

```python
# 사전 정의된 관계 규칙
DEFAULT_RELATIONS = {
    "DOC-GUIDE": {
        "siblings": ["DOC-SCRIPT", "DOC-RATE-TABLE"],
        "references": ["DOC-TERMS"],
    },
    "DOC-INCENTIVE": {
        "siblings": ["DOC-COMMISSION", "DOC-RATE-TABLE"],
    },
    "DOC-TERMS": {
        "children": ["DOC-TERMS-SPECIAL"],
    },
}

def recommend_relations(doc: dict, all_docs: list) -> list:
    """문서 등록 시 연결 추천"""
    recommendations = []
    doc_type = doc["classification"]["docType"]

    # 1. 사전 정의 규칙에서 추천
    if doc_type in DEFAULT_RELATIONS:
        rules = DEFAULT_RELATIONS[doc_type]
        for relation_type, target_types in rules.items():
            for target_type in target_types:
                # 2. 같은 분류 컨텍스트 내에서 검색
                matches = find_docs_by_context(
                    all_docs,
                    carrier=doc["classification"].get("carrier"),
                    product=doc["classification"].get("product"),
                    docType=target_type,
                    lifecycle="ACTIVE"
                )
                for match in matches:
                    recommendations.append({
                        "target": match,
                        "relation": relation_type,
                        "reason": f"{doc_type}의 기본 {relation_type} 규칙"
                    })

    return recommendations

def find_docs_by_context(docs, carrier, product, docType, lifecycle):
    """분류 컨텍스트 기반 문서 검색"""
    return [
        d for d in docs
        if d["classification"].get("carrier") == carrier
        and d["classification"].get("product") == product
        and d["classification"].get("docType") == docType
        and d["lifecycle"] == lifecycle
    ]
```

**Phase 3 확장: LLM 기반 (의미 유사도)**

```python
# Phase 3에서 추가될 LLM 관계 추천
def recommend_with_llm(doc: dict, all_docs: list) -> list:
    # 벡터 임베딩 기반 유사 문서 검색
    # 다른 상품, 다른 도메인 간 유사 문서 발견
    # 규칙 기반으로 찾지 못한 관계 발견
    pass
```

### 5.3 삭제 영향 분석 - 구현 방식

**Phase 1: 관계 그래프 순회**

```python
def analyze_deletion_impact(doc_id: str, all_docs: list) -> dict:
    """삭제 시 영향받는 문서 분석"""
    doc = find_doc_by_id(doc_id, all_docs)
    impact = {
        "children": [],      # 자식 → 부모 없어짐
        "siblings": [],      # 형제 → 연결 해제
        "referencedBy": [],  # 참조자 → 끊어진 링크
        "supersededBy": [],  # 대체 문서 → 원본 없어짐
    }

    # 1. 자식 문서 (CHILD_OF this doc)
    for child_id in doc["relations"].get("children", []):
        child = find_doc_by_id(child_id, all_docs)
        impact["children"].append({
            "id": child_id,
            "name": child["name"],
            "severity": "HIGH",  # 부모 삭제는 심각
            "options": ["함께 삭제", "독립 문서로 변경", "다른 부모 연결"]
        })

    # 2. 형제 문서 (SIBLING)
    for sibling_id in doc["relations"].get("siblings", []):
        sibling = find_doc_by_id(sibling_id, all_docs)
        impact["siblings"].append({
            "id": sibling_id,
            "name": sibling["name"],
            "severity": "LOW",  # 형제 삭제는 경미
            "options": ["연결 해제"]  # 자동 처리
        })

    # 3. 이 문서를 참조하는 문서
    for ref_id in doc["relations"].get("referencedBy", []):
        ref_doc = find_doc_by_id(ref_id, all_docs)
        impact["referencedBy"].append({
            "id": ref_id,
            "name": ref_doc["name"],
            "severity": "MEDIUM",
            "options": ["연결 해제", "다른 문서로 변경"]
        })

    return impact

def execute_deletion(doc_id: str, impact_decisions: dict, all_docs: list):
    """사용자 결정에 따라 삭제 실행"""
    for child in impact_decisions.get("children", []):
        if child["action"] == "delete_together":
            delete_doc(child["id"], all_docs)
        elif child["action"] == "make_independent":
            update_doc(child["id"], {"relations": {"parent": None}})
        elif child["action"] == "reparent":
            update_doc(child["id"], {"relations": {"parent": child["new_parent"]}})

    # 형제/참조는 양방향 동기화로 자동 정리
    delete_doc(doc_id, all_docs)
```

### 5.4 SSOT 강제 - 구현 방식

```python
def enforce_ssot(new_doc: dict, all_docs: list) -> dict:
    """SSOT 위반 시 기존 문서 자동 DEPRECATED"""
    ssot_key = get_ssot_key(new_doc)  # domain + classification 조합

    # 같은 SSOT 키를 가진 ACTIVE 문서 검색
    existing = find_doc_by_ssot(all_docs, ssot_key, lifecycle="ACTIVE")

    if existing and new_doc["lifecycle"] == "ACTIVE":
        # 기존 문서 자동 DEPRECATED
        update_doc(existing["id"], {
            "lifecycle": "DEPRECATED",
            "relations": {"supersededBy": new_doc["id"]}
        })
        # 새 문서에 SUPERSEDES 관계 설정
        new_doc["relations"]["supersedes"] = existing["id"]

        return {
            "action": "auto_deprecated",
            "previous_doc": existing["id"],
            "message": f"기존 문서 '{existing['name']}'이 자동으로 DEPRECATED 처리됨"
        }

    return {"action": "none"}

def get_ssot_key(doc: dict) -> str:
    """도메인별 SSOT 키 생성"""
    domain = doc["domain"]
    classification = doc["classification"]

    # 도메인별 SSOT 키 정의에 따라 조합
    domain_config = DOMAINS[domain]
    key_parts = [domain]
    for facet in domain_config["ssotKey"]:
        key_parts.append(classification.get(facet, ""))

    return "|".join(key_parts)
```

### 5.5 신선도 자동 계산 - 구현 방식

```python
from datetime import datetime, timedelta

def calculate_freshness(doc: dict) -> dict:
    """문서 신선도 계산 및 상태 전이"""
    now = datetime.now()

    # 기준일: 수정일과 검토일 중 최근
    last_updated = max(
        datetime.fromisoformat(doc["updatedAt"]),
        datetime.fromisoformat(doc.get("reviewedAt", doc["updatedAt"]))
    )

    days_elapsed = (now - last_updated).days

    # 문서유형별 최대 허용일
    doc_type = doc["classification"]["docType"]
    max_age = DOC_TYPE_FRESHNESS[doc_type]["maxAgeDays"]

    # 신선도 계산
    if days_elapsed < max_age * 0.7:
        freshness = "FRESH"
    elif days_elapsed < max_age:
        freshness = "WARNING"
    else:
        freshness = "EXPIRED"
        # EXPIRED면 자동으로 STALE 전이
        if doc["lifecycle"] == "ACTIVE":
            doc["lifecycle"] = "STALE"

    return {
        "freshness": freshness,
        "daysElapsed": days_elapsed,
        "maxAge": max_age,
        "daysRemaining": max(0, max_age - days_elapsed)
    }

DOC_TYPE_FRESHNESS = {
    "DOC-INCENTIVE": {"tier": "HOT", "maxAgeDays": 14},
    "DOC-COMMISSION": {"tier": "HOT", "maxAgeDays": 30},
    "DOC-GUIDE": {"tier": "WARM", "maxAgeDays": 90},
    "DOC-TERMS": {"tier": "COLD", "maxAgeDays": 365},
}
```

### 5.6 Phase별 기능 범위

| 기능 | Phase 1 (규칙 기반) | Phase 3 (LLM 추가) |
|------|-------------------|------------------|
| **자동 분류** | 정규식 + 키워드 사전 | 본문 의미 분석 |
| **관계 추천** | DEFAULT_RELATIONS + 컨텍스트 | 벡터 유사도 + 크로스 도메인 |
| **삭제 영향** | 관계 그래프 순회 | 동일 |
| **SSOT 강제** | 분류 키 비교 | 동일 |
| **신선도** | 날짜 계산 | 동일 |
| **중복 감지** | 분류 키 일치 | 본문 유사도 비교 |

---

## 6. 사용자 시나리오

### 6.1 문서 등록

```
사용자: 파일 업로드 "KB손해_든든어린이_상품요약_202602.pdf"
                │
                ▼
┌─────────────────────────────────────────────────────────────┐
│ [시스템] 자동 분류 제안                                        │
│   보험사: KB손해보험 ✓                                        │
│   상품: 든든 어린이보험 ✓                                     │
│   문서유형: 상품요약본 ✓                                      │
│   → 틀리면 드롭다운에서 수정                                   │
└─────────────────────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────┐
│ [시스템] SSOT 자동 처리                                       │
│   "같은 문서가 이미 있네? 기존 건 자동으로 '대체됨' 처리할게"     │
└─────────────────────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────┐
│ [시스템] 관계 추천                                            │
│   "이 상품의 약관/시책이 있어. 연결할래?"                       │
│   [연결하기] [나중에]                                         │
└─────────────────────────────────────────────────────────────┘
                │
                ▼
              저장 완료 ✓
```

### 6.2 문서 삭제 (안전한 삭제)

```
사용자: "이 문서 삭제할래"
                │
                ▼
┌─────────────────────────────────────────────────────────────┐
│ [시스템] 영향 분석                                            │
│                                                             │
│   "이 문서를 삭제하면 영향받는 문서들이 있어:"                   │
│                                                             │
│   📄 상품설명서                                              │
│      └─ 이 문서를 참조 중 (REFERENCE)                         │
│                                                             │
│   📄 판매스크립트                                             │
│      └─ 형제 문서로 연결됨 (SIBLING)                          │
│                                                             │
│   📄 특별약관 v1.0                                           │
│      └─ 자식 문서 (CHILD_OF)                                 │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────┐
│ [시스템] 정리 방법 선택                                        │
│                                                             │
│   각 연결을 어떻게 처리할까?                                   │
│                                                             │
│   📄 상품설명서의 참조                                        │
│      ○ 연결 해제                                             │
│      ○ 다른 문서로 연결 변경                                  │
│                                                             │
│   📄 특별약관 (자식)                                          │
│      ○ 함께 삭제                                             │
│      ○ 독립 문서로 변경                                       │
│      ○ 다른 부모에 연결                                       │
│                                                             │
│                    [정리 완료] [취소]                         │
└─────────────────────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────┐
│ [시스템] 최종 확인                                            │
│   "정리 완료! 이제 삭제해도 될까?"                             │
│                    [삭제] [취소]                              │
└─────────────────────────────────────────────────────────────┘
                │
                ▼
              삭제 완료 ✓
```

### 6.3 문서 연결

```
사용자: 문서 A 선택 후 "연결 추가"
                │
                ▼
┌─────────────────────────────────────────────────────────────┐
│ [시스템] 관계 유형 선택                                        │
│                                                             │
│   어떤 관계로 연결할래?                                        │
│                                                             │
│   ○ 상하 관계 (부모-자식)                                     │
│     └─ 이 문서가 [부모 / 자식] 이다                           │
│                                                             │
│   ○ 좌우 관계 (형제)                                         │
│     └─ 같은 레벨의 관련 문서                                  │
│                                                             │
│   ○ 참조                                                    │
│     └─ 이 문서가 저 문서를 인용함                             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────┐
│ [시스템] 연결 대상 선택                                        │
│                                                             │
│   검색: [________________] 🔍                                │
│                                                             │
│   📄 삼성생명 종신보험 약관                                    │
│   📄 삼성생명 종신보험 시책                                    │
│   📄 삼성생명 종신보험 수수료                                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                │
                ▼
              연결 완료 ✓ (양방향 자동 동기화)
```

---

## 7. 문서 데이터 모델

### 7.1 필수 시스템 속성

```javascript
{
  // 식별 (시스템 생성)
  "id": "string (unique)",
  "domain": "string (도메인 코드)",

  // 라이프사이클 (시스템 관리)
  "lifecycle": "DRAFT | REVIEW | ACTIVE | STALE | DEPRECATED | ARCHIVED",
  "version": { "major": 1, "minor": 0 },

  // 시간 (시스템 자동)
  "createdAt": "datetime",
  "updatedAt": "datetime",
  "reviewedAt": "datetime",

  // 신선도 (시스템 계산)
  "tier": "HOT | WARM | COLD",
  "freshness": "FRESH | WARNING | EXPIRED",

  // 분류 (사용자 입력, 도메인별 정의)
  "classification": { ... },

  // 관계 (사용자 연결, 시스템 동기화)
  "relations": {
    "parent": "id | null",
    "children": ["id", ...],
    "siblings": ["id", ...],
    "references": ["id", ...],
    "referencedBy": ["id", ...],
    "supersedes": "id | null",
    "supersededBy": "id | null"
  }
}
```

---

## 8. 확장성

### 8.1 프레임워크 vs 도메인

```
┌─────────────────────────────────────────────────────────────┐
│              시스템 프레임워크 (불변)                          │
│  • 관계 구조 (상하/좌우/참조)                                 │
│  • SSOT, 라이프사이클, 신선도, 버전                           │
│  • 강제/유도 메커니즘                                        │
└───────────────────────────┬─────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│  GA 보험영업   │   │   메디코드     │   │   제조업 A사   │
│  (도메인)      │   │   (도메인)     │   │   (도메인)     │
│               │   │               │   │               │
│ carrier       │   │ hospital      │   │ supplier      │
│ product       │   │ service       │   │ part          │
│ docType       │   │ docType       │   │ docType       │
└───────────────┘   └───────────────┘   └───────────────┘
```

### 8.2 새 도메인 추가 시 정의할 것

| 항목 | 설명 | 예시 (GA) |
|------|------|----------|
| 도메인 코드 | 고유 식별자 | GA-SALES, GA-COMM |
| facet | 분류 축 | carrier, product, docType |
| 필수 facet | SSOT 키 | carrier × product × docType |
| 마스터 데이터 | 분류 값 목록 | 보험사 12개, 상품 50개 |
| 신선도 기준 | 문서유형별 기준일 | DOC-INCENTIVE: 14일 |

---

## 9. 참고

- `project-overview.md` - 프로젝트 기획서 (큰그림)
- `domain-template.md` - 새 도메인 추가 템플릿
- `ga-domain-example.md` - GA 도메인 구현 예시
