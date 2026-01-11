'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState, useCallback, useRef, forwardRef, useImperativeHandle } from 'react';
import { Button } from '@/components/ui/button';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import type { ForceGraphMethods, ForceGraphProps, NodeObject, LinkObject } from 'react-force-graph-2d';

// Graph data interfaces
interface FruitAttributes {
  size: number | null;
  weight: number | null;
  hasStem: boolean | null;
  hasLeaf: boolean | null;
  hasWorm: boolean | null;
  shineFactor: 'dull' | 'neutral' | 'shiny' | 'extraShiny' | null;
  hasChemicals: boolean | null;
}

interface FruitPreferences {
  size?: { min?: number; max?: number };
  weight?: { min?: number; max?: number };
  hasStem?: boolean;
  hasLeaf?: boolean;
  hasWorm?: boolean;
  shineFactor?: string | string[];
  hasChemicals?: boolean;
}

interface GraphNodeData {
  type: 'apple' | 'orange';
  name: string;
  attributes?: FruitAttributes;
  preferences?: FruitPreferences;
}

interface GraphLinkData {
  score: number;
}

type GraphNode = NodeObject<GraphNodeData>;
type GraphLink = LinkObject<GraphNodeData, GraphLinkData>;

// Helper to build attribute badges HTML
function buildAttributeBadges(attrs: FruitAttributes | undefined): string {
  if (!attrs) return '';
  const badges: string[] = [];
  
  const badgeStyle = (bg: string, text: string) => `
    display: inline-flex; align-items: center; gap: 4px;
    padding: 3px 8px; border-radius: 12px; font-size: 11px;
    background: ${bg}; color: ${text};
  `;
  
  if (attrs.size !== null) {
    badges.push(`<span style="${badgeStyle('#f3f4f6', '#374151')}">📏 ${attrs.size}</span>`);
  }
  if (attrs.weight !== null) {
    badges.push(`<span style="${badgeStyle('#f3f4f6', '#374151')}">⚖️ ${attrs.weight}g</span>`);
  }
  if (attrs.shineFactor) {
    const shineEmoji = attrs.shineFactor === 'extraShiny' ? '✨' : attrs.shineFactor === 'shiny' ? '🌟' : attrs.shineFactor === 'neutral' ? '○' : '●';
    badges.push(`<span style="${badgeStyle('#fef3c7', '#92400e')}">${shineEmoji} ${attrs.shineFactor}</span>`);
  }
  if (attrs.hasStem) {
    badges.push(`<span style="${badgeStyle('#dcfce7', '#166534')}">🌿 stem</span>`);
  }
  if (attrs.hasLeaf) {
    badges.push(`<span style="${badgeStyle('#dcfce7', '#166534')}">🍃 leaf</span>`);
  }
  if (attrs.hasWorm) {
    badges.push(`<span style="${badgeStyle('#fee2e2', '#991b1b')}">🐛 worm!</span>`);
  }
  if (attrs.hasChemicals === false) {
    badges.push(`<span style="${badgeStyle('#dcfce7', '#166534')}">🌱 organic</span>`);
  } else if (attrs.hasChemicals === true) {
    badges.push(`<span style="${badgeStyle('#fef3c7', '#92400e')}">🧪 treated</span>`);
  }
  
  return badges.join(' ');
}

// Helper to build preference badges HTML  
function buildPreferenceBadges(prefs: FruitPreferences | undefined): string {
  if (!prefs || Object.keys(prefs).length === 0) {
    return `<span style="color: #6b7280; font-style: italic; font-size: 12px;">Open to anything! 💫</span>`;
  }
  
  const badges: string[] = [];
  const badgeStyle = `
    display: inline-flex; align-items: center; gap: 4px;
    padding: 3px 8px; border-radius: 12px; font-size: 11px;
    background: #ede9fe; color: #5b21b6;
  `;
  
  if (prefs.size) {
    const sizeText = prefs.size.min && prefs.size.max 
      ? `${prefs.size.min}-${prefs.size.max}` 
      : prefs.size.min ? `≥${prefs.size.min}` : `≤${prefs.size.max}`;
    badges.push(`<span style="${badgeStyle}">📏 ${sizeText}</span>`);
  }
  if (prefs.weight) {
    const weightText = prefs.weight.min && prefs.weight.max 
      ? `${prefs.weight.min}-${prefs.weight.max}g` 
      : prefs.weight.min ? `≥${prefs.weight.min}g` : `≤${prefs.weight.max}g`;
    badges.push(`<span style="${badgeStyle}">⚖️ ${weightText}</span>`);
  }
  if (prefs.shineFactor) {
    const shine = Array.isArray(prefs.shineFactor) ? prefs.shineFactor.join('/') : prefs.shineFactor;
    badges.push(`<span style="${badgeStyle}">✨ ${shine}</span>`);
  }
  if (prefs.hasStem !== undefined) {
    badges.push(`<span style="${badgeStyle}">${prefs.hasStem ? '🌿 stem' : '🚫 no stem'}</span>`);
  }
  if (prefs.hasLeaf !== undefined) {
    badges.push(`<span style="${badgeStyle}">${prefs.hasLeaf ? '🍃 leaf' : '🚫 no leaf'}</span>`);
  }
  if (prefs.hasWorm === false) {
    badges.push(`<span style="${badgeStyle}">🚫🐛 no worms</span>`);
  }
  if (prefs.hasChemicals === false) {
    badges.push(`<span style="${badgeStyle}">🌱 organic only</span>`);
  }
  
  return badges.join(' ');
}

interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

// Ref methods we expose
interface GraphRefMethods {
  zoomToFit(ms?: number, padding?: number): void;
  zoom(level: number, ms?: number): void;
}

// Dynamically import ForceGraph2D
const ForceGraph2DBase = dynamic(() => import('react-force-graph-2d'), { ssr: false });

// Type-safe wrapper component
const TypedForceGraph = forwardRef<
  GraphRefMethods,
  Omit<ForceGraphProps<GraphNode, GraphLink>, 'ref'> & { onEngineStop?: () => void }
>(function TypedForceGraph(props, ref) {
  const innerRef = useRef<ForceGraphMethods<GraphNode, GraphLink>>(null!);

  useImperativeHandle(ref, () => ({
    zoomToFit: (ms?: number, padding?: number) => {
      innerRef.current?.zoomToFit(ms, padding);
    },
    zoom: (level: number, ms?: number) => {
      innerRef.current?.zoom(level, ms);
    },
  }));

  // Cast props to bypass generic inference issues with dynamic import
  const graphProps = {
    ...props,
    ref: innerRef,
  };

  return <ForceGraph2DBase {...(graphProps as unknown as React.ComponentProps<typeof ForceGraph2DBase>)} />;
});

export function MatchGraph() {
  const [data, setData] = useState<GraphData>({ nodes: [], links: [] });
  const [loading, setLoading] = useState(true);
  const [dimensions, setDimensions] = useState({ width: 800, height: 400 });
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<GraphRefMethods>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/graph');
      const json = await res.json();
      setData(json);
    } catch (error) {
      console.error('Failed to fetch graph data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const width = Math.floor(rect.width || containerRef.current.clientWidth);
        const height = Math.floor(rect.height || containerRef.current.clientHeight);
        if (width > 0 && height > 0) {
          setDimensions({ width, height });
        }
      }
    };

    const timeout = setTimeout(updateDimensions, 100);
    const timeout2 = setTimeout(updateDimensions, 500);

    const resizeObserver = new ResizeObserver(updateDimensions);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    window.addEventListener('resize', updateDimensions);
    return () => {
      clearTimeout(timeout);
      clearTimeout(timeout2);
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateDimensions);
    };
  }, [loading]);

  const handleZoomIn = useCallback(() => {
    graphRef.current?.zoom(2, 300);
  }, []);

  const handleZoomOut = useCallback(() => {
    graphRef.current?.zoom(0.5, 300);
  }, []);

  const handleFit = useCallback(() => {
    graphRef.current?.zoomToFit(400, 40);
  }, []);

  const handleEngineStop = useCallback(() => {
    graphRef.current?.zoomToFit(400, 40);
  }, []);

  const nodeColor = useCallback((node: GraphNode) => {
    return node.type === 'apple' ? '#ef4444' : '#f97316';
  }, []);

  const nodeCanvasObject = useCallback(
    (node: GraphNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const label = node.type === 'apple' ? '🍏' : '🍊';
      const fontSize = 16 / globalScale;
      ctx.font = `${fontSize}px Sans-Serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, node.x ?? 0, node.y ?? 0);
    },
    []
  );

  const linkCanvasObject = useCallback(
    (link: GraphLink, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const start = link.source as GraphNode | undefined;
      const end = link.target as GraphNode | undefined;
      if (!start || !end || typeof start !== 'object' || typeof end !== 'object') return;

      const score = link.score ?? 0.5;
      const alpha = 0.3 + score * 0.5;
      ctx.strokeStyle = `rgba(120, 120, 120, ${alpha})`;
      ctx.lineWidth = 1 / globalScale;
      ctx.beginPath();
      ctx.moveTo(start.x ?? 0, start.y ?? 0);
      ctx.lineTo(end.x ?? 0, end.y ?? 0);
      ctx.stroke();

      const midX = ((start.x ?? 0) + (end.x ?? 0)) / 2;
      const midY = ((start.y ?? 0) + (end.y ?? 0)) / 2;
      const label = `${Math.round(score * 100)}%`;
      const fontSize = 9 / globalScale;
      ctx.font = `${fontSize}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = `rgba(100, 100, 100, ${0.5 + score * 0.4})`;
      ctx.fillText(label, midX, midY);
    },
    []
  );

  const nodeLabel = useCallback((node: GraphNode) => {
    const isApple = node.type === 'apple';
    const emoji = isApple ? '🍏' : '🍊';
    const accentColor = isApple ? '#22c55e' : '#f97316';
    const accentBg = isApple ? '#dcfce7' : '#ffedd5';
    
    // Extract a nice display name
    const rawName = node.name ?? 'Unknown';
    const displayName = rawName.includes('_') 
      ? rawName.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
      : rawName;
    
    const attrBadges = buildAttributeBadges(node.attributes);
    const prefBadges = buildPreferenceBadges(node.preferences);
    
    return `
      <div style="
        background: white;
        border-radius: 12px;
        overflow: hidden;
        min-width: 220px;
        max-width: 300px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.08);
        font-family: system-ui, -apple-system, sans-serif;
      ">
        <!-- Header with accent color -->
        <div style="
          background: linear-gradient(135deg, ${accentBg} 0%, white 100%);
          padding: 12px 14px;
          border-bottom: 1px solid #f3f4f6;
        ">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 28px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1));">${emoji}</span>
            <div>
              <div style="font-weight: 700; font-size: 15px; color: #111; letter-spacing: -0.3px;">${displayName}</div>
              <div style="font-size: 11px; color: ${accentColor}; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px;">${node.type}</div>
            </div>
          </div>
        </div>
        
        <!-- Body -->
        <div style="padding: 12px 14px;">
          <!-- Attributes -->
          ${attrBadges ? `
            <div style="margin-bottom: 10px;">
              <div style="font-size: 10px; font-weight: 600; text-transform: uppercase; color: #9ca3af; margin-bottom: 6px; letter-spacing: 0.5px;">What I have</div>
              <div style="display: flex; flex-wrap: wrap; gap: 4px; line-height: 1.8;">${attrBadges}</div>
            </div>
          ` : ''}
          
          <!-- Preferences -->
          <div>
            <div style="font-size: 10px; font-weight: 600; text-transform: uppercase; color: #9ca3af; margin-bottom: 6px; letter-spacing: 0.5px;">What I want</div>
            <div style="display: flex; flex-wrap: wrap; gap: 4px; line-height: 1.8;">${prefBadges}</div>
          </div>
        </div>
      </div>
    `;
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-tertiary">
        <div className="loading-dots">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </div>
    );
  }

  if (data.nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-tertiary text-sm">
        No data yet
      </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col">
      {/* Zoom Controls */}
      <div className="flex justify-center py-2 border-b flex-shrink-0">
        <div className="inline-flex items-center rounded-md border bg-background shadow-xs">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleZoomOut}
            className="rounded-r-none border-r"
            title="Zoom Out"
          >
            <ZoomOut className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleFit}
            className="rounded-none border-r"
            title="Fit to View"
          >
            <Maximize2 className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleZoomIn}
            className="rounded-l-none"
            title="Zoom In"
          >
            <ZoomIn className="size-4" />
          </Button>
        </div>
      </div>

      {/* Graph Container */}
      <div ref={containerRef} className="flex-1 min-h-0">
        <TypedForceGraph
          ref={graphRef}
          graphData={data}
          width={dimensions.width}
          height={dimensions.height}
          nodeCanvasObject={nodeCanvasObject}
          nodeColor={nodeColor}
          nodeRelSize={8}
          linkCanvasObject={linkCanvasObject}
          linkCanvasObjectMode={() => 'replace'}
          backgroundColor="transparent"
          cooldownTicks={100}
          onEngineStop={handleEngineStop}
          onNodeClick={(node) => console.log('Clicked node:', node)}
          nodeLabel={nodeLabel}
          d3VelocityDecay={0.3}
        />
      </div>
    </div>
  );
}

