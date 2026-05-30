import CoinFlipLobby from '@/components/CoinFlipLobby';
import CoinFlipMatch from '@/components/CoinFlipMatch';
import DailySpinPage from '@/components/DailySpinPage';
import RpsLobby from '@/components/RpsLobby';
import RpsMatch from '@/components/RpsMatch';
import FlashTapCreateGame from '@/components/FlashTapCreateGame';
import FlashTapLobby from '@/components/FlashTapLobby';
import HomePage from '@/components/HomePage';
import Lobby from '@/components/Lobby';
import MarketplacePage from '@/components/MarketplacePage';
import MyMatchesPage from '@/components/MyMatchesPage';
import NicknameGate from '@/components/NicknameGate';
import PlayroomPage from '@/components/PlayroomPage';
import TapWarsCreateGame from '@/components/TapWarsCreateGame';
import TermsPage from '@/components/TermsPage';
import WhitepaperPage from '@/components/WhitepaperPage';
import { Toaster } from '@/components/ui/sonner';
import { ThemeProvider } from '@/hooks/use-theme';
// import { OAuthProvider } from '@/contexts/OAuthContext';
import { JSX } from 'react';
import { Route, Routes } from 'react-router-dom';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { WalletProvider } from '@solana/wallet-adapter-react';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom';

function App(): JSX.Element {
  const wallets = [new PhantomWalletAdapter()];

  return (
    <ThemeProvider>
      <WalletProvider wallets={wallets} autoConnect={true}>
        {/* NOTE: UI Generator - Uncomment OAuthProvider wrapper below if OAuth functionality is needed.
            See .claude/skills/oauth/docs/implementation-guide.md for OAuth implementation guide. */}
        {/* <OAuthProvider> */}
        <div
          id='app-container'
          className='relative min-h-screen flex flex-col bg-background'
        >
          <main id='app-main' className='flex-1'>
            <Routes>
              {/* The Playroom — main landing page */}
              <Route path='/' element={<PlayroomPage />} />

              {/* TapWars */}
              <Route path='/tapwars/new' element={<TapWarsCreateGame />} />
              <Route path='/tapwars' element={<HomePage />} />
              <Route path='/games/:gameId' element={<Lobby />} />

              {/* FlashTap */}
              <Route path='/flashtap/new' element={<FlashTapCreateGame />} />
              <Route path='/flashtap/:matchId' element={<FlashTapLobby />} />

              {/* CoinFlip */}
              <Route path='/coinflip' element={<CoinFlipLobby />} />
              <Route path='/coinflip/:matchId' element={<CoinFlipMatch />} />

              {/* Daily Spin */}
              <Route path='/daily-spin' element={<DailySpinPage />} />

              {/* Rock Paper Scissors */}
              <Route path='/rps' element={<RpsLobby />} />
              <Route path='/rps/:matchId' element={<RpsMatch />} />

              {/* My Matches */}
              <Route path='/my-matches' element={<MyMatchesPage />} />

              {/* Utility pages */}
              <Route path='/marketplace' element={<MarketplacePage />} />
              <Route path='/whitepaper' element={<WhitepaperPage />} />
              <Route path='/terms' element={<TermsPage />} />
            </Routes>
          </main>

          <NicknameGate />
          <Toaster />
        </div>
        {/* </OAuthProvider> */}
      </WalletProvider>
    </ThemeProvider>
  );
}

export default App;
