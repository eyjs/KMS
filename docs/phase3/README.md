# Phase 3: 데이터 처리 확장 (선택적)

> **Version** 3.1 | 2026-02-08 | 미래 단계 (조건부)

---

## 1. 개요

**Phase 2 완료 후, 조건 충족 시 진행하는 선택적 확장 단계**

Phase 2에서 구축한 문서 체계 관리 시스템에 데이터 처리 기능을 추가:
- 문서 텍스트 추출
- 자동 분류 고도화
- 벡터 DB 구축
- RAG 내재화 (외주 종료)

> **주의**: 이 단계는 **선택적**입니다. Phase 2만으로도 시스템은 정상 동작합니다.

---

## 2. 진입 조건

Phase 3 진행을 위한 필수 조건:

| 조건 | 상세 |
|------|------|
| Phase 2 완료 | 안정적 운영 확인 (6개월+) |
| 예산 확보 | 추가 5,000만원+ |
| 인력 확보 | Python 개발자 채용 또는 외주 |
| 비즈니스 니즈 | 외주 종료, 내재화 필요성 |

**조건 미충족 시**: Phase 2 + 외주 RAG로 계속 운영

---

## 3. 확장 범위

### Phase 2 → Phase 3 변경

| 기능 | Phase 2 | Phase 3 |
|------|---------|---------|
| 문서 저장 | O | O |
| 분류/관계 관리 | O | O |
| 뷰어 | O | O |
| 외부 API | O | O |
| 텍스트 추출 | 외주 | **내재화** |
| 자동 분류 | 제한적 | **ML 기반** |
| 벡터 DB | 외주 | **내재화** |
| RAG/챗봇 | 외주 | **내재화** |

---

## 4. 기술 스택 추가

### Phase 2 스택 유지
- Frontend: Vue 3
- Backend: ASP.NET Core 8
- Database: PostgreSQL 16

### Phase 3 추가

| 영역 | 기술 | 버전 | 역할 |
|------|------|------|------|
| 코어 엔진 | Python | 3.11+ | 문서 처리 |
| PDF 파싱 | pdfplumber | 0.10+ | 텍스트 추출 |
| 한글 NLP | Kiwi | 0.16+ | 형태소 분석 |
| 벡터 DB | pgvector | - | 임베딩 저장 |
| 임베딩 | sentence-transformers | - | 한국어 모델 |
| 컨테이너 | Docker | - | Python 격리 |

---

## 5. 아키텍처 변경

### Phase 2 (현재)

```
Vue 3 → .NET Core → PostgreSQL
                         │
                   [외부 API]
                         │
                    외주 RAG
```

### Phase 3 (확장 후)

```
Vue 3 → .NET Core → PostgreSQL
              │           │
              ▼           ▼
        Python Engine ← pgvector
              │
              ▼
         RAG Pipeline
```

---

## 6. 확장 인터페이스

Phase 2에서 정의해둔 인터페이스 구현:

```csharp
// Phase 2: 인터페이스 정의
public interface IDocumentProcessor
{
    Task<ExtractedContent> ExtractText(string filePath);
    Task<ClassificationSuggestion> SuggestClassification(string text);
}

// Phase 3: 구현체 연결
public class PythonDocumentProcessor : IDocumentProcessor
{
    private readonly HttpClient _pythonClient;

    public async Task<ExtractedContent> ExtractText(string filePath)
    {
        // Python 서비스 호출
        return await _pythonClient.PostAsync("/extract", ...);
    }
}
```

---

## 7. 데이터베이스 확장

### 추가 테이블

```sql
-- 추출된 텍스트
CREATE TABLE document_content (
    document_id UUID REFERENCES documents(id),
    full_text TEXT,
    keywords JSONB,
    processed_at TIMESTAMP,
    PRIMARY KEY(document_id)
);

-- 벡터 임베딩
CREATE TABLE document_embeddings (
    document_id UUID REFERENCES documents(id),
    embedding VECTOR(768),  -- pgvector
    model_version VARCHAR(50),
    created_at TIMESTAMP,
    PRIMARY KEY(document_id)
);

-- 인덱스
CREATE INDEX idx_embedding ON document_embeddings
USING ivfflat (embedding vector_cosine_ops);
```

---

## 8. 비용 추정

| 항목 | 금액 |
|------|------|
| Python 개발 (외주) | 3,000만원 |
| 벡터 DB 구축 | 1,000만원 |
| RAG 파이프라인 | 1,500만원 |
| **초기 비용** | **5,500만원** |
| 연간 운영 추가 | 1,000만원 |

### 비교

| 시나리오 | 5년 비용 |
|---------|---------|
| Phase 2 + 외주 RAG | 7,000만원 + 외주비 |
| Phase 3 내재화 | 1.3억원 (외주 종료) |

---

## 9. 완료 기준

| 기준 | 상태 |
|------|------|
| Python 코어 엔진 구축 | 미정 |
| 텍스트 추출 파이프라인 | 미정 |
| 자동 분류 (정규식 → ML) | 미정 |
| pgvector 연동 | 미정 |
| RAG 파이프라인 | 미정 |
| 외주 종료, 완전 내재화 | 미정 |

---

## 10. 결정 시점

**Phase 2 완료 후 6개월 시점에 평가:**

| 질문 | 답변 |
|------|------|
| Phase 2 안정적 운영 중? | 예/아니오 |
| 외주 비용 부담? | 예/아니오 |
| 추가 예산 확보 가능? | 예/아니오 |
| Python 인력 확보 가능? | 예/아니오 |

**모두 "예"인 경우에만 Phase 3 진행**

---

## 11. 결론

```
Phase 3는 "있으면 좋은 것"이지 "필수"가 아닙니다.

Phase 2만으로:
• 문서 체계 관리 100% 가능
• 외주 RAG로 챗봇 서비스 가능
• 데이터 주권 확보

Phase 3 진행 시:
• 외주 종료, 완전 내재화
• 기술 역량 축적
• 장기적 비용 절감 (조건부)
```

---

**문서 끝**
