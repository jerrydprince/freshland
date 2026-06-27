import React from 'react';

const Terms = () => {
  return (
    <div className="pt-24 pb-16 min-h-screen bg-dark-900">
      <div className="container mx-auto px-6 max-w-4xl">
        <h1 className="text-4xl md:text-5xl font-serif text-white mb-8 text-center">Terms and Conditions</h1>
        
        <div className="bg-dark-800 border border-dark-700 p-8 md:p-12 text-gray-300 space-y-8 leading-relaxed">
          <p className="text-lg text-gray-400">Last updated: {new Date().toLocaleDateString()}</p>
          
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">1. Introduction</h2>
            <p>Welcome to Sparkles Apartments. By booking an accommodation with us, you agree to be bound by these Terms and Conditions. Please read them carefully before proceeding with your reservation.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">2. Booking and Reservations</h2>
            <p>All reservations are subject to availability. A booking is only confirmed once a confirmation email has been sent and the required deposit or full payment has been received. We reserve the right to decline any booking at our discretion.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">3. Payment Terms</h2>
            <p>Payments must be made in the currency specified at the time of booking. A deposit may be required to secure your reservation. The remaining balance will be charged according to our payment schedule. Failure to pay on time may result in the cancellation of your booking.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">4. Check-in and Check-out</h2>
            <p>Standard check-in time is from 2:00 PM, and check-out is by 11:00 AM local time. Early check-in and late check-out are subject to availability and may incur additional charges.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">5. House Rules</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>No smoking is permitted inside the apartments.</li>
              <li>Parties or large gatherings are strictly prohibited unless prior written consent is given.</li>
              <li>Pets are not allowed unless explicitly stated in the apartment listing.</li>
              <li>Guests are responsible for any damages caused to the property during their stay.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">6. Liability</h2>
            <p>Sparkles Apartments is not liable for any loss, damage, or injury sustained by guests or their property during their stay. We strongly recommend comprehensive travel insurance.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">7. Amendments to Terms</h2>
            <p>We reserve the right to amend these Terms and Conditions at any time. Any changes will be posted on this page and will apply to all bookings made after the date of publication.</p>
          </section>
          
          <div className="pt-8 border-t border-dark-700 mt-12">
            <p>If you have any questions regarding these Terms and Conditions, please <a href="/contact" className="text-gold-500 hover:underline">contact us</a>.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Terms;
