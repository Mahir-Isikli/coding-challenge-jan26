'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState, useCallback, useRef, forwardRef, useImperativeHandle } from 'react';
import { Button } from '@/components/ui/button';
import { ZoomIn, ZoomOut } from 'lucide-react';
import { supabase, isRealtimeConfigured } from '@/lib/supabase';
import type { ForceGraphMethods, ForceGraphProps, NodeObject, LinkObject } from 'react-force-graph-2d';
import { forceCollide, forceManyBody, forceRadial } from 'd3-force';

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
  isMatched?: boolean;
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
    display: inline-flex; align-items: center; gap: 3px;
    padding: 4px 10px; border-radius: 6px; font-size: 12px;
    background: ${bg}; color: ${text}; font-weight: 500;
  `;
  
  if (attrs.size !== null) {
    badges.push(`<span style="${badgeStyle('#f3f4f6', '#374151')}"><b>Size:</b> ${attrs.size}</span>`);
  }
  if (attrs.weight !== null) {
    badges.push(`<span style="${badgeStyle('#f3f4f6', '#374151')}"><b>Weight:</b> ${attrs.weight}g</span>`);
  }
  if (attrs.shineFactor) {
    badges.push(`<span style="${badgeStyle('#fef3c7', '#92400e')}"><b>Shine:</b> ${attrs.shineFactor}</span>`);
  }
  if (attrs.hasStem) {
    badges.push(`<span style="${badgeStyle('#dcfce7', '#166534')}">Has stem</span>`);
  }
  if (attrs.hasLeaf) {
    badges.push(`<span style="${badgeStyle('#dcfce7', '#166534')}">Has leaf</span>`);
  }
  if (attrs.hasWorm) {
    badges.push(`<span style="${badgeStyle('#fee2e2', '#991b1b')}">Has worm 🐛</span>`);
  }
  if (attrs.hasChemicals === false) {
    badges.push(`<span style="${badgeStyle('#dcfce7', '#166534')}">Organic</span>`);
  } else if (attrs.hasChemicals === true) {
    badges.push(`<span style="${badgeStyle('#fef3c7', '#92400e')}">Chemically treated</span>`);
  }
  
  return badges.join(' ');
}

// Helper to build preference badges HTML  
function buildPreferenceBadges(prefs: FruitPreferences | undefined): string {
  if (!prefs || Object.keys(prefs).length === 0) {
    return `<span style="color: #6b7280; font-style: italic; font-size: 12px;">Open to anything!</span>`;
  }
  
  const badges: string[] = [];
  const badgeStyle = `
    display: inline-flex; align-items: center; gap: 3px;
    padding: 4px 10px; border-radius: 6px; font-size: 12px;
    background: #ede9fe; color: #5b21b6; font-weight: 500;
  `;
  
  if (prefs.size) {
    const sizeText = prefs.size.min && prefs.size.max 
      ? `${prefs.size.min}–${prefs.size.max}` 
      : prefs.size.min ? `${prefs.size.min}+` : `≤${prefs.size.max}`;
    badges.push(`<span style="${badgeStyle}"><b>Size:</b> ${sizeText}</span>`);
  }
  if (prefs.weight) {
    const weightText = prefs.weight.min && prefs.weight.max 
      ? `${prefs.weight.min}–${prefs.weight.max}g` 
      : prefs.weight.min ? `${prefs.weight.min}g+` : `≤${prefs.weight.max}g`;
    badges.push(`<span style="${badgeStyle}"><b>Weight:</b> ${weightText}</span>`);
  }
  if (prefs.shineFactor) {
    const shine = Array.isArray(prefs.shineFactor) ? prefs.shineFactor.join(' or ') : prefs.shineFactor;
    badges.push(`<span style="${badgeStyle}"><b>Shine:</b> ${shine}</span>`);
  }
  if (prefs.hasStem !== undefined) {
    badges.push(`<span style="${badgeStyle}">${prefs.hasStem ? 'Wants stem' : 'No stem'}</span>`);
  }
  if (prefs.hasLeaf !== undefined) {
    badges.push(`<span style="${badgeStyle}">${prefs.hasLeaf ? 'Wants leaf' : 'No leaf'}</span>`);
  }
  if (prefs.hasWorm === false) {
    badges.push(`<span style="${badgeStyle}">No worms</span>`);
  }
  if (prefs.hasChemicals === false) {
    badges.push(`<span style="${badgeStyle}">Must be organic</span>`);
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  d3Force(forceName: string, force?: any): any;
  d3ReheatSimulation(): void;
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    d3Force: (forceName: string, force?: any) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (innerRef.current as any)?.d3Force(forceName, force);
    },
    d3ReheatSimulation: () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (innerRef.current as any)?.d3ReheatSimulation();
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
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/graph');
      const json = await res.json();
      
      // Assign initial positions based on match status
      // Matched nodes at top, unmatched at bottom
      // Spread horizontally with some randomness
      const matchedNodes = json.nodes.filter((n: GraphNode) => n.isMatched);
      const unmatchedNodes = json.nodes.filter((n: GraphNode) => !n.isMatched);
      
      // Position matched nodes in upper area with good spacing
      matchedNodes.forEach((node: GraphNode, i: number) => {
        const cols = Math.ceil(Math.sqrt(matchedNodes.length * 2));
        const row = Math.floor(i / cols);
        const col = i % cols;
        const spacing = 120; // Increased spacing
        node.x = (col - cols / 2) * spacing + (Math.random() - 0.5) * 30;
        node.y = -150 + row * spacing + (Math.random() - 0.5) * 30;
      });
      
      // Position unmatched nodes in lower area
      unmatchedNodes.forEach((node: GraphNode, i: number) => {
        const cols = Math.ceil(Math.sqrt(unmatchedNodes.length * 2));
        const row = Math.floor(i / cols);
        const col = i % cols;
        const spacing = 100;
        node.x = (col - cols / 2) * spacing + (Math.random() - 0.5) * 40;
        node.y = 150 + row * spacing + (Math.random() - 0.5) * 40;
      });
      
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

  // Subscribe to realtime match events to auto-refresh the graph
  useEffect(() => {
    if (!isRealtimeConfigured()) {
      return;
    }

    // Prevent duplicate subscriptions
    if (channelRef.current) {
      return;
    }

    const channel = supabase.channel("matches", {
      config: { broadcast: { self: true } },
    });

    channel
      .on("broadcast", { event: "new_match" }, () => {
        // Refetch graph data when a new match is created
        console.log("[MatchGraph] New match detected, refreshing graph...");
        fetchData();
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          console.log("[MatchGraph] Connected to realtime updates");
        }
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
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

  // Configure D3 forces for even spacing
  useEffect(() => {
    if (!graphRef.current || data.nodes.length === 0) return;
    
    // Strong collision to prevent overlap - this is key for even spacing
    graphRef.current.d3Force('collision', forceCollide().radius(35).strength(1).iterations(4));
    
    // Strong repulsion between all nodes for even distribution
    graphRef.current.d3Force('charge', forceManyBody().strength(-300).distanceMin(60).distanceMax(400));
    
    // Disable link force entirely - links shouldn't affect positions
    // This way all nodes are evenly spaced regardless of connections
    graphRef.current.d3Force('link', null);
    
    // Radial force to organize by type
    graphRef.current.d3Force('radial', forceRadial<GraphNode>(
      (node) => node.type === 'apple' ? 80 : 180,
      0, 0
    ).strength(0.8));
    
    // No center force - radial handles it
    graphRef.current.d3Force('center', null);
    
    graphRef.current.d3ReheatSimulation();
  }, [data]);

  const nodeColor = useCallback((node: GraphNode) => {
    return node.type === 'apple' ? '#ef4444' : '#f97316';
  }, []);

  const nodeCanvasObject = useCallback(
    (node: GraphNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const emoji = node.type === 'apple' ? '🍏' : '🍊';
      const x = node.x ?? 0;
      const y = node.y ?? 0;
      
      // Draw emoji only - no labels to reduce clutter
      const emojiSize = 24 / globalScale;
      ctx.font = `${emojiSize}px Sans-Serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(emoji, x, y);
    },
    []
  );

  const linkCanvasObject = useCallback(
    (link: GraphLink, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const start = link.source as GraphNode | undefined;
      const end = link.target as GraphNode | undefined;
      if (!start || !end || typeof start !== 'object' || typeof end !== 'object') return;

      // All matches are 90%+ (dark green)
      ctx.strokeStyle = 'rgba(22, 163, 74, 0.5)';
      ctx.lineWidth = 1.5 / globalScale;
      ctx.beginPath();
      ctx.moveTo(start.x ?? 0, start.y ?? 0);
      ctx.lineTo(end.x ?? 0, end.y ?? 0);
      ctx.stroke();
    },
    []
  );

  // Helper to find matches for a given node
  const getMatchesForNode = useCallback((node: GraphNode) => {
    return data.links.filter(link => {
      const source = link.source as GraphNode | string;
      const target = link.target as GraphNode | string;
      const sourceId = typeof source === 'object' ? source.id : source;
      const targetId = typeof target === 'object' ? target.id : target;
      return sourceId === node.id || targetId === node.id;
    }).map(link => {
      const source = link.source as GraphNode | string;
      const target = link.target as GraphNode | string;
      const sourceId = typeof source === 'object' ? source.id : source;
      const matchedId = sourceId === node.id 
        ? (typeof target === 'object' ? target.id : target)
        : sourceId;
      const matchedNode = data.nodes.find(n => n.id === matchedId);
      return {
        node: matchedNode,
        score: link.score ?? 0
      };
    });
  }, [data]);

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
    
    // Get matches for this node - show best match in header
    const matches = getMatchesForNode(node);
    const bestMatch = matches.length > 0 ? matches.reduce((best, m) => m.score > best.score ? m : best, matches[0]) : null;
    const matchBadgeHtml = bestMatch ? (() => {
      const matchEmoji = bestMatch.node?.type === 'apple' ? '🍏' : '🍊';
      const matchName = bestMatch.node?.name ?? 'Unknown';
      const scorePercent = Math.round(bestMatch.score * 100);
      const scoreColor = scorePercent >= 80 ? '#16a34a' : scorePercent >= 60 ? '#ca8a04' : '#dc2626';
      const matchCount = matches.length > 1 ? `+${matches.length - 1}` : '';
      return `
        <div style="display: flex; align-items: center; gap: 6px; margin-left: auto;">
          <span style="font-size: 14px;">${matchEmoji}</span>
          <span style="font-size: 11px; color: #6b7280; max-width: 60px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${matchName}</span>
          <div style="
            background: ${scoreColor}15;
            color: ${scoreColor};
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 600;
          ">${scorePercent}%</div>
          ${matchCount ? `<span style="font-size: 10px; color: #9ca3af;">${matchCount}</span>` : ''}
        </div>
      `;
    })() : '';
    
    return `
      <div style="
        background: white;
        border: none;
        border-radius: 10px;
        min-width: 200px;
        max-width: 360px;
        box-shadow: none;
        font-family: system-ui, -apple-system, sans-serif;
      ">
        <div style="
          background: linear-gradient(135deg, ${accentBg} 0%, white 100%);
          padding: 10px 12px;
          border-radius: ${bestMatch ? '10px 10px 0 0' : '10px'};
        ">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 24px;">${emoji}</span>
            <div>
              <div style="font-weight: 600; font-size: 14px; color: #111;">${displayName}</div>
              <div style="font-size: 10px; color: ${accentColor}; font-weight: 500; text-transform: uppercase;">${node.type}</div>
            </div>
            ${matchBadgeHtml}
          </div>
        </div>
        
        <div style="padding: 10px 12px;">
          ${attrBadges ? `
            <div style="margin-bottom: 8px;">
              <div style="font-size: 10px; font-weight: 600; text-transform: uppercase; color: #9ca3af; margin-bottom: 5px;">What I have</div>
              <div style="display: flex; flex-wrap: wrap; gap: 5px;">${attrBadges}</div>
            </div>
          ` : ''}
          
          <div>
            <div style="font-size: 10px; font-weight: 600; text-transform: uppercase; color: #9ca3af; margin-bottom: 5px;">What I want</div>
            <div style="display: flex; flex-wrap: wrap; gap: 5px;">${prefBadges}</div>
          </div>
        </div>
      </div>
    `;
  }, [getMatchesForNode]);

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
      {/* Controls & Legend */}
      <div className="flex items-center justify-between px-4 py-2 border-b flex-shrink-0">
        {/* Legend */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-0.5 bg-green-600 rounded-full" />
            <span>90%+ match</span>
          </div>
        </div>
        
        {/* Zoom Controls */}
        <div className="inline-flex items-center rounded-md border bg-background">
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
            size="sm"
            onClick={handleFit}
            className="rounded-none border-r px-3 text-xs"
          >
            Fit to View
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
          nodeRelSize={12}
          linkCanvasObject={linkCanvasObject}
          linkCanvasObjectMode={() => 'replace'}
          backgroundColor="transparent"
          cooldownTicks={300}
          warmupTicks={100}
          onEngineStop={handleEngineStop}
          onNodeClick={() => {}}
          nodeLabel={nodeLabel}
          d3VelocityDecay={0.2}
          d3AlphaDecay={0.01}
        />
      </div>
    </div>
  );
}

export function MatchGraphLegend() {
  const [counts, setCounts] = useState({ apples: 0, oranges: 0, matches: 0 });
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const fetchCounts = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    fetchCounts();
  }, [fetchCounts]);

  // Subscribe to realtime updates
  useEffect(() => {
    if (!isRealtimeConfigured() || channelRef.current) {
      return;
    }

    const channel = supabase.channel("matches", {
      config: { broadcast: { self: true } },
    });

    channel
      .on("broadcast", { event: "new_match" }, () => {
        fetchCounts();
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [fetchCounts]);

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
