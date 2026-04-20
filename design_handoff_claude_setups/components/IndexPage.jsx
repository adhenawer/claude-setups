// === Index (gallery) page ===

function Hero({ totalSetups }) {
  return (
    <section className="hero">
      <div className="hero-grid">
        <div className="hero-left">
          <div className="hero-eyebrow">
            <span className="pulse-dot" />
            <span>registry público · {totalSetups} setups compartilhados</span>
          </div>
          <h1 className="hero-title">
            Setups do <span className="ink">Claude Code</span><br/>
            feitos pela <span className="underlined">comunidade</span>.
          </h1>
          <p className="hero-sub">
            Descubra como outras pessoas configuram o Claude — hooks, instructions, skills,
            MCPs — e clone o setup inteiro de alguém com <strong>um comando</strong>.
            Seus segredos nunca saem da sua máquina.
          </p>

          <div className="hero-cta">
            <CopyCmd cmd="npx -y claude-setups publish" size="lg" />
            <a className="btn-ghost" href="https://github.com/adhenawer/claude-setups" target="_blank" rel="noreferrer">
              {Icons.github} ver no GitHub
            </a>
          </div>
        </div>

        <div className="hero-right" aria-hidden>
          <HeroVisual />
        </div>
      </div>
    </section>
  );
}

function HeroVisual() {
  // A playful "terminal meets file-tree" card stack
  return (
    <div className="hero-visual">
      <div className="hv-card hv-card-back">
        <div className="hv-header">
          <span className="dot r"/><span className="dot y"/><span className="dot g"/>
          <span className="hv-title">~/.claude/</span>
        </div>
        <div className="hv-tree mono">
          <div>├─ <span className="hv-folder">hooks/</span></div>
          <div>│  ├─ pre-commit-lint.sh</div>
          <div>│  └─ on-save-format.sh</div>
          <div>├─ <span className="hv-folder">skills/</span></div>
          <div>│  ├─ drizzle-migrate.md</div>
          <div>│  └─ test-scaffold.md</div>
          <div>├─ <span className="hv-folder">agents/</span></div>
          <div>└─ CLAUDE.md</div>
        </div>
      </div>

      <div className="hv-card hv-card-front">
        <div className="hv-header">
          <span className="dot r"/><span className="dot y"/><span className="dot g"/>
          <span className="hv-title">fullstack-zen · mirror</span>
        </div>
        <div className="hv-term mono">
          <div><span className="prompt">$</span> npx -y claude-setups mirror marina/fullstack-zen</div>
          <div className="muted">→ installing plugins (3)</div>
          <div className="muted">→ adding MCP servers (4)</div>
          <div className="muted">→ extracting bundle (21 files)</div>
          <div><span className="ok">✓</span> setup mirrored in 3.8s</div>
          <div className="blinker">▊</div>
        </div>
      </div>
    </div>
  );
}

function SpecialtyTabs({ value, onChange, counts }) {
  return (
    <div className="specialty-tabs" role="tablist">
      {SPECIALTIES.map(s => (
        <button
          key={s.id}
          role="tab"
          aria-selected={value === s.id}
          className={"spec-tab " + (value === s.id ? "is-active" : "")}
          onClick={() => onChange(s.id)}
        >
          {s.label}
          <span className="spec-count">{counts[s.id] ?? 0}</span>
        </button>
      ))}
    </div>
  );
}

function SearchBar({ value, onChange }) {
  return (
    <div className="searchbar">
      <span className="search-icon">{Icons.search}</span>
      <input
        type="text"
        placeholder="Buscar por título, autor, tag…"
        value={value}
        onChange={e => onChange(e.target.value)}
      />
      {value && (
        <button className="search-clear" onClick={() => onChange("")}>limpar</button>
      )}
    </div>
  );
}

function SetupCard({ setup, onOpen }) {
  const s = setup.stats;
  return (
    <article className="card" onClick={() => onOpen(setup.slug)} tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter') onOpen(setup.slug); }}>
      <div className="card-top">
        <div className="card-author">
          <Avatar setup={setup} size={36} />
          <div className="card-author-meta">
            <div className="card-author-name">{setup.authorName}</div>
            <div className="card-author-handle">@{setup.author}</div>
          </div>
        </div>
        <span className="card-specialty">{setup.specialty}</span>
      </div>

      <h3 className="card-title">{setup.title}</h3>
      <p className="card-desc">{setup.description}</p>

      <div className="card-tags">
        {setup.tags.slice(0, 4).map(t => <Badge key={t} muted>#{t}</Badge>)}
      </div>

      <div className="card-stats">
        <StatPill n={s.plugins} label="plugins" icon={Icons.plug} />
        <StatPill n={s.mcps} label="MCPs" icon={Icons.mcp} />
        <StatPill n={s.hooks} label="hooks" icon={Icons.hook} />
        <StatPill n={s.skills} label="skills" icon={Icons.skill} />
      </div>

      <div className="card-foot">
        <span className="card-mirrors">{setup.mirrors.toLocaleString('pt-BR')} mirrors</span>
        <span className="card-open">ver setup {Icons.arrow}</span>
      </div>
    </article>
  );
}

function IndexPage({ onOpen }) {
  const [query, setQuery] = React.useState("");
  const [specialty, setSpecialty] = React.useState("all");

  const counts = React.useMemo(() => {
    const c = { all: SETUPS_DATA.length };
    for (const s of SETUPS_DATA) c[s.specialty] = (c[s.specialty] || 0) + 1;
    return c;
  }, []);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return SETUPS_DATA.filter(s => {
      if (specialty !== "all" && s.specialty !== specialty) return false;
      if (!q) return true;
      const hay = [
        s.title, s.description, s.author, s.authorName,
        ...s.tags, s.specialty
      ].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [query, specialty]);

  return (
    <>
      <Hero totalSetups={SETUPS_DATA.length} />

      <section className="gallery">
        <div className="gallery-toolbar">
          <SearchBar value={query} onChange={setQuery} />
          <SpecialtyTabs value={specialty} onChange={setSpecialty} counts={counts} />
        </div>

        {filtered.length === 0 ? (
          <div className="empty">
            <div className="empty-emoji" aria-hidden>∅</div>
            <p>Nenhum setup bate com essa busca.</p>
            <button className="btn-ghost" onClick={() => { setQuery(""); setSpecialty("all"); }}>limpar filtros</button>
          </div>
        ) : (
          <div className="grid">
            {filtered.map(s => <SetupCard key={s.slug} setup={s} onOpen={onOpen} />)}
          </div>
        )}

        <div className="gallery-footnote">
          <span>É seu setup que deveria estar aqui?</span>
          <CopyCmd cmd="npx -y claude-setups publish" />
        </div>
      </section>
    </>
  );
}

Object.assign(window, { IndexPage });
