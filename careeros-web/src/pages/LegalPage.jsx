import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Link, useLocation } from "react-router-dom";
import { PRIVACY_POLICY } from "../legal/privacy-part-2.js";
import { TERMS_OF_SERVICE } from "../legal/terms-part-2.js";

export default function LegalPage() {
  const { pathname } = useLocation();
  const isPrivacy = pathname.endsWith("privacy");
  const title = isPrivacy ? "Privacy Policy" : "Terms of Service";
  const subtitle = isPrivacy
    ? "How CODEIT CareerOS collects, uses, and protects your personal information"
    : "The terms and conditions governing your use of the CareerOS platform";
  const content = isPrivacy ? PRIVACY_POLICY : TERMS_OF_SERVICE;
  return <main className="legal-page">
    <header className="legal-header"><p className="eyebrow">POLICY</p><Link className="brand" to="/"><span className="brand-mark">C</span><span>CareerOS</span></Link><h1>{title}</h1><p className="muted">{subtitle}</p><span className="legal-date">Last updated October 26, 2026</span></header>
    <article className="legal-content"><Markdown remarkPlugins={[remarkGfm]}>{content}</Markdown></article>
    <footer className="legal-footer"><span>© {new Date().getFullYear()} CODEIT CareerOS</span><nav aria-label="Legal pages"><Link to="/legal/privacy">Privacy Policy</Link><Link to="/legal/terms">Terms of Service</Link></nav></footer>
  </main>;
}
