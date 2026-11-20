// Tiện ích three.js tùy chọn (tách riêng để palette/form không kéo three vào).
import * as THREE from 'three';
import { hexToRgb, type Rgb } from './palette';

export const toColor = (hex: number | string, out: THREE.Color = new THREE.Color()): THREE.Color => {
  const [r, g, b] = hexToRgb(hex);
  return out.setRGB(r, g, b, THREE.SRGBColorSpace);
};
export const rgbToColor = (rgb: Rgb, out: THREE.Color = new THREE.Color()): THREE.Color => out.setRGB(rgb[0], rgb[1], rgb[2], THREE.SRGBColorSpace);
