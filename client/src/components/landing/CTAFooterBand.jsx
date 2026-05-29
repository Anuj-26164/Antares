import { useNavigate } from 'react-router-dom';
import Button from '../common/Button';

export default function CTAFooterBand() {
  const navigate = useNavigate();

  return (
    <section className="bg-obsidian rounded-[36px] p-12 md:p-16 text-center">
      <h2 className="text-snow text-[36px] md:text-[48px] font-bold mb-4">
        Ready to get started?
      </h2>
      <p className="text-ash text-[17px] md:text-[19px] mb-10 max-w-lg mx-auto leading-relaxed">
        Join thousands of event organizers and photographers already using
        Antares to manage their media. Free forever for small teams.
      </p>
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
        <Button
          variant="outline"
          size="lg"
          pill
          className="border-graphite text-snow hover:bg-graphite/20"
          onClick={() => navigate('/register')}
        >
          Create Free Account
        </Button>
        <Button
          variant="ghost"
          size="lg"
          pill
          className="text-ash hover:text-snow"
          onClick={() => navigate('/events')}
        >
          Browse Events →
        </Button>
      </div>
    </section>
  );
}
