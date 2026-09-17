# A008 target system architecture

This document describes the intended A008 system boundary for Step 4 and beyond.

The target is an **A008-owned application runtime** where cognition, memory,
model selection, tools, prompts, project/session ownership and product policy
remain inside A008. ACME is embedded **in-process** through
`@acme-engine/model-runtime` and owns model execution mechanics only.

The same logical composition can be deployed locally or hosted. A remote ACME
sidecar remains a possible deployment option, but it is not the default target.

```mermaid
flowchart LR

  %% ---------------- CLIENTS ----------------
  subgraph Clients["Clients"]
    direction TB

    U1([User]) --> WEB["Web client"]
    U2([User]) --> TAURI["Tauri v2 client"]
    U3([User]) --> NATIVE["Native client"]

    CREATOR([Creator]) --> LOCALUI["A008 local client"]
  end

  WEB --> HOST
  TAURI --> HOST
  NATIVE --> HOST
  LOCALUI --> LOCALHOST

  %% ---------------- A008 ----------------
  subgraph A008["A008 application runtime — same composition local or hosted"]
    direction TB

    HOST["Hosted host / API"]
    LOCALHOST["Local host / API"]

    SESSION["Session + project ownership"]

    subgraph Cognition["A008 cognition and product logic"]
      direction TB

      ORCH["Conversation / orchestration"]
      MEMORY["A008 memory engine"]
      RETRIEVAL["Retrieval + activation"]
      CLASSIFIER["Classifier"]
      EXTRACTOR["Knowledge extractor"]
      SEMANTIC["Semantic layer"]
      PROMPTS["Prompt contracts"]
      TOOLS["Tools + approvals"]
      CATALOG["Model catalog + selection<br/>provider · model · capabilities · controls"]
    end

    DB[("A008 persistence<br/>SQLite / Postgres<br/>projects · sessions · memory · knowledge")]

    subgraph ACME["Embedded @acme-engine/model-runtime"]
      direction TB

      EXEC["Model execution engine"]
      ROUTING["Provider routing"]
      STREAM["Streaming + cancellation"]
      EVIDENCE["Execution evidence"]
      ADAPTERS["Provider adapters"]
    end

    HOST --> SESSION
    LOCALHOST --> SESSION
    SESSION --> ORCH

    ORCH <--> MEMORY
    MEMORY --> RETRIEVAL
    MEMORY --> CLASSIFIER
    MEMORY --> EXTRACTOR
    MEMORY --> SEMANTIC

    ORCH --> PROMPTS
    ORCH <--> TOOLS
    ORCH --> CATALOG

    MEMORY <--> DB
    SESSION <--> DB

    CATALOG -->|"selected model / provider / capabilities"| EXEC
    ORCH -->|"prepared messages / tools / generation controls"| EXEC

    EXEC --> ROUTING
    EXEC --> STREAM
    EXEC --> EVIDENCE
    ROUTING --> ADAPTERS

    STREAM -->|"normalized stream / tool calls / result"| ORCH
  end

  %% ---------------- PROVIDERS ----------------
  subgraph Providers["External model providers"]
    direction TB

    OPENAI["OpenAI"]
    NVIDIA["NVIDIA"]
    GEMINI["Gemini"]
    XAI["xAI"]
    OTHER["Other / OpenAI-compatible"]
  end

  ADAPTERS --> OPENAI
  ADAPTERS --> NVIDIA
  ADAPTERS --> GEMINI
  ADAPTERS --> XAI
  ADAPTERS --> OTHER

  %% ---------------- STYLES ----------------
  classDef client fill:#eef6ff,stroke:#3b82f6,color:#0f172a;
  classDef a008 fill:#eefbf3,stroke:#16a34a,color:#0f172a;
  classDef acme fill:#fff7e6,stroke:#f59e0b,color:#0f172a;
  classDef provider fill:#f5f3ff,stroke:#8b5cf6,color:#0f172a;
  classDef storage fill:#f8fafc,stroke:#64748b,color:#0f172a;

  class WEB,TAURI,NATIVE,LOCALUI client;
  class HOST,LOCALHOST,SESSION,ORCH,MEMORY,RETRIEVAL,CLASSIFIER,EXTRACTOR,SEMANTIC,PROMPTS,TOOLS,CATALOG a008;
  class EXEC,ROUTING,STREAM,EVIDENCE,ADAPTERS acme;
  class OPENAI,NVIDIA,GEMINI,XAI,OTHER provider;
  class DB storage;
```

## Ownership boundary

A008 owns:

- application and session/project semantics
- memory, retrieval, extraction, classification and semantic knowledge
- prompts and tool policy
- model catalog, model selection and provider strategy
- product-level fallback or retry policy between models
- durable application state

Embedded ACME owns:

- execution of the model request A008 prepared
- exact provider routing for that request
- streaming and cancellation
- execution evidence and model-call normalization
- provider adapters and provider-specific transport behavior

ACME does **not** choose which model A008 should use and does not own A008
memory, cognition, prompts, tools or fallback strategy.

## Deployment rule

The default target is:

```text
client -> A008 -> embedded @acme-engine/model-runtime -> provider
```

not:

```text
client -> A008 -> HTTP -> separate ACME sidecar -> provider
```

A remote ACME runtime can remain available later as an optional deployment
adapter behind the same internal execution boundary.
