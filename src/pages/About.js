import React from "react";


export default function About() {
  return (
    <section
      id="about"
      className="py-10 md:py-16 px-2 sm:px-4 bg-gray-50 text-center flex flex-col items-center"
    >
      <h2
        className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-teal-500 mb-4 flex items-center justify-center gap-2 mt-20"
        data-aos="fade-down"
        data-aos-delay="100"
      >
        <span>About Agapay</span>
      </h2>
      <div className="flex flex-col md:flex-row items-center justify-center gap-6 md:gap-10 w-full max-w-4xl mx-auto">
        {/* Feature List */}
        <ul className="text-left text-base sm:text-lg text-gray-800 font-semibold space-y-3 sm:space-y-4 flex-1">
          <li className="flex items-center gap-2" data-aos="fade-right" data-aos-delay="200">
            <span role="img" aria-label="Gift">✔️</span>
            Donate & request
          </li>
          <li className="flex items-center gap-2" data-aos="fade-right" data-aos-delay="300">
            <span role="img" aria-label="Location">✔️</span>
            Locate waste facilities
          </li>
          <li className="flex items-center gap-2" data-aos="fade-right" data-aos-delay="400">
            <span role="img" aria-label="Chart">✔️</span>
            Track your waste impact
          </li>
          <li className="flex items-center gap-2" data-aos="fade-right" data-aos-delay="500">
            <span role="img" aria-label="Money">✔️</span>
            Earn cash from trash
          </li>
        </ul>
  {/* Phone Images removed due to missing asset */}
      </div>
      {/* Key Features */}
      <h3
        className="text-lg sm:text-2xl md:text-3xl font-bold text-teal-400 mt-8 md:mt-12 mb-4 md:mb-6"
        data-aos="fade-down"
        data-aos-delay="400"
      >
        Discover our key features
      </h3>
      <div
        className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 max-w-3xl mx-auto"
        data-aos="fade-up"
        data-aos-delay="500"
      >
        <div className="bg-white rounded-xl shadow p-4 sm:p-6 flex flex-col items-center border-2 border-teal-200" data-aos="zoom-in" data-aos-delay="600">
          <span className="text-2xl sm:text-3xl mb-2" role="img" aria-label="Donate">🎁</span>
          <span className="font-semibold text-teal-500 text-base sm:text-lg">Donate</span>
        </div>
        <div className="bg-white rounded-xl shadow p-4 sm:p-6 flex flex-col items-center border-2 border-teal-200" data-aos="zoom-in" data-aos-delay="700">
          <span className="text-2xl sm:text-3xl mb-2" role="img" aria-label="Request">🙋‍♂️</span>
          <span className="font-semibold text-teal-500 text-base sm:text-lg">Request</span>
        </div>
        <div className="bg-white rounded-xl shadow p-4 sm:p-6 flex flex-col items-center border-2 border-teal-200" data-aos="zoom-in" data-aos-delay="800">
          <span className="text-2xl sm:text-3xl mb-2" role="img" aria-label="Earn">💸</span>
          <span className="font-semibold text-teal-500 text-base sm:text-lg">Earn</span>
        </div>
        <div className="bg-white rounded-xl shadow p-4 sm:p-6 flex flex-col items-center border-2 border-teal-200" data-aos="zoom-in" data-aos-delay="900">
          <span className="text-2xl sm:text-3xl mb-2" role="img" aria-label="Track">📊</span>
          <span className="font-semibold text-teal-500 text-base sm:text-lg">Track</span>
        </div>
        <div className="bg-white rounded-xl shadow p-4 sm:p-6 flex flex-col items-center border-2 border-teal-200" data-aos="zoom-in" data-aos-delay="1000">
          <span className="text-2xl sm:text-3xl mb-2" role="img" aria-label="Locate">📍</span>
          <span className="font-semibold text-teal-500 text-base sm:text-lg">Locate</span>
        </div>
        <div className="bg-white rounded-xl shadow p-4 sm:p-6 flex flex-col items-center border-2 border-teal-200" data-aos="zoom-in" data-aos-delay="1100">
          <span className="text-2xl sm:text-3xl mb-2" role="img" aria-label="Circulate">♻️</span>
          <span className="font-semibold text-teal-500 text-base sm:text-lg">Circulate</span>
        </div>
      </div>
    </section>
  );
}
