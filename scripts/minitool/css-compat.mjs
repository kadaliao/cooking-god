/**
 * 小工具 CSS 兼容处理（构建后对最终 CSS 运行）：让 Chrome 61 / 旧版 WebView 也有可用的基线样式。
 *
 * 只做“声明级回退”，原样式保留给新内核：
 * 1. flex 的 gap（Chrome 84）：生成 html.no-flexgap 下的 margin 回退规则，运行时检测到不支持才启用
 * 2. grid 的 gap（Chrome 66）：前面补一条 grid-gap / grid-row-gap / grid-column-gap
 * 3. dvh/svh/lvh（Chrome 108）：前面补一条 vh 写法
 * 4. min()/max()/clamp()（Chrome 79）：前面补一条按 390×844 手机屏算好的固定值
 * 5. env()（Chrome 69）：前面补一条用 env 回退值（或 0）的写法
 * 另外检查独立的 translate/rotate/scale 属性和 @supports 之外的 aspect-ratio，发现就报错，
 * 这些没法自动回退，要在源码里改写。
 */

const REF_W = 390;
const REF_H = 844;

// ───────── 极简 CSS 解析（输入是 Lightning CSS 压缩后的产物）─────────

function parseBlocks(css) {
  const nodes = [];
  let i = 0;
  while (i < css.length) {
    while (i < css.length && /\s/.test(css[i])) i++;
    if (i >= css.length) break;
    const start = i;
    let depth = 0;
    let quote = null;
    while (i < css.length) {
      const c = css[i];
      if (quote) {
        if (c === '\\') i++;
        else if (c === quote) quote = null;
      } else if (c === '"' || c === "'") quote = c;
      else if (c === '(') depth++;
      else if (c === ')') depth--;
      else if (c === '{' && depth === 0) break;
      else if (c === ';' && depth === 0) break;
      i++;
    }
    const prelude = css.slice(start, i).trim();
    if (css[i] === ';') {
      nodes.push({ type: 'statement', text: prelude + ';' });
      i++;
      continue;
    }
    // 找到配对的 }
    const bodyStart = ++i;
    let level = 1;
    quote = null;
    while (i < css.length && level > 0) {
      const c = css[i];
      if (quote) {
        if (c === '\\') i++;
        else if (c === quote) quote = null;
      } else if (c === '"' || c === "'") quote = c;
      else if (c === '{') level++;
      else if (c === '}') level--;
      i++;
    }
    const body = css.slice(bodyStart, i - 1);
    if (/^@(media|supports|layer|container)\b/.test(prelude)) nodes.push({ type: 'group', prelude, children: parseBlocks(body) });
    else if (prelude.startsWith('@')) nodes.push({ type: 'raw', prelude, body });
    else nodes.push({ type: 'rule', prelude, decls: splitDecls(body) });
  }
  return nodes;
}

function splitTop(s, sep) {
  const out = [];
  let depth = 0;
  let quote = null;
  let start = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quote) {
      if (c === '\\') i++;
      else if (c === quote) quote = null;
    } else if (c === '"' || c === "'") quote = c;
    else if (c === '(' || c === '[') depth++;
    else if (c === ')' || c === ']') depth--;
    else if (c === sep && depth === 0) {
      out.push(s.slice(start, i));
      start = i + 1;
    }
  }
  out.push(s.slice(start));
  return out.map((x) => x.trim()).filter(Boolean);
}

function splitDecls(body) {
  return splitTop(body, ';').map((d) => {
    const k = d.indexOf(':');
    return { prop: d.slice(0, k).trim(), value: d.slice(k + 1).trim() };
  });
}

function serialize(nodes) {
  return nodes
    .map((n) => {
      if (n.type === 'statement') return n.text;
      if (n.type === 'raw') return `${n.prelude}{${n.body}}`;
      if (n.type === 'group') return `${n.prelude}{${serialize(n.children)}}`;
      return `${n.prelude}{${n.decls.map((d) => `${d.prop}:${d.value}`).join(';')}}`;
    })
    .join('');
}

// ───────── 数值回退 ─────────

function toPx(arg) {
  const m = /^(-?[\d.]+)(px|vw|vh|dvh|svh|lvh)?$/.exec(arg.trim());
  if (!m) return null;
  const n = parseFloat(m[1]);
  const unit = m[2] || (n === 0 ? 'px' : null);
  if (unit === 'px') return n;
  if (unit === 'vw') return (n * REF_W) / 100;
  if (unit && unit.endsWith('vh')) return (n * REF_H) / 100;
  return null;
}
const fmt = (px) => `${Math.round(px * 100) / 100}px`;

