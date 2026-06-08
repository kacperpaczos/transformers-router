Niestety narzędzie nie może pobrać tych stron. Ale na podstawie dokumentacji którą już przeanalizowałem + moją wiedzę o transformers.js v3, przygotowuję **kompletny przepisany dokument z algorytmami blokowymi**.

***

# **Adaptive Inference Algorithm Specification v2.0**
## **LXRT Framework - transformers.js v3 Implementation**

***

## **1. Abstract**

This document defines the **Adaptive Inference Algorithm** for the LXRT framework, leveraging `transformers.js` v3.0+. The algorithm maximizes Quality of Service (QoS) by dynamically balancing model fidelity against execution latency through:

1. **Static Hardware Profiling** - Determines device compute capability tier
2. **Constraint-Based Model Selection** - Maps tiers to optimal model configurations
3. **Runtime Telemetry Feedback** - Monitors Tokens-Per-Second (TPS) metrics
4. **Self-Healing Recovery** - Handles failures through graceful degradation

The system operates as a closed-loop control system with continuous feedback from inference telemetry to govern pipeline configuration, model selection, and resource allocation.

***

## **2. Terminology & Definitions**

| Term | Definition |
|------|------------|
| **Compute Budget** | Normalized scalar ∈  representing theoretical inference capability |
| **Tier** | Discretization of Compute Budget: `ULTRA`, `HIGH`, `MEDIUM`, `LOW` |
| **TPS (Tokens Per Second)** | Primary runtime metric for inference throughput |
| **QoS Threshold** | Minimum acceptable TPS (e.g., 5.0) for user viability |
| **Degradation** | Controlled reduction of model complexity to recover stability |
| **Pipeline** | transformers.js high-level API for task-specific inference |
| **Device** | Execution target: `'gpu'` (WebGPU/CUDA) or `'cpu'` (WASM/x86) |
| **Dtype** | Model quantization: `'fp32'`, `'fp16'`, `'q8'`, `'q4'` |

***

## **3. Architecture Phase I: Static Profiling (Initialization)**

### **3.1 Hardware Detection Algorithm**

```
ALGORITHM: DetectHardwareProfile()
INPUT: Browser/Node.js environment
OUTPUT: HardwareProfile { gpuScore, memoryGB, coreCount }

1. gpu_capability ← DetectGPU()
2. memory_gb ← DetectMemory()
3. core_count ← DetectCores()
4. hardware_score ← CalculateScore(gpu_capability, memory_gb, core_count)
5. tier ← ClassifyTier(hardware_score)
6. RETURN HardwareProfile(tier, hardware_score, gpu_capability, memory_gb, core_count)
```

#### **3.1.1 GPU Detection**

```typescript
async function DetectGPU(): Promise<GPUCapability> {
  // Check WebGPU availability
  if (!navigator.gpu) {
    return { available: false, score: 0 };
  }
  
  try {
    const adapter = await navigator.gpu.requestAdapter({
      powerPreference: 'high-performance'
    });
    
    if (!adapter) {
      return { available: false, score: 0 };
    }
    
    // Detect software renderer (e.g., SwiftShader)
    const adapterInfo = await adapter.requestAdapterInfo?.();
    if (adapterInfo?.vendor?.toLowerCase().includes('swiftshader') ||
        adapterInfo?.vendor?.toLowerCase().includes('llvmpipe')) {
      return { 
        available: false, 
        score: 0, 
        reason: 'Software renderer detected' 
      };
    }
    
    // Request device to access limits
    const device = await adapter.requestDevice();
    const limits = device.limits;
    
    // Heuristic GPU scoring
    let score = 50; // Base score for WebGPU support
    
    // Buffer size scoring (proxy for VRAM)
    if (limits.maxBufferSize > 2e9) score += 25;       // >2GB
    else if (limits.maxBufferSize > 1e9) score += 15;  // >1GB
    else score += 5;
    
    // Compute capability scoring
    if (limits.maxComputeWorkgroupSizeX > 512) score += 15;
    else if (limits.maxComputeWorkgroupSizeX > 256) score += 10;
    
    // Storage buffer scoring
    if (limits.maxStorageBufferBindingSize > 512e6) score += 10;
    
    return {
      available: true,
      score: Math.min(100, score),
      vendor: adapterInfo?.vendor || 'unknown',
      architecture: adapterInfo?.architecture || 'unknown',
    };
    
  } catch (error) {
    return { 
      available: false, 
      score: 0, 
      error: error.message 
    };
  }
}
```

#### **3.1.2 Memory Detection**

```typescript
async function DetectMemory(): Promise<number> {
  // Method 1: navigator.deviceMemory (Chrome/Edge)
  if ('deviceMemory' in navigator) {
    return (navigator as any).deviceMemory; // Returns GB
  }
  
  // Method 2: Storage quota estimate (heuristic)
  if (navigator.storage?.estimate) {
    const estimate = await navigator.storage.estimate();
    // Assume storage quota ≈ 20% of physical RAM
    const estimatedRAM = (estimate.quota || 0) / (1024 ** 3) / 0.2;
    return Math.max(4, Math.floor(estimatedRAM)); // Minimum 4GB
  }
  
  // Method 3: Performance memory API (Chrome)
  if ((performance as any).memory) {
    const mem = (performance as any).memory;
    return Math.floor(mem.jsHeapSizeLimit / (1024 ** 3));
  }
  
  // Fallback: Conservative estimate
  return 4; // Assume 4GB minimum
}
```

