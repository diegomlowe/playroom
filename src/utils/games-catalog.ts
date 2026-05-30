export interface GameDefinition {
  id: string;
  name: string;
  tagline: string;
  description: string;
  status: 'live' | 'coming-soon';
  route: string;
  icon: string; // Lucide icon name
  accentColor: string; // CSS color
  potBadge?: string; // e.g. "3x pot" or "2x pot*"
  potBadgeNote?: string; // footnote for asterisk
  stats: Array<{ label: string; value: string }>;
}

export const gamesCatalog: GameDefinition[] = [
  {
    id: 'tapwars',
    name: 'TapWars',
    tagline: 'Tap faster than your opponents to win.',
    description: 'Four players enter. Ten seconds of pure speed. The fastest tapper takes the prize — pure reflexes.',
    status: 'live',
    route: '/tapwars/new',
    icon: 'Zap',
    accentColor: 'hsl(var(--accent))',
    potBadge: '3x pot',
    stats: [
      { label: 'Buy-in', value: '0.01-0.5 SOL' },
      { label: '1st Prize', value: '3x pot' },
    ],
  },
  {
    id: 'flashtap',
    name: 'FlashTap',
    tagline: 'React to the flash before your rivals.',
    description: 'Four players wait for a random flash. Closest reaction time wins. Pure instinct — zero input lag.',
    status: 'live',
    route: '/flashtap/new',
    icon: 'Clock',
    accentColor: 'hsl(160 100% 45%)',
    potBadge: '3x pot',
    stats: [
      { label: 'Buy-in', value: '0.01-0.5 SOL' },
      { label: '1st Prize', value: '3x pot' },
    ],
  },
  {
    id: 'coinflip',
    name: 'CoinFlip',
    tagline: '1v1 heads or tails. VRF decides.',
    description: 'Create or join a 1v1 match. Pay your buy-in. The blockchain flips the coin — winner takes the pot.',
    status: 'live',
    route: '/coinflip',
    icon: 'Trophy',
    accentColor: 'hsl(45 100% 60%)',
    potBadge: '2x pot*',
    potBadgeNote: '*minus platform fee',
    stats: [
      { label: 'Buy-in', value: '0.01-0.1 SOL' },
      { label: 'Winner', value: '2x pot*' },
    ],
  },
  {
    id: 'rps',
    name: 'Rock Paper Scissors',
    tagline: 'Best of 3, commit-reveal.',
    description: 'Challenge an opponent to best-of-3 RPS. Commit-reveal cryptography ensures neither player can cheat.',
    status: 'live',
    route: '/rps',
    icon: 'Scissors',
    accentColor: 'hsl(280 100% 65%)',
    potBadge: '2x pot*',
    potBadgeNote: '*minus platform fee',
    stats: [
      { label: 'Buy-in', value: '0.01-0.1 SOL' },
      { label: 'Winner', value: '2x pot*' },
    ],
  },
];
