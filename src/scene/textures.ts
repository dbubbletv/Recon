import * as THREE from 'three';

// Procedurally generated textures — drawn on a canvas at runtime so the scene needs
// no external image assets and still works offline. Each texture is memoised so we
// only build it once.

function canvas(size = 256): { c: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  return { c, ctx };
}

function finish(c: HTMLCanvasElement, repeat = 1): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.anisotropy = 4;
  return tex;
}

const cache = new Map<string, THREE.Texture>();
function memo(key: string, build: () => THREE.Texture): THREE.Texture {
  let t = cache.get(key);
  if (!t) {
    t = build();
    cache.set(key, t);
  }
  return t;
}

/** Mottled polished-concrete colour map. */
export function concreteTexture(): THREE.Texture {
  return memo('concrete', () => {
    const { c, ctx } = canvas(512);
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(0, 0, 512, 512);
    // speckle + blotches
    for (let i = 0; i < 9000; i++) {
      const v = 150 + Math.random() * 90;
      ctx.fillStyle = `rgba(${v},${v + 6},${v + 14},0.06)`;
      ctx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
    }
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = `rgba(100,116,139,${0.02 + Math.random() * 0.05})`;
      ctx.beginPath();
      ctx.arc(Math.random() * 512, Math.random() * 512, 20 + Math.random() * 60, 0, Math.PI * 2);
      ctx.fill();
    }
    // expansion-joint lines
    ctx.strokeStyle = 'rgba(71,85,105,0.5)';
    ctx.lineWidth = 2;
    for (const p of [128, 256, 384]) {
      ctx.beginPath();
      ctx.moveTo(p, 0);
      ctx.lineTo(p, 512);
      ctx.moveTo(0, p);
      ctx.lineTo(512, p);
      ctx.stroke();
    }
    return finish(c, 6);
  });
}

/** Brushed-metal colour map (vertical streaks). */
export function metalTexture(): THREE.Texture {
  return memo('metal', () => {
    const { c, ctx } = canvas(128);
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(0, 0, 128, 128);
    for (let x = 0; x < 128; x++) {
      const v = 130 + Math.random() * 70;
      ctx.strokeStyle = `rgba(${v},${v},${v + 8},0.5)`;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 128);
      ctx.stroke();
    }
    return finish(c, 1);
  });
}

/** Wood-grain colour map for benches. */
export function woodTexture(): THREE.Texture {
  return memo('wood', () => {
    const { c, ctx } = canvas(256);
    ctx.fillStyle = '#7c5c3a';
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 60; i++) {
      const y = Math.random() * 256;
      ctx.strokeStyle = `rgba(${60 + Math.random() * 50},${40 + Math.random() * 35},${20 + Math.random() * 20},0.4)`;
      ctx.lineWidth = 0.5 + Math.random() * 1.8;
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x <= 256; x += 16) ctx.lineTo(x, y + Math.sin(x / 30 + i) * 3);
      ctx.stroke();
    }
    return finish(c, 1);
  });
}

/** Woven-fabric colour map, tinted by a base colour. */
export function fabricTexture(colour: string): THREE.Texture {
  return memo('fabric:' + colour, () => {
    const { c, ctx } = canvas(64);
    ctx.fillStyle = colour;
    ctx.fillRect(0, 0, 64, 64);
    ctx.strokeStyle = 'rgba(255,255,255,0.10)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 64; i += 4) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 64);
      ctx.moveTo(0, i);
      ctx.lineTo(64, i);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.10)';
    for (let i = 2; i < 64; i += 4) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 64);
      ctx.stroke();
    }
    return finish(c, 2);
  });
}
