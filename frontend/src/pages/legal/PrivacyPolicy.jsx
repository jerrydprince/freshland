import React from 'react';

const PrivacyPolicy = () => {
  return (
    <div className="pt-24 pb-16 min-h-screen bg-dark-900">
      <div className="container mx-auto px-6 max-w-4xl">
        <h1 className="text-4xl md:text-5xl font-serif text-white mb-8 text-center">Privacy Policy</h1>
        
        <div className="bg-dark-800 border border-dark-700 p-8 md:p-12 text-gray-300 space-y-8 leading-relaxed">
          <p className="text-lg text-gray-200">Last updated: {new Date().toLocaleDateString()}</p>
          
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">1. Introduction</h2>
            <p>At Freshland, we respect your privacy and are committed to protecting your personal data. This Privacy Policy informs you about how we look after your personal data when you visit our website or book our services.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">2. The Data We Collect</h2>
            <p>We may collect, use, store and transfer different kinds of personal data about you which we have grouped together as follows:</p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li><strong>Identity Data:</strong> includes first name, last name, username or similar identifier, and title.</li>
              <li><strong>Contact Data:</strong> includes billing address, email address and telephone numbers.</li>
              <li><strong>Financial Data:</strong> includes payment card details (processed securely via third-party gateways).</li>
              <li><strong>Transaction Data:</strong> includes details about payments to and from you and other details of services you have purchased from us.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">3. How We Use Your Data</h2>
            <p>We will only use your personal data when the law allows us to. Most commonly, we will use your personal data in the following circumstances:</p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li>Where we need to perform the contract we are about to enter into or have entered into with you (e.g., booking an apartment).</li>
              <li>Where it is necessary for our legitimate interests (or those of a third party) and your interests and fundamental rights do not override those interests.</li>
              <li>Where we need to comply with a legal obligation.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">4. Data Security</h2>
            <p>We have put in place appropriate security measures to prevent your personal data from being accidentally lost, used, or accessed in an unauthorized way, altered, or disclosed. In addition, we limit access to your personal data to those employees, agents, contractors, and other third parties who have a business need to know.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">5. Your Legal Rights</h2>
            <p>Under certain circumstances, you have rights under data protection laws in relation to your personal data, including the right to request access, correction, erasure, restriction, transfer, or to object to processing. To exercise any of these rights, please contact us.</p>
          </section>
          
          <div className="pt-8 border-t border-dark-700 mt-12">
            <p>For data privacy inquiries, please contact our Data Protection Officer via the <a href="/contact" className="text-gold-500 hover:underline">contact page</a>.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