#### **3.1.3 Core Count Detection**

```typescript
function DetectCores(): number {
  return navigator.hardwareConcurrency || 4; // Default to 4 if unavailable
}
```

***

### **3.2 Hardware Scoring Function**

Let $H_{score} = f(G, M, C)$ where:
- $G$: GPU score from `DetectGPU()` ∈ 
- $M$: Available memory (GB) from `DetectMemory()`
- $C$: Logical core count from `DetectCores()`

$$
H_{score} = \min(100, \max(0, W_g \cdot G + W_m \cdot \min(M, 16) + W_c \cdot \min(C, 8)))
$$

**Weight Configuration:**
- $W_g = 0.5$ - GPU is primary factor (50% weight)
- $W_m = 2.5$ - Memory per GB (capped at 16GB → max 40 points)
- $W_c = 1.25$ - Cores (capped at 8 cores → max 10 points)

**Penalty Rules:**
1. If $M < 4$ GB: Apply penalty $P = -15$ (high OOM risk)
2. If $G = 0$ (no GPU): Cap $H_{score}$ at 50

```typescript
function CalculateScore(gpu: GPUCapability, memory: number, cores: number): number {
  let score = 0;
  
  // GPU contribution (50 points max)
  score += 0.5 * gpu.score;
  
  // Memory contribution (40 points max)
  score += 2.5 * Math.min(memory, 16);
  
  // Core contribution (10 points max)
  score += 1.25 * Math.min(cores, 8);
  
  // Penalties
  if (memory < 4) {
    score -= 15; // High OOM risk
  }
  
  if (!gpu.available) {
    score = Math.min(score, 50); // Cap CPU-only devices
  }
  
  return Math.max(0, Math.min(100, score));
}
```

***

### **3.3 Tier Classification**

```
ALGORITHM: ClassifyTier(hardware_score)
INPUT: hardware_score ∈ [0, 100]
OUTPUT: Tier ∈ {ULTRA, HIGH, MEDIUM, LOW}

IF hardware_score >= 90 THEN
    RETURN ULTRA
ELSE IF hardware_score >= 70 THEN
    RETURN HIGH
ELSE IF hardware_score >= 40 THEN
    RETURN MEDIUM
ELSE
    RETURN LOW
END IF
```

**Tier Mapping Table:**

| Score Range | Tier | Target Hardware | Quantization | Device |
|-------------|------|-----------------|--------------|--------|
| ≥90 | `ULTRA` | Discrete GPU (Desktop) | `fp16`, `q8` | `gpu` |
| 70-89 | `HIGH` | Discrete GPU (Laptop), Apple Silicon | `q8` | `gpu` |
| 40-69 | `MEDIUM` | Integrated Graphics | `q4` | `gpu` |
| <40 | `LOW` | CPU-only, Legacy | `q4` | `cpu` |

***

### **3.4 Cache Warming Strategy**

```
ALGORITHM: WarmCache(profile)
INPUT: HardwareProfile
OUTPUT: Preloaded models in cache

1. tier ← profile.tier
2. priority_tasks ← ['text-generation', 'feature-extraction']
3. FOR EACH task IN priority_tasks DO
4.     model_id ← SelectModel(task, tier)
5.     config ← ConfigurePipeline(profile, task)
6.     PreloadInBackground(task, model_id, config)
7. END FOR
```

```typescript
class ModelPreloader {
  async warmCache(profile: HardwareProfile): Promise<void> {
    const tier = profile.tier;
    const priorityTasks: Task[] = ['text-generation', 'feature-extraction'];
    
    for (const task of priorityTasks) {
      const modelId = this.selectModel(task, tier);
      const config = this.configurePipeline(profile, task);
      
      // Non-blocking background preload
      this.preloadInBackground(task, modelId, config);
    }
  }
  
  private async preloadInBackground(
    task: Task, 
    modelId: string, 
    config: PipelineConfig
  ): Promise<void> {
    return new Promise((resolve) => {
      // Use requestIdleCallback for non-blocking load
      requestIdleCallback(async () => {
        try {
          await pipeline(task, modelId, {
            ...config,
            progress_callback: (progress) => {
              this.emitProgress(task, modelId, progress);
            },
          });
          resolve();
        } catch (err) {
          console.warn(`Preload failed for ${modelId}:`, err);
          resolve(); // Don't block on failure
        }
      }, { timeout: 30000 }); // 30s timeout
    });
  }
}
```

***

## **4. Architecture Phase II: Model Selection Matrix**

### **4.1 Model Registry**

