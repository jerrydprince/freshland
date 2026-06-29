import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

const FAQItem = ({ question, answer }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border border-dark-700 bg-dark-800 rounded-lg overflow-hidden transition-all duration-300">
      <button 
        onClick={() => setIsOpen(!isOpen)} 
        className="w-full flex justify-between items-center p-6 text-left hover:bg-dark-700/50 transition-colors"
      >
        <h3 className="text-lg font-medium text-white pr-8">{question}</h3>
        {isOpen ? (
          <ChevronUp className="text-gold-500 flex-shrink-0" size={24} />
        ) : (
          <ChevronDown className="text-gray-200 flex-shrink-0" size={24} />
        )}
      </button>
      
      {isOpen && (
        <div className="p-6 pt-0 text-gray-200 leading-relaxed border-t border-dark-700/50 mt-2 bg-dark-800">
          {answer}
        </div>
      )}
    </div>
  );
};

const FAQ = () => {
  const faqs = [
    {
      question: "What time is check-in and check-out?",
      answer: "Standard check-in time is from 2:00 PM, and check-out is by 11:00 AM. If you require an early check-in or late check-out, please contact our front desk team. While we try to accommodate all requests, they are strictly subject to availability and may incur a fee."
    },
    {
      question: "Are pets allowed in the apartments?",
      answer: "To ensure the comfort and safety of all our guests, pets are generally not allowed in our standard luxury apartments. However, we do have specific pet-friendly units available upon special request. Please contact us prior to booking if you plan to travel with a pet."
    },
    {
      question: "Is there daily housekeeping service?",
      answer: "Yes, complimentary light housekeeping is provided daily for short stays. For long-term stays (over 7 days), full deep-cleaning and linen changes are scheduled twice a week. You can request additional housekeeping services through your guest portal."
    },
    {
      question: "Do you offer airport transfers?",
      answer: "Yes, we offer premium airport pickup and drop-off services using our fleet of luxury vehicles. This service can be booked as an add-on during your reservation process or requested later via the guest dashboard."
    },
    {
      question: "How do I cancel or modify my booking?",
      answer: "You can modify or cancel your booking directly through the Guest Dashboard using your booking reference and email. Please note that modifications are subject to availability, and cancellations are governed by our standard Cancellation Policy."
    },
    {
      question: "Is there parking available on-site?",
      answer: "Yes, secure, complimentary underground parking is available for all registered guests. Each apartment is allocated one dedicated parking space. Valet service is also available upon request."
    }
  ];

  return (
    <div className="pt-24 pb-20 min-h-screen bg-dark-900">
      <div className="container mx-auto px-6 max-w-4xl">
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-serif text-white mb-4">Frequently Asked Questions</h1>
          <p className="text-xl text-gray-200">Everything you need to know about your stay at Freshland.</p>
        </div>
        
        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <FAQItem key={index} question={faq.question} answer={faq.answer} />
          ))}
        </div>
        
        <div className="mt-16 text-center bg-dark-800 border border-dark-700 p-8 rounded-lg">
          <h3 className="text-2xl font-serif text-white mb-4">Still have questions?</h3>
          <p className="text-gray-200 mb-6">Can't find the answer you're looking for? Please chat to our friendly team.</p>
          <a href="/contact" className="btn-primary inline-flex">Get in Touch</a>
        </div>
      </div>
    </div>
  );
};

export default FAQ;
