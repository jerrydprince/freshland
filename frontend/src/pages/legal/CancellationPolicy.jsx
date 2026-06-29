import React from 'react';

const CancellationPolicy = () => {
  return (
    <div className="pt-24 pb-16 min-h-screen bg-dark-900">
      <div className="container mx-auto px-6 max-w-4xl">
        <h1 className="text-4xl md:text-5xl font-serif text-white mb-8 text-center">Cancellation Policy</h1>
        
        <div className="bg-dark-800 border border-dark-700 p-8 md:p-12 text-gray-300 space-y-8 leading-relaxed">
          <p className="text-lg text-gray-200">Last updated: {new Date().toLocaleDateString()}</p>
          
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">1. General Cancellation Rules</h2>
            <p>We understand that plans can change. To provide maximum flexibility while ensuring fairness to our property owners and other guests, our standard cancellation policy applies to all direct bookings.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">2. Standard Refund Timelines</h2>
            <ul className="list-disc pl-6 space-y-4">
              <li>
                <strong className="text-white">100% Refund:</strong> Cancellations made at least 14 days prior to the scheduled check-in date will receive a full refund, minus any non-refundable payment gateway processing fees.
              </li>
              <li>
                <strong className="text-white">50% Refund:</strong> Cancellations made between 7 and 13 days prior to the scheduled check-in date will receive a 50% refund of the total booking cost.
              </li>
              <li>
                <strong className="text-white">0% Refund:</strong> Cancellations made less than 7 days prior to check-in, or "no-shows", are strictly non-refundable.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">3. Non-Refundable Bookings</h2>
            <p>Certain promotional rates, holiday periods, or special events may be marked as strictly "Non-Refundable" at the time of booking. For these reservations, cancellations will not yield a refund regardless of the timeframe.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">4. Early Departures</h2>
            <p>If you choose to shorten your stay after checking in, the unused nights are non-refundable. We recommend finalizing your travel dates prior to arrival.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">5. Extenuating Circumstances</h2>
            <p>In the event of severe, documented extenuating circumstances (such as medical emergencies or official government travel bans), please contact our support team. Exceptions to this policy are made solely at the discretion of Freshland management.</p>
          </section>
          
          <div className="pt-8 border-t border-dark-700 mt-12">
            <p>Need to cancel or modify a booking? Please visit your <a href="/guest" className="text-gold-500 hover:underline">Guest Portal</a> or <a href="/contact" className="text-gold-500 hover:underline">contact support</a> directly.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CancellationPolicy;