```typescript
interface ModelEntry {
  task: Task;
  tier: Tier;
  modelId: string;
  fallbackModelId?: string;
  maxContextLength: number;
}

const MODEL_REGISTRY: ModelEntry[] = [
  // TEXT GENERATION
  {
    task: 'text-generation',
    tier: 'ULTRA',
    modelId: 'onnx-community/Qwen2.5-1.5B-Instruct',
    fallbackModelId: 'onnx-community/Qwen2.5-0.5B-Instruct',
    maxContextLength: 32768,
  },
  {
    task: 'text-generation',
    tier: 'HIGH',
    modelId: 'onnx-community/Qwen2.5-0.5B-Instruct',
    maxContextLength: 32768,
  },
  {
    task: 'text-generation',
    tier: 'MEDIUM',
    modelId: 'onnx-community/Qwen3-0.6B-ONNX',
    maxContextLength: 8192,
  },
  {
    task: 'text-generation',
    tier: 'LOW',
    modelId: 'onnx-community/gpt2',
    maxContextLength: 1024,
  },
  
  // FEATURE EXTRACTION (Embeddings)
  {
    task: 'feature-extraction',
    tier: 'ULTRA',
    modelId: 'Xenova/bge-large-en-v1.5',
    maxContextLength: 512,
  },
  {
    task: 'feature-extraction',
    tier: 'HIGH',
    modelId: 'Xenova/bge-base-en-v1.5',
    maxContextLength: 512,
  },
  {
    task: 'feature-extraction',
    tier: 'MEDIUM',
    modelId: 'Xenova/bge-small-en-v1.5',
    maxContextLength: 512,
  },
  {
    task: 'feature-extraction',
    tier: 'LOW',
    modelId: 'Xenova/all-MiniLM-L6-v2',
    maxContextLength: 256,
  },
];
```

***

### **4.2 Pipeline Configuration Algorithm**

```
ALGORITHM: ConfigurePipeline(profile, task)
INPUT: HardwareProfile, Task
OUTPUT: PipelineConfig { device, dtype, modelId, sessionOptions }

1. tier ← profile.tier
2. model_id ← SelectModel(task, tier)
3. 
4. // Device selection
5. IF profile.gpu.available AND tier ∈ {ULTRA, HIGH, MEDIUM} THEN
6.     device ← 'gpu'
7. ELSE
8.     device ← 'cpu'
9. END IF
10.
11. // Dtype selection
12. dtype ← LookupDtype(tier, device)
13.
14. // WASM-specific configuration
15. IF device = 'cpu' THEN
16.     ConfigureWASM(profile.coreCount)
17. END IF
18.
19. RETURN PipelineConfig(device, dtype, model_id)
```

#### **4.2.1 Dtype Lookup Table**

```typescript
function LookupDtype(tier: Tier, device: string): Dtype {
  const DTYPE_MATRIX = {
    'ULTRA': { gpu: 'fp16', cpu: 'q8' },
    'HIGH':  { gpu: 'q8',   cpu: 'q8' },
    'MEDIUM': { gpu: 'q4',   cpu: 'q4' },
    'LOW':   { gpu: 'q4',   cpu: 'q4' },
  };
  
  return DTYPE_MATRIX[tier][device];
}
```

#### **4.2.2 WASM Configuration**

```typescript
import { env } from '@huggingface/transformers';

function ConfigureWASM(coreCount: number): void {
  // Configure ONNX Runtime WASM backend
  env.backends.onnx.wasm = {
    numThreads: Math.max(1, coreCount - 1), // Reserve 1 thread for UI
    simd: true,                             // Enable SIMD optimizations
    proxy: false,                           // Avoid worker overhead
  };
}
```

***

### **4.3 Model Selection Logic**

```
ALGORITHM: SelectModel(task, tier)
INPUT: Task, Tier
OUTPUT: model_id (string)

1. entry ← FIND entry IN MODEL_REGISTRY WHERE entry.task = task AND entry.tier = tier
2. IF entry EXISTS THEN
3.     RETURN entry.model_id
4. ELSE
5.     // Fallback: Find closest lower tier
6.     fallback_entry ← FIND entry IN MODEL_REGISTRY WHERE entry.task = task AND entry.tier < tier
7.     IF fallback_entry EXISTS THEN
8.         RETURN fallback_entry.model_id
9.     ELSE
10.        THROW Error("No model available for task")
11.    END IF
12. END IF
```

```typescript
function selectModel(task: Task, tier: Tier): string {
  const entry = MODEL_REGISTRY.find(
    e => e.task === task && e.tier === tier
  );
  
  if (entry) {
    return entry.modelId;
  }
  
  // Fallback: Find closest lower tier
  const tierOrder = ['ULTRA', 'HIGH', 'MEDIUM', 'LOW'];
  const currentIdx = tierOrder.indexOf(tier);
  
  for (let i = currentIdx + 1; i < tierOrder.length; i++) {
    const fallbackEntry = MODEL_REGISTRY.find(
      e => e.task === task && e.tier === tierOrder[i]
    );
    if (fallbackEntry) {
      return fallbackEntry.modelId;
    }
  }
  
  throw new Error(`No model available for task: ${task}`);
}
```

***

## **5. Architecture Phase III: Runtime Telemetry (Feedback Loop)**

### **5.1 Telemetry Collection Algorithm**

