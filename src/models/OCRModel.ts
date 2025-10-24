/**
 * OCR Model for optical character recognition (Tesseract.js)
 */

import type { OCRConfig, OCROptions, OCRResult } from '../core/types';
import { BaseModel } from './BaseModel';
import { ModelLoadError, InferenceError } from '@domain/errors';
import type { BackendSelector } from '../app/backend/BackendSelector';
import {
  resolveTesseractLangs,
  getWhitelistFor,
} from '../utils/ocr/LangRegistry';

// Dynamically import Tesseract.js
let tesseractModule: typeof import('tesseract.js') | null = null;

type FrancAllFn = (
  value: string,
  opts?: { only?: string[]; ignore?: string[]; minLength?: number }
) => Array<[string, number]>;

async function getTesseract() {
  if (!tesseractModule) {
    tesseractModule = await import('tesseract.js');
  }
  return tesseractModule;
}

export class OCRModel extends BaseModel<OCRConfig> {
  private backendSelector?: BackendSelector;
  private worker: any = null;

  constructor(config: OCRConfig, backendSelector?: BackendSelector) {
    super('ocr', config);
    this.backendSelector = backendSelector;
  }

  /**
   * Load the OCR model (initialize Tesseract worker)
   */
  async load(
    _progressCallback?: (progress: {
      status: string;
      file?: string;
      progress?: number;
      loaded?: number;
      total?: number;
    }) => void
  ): Promise<void> {
    if (this.loaded) {
      if (typeof console !== 'undefined' && console.log) {
        console.log('[OCRModel] load(): early-return, already loaded');
      }
      return;
    }

    if (this.loading) {
      if (typeof console !== 'undefined' && console.log) {
        console.log('[OCRModel] load(): waiting for concurrent load');
      }
      while (this.loading) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      if (typeof console !== 'undefined' && console.log) {
        console.log('[OCRModel] load(): concurrent load finished');
      }
      return;
    }

    this.loading = true;

    try {
      const { createWorker } = await getTesseract();
      if (typeof console !== 'undefined' && console.log) {
        console.log('[OCRModel] load(): tesseract loaded');
      }

      // Create Tesseract worker
      this.worker = createWorker();

      // Load the worker
      const worker = this.worker as any;
      await worker.load();

      // Load language data
      const languages = this.config.language || 'eng';
      const langArray = Array.isArray(languages) ? languages : [languages];
      const mapped = resolveTesseractLangs(langArray);
      const langJoined = mapped || langArray.join('+');
      await worker.loadLanguage(langJoined);

      // Initialize the worker with language(s)
      await worker.initialize(langJoined);

      this.loaded = true;
      this.loading = false;

      if (typeof console !== 'undefined' && console.log) {
        console.log('[OCRModel] load(): completed');
      }
    } catch (error) {
      this.loading = false;
      const modelError = new ModelLoadError(
        `Failed to load OCR model: ${error instanceof Error ? error.message : String(error)}`,
        this.config.model || 'tesseract',
        'ocr'
      );
      if (typeof console !== 'undefined' && console.error) {
        console.error('[OCRModel] load(): error', modelError);
      }
      throw modelError;
    }
  }

