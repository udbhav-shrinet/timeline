import React, { useState, useEffect, useRef } from 'react';
import { Search, Loader2, AlertCircle, ChevronDown, ExternalLink, Zap, ChevronRight, CornerDownRight, Activity, ArrowLeft, Globe, Network, List, X } from 'lucide-react';

// --- VIBRANT ACCENT COLORS ---
const accentColors = [
  { bg: 'bg-[#FF90E8]', border: 'border-[#FF90E8]', text: 'text-[#FF90E8]' }, // Pink
  { bg: 'bg-[#00E5FF]', border: 'border-[#00E5FF]', text: 'text-[#00E5FF]' }, // Cyan
  { bg: 'bg-[#FFC900]', border: 'border-[#FFC900]', text: 'text-[#FFC900]' }, // Yellow
  { bg: 'bg-[#00FF66]', border: 'border-[#00FF66]', text: 'text-[#00FF66]' }, // Green
  { bg: 'bg-[#FF4D4D]', border: 'border-[#FF4D4D]', text: 'text-[#FF4D4D]' }, // Red
  { bg: 'bg-[#FF9800]', border: 'border-[#FF9800]', text: 'text-[#FF9800]' }, // Orange
  { bg: 'bg-[#B388FF]', border: 'border-[#B388FF]', text: 'text-[#B388FF]' }  // Purple
];

const OR_API_KEY = "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";

// Smart Fallback Chain to guarantee the timeline generates
const MODELS_TO_TRY = [
  "google/gemini-2.5-flash", 
  "meta-llama/llama-3-8b-instruct:free",
  "mistralai/mistral-7b-instruct:free"
];