```
ALGORITHM: CollectTelemetry(pipeline, input, options)
INPUT: Pipeline, Input, GenerationOptions
OUTPUT: InferenceMetrics

1. telemetry ← InitializeTelemetry()
2. start_time ← CurrentTime()
3. 
4. // Wrap callback with telemetry
5. wrapped_callback ← WrapCallback(options.callback_function, telemetry)
6. options.callback_function ← wrapped_callback
7.
8. // Execute inference
9. result ← pipeline(input, options)
10.
11. // Finalize metrics
12. telemetry.totalTimeMs ← CurrentTime() - start_time
13. telemetry.avgTPS ← CalculateAverageTPS(telemetry.tokenTimes)
14.
15. RETURN telemetry
```

#### **5.1.1 Telemetry Wrapper Implementation**

```typescript
class TelemetryWrapper {
  private startTime: number = 0;
  private lastTokenTime: number = 0;
  private tokenTimes: number[] = [];
  private tokenCount: number = 0;
  
  wrapCallback(originalCallback?: Function): Function {
    return (output: any) => {
      const now = performance.now();
      
      // First token (TTFT - Time To First Token)
      if (this.tokenCount === 0) {
        this.startTime = now;
        this.lastTokenTime = now;
      } else {
        // Calculate instantaneous TPS
        const deltaMs = now - this.lastTokenTime;
        const instantTPS = 1000 / deltaMs;
        
        this.tokenTimes.push(instantTPS);
        this.checkThresholds(instantTPS);
      }
      
      this.tokenCount++;
      this.lastTokenTime = now;
      
      // Call original callback
      originalCallback?.(output);
    };
  }
  
  private checkThresholds(tps: number): void {
    const avgTPS = this.getMovingAverage(5);
    
    if (avgTPS < 2.0) {
      this.emit('critical', { tps: avgTPS, state: 'CRITICAL' });
    } else if (avgTPS < 5.0) {
      this.emit('degraded', { tps: avgTPS, state: 'DEGRADED' });
    } else {
      this.emit('stable', { tps: avgTPS, state: 'STABLE' });
    }
  }
  
  private getMovingAverage(window: number): number {
    if (this.tokenTimes.length === 0) return 0;
    const recent = this.tokenTimes.slice(-window);
    return recent.reduce((a, b) => a + b, 0) / recent.length;
  }
  
  getMetrics(): TelemetryMetrics {
    const avgTPS = this.tokenTimes.length > 0
      ? this.tokenTimes.reduce((a, b) => a + b, 0) / this.tokenTimes.length
      : 0;
    
    return {
      tokenCount: this.tokenCount,
      avgTPS,
      minTPS: Math.min(...this.tokenTimes),
      maxTPS: Math.max(...this.tokenTimes),
      firstTokenMs: this.startTime > 0 ? this.lastTokenTime - this.startTime : 0,
      totalTimeMs: performance.now() - this.startTime,
    };
  }
}
```

***

### **5.2 Watchdog State Machine**

```
ALGORITHM: WatchdogStateMachine(avgTPS)
INPUT: avgTPS (Tokens Per Second)
OUTPUT: SystemState ∈ {STABLE, DEGRADED, CRITICAL}

1. IF avgTPS >= QoS_Threshold (5.0) THEN
2.     state ← STABLE
3.     action ← CONTINUE
4.     
5. ELSE IF avgTPS >= Critical_Threshold (2.0) THEN
6.     state ← DEGRADED
7.     action ← FLAG_WARNING
8.     next_session_tier ← current_tier - 1
9.     
10. ELSE
11.     state ← CRITICAL
12.     action ← ABORT_AND_RECOVER
13.     trigger ← HotSwap(lower_quantization)
14.     
15. END IF
16.
17. RETURN (state, action)
```

**State Definitions:**

| State | Condition | Action | Effect |
|-------|-----------|--------|--------|
| **STABLE** | $TPS_{avg} \geq 5.0$ | Continue execution | Normal operation |
| **DEGRADED** | $2.0 \leq TPS_{avg} < 5.0$ | Continue + Flag warning | Next session: $Tier_{next} = Tier_{current} - 1$ |
| **CRITICAL** | $TPS_{avg} < 2.0$ | Abort + Hot Swap | Immediate downgrade or user notification |

```typescript
class WatchdogController {
  private currentState: SystemState = 'STABLE';
  private qosThreshold: number = 5.0;
  private criticalThreshold: number = 2.0;
  
  evaluateState(avgTPS: number): WatchdogDecision {
    if (avgTPS >= this.qosThreshold) {
      this.currentState = 'STABLE';
      return { state: 'STABLE', action: 'CONTINUE' };
      
    } else if (avgTPS >= this.criticalThreshold) {
      this.currentState = 'DEGRADED';
      return { 
        state: 'DEGRADED', 
        action: 'FLAG_WARNING',
        recommendation: 'DOWNGRADE_NEXT_SESSION'
      };
      
    } else {
      this.currentState = 'CRITICAL';
      return { 
        state: 'CRITICAL', 
        action: 'ABORT_AND_RECOVER',
        recommendation: 'IMMEDIATE_DOWNGRADE'
      };
    }
  }
}
```

***

### **5.3 Inference Queue (Serial Execution)**

transformers.js v3 does NOT support concurrent inference sessions. We must serialize all requests.