  /**
   * Recognize text from image
   */
  async recognize(
    image: string | Blob | File | Buffer,
    options: OCROptions = {}
  ): Promise<OCRResult> {
    await this.ensureLoaded();

    try {
      if (!this.worker) {
        throw new InferenceError('OCR worker not initialized', 'ocr');
      }
      const worker = this.worker as any;

      // Set recognition parameters
      if (options.psm !== undefined) {
        await worker.setParameters({
          tessedit_pageseg_mode: options.psm,
        });
      }

      if (options.oem !== undefined) {
        await worker.setParameters({
          tessedit_ocr_engine_mode: options.oem,
        });
      }

      // Determine initial languages
      let usedLanguage: string | undefined;
      if (options.language) {
        const langArray = Array.isArray(options.language)
          ? options.language
          : [options.language];
        const mapped = resolveTesseractLangs(langArray);
        const langJoined = mapped || langArray.join('+');
        await worker.loadLanguage(langJoined);
        await worker.initialize(langJoined);
        usedLanguage = langArray[0];
      }

      // Perform initial OCR
      let { data } = await worker.recognize(image);

      // Optional: auto language detection & re-run with best language
      const shouldAutoDetect =
        (options.autoLanguage ?? !options.language) &&
        (data?.text?.length || 0) > (options.detectionMinTextLength ?? 20);
      let detectedLanguages: Array<{ lang: string; score: number }> | undefined;
      if (shouldAutoDetect) {
        try {
          // Prefer full franc (187+ lang), fallback to franc-min
          let francAll: FrancAllFn | undefined;
          try {
            francAll = (await import('franc'))
              .francAll as unknown as FrancAllFn;
          } catch {
            francAll = (await import('franc-min'))
              .francAll as unknown as FrancAllFn;
          }
          if (!francAll) throw new Error('Language detector unavailable');
          const only =
            options.allowedLanguages && options.allowedLanguages.length > 0
              ? options.allowedLanguages
              : Array.isArray(this.config.language)
                ? this.config.language
                : this.config.language
                  ? [this.config.language]
                  : undefined;

          const ranking = francAll(data.text, {
            minLength: options.detectionMinTextLength ?? 20,
            only,
          });

          const maxCand = Math.max(1, options.detectionMaxCandidates ?? 5);
          detectedLanguages = ranking
            .slice(0, maxCand)
            .map(([lang, score]) => ({ lang, score }));

          // Pick best candidate present in `only` (if provided), otherwise the top one
          const best = detectedLanguages[0]?.lang;
          if (best) {
            // If we didn't explicitly set a single language, or best is not included in current, re-run
            const currentLangs = usedLanguage
              ? [usedLanguage]
              : Array.isArray(this.config.language)
                ? this.config.language
                : this.config.language
                  ? [this.config.language]
                  : ['eng'];

            const alreadyCovers = currentLangs.includes(best);
            if (!alreadyCovers || currentLangs.length > 1) {
              const mappedBest = resolveTesseractLangs([best]) || best;
              await worker.loadLanguage(mappedBest);
              await worker.initialize(mappedBest);
              usedLanguage = best;
              ({ data } = await worker.recognize(image));
            } else {
              usedLanguage = best;
            }
          }
        } catch {
          // If franc-min is not available for some reason, skip auto detection silently
        }
      }

      // Optional heuristics: autoPSM and autoWhitelist
      if (options.autoWhitelist && usedLanguage) {
        const wl = getWhitelistFor(usedLanguage);
        if (wl) {
          try {
            await worker.setParameters({ tessedit_char_whitelist: wl });
          } catch {
            // ignore if unsupported in current build
          }
        }
      }

      if (options.autoPSM) {
        // Very simple heuristic: many short lines => assume single line (7), else default (3)
        const lineCount = data?.lines?.length ?? 0;
        const avgLen = lineCount
          ? data.lines.reduce(
              (s: number, l: { text?: string }) => s + (l.text?.length || 0),
              0
            ) / lineCount
          : data?.text?.length || 0;
        const psm = lineCount > 10 && avgLen < 25 ? 7 : 3;
        try {
          await worker.setParameters({ tessedit_pageseg_mode: psm });
        } catch {
          // ignore if unsupported
        }
      }

      // Build result
      const result: OCRResult = {
        text: data.text,
        confidence: data.confidence,
        usedLanguage,
        detectedLanguages,
      };

      // Add word-level data if requested
      const dataAny = data as any;
      if (options.includeBbox && dataAny.words) {
        result.words = dataAny.words.map(
          (word: {
            text: string;
            bbox: { x0: number; y0: number; x1: number; y1: number };
            confidence: number;
          }) => ({
            text: word.text,
            bbox: {
              x0: word.bbox.x0,
              y0: word.bbox.y0,
              x1: word.bbox.x1,
              y1: word.bbox.y1,
            },
            confidence: word.confidence,
          })
        );
      }

      // Add line-level data if requested
      if (options.includeBbox && dataAny.lines) {
        result.lines = dataAny.lines.map(
          (line: {
            text: string;
            bbox: { x0: number; y0: number; x1: number; y1: number };
            confidence: number;
          }) => ({
            text: line.text,
            bbox: {
              x0: line.bbox.x0,
              y0: line.bbox.y0,
              x1: line.bbox.x1,
              y1: line.bbox.y1,
            },
            confidence: line.confidence,
          })
        );
      }

      return result;
    } catch (error) {
      const inferenceError = new InferenceError(
        `OCR recognition failed: ${error instanceof Error ? error.message : String(error)}`,
        'ocr'
      );
      if (typeof console !== 'undefined' && console.error) {
        console.error('[OCRModel] recognize(): error', inferenceError);
      }
      throw inferenceError;
    }
  }

  /**
   * Unload the model and free resources
   */
  async unload(): Promise<void> {
    if (this.worker) {
      try {
        await this.worker.terminate();
      } catch (error) {
        if (typeof console !== 'undefined' && console.error) {
          console.error('[OCRModel] unload(): error terminating worker', error);
        }
      }
      this.worker = null;
    }

    await super.unload();
  }

  /**
   * Get the underlying worker
   */
  protected getWorker(): any {
    if (!this.worker) {
      throw new InferenceError('OCR worker not loaded', 'ocr');
    }
    return this.worker;
  }
}
