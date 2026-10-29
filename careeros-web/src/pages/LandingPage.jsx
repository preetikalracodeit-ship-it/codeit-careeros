import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { LandingIcon } from "../components/landing/LandingIcons.jsx";

const cx = (...classes) => classes.filter(Boolean).join(" ");

const navLinks = [
  { href: "#features", label: "Features" },
  { href: "#how-it-works", label: "How it works" },
];

const footerExploreLinks = [
  { href: "#features", label: "Features" },
  { href: "#how-it-works", label: "How it works" },
];

const footerAccountLinks = [
  { to: "/login", label: "Sign in" },
  { to: "/register", label: "Create free account" },
  { to: "/register", label: "Start career assessment" },
];

const footerLegalLinks = [
  { to: "/legal/privacy", label: "Privacy Policy" },
  { to: "/legal/terms", label: "Terms of Service" },
];

function Reveal({ children, className, delay = 0, variant }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return true;
    return typeof IntersectionObserver === "undefined";
  });

  useEffect(() => {
    if (visible) return undefined;
    const el = ref.current;
    if (!el) return undefined;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -48px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [visible]);

  return (
    <div
      ref={ref}
      style={{ "--rd": `${delay}ms` }}
      className={cx(
        "lp-reveal",
        variant === "sm" && "lp-reveal-sm",
        variant === "scale" && "lp-reveal-scale",
        visible && "is-visible",
        className,
      )}
    >
      {children}
    </div>
  );
}

function LogoWordmark({ tone = "dark" }) {
  return (
    <span className="lp-wordmark">
      <img src="/images/codeit-logo.png" alt="" aria-hidden="true" className="lp-logo-img" />
      <span className={cx("lp-wordmark-text", tone === "light" && "is-light")}>
        CODEIT&nbsp;<span className="lp-wordmark-accent">CareerOS</span>
      </span>
    </span>
  );
}

function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [bannerVisible, setBannerVisible] = useState(true);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 8);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      {bannerVisible && (
        <div className="lp-banner">
          <div className="lp-banner-inner">
            <LandingIcon name="sparkles" size={14} className="lp-banner-icon" />
            <p className="lp-banner-text">
              AI-guided career roadmaps are live —{" "}
              <Link to="/register" className="lp-banner-link">
                try it free
              </Link>
            </p>
          </div>
          <button
            type="button"
            onClick={() => setBannerVisible(false)}
            aria-label="Dismiss announcement"
            className="lp-banner-close"
          >
            <LandingIcon name="x" size={14} />
          </button>
        </div>
      )}

      <header className={cx("lp-header", scrolled && "is-scrolled")}>
        <nav aria-label="Primary" className={cx("lp-nav", scrolled && "is-scrolled")}>
          <Link to="/" aria-label="CODEIT CareerOS home" className="lp-logo-link">
            <span className="lp-logo-scale">
              <LogoWordmark />
            </span>
          </Link>

          <div className="lp-nav-links">
            {navLinks.map((link) => (
              <a key={link.href} href={link.href} className="lp-nav-link">
                {link.label}
              </a>
            ))}
          </div>

          <div className="lp-nav-auth">
            <Link to="/login" className="lp-signin">
              Sign in
            </Link>
            <Link to="/register" className="lp-nav-cta">
              Get Started
              <LandingIcon name="arrowRight" size={16} className="lp-nav-cta-icon" />
            </Link>
          </div>

          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            className="lp-menu-toggle"
          >
            <LandingIcon name={menuOpen ? "x" : "menu"} size={20} />
          </button>
        </nav>

        {menuOpen && (
          <div className="lp-mobile-menu">
            <div className="lp-mobile-menu-inner">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className="lp-mobile-link"
                >
                  {link.label}
                </a>
              ))}
              <div className="lp-mobile-actions">
                <Link to="/login" onClick={() => setMenuOpen(false)} className="lp-mobile-signin">
                  Sign in
                </Link>
                <Link to="/register" onClick={() => setMenuOpen(false)} className="lp-mobile-cta">
                  Get Started
                </Link>
              </div>
            </div>
          </div>
        )}
      </header>
    </>
  );
}

