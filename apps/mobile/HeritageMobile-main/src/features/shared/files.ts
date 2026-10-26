import { Platform, Share } from 'react-native';
import * as RNFS from '@dr.pogodin/react-native-fs';
import { pick, keepLocalCopy, types, isErrorWithCode, errorCodes } from '@react-native-documents/picker';
import { viewDocument } from '@react-native-documents/viewer';
import type { SampleAssetKey, SubmissionAttachment } from '../../domain/types';
import { appConfig, isMockMode } from '../../config/appConfig';
import { ServiceError } from '../../services/errors';
import { newId } from '../../utils/ids';

/** Bundled sample files (generated locally; all marked DEMO). */
const SAMPLE_FILES: Record<SampleAssetKey, { file: string; mime: string; title: string }> = {
  syllabus: { file: 'sample-syllabus.pdf', mime: 'application/pdf', title: 'Course syllabus (sample)' },
  lecture: { file: 'sample-lecture.pdf', mime: 'application/pdf', title: 'Lecture notes (sample)' },
  manual: { file: 'sample-manual.pdf', mime: 'application/pdf', title: 'Learning manual (sample)' },
  outline: { file: 'sample-workshop-outline.pdf', mime: 'application/pdf', title: 'Workshop outline (sample)' },
  tax: { file: 'sample-t2202.pdf', mime: 'application/pdf', title: 'T2202 sample (not a valid tax slip)' },
  statement: { file: 'sample-statement.pdf', mime: 'application/pdf', title: 'Financial statement (sample)' },
  ccr: { file: 'sample-ccr.pdf', mime: 'application/pdf', title: 'Co-curricular record (sample)' },
  audit: { file: 'sample-academic-audit.pdf', mime: 'application/pdf', title: 'Academic audit (sample)' },
  letter: { file: 'sample-letter.pdf', mime: 'application/pdf', title: 'Registrar letter (sample)' },
  idcard: { file: 'sample_idcard.png', mime: 'image/png', title: 'Student ID card (sample)' },
  certificate: { file: 'sample-certificate.pdf', mime: 'application/pdf', title: 'Certificate (DEMO)' },
  transcript: { file: 'sample-transcript.pdf', mime: 'application/pdf', title: 'Unofficial transcript (sample)' },
  lessonPdf: { file: 'sample-lesson.pdf', mime: 'application/pdf', title: 'Lesson PDF (sample)' },
};

export function sampleAssetInfo(key: SampleAssetKey) {
  return SAMPLE_FILES[key];
}

/** Resolves a bundled sample asset to a readable file path inside the app bundle. */
export async function sampleAssetPath(key: SampleAssetKey): Promise<string> {
  if (!isMockMode()) throw new ServiceError('NOT_FOUND', 'This file is not available yet.');
  const info = SAMPLE_FILES[key];
  const bundlePath = Platform.OS === 'ios' ? `${RNFS.MainBundlePath}/${info.file}` : undefined;
  if (bundlePath && (await RNFS.exists(bundlePath))) return bundlePath;
  if (Platform.OS === 'android') {
    const dest = `${RNFS.DocumentDirectoryPath}/${info.file}`;
    if (!(await RNFS.exists(dest))) await RNFS.copyFileAssets(info.file, dest);
    return dest;
  }
  throw new ServiceError('NOT_FOUND', `Sample file "${info.file}" is missing from the app bundle.`);
}

/** Copies a sample asset into Documents (simulated "download") and returns the path. */
export async function downloadSampleAsset(key: SampleAssetKey, fileName?: string): Promise<string> {
  const src = await sampleAssetPath(key);
  const dest = `${RNFS.DocumentDirectoryPath}/${fileName ?? SAMPLE_FILES[key].file}`;
  if (await RNFS.exists(dest)) await RNFS.unlink(dest);
  await RNFS.copyFile(src, dest);
  return dest;
}

export async function viewFile(path: string, mime?: string, title?: string): Promise<void> {
  if (!(await RNFS.exists(path))) throw new ServiceError('NOT_FOUND', 'The file could not be found on this device.');
  await viewDocument({ uri: path.startsWith('file://') ? path : `file://${path}`, mimeType: mime, headerTitle: title });
}

export async function viewSampleAsset(key: SampleAssetKey): Promise<void> {
  const path = await sampleAssetPath(key);
  const info = SAMPLE_FILES[key];
  await viewFile(path, info.mime, info.title);
}

