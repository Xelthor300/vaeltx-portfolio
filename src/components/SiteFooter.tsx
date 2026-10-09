import Link from "next/link";

export function SiteFooter() {
  return <footer className="site-footer" data-site-footer>
    <div className="footer-call"><div><span className="eyebrow">A CLEAR NEXT STEP</span><h2>What needs to change?</h2></div><Link className="button button-light" href="/contact">Start a project <span aria-hidden="true">↗</span></Link></div>
    <div className="footer-grid"><div><Link className="footer-wordmark" href="/">VAELTX<span>.</span></Link><p>Independent web &amp; conversion studio.</p><a href="mailto:vaeltxn@gmail.com">vaeltxn@gmail.com</a><a className="footer-whatsapp" href="https://wa.me/19153065249" target="_blank" rel="noopener noreferrer" aria-label="Message VAELTX on WhatsApp">WhatsApp <span aria-hidden="true">↗</span></a></div>
      <div><span className="footer-label">EXPLORE</span><Link href="/work">Work</Link><Link href="/services">Services</Link><Link href="/process">Process</Link></div>
      <div><span className="footer-label">STUDIO</span><Link href="/standards">Standards</Link><Link href="/about">About</Link><Link href="/contact">Contact</Link></div>
      <p className="concept-disclosure">The projects shown here are independent concepts by VAELTX. They are not commissioned client work.</p></div>
    <div className="footer-legal"><span>© {new Date().getFullYear()} VAELTX</span><Link href="/privacy">Privacy</Link></div>
  </footer>;
}
