/**
 * Media file extension constants and filtering utilities for Premiere Pro imports.
 */

export const MEDIA_EXTENSIONS = {
  video: [
    "mp4",
    "mov",
    "avi",
    "mkv",
    "wmv",
    "flv",
    "webm",
    "m4v",
    "mpg",
    "mpeg",
    "mxf",
    "r3d",
    "braw",
    "ari",
  ],
  audio: ["mp3", "wav", "aac", "flac", "ogg", "m4a", "aiff", "aif", "wma"],
  image: [
    "jpg",
    "jpeg",
    "png",
    "gif",
    "bmp",
    "tiff",
    "tif",
    "psd",
    "ai",
    "eps",
    "webp",
    "exr",
    "dpx",
    "tga",
  ],
  project: ["prproj", "mogrt", "xml", "aaf", "edl"],
} as const;

export type MediaCategory = keyof typeof MEDIA_EXTENSIONS;

const ALL_MEDIA_EXTENSIONS_SET = new Set<string>(
  Object.values(MEDIA_EXTENSIONS).flat(),
);

export const ALL_MEDIA_EXTENSIONS: readonly string[] = Array.from(
  ALL_MEDIA_EXTENSIONS_SET,
);

/**
 * Checks if a filename has a recognized media file extension.
 * @param filename - The filename or path to check
 * @returns true if the file has a media extension, false otherwise
 */
export const isMediaFile = (filename: string): boolean => {
  const lastDotIndex = filename.lastIndexOf(".");
  if (lastDotIndex === -1 || lastDotIndex === filename.length - 1) {
    return false;
  }
  const extension = filename.slice(lastDotIndex + 1).toLowerCase();
  return ALL_MEDIA_EXTENSIONS_SET.has(extension);
};

/**
 * Gets the media category for a given filename.
 * @param filename - The filename or path to check
 * @returns The media category or null if not a media file
 */
export const getMediaCategory = (filename: string): MediaCategory | null => {
  const lastDotIndex = filename.lastIndexOf(".");
  if (lastDotIndex === -1 || lastDotIndex === filename.length - 1) {
    return null;
  }
  const extension = filename.slice(lastDotIndex + 1).toLowerCase();

  for (const [category, extensions] of Object.entries(MEDIA_EXTENSIONS)) {
    if ((extensions as readonly string[]).includes(extension)) {
      return category as MediaCategory;
    }
  }
  return null;
};
