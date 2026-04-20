// === Setup detail view ===

function buildTree(files) {
  // group files by their top-level directory (or root)
  const root = { name: "", children: {}, files: [] };
  for (const f of files) {
    const parts = f.path.split('/');
    if (parts.length === 1) {
      root.files.push(f);
    } else {
      const dir = parts[0];
      if (!root.children[dir]) root.children[dir] = { name: dir, files: [] };
      root.children[dir].files.push({ ...f, leaf: parts.slice(1).join('/') });
    }
  }
  return root;
}

function renderMarkdown(md) {
  // Minimal, safe-ish markdown renderer for the overview field.
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const lines = md.split('\n');
  const out = [];
  let inList = false;
  let inOrdered = false;
  let inCode = false;
  let codeBuf = [];

  const closeList = () => { if (inList) { out.push('</ul>'); inList = false; } if (inOrdered) { out.push('</ol>'); inOrdered = false; } };

  const inline = (s) => {
    s = esc(s);
    s = s.replace(/`([^`]+)`/g, '<code class="md-code">$1</code>');
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
    return s;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('```')) {
      if (inCode) { out.push('<pre class="md-pre mono"><code>' + esc(codeBuf.join('\n')) + '</code></pre>'); codeBuf = []; inCode = false; }
      else { closeList(); inCode = true; }
      continue;
    }
    if (inCode) { codeBuf.push(line); continue; }

    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) { closeList(); out.push(`<h${h[1].length+1} class="md-h${h[1].length}">${inline(h[2])}</h${h[1].length+1}>`); continue; }

    const ul = line.match(/^[-*]\s+(.*)$/);
    if (ul) { if (!inList) { closeList(); out.push('<ul class="md-ul">'); inList = true; } out.push('<li>' + inline(ul[1]) + '</li>'); continue; }

    const ol = line.match(/^(\d+)\.\s+(.*)$/);
    if (ol) { if (!inOrdered) { closeList(); out.push('<ol class="md-ol">'); inOrdered = true; } out.push('<li>' + inline(ol[2]) + '</li>'); continue; }

    if (line.trim() === '') { closeList(); continue; }

    closeList();
    out.push('<p class="md-p">' + inline(line) + '</p>');
  }
  closeList();
  if (inCode) out.push('<pre class="md-pre mono"><code>' + esc(codeBuf.join('\n')) + '</code></pre>');
  return out.join('\n');
}

