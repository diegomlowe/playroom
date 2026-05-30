import React from 'react';
import { useNavigate } from 'react-router-dom';
import { PageLayout } from '@/components/poof-ui';
import { Button } from '@/components/ui/button';
import { ArrowLeft, FileText } from 'lucide-react';

const SECTIONS = [
  {
    title: '1. Acceptance of Terms',
    body: `By connecting your wallet and interacting with The Playroom Protocol ("the Protocol"), you acknowledge that you have read, understood, and agree to be bound by these Terms of Service. If you do not agree to these terms, you must immediately cease using the Protocol. Your continued use of the Protocol following any modification to these terms constitutes your acceptance of such modifications.`,
  },
  {
    title: '2. Eligibility',
    body: `You must be at least 18 years of age (or the age of majority in your jurisdiction, whichever is higher) to participate in any game on the Protocol. You represent that you are not a resident of, or located in, any jurisdiction where participation in blockchain-based games of chance or skill is prohibited. It is your sole responsibility to determine whether your participation is lawful in your jurisdiction. The Protocol makes no representations regarding legal compliance in any specific location.`,
  },
  {
    title: '3. Nature of Games and Financial Risk',
    body: `Games on the Protocol involve real cryptocurrency assets (SOL) and carry inherent financial risk. You may lose some or all funds placed as a buy-in in any match. The outcome of coin-flip and reaction-time games is determined by on-chain VRF randomness or player performance and cannot be predicted or influenced by the Protocol operators. Past results do not guarantee future outcomes. Never participate with funds you cannot afford to lose. The Protocol is not a financial institution and does not provide any form of investment return guarantee.`,
  },
  {
    title: '4. Smart Contract Risk',
    body: `The Protocol is governed by immutable smart contracts deployed on the Solana blockchain. While the contracts have been formally verified and audited, no software is entirely free from vulnerabilities. By participating, you accept the risk of potential smart contract bugs, oracle failures, network congestion, or other technical failures that may result in loss of funds. The Protocol operators are not liable for losses arising from blockchain-level failures, Solana network outages, third-party oracle failures, or any event outside the Protocol's direct control.`,
  },
  {
    title: '5. Prohibited Conduct',
    body: `You agree not to use the Protocol for any unlawful purpose, including but not limited to: money laundering, terrorist financing, sanctions evasion, or any other activity prohibited under applicable law. You agree not to attempt to exploit, hack, or manipulate the smart contracts, the oracle system, or any supporting infrastructure. The Protocol reserves the right to blacklist wallet addresses that engage in prohibited conduct and to cooperate with law enforcement investigations.`,
  },
  {
    title: '6. Fees',
    body: `The Protocol charges a 3% protocol fee on all resolved match pots. This fee is non-refundable and is collected automatically by the FEE_POOL smart contract at resolution time. Network transaction fees (gas/rent) on Solana are paid directly to validators and are not controlled by the Protocol. Fee rates may be modified via governance vote with appropriate notice to TPR token holders.`,
  },
  {
    title: '7. Limitation of Liability',
    body: `To the maximum extent permitted by applicable law, the Protocol and its operators shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising out of or related to your use of the Protocol. In no event shall the total liability of the Protocol to any user exceed the amount of buy-in fees paid by that user in the thirty (30) days preceding the claim. Some jurisdictions do not allow the exclusion of certain warranties or limitation of liability, so some of the above limitations may not apply to you.`,
  },
  {
    title: '8. Governing Law',
    body: `These Terms shall be governed by and construed in accordance with the laws of the jurisdiction in which the Protocol's primary development entity is incorporated, without regard to its conflict of law principles. Any disputes arising under these Terms shall be resolved exclusively through binding arbitration. By using the Protocol, you waive your right to participate in a class action lawsuit.`,
  },
];

export const TermsPage: React.FC = () => {
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
            <FileText className="h-4 w-4 text-primary" />
            <span
              className="text-sm font-black tracking-widest gradient-text"
              style={{ fontFamily: "'Orbitron', sans-serif" }}
            >
              TERMS
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
              TERMS OF SERVICE
            </h1>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Last updated: May 2026 · The Playroom Protocol
            </p>
            <p className="text-muted-foreground text-sm leading-relaxed mt-2">
              Please read these terms carefully before using the Protocol. By connecting your wallet, you agree to all terms below.
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

            {/* Agreement box */}
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 mt-8">
              <p className="text-xs text-muted-foreground leading-relaxed">
                <span className="font-bold text-foreground">By using The Playroom Protocol</span>, you confirm that you have read and agree to these Terms of Service in their entirety. These terms are subject to change; continued use of the Protocol after any modification constitutes acceptance of the revised terms.
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

export default TermsPage;
