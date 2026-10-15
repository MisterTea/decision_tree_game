import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, Check, ChevronDown, GitBranch, HelpCircle, Layers, Leaf, Lightbulb, Maximize2, MousePointer2, Palette, RotateCcw, Sparkles, Sprout, Star, Undo2, X, Download, Scissors, Volume2, VolumeX } from 'lucide-react';
import { accuracy, canSwap, extendRoute, find, hint, levels, nodes, palette, pixels, SIZE, stars, swap, update, visits } from './engine';
import type { Color, Level, Move, Tree } from './engine';
import { createSoundPlayer, readSoundEnabled, saveSoundEnabled } from './feedback';
import type { Sound } from './feedback';
import { useCompactScreen } from './responsive';

const chapters = [
  { title: 'Color stories', subtitle: 'Swap color leaves', icon: Palette },
  { title: 'A twist of logic', subtitle: 'Swap decision rules', icon: GitBranch },
  { title: 'Room to grow', subtitle: 'Swap whole subtrees', icon: Sprout },
];
type Progress = Record<string, number>;
function readProgress(): Progress {
  try {
    const value: unknown = JSON.parse(localStorage.getItem('branch-bloom-progress-v1') || '{}');
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value).filter(([key, moves]) => levels.some(l => String(l.id) === key) && Number.isInteger(moves) && moves >= 0));
  } catch { return {}; }
}
function StarRow({ count }: { count: number }) { return <span className="stars" aria-label={`${count} of 3 stars`}>{[1, 2, 3].map(i => <Star key={i} size={14} fill={i <= count ? 'currentColor' : 'none'} className={i <= count ? '' : 'empty-star'} />)}</span>; }
function PixelPicture({ tree, target, selected, difference, label }: { tree: Tree; target?: Tree; selected?: string | null; difference?: boolean; label: string }) {
  const colors = pixels(tree), expected = target ? pixels(target) : undefined;
  return <div className="pixel-frame"><div className="pixel-grid" role="img" aria-label={label}>{colors.map((color, i) => {
    const active = selected && visits(tree, selected, i % SIZE, Math.floor(i / SIZE));
    return <span key={i} style={{ background: palette[color].hex }} className={`${selected && !active ? 'pixel-dim' : ''} ${difference && expected?.[i] !== color ? 'pixel-wrong' : ''}`} />;
  })}</div><span className="axis-origin">0</span><span className="axis-x">x →</span><span className="axis-y">y ↓</span></div>;
}

type PlacedNode = { node: Tree; x: number; y: number; parent?: string; side?: 'yes' | 'no' };
function layout(tree: Tree) {
  const placed: PlacedNode[] = []; let cursor = 0;
  function walk(node: Tree, depth: number, parent?: string, side?: 'yes' | 'no'): number {
    let x: number;
    if (node.kind === 'leaf') { x = 70 + cursor * 128; cursor++; }
    else { const left = walk(node.yes, depth + 1, node.id, 'yes'); const right = walk(node.no, depth + 1, node.id, 'no'); x = (left + right) / 2; }
    placed.push({ node, x, y: 50 + depth * 110, parent, side }); return x;
  }
  walk(tree, 0);
  return { placed, width: cursor * 128 + 12, height: Math.max(...placed.map(p => p.y)) + 70 };
}

