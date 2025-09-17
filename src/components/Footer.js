import agapayLogo from "./imgs/agapay-logo.svg";

export default function Footer() {
  return (
    <footer className="w-full bg-gradient-to-r from-teal-700 to-teal-700 text-white pt-0 pb-6 px-2 sm:px-4 mt-24 relative overflow-hidden">
      {/* SVG Wave at Top Inside Footer */}
      <div className="absolute left-0 top-0 w-full overflow-hidden leading-none" style={{height: '80px', zIndex: 2}}>
        <svg viewBox="0 0 1440 80" width="100%" height="100%" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full" style={{display: 'block'}}>
          <path d="M0,70 C240,-40 1200,120 1440,10 L1440,0 L0,0 Z" fill="#fff" stroke="#fff" strokeWidth="8" />
        </svg>
      </div>
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-start gap-8 md:gap-10 pt-20 px-2 sm:px-0">
        {/* Logo and Copyright */}
        <div className="flex flex-col items-start mb-6 md:mb-0 w-full md:w-auto">
          <div className="flex items-center mb-2">
            <img src={agapayLogo} alt="Agapay Logo" className="w-8 h-8 object-contain" />
            <span className="ml-2 text-lg font-bold text-white">Agapay</span>
          </div>
          <span className="text-sm text-white">2025 Agapay</span>
        </div>
        {/* Contact */}
        <div className="w-full md:w-auto mb-6 md:mb-0">
          <div className="font-bold mb-2 text-white">Contact</div>
          <div className="text-sm text-white">17 Basement I Legarda Rd.<br />UC-BCF Legarda Campus<br />Baguio City Philippines<br />0800 01234 5678</div>
        </div>
        {/* Social Media */}
        <div className="w-full md:w-auto mb-6 md:mb-0">
          <div className="font-bold mb-2 text-white">Social media</div>
          <ul className="text-sm space-y-1">
            <li><a href="/" className="hover:underline text-white">Facebook</a></li>
          </ul>
        </div>
        {/* Legal */}
        <div className="w-full md:w-auto">
          <div className="font-bold mb-2 text-white">Legal</div>
          <ul className="text-sm space-y-1">
            <li><a href="/" className="hover:underline text-white">Privacy Policy</a></li>
            <li><a href="/" className="hover:underline text-white">Cookie Agreement</a></li>
            <li><a href="/" className="hover:underline text-white">Terms of Service</a></li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
