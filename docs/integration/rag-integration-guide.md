# KMS API 연동 가이드 (외부 RAG 시스템용)

## 개요

이 문서는 외부 RAG(Retrieval-Augmented Generation) 시스템이 KMS에서 문서를 가져가기 위한 API 연동 가이드입니다.

### 연동 시나리오

```
외부 RAG 시스템                              KMS
┌────────────────────┐                    ┌────────────────────┐
│                    │  1. API Key 발급   │                    │
│  문서 수집         │ ←───────────────── │  문서 체계 관리     │
│                    │                    │                    │
│  2. 접근 가능      │  GET /accessible   │                    │
│     문서 목록 조회  │ ─────────────────→ │                    │
│                    │ ←───────────────── │                    │
│                    │                    │                    │
│  3. 문서 메타데이터 │  GET /documents/:id│                    │
│     + 관계 조회    │ ─────────────────→ │                    │
│                    │ ←───────────────── │                    │
│                    │                    │                    │
│  4. 파일 다운로드   │  GET /:id/file    │                    │
│     (PDF 원본)     │ ─────────────────→ │                    │
│                    │ ←───────────────── │                    │
│                    │                    │                    │
│  5. 자체 파싱/벡터화│                    │                    │
│                    │                    │                    │
│  6. 증분 동기화    │  GET /changes      │                    │
│     (이후 변경분만) │ ─────────────────→ │                    │
└────────────────────┘                    └────────────────────┘
```

---

## 1. 인증

### API Key 발급

KMS 관리자에게 API Key 발급을 요청하세요.

- **권한 그룹 설정**: API Key는 특정 폴더에만 접근할 수 있도록 권한 그룹에 할당됩니다.
- **역할(Role)**: 일반적으로 `VIEWER` 역할이 부여됩니다.

### 요청 헤더

```http
X-API-Key: kms_xxxxxxxxxxxxxxxx
```

또는 Bearer 토큰 방식:

```http
Authorization: Bearer <JWT_TOKEN>
```

---

## 2. 주요 API

### 2.1 접근 가능 문서 ID 목록

```http
GET /api/documents/accessible
```

**응답:**
```json
{
  "documentIds": ["uuid-1", "uuid-2", "uuid-3"]
}
```

### 2.2 접근 가능 문서 메타데이터

```http
GET /api/documents/accessible/metadata
```

**응답:**
```json
{
  "documents": [
    {
      "id": "uuid-1",
      "docCode": "DOC-2602-001",
      "fileName": "보험약관.pdf",
      "securityLevel": "PUBLIC",
      "lifecycle": "ACTIVE",
      "folders": [
        {
          "domainCode": "SALES",
          "categoryId": 5,
          "categoryCode": "SALES-F01",
          "categoryName": "약관"
        }
      ]
    }
  ]
}
```

### 2.3 문서 상세 + 연관 문서

```http
GET /api/documents/{id}?includeRelations=true&relationDepth=2
```

**파라미터:**
| 파라미터 | 타입 | 기본값 | 설명 |
|----------|------|--------|------|
| includeRelations | boolean | false | 연관 문서 포함 |
| relationDepth | 1-3 | 1 | 관계 탐색 깊이 |
| relationTypes[] | string[] | 전체 | PARENT_OF, CHILD_OF, SIBLING, REFERENCE, SUPERSEDES |

**응답:**
```json
{
  "id": "uuid-1",
  "docCode": "DOC-2602-001",
  "fileName": "보험약관.pdf",
  "lifecycle": "ACTIVE",
  "securityLevel": "PUBLIC",
  "downloadUrl": "/api/documents/uuid-1/file",
  "relations": {
    "totalCount": 5,
    "returnedCount": 5,
    "hasMore": false,
    "byType": [
      {
        "relationType": "PARENT_OF",
        "label": "상위 문서",
        "direction": "outgoing",
        "documents": [
          {
            "id": "uuid-2",
            "fileName": "요약서.pdf",
            "lifecycle": "ACTIVE"
          }
        ]
      }
    ]
  }
}
```

### 2.4 파일 다운로드

```http
GET /api/documents/{id}/file
```

**응답:** 원본 파일 바이너리 (PDF, MD, CSV)

### 2.5 증분 동기화

마지막 동기화 이후 변경된 문서만 조회:

```http
GET /api/documents/changes?since=2026-02-13T00:00:00Z&includeDeleted=true
```

**응답:**
```json
{
  "created": [
    { "id": "uuid-4", "docCode": "DOC-2602-004", "fileName": "신규문서.pdf" }
  ],
  "updated": [
    { "id": "uuid-1", "docCode": "DOC-2602-001", "fileName": "보험약관.pdf" }
  ],
  "deleted": [
    { "id": "uuid-3", "docCode": "DOC-2602-003", "fileName": "삭제문서.pdf" }
  ],
  "syncedAt": "2026-02-14T10:30:00.000Z"
}
```

### 2.6 벌크 메타데이터 조회

여러 문서를 한번에 조회 (N+1 방지):

```http
POST /api/documents/bulk-metadata
Content-Type: application/json

{
  "ids": ["uuid-1", "uuid-2", "uuid-3"],
  "includeRelations": false
}
```

**응답:**
```json
{
  "documents": [...],
  "requestedCount": 3,
  "returnedCount": 3
}
```

### 2.7 접근 가능 여부 확인

특정 문서 접근 가능 여부 (단건):

```http
GET /api/documents/{id}/can-access
```

**응답:**
```json
{
  "canAccess": true
}
```

또는:
```json
{
  "canAccess": false,
  "reason": "폴더 접근 권한이 없습니다"
}
```

---

## 3. 권한 체계

### 문서 보안 등급

| 등급 | 설명 | API Key 접근 |
|------|------|-------------|
| PUBLIC | 공개 | VIEWER 이상 |
| INTERNAL | 사내용 | EDITOR 이상 |
| CONFIDENTIAL | 대외비 | REVIEWER 이상 |
| SECRET | 기밀 | APPROVER 이상 |

### 폴더 권한

API Key는 권한 그룹에 할당되며, 그룹에 설정된 폴더만 접근 가능합니다.

---

## 4. Rate Limiting

| 제한 | 값 |
|------|-----|
| 초당 | 10회 |
| 분당 | 100회 |
| 시간당 | 1000회 |

초과 시 `429 Too Many Requests` 응답.

---

## 5. 동기화 전략 권장

### 초기 동기화

```
1. GET /api/documents/accessible → 접근 가능 문서 ID 목록
2. POST /api/documents/bulk-metadata → 메타데이터 벌크 조회
3. 각 문서에 대해 GET /:id/file → 파일 다운로드
4. 자체 파싱 + 벡터화
5. syncedAt 시점 저장
```

### 증분 동기화 (주기적)

```
1. GET /api/documents/changes?since={lastSyncedAt}
2. created → 새 문서 추가
3. updated → 메타데이터/파일 갱신
4. deleted → 인덱스에서 제거
5. syncedAt 갱신
```

---

## 6. 헬스체크

시스템 상태 확인:

```http
GET /api/health
```

**응답:**
```json
{
  "status": "healthy",
  "timestamp": "2026-02-14T10:30:00.000Z",
  "checks": {
    "database": { "status": "ok", "latencyMs": 5 }
  }
}
```

---

## 7. OpenAPI Spec

전체 API 명세:

```
https://kms.joonbi.co.kr/api/docs       (Swagger UI)
https://kms.joonbi.co.kr/api/docs-json  (OpenAPI JSON)
```

LLM Function Calling에 활용 가능.

---

## 8. 문의

연동 관련 문의: [관리자 이메일]