function highlight(code, kind) {
  // very lightweight syntax highlighter — tokens only, no parser
  const escape = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  let html = escape(code);

  if (kind === 'sh') {
    html = html.replace(/(^|\n)(#.*)/g, '$1<span class="tok-com">$2</span>');
    html = html.replace(/\b(if|then|fi|for|in|do|done|else|elif|while|case|esac|set|echo|exit|grep|cat|rm|mkdir|cd)\b/g, '<span class="tok-kw">$1</span>');
    html = html.replace(/(\$\{?[A-Za-z_][A-Za-z0-9_]*\}?)/g, '<span class="tok-var">$1</span>');
    html = html.replace(/(&quot;[^&]*?&quot;|&#39;[^&]*?&#39;)/g, '<span class="tok-str">$1</span>');
  } else if (kind === 'md') {
    html = html.replace(/(^|\n)(#{1,6} .*)/g, '$1<span class="tok-head">$2</span>');
    html = html.replace(/(`[^`\n]+`)/g, '<span class="tok-code">$1</span>');
    html = html.replace(/(^|\n)(- .*)/g, '$1<span class="tok-list">$2</span>');
    html = html.replace(/\*\*([^*]+)\*\*/g, '<span class="tok-bold">$1</span>');
  }
  return html;
}

function FileTree({ files, active, onSelect }) {
  const tree = React.useMemo(() => buildTree(files), [files]);
  return (
    <nav className="filetree">
      {tree.files.map(f => (
        <button
          key={f.path}
          className={"ft-file " + (active === f.path ? "is-active" : "")}
          onClick={() => onSelect(f.path)}
        >
          <span className="ft-icon">{Icons.file}</span>
          <span className="ft-name">{f.path}</span>
        </button>
      ))}
      {Object.values(tree.children).map(dir => (
        <div key={dir.name} className="ft-dir">
          <div className="ft-dir-label">
            <span className="ft-icon">{Icons.folder}</span>
            <span>{dir.name}/</span>
            <span className="ft-dir-count">{dir.files.length}</span>
          </div>
          {dir.files.map(f => (
            <button
              key={f.path}
              className={"ft-file ft-file-nested " + (active === f.path ? "is-active" : "")}
              onClick={() => onSelect(f.path)}
            >
              <span className="ft-icon">{Icons.file}</span>
              <span className="ft-name">{f.leaf}</span>
            </button>
          ))}
        </div>
      ))}
    </nav>
  );
}

function FileViewer({ file }) {
  if (!file) return <div className="fv-empty">Selecione um arquivo na árvore.</div>;
  const html = highlight(file.content, file.kind);
  const lines = file.content.split('\n').length;
  return (
    <div className="fileviewer">
      <div className="fv-header">
        <div className="fv-path mono">{file.path}</div>
        <div className="fv-meta">
          <span>{lines} linhas</span>
          <span className="fv-kind">{file.kind}</span>
        </div>
      </div>
      <pre className="fv-code mono"><code dangerouslySetInnerHTML={{ __html: html }} /></pre>
    </div>
  );
}

function Section({ title, count, children }) {
  return (
    <section className="vsection">
      <header className="vsection-head">
        <h2>{title}</h2>
        {count != null && <span className="vsection-count">{count}</span>}
      </header>
      {children}
    </section>
  );
}

function ViewPage({ slug, onBack }) {
  const setup = SETUPS_DATA.find(s => s.slug === slug);
  const [activeFile, setActiveFile] = React.useState(setup?.files?.[0]?.path);

  React.useEffect(() => {
    if (setup) setActiveFile(setup.files[0]?.path);
    window.scrollTo(0, 0);
  }, [slug]);

  if (!setup) {
    return (
      <div className="notfound">
        <p>Setup não encontrado.</p>
        <button className="btn-ghost" onClick={onBack}>{Icons.back} voltar para a galeria</button>
      </div>
    );
  }

  const file = setup.files.find(f => f.path === activeFile);
  const mirrorCmd = `npx -y claude-setups mirror ${setup.author}/${setup.slug}`;

  return (
    <div className="view">
      <button className="backlink" onClick={onBack}>
        {Icons.back} voltar para a galeria
      </button>

      <header className="view-hero">
        <div className="view-hero-left">
          <div className="view-author-row">
            <Avatar setup={setup} size={52} />
            <div>
              <div className="view-author-name">{setup.authorName}</div>
              <div className="view-author-handle">@{setup.author} · publicado em {new Date(setup.published).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
            </div>
            <a
              className="btn-ghost btn-ghost-sm"
              href={`https://github.com/${setup.author}`}
              target="_blank" rel="noreferrer"
            >
              {Icons.github} GitHub
            </a>
          </div>

          <h1 className="view-title">{setup.title}</h1>
          <p className="view-desc">{setup.description}</p>

          <div className="view-tags">
            <Badge>{setup.specialty}</Badge>
            {setup.tags.map(t => <Badge key={t} muted>#{t}</Badge>)}
          </div>

          <div className="view-cta">
            <CopyCmd cmd={mirrorCmd} size="lg" />
            <span className="view-mirrors">{setup.mirrors.toLocaleString('pt-BR')} pessoas já clonaram</span>
          </div>
        </div>

        <aside className="view-stats-card">
          <div className="vsc-title">no pacote</div>
          <div className="vsc-grid">
            <div><span className="vsc-n">{setup.stats.plugins}</span><span className="vsc-l">plugins</span></div>
            <div><span className="vsc-n">{setup.stats.mcps}</span><span className="vsc-l">MCPs</span></div>
            <div><span className="vsc-n">{setup.stats.hooks}</span><span className="vsc-l">hooks</span></div>
            <div><span className="vsc-n">{setup.stats.skills}</span><span className="vsc-l">skills</span></div>
          </div>
        </aside>
      </header>

      {setup.overview && (
        <Section title="Overview">
          <div className="overview" dangerouslySetInnerHTML={{ __html: renderMarkdown(setup.overview) }} />
        </Section>
      )}

      <Section title="Plugins" count={setup.plugins.length}>
        <ul className="plugin-list">
          {setup.plugins.map(p => (
            <li key={p.name} className="plugin-row">
              <span className="plugin-icon">{Icons.plug}</span>
              <span className="plugin-name mono">{p.name}</span>
              <span className="plugin-version mono">v{p.version}</span>
              <span className="plugin-from">{p.from}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="MCP servers" count={setup.mcps.length}>
        <ul className="mcp-list">
          {setup.mcps.map(m => (
            <li key={m.name} className="mcp-row">
              <div className="mcp-name-wrap">
                <span className="mcp-bullet">{Icons.mcp}</span>
                <span className="mcp-name mono">{m.name}</span>
              </div>
              <code className="mcp-cmd mono">{m.cmd}</code>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Bundle" count={setup.files.length}>
        <div className="bundle">
          <FileTree files={setup.files} active={activeFile} onSelect={setActiveFile} />
          <FileViewer file={file} />
        </div>
      </Section>
    </div>
  );
}

Object.assign(window, { ViewPage });
