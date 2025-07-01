import React from "react";
import iphone_mockup from "./imgs/iphone mockup.svg";

export default function About() {
  return (
    <section id="about" className="py-16 px-4 bg-gray-50 text-center animate-slideUp flex flex-col items-center">
      <h2 className="text-3xl md:text-4xl font-extrabold text-teal-500 mb-4">About Agapay</h2>
      <div className="flex flex-col md:flex-row items-center justify-center gap-10 w-full max-w-4xl mx-auto">
        {/* Feature List */}
        <ul className="text-left text-lg text-teal-500 font-semibold space-y-4 flex-1">
          <li className="flex items-center gap-2">
            {/* Gift Icon */}
            <svg className="w-6 h-6 text-teal-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M20 12v7a2 2 0 01-2 2H6a2 2 0 01-2-2v-7m16-2V7a2 2 0 00-2-2h-3.5a2 2 0 01-2-2 2 2 0 00-2 2H6a2 2 0 00-2 2v3m16 0H4" /></svg>
            Donate & request
          </li>
          <li className="flex items-center gap-2">
            {/* Location Marker Icon */}
            <svg className="w-6 h-6 text-teal-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 11c1.104 0 2-.896 2-2s-.896-2-2-2-2 .896-2 2 .896 2 2 2zm0 10c-4.418 0-8-4.03-8-9a8 8 0 1116 0c0 4.97-3.582 9-8 9z" /></svg>
            Locate waste facilities
          </li>
          <li className="flex items-center gap-2">
            {/* Chart Bar Icon */}
            <svg className="w-6 h-6 text-teal-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 17v-6a2 2 0 012-2h2a2 2 0 012 2v6m4 0v-2a2 2 0 012-2h2a2 2 0 012 2v2m-6 0V7a2 2 0 012-2h2a2 2 0 012 2v10" /></svg>
            Track your waste impact
          </li>
          <li className="flex items-center gap-2">
            {/* Cash Icon */}
            <svg className="w-6 h-6 text-teal-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a5 5 0 00-10 0v2a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2zm-5 4a2 2 0 100-4 2 2 0 000 4z" /></svg>
            Earn cash from trash
          </li>
        </ul>
        {/* Phone Images */}
        <div className="flex-1 flex justify-center relative min-h-[250px] md:min-h-[350px]">
          <img
            src={iphone_mockup}
            alt="iPhone Mockup"
            className="w-32 md:w-48 absolute left-8 top-4 md:left-12 md:top-8 z-20 rotate-[-12deg] drop-shadow-xl"
          />
          <img
            src="https://raw.githubusercontent.com/MockupZone/Free-Android-Mockups/master/android-mockup.png"
            alt="Android Mockup"
            className="w-32 md:w-48 absolute right-8 top-8 md:right-12 md:top-16 z-10 rotate-[10deg] drop-shadow-lg"
          />
        </div>
      </div>
      {/* Key Features */}
      <h3 className="text-2xl md:text-3xl font-bold text-teal-400 mt-12 mb-6">Discover our key features</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-6 max-w-3xl mx-auto">
        <div className="bg-white rounded-xl shadow p-6 flex flex-col items-center">
          {/* Gift Icon */}
          <svg className="w-8 h-8 mb-2 text-teal-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M20 12v7a2 2 0 01-2 2H6a2 2 0 01-2-2v-7m16-2V7a2 2 0 00-2-2h-3.5a2 2 0 01-2-2 2 2 0 00-2 2H6a2 2 0 00-2 2v3m16 0H4" /></svg>
          <span className="font-semibold text-teal-500">Donate</span>
        </div>
        <div className="bg-white rounded-xl shadow p-6 flex flex-col items-center">
          {/* User Add Icon */}
          <svg className="w-8 h-8 mb-2 text-teal-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M18 9a3 3 0 11-6 0 3 3 0 016 0zm-6 6a6 6 0 00-6 6m6-6a6 6 0 016 6m-6-6v6" /></svg>
          <span className="font-semibold text-teal-500">Request</span>
        </div>
        <div className="bg-white rounded-xl shadow p-6 flex flex-col items-center">
          {/* Cash Icon */}
          <svg className="w-8 h-8 mb-2 text-teal-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a5 5 0 00-10 0v2a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2zm-5 4a2 2 0 100-4 2 2 0 000 4z" /></svg>
          <span className="font-semibold text-teal-500">Earn</span>
        </div>
        <div className="bg-white rounded-xl shadow p-6 flex flex-col items-center">
          {/* Chart Bar Icon */}
          <svg className="w-8 h-8 mb-2 text-teal-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 17v-6a2 2 0 012-2h2a2 2 0 012 2v6m4 0v-2a2 2 0 012-2h2a2 2 0 012 2v2m-6 0V7a2 2 0 012-2h2a2 2 0 012 2v10" /></svg>
          <span className="font-semibold text-teal-500">Track</span>
        </div>
        <div className="bg-white rounded-xl shadow p-6 flex flex-col items-center">
          {/* Location Marker Icon */}
          <svg className="w-8 h-8 mb-2 text-teal-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 11c1.104 0 2-.896 2-2s-.896-2-2-2-2 .896-2 2 .896 2 2 2zm0 10c-4.418 0-8-4.03-8-9a8 8 0 1116 0c0 4.97-3.582 9-8 9z" /></svg>
          <span className="font-semibold text-teal-500">Locate</span>
        </div>
        <div className="bg-white rounded-xl shadow p-6 flex flex-col items-center">
          {/* Refresh/Recycle Icon */}
          <svg className="w-8 h-8 mb-2 text-teal-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582M20 20v-5h-.581M19.418 15A7.974 7.974 0 0020 12c0-4.418-3.582-8-8-8a7.974 7.974 0 00-3.418.732M4.582 9A7.974 7.974 0 004 12c0 4.418 3.582 8 8 8a7.974 7.974 0 003.418-.732" /></svg>
          <span className="font-semibold text-teal-500">Circulate</span>
        </div>
      </div>
    </section>
  );
}