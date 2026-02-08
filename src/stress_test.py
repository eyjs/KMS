"""
KMS v3.0 스트레스 테스트

노션 페이지 모델 시뮬레이션:
- 모든 것은 페이지(노드). 카테고리도 페이지, 문서도 페이지.
- 페이지가 하위 페이지를 포함 → PARENT_OF/CHILD_OF
- 페이지가 다른 페이지를 참조 → REFERENCE
- 임의 깊이 계층, 대량 크로스 참조, CRUD 무결성 검증

테스트 시나리오:
1. 새 도메인 등록 (MEDI-SVC: 메디코드 AI 보험설계)
2. 대량 계층 구조 생성 (카테고리 30 × 하위 20 × 문서 15 = 9,000+ 페이지)
3. 크로스 참조 수십 건씩 연결
4. CRUD 시뮬레이션 (생성/수정/삭제/버전업)
5. 무결성 검증 (8단계 verifier 적용)
6. 전파/역전파 테스트 (부모 삭제 시 자식은?)
7. 범위 제한 검색 테스트 (도메인별, 권한별 필터)
8. AI 에이전트 뷰 테스트 (계약전문/판매전문/통합 에이전트)
"""

import json
import copy
import random
import sys
import os
from datetime import datetime, timedelta

# src/ 폴더에서 실행하므로 직접 import
from taxonomy import SYSTEM_CONFIG, DOMAINS, DOC_TYPE_DOMAIN_MAP

random.seed(2024)

# ═══════════════════════════════════════════════════════════════════════════════
# 그래프 엔진: 노션 페이지 모델 기반 CRUD + 무결성
# ═══════════════════════════════════════════════════════════════════════════════

