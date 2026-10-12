import { parseVisionJson, ParseError } from '../parse';
import { VisionError, type VisionProvider, type VisionRequest, type VisionResponse } from '../types';

/**
 * Calls your own backend (see /server), which holds the model API key and the
 * Discogs token and forwards to the configured vision model. Provider-agnostic
 * on the client: swap the model on the server without an app release.
 */
export class ProxyVisionProvider implements VisionProvider {
  readonly id = 'proxy';
  readonly displayName = 'Cloud vision';

  constructor(
    private readonly baseUrl: string,
    private readonly timeoutMs = 90_000,
  ) {}

  async analyze(req: VisionRequest, signal?: AbortSignal): Promise<VisionResponse> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    signal?.addEventListener('abort', () => controller.abort());

    const ocr = req.precheck.ocr;
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl.replace(/\/$/, '')}/v1/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          images: req.images,
          confirmedIdentity: req.confirmedIdentity,
          hints: {
            ocr: ocr
              ? { text: ocr.rawText.slice(0, 2000), catalogNumbers: ocr.catalogNumbers, labels: ocr.labels, countries: ocr.countries, years: ocr.years, channels: ocr.channels }
              : null,
            barcode: req.precheck.barcode ?? null,
            qualityIssues: req.precheck.qualityIssues,
          },
        }),
        signal: controller.signal,
      });
    } catch {
      if (controller.signal.aborted && !signal?.aborted) throw new VisionError('The analysis took too long. Try again.', 'timeout');
      throw new VisionError('You appear to be offline.', 'offline');
    } finally {
      clearTimeout(timer);
    }

    if (res.status === 422) throw new VisionError('The images could not be analyzed. Try clearer photos.', 'refused');
    if (!res.ok) throw new VisionError(`Analysis service error (${res.status}).`, 'server');

    try {
      return parseVisionJson(await res.json());
    } catch (e) {
      if (e instanceof ParseError) throw new VisionError(e.message, 'bad_response');
      throw e;
    }
  }
}
