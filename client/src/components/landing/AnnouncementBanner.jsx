export default function AnnouncementBanner() {
  return (
    <div className="w-full bg-[#222222] rounded-[48px] px-6 py-3 flex items-center justify-between">
      <p className="text-snow text-[14px] font-normal">
        ✦ Now with AI-powered photo tagging &amp; facial recognition
      </p>
      <a
        href="#features"
        className="text-snow text-[14px] font-medium opacity-80 hover:opacity-100 transition-opacity"
      >
        Learn more →
      </a>
    </div>
  );
}
