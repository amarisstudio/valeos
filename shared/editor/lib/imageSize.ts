/**
 * ValeOS: the tallest an image is shown by default, in pixels. Large photos
 * inserted without an explicit size would otherwise render at the full column
 * width, which makes portrait photos taller than the screen. Resizing an image
 * in the editor, or choosing the full-width layout, overrides this.
 */
export const MaxAutoImageHeight = 480;

/**
 * Returns the display size for an image that has no explicit size set,
 * scaling it down proportionally so it is no taller than MaxAutoImageHeight.
 *
 * @param naturalWidth the intrinsic width of the image in pixels.
 * @param naturalHeight the intrinsic height of the image in pixels, if known.
 * @returns the width and height to display the image at.
 */
export function getAutoImageSize(
  naturalWidth: number,
  naturalHeight: number | undefined
): { width: number; height: number | undefined } {
  if (!naturalWidth || !naturalHeight || naturalHeight <= MaxAutoImageHeight) {
    return { width: naturalWidth, height: naturalHeight };
  }

  return {
    width: Math.round((naturalWidth * MaxAutoImageHeight) / naturalHeight),
    height: MaxAutoImageHeight,
  };
}