/** 把一个 min()/max()/clamp() 表达式换成手机参考屏下的值；算不出时用启发式（min 取相对单位，max 取 px）。 */
function evalFn(name, inner) {
  const args = splitTop(inner, ',').map(resolveMath);
  const px = args.map(toPx);
  if (px.every((v) => v !== null)) {
    if (name === 'min') return fmt(Math.min(...px));
    if (name === 'max') return fmt(Math.max(...px));
    return fmt(Math.min(Math.max(px[0], px[1]), px[2]));
  }
  if (name === 'min') return args.find((a) => /%|vw|vh/.test(a)) ?? args[0];
  if (name === 'max') return args.find((a) => /px$/.test(a)) ?? args[0];
  return args[1];
}

function resolveMath(value) {
  let out = value;
  for (let guard = 0; guard < 20; guard++) {
    const m = /(?<![\w-])(min|max|clamp)\(/.exec(out);
    if (!m) break;
    let depth = 1;
    let i = m.index + m[0].length;
    for (; i < out.length && depth; i++) {
      if (out[i] === '(') depth++;
      else if (out[i] === ')') depth--;
    }
    const inner = out.slice(m.index + m[0].length, i - 1);
    out = out.slice(0, m.index) + evalFn(m[1], inner) + out.slice(i);
  }
  return out;
}

function envFallback(value) {
  return value.replace(/env\(\s*[\w-]+\s*(?:,\s*([^()]*(?:\([^()]*\))?[^()]*))?\)/g, (_, fb) => (fb ? fb.trim() : '0px'));
}

// ───────── flex gap 回退 ─────────

const isFlex = (d) => d === 'flex' || d === 'inline-flex';

function gapsOf(state) {
  return { row: state.rowGap ?? '0', col: state.colGap ?? '0' };
}

function readState(decls, base = {}) {
  const st = { ...base };
  let touched = false;
  for (const { prop, value } of decls) {
    if (prop === 'display') (st.display = value), (touched = true);
    else if (prop === 'flex-direction') (st.dir = value), (touched = true);
    else if (prop === 'flex-wrap') (st.wrap = value), (touched = true);
    else if (prop === 'flex-flow') {
      for (const part of value.split(/\s+/)) {
        if (/row|column/.test(part)) st.dir = part;
        if (/wrap/.test(part)) st.wrap = part;
      }
      touched = true;
    } else if (prop === 'gap') {
      const [r, c] = splitTop(value, ' ').length > 1 ? value.split(/\s+/) : [value, value];
      st.rowGap = r;
      st.colGap = c ?? r;
      touched = true;
    } else if (prop === 'row-gap') (st.rowGap = value), (touched = true);
    else if (prop === 'column-gap') (st.colGap = value), (touched = true);
  }
  return { st, touched };
}

function modeOf(st) {
  if (!isFlex(st.display)) return null;
  const { row, col } = gapsOf(st);
  const zero = (v) => /^0(px)?$/.test(v) || v === 'normal';
  if (zero(row) && zero(col)) return null;
  const wrap = st.wrap && st.wrap !== 'nowrap';
  const column = (st.dir || 'row').startsWith('column');
  const reverse = (st.dir || '').endsWith('reverse');
  if (wrap) return { kind: 'wrap', row, col };
  if (column) return { kind: reverse ? 'col-rev' : 'col', gap: zero(row) ? '0' : row };
  return { kind: reverse ? 'row-rev' : 'row', gap: zero(col) ? '0' : col };
}

function fallbackRules(sel, mode, prevMode) {
  const pre = `html.no-flexgap ${sel}`;
  const rules = [];
  // 换了方向时，先把上一档生成的 margin 清掉
  if (prevMode && prevMode.kind !== (mode && mode.kind)) {
    if (prevMode.kind === 'wrap') rules.push(`${pre}>*{margin-right:0;margin-bottom:0}`);
    else rules.push(`${pre}>*+*{margin-left:0;margin-top:0;margin-right:0;margin-bottom:0}`);
  }
  if (!mode) return rules;
  switch (mode.kind) {
    case 'row':
      rules.push(`${pre}>*+*{margin-left:${mode.gap}}`);
      break;
    case 'row-rev':
      rules.push(`${pre}>*+*{margin-right:${mode.gap}}`);
      break;
    case 'col':
      rules.push(`${pre}>*+*{margin-top:${mode.gap}}`);
      break;
    case 'col-rev':
      rules.push(`${pre}>*+*{margin-bottom:${mode.gap}}`);
      break;
    case 'wrap':
      // 每项右边、下边留间距；最后一项不留右边距，避免单行时多出来的宽度把它挤到下一行
      rules.push(`${pre}>*{margin-right:${mode.col};margin-bottom:${mode.row}}`, `${pre}>:last-child{margin-right:0}`);
      break;
  }
  return rules;
}

const mediaWidth = (prelude) => {
  const m = /^@media\s*\(max-width:\s*(\d+)px\)$/.exec(prelude.trim());
  return m ? Number(m[1]) : null;
};

// ───────── 主流程 ─────────

export function compatCss(css) {
  const tree = parseBlocks(css);
  const problems = [];
  const stats = { flexGapSelectors: 0, gridGap: 0, viewportUnits: 0, mathFns: 0, env: 0 };

  // 1) 收集每个选择器在各上下文里的 display / 方向 / gap
  const contexts = [{ prelude: '', rules: tree.filter((n) => n.type === 'rule') }];
  for (const n of tree) if (n.type === 'group' && n.prelude.startsWith('@media')) contexts.push({ prelude: n.prelude, rules: n.children.filter((c) => c.type === 'rule') });

  const baseState = new Map();
  const ctxStates = contexts.map(() => new Map());
  contexts.forEach((ctx, ci) => {
    for (const rule of ctx.rules) {
      for (const sel of splitTop(rule.prelude, ',')) {
        const map = ci === 0 ? baseState : ctxStates[ci];
        const { st, touched } = readState(rule.decls, map.get(sel) || {});
        if (touched) map.set(sel, st);
      }
    }
  });

  const effective = (sel, ci) => {
    let st = { ...(baseState.get(sel) || {}) };
    if (ci === 0) return st;
    const w = mediaWidth(contexts[ci].prelude);
    contexts.forEach((ctx, cj) => {
      if (cj === 0 || cj > ci) return;
      const wj = mediaWidth(ctx.prelude);
      const applies = cj === ci || (w !== null && wj !== null && wj >= w);
      if (applies && ctxStates[cj].has(sel)) st = { ...st, ...ctxStates[cj].get(sel) };
    });
    return st;
  };

  const flexFallback = contexts.map(() => []);
  const allSels = new Set([...baseState.keys(), ...ctxStates.flatMap((m) => [...m.keys()])]);
  for (const sel of allSels) {
    if (sel.includes('::') || sel.startsWith('@')) continue;
    let prevMode = null;
    let counted = false;
    contexts.forEach((ctx, ci) => {
      if (ci > 0 && !ctxStates[ci].has(sel)) return;
      const st = effective(sel, ci);
      const mode = modeOf(st);
      if (!mode && !prevMode) return;
      if (mode && st.display && !isFlex(st.display)) return;
      const rules = fallbackRules(sel, mode, prevMode);
      if (rules.length) {
        flexFallback[ci].push(...rules);
        if (!counted) (stats.flexGapSelectors++, (counted = true));
      }
      // 只有宽度断点会和后面的断点叠加
      if (ci === 0 || mediaWidth(ctx.prelude) !== null) prevMode = mode;
    });
  }

  // 2) 声明级回退
  const gridSels = new Set([...allSels].filter((s) => /grid/.test(baseState.get(s)?.display || '') || ctxStates.some((m) => /grid/.test(m.get(s)?.display || ''))));
  const visit = (nodes, inSupports) => {
    for (const n of nodes) {
      if (n.type === 'group') {
        visit(n.children, inSupports || n.prelude.startsWith('@supports'));
        continue;
      }
      if (n.type !== 'rule') continue;
      const sels = splitTop(n.prelude, ',');
      const isGrid = sels.some((s) => gridSels.has(s)) || n.decls.some((d) => d.prop === 'display' && /grid/.test(d.value));
      const out = [];
      for (const d of n.decls) {
        const { prop, value } = d;
        if (/^(translate|rotate|scale)$/.test(prop)) problems.push(`${n.prelude}{${prop}:${value}} 独立变换属性 Chrome 104 才支持，请改写`);
        if (prop === 'aspect-ratio' && !inSupports) problems.push(`${n.prelude}{aspect-ratio} 需要放进 @supports 并保留基线尺寸`);
        if (isGrid && /^(gap|row-gap|column-gap)$/.test(prop)) {
          out.push({ prop: prop === 'gap' ? 'grid-gap' : `grid-${prop}`, value });
          stats.gridGap++;
        }
        let fb = value;
        if (/\d(dvh|svh|lvh)\b/.test(fb)) {
          fb = fb.replace(/(\d)(dvh|svh|lvh)\b/g, '$1vh');
          stats.viewportUnits++;
        }
        if (/(?<![\w-])(min|max|clamp)\(/.test(fb) && !prop.startsWith('grid-template')) {
          fb = resolveMath(fb);
          stats.mathFns++;
        }
        if (/env\(/.test(fb) && !/var\(/.test(fb)) {
          fb = envFallback(fb);
          stats.env++;
        }
        if (fb !== value && !prop.startsWith('--')) out.push({ prop, value: fb });
        out.push(d);
      }
      n.decls = out;
    }
  };
  visit(tree, false);

  // 3) flex gap 回退规则：base 的接在最后，各断点的放进对应 @media 末尾
  let result = serialize(tree);
  const parts = [];
  if (flexFallback[0].length) parts.push(flexFallback[0].join(''));
  contexts.forEach((ctx, ci) => {
    if (ci > 0 && flexFallback[ci].length) parts.push(`${ctx.prelude}{${flexFallback[ci].join('')}}`);
  });
  result += parts.join('');
  return { css: result, problems, stats };
}
