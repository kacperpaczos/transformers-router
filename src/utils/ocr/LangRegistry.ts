/**
 * Unified OCR Language Registry (for Tesseract + franc)
 *
 * Purpose
 * - Provide a single source of truth that bridges language codes returned by franc
 *   (ISO 639-3, e.g. 'eng', 'pol', 'deu') with Tesseract traineddata language codes.
 * - Optionally provide conservative character whitelists per language to improve OCR quality
 *   when auto-whitelisting is enabled.
 *
 * How it works
 * - franc/franc-min return ISO 639-3 codes. We map those to Tesseract codes here.
 * - resolveTesseractLangs([...]) converts an array of ISO 639-3 codes into a Tesseract
 *   "+"-joined string (e.g. "eng+pol") suitable for worker.loadLanguage/initialize.
 * - If a language is NOT present in the registry, we FALL BACK to a 1:1 mapping
 *   (ISO-639-3 → Tesseract code), with no whitelist. This enables broad coverage of
 *   European, popular Asian, and American languages as long as corresponding Tesseract
 *   traineddata files are available.
 *
 * Interaction with OCRModel
 * - OCRModel may detect language with franc(franc-min), then re-run Tesseract using the
 *   best-ranked language. It uses this registry to get the correct Tesseract code.
 * - If autoWhitelist is enabled, OCRModel can call getWhitelistFor(lang) to apply a
 *   conservative character whitelist via tessedit_char_whitelist.
 *
 * Extending the registry
 * - Add entries below for languages where you want stricter control or better defaults
 *   (e.g., Cyrillic, Greek, Arabic, Hebrew, CJK). Each entry can include a minimal
 *   whitelist to reduce false positives for noisy inputs. Keep whitelists conservative.
 * - If you don't add an entry, the fallback keeps things working, relying on Tesseract
 *   using the same ISO-639-3 code.
 *
 * Notes
 * - allowedLanguages passed to OCR should use ISO 639-3 codes to align with franc output.
 * - For maximum language coverage use `franc` (≈187 langs); the code falls back to
 *   `franc-min` when `franc` is unavailable.
 * - Tesseract must have the corresponding traineddata available for the resolved language.
 *
 * Reference
 * - franc: https://github.com/wooorm/franc/tree/main
 */

export interface OcrLanguageInfo {
  iso6393: string; // e.g. 'eng'
  tesseract: string; // e.g. 'eng'
  whitelist?: string; // optional character whitelist (basic)
}

// Minimal curated registry. Extend as needed.
const REGISTRY: Record<string, OcrLanguageInfo> = {
  eng: {
    iso6393: 'eng',
    tesseract: 'eng',
    whitelist:
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'.,:;!?-()[]%$€",
  },
  pol: {
    iso6393: 'pol',
    tesseract: 'pol',
    whitelist:
      "AĄBCĆDEĘFGHIJKLŁMNŃOÓPRSŚTUWXYZŹŻaąbcćdeęfghijklłmnńoóprsśtuwxyzźż0123456789'.,:;!?-()[]%$€",
  },
  deu: {
    iso6393: 'deu',
    tesseract: 'deu',
    whitelist:
      "ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÜabcdefghijklmnopqrstuvwxyzäöüß0123456789'.,:;!?-()[]%$€",
  },
  fra: {
    iso6393: 'fra',
    tesseract: 'fra',
    whitelist:
      "ABCDEFGHIJKLMNOPQRSTUVWXYZÀÂÄÇÉÈÊËÎÏÔÖÙÛÜŸabcdefghijklmnopqrstuvwxyzàâäçéèêëîïôöùûüÿ0123456789'.,:;!?-()[]%$€",
  },
  ita: {
    iso6393: 'ita',
    tesseract: 'ita',
    whitelist:
      "ABCDEFGHIJKLMNOPQRSTUVWXYZÀÈÉÌÒÓÙabcdefghijklmnopqrstuvwxyzàèéìòóù0123456789'.,:;!?-()[]%$€",
  },
  spa: {
    iso6393: 'spa',
    tesseract: 'spa',
    whitelist:
      "ABCDEFGHIJKLMNOPQRSTUVWXYZÁÉÍÑÓÚÜabcdefghijklmnopqrstuvwxyzáéíñóúü0123456789'.,:;!?-()[]%$€",
  },
};

export function getOcrLanguageInfo(
  code6393: string
): OcrLanguageInfo | undefined {
  const known = REGISTRY[code6393];
  if (known) return known;
  // Fallback: assume Tesseract uses the same ISO-639-3 code
  return { iso6393: code6393, tesseract: code6393 };
}

export function resolveTesseractLangs(
  codes6393: string[] | undefined
): string | undefined {
  if (!codes6393 || codes6393.length === 0) return undefined;
  const mapped = codes6393
    .map(c => getOcrLanguageInfo(c)?.tesseract)
    .filter((v): v is string => !!v);
  return mapped.length ? mapped.join('+') : undefined;
}

export function getWhitelistFor(code6393: string): string | undefined {
  return REGISTRY[code6393]?.whitelist;
}

export const supportedIso6393 = Object.keys(REGISTRY);
