# Frontend Architecture

React + Vite + TypeScript SPA in `frontend/`. No router, no global store: `App.tsx` composes two hooks and four components. Chat state lives in the browser only; the backend is stateless.

## Diagram

```mermaid
flowchart TB
    subgraph Entry[Entry]
        MAIN[main.tsx]
        APP[App.tsx<br/>layout: sidebar + chat]
    end

    subgraph Components[components/]
        HB[HealthBadge]
        UP[UploadPanel<br/>drag/drop, progress]
        CT[ChatThread<br/>auto-scroll, examples]
        MB[MessageBubble<br/>markdown + sources]
        CI[ChatInput<br/>send / stop]
    end

    subgraph Hooks[hooks/]
        UH[useHealth<br/>poll every 15s]
        UC[useChat<br/>send, stop, clear]
        RED[chatReducer<br/>start, sources, token,<br/>finish, fail, clear]
    end

    subgraph Api[api/]
        CL[client.ts<br/>getHealth, uploadPdf, askStream]
        SSE[sse.ts<br/>createSseParser]
    end

    BE[(FastAPI backend<br/>/api/*)]

    MAIN --> APP
    APP --> HB
    APP --> UP
    APP --> CT
    APP --> CI
    CT --> MB

    APP -. "health state" .-> UH
    APP -. "messages, isStreaming" .-> UC
    UC -- "dispatch" --> RED
    RED -- "Message[]" --> UC

    HB -. "props: HealthState" .- UH
    CT -. "props: messages" .- UC
    CI -- "onSend / onStop" --> UC

    UH -- "GET /health" --> CL
    UP -- "POST /documents<br/>XHR (progress)" --> CL
    UC -- "POST /ask/stream<br/>fetch + AbortController" --> CL
    CL -- "SSE chunks" --> SSE
    SSE -- "sources / token / done / error" --> CL

    CL <--> BE
```

## Layers

| Layer | Files | Role |
|-------|-------|------|
| Entry | `main.tsx`, `App.tsx` | Mount, layout, wire hooks to components |
| Components | `components/*.tsx` | Presentational UI; `UploadPanel` owns its own upload state |
| Hooks | `hooks/useChat.ts`, `hooks/useHealth.ts` | Async orchestration, expose state to `App` |
| State | `hooks/chatReducer.ts` | Pure reducer for `Message[]` (status: `streaming`, `done`, `stopped`, `error`) |
| API | `api/client.ts`, `api/sse.ts` | All HTTP; error normalisation to `ApiError`; SSE parsing |

## Flows

### Ask a question (streaming)

```mermaid
sequenceDiagram
    actor User
    participant CI as ChatInput
    participant UC as useChat
    participant RED as chatReducer
    participant CL as client.askStream
    participant BE as POST /api/ask/stream

    User->>CI: type + submit
    CI->>UC: send(query)
    UC->>RED: start (user + assistant msg, streaming)
    UC->>CL: askStream(query, handlers, signal)
    CL->>BE: fetch (JSON body, Accept: text/event-stream)
    BE-->>CL: event: sources
    CL-->>UC: onSources
    UC->>RED: sources
    loop each token
        BE-->>CL: event: token {t}
        CL-->>UC: onToken
        UC->>RED: token (append)
    end
    BE-->>CL: event: done
    UC->>RED: finish (done)
    Note over User,UC: Stop button aborts the controller, giving finish (stopped).<br/>Errors give fail (error message).
```

### Upload a PDF

`UploadPanel` calls `uploadPdf(file, onProgress)`, which uses XHR (fetch has no upload progress) against `POST /api/documents`. Size is checked client-side against `VITE_MAX_UPLOAD_MB` when set.

### Health

`useHealth` calls `getHealth` immediately and every 15s. `status === 'ok'` gives `ok`, other status gives `degraded`, network failure gives `down`. Polling stops on unmount via `AbortController`.

## Design notes

- **Single in-flight request:** `useChat` guards with `controllerRef`; `send` is a no-op while streaming.
- **Dev proxy:** Vite proxies `/api` to `:8000`; `VITE_API_URL` is empty in dev and set for deployed builds.
- **Tests:** `chatReducer.test.ts` and `sse.test.ts` cover the pure logic (vitest).

See [architecture.md](architecture.md) for the full-stack view.
