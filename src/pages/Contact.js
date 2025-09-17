import React, { useState } from "react";
import emailjs from "emailjs-com";
import agapayLogo from "../components/imgs/agapay-logo.svg";

export default function Contact() {
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [sent, setSent] = useState(false);
  const [errors, setErrors] = useState({});

  const handleChange = e => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setErrors({ ...errors, [e.target.name]: "" });
  };

  const handleSubmit = e => {
    e.preventDefault();
    // Validate fields
    const newErrors = {};
    if (!form.name.trim()) newErrors.name = "Name is required.";
    if (!form.email.trim()) newErrors.email = "Email is required.";
    if (!form.subject.trim()) newErrors.subject = "Subject is required.";
    if (!form.message.trim()) newErrors.message = "Message is required.";
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;
    emailjs.send(
      "service_fno7bs2",
      "template_97tlw2o",
      {
        from_name: form.name,
        from_email: form.email,
        subject: form.subject,
        message: form.message,
      },
      "MjjaPZOJ7LK4qerS0"
    )
    .then(() => setSent(true))
    .catch(err => alert("Failed to send message: " + err.text));
  };

  return (
    <section id="contact" className="min-h-screen bg-white flex flex-col items-center justify-center py-10 px-4 sm:px-8">
      <div className="w-full max-w-2xl mx-auto bg-white rounded-3xl shadow-xl flex flex-col items-start justify-center overflow-hidden my-12 gap-6 p-8 sm:p-12">
        <div className="flex flex-col items-start w-full text-left mb-8">
          <div className="flex items-center gap-3 mb-4">
            <img src={agapayLogo} alt="Agapay Logo" className="w-10 h-10 object-contain" />
            <span className="text-2xl font-extrabold text-teal-500">Agapay</span>
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900 mb-2">Contact Us</h1>
          <p className="text-gray-600 text-base mb-4 max-w-md">
            Whether you're a resident, business owner, city official, or curious supporter — we're here to answer your questions and explore meaningful partnerships.
          </p>
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-teal-500 text-white rounded-full w-9 h-9 flex items-center justify-center text-xl">
              <span role="img" aria-label="email">📧</span>
            </div>
            <div>
              <div className="font-bold text-gray-900 text-base">E-mail</div>
              <div className="text-gray-600 text-base">agapay.business@gmail.com</div>
            </div>
          </div>
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-teal-500 text-white rounded-full w-9 h-9 min-w-[2.25rem] min-h-[2.25rem] flex items-center justify-center text-xl">
              <span role="img" aria-label="location">📍</span>
            </div>
            <div>
              <div className="font-bold text-gray-900 text-base">Location</div>
              <div className="text-gray-600 text-base">17 Basement I Legarda Rd., UC-BCF Legarda Campus, Baguio City, Philippines</div>
            </div>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4 items-start text-left">
          <div className="w-full">
            <input
              name="name"
              type="text"
              placeholder="Your Name"
              value={form.name}
              onChange={handleChange}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-teal-300 text-gray-900"
            />
            {errors.name && <div className="text-red-500 text-sm mt-1">{errors.name}</div>}
          </div>
          <div className="w-full">
            <input
              name="email"
              type="email"
              placeholder="Your Email"
              value={form.email}
              onChange={handleChange}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-teal-300 text-gray-900"
            />
            {errors.email && <div className="text-red-500 text-sm mt-1">{errors.email}</div>}
          </div>
          <div className="w-full">
            <input
              name="subject"
              type="text"
              placeholder="Subject"
              value={form.subject}
              onChange={handleChange}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-teal-300 text-gray-900"
            />
            {errors.subject && <div className="text-red-500 text-sm mt-1">{errors.subject}</div>}
          </div>
          <div className="w-full">
            <textarea
              name="message"
              placeholder="Your Message"
              value={form.message}
              onChange={handleChange}
              rows={4}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-teal-300 text-gray-900"
            />
            {errors.message && <div className="text-red-500 text-sm mt-1">{errors.message}</div>}
          </div>
          <button type="submit" className="self-center w-40 sm:w-56 mt-2 bg-teal-500 hover:bg-teal-600 text-white font-bold py-3 rounded-xl transition text-lg shadow">Send</button>
          {sent && <p className="text-green-600 font-semibold mt-2">Message sent!</p>}
        </form>
      </div>
    </section>
  );
}