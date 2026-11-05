// Single source of truth for the "How it works" walkthrough: the diagram and the
// explanation panel both render from this list, so they cannot drift apart.

export interface PipelineStep {
  id: string
  /** Short node title shown in the diagram */
  title: string
  /** Technology label shown under the title */
  tech: string
  /** Diagram position (top-left of the node) in SVG units */
  x: number
  y: number
  what: string
  why: string
  /** Where this lives in the repo */
  file: string
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