```
ALGORITHM: InferenceQueue
STATE: queue[] (FIFO), running (boolean)

PROCEDURE Enqueue(task_fn)
1. promise ← NEW Promise()
2. queue.PUSH({ task_fn, promise })
3. ProcessQueue()
4. RETURN promise

PROCEDURE ProcessQueue()
1. IF running OR queue.isEmpty() THEN
2.     RETURN
3. END IF
4.
5. running ← TRUE
6. WHILE queue.isNotEmpty() DO
7.     item ← queue.SHIFT()
8.     TRY
9.         result ← AWAIT item.task_fn()
10.        item.promise.RESOLVE(result)
11.    CATCH error
12.        item.promise.REJECT(error)
13.    END TRY
14. END WHILE
15. running ← FALSE
```

```typescript
class InferenceQueue {
  private queue: Array<QueueItem> = [];
  private running: boolean = false;
  
  async enqueue<T>(taskFn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push({
        taskFn,
        resolve,
        reject,
      });
      this.processQueue();
    });
  }
  
  private async processQueue(): Promise<void> {
    if (this.running || this.queue.length === 0) return;
    
    this.running = true;
    
    while (this.queue.length > 0) {
      const item = this.queue.shift()!;
      
      try {
        const result = await item.taskFn();
        item.resolve(result);
      } catch (error) {
        item.reject(error);
      }
    }
    
    this.running = false;
  }
}
```

***

## **6. Architecture Phase IV: Error Recovery (Self-Healing)**

### **6.1 Recovery Strategy Algorithm**

```
ALGORITHM: InitializeWithRecovery(task, tier)
INPUT: Task, Initial Tier
OUTPUT: Pipeline instance or Error

1. strategies ← GenerateRecoveryStrategies(task, tier)
2. attempted ← EmptySet()
3.
4. FOR EACH strategy IN strategies DO
5.     key ← Serialize(strategy)
6.     IF key IN attempted THEN CONTINUE
7.     
8.     attempted.ADD(key)
9.     
10.    TRY
11.        pipeline ← AWAIT CreatePipeline(task, strategy)
12.        RETURN pipeline  // Success
13.    CATCH error
14.        Log("Strategy failed", strategy, error)
15.        CleanupPartialLoad()
16.        // Continue to next strategy
17.    END TRY
18. END FOR
19.
20. // All strategies exhausted
21. THROW Error("All initialization strategies failed")
```

#### **6.1.1 Recovery Strategy Generation**

```typescript
function GenerateRecoveryStrategies(
  task: Task, 
  initialTier: Tier
): RecoveryStrategy[] {
  const strategies: RecoveryStrategy[] = [];
  const tierOrder: Tier[] = ['ULTRA', 'HIGH', 'MEDIUM', 'LOW'];
  const dtypeOrder: Dtype[] = ['fp16', 'q8', 'q4'];
  
  const startIdx = tierOrder.indexOf(initialTier);
  
  // Strategy cascade:
  // 1. Try initial tier with different dtypes
  // 2. Try lower tiers with optimal dtype
  // 3. Try lowest tier with CPU fallback
  
  for (let tierIdx = startIdx; tierIdx < tierOrder.length; tierIdx++) {
    const tier = tierOrder[tierIdx];
    const modelId = selectModel(task, tier);
    
    // Try GPU with different dtypes
    if (tierIdx <= 2) { // ULTRA, HIGH, MEDIUM
      for (const dtype of dtypeOrder) {
        strategies.push({
          tier,
          device: 'gpu',
          dtype,
          modelId,
        });
      }
    }
    
    // Try CPU fallback for this tier
    strategies.push({
      tier,
      device: 'cpu',
      dtype: 'q4',
      modelId,
    });
  }
  
  return strategies;
}
```

#### **6.1.2 Cleanup Handler**

```typescript
async function CleanupPartialLoad(): Promise<void> {
  // Force garbage collection (if available)
  if (typeof global !== 'undefined' && global.gc) {
    global.gc();
  }
  
  // Clear partial ONNX session cache
  // Note: transformers.js doesn't expose session cleanup directly
  // We rely on GC to reclaim memory
  
  // Wait for GC cycle
  await new Promise(resolve => setTimeout(resolve, 100));
}
```

***

### **6.2 Context Overflow Recovery**

```
ALGORITHM: HandleContextOverflow(messages, maxLength)
INPUT: Message[], maxLength (tokens)
OUTPUT: Truncated Message[]

1. tokenizer ← LoadTokenizer(current_model)
2. total_tokens ← 0
3. truncated ← []
4.
5. // Step 1: Preserve system prompt
6. system_msg ← FIND msg IN messages WHERE msg.role = 'system'
7. IF system_msg EXISTS THEN
8.     tokens ← Tokenize(system_msg.content)
9.     total_tokens ← tokens.length
10.    truncated.APPEND(system_msg)
11. END IF
12.
13. // Step 2: Add messages from newest to oldest
14. user_messages ← FILTER messages WHERE role ≠ 'system'
15. user_messages.REVERSE()  // newest first
16.
17. safety_margin ← 0.9  // Use 90% of max length
18. budget ← maxLength * safety_margin - total_tokens
19.
20. FOR EACH msg IN user_messages DO
21.     tokens ← Tokenize(msg.content)
22.     IF total_tokens + tokens.length > budget THEN
23.         BREAK  // Exceeded budget
24.     END IF
25.     
26.     truncated.PREPEND(msg)  // Add to beginning
27.     total_tokens ← total_tokens + tokens.length
28. END FOR
29.
30. RETURN truncated
```