// --- HELPER: Strict Timeout Fetch ---
const fetchWithTimeout = async (resource, options = {}) => {
  const { timeout = 8000 } = options; 
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(resource, { ...options, signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
};

// --- HELPER: Fetch Global News Aggregator ---
const fetchGlobalNews = async (query = "") => {
  const url = query 
    ? `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`
    : `https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en`;

  try {
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
    const res = await fetchWithTimeout(proxyUrl, { timeout: 10000 });
    if (!res.ok) throw new Error("Primary proxy failed");
    
    const text = await res.text();
    const parser = new DOMParser();
    const xml = parser.parseFromString(text, "text/xml");
    const items = Array.from(xml.querySelectorAll("item")).map(item => ({
      title: item.querySelector("title")?.textContent || "",
      link: item.querySelector("link")?.textContent || "",
      pubDate: item.querySelector("pubDate")?.textContent || new Date().toISOString()
    }));
    
    if (items.length > 0) return items;
    throw new Error("No items in XML");
  } catch (err) {
    const rss2jsonUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(url)}`;
    const res = await fetchWithTimeout(rss2jsonUrl, { timeout: 8000 });
    const data = await res.json();
    if (data.status === 'ok' && data.items) return data.items;
    throw new Error("Failed to fetch news feed");
  }
};

const parseNewsItem = (item) => {
  const parts = item.title.split(' - ');
  const source = parts.length > 1 ? parts.pop() : "Global News";
  const headline = parts.join(' - ').trim();
  return { headline, source: source.trim(), link: item.link, date: new Date(item.pubDate) };
};

// --- HELPER: Robust AI Generator ---
const generateWithAI = async (prompt, isMountedRef, maxTokens = 2000) => {
  for (const model of MODELS_TO_TRY) {
    if (!isMountedRef.current) return null;
    try {
      const res = await fetchWithTimeout("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${OR_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ 
          model: model, 
          messages: [{ role: "user", content: prompt }], 
          temperature: 0.1,
          max_tokens: maxTokens
        }),
        timeout: 30000 
      });

      if (!res.ok) continue;
      
      const json = await res.json();
      const rawText = json.choices[0].message.content.trim();
      
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (err) {
      console.warn(`AI Model ${model} failed, falling back...`, err.message);
    }
  }
  throw new Error("All AI models failed or timed out. Traffic might be high.");
};

// --- INTERACTIVE BUBBLE GRAPH COMPONENT ---
function BubbleGraph({ events }) {
  const containerRef = useRef(null);
  const [renderedNodes, setRenderedNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const nodesRef = useRef([]);
  const dragNodeRef = useRef(null);

  // Extract core keywords to find non-chronological semantic connections
  const getKeywords = (text) => {
    const stopWords = ['the','and','for','with','that','this','from','they','have','what','which','their','about','after','would','could','should'];
    return text.toLowerCase().replace(/[^a-z\s]/g, '').split(' ').filter(w => w.length > 5 && !stopWords.includes(w));
  };

  useEffect(() => {
    // 1. Initialize Nodes
    const initialNodes = events.map((ev, i) => ({
      ...ev,
      id: i,
      x: Math.random() * (window.innerWidth / 2) + 100,
      y: Math.random() * (window.innerHeight / 2) + 100,
      vx: 0, vy: 0,
      radius: 50 + (events.length - i) * 1.5, // Newer events are slightly larger
      color: accentColors[i % accentColors.length],
      keywords: getKeywords(ev.headline + ' ' + ev.details)
    }));

    // 2. Initialize Edges (Connections)
    const newEdges = [];
    for(let i = 0; i < initialNodes.length; i++) {
      // Chronological Connection
      if (i < initialNodes.length - 1) {
        newEdges.push({ source: i, target: i+1, type: 'time' }); 
      }
      // Data/Semantic Connection
      for(let j = i + 2; j < initialNodes.length; j++) {
        const shared = initialNodes[i].keywords.some(k => initialNodes[j].keywords.includes(k));
        if (shared) {
          newEdges.push({ source: i, target: j, type: 'data' });
        }
      }
    }

    nodesRef.current = initialNodes;
    setEdges(newEdges);

    // 3. Physics Simulation Engine
    let animationFrame;
    const applyForces = (width, height) => {
      const nodes = nodesRef.current;
      const k = 0.02; // Spring stiffness
      const rep = 4000; // Repulsion
      const damping = 0.85;

      // Repulsion between all nodes
      for(let i=0; i<nodes.length; i++) {
        for(let j=i+1; j<nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          let dist = Math.sqrt(dx*dx + dy*dy) || 1;
          if (dist < 300) { // Optimize calculation
            const force = rep / (dist * dist);
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;
            nodes[i].vx += fx; nodes[i].vy += fy;
            nodes[j].vx -= fx; nodes[j].vy -= fy;
          }
        }
      }

      // Attraction (Springs) via Edges
      newEdges.forEach(edge => {
        const source = nodes[edge.source];
        const target = nodes[edge.target];
        if(!source || !target) return;
        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const dist = Math.sqrt(dx*dx + dy*dy) || 1;
        const targetDist = edge.type === 'time' ? 140 : 250; // Semantic connections are looser
        const force = (dist - targetDist) * k;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        source.vx += fx; source.vy += fy;
        target.vx -= fx; target.vy -= fy;
      });

      // Center gravity
      nodes.forEach(node => {
        const dx = (width / 2) - node.x;
        const dy = (height / 2) - node.y;
        node.vx += dx * 0.005;
        node.vy += dy * 0.005;
      });

      // Apply velocities & boundaries
      nodes.forEach(node => {
        if(!node.isDragging) {
          node.x += node.vx;
          node.y += node.vy;
        }
        node.vx *= damping;
        node.vy *= damping;

        node.x = Math.max(node.radius, Math.min(width - node.radius, node.x));
        node.y = Math.max(node.radius, Math.min(height - node.radius, node.y));
      });
    };

    const tick = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        applyForces(rect.width, rect.height);
        setRenderedNodes([...nodesRef.current]);
      }
      animationFrame = requestAnimationFrame(tick);
    };
    tick();

    return () => cancelAnimationFrame(animationFrame);
  }, [events]);

  // Global Drag Listeners
  useEffect(() => {
    const handleMove = (e) => {
      if (dragNodeRef.current && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        dragNodeRef.current.x = clientX - rect.left;
        dragNodeRef.current.y = clientY - rect.top;
      }
    };
    const handleUp = () => {
      if (dragNodeRef.current) {
        dragNodeRef.current.isDragging = false;
        dragNodeRef.current = null;
      }
    };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    window.addEventListener('touchmove', handleMove, { passive: false });
    window.addEventListener('touchend', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleUp);
    }
  }, []);

  return (
    <div className="relative w-full h-[75vh] min-h-[600px] border-[4px] border-black rounded-[2rem] bg-gray-50 cute-shadow overflow-hidden" ref={containerRef}>
       {/* Background Grid Pattern */}
       <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(#000 2px, transparent 2px)', backgroundSize: '30px 30px' }}></div>
       
       {/* Edges layer */}
       <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
          {edges.map((edge, i) => {
            const source = renderedNodes[edge.source];
            const target = renderedNodes[edge.target];
            if(!source || !target) return null;
            return (
              <line
                key={i}
                x1={source.x} y1={source.y}
                x2={target.x} y2={target.y}
                stroke="black"
                strokeWidth={edge.type === 'time' ? 4 : 2}
                strokeDasharray={edge.type === 'data' ? "6 6" : "none"}
                opacity={edge.type === 'time' ? 1 : 0.3}
              />
            )
          })}
       </svg>

       {/* Nodes layer */}
       {renderedNodes.map(node => (
         <div
           key={node.id}
           onPointerDown={(e) => {
             e.stopPropagation();
             node.isDragging = true;
             dragNodeRef.current = node;
             setSelectedEvent(node);
           }}
           className={`absolute flex items-center justify-center p-3 rounded-full border-[4px] border-black cursor-grab active:cursor-grabbing shadow-[6px_6px_0px_0px_#111] hover:scale-105 transition-transform select-none z-10 ${node.color.bg}`}
           style={{
             width: node.radius * 2,
             height: node.radius * 2,
             left: node.x - node.radius,
             top: node.y - node.radius,
             touchAction: 'none'
           }}
         >
           <div className="text-center w-full h-full flex items-center justify-center pointer-events-none">
             <span className="text-xs md:text-sm font-bold leading-tight line-clamp-4 text-black px-1">
                {node.headline}
             </span>
           </div>
         </div>
       ))}

       {/* Floating Details Panel when a bubble is clicked */}
       {selectedEvent && (
         <div className="absolute bottom-6 right-6 left-6 md:left-auto md:w-96 bg-white border-[4px] border-black p-6 rounded-[2rem] cute-shadow-sm z-50 animate-in slide-in-from-bottom-4">
            <button onClick={() => setSelectedEvent(null)} className="absolute top-4 right-4 bg-gray-100 hover:bg-gray-200 rounded-full p-1 border-2 border-black transition-colors">
               <X size={16} />
            </button>
            <div className={`inline-block border-[2px] border-black rounded-full px-3 py-1 font-mono text-xs font-bold uppercase tracking-widest mb-4 ${selectedEvent.color.bg} text-black`}>
               {selectedEvent.date}
            </div>
            <h3 className="text-xl font-extrabold tracking-tighter leading-[1.1] lowercase text-black mb-4">
               {selectedEvent.headline}
            </h3>
            <p className="text-sm font-medium text-gray-800 leading-relaxed lowercase mb-4">
               {selectedEvent.details}
            </p>
            <a 
               href={selectedEvent.link || `https://news.google.com/search?q=${encodeURIComponent(selectedEvent.headline)}`}
               target="_blank"
               rel="noopener noreferrer"
               className="inline-flex items-center gap-2 font-mono font-bold text-xs uppercase px-4 py-2 border-[2px] border-black rounded-full hover:translate-y-[-2px] hover:shadow-[4px_4px_0px_0px_#111] transition-all bg-black text-white w-full justify-center"
            >
               {selectedEvent.link ? 'read source article' : 'search related articles'} <ExternalLink size={14} />
            </a>
         </div>
       )}
       
       <div className="absolute top-4 left-4 font-mono font-bold text-xs uppercase bg-white border-2 border-black px-3 py-1 rounded-full opacity-70 pointer-events-none">
         Drag bubbles to explore connections
       </div>
    </div>
  );
}