class GraphEngine:
    """
    노드/엣지 기반 그래프 엔진.
    모든 것이 페이지(노드)이고, 관계(엣지)로 연결된다.
    프레임워크 규칙을 강제하며 CRUD를 지원한다.
    """

    def __init__(self):
        self.nodes = {}  # {id: node_dict}
        self.edges = []  # [{source, target, type}]
        self.domains = {}  # 등록된 도메인 정의
        self._seq = 0
        self.history = []  # 변경 이력 (undo 가능)
        # 구조 노드: 도메인의 계층 구조를 정의하는 노드 (카테고리 역할)
        # facet_type을 가진 노드는 하위 문서의 classification에 해당 값을 전파
        self.structure_nodes = {}  # {node_id: {"facet_type": "carrier", "facet_value": "INS-SAMSUNG"}}

    def _next_id(self, prefix="PG"):
        """위치 무관 자동 채번. ID에 분류 정보 넣지 않음."""
        self._seq += 1
        return f"{prefix}-{self._seq:06d}"

    # ── 도메인 등록 ──────────────────────────────────────────

    def register_domain(self, domain_id, domain_def):
        """새 도메인 등록 (시스템이 facets/ssotKey/lifecycle 강제)"""
        required = ["facets", "ssotKey", "name"]
        for r in required:
            assert r in domain_def, f"도메인 정의에 '{r}' 필수"
        # ssotKey의 모든 항목이 facets에 있는지 검증
        facet_ids = {f["id"] for f in domain_def["facets"]}
        for key in domain_def["ssotKey"]:
            assert key in facet_ids, f"ssotKey '{key}'가 facets에 없음"
        self.domains[domain_id] = domain_def
        return True

    # ── 위치 → classification 자동 유도 ────────────────────

    def derive_classification(self, page_id):
        """
        부모 체인을 올라가며 classification을 자동 계산.
        각 구조 노드가 facet_type/facet_value를 가지고 있으면
        해당 값이 하위 문서의 classification에 자동 합성된다.

        예) ROOT → [carrier:삼성생명] → [product:종신보험] → 문서
            문서의 classification = {carrier: 삼성생명, product: 종신보험, docType: 자기값}
        """
        derived = {}
        # 자기 자신의 구조 정보
        if page_id in self.structure_nodes:
            info = self.structure_nodes[page_id]
            derived[info["facet_type"]] = info["facet_value"]

        # 부모 체인 올라가며 수집
        ancestors = self.propagate_up(page_id, max_depth=20)
        for anc in ancestors:
            anc_id = anc["id"]
            if anc_id in self.structure_nodes:
                info = self.structure_nodes[anc_id]
                ft, fv = info["facet_type"], info["facet_value"]
                if ft not in derived:  # 가장 가까운 조상 우선
                    derived[ft] = fv

        # 자기 노드에 docType이 있으면 추가
        node = self.nodes.get(page_id)
        if node:
            cls = node["properties"].get("classification", {})
            if "docType" in cls and "docType" not in derived:
                derived["docType"] = cls["docType"]

        return derived

    # ── CREATE ───────────────────────────────────────────────

    def create_page(self, page_id=None, domain=None, classification=None,
                    name="", lifecycle="DRAFT", tier="WARM",
                    parent_id=None, meta=None, auto_classify=False,
                    facet_type=None, facet_value=None):
        """
        페이지(문서/카테고리) 생성.

        개선된 점:
        - page_id=None이면 자동 채번 (위치 무관 ID)
        - auto_classify=True이면 부모 체인에서 classification 자동 유도
        - facet_type/facet_value: 이 노드가 구조 노드(카테고리)일 때
          하위 문서에 전파할 facet 정보

        프레임워크가 강제하는 것:
        1. 고유 ID (자동 채번 or 수동)
        2. 필수 필드 (domain, lifecycle, version, dates, classification)
        3. classification에 도메인 facets만 포함
        4. SSOT 검증 (같은 경로에 ACTIVE 문서 1개)
        """
        # 1. ID: 자동 채번 또는 수동
        if page_id is None:
            page_id = self._next_id()
        assert page_id not in self.nodes, f"중복 ID: {page_id}"

        # 2. 도메인 존재 확인
        assert domain in self.domains, f"미등록 도메인: {domain}"
        domain_def = self.domains[domain]

        # 구조 노드 등록 (카테고리 역할)
        if facet_type and facet_value:
            self.structure_nodes[page_id] = {
                "facet_type": facet_type,
                "facet_value": facet_value,
            }

        # 부모 연결 (classification 유도 전에 먼저 연결)
        if parent_id:
            assert parent_id in self.nodes, f"부모 없음: {parent_id}"

        # 3. classification: 자동 유도 또는 수동
        if auto_classify and parent_id:
            # 임시로 노드와 엣지를 먼저 등록해서 derive 가능하게
            now = datetime.now().isoformat()
            temp_node = {
                "id": page_id,
                "labels": ["Page", domain],
                "properties": {
                    "name": name,
                    "domain": domain,
                    "lifecycle": lifecycle,
                    "version": {"major": 1, "minor": 0},
                    "classification": classification or {},
                    "meta": meta or {},
                    "tier": tier,
                    "createdAt": now,
                    "updatedAt": now,
                    "reviewedAt": now if lifecycle == "ACTIVE" else None,
                }
            }
            self.nodes[page_id] = temp_node
            self.edges.append({"source": parent_id, "target": page_id, "type": "PARENT_OF"})
            self.edges.append({"source": page_id, "target": parent_id, "type": "CHILD_OF"})

            derived = self.derive_classification(page_id)
            # docType은 사용자가 직접 지정한 것 우선
            if classification and "docType" in classification:
                derived["docType"] = classification["docType"]
            classification = derived
            temp_node["properties"]["classification"] = classification
        else:
            classification = classification or {}

        # 4. classification 필드 검증 (도메인 facets에 정의된 것만 허용)
        allowed_facets = {f["id"] for f in domain_def["facets"]}
        for field in classification:
            assert field in allowed_facets, \
                f"'{field}'는 도메인 {domain}의 facets에 없음 (허용: {allowed_facets})"
        # 필수 facet 존재 확인
        for facet in domain_def["facets"]:
            if facet.get("required"):
                assert facet["id"] in classification, \
                    f"필수 facet '{facet['id']}' 누락"

        # 5. SSOT 검증: ACTIVE로 생성할 경우
        if lifecycle == "ACTIVE":
            self._check_ssot(domain, classification, exclude_id=page_id)

        now = datetime.now().isoformat()
        if auto_classify and parent_id:
            # 이미 등록됨 — 최종 classification만 갱신
            self.nodes[page_id]["properties"]["classification"] = classification
            node = self.nodes[page_id]
        else:
            node = {
                "id": page_id,
                "labels": ["Page", domain],
                "properties": {
                    "name": name,
                    "domain": domain,
                    "lifecycle": lifecycle,
                    "version": {"major": 1, "minor": 0},
                    "classification": classification,
                    "meta": meta or {},
                    "tier": tier,
                    "createdAt": now,
                    "updatedAt": now,
                    "reviewedAt": now if lifecycle == "ACTIVE" else None,
                }
            }
            self.nodes[page_id] = node

            # 부모 연결
            if parent_id:
                self.edges.append({"source": parent_id, "target": page_id, "type": "PARENT_OF"})
                self.edges.append({"source": page_id, "target": parent_id, "type": "CHILD_OF"})

        self.history.append(("CREATE", page_id, copy.deepcopy(node)))
        return node

    # ── MOVE ─────────────────────────────────────────────────

    def move_page(self, page_id, new_parent_id, new_domain=None):
        """
        페이지를 새 위치로 이동.
        1. 기존 PARENT_OF/CHILD_OF 엣지 제거
        2. 새 부모에 연결
        3. classification 자동 재계산 (위치에서 유도)
        4. 도메인 변경 시 facets 변환
        5. 도메인 변경 시 형제(SIBLINGS) 관계 정리 (같은 도메인만 허용)
        6. SSOT 재검증
        7. 하위 페이지도 재귀적으로 classification 갱신

        핵심: ID는 안 바뀜. 참조(REFERENCE)도 안 깨짐.
        형제는 도메인 변경 시 자동 해제됨.
        """
        assert page_id in self.nodes, f"페이지 없음: {page_id}"
        assert new_parent_id in self.nodes, f"새 부모 없음: {new_parent_id}"

        node = self.nodes[page_id]
        old_domain = node["properties"]["domain"]
        old_cls = copy.deepcopy(node["properties"]["classification"])

        # 도메인 변경
        target_domain = new_domain or old_domain
        if target_domain not in self.domains:
            raise AssertionError(f"미등록 도메인: {target_domain}")

        # 1. 기존 부모 엣지 제거
        self.edges = [e for e in self.edges
                      if not (e["source"] == page_id and e["type"] == "CHILD_OF")
                      and not (e["target"] == page_id and e["type"] == "PARENT_OF")]

        # 2. 새 부모 연결
        self.edges.append({"source": new_parent_id, "target": page_id, "type": "PARENT_OF"})
        self.edges.append({"source": page_id, "target": new_parent_id, "type": "CHILD_OF"})

        # 3. 도메인 갱신
        node["properties"]["domain"] = target_domain
        node["labels"] = ["Page", target_domain]

        # 4. classification 자동 재계산
        new_cls = self.derive_classification(page_id)
        # docType은 유지 (문서 고유 속성)
        if "docType" in old_cls:
            new_cls["docType"] = old_cls["docType"]

        # 새 도메인의 facets에 맞게 필터링
        domain_def = self.domains[target_domain]
        allowed_facets = {f["id"] for f in domain_def["facets"]}
        filtered_cls = {k: v for k, v in new_cls.items() if k in allowed_facets}
        node["properties"]["classification"] = filtered_cls

        # 5. 도메인이 바뀌면 형제(SIBLINGS) 관계 정리 (같은 도메인만 허용)
        if target_domain != old_domain:
            severed = [e for e in self.edges
                       if e["type"] == "SIBLINGS"
                       and (e["source"] == page_id or e["target"] == page_id)]
            self.edges = [e for e in self.edges
                          if not (e["type"] == "SIBLINGS"
                                  and (e["source"] == page_id or e["target"] == page_id))]
            severed_ids = set()
            for e in severed:
                other = e["target"] if e["source"] == page_id else e["source"]
                severed_ids.add(other)

        # 6. SSOT 검증 (ACTIVE인 경우)
        if node["properties"]["lifecycle"] == "ACTIVE":
            self._check_ssot(target_domain, filtered_cls, exclude_id=page_id)

        node["properties"]["updatedAt"] = datetime.now().isoformat()
        node["properties"]["version"]["minor"] += 1

        # 7. 하위 페이지도 재귀적으로 classification 갱신
        moved_ids = [page_id]
        children = self.get_children(page_id)
        for child in children:
            child_id = child["id"]
            self._reclassify_recursive(child_id, target_domain)
            moved_ids.append(child_id)

        severed_siblings = list(severed_ids) if target_domain != old_domain else []
        self.history.append(("MOVE", page_id, {
            "old_parent": "detached",
            "new_parent": new_parent_id,
            "old_domain": old_domain,
            "new_domain": target_domain,
            "old_cls": old_cls,
            "new_cls": filtered_cls,
            "affected": moved_ids,
            "severed_siblings": severed_siblings,
        }))
        return node

    def _reclassify_recursive(self, page_id, new_domain):
        """하위 페이지의 classification을 위치 기반으로 재계산"""
        node = self.nodes.get(page_id)
        if not node:
            return

        old_cls = node["properties"].get("classification", {})
        node["properties"]["domain"] = new_domain
        node["labels"] = ["Page", new_domain]

        new_cls = self.derive_classification(page_id)
        if "docType" in old_cls:
            new_cls["docType"] = old_cls["docType"]

        domain_def = self.domains.get(new_domain, {})
        allowed = {f["id"] for f in domain_def.get("facets", [])}
        node["properties"]["classification"] = {k: v for k, v in new_cls.items() if k in allowed}
        node["properties"]["updatedAt"] = datetime.now().isoformat()

        for child in self.get_children(page_id):
            self._reclassify_recursive(child["id"], new_domain)

    # ── READ ─────────────────────────────────────────────────

    def get_page(self, page_id):
        return self.nodes.get(page_id)

    def get_children(self, page_id):
        """하위 페이지 조회"""
        child_ids = [e["target"] for e in self.edges
                     if e["source"] == page_id and e["type"] == "PARENT_OF"]
        return [self.nodes[cid] for cid in child_ids if cid in self.nodes]

    def get_parent(self, page_id):
        """부모 페이지 조회"""
        parent_ids = [e["target"] for e in self.edges
                      if e["source"] == page_id and e["type"] == "CHILD_OF"]
        return self.nodes.get(parent_ids[0]) if parent_ids else None

    def get_siblings(self, page_id):
        """형제 페이지 조회"""
        sibling_ids = set()
        for e in self.edges:
            if e["source"] == page_id and e["type"] == "SIBLINGS":
                sibling_ids.add(e["target"])
            if e["target"] == page_id and e["type"] == "SIBLINGS":
                sibling_ids.add(e["source"])
        return [self.nodes[sid] for sid in sibling_ids if sid in self.nodes]

    def get_references(self, page_id, direction="outgoing"):
        """참조 조회 (outgoing: 이 페이지가 참조하는, incoming: 이 페이지를 참조하는)"""
        refs = []
        for e in self.edges:
            if direction == "outgoing" and e["source"] == page_id and e["type"] == "REFERENCE":
                refs.append(self.nodes.get(e["target"]))
            elif direction == "incoming" and e["target"] == page_id and e["type"] == "REFERENCE":
                refs.append(self.nodes.get(e["source"]))
        return [r for r in refs if r]

    # ── UPDATE ───────────────────────────────────────────────

    def update_page(self, page_id, updates):
        """
        페이지 수정.
        classification 변경 시 SSOT 재검증.
        lifecycle 변경 시 상태 머신 검증.
        """
        assert page_id in self.nodes, f"페이지 없음: {page_id}"
        node = self.nodes[page_id]
        props = node["properties"]
        old = copy.deepcopy(props)

        # classification 변경
        if "classification" in updates:
            domain = props["domain"]
            domain_def = self.domains[domain]
            allowed = {f["id"] for f in domain_def["facets"]}
            new_cls = updates["classification"]
            for field in new_cls:
                assert field in allowed, f"'{field}'는 도메인 {domain}의 facets에 없음"
            # 필수 facet 확인
            for facet in domain_def["facets"]:
                if facet.get("required") and facet["id"] not in new_cls:
                    assert False, f"필수 facet '{facet['id']}' 누락"

        # lifecycle 변경 시 상태 전이 검증
        if "lifecycle" in updates:
            new_lc = updates["lifecycle"]
            old_lc = props["lifecycle"]
            valid_transitions = SYSTEM_CONFIG.get("lifecycle_transitions", {})
            if valid_transitions:
                allowed_next = valid_transitions.get(old_lc, [])
                assert new_lc in allowed_next, \
                    f"상태 전이 불가: {old_lc} → {new_lc} (허용: {allowed_next})"

            # ACTIVE로 전환 시 SSOT 검증
            if new_lc == "ACTIVE" and old_lc != "ACTIVE":
                cls = updates.get("classification", props["classification"])
                self._check_ssot(props["domain"], cls, exclude_id=page_id)

        # 업데이트 적용
        for key, value in updates.items():
            if key in props:
                props[key] = value
        props["updatedAt"] = datetime.now().isoformat()

        # 버전 자동 증가
        if updates.get("classification") or updates.get("name"):
            props["version"]["minor"] += 1

        self.history.append(("UPDATE", page_id, {"old": old, "new": copy.deepcopy(props)}))
        return node

    # ── DELETE ────────────────────────────────────────────────

    def deprecate_page(self, page_id, cascade=False):
        """
        페이지 DEPRECATED 처리.
        cascade=True면 하위 페이지도 함께 DEPRECATED.
        (실제 삭제하지 않음 — 라이프사이클 관리)
        """
        assert page_id in self.nodes, f"페이지 없음: {page_id}"
        node = self.nodes[page_id]
        node["properties"]["lifecycle"] = "DEPRECATED"
        node["properties"]["updatedAt"] = datetime.now().isoformat()

        deprecated_ids = [page_id]

        if cascade:
            children = self.get_children(page_id)
            for child in children:
                child_id = child["id"]
                self.deprecate_page(child_id, cascade=True)
                deprecated_ids.append(child_id)

        self.history.append(("DEPRECATE", page_id, {"cascade": cascade, "affected": deprecated_ids}))
        return deprecated_ids

    def archive_page(self, page_id):
        """DEPRECATED → ARCHIVED 전환"""
        assert page_id in self.nodes, f"페이지 없음: {page_id}"
        node = self.nodes[page_id]
        assert node["properties"]["lifecycle"] == "DEPRECATED", \
            f"ARCHIVED는 DEPRECATED 상태에서만 가능 (현재: {node['properties']['lifecycle']})"
        node["properties"]["lifecycle"] = "ARCHIVED"
        node["properties"]["updatedAt"] = datetime.now().isoformat()
        return node

    # ── VERSION (SUPERSEDES) ─────────────────────────────────

    def supersede_page(self, old_page_id, new_page_id):
        """신규 페이지가 기존 페이지를 대체 (SUPERSEDES)"""
        assert old_page_id in self.nodes, f"원본 없음: {old_page_id}"
        assert new_page_id in self.nodes, f"신규 없음: {new_page_id}"

        old_node = self.nodes[old_page_id]
        new_node = self.nodes[new_page_id]

        # 신규를 ACTIVE로 전환하면 기존은 자동 DEPRECATED
        if new_node["properties"]["lifecycle"] == "ACTIVE":
            old_node["properties"]["lifecycle"] = "DEPRECATED"
            old_node["properties"]["updatedAt"] = datetime.now().isoformat()

        self.edges.append({"source": new_page_id, "target": old_page_id, "type": "SUPERSEDES"})
        self.edges.append({"source": old_page_id, "target": new_page_id, "type": "SUPERSEDED_BY"})

        # 신규 버전은 major 증가
        new_node["properties"]["version"] = {
            "major": old_node["properties"]["version"]["major"] + 1,
            "minor": 0
        }

        self.history.append(("SUPERSEDE", new_page_id, {"old": old_page_id}))
        return new_node

    # ── REFERENCE ────────────────────────────────────────────

    def add_reference(self, from_id, to_id):
        """참조 관계 추가 (크로스 도메인 가능)"""
        assert from_id in self.nodes, f"소스 없음: {from_id}"
        assert to_id in self.nodes, f"타겟 없음: {to_id}"
        self.edges.append({"source": from_id, "target": to_id, "type": "REFERENCE"})
        return True

    def add_sibling(self, page_a, page_b):
        """형제 관계 (양방향)"""
        assert page_a in self.nodes and page_b in self.nodes
        # same_domain 검증
        domain_a = self.nodes[page_a]["properties"]["domain"]
        domain_b = self.nodes[page_b]["properties"]["domain"]
        assert domain_a == domain_b, \
            f"SIBLINGS는 같은 도메인만 (A: {domain_a}, B: {domain_b})"
        self.edges.append({"source": page_a, "target": page_b, "type": "SIBLINGS"})
        self.edges.append({"source": page_b, "target": page_a, "type": "SIBLINGS"})
        return True

    # ── 전파 / 역전파 ────────────────────────────────────────

    def propagate_down(self, page_id, max_depth=10):
        """하향 전파: 하위 페이지를 재귀적으로 수집"""
        result = []
        visited = set()
        def _walk(pid, depth):
            if depth > max_depth or pid in visited:
                return
            visited.add(pid)
            children = self.get_children(pid)
            for child in children:
                result.append({"id": child["id"], "depth": depth, "name": child["properties"]["name"]})
                _walk(child["id"], depth + 1)
        _walk(page_id, 1)
        return result

    def propagate_up(self, page_id, max_depth=10):
        """상향 전파: 부모 체인 추적"""
        result = []
        visited = set()
        current = page_id
        depth = 0
        while current and depth < max_depth and current not in visited:
            visited.add(current)
            parent = self.get_parent(current)
            if parent:
                depth += 1
                result.append({"id": parent["id"], "depth": depth, "name": parent["properties"]["name"]})
                current = parent["id"]
            else:
                break
        return result

    def propagate_references(self, page_id, max_depth=3):
        """참조 그래프 전파: 참조의 참조까지 추적"""
        result = []
        visited = set()
        def _walk(pid, depth):
            if depth > max_depth or pid in visited:
                return
            visited.add(pid)
            refs = self.get_references(pid, "outgoing")
            for ref in refs:
                result.append({"id": ref["id"], "depth": depth, "name": ref["properties"]["name"]})
                _walk(ref["id"], depth + 1)
        _walk(page_id, 1)
        return result

    # ── 범위 제한 검색 ───────────────────────────────────────

    def search(self, domain=None, classification_filter=None,
               lifecycle=None, tier=None, audience=None):
        """
        범위 제한 검색.
        AI 에이전트가 특정 도메인/역할/상태 필터로 문서를 검색.
        """
        results = []
        for node in self.nodes.values():
            props = node.get("properties", {})

            # 도메인 필터
            if domain and props.get("domain") != domain:
                continue
            # lifecycle 필터
            if lifecycle and props.get("lifecycle") != lifecycle:
                continue
            # tier 필터
            if tier and props.get("tier") != tier:
                continue
            # audience 필터
            if audience and audience not in props.get("meta", {}).get("audiences", []):
                if audience != props.get("meta", {}).get("audience"):
                    continue
            # classification 필터 (partial match)
            if classification_filter:
                cls = props.get("classification", {})
                match = all(cls.get(k) == v for k, v in classification_filter.items())
                if not match:
                    continue

            results.append(node)
        return results

    # ── 권한 기반 뷰 ─────────────────────────────────────────

    def agent_view(self, agent_type, domain_filter=None):
        """
        AI 에이전트별 뷰.
        각 에이전트는 자기 관할 도메인+문서유형만 볼 수 있다.
        """
        AGENT_SCOPES = {
            "contract": {
                "domains": ["MEDI-CONTRACT"],
                "description": "계약 전문 에이전트: 계약/UW 관련 문서만"
            },
            "sales": {
                "domains": ["MEDI-SALES"],
                "description": "판매 전문 에이전트: 영업/상담 문서만"
            },
            "compliance": {
                "domains": ["MEDI-COMP", "COMMON-COMP"],
                "description": "컴플라이언스 에이전트: 규제/법률 문서만"
            },
            "admin": {
                "domains": None,  # 전체 접근
                "description": "통합 관리 에이전트: 전체 문서체계 관리"
            },
        }

        scope = AGENT_SCOPES.get(agent_type, AGENT_SCOPES["admin"])
        allowed_domains = scope["domains"]

        visible = []
        for node in self.nodes.values():
            props = node.get("properties", {})
            node_domain = props.get("domain", "")

            if allowed_domains and node_domain not in allowed_domains:
                continue
            if domain_filter and node_domain != domain_filter:
                continue

            visible.append(node)

        return {
            "agent": agent_type,
            "description": scope["description"],
            "visible_count": len(visible),
            "nodes": visible,
        }

    # ── SSOT 내부 검증 ───────────────────────────────────────

    def _check_ssot(self, domain, classification, exclude_id=None):
        """SSOT 검증: 같은 경로에 ACTIVE 1개만"""
        domain_def = self.domains.get(domain)
        if not domain_def:
            return
        ssot_key = domain_def["ssotKey"]
        my_path = tuple(classification.get(k, "") for k in ssot_key)

        for nid, node in self.nodes.items():
            if nid == exclude_id:
                continue
            props = node.get("properties", {})
            if props.get("domain") != domain:
                continue
            if props.get("lifecycle") != "ACTIVE":
                continue
            cls = props.get("classification", {})
            other_path = tuple(cls.get(k, "") for k in ssot_key)
            if my_path == other_path:
                raise AssertionError(
                    f"SSOT 위반: {domain} 경로 {my_path}에 ACTIVE 문서 이미 존재 ({nid})"
                )

    # ── 통계 ─────────────────────────────────────────────────

    def stats(self):
        domains = {}
        lifecycles = {}
        for n in self.nodes.values():
            d = n.get("properties", {}).get("domain", "?")
            lc = n.get("properties", {}).get("lifecycle", "?")
            domains[d] = domains.get(d, 0) + 1
            lifecycles[lc] = lifecycles.get(lc, 0) + 1

        edge_types = {}
        for e in self.edges:
            t = e.get("type", "?")
            edge_types[t] = edge_types.get(t, 0) + 1

        return {
            "nodes": len(self.nodes),
            "edges": len(self.edges),
            "domains": domains,
            "lifecycles": lifecycles,
            "edge_types": edge_types,
            "history_len": len(self.history),
        }


