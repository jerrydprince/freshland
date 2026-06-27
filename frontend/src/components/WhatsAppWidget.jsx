import React, { useState } from 'react';

const WhatsAppWidget = () => {
  const [isHovered, setIsHovered] = useState(false);
  
  // Replace with the actual business WhatsApp number (with country code, no + or spaces)
  const phoneNumber = '2348000000000';
  const defaultMessage = "Hello Sparkles Apartments! I'm interested in booking a stay.";
  
  const handleWhatsAppClick = () => {
    const url = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(defaultMessage)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center justify-end">
      {/* Tooltip that appears on hover */}
      <div 
        className={`bg-dark-800 border border-dark-700 text-white text-sm py-2 px-4 rounded-lg shadow-lg mr-4 transition-all duration-300 origin-right ${
          isHovered ? 'opacity-100 scale-100 translate-x-0' : 'opacity-0 scale-95 translate-x-4 pointer-events-none'
        }`}
      >
        Need help? Chat with us!
        <div className="absolute top-1/2 -right-1.5 -translate-y-1/2 w-3 h-3 bg-dark-800 border-r border-t border-dark-700 transform rotate-45"></div>
      </div>

      {/* Main floating button */}
      <button
        onClick={handleWhatsAppClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="relative group flex items-center justify-center w-14 h-14 bg-[#25D366] hover:bg-[#20bd5a] text-white rounded-full shadow-[0_4px_14px_0_rgba(37,211,102,0.39)] hover:shadow-[0_6px_20px_rgba(37,211,102,0.5)] hover:scale-110 transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-[#25D366]/50"
        aria-label="Chat with us on WhatsApp"
      >
        {/* Pulse effect */}
        <div className="absolute inset-0 rounded-full bg-[#25D366] animate-ping opacity-20"></div>
        
        {/* WhatsApp SVG Icon */}
        <svg 
          viewBox="0 0 24 24" 
          width="28" 
          height="28" 
          stroke="currentColor" 
          strokeWidth="2" 
          fill="none" 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          className="relative z-10"
        >
          <path d="M3 21l1.65-3.8a9 9 0 1 1 3.4 2.9L3 21" />
          <path d="M9 10a.5.5 0 0 0 1 0V9a.5.5 0 0 0-1 0v1a5 5 0 0 0 5 5h1a.5.5 0 0 0 0-1h-1a.5.5 0 0 0 0 1" />
        </svg>
      </button>
    </div>
  );
};

export default WhatsAppWidget;
