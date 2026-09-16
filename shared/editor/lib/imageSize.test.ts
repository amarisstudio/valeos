import { describe, expect, it } from "vitest";
import { getAutoImageSize, MaxAutoImageHeight } from "./imageSize";

describe("getAutoImageSize", () => {
  it("scales a tall portrait photo down to the maximum height", () => {
    expect(getAutoImageSize(1707, 2560)).toEqual({
      width: Math.round((1707 * MaxAutoImageHeight) / 2560),
      height: MaxAutoImageHeight,
    });
  });

  it("scales a large landscape photo by height, keeping the aspect ratio", () => {
    const { width, height } = getAutoImageSize(2560, 1707);
    expect(height).toBe(MaxAutoImageHeight);
    expect(width / MaxAutoImageHeight).toBeCloseTo(2560 / 1707, 2);
  });

  it("leaves images that are already short enough untouched", () => {
    expect(getAutoImageSize(800, 300)).toEqual({ width: 800, height: 300 });
  });

  it("passes through when the natural height is unknown", () => {
    expect(getAutoImageSize(300, undefined)).toEqual({
      width: 300,
      height: undefined,
    });
  });

  it("passes through when dimensions are zero", () => {
    expect(getAutoImageSize(0, 0)).toEqual({ width: 0, height: 0 });
  });
});
