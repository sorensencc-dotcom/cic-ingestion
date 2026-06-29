/**
 * CIC Cost Charts — Dark-Mode SVG Renderers
 * Returns inline SVG strings for dashboard + PDF use
 */

export interface DailyCostData {
  date: string;
  tokens: number;
  cost: number;
}

export interface ModelCostData {
  model: string;
  cost: number;
  tokens: number;
}

/**
 * Render 7-day usage + cost polyline chart
 * Two overlaid series: tokens (green) + cost (blue)
 */
export function renderUsageCost7dSvg(data: DailyCostData[]): string {
  const width = 400;
  const height = 120;
  const padding = 20;
  const innerWidth = width - 2 * padding;
  const innerHeight = height - 2 * padding;

  if (data.length === 0) {
    return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${width}" height="${height}" fill="#050505"/>
      <text x="${width / 2}" y="${height / 2}" text-anchor="middle" fill="#666" font-size="12">No data</text>
    </svg>`;
  }

  // Normalize data to chart coordinates
  const maxTokens = Math.max(...data.map(d => d.tokens), 1);
  const maxCost = Math.max(...data.map(d => d.cost), 1);

  const points = data.map((d, i) => {
    const x = padding + (i / (data.length - 1 || 1)) * innerWidth;
    const yTokens = padding + innerHeight - (d.tokens / maxTokens) * innerHeight;
    const yCost = padding + innerHeight - (d.cost / maxCost) * innerHeight;
    return { x, yTokens, yCost };
  });

  const tokenPathData = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.yTokens.toFixed(1)}`).join(' ');
  const costPathData = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.yCost.toFixed(1)}`).join(' ');

  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="tokenGradient" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" style="stop-color:#00ff88;stop-opacity:0.3" />
        <stop offset="100%" style="stop-color:#00ff88;stop-opacity:0" />
      </linearGradient>
      <linearGradient id="costGradient" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" style="stop-color:#00aaff;stop-opacity:0.3" />
        <stop offset="100%" style="stop-color:#00aaff;stop-opacity:0" />
      </linearGradient>
    </defs>
    <rect width="${width}" height="${height}" fill="#050505"/>
    <g>
      <!-- Grid lines -->
      <line x1="${padding}" y1="${padding + innerHeight * 0.25}" x2="${width - padding}" y2="${padding + innerHeight * 0.25}" stroke="#333" stroke-width="1" stroke-dasharray="2,2"/>
      <line x1="${padding}" y1="${padding + innerHeight * 0.5}" x2="${width - padding}" y2="${padding + innerHeight * 0.5}" stroke="#333" stroke-width="1" stroke-dasharray="2,2"/>
      <line x1="${padding}" y1="${padding + innerHeight * 0.75}" x2="${width - padding}" y2="${padding + innerHeight * 0.75}" stroke="#333" stroke-width="1" stroke-dasharray="2,2"/>

      <!-- Axes -->
      <line x1="${padding}" y1="${padding}" x2="${padding}" y2="${padding + innerHeight}" stroke="#666" stroke-width="1"/>
      <line x1="${padding}" y1="${padding + innerHeight}" x2="${width - padding}" y2="${padding + innerHeight}" stroke="#666" stroke-width="1"/>

      <!-- Tokens polyline (green) -->
      <path d="${tokenPathData}" stroke="#00ff88" stroke-width="2" fill="none"/>

      <!-- Cost polyline (blue) -->
      <path d="${costPathData}" stroke="#00aaff" stroke-width="2" fill="none"/>

      <!-- Data points -->
      ${points.map((p, i) => `<circle cx="${p.x.toFixed(1)}" cy="${p.yTokens.toFixed(1)}" r="2" fill="#00ff88"/>`).join('')}
      ${points.map((p, i) => `<circle cx="${p.x.toFixed(1)}" cy="${p.yCost.toFixed(1)}" r="2" fill="#00aaff"/>`).join('')}
    </g>
    <!-- Legend -->
    <g>
      <line x1="${width - 120}" y1="10" x2="${width - 105}" y2="10" stroke="#00ff88" stroke-width="2"/>
      <text x="${width - 100}" y="14" fill="#00ff88" font-size="11">Tokens</text>

      <line x1="${width - 120}" y1="25" x2="${width - 105}" y2="25" stroke="#00aaff" stroke-width="2"/>
      <text x="${width - 100}" y="29" fill="#00aaff" font-size="11">Cost (USD)</text>
    </g>
  </svg>`;
}

/**
 * Render 7-day local savings polyline chart
 * Single series: savings (pink)
 */