// --- MAIN APP ---
export default function App() {
  const [viewMode, setViewMode] = useState('feed'); 
  const [feedQuery, setFeedQuery] = useState("");
  const [activeTimelineTopic, setActiveTimelineTopic] = useState(null); 

  const handleSearch = (query) => {
    setFeedQuery(query);
    setViewMode('feed');
  };

  const handleSelectTopic = (topic) => {
    setActiveTimelineTopic(topic);
    setViewMode('timeline');
  };

  return (
    <div className="min-h-screen bg-[#fcfcfc] text-[#111] font-sans selection:bg-[#FF90E8] selection:text-black relative pb-10">
      <style dangerouslySetInnerHTML={{__html: `
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,600;9..40,800&family=Space+Mono:ital,wght@0,400;0,700;1,400&display=swap');
        body { font-family: 'DM Sans', sans-serif; background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.04'/%3E%3C/svg%3E"); }
        .font-mono { font-family: 'Space Mono', monospace; }
        .cute-shadow { box-shadow: 4px 4px 0px 0px #111; }
        .cute-shadow-sm { box-shadow: 2px 2px 0px 0px #111; }
        .cute-shadow-hover:hover { box-shadow: 8px 8px 0px 0px #111; transform: translate(-2px, -2px); }
        ::-webkit-scrollbar { width: 8px; }
        ::-webkit-scrollbar-track { background: #fcfcfc; border-left: 2px solid #111; }
        ::-webkit-scrollbar-thumb { background: #111; border-radius: 0px; border: 2px solid #fcfcfc; }
        ::-webkit-scrollbar-thumb:hover { background: #333; }
      `}} />

      <header className="sticky top-0 z-40 bg-[#fcfcfc]/90 backdrop-blur-md border-b-[3px] border-black py-4 px-6 md:px-10 flex flex-col md:flex-row items-center justify-between gap-4">
        <button 
          onClick={() => { setFeedQuery(""); setViewMode('feed'); }}
          className="text-2xl md:text-3xl font-extrabold tracking-tighter lowercase text-black hover:text-[#00E5FF] transition-colors flex items-center gap-2"
        >
          <Globe size={28} /> the timeline.
        </button>
        
        <div className="w-full md:w-auto flex-1 max-w-xl">
          <SearchBar onSearch={handleSearch} initialValue={feedQuery} />
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 md:px-6 py-10">
        {viewMode === 'timeline' && activeTimelineTopic ? (
           <TimelineView topic={activeTimelineTopic} onBack={() => setViewMode('feed')} />
        ) : (
           <FeedView query={feedQuery} onSelectTopic={handleSelectTopic} />
        )}
      </main>
    </div>
  );
}