function TreeView({ tree, selected, onSelect, onSwap, level, sandbox, hinted, fit, compact, onExplore }: { tree: Tree; selected: string | null; onSelect: (id: string) => void; onSwap: (a: string, b: string) => void; level: Level; sandbox: boolean; hinted: Move | null; fit: boolean; compact: boolean; onExplore: () => void }) {
  const [focusId, setFocusId] = useState(tree.id);
  const focus = find(tree, focusId) || tree;
  const parent = nodes(tree).find(n => n.kind === 'split' && (n.yes.id === focus.id || n.no.id === focus.id));
  const focused = compact && !fit;
  const diagram = layout(tree);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [viewportWidth, setViewportWidth] = useState(diagram.width);
  const [viewportHeight, setViewportHeight] = useState(diagram.height);
  const horizontal = focused && viewportWidth > 320 && viewportHeight < 160;
  const placed: PlacedNode[] = focused ? [{ node: focus, x: horizontal ? focus.kind === 'leaf' ? 192 : 64 : 134, y: horizontal ? 56 : 28 }, ...(focus.kind === 'split' ? [
    { node: focus.yes, x: horizontal ? 210 : 66, y: horizontal ? 28 : 100, parent: focus.id, side: 'yes' as const },
    { node: focus.no, x: horizontal ? 210 : 202, y: horizontal ? 84 : 100, parent: focus.id, side: 'no' as const },
  ] : [])] : diagram.placed;
  const width = focused ? horizontal ? 384 : 268 : diagram.width, height = focused ? horizontal ? 112 : 160 : diagram.height;
  useEffect(() => {
    const measure = () => { setViewportWidth(scrollRef.current?.clientWidth || width); setViewportHeight(scrollRef.current?.clientHeight || height); };
    measure();
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : undefined;
    if (scrollRef.current) observer?.observe(scrollRef.current);
    window.addEventListener('resize', measure);
    return () => { observer?.disconnect(); window.removeEventListener('resize', measure); };
  }, [width, height]);
  useEffect(() => {
    setFocusId(tree.id);
  }, [level.id, sandbox, tree.id]);
  const scale = compact ? Math.min(1, viewportWidth / width, viewportHeight / height) : fit ? Math.min(1, viewportWidth / width) : 1;
  const dragged = useRef<string | null>(null);
  const suppressClick = useRef(false);
  const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const available = (node: Tree) => sandbox || (level.mode === 'leaves' ? node.kind === 'leaf' : level.mode === 'rules' ? node.kind === 'split' : true);
  const jump = (id: string) => { setFocusId(id); onExplore(); };
  function pathLabels(node: Tree, path = 'Start'): { id: string; label: string }[] {
    const label = node.kind === 'leaf' ? palette[node.color].label : `${node.rule.axis} < ${node.rule.value}`;
    return [{ id: node.id, label: `${path} · ${label}` }, ...(node.kind === 'split' ? [...pathLabels(node.yes, `${path} / yes`), ...pathLabels(node.no, `${path} / no`)] : [])];
  }
  return <div className={`tree-view ${focused ? 'branch-view' : ''}`}>
    {compact && <div className="branch-navigation"><button aria-label="Go to parent branch" disabled={!parent} onClick={() => jump(parent!.id)}><ArrowLeft size={13} />Up</button><select aria-label="Explore tree" value={focus.id} onChange={event => jump(event.target.value)}>{pathLabels(tree).map(item => <option key={item.id} value={item.id} data-hinted={hinted?.includes(item.id) || undefined}>{hinted?.includes(item.id) ? 'Hint: ' : ''}{item.label}</option>)}</select><button aria-label="Go to tree root" disabled={focus.id === tree.id && !fit} onClick={() => jump(tree.id)}>Root</button></div>}
    <div className="tree-scroll" ref={scrollRef}><div className="tree-scaled" style={{ width: width * scale, height: height * scale }}><div className="tree-canvas" style={{ width, height, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
    <svg className="connections" width={width} height={height} aria-hidden="true">{placed.filter(p => p.parent).map(p => {
      const parent = placed.find(q => q.node.id === p.parent)!;
      const emphasized = selected && (find(tree, selected) && find(find(tree, selected)!, p.node.id));
      const mid = focused ? 64 : parent.y + 64;
      const labelX = horizontal ? 137 : (p.x + parent.x) / 2, labelY = horizontal ? p.y : mid;
      return <g key={p.node.id}><path className={emphasized ? 'edge-active' : ''} d={horizontal ? `M${parent.x + 52},${parent.y} H137 V${p.y} H${p.x - 52}` : focused ? `M${parent.x},${parent.y + 23} V${mid} H${p.x} V${p.y - 23}` : `M${parent.x},${parent.y + 24} V${parent.y + 55} Q${parent.x},${parent.y + 64} ${parent.x + (p.x > parent.x ? 10 : -10)},${parent.y + 64} H${p.x + (p.x > parent.x ? -10 : 10)} Q${p.x},${parent.y + 64} ${p.x},${parent.y + 74} V${p.y - 24}`} /><rect x={labelX - 16} y={labelY - 9} width="32" height="18" rx="5" /><text x={labelX} y={labelY + 4}>{p.side === 'yes' ? 'yes' : 'no'}</text></g>;
    })}</svg>
    {placed.map(({ node, x, y }) => {
      const eligible = available(node), validTarget = selected && canSwap(tree, selected, node.id, level.mode);
      const name = node.kind === 'leaf' ? `${palette[node.color].label} color` : `${node.rule.axis} less than ${node.rule.value}`;
      return <button key={node.id} ref={el => { buttonRefs.current[node.id] = el; }} type="button"
        className={`tree-node ${node.kind} ${selected === node.id ? 'selected' : ''} ${eligible ? '' : 'fixed'} ${validTarget ? 'swap-target' : ''} ${hinted?.includes(node.id) ? 'hinted' : ''}`}
        style={{ left: x, top: y }} aria-label={`Node ${node.id}: ${name}${!eligible ? ' (fixed)' : ''}`} aria-pressed={selected === node.id} disabled={!eligible}
        onClick={() => { if (suppressClick.current) { suppressClick.current = false; return; } onSelect(node.id); }}
        onPointerDown={event => { suppressClick.current = false; if (!eligible || sandbox || event.button !== 0) return; dragged.current = node.id; event.currentTarget.setPointerCapture(event.pointerId); }}
        onPointerUp={event => {
          const source = dragged.current; dragged.current = null;
          if (!source || sandbox) return;
          const hit = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLButtonElement>('.tree-node');
          const destination = hit ? Object.keys(buttonRefs.current).find(id => buttonRefs.current[id] === hit) : undefined;
          if (destination && destination !== source && canSwap(tree, source, destination, level.mode)) { suppressClick.current = true; onSwap(source, destination); }
        }}
        onPointerCancel={() => { dragged.current = null; }}>
        {node.kind === 'leaf' ? <><span className="node-swatch" style={{ background: palette[node.color].hex }} /><span>{palette[node.color].label}</span></> : <><GitBranch size={15} /><span>{node.rule.axis} <b>&lt;</b> {node.rule.value}</span></>}
        {selected === node.id && <span className="picked-label">SELECTED</span>}
      </button>;
    })}
    {focused && focus.kind === 'split' && [focus.yes, focus.no].map((child, i) => child.kind === 'split' && <button key={`explore-${child.id}`} className="open-branch" style={{ left: horizontal ? 320 : i === 0 ? 66 : 202, top: horizontal ? i === 0 ? 13 : 69 : 128 }} aria-label={`Open ${i === 0 ? 'yes' : 'no'} branch`} onClick={() => jump(child.id)}>Open branch <ChevronDown size={11} /></button>)}
  </div></div></div></div>;
}

export default function App() {
  const compact = useCompactScreen();
  const [levelIndex, setLevelIndex] = useState(0);
  const level = levels[levelIndex];
  const [tree, setTree] = useState<Tree>(level.initial);
  const [route, setRoute] = useState<Move[]>(level.scramble);
  const [history, setHistory] = useState<{ tree: Tree; route: Move[] }[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const selectedRef = useRef<string | null>(null);
  const [progress, setProgress] = useState<Progress>(readProgress);
  const [modal, setModal] = useState<'help' | 'levels' | null>(null);
  const [sandbox, setSandbox] = useState(false);
  const [difference, setDifference] = useState(false);
  const [fitTree, setFitTree] = useState(false);
  const [hinted, setHinted] = useState<Move | null>(null);
  const [notice, setNotice] = useState('');
  const [axis, setAxis] = useState<'x' | 'y'>('x');
  const [threshold, setThreshold] = useState(4);
  const [paint, setPaint] = useState<Color>('peach');
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [soundEnabled, setSoundEnabled] = useState(readSoundEnabled);
  const audio = useRef<ReturnType<typeof createSoundPlayer> | null>(null);
  const [burst, setBurst] = useState<{ id: number; kind: Sound } | null>(null);
  const studioDraft = useRef<Tree | null>(null);
  function feedback(kind: Sound) {
    audio.current ??= createSoundPlayer(); audio.current.play(kind, soundEnabled);
    if (['swap', 'win', 'edit', 'export'].includes(kind)) setBurst(old => ({ id: (old?.id ?? 0) + 1, kind }));
  }
  useEffect(() => () => audio.current?.close(), []);
  const pick = (id: string | null) => { selectedRef.current = id; setSelected(id); };
  const match = accuracy(tree, level.target), solved = !sandbox && match === 1;
  const moves = history.length;
  const completed = Object.keys(progress).length;
  const selectedNode = selected ? find(tree, selected) : undefined;

  useEffect(() => {
    if (!solved) return;
    setProgress(old => {
      if (old[level.id] !== undefined && old[level.id] <= moves) return old;
      const next = { ...old, [level.id]: moves };
      try { localStorage.setItem('branch-bloom-progress-v1', JSON.stringify(next)); } catch { /* Playing still works if storage is unavailable. */ }
      return next;
    });
  }, [solved, level.id, moves]);
  useEffect(() => {
    if (modal) dialogRef.current?.showModal(); else dialogRef.current?.close();
  }, [modal]);
  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { pick(null); setHinted(null); }
      if ((event.ctrlKey || event.metaKey) && event.key === 'z' && !(event.target instanceof HTMLInputElement) && !(event.target instanceof HTMLSelectElement)) { event.preventDefault(); document.querySelector<HTMLButtonElement>('[data-undo]')?.click(); }
    };
    document.addEventListener('keydown', keyboard); return () => document.removeEventListener('keydown', keyboard);
  }, []);

  function load(index: number, creative = false, reset = false) {
    if (sandbox) studioDraft.current = tree;
    feedback('navigate'); setBurst(null);
    setLevelIndex(index); setSandbox(creative); setTree(creative ? (!reset && studioDraft.current) || { id: 'root', kind: 'leaf', color: 'sky' } : levels[index].initial);
    setRoute(creative ? [] : levels[index].scramble); setHistory([]); pick(null); setHinted(null); setNotice(''); setDifference(false); setModal(null);
  }
  function selectNode(id: string) {
    if (solved) return;
    if (sandbox) {
      const node = find(tree, id);
      if (node?.kind === 'split') { setAxis(node.rule.axis); setThreshold(node.rule.value); }
      if (node?.kind === 'leaf') setPaint(node.color);
      pick(id); setNotice(''); feedback('select'); return;
    }
    const previous = selectedRef.current;
    if (!previous || previous === id) { pick(previous === id ? null : id); feedback('select'); return; }
    if (!canSwap(tree, previous, id, level.mode)) {
      feedback('error'); setNotice(level.mode === 'subtrees' ? 'Choose separate branches. A branch cannot swap with its own descendant.' : 'Choose two different cards of the active type.'); pick(id); return;
    }
    swapNodes(previous, id);
  }
  function swapNodes(a: string, b: string) {
    if (solved || sandbox || !canSwap(tree, a, b, level.mode)) return;
    setHistory(old => [...old, { tree, route }]);
    const next = swap(tree, a, b, level.mode); feedback(accuracy(next, level.target) === 1 ? 'win' : 'swap');
    setTree(next); setRoute(extendRoute(route, [a, b])); pick(null); setHinted(null); setNotice('');
  }
  function undo() {
    const last = history.at(-1); if (!last) return;
    feedback('undo'); setBurst(null); setTree(last.tree); setRoute(last.route); setHistory(history.slice(0, -1)); pick(null); setHinted(null); setNotice('');
  }
  function showHint() {
    const pair = hint(tree, level, route); if (!pair) return;
    feedback('hint'); pick(null); setHinted(pair); setNotice('Try swapping the two highlighted cards. This follows a safe path back to the target.');
  }
  function edit(replacement: Tree) {
    if (!selected || JSON.stringify(find(tree, selected)) === JSON.stringify(replacement)) return;
    feedback('edit'); setHistory(old => [...old, { tree, route }]); setTree(update(tree, selected, replacement)); setNotice('');
  }
  function exportImage() {
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 512;
    const ctx = canvas.getContext('2d')!;
    pixels(tree).forEach((color, i) => { ctx.fillStyle = palette[color].hex; ctx.fillRect((i % 8) * 64, Math.floor(i / 8) * 64, 64, 64); });
    feedback('export'); const anchor = document.createElement('a'); anchor.download = 'branch-and-bloom.png'; anchor.href = canvas.toDataURL(); anchor.click();
  }

  return <div className={`app-shell ${compact ? 'compact-play' : ''}`}>
    <header className="site-header"><a className="brand" href="#" onClick={event => { event.preventDefault(); load(levelIndex); }} aria-label="Branch and Bloom home"><span className="brand-mark"><GitBranch size={23} /></span><span>branch<span className="brand-amp"> & </span>bloom<span className="brand-dot">.</span></span></a>
      <nav aria-label="Main navigation"><button className={!sandbox ? 'nav-active' : ''} onClick={() => sandbox ? load(levelIndex) : setModal('levels')}>The puzzles</button><button className={sandbox ? 'nav-active' : ''} onClick={() => { if (!sandbox) load(levelIndex, true); }}>Creative studio <span className="nav-badge">PLAY</span></button></nav>
      <button className="sound-button" aria-label={soundEnabled ? 'Mute sound' : 'Enable sound'} aria-pressed={soundEnabled} onClick={() => { const enabled = !soundEnabled; setSoundEnabled(enabled); saveSoundEnabled(enabled); if (enabled) { audio.current ??= createSoundPlayer(); audio.current.play('select'); } }}>{soundEnabled ? <Volume2 size={17} /> : <VolumeX size={17} />}</button>
      <button className="help-button" aria-label="How to play" onClick={() => setModal('help')}><HelpCircle size={17} /><span>How to play</span></button>
    </header>

    <main>
      <div className="intro"><div><div className="eyebrow"><span /> A LITTLE LOGIC. A LITTLE PIXEL ART.</div><h1>Small decisions.<br className="mobile-break" /> <em>Beautiful pictures.</em></h1><p>Untangle the tree. Restore the picture. Let something click.</p><button className="mobile-help" onClick={() => setModal('help')}><HelpCircle size={13} />How to play</button></div><div className="intro-doodle" aria-hidden="true"><Sprout size={53} strokeWidth={1.2} /><span>good things<br />grow in branches</span><Sparkles size={16} /></div></div>

      <div className="workspace">
        <aside className="journey"><div className="journey-heading"><span>YOUR LITTLE JOURNEY</span><span>{completed}/12</span></div><div className="journey-track"><span style={{ width: `${completed / 12 * 100}%` }} /></div>
          {chapters.map((chapter, chapterIndex) => <section className="chapter" key={chapter.title}><div className={`chapter-heading ${!sandbox && Math.floor(levelIndex / 4) === chapterIndex ? 'current-chapter' : ''}`}><chapter.icon size={17} /><div><h2>{chapter.title}</h2><p>{chapter.subtitle}</p></div><span className="chapter-number">0{chapterIndex + 1}</span></div><div className="chapter-levels">{levels.slice(chapterIndex * 4, chapterIndex * 4 + 4).map(l => <button key={l.id} onClick={() => load(l.id - 1)} className={!sandbox && l.id === level.id ? 'level-active' : ''} aria-current={!sandbox && l.id === level.id ? 'step' : undefined}><span className={`level-circle ${progress[l.id] !== undefined ? 'complete' : ''}`}>{progress[l.id] !== undefined ? <Check size={11} /> : String(l.id).padStart(2, '0')}</span><span>{l.title}</span>{progress[l.id] !== undefined && <span className="level-earned">✦</span>}</button>)}</div></section>)}
          <div className="journey-footer"><Leaf size={17} /><p>No timer. No rush.<br />Just you and a little logic.</p></div>
        </aside>

        <div className="game-main">
          <section className="puzzle-header"><div><button className="level-picker" onClick={() => setModal('levels')}>{sandbox ? 'YOUR OWN LITTLE WORLD' : `CHAPTER ${Math.floor(levelIndex / 4) + 1} / PUZZLE ${String(level.id).padStart(2, '0')}`}<ChevronDown size={13} /></button><h2>{sandbox ? 'The creative studio' : level.title}</h2><p>{sandbox ? 'Build a tree. See what grows.' : level.subtitle}</p></div><div className="mode-tag">{sandbox ? <Palette size={14} /> : level.mode === 'leaves' ? <Palette size={14} /> : level.mode === 'rules' ? <GitBranch size={14} /> : <Layers size={14} />}{sandbox ? 'Free play' : level.mode === 'leaves' ? 'Color swap' : level.mode === 'rules' ? 'Rule swap' : 'Subtree swap'}</div></section>

          <div className={`game-board ${sandbox ? 'studio-board' : ''}`}>
            <section className="picture-panel" aria-label="Picture comparison">
              {!sandbox && <div className="picture-section"><div className="panel-label"><span><span className="tiny-dot target-dot" />THE TARGET</span><span>8 × 8</span></div><PixelPicture tree={level.target} label="Target pixel art to recreate" /><p className="picture-caption">A little inspiration.</p></div>}
              {!sandbox && <div className="picture-divider"><span /><ArrowDown size={15} /><span /></div>}
              <div className="picture-section"><div className="panel-label"><span><span className="tiny-dot live-dot" />{sandbox ? 'YOUR CANVAS' : 'YOUR PICTURE'}</span><span className="live-label">LIVE</span></div><PixelPicture tree={tree} target={level.target} selected={sandbox ? null : selected} difference={!sandbox && difference} label={sandbox ? 'Your pixel art canvas' : `Your picture, ${Math.round(match * 100)} percent matching`} /><p className="picture-caption">{sandbox ? 'Every branch paints a possibility.' : solved ? 'Right where everything belongs.' : 'A work in progress.'}</p></div>
              {!sandbox && <label className="difference-toggle" title="Highlight mismatched pixels"><input type="checkbox" checked={difference} onChange={e => setDifference(e.target.checked)} /><span>Highlight mismatched pixels</span></label>}
              {sandbox && <button className="button secondary export-button" onClick={exportImage}><Download size={15} />Save picture</button>}
            </section>

            <section className="logic-panel" aria-label="Decision tree editor">
              {burst && <div key={burst.id} className={`feedback-burst feedback-${burst.kind}`} aria-hidden="true">{Array.from({ length: burst.kind === 'win' ? 16 : 6 }, (_, i) => <i key={i} style={{ '--angle': `${i * 137.5}deg`, '--distance': `${32 + i % 4 * 17}px`, '--delay': `${i % 4 * 25}ms` } as React.CSSProperties} />)}{burst.kind === 'win' && <span>Beautifully done!</span>}</div>}
              <div className="logic-toolbar"><div className="panel-label"><GitBranch size={15} /><span>YOUR DECISION TREE</span></div><span className="node-count">{nodes(tree).length} nodes <button className="fit-button" aria-label={fitTree ? 'Show tree at actual size' : 'Fit whole tree'} aria-pressed={fitTree} onClick={() => setFitTree(!fitTree)}><Maximize2 size={13} />{compact ? fitTree ? 'Branches' : 'Overview' : fitTree ? '100%' : 'Fit'}</button></span></div>
              <div className="stats-row">{sandbox ? <><div><strong>{nodes(tree).filter(n => n.kind === 'split').length}</strong><span>decisions</span></div><div><strong>{nodes(tree).filter(n => n.kind === 'leaf').length}</strong><span>color leaves</span></div><div><strong>8 × 8</strong><span>possibilities</span></div></> : <><div className={solved ? 'stat-success' : ''}><strong>{Math.round(match * 100)}<small>%</small></strong><span>picture match</span></div><div><strong>{moves.toString().padStart(2, '0')}</strong><span>{moves === 1 ? 'swap made' : 'swaps made'}</span></div><div><strong>{level.par}<small>{level.par === 1 ? ' swap' : ' swaps'}</small></strong><span>three-star target</span></div></>}</div>
              <div className={`tree-area ${solved ? 'tree-solved' : ''}`}><TreeView tree={tree} selected={selected} onSelect={selectNode} onSwap={swapNodes} level={level} sandbox={sandbox} hinted={hinted} fit={fitTree} compact={compact} onExplore={() => setFitTree(false)} />
                {!sandbox && <div className="tree-legend"><span><GitBranch size={12} /> A question</span><span><span className="legend-square" /> A color</span><span>yes ← → no</span><span className="pan-tip">{compact ? 'Open a branch to explore' : 'Scroll sideways to explore'}</span></div>}
              </div>

              {sandbox ? <div className="studio-controls"><div className="studio-controls-title"><Scissors size={16} /><strong>{selectedNode ? selectedNode.kind === 'leaf' ? 'Make this region yours' : 'Edit this decision' : 'Select a card to start creating'}</strong></div><p>Questions use the full canvas coordinates, from 0 to 7.</p>
                <div className="swatches">{Object.entries(palette).map(([key, value]) => <button key={key} className={paint === key ? 'swatch active-swatch' : 'swatch'} style={{ background: value.hex }} aria-label={`Paint ${value.label}`} aria-pressed={paint === key} onClick={() => { setPaint(key as Color); if (selectedNode?.kind === 'leaf') edit({ ...selectedNode, color: key as Color }); }}>{paint === key && <Check size={14} />}</button>)}</div>
                <div className="split-controls"><label>Axis<select aria-label="Split axis" value={axis} onChange={e => setAxis(e.target.value as 'x' | 'y')}><option value="x">{compact ? 'x' : 'x (vertical)'}</option><option value="y">{compact ? 'y' : 'y (horizontal)'}</option></select></label><label>Split at<select aria-label="Split coordinate" value={threshold} onChange={e => setThreshold(Number(e.target.value))}>{[1, 2, 3, 4, 5, 6, 7].map(n => <option key={n}>{n}</option>)}</select></label><button className="button primary" disabled={!selectedNode || (selectedNode.kind === 'leaf' && nodes(tree).length >= 31)} onClick={() => {
                  if (!selectedNode) return;
                  if (selectedNode.kind === 'split') edit({ ...selectedNode, rule: { axis, value: threshold } });
                  else { const uid = crypto.randomUUID(); edit({ id: selectedNode.id, kind: 'split', rule: { axis, value: threshold }, yes: { ...selectedNode, id: `${uid}-yes` }, no: { id: `${uid}-no`, kind: 'leaf', color: paint } }); }
                }}>{selectedNode?.kind === 'split' ? 'Update rule' : 'Split region'}</button></div>
                {selectedNode?.kind === 'split' && <button className="text-button" onClick={() => edit({ id: selectedNode.id, kind: 'leaf', color: paint })}>Collapse branch to selected color</button>}<span className="studio-limit">Up to 31 nodes. Select a leaf to paint, or split it into two regions.</span>
              </div> : <div className={`instruction-card ${solved ? 'success-card' : ''}`} aria-live="polite">{solved ? <><span className="instruction-icon"><Check size={21} /></span><div><strong>{level.id === 12 ? 'A beautiful finish.' : 'Everything clicked.'}</strong><p>Picture restored in {moves} {moves === 1 ? 'swap' : 'swaps'}. <StarRow count={stars(moves, level.par)} /></p></div></> : <><span className="instruction-icon"><MousePointer2 size={19} /></span><div><strong>{selected ? compact && selectedNode ? `${selectedNode.kind === 'leaf' ? palette[selectedNode.color].label : `${selectedNode.rule.axis} < ${selectedNode.rule.value}`} selected` : 'Now pick its new home.' : level.mode === 'leaves' ? 'Two colors. One little swap.' : level.mode === 'rules' ? 'Right question, wrong place.' : 'A branch brings its whole world.'}</strong><p>{selected ? compact ? 'Explore another branch to find its swap. Tap again to cancel.' : 'Tap another compatible card to swap. Tap the selected card to cancel.' : level.mode === 'leaves' ? 'Tap a color leaf, then tap another to swap their colors.' : level.mode === 'rules' ? 'Tap two question cards to swap their rules. Their children stay put.' : 'Tap two separate branches to swap them, including all their children.'}</p></div></>}</div>}

              <div className="game-actions"><div><button className="icon-action" data-undo onClick={undo} disabled={!history.length} title="Undo (Ctrl or ⌘ Z)"><Undo2 size={16} /><span>Undo</span></button><button className="icon-action" onClick={() => load(levelIndex, sandbox, true)} disabled={!history.length && !selected && !hinted && (!sandbox || (tree.kind === 'leaf' && tree.color === 'sky'))}><RotateCcw size={15} /><span>Reset</span></button></div>{sandbox ? <span className="studio-note"><Sprout size={15} /> Make something small & lovely.</span> : solved ? <button className="button primary" onClick={() => levelIndex < levels.length - 1 ? load(levelIndex + 1) : setModal('levels')}>{levelIndex < 11 ? 'Next puzzle' : 'See your journey'}<ArrowRight size={15} /></button> : <button className="hint-button" onClick={showHint}><Lightbulb size={16} />A little hint</button>}</div>
              <div className="notice" role="status">{notice}</div>
            </section>
          </div>

          <div className="below-board"><span><Lightbulb size={15} /><strong>A thought to grow on</strong></span><p>{sandbox ? 'Each question divides space. Each leaf paints it. What can you draw with fewer decisions?' : level.mode === 'leaves' ? 'Every path ends in a color. Follow the questions from the root to see which pixels it paints.' : level.mode === 'rules' ? 'x moves across. y moves down. A question like x < 4 means “is this pixel in the left half?”' : 'A subtree is a small program of its own. Moving it changes where all of its decisions are made.'}</p></div>
          <div className="puzzle-navigation"><button onClick={() => load(Math.max(0, levelIndex - 1))} disabled={levelIndex === 0 || sandbox}><ArrowLeft size={14} />Previous puzzle</button><span>{sandbox ? 'A blank canvas, an open mind.' : `${String(level.id).padStart(2, '0')} / 12`}</span><button onClick={() => load(Math.min(11, levelIndex + 1))} disabled={levelIndex === 11 || sandbox}>Next puzzle<ArrowRight size={14} /></button></div>
        </div>
      </div>
    </main>
    <footer className="site-footer"><span><GitBranch size={14} />Made of little decisions.</span><a href="https://github.com/MisterTea/decision_tree_game" target="_blank" rel="noreferrer">View on GitHub <ArrowRight size={12} /></a><span>A puzzle by MisterTea</span></footer>

    <dialog aria-label={modal === 'help' ? 'How to play' : 'Choose a puzzle'} ref={dialogRef} onCancel={() => setModal(null)} onClick={event => { if (event.target === event.currentTarget) setModal(null); }}><div className="modal-content"><button className="modal-close" onClick={() => setModal(null)} aria-label="Close dialog"><X size={21} /></button>{modal === 'help' ? <><span className="modal-icon"><Sprout size={28} /></span><div className="eyebrow">WELCOME TO BRANCH & BLOOM</div><h2>A picture made of decisions.</h2><p>Each pixel travels down a tree of questions. A question like <code>x &lt; 4</code> sends pixels in columns 0–3 left (yes), and columns 4–7 right (no). A color leaf paints every pixel that reaches it.</p><div className="help-example"><span>x &lt; 4</span><span>↙ yes &nbsp; &nbsp; no ↘</span><div><i style={{ background: palette.sky.hex }} /><i style={{ background: palette.peach.hex }} /></div></div><ol><li><strong>Look at the target.</strong> Recreate its colors and shapes with the tree you have.</li><li><strong>Tap two cards to swap.</strong> Use a mouse or touch. You can also drag one card onto another, or use Tab and Enter.</li><li><strong>Let the tree grow with you.</strong> Start with color leaves, graduate to rules, then move entire subtrees.</li></ol><p>On phones, open a branch to explore its children. Use Up, Root, or the tree selector to move around. Your selected card stays selected while you explore. Overview shows the entire tree; Branches returns to readable cards.</p><p>Coordinates start at 0 in the top-left. x goes right; y goes down. Questions always use the full canvas coordinates.</p><p>Earn three stars by matching the target within the swap target. There’s no move limit: take your time, undo freely, and use hints when you need them. Progress saves in this browser when storage is available.</p><button className="button primary" onClick={() => setModal(null)}>Let’s make something click<ArrowRight size={16} /></button></> : <><div className="eyebrow">TWELVE LITTLE MOMENTS OF CLARITY</div><h2>Your growing collection.</h2><p>{completed} of 12 pictures restored. Every puzzle is ready whenever you are.</p>{chapters.map((chapter, i) => <div className="level-collection" key={chapter.title}><h3><chapter.icon size={17} />{chapter.title}<span>{chapter.subtitle}</span></h3><div className="level-grid">{levels.slice(i * 4, i * 4 + 4).map(l => <button key={l.id} onClick={() => load(l.id - 1)}><PixelPicture tree={l.target} label={`Preview: ${l.title}`} /><span className="collection-level">{String(l.id).padStart(2, '0')}</span><strong>{l.title}</strong><StarRow count={progress[l.id] !== undefined ? stars(progress[l.id], l.par) : 0} /></button>)}</div></div>)}</>}</div></dialog>
  </div>;
}