export function renderLocalSavings7dSvg(data: DailyCostData[]): string {
  const width = 400;
  const height = 120;
  const padding = 20;
  const innerWidth = width - 2 * padding;
  const innerHeight = height - 2 * padding;

  if (data.length === 0) {
    return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${width}" height="${height}" fill="#050505"/>
      <text x="${width / 2}" y="${height / 2}" text-anchor="middle" fill="#666" font-size="12">No data</text>
    </svg>`;
  }

  const maxSavings = Math.max(...data.map(d => d.cost), 1);

  const points = data.map((d, i) => {
    const x = padding + (i / (data.length - 1 || 1)) * innerWidth;
    const y = padding + innerHeight - (d.cost / maxSavings) * innerHeight;
    return { x, y };
  });

  const pathData = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const fillPath = `${pathData} L ${points[points.length - 1].x.toFixed(1)} ${padding + innerHeight} L ${points[0].x.toFixed(1)} ${padding + innerHeight} Z`;

  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="savingsGradient" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" style="stop-color:#ff00aa;stop-opacity:0.4" />
        <stop offset="100%" style="stop-color:#ff00aa;stop-opacity:0" />
      </linearGradient>
    </defs>
    <rect width="${width}" height="${height}" fill="#050505"/>
    <g>
      <!-- Grid lines -->
      <line x1="${padding}" y1="${padding + innerHeight * 0.25}" x2="${width - padding}" y2="${padding + innerHeight * 0.25}" stroke="#333" stroke-width="1" stroke-dasharray="2,2"/>
      <line x1="${padding}" y1="${padding + innerHeight * 0.5}" x2="${width - padding}" y2="${padding + innerHeight * 0.5}" stroke="#333" stroke-width="1" stroke-dasharray="2,2"/>
      <line x1="${padding}" y1="${padding + innerHeight * 0.75}" x2="${width - padding}" y2="${padding + innerHeight * 0.75}" stroke="#333" stroke-width="1" stroke-dasharray="2,2"/>

      <!-- Axes -->
      <line x1="${padding}" y1="${padding}" x2="${padding}" y2="${padding + innerHeight}" stroke="#666" stroke-width="1"/>
      <line x1="${padding}" y1="${padding + innerHeight}" x2="${width - padding}" y2="${padding + innerHeight}" stroke="#666" stroke-width="1"/>

      <!-- Fill under curve -->
      <path d="${fillPath}" fill="url(#savingsGradient)"/>

      <!-- Savings polyline (pink) -->
      <path d="${pathData}" stroke="#ff00aa" stroke-width="2" fill="none"/>

      <!-- Data points -->
      ${points.map((p) => `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="2" fill="#ff00aa"/>`).join('')}
    </g>
    <!-- Legend -->
    <g>
      <line x1="${width - 140}" y1="10" x2="${width - 125}" y2="10" stroke="#ff00aa" stroke-width="2"/>
      <text x="${width - 120}" y="14" fill="#ff00aa" font-size="11">Local Savings (USD)</text>
    </g>
  </svg>`;
}

/**
 * Render per-model cost bar chart
 * Bars: usage tokens + cost per model
 */
export function renderPerModelCostSvg(models: ModelCostData[]): string {
  const width = 400;
  const height = 120;
  const padding = 20;
  const innerWidth = width - 2 * padding;
  const innerHeight = height - 2 * padding;

  if (models.length === 0) {
    return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${width}" height="${height}" fill="#050505"/>
      <text x="${width / 2}" y="${height / 2}" text-anchor="middle" fill="#666" font-size="12">No models</text>
    </svg>`;
  }

  const maxCost = Math.max(...models.map(m => m.cost), 1);
  const barWidth = Math.min(innerWidth / (models.length * 1.5), 40);
  const barGap = barWidth * 0.3;

  const bars = models.map((model, i) => {
    const x = padding + (i * (barWidth + barGap * 2));
    const barHeight = (model.cost / maxCost) * innerHeight;
    const y = padding + innerHeight - barHeight;
    return { x, y, barHeight, model: model.model.split('-').pop() };
  });

  const colors = ['#00ff88', '#00aaff', '#ff00aa', '#ffff00', '#00ccff', '#ff6b6b'];

  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${width}" height="${height}" fill="#050505"/>
    <g>
      <!-- Grid line -->
      <line x1="${padding}" y1="${padding + innerHeight * 0.5}" x2="${width - padding}" y2="${padding + innerHeight * 0.5}" stroke="#333" stroke-width="1" stroke-dasharray="2,2"/>

      <!-- Axes -->
      <line x1="${padding}" y1="${padding}" x2="${padding}" y2="${padding + innerHeight}" stroke="#666" stroke-width="1"/>
      <line x1="${padding}" y1="${padding + innerHeight}" x2="${width - padding}" y2="${padding + innerHeight}" stroke="#666" stroke-width="1"/>

      <!-- Bars -->
      ${bars.map((bar, i) => {
        const color = colors[i % colors.length];
        return `<rect x="${bar.x.toFixed(1)}" y="${bar.y.toFixed(1)}" width="${barWidth.toFixed(1)}" height="${bar.barHeight.toFixed(1)}" fill="${color}" opacity="0.8"/>
        <text x="${(bar.x + barWidth / 2).toFixed(1)}" y="${(padding + innerHeight + 12).toFixed(1)}" text-anchor="middle" fill="#999" font-size="10">${bar.model}</text>`;
      }).join('')}
    </g>
  </svg>`;
}