// --- SEARCH COMPONENT ---
function SearchBar({ onSearch, initialValue = "" }) {
  const [query, setQuery] = useState(initialValue);
  useEffect(() => { setQuery(initialValue); }, [initialValue]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (query.trim()) onSearch(query.trim());
  };

  return (
    <form onSubmit={handleSubmit} className="relative flex items-center w-full">
      <input 
        type="text" 
        placeholder="search any global or local category (e.g. 'india policy' or 'tech')"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full pl-6 pr-16 py-3 text-sm md:text-base border-[3px] border-black rounded-full bg-white cute-shadow focus:outline-none focus:ring-0 font-bold lowercase placeholder:text-gray-400 transition-transform hover:-translate-y-1"
      />
      <button type="submit" className="absolute right-2 top-2 bottom-2 bg-black text-white px-4 rounded-full flex items-center justify-center hover:bg-[#FFC900] hover:text-black border-[2px] border-transparent hover:border-black transition-colors">
        <Search size={18} />
      </button>
    </form>
  );
}

// --- DYNAMIC FEED VIEW (AI Clustered Broad Topics) ---
function FeedView({ query, onSelectTopic }) {
  const [topics, setTopics] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    
    const fetchAndClusterFeed = async () => {
      setIsLoading(true); setError(null);
      try {
        const rawItems = await fetchGlobalNews(query);
        if (!rawItems || rawItems.length === 0) throw new Error(`no news found for '${query}'.`);
        
        const processed = rawItems.map(item => parseNewsItem(item));
        const headlinesOnly = processed.slice(0, 40).map(i => i.headline);

        const prompt = `
          You are a senior news editor. The user searched for: "${query || 'Global Trending News'}".
          Below are raw, hyper-specific headlines currently dominating the live news feed.
          Your job is to cluster these specific articles into 6 to 12 BROAD, distinct thematic topics.
          
          For example: If headlines are "Man arrested in Gorakhpur" and "Protests in Gorakhpur", group them into a broad topic named "Gorakhpur Crime & Protests".
          
          Raw Headlines:
          ${JSON.stringify(headlinesOnly)}

          CRITICAL RULES:
          1. The 'headline' must be a broad, recognizable topic name.
          2. Return ONLY a JSON object matching this schema:
          {
            "topics": [
              {
                "headline": "Broad Topic Name",
                "date": "Today",
                "source": "Aggregated Topics"
              }
            ]
          }
        `;

        let clusteredTopics = [];
        try {
          const aiResult = await generateWithAI(prompt, isMountedRef, 1500);
          if (aiResult && aiResult.topics) {
            clusteredTopics = aiResult.topics;
          }
        } catch (aiErr) {
          console.warn("AI Clustering failed, using JS Fallback", aiErr);
        }

        if (clusteredTopics.length === 0) {
          const seenWords = new Set();
          for (const item of processed) {
            const words = item.headline.split(' ').filter(w => w.length > 4);
            const signature = words.slice(0, 2).join(' ').toLowerCase();
            if (!seenWords.has(signature) && clusteredTopics.length < 12) {
               seenWords.add(signature);
               clusteredTopics.push({ headline: item.headline, date: item.date.toLocaleDateString(), source: item.source });
            }
          }
        }

        const finalTopics = clusteredTopics.map((t, idx) => ({
          ...t,
          id: Math.random().toString(36),
          image: `https://picsum.photos/seed/${t.headline.replace(/\s/g, '')}/600/400?grayscale`,
          color: accentColors[idx % accentColors.length]
        }));
        
        if (isMountedRef.current) setTopics(finalTopics);
      } catch (err) {
        if (isMountedRef.current) setError(err.message);
      } finally {
        if (isMountedRef.current) setIsLoading(false);
      }
    };

    fetchAndClusterFeed();
    return () => { isMountedRef.current = false; };
  }, [query]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <Loader2 className="w-12 h-12 animate-spin mb-6 text-black" />
        <h2 className="text-3xl font-extrabold lowercase tracking-tighter mb-2">clustering themes...</h2>
        <p className="text-gray-500 font-medium lowercase">ai is grouping specific global articles into broad topics.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <AlertCircle className="w-12 h-12 mb-6 text-black" />
        <h2 className="text-3xl font-extrabold lowercase tracking-tighter mb-2">no news found.</h2>
        <p className="text-gray-500 font-medium lowercase max-w-lg mx-auto">{error}</p>
      </div>
    );
  }

  return (
    <div className="w-full pb-10">
      <div className="mb-10 text-center md:text-left">
        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tighter mb-4 lowercase text-black">
          {query ? `${query}.` : 'trending globally.'}
        </h1>
        <p className="text-lg md:text-xl font-medium text-gray-600 lowercase">
          {query ? 'ai has clustered the latest coverage into broad topics. select a card to generate its deep timeline.' : 'the most important stories happening worldwide today. click to unravel their history.'}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
        {topics.map((topic) => (
          <button 
            key={topic.id}
            onClick={() => onSelectTopic(topic.headline)}
            className="group text-left flex flex-col bg-white border-[3px] border-black rounded-[2rem] overflow-hidden cute-shadow hover:shadow-[10px_10px_0px_0px_#111] hover:translate-x-[-4px] hover:translate-y-[-4px] transition-all duration-300"
          >
            <div className="h-48 md:h-56 w-full border-b-[3px] border-black overflow-hidden relative bg-gray-100">
               <img 
                 src={topic.image} 
                 alt={topic.headline}
                 className="w-full h-full object-cover filter grayscale group-hover:grayscale-0 group-hover:scale-110 transition-all duration-700 ease-in-out"
               />
               <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors duration-500"></div>
               
               <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <div className={`w-16 h-16 rounded-full border-[3px] border-black flex items-center justify-center ${topic.color.bg} cute-shadow-sm rotate-12 group-hover:rotate-0 transition-transform`}>
                     <Zap size={24} className="text-black" />
                  </div>
               </div>

               <div className="absolute top-4 left-4 bg-white border-[2px] border-black rounded-full px-3 py-1 font-mono text-xs font-bold uppercase text-black cute-shadow-sm flex items-center gap-1 max-w-[80%] truncate">
                 <Globe size={12} className="shrink-0" /> <span className="truncate">{topic.source}</span>
               </div>
            </div>
            
            <div className="p-6 flex flex-col flex-1 bg-white">
              <h2 className="text-xl md:text-2xl font-extrabold tracking-tight lowercase leading-[1.2] group-hover:underline decoration-4 underline-offset-4 mb-4 line-clamp-3">
                {topic.headline}
              </h2>
              <div className="mt-auto flex items-center justify-between">
                <span className="font-mono font-bold text-xs uppercase text-gray-500">
                  {topic.date}
                </span>
                <span className={`font-mono font-bold text-xs uppercase transition-colors ${topic.color.text}`}>
                  view timeline <ChevronRight size={14} className="inline group-hover:translate-x-1 transition-transform" />
                </span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// --- TIMELINE VIEW (Deep Historical Context Generator with Graph Toggle) ---
function TimelineView({ topic, onBack }) {
  const [events, setEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedIndices, setExpandedIndices] = useState(new Set([0])); 
  const [timelineMode, setTimelineMode] = useState('list'); // 'list' | 'bubbles'
  const isMountedRef = useRef(true);

  const toggleExpand = (index) => {
    const newSet = new Set(expandedIndices);
    if (newSet.has(index)) newSet.delete(index);
    else newSet.add(index);
    setExpandedIndices(newSet);
  };

  useEffect(() => {
    isMountedRef.current = true;
    
    const buildDeepTimeline = async () => {
      setIsLoading(true); setError(null); setExpandedIndices(new Set([0])); 
      
      try {
        const rawNews = await fetchGlobalNews(topic);
        const processed = rawNews.map(item => parseNewsItem(item));
        const groundData = processed.slice(0, 15); 

        const prompt = `
          You are an expert news curator and deep historian. 
          The user clicked on the broad topic: "${topic}".
          
          Here are recent live articles fetched from global news for grounding:
          ${JSON.stringify(groundData)}

          CRITICAL RULES:
          1. MERGE DUPLICATES: All recent articles above likely refer to the same event. Merge them into ONE timeline entry for the present day. 
          2. STRICT RELEVANCE: ONLY include events strictly related to "${topic}". Discard any random unrelated regional news.
          3. DEEP HISTORICAL CONTEXT: Add 5 to 30 past historical milestones (going back months, years, or even decades) ONLY IF they are directly part of this EXACT ongoing saga. Give the user the full historical picture.
          4. SORT STRICTLY NEWEST TO OLDEST (Latest updates at the top, origin story at the bottom).
          5. FORMAT: Return ONLY a valid JSON object matching this schema:
          {
            "events": [
              {
                "date": "Month DD, YYYY or exact Year",
                "headline": "punchy lowercase headline",
                "details": "2-4 sentences explaining this specific historical phase.",
                "source": "Aggregated News & Historical Record",
                "link": "Include matching link from live data if relevant, otherwise leave empty string"
              }
            ]
          }
        `;

        let timelineEvents = [];
        try {
          const aiResult = await generateWithAI(prompt, isMountedRef, 4000);
          if (aiResult && aiResult.events) {
            timelineEvents = aiResult.events;
          }
        } catch (aiErr) {
          console.warn("AI Timeline Generation failed, using raw JS fallback.", aiErr);
        }

        if (timelineEvents.length === 0) {
          const fallbackEvents = groundData.map(item => ({
            date: item.date.toLocaleDateString(),
            timestamp: item.date.getTime(),
            headline: item.headline,
            details: `Latest direct match reported by ${item.source}. AI historical context generation timed out.`,
            source: item.source,
            link: item.link
          }));
          fallbackEvents.sort((a, b) => b.timestamp - a.timestamp); 
          timelineEvents = fallbackEvents;
        }

        if (isMountedRef.current) setEvents(timelineEvents);

      } catch (err) {
        if (isMountedRef.current) setError(err.message);
      } finally {
        if (isMountedRef.current) setIsLoading(false);
      }
    };

    buildDeepTimeline();
    return () => { isMountedRef.current = false; };
  }, [topic]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <Loader2 className="w-12 h-12 animate-spin mb-6 text-black" />
        <h2 className="text-3xl font-extrabold lowercase tracking-tighter mb-2">curating historical timeline...</h2>
        <p className="text-gray-500 font-medium lowercase">ai is analyzing decades of history for '{topic}'.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <AlertCircle className="w-12 h-12 mb-6 text-black" />
        <h2 className="text-3xl font-extrabold lowercase tracking-tighter mb-2">network error.</h2>
        <p className="text-gray-500 font-medium lowercase max-w-lg mx-auto mb-8">{error}</p>
        <button onClick={onBack} className="px-6 py-3 bg-white border-[3px] border-black rounded-full font-bold lowercase cute-shadow-sm hover:-translate-y-1 transition-transform">
          go back to feed
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto">
       <button 
         onClick={onBack}
         className="mb-8 inline-flex items-center gap-2 font-bold px-5 py-2.5 bg-white border-[3px] border-black rounded-full cute-shadow-sm hover:translate-y-[-2px] hover:shadow-[4px_4px_0px_0px_#111] transition-all"
       >
         <ArrowLeft size={18} /> back to feed
       </button>

       <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 pb-4 border-b-[3px] border-black/10 gap-6">
          <div>
            <h2 className="text-3xl md:text-5xl font-extrabold tracking-tighter lowercase mb-4">
              timeline logic.
            </h2>
            <p className="text-lg font-medium text-gray-600 lowercase border-l-[4px] border-[#FF90E8] pl-4">
              ai-curated deep history of: <strong className="text-black">{topic}</strong>
            </p>
          </div>

          {/* View Toggle */}
          <div className="flex items-center bg-white border-[3px] border-black rounded-full overflow-hidden cute-shadow-sm shrink-0">
             <button 
               onClick={() => setTimelineMode('list')} 
               className={`px-5 py-2.5 font-bold flex items-center gap-2 transition-colors ${timelineMode === 'list' ? 'bg-[#FFC900] text-black' : 'hover:bg-gray-100 text-gray-600'}`}
             >
               <List size={18} /> list
             </button>
             <div className="w-[3px] bg-black self-stretch"></div>
             <button 
               onClick={() => setTimelineMode('bubbles')} 
               className={`px-5 py-2.5 font-bold flex items-center gap-2 transition-colors ${timelineMode === 'bubbles' ? 'bg-[#FFC900] text-black' : 'hover:bg-gray-100 text-gray-600'}`}
             >
               <Network size={18} /> bubbles
             </button>
          </div>
       </div>

       {timelineMode === 'bubbles' ? (
         <BubbleGraph events={events} />
       ) : (
         /* DENSE TIMELINE LIST */
         <div className="flex flex-col border-[3px] border-black rounded-[2rem] bg-white overflow-hidden cute-shadow">
           {events.map((event, index) => {
             const isExpanded = expandedIndices.has(index);
             const color = accentColors[index % accentColors.length]; 

             return (
               <div key={index} className={`group border-b-[3px] border-black last:border-b-0 transition-colors duration-300 ${isExpanded ? 'bg-gray-50' : 'hover:bg-gray-50'}`}>
                 <button onClick={() => toggleExpand(index)} className="w-full flex items-start md:items-center justify-between p-4 md:p-6 text-left cursor-pointer gap-4">
                   <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-6 flex-1">
                     <div className="font-mono text-xs md:text-sm font-bold uppercase tracking-widest text-gray-500 shrink-0 md:w-32 flex items-center gap-2">
                       <span className={`w-2 h-2 rounded-full border-[2px] border-black ${color.bg}`}></span>
                       {event.date}
                     </div>
                     <h3 className="text-xl md:text-2xl font-extrabold tracking-tighter leading-[1.1] lowercase text-black group-hover:underline decoration-2 underline-offset-4 line-clamp-2">
                       {event.headline}
                     </h3>
                   </div>
                   <div className={`w-8 h-8 rounded-full border-[2px] border-black flex items-center justify-center shrink-0 transition-transform duration-300 ${isExpanded ? `rotate-90 ${color.bg}` : 'bg-white'}`}>
                     <ChevronRight size={16} className="text-black" />
                   </div>
                 </button>
                 
                 <div className={`grid transition-all duration-300 overflow-hidden ${isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                   <div className="min-h-0">
                     <div className={`mx-4 md:mx-6 mb-6 p-5 md:p-6 border-[3px] border-black rounded-2xl bg-white cute-shadow-sm border-l-8 ${color.border}`}>
                       <div className="flex items-center gap-2 mb-4 font-mono font-bold text-xs uppercase bg-black text-white w-max px-3 py-1 rounded-full">
                          <Globe size={12} /> source: {event.source}
                       </div>
                       <p className="text-base md:text-lg font-medium text-gray-800 leading-relaxed lowercase mb-6 whitespace-pre-line">
                         {event.details}
                       </p>
                       <a 
                         href={event.link || `https://news.google.com/search?q=${encodeURIComponent(event.headline)}`}
                         target="_blank"
                         rel="noopener noreferrer"
                         className={`inline-flex items-center gap-2 font-mono font-bold text-xs md:text-sm uppercase px-5 py-2.5 border-[2px] border-black rounded-full hover:translate-y-[-2px] transition-transform w-max ${color.bg} text-black`}
                       >
                         {event.link ? 'read full source article' : 'search related articles'} <ExternalLink size={14} />
                       </a>
                     </div>
                   </div>
                 </div>
               </div>
             );
           })}
         </div>
       )}
    </div>
  );
}
