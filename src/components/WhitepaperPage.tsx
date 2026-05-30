import React from 'react';
import { useNavigate } from 'react-router-dom';
import { PageLayout } from '@/components/poof-ui';
import { Button } from '@/components/ui/button';
import { ArrowLeft, BookOpen } from 'lucide-react';

const SECTIONS = [
  {
    title: '1. Abstract',
    body: `The Playroom Protocol (TPR) is a decentralized gaming infrastructure deployed on the Solana blockchain. By combining verifiable random functions (VRF), escrow-backed pot mechanics, and a native utility token, TPR delivers provably fair micro-gaming experiences with sub-second finality and on-chain settlement. This document outlines the architecture, tokenomics, and game mechanics underpinning the ecosystem.`,
  },
  {
    title: '2. Pot Mechanics',
    body: `Each game session creates an isolated escrow Program Derived Address (PDA) derived from the match identifier. Player buy-ins are transferred atomically into the escrow at entry time. On resolution, the smart contract distributes 97% of the pot to the verified winner and routes the remaining 3% to the FEE_POOL PDA, which accumulates protocol revenue. No human operator has custody of funds at any point during the match lifecycle. Unclaimed pots from expired matches are claimable by the protocol after a 72-hour timeout window.`,
  },
  {
    title: '3. Verifiable Randomness (VRF)',
    body: `Fairness in all TPR games is enforced via an on-chain Oracle VRF integration. When a match reaches a full-player state, the protocol submits a randomness request anchored to the match PDA. The oracle commits a cryptographic proof that is verified on-chain before the outcome is written to the match state. This ensures that neither the protocol operators, game servers, nor any external party can predict or manipulate the outcome. The VRF proof and its seed are stored in the match document and can be independently audited via any Solana block explorer.`,
  },
  {
    title: '4. TPR Token Utility',
    body: `The native TPR token serves multiple roles within the ecosystem: governance weight in future DAO votes, staking collateral for fee-pool yield sharing, discounted buy-in tiers for TPR holders, and exclusive access to upcoming high-stakes game modes. TPR is a fixed-supply token; no additional minting is possible after the genesis event. The primary token sale allocates 10% of supply to early participants; the remaining supply is distributed via gameplay rewards, liquidity incentives, and a 4-year unlock schedule for the development treasury.`,
  },
  {
    title: '5. Security Model',
    body: `All game logic is enforced at the policy layer, not at the UI layer. The protocol uses a layered access model: players can only write to paths that correspond to their own wallet address; the vault account is the sole authorized entity that may resolve match outcomes; and all financial movements — buy-ins, payouts, and fee collection — are tied to onchain hook executions. Formal verification scripts are maintained in the repository and run against the policy on every deployment to ensure invariant correctness.`,
  },
];

export const WhitepaperPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <PageLayout fullBleed footer={false}>
      <div className="relative min-h-screen flex flex-col">
        {/* Header */}
        <header className="sticky top-0 z-20 flex items-center justify-between px-4 pt-5 pb-3 border-b border-border bg-background/80 backdrop-blur-sm">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="text-sm font-bold tracking-wider" style={{ fontFamily: "'Orbitron', sans-serif" }}>
              PLAYROOM
            </span>
          </button>
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary" />
            <span
              className="text-sm font-black tracking-widest gradient-text"
              style={{ fontFamily: "'Orbitron', sans-serif" }}
            >
              WHITEPAPER
            </span>
          </div>
        </header>

        {/* Hero */}
        <section className="px-4 pt-10 pb-8 text-center border-b border-border/50">
          <div className="max-w-lg mx-auto">
            <h1
              className="text-4xl sm:text-5xl font-black tracking-widest gradient-text mb-3"
              style={{ fontFamily: "'Orbitron', sans-serif" }}
            >
              THE PLAYROOM PROTOCOL
            </h1>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Technical Whitepaper · v1.0 · 2026
            </p>
            <p className="text-muted-foreground text-sm leading-relaxed mt-2">
              Decentralized mini-gaming infrastructure on Solana with provably fair VRF resolution and on-chain pot mechanics.
            </p>
          </div>
        </section>

        {/* Content */}
        <section className="flex-1 px-4 py-8">
          <div className="max-w-lg mx-auto space-y-8">
            {SECTIONS.map((section) => (
              <article key={section.title}>
                <h2
                  className="text-base font-black tracking-widest text-primary mb-3"
                  style={{ fontFamily: "'Orbitron', sans-serif" }}
                >
                  {section.title}
                </h2>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {section.body}
                </p>
              </article>
            ))}

            {/* Disclaimer */}
            <div className="rounded-xl border border-border/50 bg-muted/10 p-4 mt-8">
              <p className="text-xs text-muted-foreground leading-relaxed">
                <span className="font-bold text-foreground">Disclaimer:</span> This whitepaper is for informational purposes only and does not constitute financial, investment, or legal advice. The Playroom Protocol is experimental software. Participation in on-chain games involves real financial risk. Never stake more than you can afford to lose.
              </p>
            </div>
          </div>
        </section>

        {/* Back button */}
        <div className="px-4 pb-10 flex justify-center">
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
      </div>
    </PageLayout>
  );
};

export default WhitepaperPage;
