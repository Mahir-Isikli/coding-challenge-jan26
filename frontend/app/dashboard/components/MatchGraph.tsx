'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState, useCallback, useRef, type MutableRefObject } from 'react';
import { Button } from '@/components/ui/button';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';

const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { ssr: false });

// Graph data types
interface GraphNode {
  id?: string | number;
  type: 'apple' | 'orange';
  name: string;
  x?: number;
  y?: number;
}

interface GraphLink {
  source?: string | number | GraphNode;
  target?: string | number | GraphNode;
  score: number;
}

interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

// Instance methods we need from the graph
interface ForceGraphInstance {
  zoomToFit(ms?: number, padding?: number): void;
  zoom(level: number, ms?: number): void;
  centerAt(x?: number, y?: number, ms?: number): void;
}

export function MatchGraph() {
  const [data, setData] = useState<GraphData>({ nodes: [], links: [] });
  const [loading, setLoading] = useState(true);
  const [dimensions, setDimensions] = useState({ width: 800, height: 400 });
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<ForceGraphInstance>();

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

  const nodeCanvasObject = useCallback((node: GraphNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const label = node.type === 'apple' ? '🍏' : '🍊';
    const fontSize = 16 / globalScale;
    ctx.font = `${fontSize}px Sans-Serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, node.x ?? 0, node.y ?? 0);
  }, []);

  const linkCanvasObject = useCallback((link: GraphLink, ctx: CanvasRenderingContext2D, globalScale: number) => {
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
  }, []);

  const nodeLabel = useCallback((node: GraphNode) => {
    return `${node.type}: ${(node.name ?? '').slice(0, 100)}`;
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-tertiary">
        <div className="loading-dots"><span></span><span></span><span></span></div>
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
        <ForceGraph2D
          ref={graphRef as MutableRefObject<ForceGraphInstance | undefined>}
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
          onNodeClick={(node: GraphNode) => console.log('Clicked node:', node)}
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
        const json = await res.json() as GraphData;
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