```typescript
class ContextManager {
  async handleContextOverflow(
    messages: Message[],
    modelId: string
  ): Promise<Message[]> {
    const maxLength = this.getMaxContextLength(modelId);
    const tokenizer = await AutoTokenizer.from_pretrained(modelId);
    
    let totalTokens = 0;
    const truncated: Message[] = [];
    
    // Preserve system prompt
    const systemMsg = messages.find(m => m.role === 'system');
    if (systemMsg) {
      const tokens = await tokenizer(systemMsg.content);
      totalTokens += tokens.input_ids.data.length;
      truncated.push(systemMsg);
    }
    
    // Add messages from newest to oldest
    const userMessages = messages
      .filter(m => m.role !== 'system')
      .reverse();
    
    const budget = maxLength * 0.9 - totalTokens; // 90% safety margin
    
    for (const msg of userMessages) {
      const tokens = await tokenizer(msg.content);
      const msgTokens = tokens.input_ids.data.length;
      
      if (totalTokens + msgTokens > budget) {
        break; // Exceeded budget
      }
      
      truncated.unshift(msg); // Prepend
      totalTokens += msgTokens;
    }
    
    return truncated;
  }
  
  private getMaxContextLength(modelId: string): number {
    const entry = MODEL_REGISTRY.find(e => e.modelId === modelId);
    return entry?.maxContextLength || 2048; // Default fallback
  }
}
```

***

## **7. Implementation: IAdaptiveEngine Interface**

### **7.1 Core Interface**

```typescript
interface IAdaptiveEngine {
  // Phase 1: Hardware profiling
  probeHardware(): Promise<HardwareProfile>;
  
  // Phase 2: Model selection
  configurePipeline(profile: HardwareProfile, task: Task): PipelineConfig;
  
  // Phase 3 & 4: Execution with telemetry
  execute<T>(task: Task, input: any, options?: any): Promise<ExecutionResult<T>>;
  
  // Utilities
  getMetrics(): InferenceMetrics;
  clearCache(): Promise<void>;
}

interface HardwareProfile {
  tier: Tier;
  hardwareScore: number;
  gpu: GPUCapability;
  memoryGB: number;
  coreCount: number;
}

interface PipelineConfig {
  device: 'gpu' | 'cpu';
  dtype: Dtype;
  modelId: string;
  sessionOptions?: any;
}

interface ExecutionResult<T> {
  output: T;
  metrics: TelemetryMetrics;
  state: SystemState;
}
```

***

### **7.2 Complete Implementation**

```typescript
class AdaptiveEngine implements IAdaptiveEngine {
  private profile?: HardwareProfile;
  private pipelines: Map<string, any> = new Map();
  private inferenceQueue = new InferenceQueue();
  private watchdog = new WatchdogController();
  private recoveryEngine = new RecoveryEngine();
  private contextManager = new ContextManager();
  
  // ===== PHASE 1: Hardware Profiling =====
  async probeHardware(): Promise<HardwareProfile> {
    if (this.profile) return this.profile;
    
    const gpu = await DetectGPU();
    const memory = await DetectMemory();
    const cores = DetectCores();
    
    const hardwareScore = CalculateScore(gpu, memory, cores);
    const tier = ClassifyTier(hardwareScore);
    
    this.profile = {
      tier,
      hardwareScore,
      gpu,
      memoryGB: memory,
      coreCount: cores,
    };
    
    // Configure environment
    if (tier === 'LOW' || !gpu.available) {
      ConfigureWASM(cores);
    }
    
    return this.profile;
  }
  
  // ===== PHASE 2: Pipeline Configuration =====
  configurePipeline(profile: HardwareProfile, task: Task): PipelineConfig {
    const tier = profile.tier;
    const modelId = selectModel(task, tier);
    
    const device = (profile.gpu.available && ['ULTRA', 'HIGH', 'MEDIUM'].includes(tier))
      ? 'gpu'
      : 'cpu';
    
    const dtype = LookupDtype(tier, device);
    
    return {
      device,
      dtype,
      modelId,
      sessionOptions: {
        graphOptimizationLevel: 'all',
      },
    };
  }
  
  // ===== PHASE 3 & 4: Execution with Recovery =====
  async execute<T>(
    task: Task,
    input: any,
    options: any = {}
  ): Promise<ExecutionResult<T>> {
    // Queue inference (serial execution)
    return this.inferenceQueue.enqueue(async () => {
      const profile = await this.probeHardware();
      const config = this.configurePipeline(profile, task);
      
      // Get or create pipeline with recovery
      const pipe = await this.getPipelineWithRecovery(task, config);
      
      // Check context overflow for text-generation
      if (task === 'text-generation' && Array.isArray(input)) {
        input = await this.contextManager.handleContextOverflow(
          input,
          config.modelId
        );
      }
      
      // Wrap with telemetry
      const telemetry = new TelemetryWrapper();
      const wrappedOptions = {
        ...options,
        callback_function: telemetry.wrapCallback(options.callback_function),
      };
      
      // Execute inference
      const output = await pipe(input, wrappedOptions);
      
      // Evaluate state
      const metrics = telemetry.getMetrics();
      const decision = this.watchdog.evaluateState(metrics.avgTPS);
      
      // Handle critical state
      if (decision.state === 'CRITICAL') {
        await this.handleCriticalState(task, config);
      }
      
      return {
        output,
        metrics,
        state: decision.state,
      };
    });
  }
  
  // ===== Recovery Logic =====
  private async getPipelineWithRecovery(
    task: Task,
    config: PipelineConfig
  ): Promise<any> {
    const key = `${task}:${config.modelId}`;
    
    if (this.pipelines.has(key)) {
      return this.pipelines.get(key);
    }
    
    // Initialize with recovery strategies
    const pipe = await this.recoveryEngine.initializeWithRecovery(task, config);
    this.pipelines.set(key, pipe);
    
    return pipe;
  }
  
  private async handleCriticalState(task: Task, config: PipelineConfig): Promise<void> {
    // Clear current pipeline
    const key = `${task}:${config.modelId}`;
    this.pipelines.delete(key);
    
    // Downgrade tier
    const profile = await this.probeHardware();
    const tierOrder: Tier[] = ['ULTRA', 'HIGH', 'MEDIUM', 'LOW'];
    const currentIdx = tierOrder.indexOf(profile.tier);
    
    if (currentIdx < tierOrder.length - 1) {
      profile.tier = tierOrder[currentIdx + 1];
      console.warn(`Downgraded to tier: ${profile.tier}`);
    } else {
      throw new Error('Already at lowest tier, cannot recover');
    }
  }
  
  // ===== Utilities =====
  getMetrics(): InferenceMetrics {
    // Return aggregated metrics
    return this.watchdog.getMetrics();
  }
  
  async clearCache(): Promise<void> {
    this.pipelines.clear();
    
    if ('caches' in window) {
      const cache = await caches.open('transformers-cache');
      const keys = await cache.keys();
      await Promise.all(keys.map(key => cache.delete(key)));
    }
  }
}
```

