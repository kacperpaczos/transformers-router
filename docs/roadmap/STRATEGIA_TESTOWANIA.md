# Strategia Testowania (Google Engineering Standard)

**Dokument:** `STRATEGIA_TESTOWANIA.md`
**Status:** Obowiązujący
**Język:** Polski

## Wstęp: Filozofia Jakości

W projekcie `lxrt` stosujemy rygorystyczne podejście do jakości, inspirowane metodologią Google ("Testing at the Toilet", "The Testing Pyramid"). Nie testujemy, "czy kod działa", testujemy, **czy system spełnia kontrakt i dostarcza wartość**, przy zachowaniu stabilności.

Stosujemy **Trójwarstwową Architekturę Testów**, aby zbalansować szybkość dewelopmentu (Velocity) z pewnością działania (Reliability).

---

## Poziom 1: Testy Jednostkowe (Unit Tests)

### 🎯 Cel
Weryfikacja **logiki biznesowej** w całkowitej izolacji od świata zewnętrznego (sieć, dysk, ciężkie modele). Test ma trwać milisekundy.

### 🔍 Scope (Zakres)
*   **Adaptery:** Sprawdzenie, czy `OpenAIAdapter` poprawnie tłumaczy parametry JSON na wywołania wewnętrzne.
*   **Konfiguracja:** Czy `ConfigManager` poprawnie łączy ustawienia domyślne z użytkownika.
*   **Logika pomocnicza:** Parsowanie, formatowanie, obsługa błędów.

### 🛠️ Jak to robimy? (Metodologia)
*   **Mocks & Spies:** Używamy `jest.fn()` i `jest.spyOn()`. Nie ładujemy prawdziwego modelu AI. Symulujemy jego odpowiedź.
*   **Pure Functions:** Testujemy funkcje czyste (wejście -> wyjście).

### 💡 Uzasadnienie (Why?)
"Dlaczego nie testujemy tu prawdziwych modeli?"
Ponieważ testy jednostkowe muszą być **szybkie** i **deterministyczne**. Deweloper musi móc je uruchamiać co minutę. Ładowanie modelu trwa 10s -> to zabiłoby proces twórczy.

---

## Poziom 2: Testy Integracyjne (System Integration)

### 🎯 Cel
Weryfikacja **zdolności (Capabilities)** systemu. Czy "mózg" biblioteki (ONNX Runtime + Modele) faktycznie działa? Czy `STTModel` zamienia dźwięk na tekst?

### 🔍 Scope (Zakres)
*   **Modele:** `LLMModel`, `STTModel`, `TTSModel`, `OCRModel`.
*   **Przepływy (Flows):** STT -> LLM -> TTS (Multimodal Chain).
*   **Zarządzanie zasobami:** Ładowanie/zwalnianie pamięci.

### 🛠️ Jak to robimy? (Metodologia)
*   **Real Models:** Używamy prawdziwych, skwantyzowanych modeli (np. `Xenova/whisper-tiny`).
*   **Real Data (Fixtures):**
    *   Audio: Prawdziwy plik `test.wav` (zamiast losowych bajtów).
    *   Obraz: Prawdziwy plik `test.png`.
*   **Determinizm:** Używamy `FixtureLoader` do ładowania zawsze tych samych danych wejściowych.

### 💡 Uzasadnienie (Why?)
"Dlaczego to jest kluczowe?"
Bo mocki kłamią. Tylko prawdziwy model pokaże, czy biblioteka `transformers.js` jest poprawnie zintegrowana, czy tensory mają dobry kształt (Shape mismatch) i czy ONNX Runtime nie wycieka pamięci.

---

## Poziom 3: Testy E2E (Browser Environment)

### 🎯 Cel
Weryfikacja **uruchamialności** w docelowym środowisku (Przeglądarka Internetowa).

### 🔍 Scope (Zakres)
*   **Build Artifact:** Czy plik `dist/lxrt.js` jest poprawny?
*   **WASM/WebGPU:** Czy przeglądarka potrafi załadować binarkę WASM `onnxruntime`?
*   **Global Namespace:** Czy `window.lxrt` jest dostępne?

### 🛠️ Jak to robimy? (Metodologia)
*   **Playwright:** Automatyzacja prawdziwej przeglądarki Chrome/Firefox.
*   **Smoke Test:** Załaduj stronę -> Inicjalizuj bibliotekę -> Sprawdź czy nie wybuchło.

### 💡 Uzasadnienie (Why?)
Testy Node.js nie wykryją błędów specyficznych dla przeglądarki (np. brak dostępu do `fs`, problemy z CORS przy ładowaniu modelu). To jest nasza ostatnia linia obrony przed wypuszczeniem bubla.

---

## Mapa Plików (Directory Traceability)

| Poziom | Katalog | Przykładowy Test | Komenda |
| :--- | :--- | :--- | :--- |
| **Unit** | `tests/node/unit` | `adapters/openai.unit.test.ts` | `npm run test:node:unit` |
| **Integration** | `tests/node/integration` | `multimodal.flow.test.ts` | `npm run test:node:integration` |
| **E2E** | `tests/browser-e2e` | `smoke.spec.ts` | `npm run test:e2e` |

## Zarządzanie Danymi (Fixtures)

Wszystkie dane testowe znajdują się w `tests/fixtures`.
*   **Zasada:** Żadnych "magicznych stringów" czy pathów w kodzie.
*   **Implementacja:** `FixtureLoader` gwarantuje, że jeśli test potrzebuje `audio`, dostanie poprawny buffer.
