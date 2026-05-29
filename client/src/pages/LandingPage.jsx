import LightRays from '../components/common/LightRays.jsx';
import HeroSection from '../components/landing/HeroSection.jsx';
import StatsTicker from '../components/landing/StatsTicker.jsx';
import FeaturesSection from '../components/landing/FeaturesSection.jsx';
import DarkProblemPanel from '../components/landing/DarkProblemPanel.jsx';
import StatsSection from '../components/landing/StatsSection.jsx';
import CTAFooterBand from '../components/landing/CTAFooterBand.jsx';
import Footer from '../components/landing/Footer.jsx';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-black">
      {/* Hero section with LightRays background */}
      <section className="relative min-h-screen overflow-hidden">
        {/* Animated Background */}
        <div className="absolute inset-0 z-0">
          <LightRays
            raysOrigin="top-center"
            raysColor="#60A5FA"
            raysSpeed={2.5}
            lightSpread={0.6}
            rayLength={4}
            pulsating
            fadeDistance={3.5}
            saturation={2.5}
            followMouse
            mouseInfluence={0.2}
            noiseAmount={0.08}
            distortion={0.12}
          />
        </div>

        {/* Dark Overlay — reduced opacity for more light visibility */}
        <div className="absolute inset-0 bg-black/40 z-10" />

        {/* Hero Content */}
        <div className="relative z-20">
          <div className="w-full max-w-[1400px] mx-auto px-6 lg:px-10">
            <HeroSection />
          </div>
        </div>
      </section>

      {/* Rest of the page content */}
      <div className="w-full max-w-[1400px] mx-auto flex flex-col gap-16 lg:gap-[80px] px-6 lg:px-10 py-16">
        <StatsTicker />
        <FeaturesSection />
        <DarkProblemPanel />
        <StatsSection />
        <CTAFooterBand />
      </div>

      {/* Footer */}
      <Footer />
    </div>
  );
}
