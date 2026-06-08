# LXRT - Development Roadmap

**Version:** `0.7.1` (Upcoming)
**Status:** Planning / Active Development

---

> **See also:**
> - [Product Strategy & Roadmap](./PRODUCT_STRATEGY.md)
> - [High Level Interfaces (Concepts)](./concepts/HIGH_LEVEL_INTERFACES.md)
> - [WebGPU Guide](./WEBGPU_GUIDE.md)

---

## 📅 v0.7.1 Goals

### 🚨 Critical Pivots (Architecture Correction)
**Priority:** Blocking
**Status:** **NEW**

Detailed in `PRODUCT_STRATEGY.md` (Review 2026-01-30).

- [ ] **Headless Browser Bridge:** Implement a reference architecture for running `lxrt` inside Playwright/Puppeteer to bypass the Node.js WebGPU limitation.
- [ ] **Memory Manager Service:** Implement a global "Memory Budget" controller to prevent OOM when loading LLM+Vision+Embeddings.
- [ ] **Persistent Vector Store:** Implement a persistent `IVectorStore` adapter (e.g. SQLite) for Node.js usage.

### 1. OCR Model Improvements
**Priority:** High
**Status:** Planned

The current OCR model needs refinement to provide more rich metadata similar to the other modalities.
- [ ] **Metadata Extraction:** Enhance `recognize()` to return per-word confidence scores and bounding boxes (`bbox`) instead of placeholders.
- [ ] **Backend Integration:** Fully integrate `BackendSelector` into `OCRModel` for better device management (WebGPU/WASM/Node).
- [ ] **Types:** Ensure strict typing for new metadata fields.

### 2. Test Coverage Expansion
**Priority:** High
**Status:** Planned

Increase test coverage to ensure stability of the newly added features (JSON Mode, Tools).
- [ ] **JSON Mode Edge Cases:** Verify handling of malformed JSON responses and recovery.
- [ ] **Tool Calling Scenarios:** Test complex multi-tool scenarios.
- [ ] **OCR Metadata:** Add tests for new bbox/confidence outputs.

### 3. Architecture & Quality Stabilization (Audit Remediation)
**Priority:** Critical
**Status:** Planned

Addressing critical tech debt and architectural risks identified in the 2026 Audit.

- [ ] **Decouple Core & Domain:**
    - Split `src/core/types.ts` (God Object) into domain-specific type definitions (Config, Events, Models).
    - Remove circular dependencies between `domain` and `core`.
- [ ] **Dependency Injection Refactor:**
    - Refactor `ModelManager` to use DI / Factory pattern instead of direct model instantiation.
    - Create `ModelFactory` in `src/infra` to handle concrete implementations.
- [ ] **Unit Testing Gap:**
    - Create dedicated unit tests for `ModelManager` (mocking the backend/models).
    - ensure 100% coverage of state transitions and error handling paths.
- [ ] **Code Structure Cleanup:**
    - Move `VoiceProfileRegistry` to a dedicated Domain Service or Config layer.
    - Extract `LogBus` to `src/infra/logging`.
- [ ] **Download Manager:**
    - Implement chunk-based parallel downloading for models.
    - Add support for pausing/resuming downloads (Range headers).

---

## 🔮 Future Work (v0.8.0 candidate)

### 3. Agentic & UI Features
**Priority:** Medium/High
**Status:** Backlog

To support more advanced use cases like autonomous agents and easy implementations.

- [ ] **Agentic Examples:** Create robust examples demonstrating "Long-term Memory" (using Vector Store) and multi-step reasoning.
- [ ] **UI Library:** Develop a set of ready-to-use React/Vue components (e.g., `<ChatWindow />`, `<AudioVisualizer />`) to speed up frontend integration.


### 4. Modernization & Redesign (Tier-1 Quality)
**Priority:** Strategic (v0.8.0+)
**Status:** Inception

Long-term modernization goals to achieve Tier-1 library status.

- [ ] **Infrastructure Modernization:**
    - [ ] Modular Architecture (Split into `@lxrt/core`, `@lxrt/llm`, etc.).
    - [ ] Modular Architecture (Split into `@lxrt/core`, `@lxrt/llm`, etc.).
    - [ ] Plugin System for third-party model support.
- [ ] **Ecosystem Alignment:**
    - [ ] **Full WASM/WebGPU abstraction layer:** (Re-evaluating feasibility: Browser-first focus is likely safer).
    - [ ] OpenTelemetry Integration for observability.
- [ ] **Tooling & DX:**
    - [ ] Changeset/Semantic Release automation.
    - [ ] Multi-platform CI (Windows/MacOS) verification.

---

## ✅ Completed (Archived)

Detailed history of completed features can be found in `CHANGELOG.md`.
- **v0.7.0 Features:** Abort/Cancel, JSON Mode, Function Calling, WebGPU Backend.
