import { describe, expect, it } from 'vitest';
import { lightingFor, stationGridPos, fabricColour, COLS } from './parts';

// Pure helpers behind the 3D scene get a quick guard so refactors stay honest.

describe('stationGridPos', () => {
  it('lays stations out in centred rows', () => {
    const [x0] = stationGridPos(0);
    const [x1] = stationGridPos(1);
    expect(x1).toBeGreaterThan(x0); // next column is to the right
  });

  it('wraps to a new row after COLS stations', () => {
    const [, z0] = stationGridPos(0);
    const [, zWrap] = stationGridPos(COLS);
    expect(zWrap).toBeGreaterThan(z0);
  });
});

describe('lightingFor', () => {
  it('is brighter at midday than at midnight', () => {
    const noon = lightingFor(13);
    const midnight = lightingFor(1);
    expect(noon.day).toBeGreaterThan(midnight.day);
    expect(noon.dir).toBeGreaterThan(midnight.dir);
    expect(midnight.isNight).toBe(true);
    expect(noon.isNight).toBe(false);
  });

  it('keeps a usable ambient floor even at night', () => {
    expect(lightingFor(1).ambient).toBeGreaterThan(0.5);
  });
});

describe('fabricColour', () => {
  it('gives wooden venetians a wood tone regardless of fabric grade', () => {
    expect(fabricColour('standard', 'wood_venetian')).toBe('#b45309');
  });
  it('varies by fabric grade for plain blinds', () => {
    expect(fabricColour('luxury')).not.toBe(fabricColour('standard'));
  });
});
