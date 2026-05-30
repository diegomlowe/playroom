import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PageLayout } from '@/components/poof-ui';
import { Button } from '@/components/ui/button';
import { Particles } from '@/components/effects';
import { ArrowLeft, Clock } from 'lucide-react';

const PAGE_CONFIG: Record<string, { title: string; subtitle: string; icon: React.ReactNode }> = {
  marketplace: {
    title: 'Marketplace',
    subtitle: 'Trade TPR tokens and in-game assets on Solana.',
    icon: null, // rendered dynamically below
  },
  whitepaper: {
    title: 'Whitepaper',
    subtitle: 'The full technical overview of the TPR token ecosystem.',
    icon: null,
  },
  terms: {
    title: 'Terms & Conditions',
    subtitle: 'Rules, disclaimers, and everything you need to know.',
    icon: null,
  },
};

export const ComingSoonPage: React.FC = () => {
  const navigate = useNavigate();
  const { page } = useParams<{ page: string }>();

  const config = PAGE_CONFIG[page || ''] ?? {
    title: 'Coming Soon',
    subtitle: 'We are building something great.',
    icon: null,
  };

  return (
    <PageLayout fullBleed footer={false}>
      <div className="relative min-h-screen flex flex-col overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 z-0">
          <Particles quantity={40} color="hsl(280 100% 65%)" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background/90" />
        </div>

        {/* Header */}
        <header className="relative z-10 flex items-center justify-between px-4 pt-5 pb-2">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="text-xs font-semibold" style={{ fontFamily: "'Orbitron', sans-serif" }}>
              PLAYROOM
            </span>
          </button>
        </header>

        {/* Content */}
        <section className="relative z-10 flex-1 flex items-center justify-center px-4">
          <div className="text-center max-w-md">
            {/* Icon */}
            <div className="mb-6 flex justify-center">
              <div
                className="w-20 h-20 rounded-full border-2 border-primary/30 flex items-center justify-center"
                style={{ background: 'hsl(var(--primary) / 0.08)' }}
              >
                <Clock className="h-8 w-8 text-primary/70" />
              </div>
            </div>

            {/* Title */}
            <h1
              className="text-3xl sm:text-4xl font-black tracking-widest gradient-text mb-3"
              style={{ fontFamily: "'Orbitron', sans-serif" }}
            >
              {config.title}
            </h1>

            <p className="text-muted-foreground text-base mb-2 leading-relaxed">
              {config.subtitle}
            </p>

            <p
              className="text-sm text-accent/80 font-bold tracking-wider mb-10"
              style={{ fontFamily: "'Orbitron', sans-serif" }}
            >
              COMING SOON
            </p>

            {/* Back Button */}
            <Button
              onClick={() => navigate('/')}
              size="lg"
              className="h-12 px-8 font-bold tracking-widest rounded-2xl shadow-lg shadow-primary/30 active:scale-95 transition-transform"
              style={{ fontFamily: "'Orbitron', sans-serif" }}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              BACK TO PLAYROOM
            </Button>
          </div>
        </section>
      </div>
    </PageLayout>
  );
};

export default ComingSoonPage;
