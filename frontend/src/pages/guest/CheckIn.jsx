import React, { useState } from 'react';
import { UploadCloud, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';

const CheckIn = () => {
  const [agreed, setAgreed] = useState(false);
  const [idUploaded, setIdUploaded] = useState(false);
  const [arrivalTime, setArrivalTime] = useState('14:00 - 15:00');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleIdUpload = (e) => {
    e.preventDefault();
    setIdUploaded(true);
    toast.success("Identity verification document uploaded successfully!");
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!idUploaded) {
      toast.error("Please upload a valid government-issued ID first.");
      return;
    }
    if (!agreed) {
      toast.error("You must read and agree to the Terms & Conditions of stay.");
      return;
    }
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setIsSubmitted(true);
      toast.success("Contactless online check-in successfully submitted!");
    }, 1500);
  };

  if (isSubmitted) {
    return (
      <div className="animate-in fade-in zoom-in-95 duration-500 text-white max-w-3xl mx-auto">
        <div className="bg-dark-800 border border-dark-700 p-10 text-center rounded-xl shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-brand-500 to-amber-500"></div>
          <div className="w-20 h-20 bg-green-500/10 border border-green-500/20 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6 text-3xl font-bold animate-bounce">
            ✓
          </div>
          <h2 className="text-3xl font-black mb-4">Check-In Successful!</h2>
          <p className="text-gray-300 max-w-lg mx-auto mb-8">
            Your identity details and agreed terms of stay have been successfully logged. Our Front Desk team will have your keys programmed and suites ready for your arrival.
          </p>
          <div className="bg-dark-900 border border-dark-700 p-6 rounded-lg text-left max-w-md mx-auto space-y-3">
            <p className="text-xs text-gray-500 uppercase tracking-widest font-bold">Registration details</p>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Arrival Time:</span>
              <span className="text-white font-bold">{arrivalTime}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">ID Verification:</span>
              <span className="text-green-400 font-bold">✓ Approved</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Terms & Conditions:</span>
              <span className="text-brand-500 font-bold">✓ Agreed & Accepted</span>
            </div>
          </div>
          <a href="/dashboard" className="btn-primary py-3 px-8 inline-block mt-8 font-bold text-sm">Return to Guest Dashboard</a>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-500 pb-20 text-white">
      <h2 className="text-2xl font-bold mb-2 tracking-tight">Contactless Online Check-in</h2>
      <p className="text-gray-400 mb-8">Fast-track your arrival by verifying your ID and accepting house policies online.</p>

      <div className="bg-dark-800 border border-dark-700 rounded-xl shadow-xl overflow-hidden max-w-3xl">
        <div className="bg-dark-900/60 p-4 border-b border-dark-700/60 text-xs text-amber-500 flex gap-3 items-center">
          <ShieldCheck size={18} className="flex-shrink-0 text-amber-500" />
          <p className="font-semibold">Online check-in opens 48 hours prior to arrival and registers your legal consent to terms of stay.</p>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-8">
          {/* Step 1: ID verification */}
          <div>
            <h3 className="text-lg font-bold mb-3 border-b border-dark-700 pb-2 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-brand-500 text-dark-900 flex items-center justify-center text-xs font-black">1</span>
              Identity Verification
            </h3>
            <p className="text-sm text-gray-400 mb-4">Please upload a clear copy of a valid government-issued ID (Passport, Driver's License, or National Identity Card).</p>
            
            {idUploaded ? (
              <div className="border border-green-500/30 bg-green-500/5 p-6 rounded-lg text-center flex flex-col items-center justify-center">
                <div className="w-12 h-12 rounded-full bg-green-500/10 text-green-500 flex items-center justify-center font-bold text-xl mb-2">✓</div>
                <p className="text-white font-bold">Identity Verification Document Uploaded</p>
                <p className="text-xs text-gray-400 mt-1">ID document successfully captured and registered.</p>
                <button type="button" onClick={() => setIdUploaded(false)} className="text-xs text-brand-500 hover:underline mt-3">Upload a different file</button>
              </div>
            ) : (
              <div onClick={handleIdUpload} className="border-2 border-dashed border-dark-700 bg-dark-900 hover:border-brand-500 p-8 text-center flex flex-col items-center justify-center cursor-pointer rounded-lg transition-all duration-300 group">
                <UploadCloud size={36} className="text-brand-500 mb-3 group-hover:scale-110 transition-transform" />
                <p className="text-white font-bold mb-1 group-hover:text-brand-400">Click to upload verification document</p>
                <p className="text-xs text-gray-500">Supports PNG, JPG, or PDF up to 5MB</p>
              </div>
            )}
          </div>

          {/* Step 2: Estimated Arrival */}
          <div>
            <h3 className="text-lg font-bold mb-4 border-b border-dark-700 pb-2 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-brand-500 text-dark-900 flex items-center justify-center text-xs font-black">2</span>
              Estimated Arrival Time
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-dark-900/40 p-5 rounded-lg border border-dark-700/60">
              <div>
                <label className="block text-xs uppercase font-bold tracking-wider text-gray-400 mb-2">Arrival Suite Date</label>
                <input type="text" value="Scheduled Date" disabled className="w-full bg-dark-900 border border-dark-700 text-gray-500 px-4 py-3 rounded cursor-not-allowed font-medium text-sm" />
              </div>
              <div>
                <label className="block text-xs uppercase font-bold tracking-wider text-gray-400 mb-2">Arrival Suite Time Window</label>
                <select value={arrivalTime} onChange={e => setArrivalTime(e.target.value)} className="w-full bg-dark-900 border border-dark-700 text-white px-4 py-3 rounded focus:border-brand-500 outline-none cursor-pointer text-sm font-semibold">
                  <option value="14:00 - 15:00">14:00 - 15:00 (Standard)</option>
                  <option value="15:00 - 16:00">15:00 - 16:00</option>
                  <option value="16:00 - 17:00">16:00 - 17:00</option>
                  <option value="17:00 - 18:00">17:00 - 18:00</option>
                  <option value="18:00 - 19:00">18:00 - 19:00</option>
                  <option value="After 19:00">After 19:00 (Late Arrival)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Step 3: Terms & Conditions Agreement */}
          <div>
            <h3 className="text-lg font-bold mb-3 border-b border-dark-700 pb-2 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-brand-500 text-dark-900 flex items-center justify-center text-xs font-black">3</span>
              Digital Signature Agreement
            </h3>
            <p className="text-sm text-gray-400 mb-4">Please review and accept our Terms & Conditions of stay below to complete your contactless registration:</p>
            
            {/* Scrollable Terms & Conditions Box */}
            <div className="bg-dark-900 border border-dark-700 rounded-lg p-4 h-48 overflow-y-auto text-xs text-gray-400 space-y-3 mb-4 scrollbar-thin select-text">
              <p className="font-bold text-white text-sm uppercase border-b border-dark-700 pb-1">APARTMENT STAY POLICIES & AGREEMENT</p>
              
              <p className="font-bold text-white tracking-wider">1. Check-In & Check-Out Times</p>
              <p>Guests agree that standard check-in time starts at 2:00 PM on the day of arrival, and check-out time is strictly set for 11:00 AM on the day of departure. Late check-out requests are subject to suite availability and standard rate adjustments.</p>
              
              <p className="font-bold text-white tracking-wider">2. Absolute Non-Smoking Policy</p>
              <p>For the health and luxury environment of our guests, smoking of any substance (including cigarettes, cigars, electronic devices, vapes, and cannabis) is strictly prohibited inside the apartments, on balconies, and in all enclosed common areas. A professional deep-cleaning penalty of ₦50,000 will be instantly applied for violations.</p>
              
              <p className="font-bold text-white tracking-wider">3. Liability for Damages & Incidentals</p>
              <p>The registered guest assumes full financial responsibility for any physical damages, stains, or missing property inside the designated suite caused during their period of occupancy. Guests agree that stay enhancements, laundry, in-room dining, or other incidental expenses will be charged to their booking and must be paid in full at check-out.</p>
              
              <p className="font-bold text-white tracking-wider">4. Code of Conduct & Disturbances</p>
              <p>We observe quiet hours from 10:00 PM to 7:00 AM daily. Unapproved large parties, commercial photoshoots, sub-letting, or any loud disturbance causing nuisance to other occupants are strictly forbidden and may result in immediate evacuation without refund.</p>
            </div>

            {/* Checkbox agreement */}
            <label className="flex items-start gap-4 p-4 bg-dark-900 border border-dark-700 rounded-lg cursor-pointer hover:bg-dark-850 transition-colors">
              <input 
                type="checkbox" 
                checked={agreed} 
                onChange={e => setAgreed(e.target.checked)}
                className="w-6 h-6 mt-0.5 rounded border-dark-700 text-brand-500 accent-brand-500 cursor-pointer" 
              />
              <div>
                <p className="text-sm font-semibold text-white">I agree to the Terms & Conditions of stay</p>
                <p className="text-xs text-gray-400 mt-1">I certify that all uploaded information is accurate and I formally accept all house policies and financial liabilities related to my stay.</p>
              </div>
            </label>
          </div>

          <button 
            type="submit" 
            disabled={isSubmitting || !agreed || !idUploaded}
            className={`w-full py-4 text-base font-bold rounded-lg shadow-lg transition-all ${
              agreed && idUploaded && !isSubmitting
                ? 'bg-brand-500 text-dark-900 hover:bg-brand-400 hover:shadow-brand-500/20'
                : 'bg-dark-700 text-gray-500 cursor-not-allowed'
            }`}
          >
            {isSubmitting ? 'Processing Check-In...' : 'Submit Contactless Check-In'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default CheckIn;