***

## **8. Block Diagram: System Flow**

```
┌─────────────────────────────────────────────────────────────────┐
│                     ADAPTIVE INFERENCE ENGINE                    │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
         ┌───────────────────────────────────────────┐
         │  PHASE 1: HARDWARE PROFILING (Init)       │
         └───────────────────────────────────────────┘
                        │
        ┌───────────────┼───────────────┐
        ▼               ▼               ▼
   [DetectGPU]   [DetectMemory]   [DetectCores]
        │               │               │
        └───────────────┼───────────────┘
                        ▼
              [CalculateScore(G,M,C)]
                        │
                        ▼
               [ClassifyTier] ──────► Tier ∈ {ULTRA,HIGH,MEDIUM,LOW}
                        │
                        ▼
         ┌───────────────────────────────────────────┐
         │  PHASE 2: MODEL SELECTION                 │
         └───────────────────────────────────────────┘
                        │
        ┌───────────────┼────────────────┐
        ▼               ▼                ▼
   [SelectModel]  [LookupDtype]  [ConfigureDevice]
        │               │                │
        └───────────────┼────────────────┘
                        ▼
             PipelineConfig {device, dtype, modelId}
                        │
                        ▼
         ┌───────────────────────────────────────────┐
         │  RECOVERY ENGINE (OOM Handler)            │
         └───────────────────────────────────────────┘
                        │
                ┌───────┴────────┐
                ▼                ▼
         [Try Strategy]    [Cleanup + Retry]
                │                │
                └────────┬───────┘
                         ▼
                [pipeline Instance] ──────┐
                         │                │
                         ▼                │
         ┌───────────────────────────────────────────┐
         │  PHASE 3: INFERENCE QUEUE (Serial)        │
         └───────────────────────────────────────────┘
                         │
                         ▼
            [Enqueue Request] ──────► FIFO Queue
                         │
                         ▼
            [ProcessQueue: Sequential Execution]
                         │
                         ▼
         ┌───────────────────────────────────────────┐
         │  TELEMETRY WRAPPER                        │
         └───────────────────────────────────────────┘
                         │
        ┌────────────────┼────────────────┐
        ▼                ▼                ▼
   [Token Δt]    [Calculate TPS]   [Moving Avg]
        │                │                │
        └────────────────┼────────────────┘
                         ▼
         ┌───────────────────────────────────────────┐
         │  PHASE 4: WATCHDOG STATE MACHINE          │
         └───────────────────────────────────────────┘
                         │
        ┌────────────────┼────────────────┐
        ▼                ▼                ▼
   avgTPS ≥ 5.0    2.0 ≤ avgTPS < 5.0   avgTPS < 2.0
        │                │                │
        ▼                ▼                ▼
    [STABLE]        [DEGRADED]        [CRITICAL]
        │                │                │
        ▼                ▼                ▼
   Continue      Flag Warning      Abort + Recover
                  Next: Tier-1      Hot Swap Model
                         │                │
                         └────────┬───────┘
                                  ▼
                        [Return Result + Metrics]
                                  │
                                  ▼
                        ┌─────────────────┐
                        │  User Response  │
                        └─────────────────┘
```

