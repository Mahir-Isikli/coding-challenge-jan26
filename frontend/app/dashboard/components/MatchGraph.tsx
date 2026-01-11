'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState, useCallback, useRef } from 'react';

const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { ssr: false });

interface GraphNode {
  id: string;
  type: 'apple' | 'orange';
  name: string;
  x?: number;
  y?: number;
}

interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
  score: number;
  id: string;
}

interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

export function MatchGraph() {
  const [data, setData] = useState<GraphData>({ nodes: [], links: [] });
  const [loading, setLoading] = useState(true);
  const [dimensions, setDimensions] = useState({ width: 800, height: 250 });
  const containerRef = useRef<HTMLDivElement>(null);

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
    // No auto-refresh - graph stays stable until page reload
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
    
    // Initial update after a short delay to let layout settle
    const timeout = setTimeout(updateDimensions, 100);
    const timeout2 = setTimeout(updateDimensions, 500);
    
    // Use ResizeObserver for responsive updates
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nodeColor = useCallback((node: any) => {
    return node.type === 'apple' ? '#ef4444' : '#f97316';
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nodeCanvasObject = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const label = node.type === 'apple' ? '🍏' : '🍊';
    const fontSize = 16 / globalScale;
    ctx.font = `${fontSize}px Sans-Serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, node.x || 0, node.y || 0);
  }, []);

  // Draw percentage labels on links
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const linkCanvasObject = useCallback((link: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const start = link.source;
    const end = link.target;
    if (typeof start !== 'object' || typeof end !== 'object') return;
    
    // Draw the line
    const score = link.score || 0.5;
    const alpha = 0.3 + score * 0.5;
    ctx.strokeStyle = `rgba(120, 120, 120, ${alpha})`;
    ctx.lineWidth = 1 / globalScale;
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
    
    // Draw percentage label at midpoint
    const midX = (start.x + end.x) / 2;
    const midY = (start.y + end.y) / 2;
    const label = `${Math.round(score * 100)}%`;
    const fontSize = 9 / globalScale;
    ctx.font = `${fontSize}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = `rgba(100, 100, 100, ${0.5 + score * 0.4})`;
    ctx.fillText(label, midX, midY);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-tertiary">
        <div className="loading-dots"><span></span><span></span><span></span></div>
      </div>
    );
  }

  const appleCount = data.nodes.filter(n => n.type === 'apple').length;
  const orangeCount = data.nodes.filter(n => n.type === 'orange').length;
  const matchCount = data.links.length;

  if (data.nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-tertiary text-sm">
        No data yet
      </div>
    );
  }

  return (
    <div ref={containerRef} className="h-full w-full">
      <ForceGraph2D
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
        onNodeClick={(node) => console.log('Clicked node:', node)}
        nodeLabel={(node) => `${(node as GraphNode).type}: ${((node as GraphNode).name || '').slice(0, 100)}`}
      />
    </div>
  );
}

export function MatchGraphLegend() {
  const [counts, setCounts] = useState({ apples: 0, oranges: 0, matches: 0 });

  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const res = await fetch('/api/graph');
        const json = await res.json();
        setCounts({
          apples: json.nodes.filter((n: GraphNode) => n.type === 'apple').length,
          oranges: json.nodes.filter((n: GraphNode) => n.type === 'orange').length,
          matches: json.links.length,
        });
      } catch (error) {
        console.error('Failed to fetch graph data:', error);
      }
    };
    fetchCounts();
  }, []);

  return (
    <div className="flex items-center justify-evenly text-base text-muted-foreground w-full">
      <div className="flex items-center gap-1.5">
        <span className="text-xl">🍏</span>
        <span>{counts.apples}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-xl">🍊</span>
        <span>{counts.oranges}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-xl">💑</span>
        <span>{counts.matches}</span>
      </div>
    </div>
  );
}