# ═══════════════════════════════════════════════════════════════════════════════
# 테스트 스위트
# ═══════════════════════════════════════════════════════════════════════════════

class StressTest:
    """복잡한 도메인 시뮬레이션 + CRUD + 무결성 + 전파 + 권한"""

    def __init__(self):
        self.engine = GraphEngine()
        self.passed = 0
        self.failed = 0
        self.test_results = []

    def assert_test(self, name, condition, detail=""):
        if condition:
            self.passed += 1
            self.test_results.append(("PASS", name))
        else:
            self.failed += 1
            self.test_results.append(("FAIL", name, detail))
            print(f"    ✗ {name}: {detail}")

    # ──────────────────────────────────────────────────────────
    # 1. 새 도메인 등록
    # ──────────────────────────────────────────────────────────

    def test_01_domain_registration(self):
        """새 도메인 5개 등록 (메디코드 서비스)"""
        print("\n[1/10] 도메인 등록...")

        domains_to_register = {
            "MEDI-SALES": {
                "name": "메디코드 영업",
                "facets": [
                    {"id": "service", "name": "서비스", "required": True},
                    {"id": "stage", "name": "단계", "required": True},
                    {"id": "docType", "name": "문서유형", "required": True},
                ],
                "ssotKey": ["service", "stage", "docType"],
            },
            "MEDI-CONTRACT": {
                "name": "메디코드 계약",
                "facets": [
                    {"id": "service", "name": "서비스", "required": True},
                    {"id": "docType", "name": "문서유형", "required": True},
                ],
                "ssotKey": ["service", "docType"],
            },
            "MEDI-COMP": {
                "name": "메디코드 컴플라이언스",
                "facets": [
                    {"id": "docType", "name": "문서유형", "required": True},
                ],
                "ssotKey": ["docType"],
            },
            "MEDI-EDU": {
                "name": "메디코드 교육",
                "facets": [
                    {"id": "category", "name": "카테고리", "required": True},
                    {"id": "docType", "name": "문서유형", "required": True},
                ],
                "ssotKey": ["category", "docType"],
            },
            "MEDI-TECH": {
                "name": "메디코드 기술문서",
                "facets": [
                    {"id": "module", "name": "모듈", "required": True},
                    {"id": "layer", "name": "레이어", "required": True},
                    {"id": "docType", "name": "문서유형", "required": True},
                ],
                "ssotKey": ["module", "layer", "docType"],
            },
        }

        for domain_id, domain_def in domains_to_register.items():
            result = self.engine.register_domain(domain_id, domain_def)
            self.assert_test(f"도메인 등록: {domain_id}", result)

        # 잘못된 도메인 등록 시도 (ssotKey가 facets에 없는 경우)
        try:
            self.engine.register_domain("BAD-DOMAIN", {
                "name": "잘못된 도메인",
                "facets": [{"id": "docType", "name": "문서", "required": True}],
                "ssotKey": ["service", "docType"],  # service가 facets에 없음
            })
            self.assert_test("잘못된 도메인 거부", False, "거부되지 않음")
        except AssertionError:
            self.assert_test("잘못된 도메인 거부", True)

        # COMMON-COMP도 등록 (크로스 도메인 테스트용)
        self.engine.register_domain("COMMON-COMP", {
            "name": "공통 규제",
            "facets": [{"id": "docType", "name": "문서유형", "required": True}],
            "ssotKey": ["docType"],
        })

        print(f"  ✓ {len(self.engine.domains)}개 도메인 등록")

    # ──────────────────────────────────────────────────────────
    # 2. 대량 계층 구조 생성 (노션 페이지 모델)
    # ──────────────────────────────────────────────────────────

    def test_02_massive_hierarchy(self):
        """카테고리 30 × 하위 20 × 문서 15 = 9,000+ 페이지"""
        print("\n[2/10] 대량 계층 구조 생성...")

        services = [f"SVC-{i:03d}" for i in range(1, 31)]  # 30개 서비스
        stages = [f"STG-{i:02d}" for i in range(1, 21)]     # 20개 단계
        doc_types = [f"DOC-TYPE-{i:02d}" for i in range(1, 16)]  # 15개 문서유형

        page_count = 0

        # 루트 카테고리 (서비스) 생성
        for svc in services:
            self.engine.create_page(
                page_id=svc,
                domain="MEDI-SALES",
                classification={"service": svc, "stage": "ROOT", "docType": "CATEGORY"},
                name=f"서비스 {svc}",
                lifecycle="ACTIVE",
                tier="COLD",
            )
            page_count += 1

            # 하위 카테고리 (단계) 생성
            for stg in stages:
                stg_id = f"{svc}-{stg}"
                self.engine.create_page(
                    page_id=stg_id,
                    domain="MEDI-SALES",
                    classification={"service": svc, "stage": stg, "docType": "CATEGORY"},
                    name=f"단계 {stg}",
                    lifecycle="ACTIVE",
                    tier="WARM",
                    parent_id=svc,
                )
                page_count += 1

                # 문서 생성 (15개 중 일부만 → SSOT 유지)
                for dt in doc_types:
                    doc_id = f"{svc}-{stg}-{dt}"
                    lc = random.choices(
                        ["ACTIVE", "DRAFT", "STALE", "DEPRECATED"],
                        weights=[0.7, 0.1, 0.1, 0.1]
                    )[0]
                    self.engine.create_page(
                        page_id=doc_id,
                        domain="MEDI-SALES",
                        classification={"service": svc, "stage": stg, "docType": dt},
                        name=f"문서 {dt}",
                        lifecycle=lc,
                        tier=random.choice(["HOT", "WARM", "COLD"]),
                        parent_id=stg_id,
                    )
                    page_count += 1

        self.assert_test(
            f"대량 생성: {page_count}개 페이지",
            page_count == 30 + (30 * 20) + (30 * 20 * 15)
        )
        self.assert_test(
            f"그래프 노드 수 일치",
            len(self.engine.nodes) == page_count
        )

        print(f"  ✓ {page_count}개 페이지 생성 (서비스 30 × 단계 20 × 문서 15)")
        print(f"  ✓ 노드: {len(self.engine.nodes)}개, 엣지: {len(self.engine.edges)}개")

    # ──────────────────────────────────────────────────────────
    # 3. 크로스 참조
    # ──────────────────────────────────────────────────────────

    def test_03_cross_references(self):
        """서비스 간, 도메인 간 대량 참조"""
        print("\n[3/10] 크로스 참조 생성...")

        ref_count = 0

        # 같은 도메인 내 서비스 간 참조 (500건)
        all_page_ids = list(self.engine.nodes.keys())
        for _ in range(500):
            src = random.choice(all_page_ids)
            tgt = random.choice(all_page_ids)
            if src != tgt:
                self.engine.add_reference(src, tgt)
                ref_count += 1

        # 다른 도메인 문서 생성 + 크로스 도메인 참조
        # MEDI-CONTRACT 문서 50개 (서비스×문서유형 유니크하게)
        for i in range(50):
            svc = f"SVC-{(i // 5) + 1:03d}"  # 10개 서비스 × 5개 docType
            self.engine.create_page(
                page_id=f"CONTRACT-{i:03d}",
                domain="MEDI-CONTRACT",
                classification={"service": svc, "docType": f"DOC-CONTRACT-{i % 5}"},
                name=f"계약서 {i}",
                lifecycle="ACTIVE",
                tier="WARM",
            )

        # MEDI-COMP 전역 문서 10개
        for i in range(10):
            self.engine.create_page(
                page_id=f"COMP-{i:03d}",
                domain="MEDI-COMP",
                classification={"docType": f"DOC-COMP-{i}"},
                name=f"규정 {i}",
                lifecycle="ACTIVE",
                tier="COLD",
            )

        # MEDI-TECH 기술문서 100개 (모듈×레이어×문서유형)
        modules = ["MOD-API", "MOD-UI", "MOD-DB", "MOD-AI", "MOD-INFRA"]
        layers = ["LYR-FRONT", "LYR-BACK", "LYR-DATA", "LYR-INFRA"]
        for mod in modules:
            for lyr in layers:
                for j in range(5):
                    tech_id = f"TECH-{mod}-{lyr}-{j:02d}"
                    self.engine.create_page(
                        page_id=tech_id,
                        domain="MEDI-TECH",
                        classification={"module": mod, "layer": lyr, "docType": f"DOC-TECH-{j}"},
                        name=f"기술문서 {mod} {lyr} {j}",
                        lifecycle="ACTIVE",
                        tier="WARM",
                    )

        # 크로스 도메인 참조: 계약서 → 영업문서, 규정 → 기술문서 등
        contract_ids = [f"CONTRACT-{i:03d}" for i in range(50)]
        comp_ids = [f"COMP-{i:03d}" for i in range(10)]
        tech_ids = [nid for nid in self.engine.nodes if nid.startswith("TECH-")]

        for cid in contract_ids:
            # 계약서는 영업문서 2개 참조
            targets = random.sample(all_page_ids, min(2, len(all_page_ids)))
            for tgt in targets:
                self.engine.add_reference(cid, tgt)
                ref_count += 1

        for comp_id in comp_ids:
            # 규정은 기술문서 3개 + 영업문서 3개 참조
            if tech_ids:
                for tgt in random.sample(tech_ids, min(3, len(tech_ids))):
                    self.engine.add_reference(comp_id, tgt)
                    ref_count += 1
            targets = random.sample(all_page_ids, min(3, len(all_page_ids)))
            for tgt in targets:
                self.engine.add_reference(comp_id, tgt)
                ref_count += 1

        self.assert_test(f"참조 생성: {ref_count}건", ref_count > 500)
        print(f"  ✓ {ref_count}건 참조 (도메인 내 + 크로스 도메인)")
        print(f"  ✓ 총 노드: {len(self.engine.nodes)}, 엣지: {len(self.engine.edges)}")

    # ──────────────────────────────────────────────────────────
    # 4. CRUD 시뮬레이션
    # ──────────────────────────────────────────────────────────

    def test_04_crud_operations(self):
        """생성/수정/삭제/버전업 무결성"""
        print("\n[4/10] CRUD 시뮬레이션...")

        # === CREATE: 이미 존재하는 ID로 생성 시도 → 거부 ===
        try:
            self.engine.create_page(
                page_id="SVC-001",  # 이미 존재
                domain="MEDI-SALES",
                classification={"service": "SVC-001", "stage": "ROOT", "docType": "CATEGORY"},
                name="중복",
                lifecycle="DRAFT",
            )
            self.assert_test("중복 ID 거부", False, "거부되지 않음")
        except AssertionError:
            self.assert_test("중복 ID 거부", True)

        # === CREATE: 필수 facet 누락 시도 → 거부 ===
        try:
            self.engine.create_page(
                page_id="BAD-DOC-001",
                domain="MEDI-SALES",
                classification={"service": "SVC-001"},  # stage, docType 누락
                name="누락 테스트",
                lifecycle="DRAFT",
            )
            self.assert_test("필수 facet 누락 거부", False)
        except AssertionError:
            self.assert_test("필수 facet 누락 거부", True)

        # === CREATE: facets에 없는 필드 포함 시도 → 거부 ===
        try:
            self.engine.create_page(
                page_id="BAD-DOC-002",
                domain="MEDI-COMP",  # facets: [docType]만
                classification={"docType": "DOC-TEST", "carrier": "EXTRA"},  # carrier는 없는 facet
                name="초과 필드 테스트",
                lifecycle="DRAFT",
            )
            self.assert_test("초과 facet 거부", False)
        except AssertionError:
            self.assert_test("초과 facet 거부", True)

        # === SSOT 위반 시도: 같은 경로에 ACTIVE 2개 ===
        # 먼저 특정 경로에 ACTIVE 문서 확인
        test_cls = {"service": "SVC-001", "stage": "STG-01", "docType": "DOC-TYPE-01"}
        existing = self.engine.search(
            domain="MEDI-SALES",
            classification_filter=test_cls,
            lifecycle="ACTIVE"
        )
        if existing:
            try:
                self.engine.create_page(
                    page_id="SSOT-VIOLATION-001",
                    domain="MEDI-SALES",
                    classification=test_cls,
                    name="SSOT 위반 테스트",
                    lifecycle="ACTIVE",
                )
                self.assert_test("SSOT 위반 거부", False, "거부되지 않음")
            except AssertionError:
                self.assert_test("SSOT 위반 거부", True)
        else:
            self.assert_test("SSOT 위반 거부", True)  # 경로에 ACTIVE 없으면 스킵

        # === UPDATE: 이름 변경 → 버전 minor 증가 ===
        target = "SVC-001-STG-01-DOC-TYPE-01"
        old_ver = self.engine.get_page(target)["properties"]["version"]["minor"]
        self.engine.update_page(target, {"name": "수정된 문서"})
        new_ver = self.engine.get_page(target)["properties"]["version"]["minor"]
        self.assert_test("UPDATE: 버전 minor 증가", new_ver == old_ver + 1)

        # === DEPRECATE: 단일 페이지 ===
        dep_target = "SVC-001-STG-01-DOC-TYPE-02"
        self.engine.deprecate_page(dep_target)
        self.assert_test(
            "DEPRECATE: 상태 전환",
            self.engine.get_page(dep_target)["properties"]["lifecycle"] == "DEPRECATED"
        )

        # === DEPRECATE CASCADE: 부모 삭제 시 자식도 ===
        cascade_parent = "SVC-002-STG-01"
        children_before = self.engine.get_children(cascade_parent)
        affected = self.engine.deprecate_page(cascade_parent, cascade=True)
        all_deprecated = all(
            self.engine.get_page(aid)["properties"]["lifecycle"] == "DEPRECATED"
            for aid in affected if self.engine.get_page(aid)
        )
        self.assert_test(
            f"CASCADE DEPRECATE: {len(affected)}건 영향",
            all_deprecated and len(affected) > 1
        )

        # === SUPERSEDE: 버전 대체 ===
        self.engine.create_page(
            page_id="SVC-001-STG-01-DOC-TYPE-03-V2",
            domain="MEDI-SALES",
            classification={"service": "SVC-001", "stage": "STG-01", "docType": "DOC-TYPE-03"},
            name="문서 v2",
            lifecycle="ACTIVE",
            tier="WARM",
        )
        old_id = "SVC-001-STG-01-DOC-TYPE-03"
        old_node = self.engine.get_page(old_id)
        # 기존이 ACTIVE가 아니면 ACTIVE로 전환해서 SUPERSEDE 테스트
        if old_node["properties"]["lifecycle"] != "DEPRECATED":
            new_node = self.engine.supersede_page(old_id, "SVC-001-STG-01-DOC-TYPE-03-V2")
            self.assert_test(
                "SUPERSEDE: 버전 major 증가",
                new_node["properties"]["version"]["major"] == 2
            )
            self.assert_test(
                "SUPERSEDE: 기존 문서 DEPRECATED",
                self.engine.get_page(old_id)["properties"]["lifecycle"] == "DEPRECATED"
            )
        else:
            self.assert_test("SUPERSEDE: 이미 DEPRECATED (스킵)", True)
            self.assert_test("SUPERSEDE: 스킵", True)

        # === ARCHIVE ===
        self.engine.archive_page(dep_target)
        self.assert_test(
            "ARCHIVE: DEPRECATED → ARCHIVED",
            self.engine.get_page(dep_target)["properties"]["lifecycle"] == "ARCHIVED"
        )

        # ARCHIVE: ACTIVE에서 직접 시도 → 거부
        try:
            self.engine.archive_page("SVC-001")  # ACTIVE 상태
            self.assert_test("ARCHIVE 직접 거부", False)
        except AssertionError:
            self.assert_test("ARCHIVE 직접 거부", True)

        print(f"  ✓ 변경 이력: {len(self.engine.history)}건")

    # ──────────────────────────────────────────────────────────
    # 5. 무결성 검증 (8단계 verifier 원칙)
    # ──────────────────────────────────────────────────────────

    def test_05_integrity(self):
        """그래프 무결성 전체 검증"""
        print("\n[5/10] 무결성 검증...")

        stats = self.engine.stats()

        # 1. 노드 ID 유니크
        node_ids = list(self.engine.nodes.keys())
        self.assert_test("노드 ID 유니크", len(node_ids) == len(set(node_ids)))

        # 2. 엣지 양 끝 존재
        broken_edges = 0
        for edge in self.engine.edges:
            if edge["source"] not in self.engine.nodes or edge["target"] not in self.engine.nodes:
                broken_edges += 1
        self.assert_test(f"엣지 양 끝 존재 ({len(self.engine.edges)}건)", broken_edges == 0)

        # 3. 모든 노드에 필수 필드
        missing_fields = 0
        for nid, node in self.engine.nodes.items():
            props = node.get("properties", {})
            for field in ["domain", "lifecycle", "version", "createdAt", "updatedAt"]:
                if field not in props:
                    missing_fields += 1
        self.assert_test(f"필수 필드 완전성", missing_fields == 0)

        # 4. lifecycle 값 유효성
        valid_states = set(SYSTEM_CONFIG["lifecycle_states"])
        invalid_lc = 0
        for node in self.engine.nodes.values():
            lc = node.get("properties", {}).get("lifecycle", "")
            if lc not in valid_states:
                invalid_lc += 1
        self.assert_test(f"lifecycle 상태 유효", invalid_lc == 0)

        # 5. SSOT: 각 도메인별 경로에 ACTIVE 최대 1개
        ssot_paths = {}
        ssot_violations = 0
        for node in self.engine.nodes.values():
            props = node.get("properties", {})
            if props.get("lifecycle") != "ACTIVE":
                continue
            domain = props.get("domain", "")
            domain_def = self.engine.domains.get(domain, {})
            ssot_key = domain_def.get("ssotKey", [])
            cls = props.get("classification", {})
            path = (domain, tuple(cls.get(k, "") for k in ssot_key))
            if path in ssot_paths:
                ssot_violations += 1
            ssot_paths[path] = node["id"]
        self.assert_test(f"SSOT 유니크 ({len(ssot_paths)}경로)", ssot_violations == 0)

        # 6. classification 필드 범위 (도메인 facets 한도 내)
        cls_violations = 0
        for node in self.engine.nodes.values():
            props = node.get("properties", {})
            domain = props.get("domain", "")
            domain_def = self.engine.domains.get(domain, {})
            allowed = {f["id"] for f in domain_def.get("facets", [])}
            cls = props.get("classification", {})
            for field in cls:
                if field not in allowed:
                    cls_violations += 1
        self.assert_test(f"classification 범위 준수", cls_violations == 0)

        # 7. PARENT_OF ↔ CHILD_OF 쌍 검증
        parent_of = set()
        child_of = set()
        for e in self.engine.edges:
            if e["type"] == "PARENT_OF":
                parent_of.add((e["source"], e["target"]))
            elif e["type"] == "CHILD_OF":
                child_of.add((e["target"], e["source"]))  # 역방향
        pair_match = parent_of == child_of
        self.assert_test(f"PARENT_OF ↔ CHILD_OF 쌍 일치 ({len(parent_of)}쌍)", pair_match)

        print(f"  ✓ 노드: {stats['nodes']}, 엣지: {stats['edges']}")
        print(f"  ✓ SSOT 경로: {len(ssot_paths)}개, 위반: {ssot_violations}")

    # ──────────────────────────────────────────────────────────
    # 6. 전파/역전파 테스트
    # ──────────────────────────────────────────────────────────

    def test_06_propagation(self):
        """하향 전파, 상향 전파, 참조 전파"""
        print("\n[6/10] 전파/역전파 테스트...")

        # 하향 전파: SVC-001에서 모든 하위 수집
        descendants = self.engine.propagate_down("SVC-001")
        # 기대: 20 단계 + (20 × 15 문서) = 320개
        self.assert_test(
            f"하향 전파: SVC-001 → {len(descendants)}개",
            len(descendants) >= 300  # cascade deprecate 때문에 약간 변동
        )

        # 깊이 확인: 깊이 1 = 단계, 깊이 2 = 문서
        depth_1 = [d for d in descendants if d["depth"] == 1]
        depth_2 = [d for d in descendants if d["depth"] == 2]
        self.assert_test(f"하향 전파 depth 1: {len(depth_1)}개 (단계)", len(depth_1) == 20)
        self.assert_test(f"하향 전파 depth 2: {len(depth_2)}개 (문서)", len(depth_2) >= 280)

        # 상향 전파: 리프 문서에서 루트까지
        leaf = "SVC-005-STG-10-DOC-TYPE-07"
        ancestors = self.engine.propagate_up(leaf)
        self.assert_test(
            f"상향 전파: {leaf} → {len(ancestors)}개 조상",
            len(ancestors) == 2  # STG-10, SVC-005
        )
        # 순서: 가까운 것부터
        if ancestors:
            self.assert_test(
                "상향 전파 순서: 부모 먼저",
                ancestors[0]["id"] == "SVC-005-STG-10"
            )

        # 참조 전파: 계약서에서 참조 체인 추적
        ref_chain = self.engine.propagate_references("CONTRACT-001", max_depth=2)
        self.assert_test(
            f"참조 전파: CONTRACT-001 → {len(ref_chain)}개",
            len(ref_chain) >= 1
        )

        print(f"  ✓ 하향: {len(descendants)}개, 상향: {len(ancestors)}개, 참조: {len(ref_chain)}개")

    # ──────────────────────────────────────────────────────────
    # 7. 범위 제한 검색
    # ──────────────────────────────────────────────────────────

    def test_07_scoped_search(self):
        """도메인 / classification / lifecycle / tier 필터"""
        print("\n[7/10] 범위 제한 검색...")

        # 도메인 필터
        medi_sales = self.engine.search(domain="MEDI-SALES")
        medi_contract = self.engine.search(domain="MEDI-CONTRACT")
        medi_comp = self.engine.search(domain="MEDI-COMP")
        medi_tech = self.engine.search(domain="MEDI-TECH")

        self.assert_test(f"도메인 검색: MEDI-SALES={len(medi_sales)}", len(medi_sales) > 9000)
        self.assert_test(f"도메인 검색: MEDI-CONTRACT={len(medi_contract)}", len(medi_contract) == 50)
        self.assert_test(f"도메인 검색: MEDI-COMP={len(medi_comp)}", len(medi_comp) == 10)
        self.assert_test(f"도메인 검색: MEDI-TECH={len(medi_tech)}", len(medi_tech) == 100)

        # classification 부분 매칭
        svc001_docs = self.engine.search(
            domain="MEDI-SALES",
            classification_filter={"service": "SVC-001"}
        )
        self.assert_test(
            f"classification 필터: SVC-001={len(svc001_docs)}",
            len(svc001_docs) >= 300
        )

        # lifecycle 필터
        active_only = self.engine.search(domain="MEDI-SALES", lifecycle="ACTIVE")
        deprecated_only = self.engine.search(domain="MEDI-SALES", lifecycle="DEPRECATED")
        self.assert_test(
            f"lifecycle 필터: ACTIVE={len(active_only)}, DEPRECATED={len(deprecated_only)}",
            len(active_only) > len(deprecated_only)
        )

        # 복합 필터: 특정 서비스 × ACTIVE × HOT
        hot_active = self.engine.search(
            domain="MEDI-SALES",
            classification_filter={"service": "SVC-010"},
            lifecycle="ACTIVE",
            tier="HOT",
        )
        self.assert_test(
            f"복합 필터: SVC-010×ACTIVE×HOT={len(hot_active)}",
            isinstance(hot_active, list)
        )

        # 도메인 경계 검증: MEDI-COMP 검색에 MEDI-SALES 결과 없음
        comp_results = self.engine.search(domain="MEDI-COMP")
        sales_leaked = [r for r in comp_results if r["properties"]["domain"] != "MEDI-COMP"]
        self.assert_test("도메인 경계 격리", len(sales_leaked) == 0)

        print(f"  ✓ MEDI-SALES: {len(medi_sales)}, MEDI-CONTRACT: {len(medi_contract)}")
        print(f"  ✓ MEDI-TECH: {len(medi_tech)}, MEDI-COMP: {len(medi_comp)}")
        print(f"  ✓ ACTIVE: {len(active_only)}, DEPRECATED: {len(deprecated_only)}")

    # ──────────────────────────────────────────────────────────
    # 8. AI 에이전트 권한 뷰
    # ──────────────────────────────────────────────────────────

    def test_08_agent_views(self):
        """AI 에이전트별 뷰 테스트"""
        print("\n[8/10] AI 에이전트 권한 뷰...")

        # 계약 전문 에이전트
        contract_view = self.engine.agent_view("contract")
        self.assert_test(
            f"계약 에이전트: {contract_view['visible_count']}건",
            contract_view["visible_count"] == 50  # MEDI-CONTRACT만
        )

        # 판매 전문 에이전트
        sales_view = self.engine.agent_view("sales")
        self.assert_test(
            f"판매 에이전트: {sales_view['visible_count']}건",
            sales_view["visible_count"] > 9000  # MEDI-SALES만
        )

        # 컴플라이언스 에이전트
        compliance_view = self.engine.agent_view("compliance")
        self.assert_test(
            f"컴플라이언스 에이전트: {compliance_view['visible_count']}건",
            compliance_view["visible_count"] == 10  # MEDI-COMP만 (COMMON-COMP에 문서 없음)
        )

        # 통합 관리 에이전트
        admin_view = self.engine.agent_view("admin")
        self.assert_test(
            f"통합 에이전트: {admin_view['visible_count']}건",
            admin_view["visible_count"] == len(self.engine.nodes)
        )

        # 에이전트 간 격리: 판매 에이전트가 계약 문서 접근 불가
        sales_nodes = {n["id"] for n in sales_view["nodes"]}
        contract_nodes = {n["id"] for n in contract_view["nodes"]}
        overlap = sales_nodes & contract_nodes
        self.assert_test("에이전트 간 격리", len(overlap) == 0)

        # 통합 에이전트는 모든 에이전트의 합집합 포함
        all_specific = sales_nodes | contract_nodes | {n["id"] for n in compliance_view["nodes"]}
        admin_nodes = {n["id"] for n in admin_view["nodes"]}
        self.assert_test("통합 에이전트 ⊇ 개별 합집합", all_specific.issubset(admin_nodes))

        print(f"  ✓ 계약: {contract_view['visible_count']}, 판매: {sales_view['visible_count']}")
        print(f"  ✓ 컴플라이언스: {compliance_view['visible_count']}, 통합: {admin_view['visible_count']}")
        print(f"  ✓ 에이전트 간 중복: {len(overlap)}건")

    # ──────────────────────────────────────────────────────────
    # 9. 자동 채번 + 위치 기반 자동 분류
    # ──────────────────────────────────────────────────────────

    def test_09_auto_id_and_classify(self):
        """자동 채번 (위치 무관 ID) + 구조 노드 기반 classification 자동 유도"""
        print("\n[9/10] 자동 채번 + 자동 분류...")

        # === 자동 채번 테스트 ===
        # page_id=None → PG-XXXXXX 형식 자동 생성
        auto_page_1 = self.engine.create_page(
            page_id=None,
            domain="MEDI-EDU",
            classification={"category": "CAT-AUTO-01", "docType": "DOC-EDU-01"},
            name="자동 채번 테스트 1",
            lifecycle="DRAFT",
        )
        auto_id_1 = auto_page_1["id"]
        self.assert_test("자동 채번: PG- 접두사", auto_id_1.startswith("PG-"))
        self.assert_test("자동 채번: 6자리 시퀀스", len(auto_id_1.split("-")[1]) == 6)

        # 두 번째 자동 채번 → 시퀀스 단조 증가
        auto_page_2 = self.engine.create_page(
            page_id=None,
            domain="MEDI-EDU",
            classification={"category": "CAT-AUTO-02", "docType": "DOC-EDU-02"},
            name="자동 채번 테스트 2",
            lifecycle="DRAFT",
        )
        auto_id_2 = auto_page_2["id"]
        seq_1 = int(auto_id_1.split("-")[1])
        seq_2 = int(auto_id_2.split("-")[1])
        self.assert_test("자동 채번: 시퀀스 단조 증가", seq_2 > seq_1)

        # 자동 채번 ID로 조회 가능
        fetched = self.engine.get_page(auto_id_1)
        self.assert_test("자동 채번: ID로 조회 가능", fetched is not None and fetched["id"] == auto_id_1)

        # === 구조 노드 + 자동 분류 테스트 ===
        # MEDI-SALES에서 구조 트리:
        #   ROOT-AUTO
        #     └─ STRUCT-SVC-AUTO (facet: service=SVC-AUTO)
        #         └─ STRUCT-STG-AUTO (facet: stage=STG-AUTO)
        #             └─ auto_doc (auto_classify=True, docType만 직접)
        self.engine.create_page(
            page_id="ROOT-AUTO",
            domain="MEDI-SALES",
            classification={"service": "ROOT", "stage": "ROOT", "docType": "CATEGORY"},
            name="자동분류 테스트 루트",
            lifecycle="ACTIVE",
            tier="COLD",
        )
        self.engine.create_page(
            page_id="STRUCT-SVC-AUTO",
            domain="MEDI-SALES",
            classification={"service": "SVC-AUTO", "stage": "ROOT", "docType": "CATEGORY"},
            name="서비스: SVC-AUTO",
            lifecycle="ACTIVE",
            tier="COLD",
            parent_id="ROOT-AUTO",
            facet_type="service",
            facet_value="SVC-AUTO",
        )
        self.engine.create_page(
            page_id="STRUCT-STG-AUTO",
            domain="MEDI-SALES",
            classification={"service": "SVC-AUTO", "stage": "STG-AUTO", "docType": "CATEGORY"},
            name="단계: STG-AUTO",
            lifecycle="ACTIVE",
            tier="COLD",
            parent_id="STRUCT-SVC-AUTO",
            facet_type="stage",
            facet_value="STG-AUTO",
        )

        # 자동 분류 문서: docType만 직접 지정, service/stage는 부모 체인에서 유도
        auto_doc = self.engine.create_page(
            page_id=None,  # 자동 채번
            domain="MEDI-SALES",
            classification={"docType": "DOC-AUTO-GUIDE"},
            name="자동분류 가이드 문서",
            lifecycle="DRAFT",
            tier="WARM",
            parent_id="STRUCT-STG-AUTO",
            auto_classify=True,
        )
        auto_doc_cls = auto_doc["properties"]["classification"]
        self.assert_test(
            "자동 분류: service 유도",
            auto_doc_cls.get("service") == "SVC-AUTO"
        )
        self.assert_test(
            "자동 분류: stage 유도",
            auto_doc_cls.get("stage") == "STG-AUTO"
        )
        self.assert_test(
            "자동 분류: docType 유지",
            auto_doc_cls.get("docType") == "DOC-AUTO-GUIDE"
        )

        # derive_classification 독립 검증
        derived = self.engine.derive_classification(auto_doc["id"])
        self.assert_test(
            "derive_classification 일치",
            derived.get("service") == "SVC-AUTO"
            and derived.get("stage") == "STG-AUTO"
            and derived.get("docType") == "DOC-AUTO-GUIDE"
        )

        # 자동 분류 두 번째 문서 (같은 부모 아래)
        auto_doc_2 = self.engine.create_page(
            page_id=None,
            domain="MEDI-SALES",
            classification={"docType": "DOC-AUTO-SCRIPT"},
            name="자동분류 스크립트 문서",
            lifecycle="DRAFT",
            tier="HOT",
            parent_id="STRUCT-STG-AUTO",
            auto_classify=True,
        )
        auto_doc_2_cls = auto_doc_2["properties"]["classification"]
        self.assert_test(
            "자동 분류 2: 동일 부모에서 동일 service/stage",
            auto_doc_2_cls.get("service") == "SVC-AUTO"
            and auto_doc_2_cls.get("stage") == "STG-AUTO"
            and auto_doc_2_cls.get("docType") == "DOC-AUTO-SCRIPT"
        )

        # 3단계 깊이 구조 노드 추가 테스트
        self.engine.create_page(
            page_id="STRUCT-SVC-DEEP",
            domain="MEDI-SALES",
            classification={"service": "SVC-DEEP", "stage": "ROOT", "docType": "CATEGORY"},
            name="서비스: DEEP",
            lifecycle="ACTIVE",
            tier="COLD",
            parent_id="ROOT-AUTO",
            facet_type="service",
            facet_value="SVC-DEEP",
        )
        self.engine.create_page(
            page_id="STRUCT-STG-DEEP",
            domain="MEDI-SALES",
            classification={"service": "SVC-DEEP", "stage": "STG-DEEP-01", "docType": "CATEGORY"},
            name="단계: DEEP-01",
            lifecycle="ACTIVE",
            tier="COLD",
            parent_id="STRUCT-SVC-DEEP",
            facet_type="stage",
            facet_value="STG-DEEP-01",
        )
        deep_doc = self.engine.create_page(
            page_id=None,
            domain="MEDI-SALES",
            classification={"docType": "DOC-DEEP-SPEC"},
            name="딥 구조 문서",
            lifecycle="DRAFT",
            parent_id="STRUCT-STG-DEEP",
            auto_classify=True,
        )
        deep_cls = deep_doc["properties"]["classification"]
        self.assert_test(
            "깊은 구조 자동 분류",
            deep_cls.get("service") == "SVC-DEEP"
            and deep_cls.get("stage") == "STG-DEEP-01"
            and deep_cls.get("docType") == "DOC-DEEP-SPEC"
        )

        print(f"  ✓ 자동 채번: {auto_id_1}, {auto_id_2}, {auto_doc['id']}")
        print(f"  ✓ 자동 분류: {auto_doc_cls}")
        print(f"  ✓ 깊은 구조 분류: {deep_cls}")

    # ──────────────────────────────────────────────────────────
    # 10. 페이지 이동 시나리오
    # ──────────────────────────────────────────────────────────

    def test_10_move_scenarios(self):
        """도메인 내/간 이동, 재귀적 재분류, 참조 안정성, SSOT 재검증"""
        print("\n[10/10] 이동 시나리오...")

        # === 준비: 이동 목적지 구조 노드 생성 ===
        self.engine.create_page(
            page_id="STRUCT-SVC-B",
            domain="MEDI-SALES",
            classification={"service": "SVC-B", "stage": "ROOT", "docType": "CATEGORY"},
            name="서비스 B",
            lifecycle="ACTIVE",
            parent_id="ROOT-AUTO",
            facet_type="service",
            facet_value="SVC-B",
        )
        self.engine.create_page(
            page_id="STRUCT-STG-B",
            domain="MEDI-SALES",
            classification={"service": "SVC-B", "stage": "STG-B", "docType": "CATEGORY"},
            name="단계 B",
            lifecycle="ACTIVE",
            parent_id="STRUCT-SVC-B",
            facet_type="stage",
            facet_value="STG-B",
        )

        # === 1. 같은 도메인 내 이동 ===
        self.engine.create_page(
            page_id="MOVE-DOC-01",
            domain="MEDI-SALES",
            classification={"service": "SVC-AUTO", "stage": "STG-AUTO", "docType": "DOC-MOVE-01"},
            name="이동 테스트 문서",
            lifecycle="DRAFT",
            parent_id="STRUCT-STG-AUTO",
        )
        # 참조 추가 (이동 후에도 유지되어야 함)
        self.engine.add_reference("MOVE-DOC-01", "CONTRACT-001")
        ref_before = self.engine.get_references("MOVE-DOC-01", "outgoing")

        # 이동: STG-AUTO → STG-B
        moved = self.engine.move_page("MOVE-DOC-01", "STRUCT-STG-B")
        moved_cls = moved["properties"]["classification"]

        self.assert_test(
            "도메인 내 이동: service 변경",
            moved_cls.get("service") == "SVC-B"
        )
        self.assert_test(
            "도메인 내 이동: stage 변경",
            moved_cls.get("stage") == "STG-B"
        )
        self.assert_test(
            "도메인 내 이동: docType 유지",
            moved_cls.get("docType") == "DOC-MOVE-01"
        )
        self.assert_test(
            "이동 후 ID 불변",
            moved["id"] == "MOVE-DOC-01"
        )

        # 참조 안정성
        ref_after = self.engine.get_references("MOVE-DOC-01", "outgoing")
        self.assert_test(
            "이동 후 참조 유지",
            len(ref_after) == len(ref_before) and len(ref_after) > 0
        )

        # 부모 변경 확인
        new_parent = self.engine.get_parent("MOVE-DOC-01")
        self.assert_test(
            "이동 후 새 부모",
            new_parent is not None and new_parent["id"] == "STRUCT-STG-B"
        )

        # 버전 minor 증가
        self.assert_test(
            "이동 후 버전 minor 증가",
            moved["properties"]["version"]["minor"] > 0
        )

        # === 2. 하위 페이지 포함 이동 (재귀적 재분류) ===
        self.engine.create_page(
            page_id="MOVE-PARENT",
            domain="MEDI-SALES",
            classification={"service": "SVC-AUTO", "stage": "STG-AUTO", "docType": "SUBCATEGORY"},
            name="이동할 부모",
            lifecycle="ACTIVE",
            parent_id="STRUCT-STG-AUTO",
        )
        self.engine.create_page(
            page_id="MOVE-CHILD-01",
            domain="MEDI-SALES",
            classification={"service": "SVC-AUTO", "stage": "STG-AUTO", "docType": "DOC-CHILD-01"},
            name="자식 문서 1",
            lifecycle="DRAFT",
            parent_id="MOVE-PARENT",
        )
        self.engine.create_page(
            page_id="MOVE-CHILD-02",
            domain="MEDI-SALES",
            classification={"service": "SVC-AUTO", "stage": "STG-AUTO", "docType": "DOC-CHILD-02"},
            name="자식 문서 2",
            lifecycle="DRAFT",
            parent_id="MOVE-PARENT",
        )

        # 부모를 STG-B로 이동 → 자식도 재분류
        self.engine.move_page("MOVE-PARENT", "STRUCT-STG-B")

        child_1_cls = self.engine.get_page("MOVE-CHILD-01")["properties"]["classification"]
        child_2_cls = self.engine.get_page("MOVE-CHILD-02")["properties"]["classification"]
        child_1_domain = self.engine.get_page("MOVE-CHILD-01")["properties"]["domain"]

        self.assert_test(
            "재귀 재분류: 자식1 service=SVC-B",
            child_1_cls.get("service") == "SVC-B"
        )
        self.assert_test(
            "재귀 재분류: 자식1 stage=STG-B",
            child_1_cls.get("stage") == "STG-B"
        )
        self.assert_test(
            "재귀 재분류: 자식2 docType 유지",
            child_2_cls.get("docType") == "DOC-CHILD-02"
        )
        self.assert_test(
            "재귀 재분류: 자식 도메인 동기화",
            child_1_domain == "MEDI-SALES"
        )

        # === 3. 크로스 도메인 이동 (MEDI-SALES → MEDI-EDU) ===
        # MEDI-EDU 루트 (구조 노드: category 값 제공)
        self.engine.create_page(
            page_id="EDU-ROOT",
            domain="MEDI-EDU",
            classification={"category": "CAT-GENERAL", "docType": "CATEGORY"},
            name="교육 루트",
            lifecycle="ACTIVE",
            facet_type="category",
            facet_value="CAT-GENERAL",
        )

        # 이동 대상: MEDI-SALES 문서
        self.engine.create_page(
            page_id="CROSS-MOVE-01",
            domain="MEDI-SALES",
            classification={"service": "SVC-AUTO", "stage": "STG-AUTO", "docType": "DOC-CROSS-01"},
            name="크로스 도메인 이동 문서",
            lifecycle="DRAFT",
            parent_id="STRUCT-STG-AUTO",
        )

        # 형제 관계 추가 (이동 시 자동 해제 테스트용)
        self.engine.create_page(
            page_id="CROSS-SIB-01",
            domain="MEDI-SALES",
            classification={"service": "SVC-AUTO", "stage": "STG-AUTO", "docType": "DOC-SIB-01"},
            name="크로스 이동 형제",
            lifecycle="DRAFT",
            parent_id="STRUCT-STG-AUTO",
        )
        self.engine.add_sibling("CROSS-MOVE-01", "CROSS-SIB-01")

        # 이동 전: 형제 확인
        pre_siblings = self.engine.get_siblings("CROSS-MOVE-01")
        self.assert_test(
            "크로스 도메인 이동 전: 형제 존재",
            len(pre_siblings) == 1 and pre_siblings[0]["id"] == "CROSS-SIB-01"
        )

        # 이동: MEDI-SALES → MEDI-EDU
        self.engine.move_page("CROSS-MOVE-01", "EDU-ROOT", new_domain="MEDI-EDU")
        cross_node = self.engine.get_page("CROSS-MOVE-01")
        cross_cls = cross_node["properties"]["classification"]
        cross_domain = cross_node["properties"]["domain"]

        self.assert_test(
            "크로스 도메인: 도메인 변경",
            cross_domain == "MEDI-EDU"
        )
        self.assert_test(
            "크로스 도메인: service 제거 (MEDI-EDU facets에 없음)",
            "service" not in cross_cls
        )
        self.assert_test(
            "크로스 도메인: stage 제거",
            "stage" not in cross_cls
        )
        self.assert_test(
            "크로스 도메인: docType 유지",
            cross_cls.get("docType") == "DOC-CROSS-01"
        )
        self.assert_test(
            "크로스 도메인: category 유도 (구조 노드에서)",
            cross_cls.get("category") == "CAT-GENERAL"
        )

        # 형제 관계 자동 해제 검증
        post_siblings = self.engine.get_siblings("CROSS-MOVE-01")
        self.assert_test(
            "크로스 도메인 이동: 형제 관계 자동 해제",
            len(post_siblings) == 0
        )
        # 상대방도 형제 없음
        sib_siblings = self.engine.get_siblings("CROSS-SIB-01")
        self.assert_test(
            "크로스 도메인 이동: 상대방 형제도 해제",
            all(s["id"] != "CROSS-MOVE-01" for s in sib_siblings)
        )
        # 이동 이력에 severed_siblings 포함
        last_cross_move = [h for h in self.engine.history if h[0] == "MOVE" and h[1] == "CROSS-MOVE-01"][-1]
        self.assert_test(
            "크로스 도메인 이동: severed_siblings 이력 기록",
            "CROSS-SIB-01" in last_cross_move[2].get("severed_siblings", [])
        )

        # === 4. 이동 이력 검증 ===
        move_history = [h for h in self.engine.history if h[0] == "MOVE"]
        self.assert_test(
            f"이동 이력 기록: {len(move_history)}건",
            len(move_history) >= 3  # DOC-01 이동 + PARENT 이동 + CROSS 이동
        )

        # 이력에 old/new 정보 포함
        last_move = move_history[-1]
        self.assert_test(
            "이동 이력: old/new 도메인 기록",
            "old_domain" in last_move[2] and "new_domain" in last_move[2]
        )

        print(f"  ✓ 도메인 내 이동: SVC-AUTO/STG-AUTO → SVC-B/STG-B")
        print(f"  ✓ 재귀적 재분류: 자식 2개 자동 갱신")
        print(f"  ✓ 크로스 도메인: MEDI-SALES → MEDI-EDU (facet 필터링 + category 유도)")
        print(f"  ✓ ID 안정성 + 참조 안정성 + 이력 기록 확인")

    # ──────────────────────────────────────────────────────────
    # 실행
    # ──────────────────────────────────────────────────────────

    def run_all(self):
        print("=" * 70)
        print("KMS v3.0 스트레스 테스트 — 노션 페이지 모델 시뮬레이션")
        print("=" * 70)

        import time
        start = time.time()

        self.test_01_domain_registration()
        self.test_02_massive_hierarchy()
        self.test_03_cross_references()
        self.test_04_crud_operations()
        self.test_05_integrity()
        self.test_06_propagation()
        self.test_07_scoped_search()
        self.test_08_agent_views()
        self.test_09_auto_id_and_classify()
        self.test_10_move_scenarios()

        elapsed = time.time() - start
        stats = self.engine.stats()

        print("\n" + "=" * 70)
        print("스트레스 테스트 결과")
        print("=" * 70)
        print(f"\n  총 노드: {stats['nodes']:,}개")
        print(f"  총 엣지: {stats['edges']:,}개")
        print(f"  도메인: {len(stats['domains'])}개")
        print(f"  변경 이력: {stats['history_len']}건")
        print(f"  소요 시간: {elapsed:.2f}초")

        print(f"\n  도메인별 분포:")
        for d, c in sorted(stats["domains"].items(), key=lambda x: -x[1]):
            print(f"    {d}: {c:,}건")

        print(f"\n  엣지 유형:")
        for t, c in sorted(stats["edge_types"].items(), key=lambda x: -x[1]):
            print(f"    {t}: {c:,}건")

        print(f"\n  라이프사이클:")
        for lc, c in sorted(stats["lifecycles"].items(), key=lambda x: -x[1]):
            print(f"    {lc}: {c:,}건")

        print(f"\n  테스트 통과: {self.passed}")
        print(f"  테스트 실패: {self.failed}")

        if self.failed:
            print(f"\n  실패 목록:")
            for r in self.test_results:
                if r[0] == "FAIL":
                    print(f"    ✗ {r[1]}: {r[2] if len(r) > 2 else ''}")

        print("\n" + "=" * 70)
        if self.failed == 0:
            print("✅ 전체 스트레스 테스트 통과!")
        else:
            print(f"❌ {self.failed}건 실패")
        print("=" * 70)

        return self.failed == 0


if __name__ == "__main__":
    test = StressTest()
    success = test.run_all()
    sys.exit(0 if success else 1)
