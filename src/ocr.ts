import { asset } from './assets.ts';

export interface OcrProgress {
  status: string;
  progress: number;
}

interface OcrWorker {
  setParameters: (params: Record<string, string>) => Promise<unknown>;
  recognize: (image: HTMLCanvasElement) => Promise<{ data: { text: string } }>;
}

type CreateWorker = (langs: string[], oem: number, options: Record<string, unknown>) => Promise<OcrWorker>;

let listener: (message: OcrProgress) => void = () => {};
let workerPromise: Promise<OcrWorker> | null = null;

async function loadCreateWorker(): Promise<CreateWorker> {
  const mod = await import('tesseract.js') as {
    createWorker?: CreateWorker;
    default?: { createWorker?: CreateWorker };
  };
  const createWorker = mod.createWorker ?? mod.default?.createWorker;
  if (!createWorker) throw new Error('ocr-missing');
  return createWorker;
}

async function getWorker(): Promise<OcrWorker> {
  if (!workerPromise) {
    const createWorker = await loadCreateWorker();
    workerPromise = createWorker(['eng', 'chi_sim'], 1, {
      workerPath: asset('ocr/worker.min.js'),
      corePath: asset('ocr'),
      langPath: asset('ocr'),
      workerBlobURL: true,
      gzip: true,
      logger: (message: { status?: string; progress?: number }) => {
        listener({
          status: message.status ?? '',
          progress: typeof message.progress === 'number' ? message.progress : 0,
        });
      },
    }).then(async (worker) => {
      await worker.setParameters({ preserve_interword_spaces: '1' });
      return worker;
    }).catch((error: unknown) => {
      workerPromise = null;
      throw error;
    });
  }
  return workerPromise;
}

/** Recognize on this device. Engine, core, and language files are loaded from this site only. */
export async function recognize(canvas: HTMLCanvasElement, onProgress: (message: OcrProgress) => void): Promise<string> {
  listener = onProgress;
  const worker = await getWorker();
  const result = await worker.recognize(canvas);
  return result.data.text ?? '';
}

export function resetRecognizer(): void {
  workerPromise = null;
}
