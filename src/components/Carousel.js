import React from "react";
import About from "./About";

const items = [
  {
    image: "https://images.unsplash.com/photo-1519125323398-675f0ddb6308?auto=format&fit=crop&w=400&q=80",
    title: "Empty Coke Bottles",
    category: "Plastic, Metal",
    price: "₱40",
    free: true,
  },
  {
    image: "https://images.unsplash.com/photo-1516979187457-637abb4f9353?auto=format&fit=crop&w=400&q=80",
    title: "Gradeschool Books",
    category: "Paper",
    price: "₱160",
    free: true,
  },
  {
    image: "https://images.unsplash.com/photo-1464983953574-0892a716854b?auto=format&fit=crop&w=400&q=80",
    title: "Monoblock Chairs",
    category: "Plastic",
    price: "₱270",
    free: true,
  },
];

export default function Carousel() {
  return (
    <section id="carousel" className="bg-white py-16 px-4 flex flex-col items-center animate-slideUp">
      <div className="w-full max-w-4xl mx-auto text-center">
        <h2 className="text-3xl md:text-4xl font-extrabold text-teal-500 mb-2">
          FREE Recyclable Materials from your fellow Kaagapays
        </h2>
        <p className="text-gray-700 text-lg mb-8">
          Agapay is home to many free and clean recyclable resources from the residents of your community. <span className="font-bold text-gray-900">Feeling FOMO yet?</span>
        </p>
      </div>
      {/* Carousel */}
      <div className="relative w-full max-w-5xl flex items-center justify-center">
        {/* Left Arrow */}
        <button className="absolute left-0 top-1/2 -translate-y-1/2 bg-white rounded-full shadow p-2 z-10 border border-gray-200 hover:bg-gray-100">
          <span className="text-2xl">&#8592;</span>
        </button>
        {/* Cards */}
        <div className="flex gap-6 justify-center w-full">
          {items.map((item, idx) => (
            <div key={idx} className={`bg-white rounded-2xl shadow-lg p-4 w-72 flex flex-col items-center border border-gray-100 animate-slideUp${idx === 1 ? ' animate-slideUp-delay' : ''}`}>
              <img src={item.image} alt={item.title} className="w-full h-40 object-cover rounded-xl mb-4" />
              <div className="w-full text-left">
                <div className="font-semibold text-gray-800 text-lg mb-1">{item.title}</div>
                <div className="text-xs text-gray-500 mb-2">{item.category}</div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-gray-400 line-through">{item.price}</span>
                  <span className="text-teal-500 font-bold">FREE!</span>
                </div>
              </div>
              <button className="mt-auto bg-teal-400 hover:bg-teal-500 text-white font-semibold py-2 px-6 rounded-full transition shadow">
                Add to Cart
              </button>
            </div>
          ))}
        </div>
        {/* Right Arrow */}
        <button className="absolute right-0 top-1/2 -translate-y-1/2 bg-white rounded-full shadow p-2 z-10 border border-gray-200 hover:bg-gray-100">
          <span className="text-2xl">&#8594;</span>
        </button>
      </div>
      {/* Dots */}
      <div className="flex gap-2 justify-center mt-6">
        <span className="w-3 h-3 bg-teal-400 rounded-full inline-block"></span>
        <span className="w-3 h-3 bg-gray-300 rounded-full inline-block"></span>
        <span className="w-3 h-3 bg-gray-300 rounded-full inline-block"></span>
      </div>
    </section>
  );
}
