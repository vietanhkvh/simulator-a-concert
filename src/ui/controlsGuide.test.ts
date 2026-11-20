import { describe, expect, it } from 'vitest';
import readme from '../../README.md?raw';
import { CONTROLS, keysHtml } from './controlsGuide';

describe('controlsGuide', () => {
  it('README liệt kê đủ mọi chức năng trong bảng hướng dẫn', () => {
    for (const g of CONTROLS) for (const r of g.rows) expect(readme).toContain(`| ${r.label} |`);
  });
  it('vẽ keycap cho cả phím ngoặc vuông', () => {
    expect(keysHtml('[[] / []]')).toBe('<kbd class="cs-kc">[</kbd> / <kbd class="cs-kc">]</kbd>');
    expect(keysHtml('Giữ [C]')).toBe('Giữ <kbd class="cs-kc">C</kbd>');
  });
});
