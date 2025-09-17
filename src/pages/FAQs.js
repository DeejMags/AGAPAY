import React, { useState, useEffect } from "react";
import AOS from "aos";
import "aos/dist/aos.css";

const faqs = [
  {
    question: "How does Agapay work?",
    answer: "Users can donate items they no longer need, request items they need, join raffles, participate in communnity forums, & build a circular economy to fight against waste.",
  },
  {
    question: "Is Agapay free to use?",
    answer: "Yes, we operate on a freemium model, so most features are free-but we do have optional subscription plans that provide additional rewards and benefits.",
  },
  {
    question: "Who can use Agapay?",
    answer: "Anyone interested in sustainability, from students to businesses and NGOs, as long as you're not twelve or below.",
  },
  {
    question: "What items can I list?",
    answer: "Any usable items that can benefit others, from bottles, papers, to clothing. However we do not allow biodegradables and biohazards such as food and TVs (for now). We also don't allow items in bad conditions. (i.e., dirty bottles), so wash those bottles up first!",
  },
];

export default function FAQs() {
  const [open, setOpen] = useState(null);
  useEffect(() => {
    AOS.init({ duration: 800, once: false });
  }, []);
  return (
    <section id="faq" className="w-full bg-white py-10 md:py-16 px-2 sm:px-4 flex flex-col items-center">
      <h2 className="text-2xl sm:text-4xl md:text-5xl font-extrabold text-teal-400 mb-6 md:mb-10 text-center mt-20" data-aos="fade-down">Frequently asked questions</h2>
      <div className="grid grid-cols-1 gap-4 md:gap-6 w-full max-w-2xl">
        {faqs.map((faq, i) => (
          <div key={i} className="border-2 border-teal-200 rounded-lg bg-white shadow-sm" data-aos="fade-up" data-aos-delay={i * 100}>
            <button
              className="flex items-center justify-between w-full px-3 sm:px-4 py-3 text-left text-teal-500 font-semibold focus:outline-none text-sm sm:text-base"
              onClick={() => setOpen(open === i ? null : i)}
              aria-expanded={open === i}
              aria-controls={`faq-panel-${i}`}
            >
              <span className="flex items-center gap-2">
                <span className="text-lg text-teal-400">❓</span>
                {faq.question}
              </span>
              <span className={`text-2xl ml-2 transition-transform duration-300 ${open === i ? 'rotate-180' : ''}`}
                aria-hidden="true"
              >
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M8 12L16 20L24 12" stroke="url(#faq-arrow-gradient)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                  <defs>
                    <linearGradient id="faq-arrow-gradient" x1="8" y1="12" x2="24" y2="20" gradientUnits="userSpaceOnUse">
                      <stop stopColor="#36D1C4"/>
                      <stop offset="1" stopColor="#3CB8C6"/>
                    </linearGradient>
                  </defs>
                </svg>
              </span>
            </button>
            <div
              id={`faq-panel-${i}`}
              className="px-3 sm:px-4 pb-4 text-gray-800 text-xs sm:text-sm transition-all duration-500 ease-in-out overflow-hidden"
              style={{
                maxHeight: open === i ? '200px' : '0',
                opacity: open === i ? 1 : 0,
                pointerEvents: open === i ? 'auto' : 'none',
                transition: 'max-height 0.5s cubic-bezier(0.4,0,0.2,1), opacity 0.4s',
              }}
              aria-hidden={open !== i}
              tabIndex={open === i ? 0 : -1}
            >
              <div>{faq.answer}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
} 