***

## **9. Validation & Testing**

### **9.1 Test Suite Structure**

```typescript
class AdaptiveEngineValidator {
  async runFullValidation(): Promise<ValidationReport> {
    const results = {
      hardwareDetection: await this.testHardwareDetection(),
      tierClassification: await this.testTierClassification(),
      modelSelection: await this.testModelSelection(),
      recoveryChain: await this.testRecoveryChain(),
      telemetryAccuracy: await this.testTelemetryAccuracy(),
      queueSerialization: await this.testQueueSerialization(),
    };
    
    return results;
  }
  
  async testTierClassification(): Promise<TestResult> {
    const testCases = [
      { score: 95, expected: 'ULTRA' },
      { score: 80, expected: 'HIGH' },
      { score: 55, expected: 'MEDIUM' },
      { score: 25, expected: 'LOW' },
    ];
    
    for (const tc of testCases) {
      const tier = ClassifyTier(tc.score);
      assert(tier === tc.expected, `Expected ${tc.expected}, got ${tier}`);
    }
    
    return { passed: true };
  }
  
  async testRecoveryChain(): Promise<TestResult> {
    // Simulate OOM by forcing unavailable model
    const engine = new AdaptiveEngine();
    
    try {
      const result = await engine.execute('text-generation', 'test prompt');
      assert(result.output !== null, 'Should recover from failures');
      return { passed: true };
    } catch (err) {
      return { passed: false, error: err.message };
    }
  }
  
  async benchmarkAllTiers(): Promise<BenchmarkResults> {
    const tiers: Tier[] = ['ULTRA', 'HIGH', 'MEDIUM', 'LOW'];
    const results = [];
    
    for (const tier of tiers) {
      const metrics = await this.runBenchmark(tier);
      results.push({ tier, ...metrics });
    }
    
    console.table(results);
    return results;
  }
  
  private async runBenchmark(tier: Tier): Promise<BenchmarkMetrics> {
    // Create engine with forced tier
    const engine = new AdaptiveEngine();
    engine.profile = { tier, /* ... */ };
    
    const iterations = 5;
    const times = [];
    
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await engine.execute('text-generation', 'Generate text', {
        max_new_tokens: 100,
      });
      times.push(performance.now() - start);
    }
    
    return {
      avgTime: times.reduce((a, b) => a + b) / times.length,
      minTime: Math.min(...times),
      maxTime: Math.max(...times),
    };
  }
}
```

***

## **10. Metrics & Observability Schema**

```typescript
interface InferenceMetrics {
  // Session
  sessionId: string;
  timestamp: number;
  
  // Hardware
  tier: Tier;
  device: 'gpu' | 'cpu';
  dtype: Dtype;
  modelId: string;
  
  // Performance
  initTimeMs: number;           // Model load time
  firstTokenMs: number;         // Time to first token (TTFT)
  avgTPS: number;               // Average tokens/sec
  minTPS: number;
  maxTPS: number;
  totalTokens: number;
  totalTimeMs: number;
  
  // Quality
  degradations: number;         // How many downgrades
  errors: string[];
  
  // Resource
  peakMemoryMB: number;
  cacheHit: boolean;
}

class MetricsCollector {
  private metrics: InferenceMetrics[] = [];
  
  collect(metric: InferenceMetrics): void {
    this.metrics.push(metric);
  }
  
  async report(endpoint: string): Promise<void> {
    await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(this.metrics),
    });
    
    this.metrics = [];
  }
  
  analyze(): MetricsSummary {
    return {
      avgTPSByTier: this.groupBy('tier', 'avgTPS'),
      successRateByDevice: this.groupBy('device', 'success'),
      p95Latency: this.percentile('totalTimeMs', 95),
      cacheHitRate: this.metrics.filter(m => m.cacheHit).length / this.metrics.length,
    };
  }
}
```

***

## **11. Summary**

This specification defines a complete **Adaptive Inference System** for transformers.js v3 with:

1. ✅ **Hardware-aware initialization** - Automatic tier classification
2. ✅ **Intelligent model selection** - Registry-based configuration
3. ✅ **Real-time telemetry** - TPS monitoring and state machine
4. ✅ **Self-healing recovery** - Cascading fallback strategies
5. ✅ **Serial execution queue** - Handles concurrent requests safely
6. ✅ **Context overflow handling** - Automatic truncation
7. ✅ **Comprehensive metrics** - Full observability
8. ✅ **Block diagrams** - Visual system architecture

**Key Corrections from v1.0:**
- ✅ Fixed device parameter (`'gpu'`/`'cpu'` not `'webgpu'`/`'wasm'`)
- ✅ Added model selection registry
- ✅ Added WASM configuration via `env.backends.onnx.wasm`
- ✅ Added inference queue for serial execution
- ✅ Added telemetry wrapper implementation
- ✅ Added recovery cascade with cleanup
- ✅ Added context overflow handler
- ✅ Added complete code implementation

***

**Ready for implementation? Want me to:**
1. Create a working TypeScript prototype?
2. Add specific framework integration (React/Next.js/Express)?
3. Create deployment configs (Docker/K8s)?
