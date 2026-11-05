// Single source of truth for the "How it works" walkthrough: the diagram and the
// explanation panel both render from this list, so they cannot drift apart.

export interface StripStep {
  id: string
  /** Short node title shown in the diagram */
  title: string
  /** Technology label shown under the title */
  tech: string
  what: string
  why: string
  /** Where this lives in the repo */
  file: string
}

export interface PipelineStep extends StripStep {
  /** Diagram position (top-left of the node) in SVG units */
  x: number
  y: number
}

export const NODE_W = 200
export const NODE_H = 76
export const DIAGRAM_W = 960
export const DIAGRAM_H = 290

// Laid out as a snake: row 1 left to right, row 2 right to left.
export const QUERY_STEPS: PipelineStep[] = [
  {
    id: 'question',
    title: '1. Question',
    tech: 'React · fetch + SSE',
    x: 20,
    y: 30,
    what: 'You type a question. The browser POSTs it to /api/ask/stream and starts reading the response as a stream of server-sent events.',
    why: 'Streaming lets the UI show the answer as it is written, instead of waiting for the whole LLM response. The backend is stateless, so chat history lives only in the browser.',
    file: 'frontend/src/api/client.ts, hooks/useChat.ts',
  },
  {
    id: 'embed',
    title: '2. Embed',
    tech: 'SentenceTransformer · 384-dim',
    x: 380,
    y: 30,
    what: 'The question is turned into a vector: a list of 384 numbers that captures its meaning.',
    why: 'The same model embedded the PDF chunks at upload time, so question and chunks live in one vector space. Similar meaning means nearby vectors, even with different words.',
    file: 'backend/src/core/embeddings.py',
  },
  {
    id: 'search',
    title: '3. Vector search',
    tech: 'Qdrant · top 5 · cosine',
    x: 740,
    y: 30,
    what: 'Qdrant finds the 5 stored chunks whose vectors are closest to the question vector, returning text, page, source and a similarity score.',
    why: 'This is the "retrieval" in RAG. The LLM never sees the whole PDF, only the few chunks most likely to contain the answer. Page numbers are 0-based in the backend and shown 1-based in the UI.',
    file: 'backend/src/retrieval.py',
  },
  {
    id: 'prompt',
    title: '4. Build prompt',
    tech: 'LangChain PromptTemplate',
    x: 740,
    y: 190,
    what: 'The 5 chunks are joined into a {context} block and combined with your {question} inside a fixed instruction template.',
    why: 'The template tells the model to answer only from the context and to say "I don\'t know" otherwise. This grounding is what discourages made-up facts. The sources are also sent to the UI now, so citations appear before the answer.',
    file: 'backend/src/generation.py',
  },
  {
    id: 'llm',
    title: '5. LLM',
    tech: 'OpenAI · Gemini · Ollama · flan-t5',
    x: 380,
    y: 190,
    what: 'The prompt goes to the LLM selected by MODEL_PROVIDER, which generates the answer piece by piece.',
    why: 'Provider libraries are imported lazily and the chain is cached, so switching providers is a config change and unused ones are never loaded.',
    file: 'backend/src/generation.py (get_qa_chain)',
  },
  {
    id: 'stream',
    title: '6. Stream to UI',
    tech: 'SSE · sources → token → done',
    x: 20,
    y: 190,
    what: 'The backend emits a sources event first, then one token event per generated piece, then done. The browser parses them and appends text to the message.',
    why: 'A reducer applies each event to chat state, so the UI is just a function of events. A stop button can abort the fetch mid-answer.',
    file: 'backend/src/main.py, frontend/src/api/sse.ts, hooks/chatReducer.ts',
  },
]

// Write path (PDF upload), shown on the live strip only. The server reports the four
// processing stages together with their timings once the upload finishes.
export const UPLOAD_STEPS: StripStep[] = [
  {
    id: 'upload',
    title: '1. Upload',
    tech: 'XHR · multipart',
    what: 'The browser sends the PDF to POST /api/documents and reports upload progress.',
    why: 'XHR is used because fetch() has no upload progress events. Time here depends on file size and your connection.',
    file: 'frontend/src/api/client.ts',
  },
  {
    id: 'extract',
    title: '2. Extract',
    tech: 'PyMuPDF',
    what: 'The text of every page is read out of the PDF, remembering page number and file name.',
    why: 'Scanned PDFs have no text layer, so there is nothing to index and the upload is rejected.',
    file: 'backend/src/ingestion.py',
  },
  {
    id: 'chunk',
    title: '3. Chunk',
    tech: '500 chars · 100 overlap',
    what: 'Pages are split into pieces of about 500 characters that overlap by 100.',
    why: 'Small chunks keep one idea each so they embed well; the overlap avoids cutting a sentence in half.',
    file: 'backend/src/ingestion.py',
  },
  {
    id: 'embed-chunks',
    title: '4. Embed',
    tech: 'SentenceTransformer · 384-dim',
    what: 'Every chunk is turned into a 384-number vector in one batch call.',
    why: 'Usually the slowest stage (CPU-bound). Same model as questions use, so both share one vector space.',
    file: 'backend/src/core/embeddings.py',
  },
  {
    id: 'store',
    title: '5. Store',
    tech: 'Qdrant · uuid5 IDs',
    what: 'Vectors plus text, page and source are written to the Qdrant collection.',
    why: 'IDs are deterministic, so re-uploading the same file overwrites its points instead of duplicating them.',
    file: 'backend/src/ingestion.py',
  },
]
