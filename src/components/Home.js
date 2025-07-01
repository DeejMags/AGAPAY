import React from "react";
import Carousel from "./Carousel";
import About from "./About";

export default function Home() {
  return (
    <>
      <section
        id="home"
        className="relative min-h-screen flex flex-col justify-center items-center text-center px-6 overflow-hidden"
      >
        {/* Background image */}
        <img
          src="https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1500&q=80"
          alt="Background"
          className="absolute inset-0 w-full h-full min-h-screen object-cover z-0"
        />
        {/* Overlay */}
        <div className="absolute inset-0 bg-black bg-opacity-60 z-10" />

        {/* Content */}
        <div className="relative z-20 flex flex-col items-center justify-center min-h-screen">
          <div className="self-end ml-60 text-teal-400 text-2xl md:text-3xl font-bold drop-shadow-lg mb-2">
            Abot Kamay ang Pagbibigay
          </div>
          <h1 className="text-8xl md:text-9xl lg:text-[10rem] font-extrabold text-white drop-shadow-lg">
            Agapay
          </h1>
          <p className="mt-6 mr-60 max-w-xl text-white text-base md:text-xl font-medium drop-shadow">
            An all-in-one platform that promotes a <br></br>circular economy through community <br></br>building and easy exchange of recyclable resources.
          </p>
          <a
            href="#waitlist"
            className="mt-10 bg-teal-400 hover:bg-teal-500 text-white font-semibold py-3 px-8 rounded-full flex items-center gap-2 transition shadow-lg"
          >
            Join the Waitlist
            <span className="ml-2">↗</span>
          </a>
        </div>
      </section>
      <Carousel />
      <About />
    </>
  );
}