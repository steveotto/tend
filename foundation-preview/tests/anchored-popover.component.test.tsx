import { describe, expect, it } from 'vitest';
import { calculateAnchoredPopoverPosition } from '../src/components/AnchoredPopover.tsx';

function bounds(left: number, top: number, width: number, height: number) {
  return {
    left,
    top,
    right: left + width,
    bottom: top + height,
    width,
    height
  };
}

describe('anchored popover viewport placement', () => {
  it('clamps a wide panel to both viewport gutters', () => {
    const position = calculateAnchoredPopoverPosition(
      bounds(2, 20, 72, 34),
      bounds(0, 0, 320, 420),
      { left: 0, top: 0, width: 390, height: 844 }
    );

    expect(position.left).toBe(12);
    expect(position.maxWidth).toBe(366);
    expect(position.top).toBe(60);
    expect(position.maxHeight).toBe(772);
  });

  it('flips above the trigger when a short visible viewport has more room there', () => {
    const position = calculateAnchoredPopoverPosition(
      bounds(250, 520, 80, 34),
      bounds(0, 0, 320, 280),
      { left: 0, top: 400, width: 390, height: 240 }
    );

    expect(position.left).toBe(58);
    expect(position.top).toBe(412);
    expect(position.maxHeight).toBe(102);
    expect(position.top).toBeGreaterThanOrEqual(412);
    expect(position.top + position.maxHeight).toBeLessThanOrEqual(628);
  });

  it('uses the visual viewport offset after zoom or keyboard-driven panning', () => {
    const position = calculateAnchoredPopoverPosition(
      bounds(45, 490, 80, 34),
      bounds(0, 0, 320, 300),
      { left: 50, top: 450, width: 280, height: 300 }
    );

    expect(position.left).toBe(62);
    expect(position.maxWidth).toBe(256);
    expect(position.top).toBeGreaterThanOrEqual(462);
    expect(position.top + position.maxHeight).toBeLessThanOrEqual(738);
  });
});