export function MatchGraphLegend() {
  const [counts, setCounts] = useState({ apples: 0, oranges: 0, matches: 0 });

  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const res = await fetch('/api/graph');
        const json = (await res.json()) as GraphData;
        setCounts({
          apples: json.nodes.filter((n) => n.type === 'apple').length,
          oranges: json.nodes.filter((n) => n.type === 'orange').length,
          matches: json.links.length,
        });
      } catch (error) {
        console.error('Failed to fetch graph data:', error);
      }
    };
    fetchCounts();
  }, []);

  return (
    <div className="flex items-center justify-evenly text-sm text-muted-foreground w-full gap-6">
      <div className="flex flex-col items-center gap-0.5">
        <div className="flex items-center gap-1.5">
          <span className="text-lg">🍏</span>
          <span className="font-semibold text-foreground">{counts.apples}</span>
        </div>
        <span className="text-xs text-center opacity-70">seeking their zest</span>
      </div>
      <div className="flex flex-col items-center gap-0.5">
        <div className="flex items-center gap-1.5">
          <span className="text-lg">🍊</span>
          <span className="font-semibold text-foreground">{counts.oranges}</span>
        </div>
        <span className="text-xs text-center opacity-70">looking for shine</span>
      </div>
      <div className="flex flex-col items-center gap-0.5">
        <div className="flex items-center gap-1.5">
          <span className="text-lg">🍐</span>
          <span className="font-semibold text-foreground">{counts.matches}</span>
        </div>
        <span className="text-xs text-center opacity-70">perfect pears</span>
      </div>
    </div>
  );
}