const heroChecks = ["Free for students", "Role-specific assessments", "AI-guided roadmap"];

function HeroSection() {
  return (
    <section className="lp-hero">
      <div aria-hidden="true" className="lp-hero-glow">
        <div className="lp-hero-glow-inner" />
      </div>

      <div className="lp-hero-grid">
        <div>
          <div className="lp-hero-text">
            <span className="lp-badge anim-hero-rise" style={{ "--d": "0.05s" }}>
              <LandingIcon name="sparkles" size={14} />
              Test. Analyze. Improve. Become Industry Ready.
            </span>
            <h1 className="lp-hero-title anim-hero-rise" style={{ "--d": "0.15s" }}>
              Know Where You Stand.
              <br />
              <span className="lp-text-primary">Know What To Do Next.</span>
            </h1>
            <p className="lp-hero-lede anim-hero-rise" style={{ "--d": "0.26s" }}>
              CODEIT CareerOS analyzes your skills, career gaps, CV and professional profile to
              create a personalized career action plan.
            </p>
            <div className="lp-hero-actions anim-hero-rise" style={{ "--d": "0.36s" }}>
              <Link to="/register" className="lp-btn lp-btn-primary">
                Start Career Assessment
                <LandingIcon name="arrowRight" size={16} />
              </Link>
              <Link to="/login" className="lp-btn lp-btn-secondary">
                Explore CareerOS
              </Link>
            </div>
            <ul className="lp-hero-checks anim-hero-rise" style={{ "--d": "0.46s" }}>
              {heroChecks.map((check) => (
                <li key={check}>
                  <LandingIcon name="checkCircle" size={16} className="lp-check-icon" />
                  {check}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="lp-hero-preview">
          <div className="lp-hero-pop" style={{ "--d": "0.3s" }}>
            <div aria-hidden="true" className="lp-hero-preview-glow" />
            <div className="lp-hero-preview-card">
              <img
                src="/images/ui-preview.png"
                alt="CODEIT CareerOS dashboard preview"
                width="1377"
                height="1142"
              />
            </div>

            <div className="lp-float lp-float-top">
              <div className="lp-float-card anim-float-soft">
                <span className="lp-float-icon is-chart">
                  <LandingIcon name="target" size={16} />
                </span>
                <div className="lp-float-copy">
                  <p className="lp-float-title">90-Day Roadmap</p>
                  <p className="lp-float-sub">Personalized for your goal</p>
                </div>
              </div>
            </div>
            <div className="lp-float lp-float-bottom">
              <div className="lp-float-card anim-float-soft" style={{ "--d": "3s" }}>
                <span className="lp-float-icon">
                  <LandingIcon name="sparkles" size={16} />
                </span>
                <div className="lp-float-copy">
                  <p className="lp-float-title">AI Career Guidance</p>
                  <p className="lp-float-sub">Know what to do next</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function VisualShell({ children }) {
  return (
    <div className="lp-visual-shell">
      <div aria-hidden="true" className="lp-visual-dots" />
      <div className="lp-visual-inner">{children}</div>
    </div>
  );
}

function MockCard({ className, children }) {
  return (
    <div aria-hidden="true" className={cx("lp-mock", className)}>
      {children}
    </div>
  );
}

function SkillBar({ name, value, highlight }) {
  return (
    <div>
      <div className="lp-skill-top">
        <span className="lp-skill-name">{name}</span>
        <span className={highlight ? "lp-skill-value is-warn" : "lp-skill-value"}>{value}%</span>
      </div>
      <div className="lp-skill-bar">
        <div
          className={cx("lp-skill-fill", highlight && "is-warn")}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

function AssessVisual() {
  return (
    <MockCard>
      <div className="lp-assess-top">
        <span className="lp-qcount">Q 12 / 30</span>
        <span className="lp-timer">
          <LandingIcon name="timer" size={12} /> 04:32
        </span>
      </div>
      <p className="lp-assess-question">Which OOP pillar binds data + methods together?</p>
      <div className="lp-assess-options">
        <div className="lp-assess-option">
          <span className="lp-radio" />
          Inheritance
        </div>
        <div className="lp-assess-option is-selected">
          <span className="lp-radio is-selected">
            <span />
          </span>
          Encapsulation
          <LandingIcon name="check" size={12} className="lp-assess-check" />
        </div>
      </div>
      <div className="lp-assess-footer">
        <div className="lp-assess-progress">
          <div />
        </div>
        <span className="lp-assess-next">Next</span>
      </div>
    </MockCard>
  );
}

function GapsVisual() {
  return (
    <div className="lp-gaps">
      <MockCard className="lp-gaps-card">
        <SkillBar name="Problem Solving" value={86} />
        <SkillBar name="Java" value={72} />
        <SkillBar name="System Design" value={38} highlight />
        <p className="lp-gap-chip">Biggest gap: System Design (−34%)</p>
      </MockCard>
      <div className="lp-gap-float anim-float-soft">
        <LandingIcon name="trendingUp" size={14} /> +12% readiness
      </div>
    </div>
  );
}

function AiVisual() {
  return (
    <MockCard className="lp-ai-card">
      <div className="lp-ai-user">Which skill next for a Java Dev role?</div>
      <div className="lp-ai-bot">
        <span className="lp-ai-strong">Focus first:</span> Spring Boot, then REST APIs — your largest
        gaps.
      </div>
      <div className="lp-ai-typing">
        {[0, 1, 2].map((d) => (
          <span key={d} style={{ animationDelay: `${d * 0.18}s` }} />
        ))}
      </div>
      <div className="lp-ai-input">
        Ask anything…
        <span className="lp-ai-send">
          <LandingIcon name="send" size={10} />
        </span>
      </div>
    </MockCard>
  );
}

function ProjectsVisual() {
  const rows = [
    { title: "REST API Clone", tags: ["Spring", "MySQL"], status: "In Progress", live: true },
    { title: "Portfolio Site", tags: ["Next.js"], status: "Completed", live: false },
  ];
  return (
    <MockCard className="lp-projects">
      {rows.map((row) => (
        <div key={row.title} className="lp-project-row">
          <span className="lp-project-icon">
            <LandingIcon name="folderOpen" size={14} />
          </span>
          <div className="lp-project-copy">
            <p className="lp-project-title">{row.title}</p>
            <div className="lp-project-tags">
              {row.tags.map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
          </div>
          <span className={cx("lp-project-status", row.live ? "is-progress" : "is-done")}>
            <span className={cx("lp-status-dot", row.live ? "is-progress" : "is-done")} />
            {row.status}
          </span>
        </div>
      ))}
    </MockCard>
  );
}

function ProgressVisual() {
  const bars = [34, 48, 42, 60, 55, 72, 88];
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  return (
    <MockCard>
      <div className="lp-progress">
        <div className="lp-progress-ring">
          <svg viewBox="0 0 64 64">
            <circle
              cx="32"
              cy="32"
              r={radius}
              fill="none"
              strokeWidth="7"
              className="lp-ring-track"
            />
            <circle
              cx="32"
              cy="32"
              r={radius}
              fill="none"
              strokeWidth="7"
              strokeLinecap="round"
              stroke="url(#lpProgressGrad)"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - 0.72)}
            />
            <defs>
              <linearGradient id="lpProgressGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="var(--lp-brand-700)" />
                <stop offset="100%" stopColor="var(--lp-brand-400)" />
              </linearGradient>
            </defs>
          </svg>
          <div className="lp-progress-ring-label">
            <span className="lp-progress-value">72%</span>
            <span className="lp-progress-caption">ready</span>
          </div>
        </div>
        <div className="lp-progress-main">
          <p className="lp-progress-title">This week</p>
          <div className="lp-progress-bars">
            {bars.map((height, index) => (
              <div
                key={index}
                className={cx("lp-progress-bar", index === bars.length - 1 && "is-last")}
                style={{ height: `${height}%` }}
              />
            ))}
          </div>
          <div className="lp-progress-days">
            <span>M</span>
            <span>W</span>
            <span>F</span>
            <span>S</span>
          </div>
        </div>
      </div>
    </MockCard>
  );
}

function ReportVisual() {
  return (
    <MockCard>
      <div className="lp-report-top">
        <div>
          <p className="lp-report-label">Readiness report</p>
          <p className="lp-report-score">
            87<span className="lp-report-unit">/100</span>
          </p>
        </div>
        <span className="lp-report-badge">INDUSTRY READY</span>
      </div>
      <div className="lp-report-lines">
        {["Skills verified", "2 projects shipped", "CV + LinkedIn polished"].map((line) => (
          <p key={line}>
            <LandingIcon name="checkCircle" size={14} className="lp-report-check" />
            {line}
          </p>
        ))}
      </div>
      <p className="lp-report-download">
        <LandingIcon name="download" size={12} /> Download Report
      </p>
    </MockCard>
  );
}

const features = [
  {
    icon: "clipboardCheck",
    title: "Assess Your Skills",
    description:
      "Take role-specific assessments mapped to your target career and get skill-wise scores.",
    visual: <AssessVisual />,
  },
  {
    icon: "barChart3",
    title: "Find Your Skill Gaps",
    description:
      "See exactly where you stand versus the competency required for your target role.",
    visual: <GapsVisual />,
  },
  {
    icon: "sparkles",
    title: "Get AI Guidance",
    description:
      "Ask the CODEIT Career AI Assistant what to learn next — answers grounded in your data.",
    visual: <AiVisual />,
  },
  {
    icon: "folderKanban",
    title: "Learn & Build Projects",
    description:
      "Get recommended projects that close your gaps with the technologies employers expect.",
    visual: <ProjectsVisual />,
  },
  {
    icon: "trendingUp",
    title: "Track Your Progress",
    description:
      "Watch your career readiness improve as you complete roadmaps, projects and assessments.",
    visual: <ProgressVisual />,
  },
  {
    icon: "rocket",
    title: "Become Industry Ready",
    description:
      "Generate a Career Readiness Report and walk into interviews knowing exactly where you stand.",
    visual: <ReportVisual />,
  },
];

function FeatureCard({ feature }) {
  return (
    <div className="lp-feature-card">
      <div className="lp-feature-inner">
        <div className="lp-feature-body">
          <div className="lp-feature-heading">
            <span className="lp-feature-icon">
              <LandingIcon name={feature.icon} size={20} />
            </span>
            <h3>{feature.title}</h3>
          </div>
          <p className="lp-feature-description">{feature.description}</p>
        </div>
        <VisualShell>{feature.visual}</VisualShell>
      </div>
    </div>
  );
}

function PathSection() {
  return (
    <section id="features" className="lp-section lp-features">
      <div className="lp-container">
        <div className="lp-section-heading">
          <span className="lp-badge">
            <LandingIcon name="sparkles" size={14} />
            Everything in one place
          </span>
          <h2>
            Your complete path from <span className="lp-text-primary">classroom to career</span>
          </h2>
          <p>
            Assess your skills, close the gaps that matter and prove you&apos;re ready —
            assessments, roadmaps, projects and reports, all in one place.
          </p>
        </div>
        <div className="lp-feature-grid">
          {features.map((feature) => (
            <FeatureCard key={feature.title} feature={feature} />
          ))}
        </div>
      </div>
    </section>
  );
}

const journeySteps = [
  {
    icon: "clipboardCheck",
    title: "Assess",
    text: "Take a role-specific assessment mapped to your target career.",
    meta: "Skill-wise scores",
    next: "Next: Analyze",
  },
  {
    icon: "barChart3",
    title: "Analyze",
    text: "See your skill gaps and readiness score on one clear dashboard.",
    meta: "Readiness score",
    next: "Next: Improve",
  },
  {
    icon: "rocket",
    title: "Improve",
    text: "Follow your roadmap, build projects and get AI guidance.",
    meta: "Roadmaps + AI coach",
    next: "Next: Become Ready",
  },
  {
    icon: "graduationCap",
    title: "Become Ready",
    text: "Generate your Career Readiness Report and walk in confident.",
    meta: "Industry-ready report",
    next: "Outcome: Interview-ready",
  },
];

function StepCard({ step, index, isActive, isDone }) {
  const isLast = index === journeySteps.length - 1;
  return (
    <li className={cx("lp-step", isActive && "is-active", !isActive && "is-idle")}>
      {index < journeySteps.length - 1 && (
        <span aria-hidden="true" className="lp-step-connector" />
      )}
      <div className="lp-step-card">
        <span aria-hidden="true" className="lp-step-glow" />
        <span aria-hidden="true" className="lp-step-accent" />
        <span aria-hidden="true" className="lp-step-ghost">
          {`0${index + 1}`}
        </span>
        <span className="lp-step-pill">
          Step {index + 1}
          {isDone && (
            <span className="lp-step-done">
              <LandingIcon name="check" size={10} />
            </span>
          )}
        </span>
        <div className="lp-step-main">
          <span className="lp-step-icon">
            <LandingIcon name={step.icon} size={22} />
          </span>
          <div className="lp-step-copy">
            <h3>{step.title}</h3>
            <p>{step.text}</p>
            <span className="lp-step-meta">
              <LandingIcon name="sparkles" size={12} />
              {step.meta}
            </span>
          </div>
        </div>
        <p className="lp-step-next">
          {isLast ? (
            <LandingIcon name="check" size={14} className="lp-step-next-check" />
          ) : (
            <LandingIcon name="arrowRight" size={14} className="lp-step-next-arrow" />
          )}
          {step.next}
        </p>
      </div>
    </li>
  );
}

function JourneySection() {
  const stepsRef = useRef(null);
  const [active, setActive] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return undefined;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduceMotion(query.matches);
    const onChange = (event) => setReduceMotion(event.matches);
    query.addEventListener?.("change", onChange);
    return () => query.removeEventListener?.("change", onChange);
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      setActive(journeySteps.length - 1);
      return undefined;
    }

    let frame = 0;
    function update() {
      frame = 0;
      const el = stepsRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const viewport = window.innerHeight;
      const progress = Math.min(1, Math.max(0, (viewport / 2 - rect.top) / rect.height));
      const next = Math.min(journeySteps.length - 1, Math.floor(progress * journeySteps.length));
      setActive((current) => (current === next ? current : next));
    }
    function onScroll() {
      if (!frame) frame = window.requestAnimationFrame(update);
    }
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [reduceMotion]);

  const shown = reduceMotion ? journeySteps.length - 1 : active;
  const current = journeySteps[shown];
  const percentage = Math.round(((shown + 1) / journeySteps.length) * 100);

  return (
    <section id="how-it-works" className="lp-section lp-journey">
      <div className="lp-container">
        <div className="lp-section-heading">
          <span className="lp-badge">
            <LandingIcon name="sparkles" size={14} />
            How it works
          </span>
          <h2>
            Your journey to <span className="lp-text-primary">interview-ready</span>
          </h2>
          <p>
            Four guided steps from &ldquo;where am I today?&rdquo; to hired — clear, focused, and
            built for students.
          </p>
          <div className="lp-journey-chips">
            <span>
              <LandingIcon name="check" size={14} className="lp-chip-check" />
              4 guided steps
            </span>
            <span>
              <LandingIcon name="check" size={14} className="lp-chip-check" />
              Personalized to your role
            </span>
            <span>
              <LandingIcon name="check" size={14} className="lp-chip-check" />
              Free to start
            </span>
          </div>
        </div>

        <div className="lp-journey-mobile" aria-hidden="true">
          <div className="lp-journey-mobile-card">
            <div className="lp-journey-mobile-top">
              <span className="lp-journey-mobile-label">
                <span className="lp-journey-mobile-number">{shown + 1}</span>
                <span>
                  Step {shown + 1} of {journeySteps.length} —{" "}
                  <span className="lp-journey-mobile-current">{current.title}</span>
                </span>
              </span>
              <span className="lp-journey-mobile-percent">{percentage}%</span>
            </div>
            <div className="lp-journey-mobile-track">
              <div
                className="lp-journey-mobile-fill"
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>
        </div>

        <div ref={stepsRef} className="lp-journey-steps">
          <ol>
            {journeySteps.map((step, index) => (
              <StepCard
                key={step.title}
                step={step}
                index={index}
                isActive={index === shown}
                isDone={index < shown}
              />
            ))}
          </ol>
        </div>

        <div className="lp-journey-cta">
          <Link to="/register" className="lp-btn lp-btn-primary lp-btn-lg">
            Start your journey — it&rsquo;s free
            <LandingIcon name="arrowRight" size={20} />
          </Link>
          <p>No credit card needed · Takes just 2 minutes</p>
        </div>
      </div>
    </section>
  );
}

function CtaSection() {
  return (
    <section className="lp-cta">
      <div className="lp-cta-panel">
        <h2>Know where you stand. Know what to do next.</h2>
        <p>
          Create your free student account, complete your profile and take your first career
          assessment.
        </p>
        <div className="lp-cta-actions">
          <Link to="/register" className="lp-btn lp-cta-primary">
            Create your free account
            <LandingIcon name="arrowRight" size={16} />
          </Link>
          <Link to="/login" className="lp-btn lp-cta-secondary">
            Sign in
          </Link>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="lp-footer">
      <div aria-hidden="true" className="lp-footer-rule" />
      <div aria-hidden="true" className="lp-footer-glow" />
      <div className="lp-footer-container">
        <Reveal variant="sm">
          <div className="lp-footer-grid">
            <div>
              <LogoWordmark tone="light" />
              <p className="lp-footer-about">
                Assess your skills, close the gaps that matter and prove you&apos;re ready —
                assessments, roadmaps, projects and reports, all in one place.
              </p>
              <span className="lp-footer-pill">
                <LandingIcon name="graduationCap" size={14} />
                Free for students
              </span>
            </div>

            <nav aria-label="Explore">
              <h3 className="lp-footer-heading">Explore</h3>
              <ul className="lp-footer-links">
                {footerExploreLinks.map((link) => (
                  <li key={link.label}>
                    <a href={link.href} className="lp-footer-link">
                      {link.label}
                      <LandingIcon name="arrowUpRight" size={14} className="lp-footer-link-icon" />
                    </a>
                  </li>
                ))}
              </ul>
            </nav>

            <nav aria-label="Account">
              <h3 className="lp-footer-heading">Get started</h3>
              <ul className="lp-footer-links">
                {footerAccountLinks.map((link) => (
                  <li key={link.label}>
                    <Link to={link.to} className="lp-footer-link">
                      {link.label}
                      <LandingIcon name="arrowUpRight" size={14} className="lp-footer-link-icon" />
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            <div className="lp-footer-card">
              <h3>Ready to know where you stand?</h3>
              <p>Create your free account and take your first career assessment today.</p>
              <Link to="/register" className="lp-footer-cta">
                Create free account
                <LandingIcon name="arrowRight" size={16} />
              </Link>
            </div>
          </div>
        </Reveal>

        <div className="lp-footer-bottom">
          <p>© {new Date().getFullYear()} CODEIT CareerOS. All rights reserved.</p>
          <nav aria-label="Legal">
            <ul>
              {footerLegalLinks.map((link) => (
                <li key={link.label}>
                  <Link to={link.to}>{link.label}</Link>
                </li>
              ))}
            </ul>
          </nav>
          <p className="lp-footer-tagline">
            <LandingIcon name="sparkles" size={14} />
            Test. Analyze. Improve. Become Industry Ready.
          </p>
        </div>
      </div>
    </footer>
  );
}

export function LandingPage() {
  return (
    <div className="landing-root">
      <Navbar />
      <main>
        <HeroSection />
        <PathSection />
        <JourneySection />
        <CtaSection />
      </main>
      <Footer />
    </div>
  );
}