/** User-initiated share/print via the native share sheet (iOS share sheet includes Print). */
export async function shareFile(path: string, title?: string): Promise<boolean> {
  if (!(await RNFS.exists(path))) throw new ServiceError('NOT_FOUND', 'The file could not be found on this device.');
  const res = await Share.share({ url: path.startsWith('file://') ? path : `file://${path}`, title }, { subject: title });
  return res.action === Share.sharedAction;
}

export async function shareSampleAsset(key: SampleAssetKey, fileName?: string): Promise<boolean> {
  const path = await downloadSampleAsset(key, fileName);
  return shareFile(path, SAMPLE_FILES[key].title);
}

/** Writes locally generated text (CSV/plain) to Documents and returns the path. */
export async function writeTextFile(fileName: string, content: string): Promise<string> {
  const path = `${RNFS.DocumentDirectoryPath}/${fileName}`;
  await RNFS.writeFile(path, content, 'utf8');
  return path;
}

export const ALLOWED_TYPES = [types.pdf, types.doc, types.docx, types.xls, types.xlsx, types.ppt, types.pptx, types.images, types.zip];
const ALLOWED_EXT = /\.(pdf|docx?|xlsx?|pptx?|png|jpe?g|heic|gif|zip)$/i;

export type PickResult = { status: 'picked'; attachment: SubmissionAttachment } | { status: 'cancelled' } | { status: 'error'; message: string };

/**
 * Opens the native document picker, validates type and size, and keeps a durable
 * local copy in the app's Documents directory.
 */
export async function pickAttachment(opts: { maxBytes?: number; keepCopy?: boolean; extensions?: string[] } = {}): Promise<PickResult> {
  const maxBytes = opts.maxBytes ?? appConfig.demo.attachmentMaxBytes;
  const exts = opts.extensions?.map(e => e.toLowerCase().replace(/^\.?/, '.'));
  try {
    const pickTypes: string[] = exts && types.csv ? [...ALLOWED_TYPES, types.csv].flat() : ALLOWED_TYPES.flat();
    const [file] = await pick({ type: pickTypes, allowMultiSelection: false, mode: 'import' });
    const name = file.name ?? 'attachment';
    const ext = /\.[^.]+$/.exec(name)?.[0]?.toLowerCase() ?? '';
    if (exts ? !exts.includes(ext) : !ALLOWED_EXT.test(name)) return { status: 'error', message: `"${name}" is not an accepted type. Use ${exts ? exts.join(', ') : 'PDF, Office, image, or ZIP'} files.` };
    const size = file.size ?? 0;
    if (size > maxBytes) return { status: 'error', message: `"${name}" is ${(size / (1024 * 1024)).toFixed(1)} MiB. The limit is ${Math.round(maxBytes / (1024 * 1024))} MiB.` };
    let uri = file.uri;
    if (opts.keepCopy !== false) {
      const [copy] = await keepLocalCopy({ files: [{ uri: file.uri, fileName: name }], destination: 'documentDirectory' });
      if (copy.status === 'success') uri = copy.localUri;
      else return { status: 'error', message: `Could not keep a local copy of "${name}": ${copy.copyError}` };
    }
    return { status: 'picked', attachment: { id: newId('att'), name, size, mimeType: file.type ?? 'application/octet-stream', uri } };
  } catch (e) {
    if (isErrorWithCode(e)) {
      if (e.code === errorCodes.OPERATION_CANCELED) return { status: 'cancelled' };
      if (e.code === errorCodes.IN_PROGRESS) return { status: 'error', message: 'A picker is already open.' };
      if (e.code === errorCodes.UNABLE_TO_OPEN_FILE_TYPE) return { status: 'error', message: 'That file type cannot be opened.' };
      return { status: 'error', message: e.message ?? 'Permission denied or picker unavailable.' };
    }
    return { status: 'error', message: (e as Error).message ?? 'Could not open the document picker.' };
  }
}

export function canPreviewInApp(mime: string, name: string): boolean {
  return /pdf|image/.test(mime) || /\.(pdf|png|jpe?g|heic|gif)$/i.test(name);
}

export async function removeLocalCopy(uri: string): Promise<void> {
  try {
    const path = uri.replace('file://', '');
    if (path.startsWith(RNFS.DocumentDirectoryPath) && (await RNFS.exists(path))) await RNFS.unlink(path);
  } catch {
    // best effort
  }
}
