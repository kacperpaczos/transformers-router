# Implementation Plan: Headless Browser Bridge (Node.js WebGPU Support)

**Feature Name:** `headless-browser-bridge`
**Target Version:** v0.7.1
**Owner:** Core Engineering
**Approver:** Principal Architect
**Status:** **AUTHORIZED FOR EXECUTION** (2026-01-30)

---

## 0. Decision Closure & Governance

### Review Outcome
**Verdict:** **GO WITH CONDITIONS**
The initial design was conditionally approved. The following blocking issues from the Senior Review have been **resolved** in this plan:

*   **Blocker 1 (Binary Transport):** Addressed. The plan now mandates a **WebSocket** side-channel for Audio/Embedding data to execute Zero-Copy transfers, avoiding JSON serialization overhead.
*   **Blocker 2 (Dependency Friction):** Addressed. A **Preflight Check** mechanism is defined to dry-run Playwright presence and abort with clear instructions if missing.
*   **Risk 1 (Concurrency):** Addressed. Use of `context.newPage()` guarantees isolated execution states for parallel Providers.

### Execution Guardrails
To prevent scope creep and technical debt during implementation:
1.  **Zero-Visuals Rule:** No effort shall be spent on rendering UI in the headless page. It is a compute worker only.
2.  **Strict Isolation:** No shared state between the Node.js process and the Browser page except via the defined Bridge Protocol.
3.  **No Native Bindings:** We explicitly **reject** any attempt to use `node-gyp` or native webgpu-dawn bindings. We rely 100% on the Browser.
4.  **Abort on OOM:** If the browser runs out of memory, the Node process must receive a fatal error event immediately. No silent retries.

---

## 1. Overview & Rationale

### The Problem
LXRT promises a "Universal" API for local AI. However, a critical gap exists in Node.js:
- **WebGPU** is the primary accelerator for `transformers.js` (10-50x faster than WASM).
- **Node.js** has **no native WebGPU implementation** effectively usable today.

### The Solution: "The Bridge"
Run `lxrt` inside a hidden, headless Playwright instance. Node.js acts as the control plane.
**Architecture:** Hybrid `JSON-RPC` (Control) + `WebSocket` (Data).

---

## 2. Requirements & Scope

### Functional Requirements
1.  **Transparent Execution:** `createAIProvider({ device: 'webgpu' })` in Node.js transparently spawns the bridge.
2.  **Full Modality Support:** LLM (Streaming), Embedding (Float32), TTS (AudioBuffer).
3.  **High-Performance Transport:** Binary payloads must bypass JSON serialization.
4.  **Lifecycle Management:** Browser terminates on `process.exit` or `unload()`.

### Out of Scope
- Firefox/Safari Support.
- Visual Rendering / Debugging UI.

---

## 3. Architecture & Design

### System Context
```mermaid
graph TD
    UserApp[User Node.js App] -->|Calls| LXRT_Node[LXRT (Node)]
    LXRT_Node -->|Spawns| Playwright[Playwright (Chromium)]
    subgraph Browser Context
        Page[Hidden Page] -->|Loads| LXRT_Bundle[LXRT (Browser Bundle)]
        LXRT_Bundle -->|Inference| WebGPU[WebGPU API]
    end
    LXRT_Node <-->|JSON-RPC (Control)| Page
    LXRT_Node <-->|WebSocket (Binary Data)| Page
```

### Protocol Design
1.  **Control (JSON-RPC):** `cmd:{id, type, payload}` -> `resp:{id, result}`.
2.  **Data (WebSocket):** `[Header: 4 bytes ID][Payload: Raw Buffer]`.

---

## 4. Risk-Ordered Implementation Tasks

Implementation is strictly ordered by **technical risk**. We prove the hardest parts first.

### Phase 1: High-Risk Validation (The Transport Spike)
*Goal: Prove that we can send raw audio buffers from Headless Page to Node.js without overhead.*

- [x] **Task 1.1:** Create `scripts/bridge-spike.ts` that launches Playwright and starts a local WebSocket server.
- [x] **Task 1.2:** Inject code into the page to generate a 10MB `Float32Array` (dummy embedding) and send it via WS.
- [x] **Task 1.3:** Measure transfer time. **Pass Criteria:** 10MB < 50ms.
- [x] **Task 1.4:** Define `src/core/bridge/protocol.ts` (Shared Schema) based on findings.

### Phase 2: Core Infrastructure (The Manager)
*Goal: Robust lifecycle management.*

- [x] **Task 2.1:** Implement `HeadlessBrowserService` (Singleton). Handle `launch()`, `close()`.
- [x] **Task 2.2:** Implement `checkCapabilities()` (Preflight). Run `npx playwright install --dry-run`.
- [x] **Task 2.3:** Implement `LogBus` piping. Ensure `console.log` in browser appears in Node terminal.

### Phase 3: The Adapter (LLM & Chat)
*Goal: Basic text generation.*

- [x] **Task 3.1:** Implement `HeadlessLLMModel` class (implements `ILLMModel`).
- [x] **Task 3.2:** Wire up `chat()` to send `CMD_CHAT` via JSON-RPC.
- [x] **Task 3.3:** Implement `stream()` generator, yielding tokens from bridge events.

### Phase 4: Binary Modalities (TTS & Embeddings)
*Goal: High-performance features.*

- [ ] **Task 4.1:** Implement `HeadlessEmbeddingModel`. Receiver buffer from WS, cast to `Float32Array`.
- [ ] **Task 4.2:** Implement `HeadlessTTSModel`. Receiver buffer from WS, cast to `Blob`.

### Phase 5: Integration & Polish
*Goal: User experience.*

- [ ] **Task 5.1:** Update `AIProviderFactory` to auto-detect `device: 'webgpu'` availability in Node.
- [ ] **Task 5.2:** Add friendly error messages ("Please run npx playwright install...").

### Phase 6: Verification
*Goal: Production Readiness.*

- [ ] **Task 6.1:** Run `examples/benchmark.js` with `device: webgpu`. Verify Speedup.
- [ ] **Task 6.2:** Verify Memory Cleanup (ensure no zombie Chrome processes).

---

## 5. Success Criteria & Sign-Off

1.  **Performance:** >30 tokens/sec on M1 Max (via Bridge).
2.  **Binary Efficiency:** <10ms overhead for 5sec Audio clip transfer.
3.  **Reliability:** 100 consecutive load/unload cycles without error.

**Authorization:**
The project is approved for implementation starting at **Phase 1**.
