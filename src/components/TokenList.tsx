import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Search, TrendingUp, TrendingDown, Twitter, ExternalLink, Sparkles } from 'lucide-react';

const mockXTokens = [
  {
    id: 1,
    xHandle: '@elonmusk',
    displayName: 'Elon Musk',
    tokenName: 'MUSK',
    price: 420.69,
    change24h: 15.2,
    marketCap: '2.1B',
    volume24h: '89.4M',
    verified: true,
    followers: '150M',
    description: 'CEO of Tesla & SpaceX. Building the future of sustainable transport and space exploration.',
    profileColor: 'from-blue-500 to-cyan-400'
  },
  {
    id: 2,
    xHandle: '@VitalikButerin',
    displayName: 'Vitalik Buterin',
    tokenName: 'VITALIK',
    price: 1559.73,
    change24h: 8.7,
    marketCap: '890M',
    volume24h: '45.2M',
    verified: true,
    followers: '5.2M',
    description: 'Co-founder of Ethereum. Researcher, writer, and advocate for decentralized systems.',
    profileColor: 'from-purple-500 to-indigo-400'
  },
  {
    id: 3,
    xHandle: '@justinbieber',
    displayName: 'Justin Bieber',
    tokenName: 'BIEBER',
    price: 31.42,
    change24h: -3.8,
    marketCap: '567M',
    volume24h: '23.7M',
    verified: true,
    followers: '113M',
    description: 'Grammy Award-winning artist. Belieber for life. New album coming soon!',
    profileColor: 'from-pink-500 to-rose-400'
  },
  {
    id: 4,
    xHandle: '@MrBeast',
    displayName: 'MrBeast',
    tokenName: 'BEAST',
    price: 1000.00,
    change24h: 25.6,
    marketCap: '1.2B',
    volume24h: '67.8M',
    verified: true,
    followers: '98M',
    description: 'YouTube creator changing the world through viral philanthropy and epic challenges.',
    profileColor: 'from-orange-500 to-yellow-400'
  },
  {
    id: 5,
    xHandle: '@eldenring',
    displayName: 'ELDEN RING',
    tokenName: 'ELDEN',
    price: 59.99,
    change24h: 12.1,
    marketCap: '234M',
    volume24h: '18.9M',
    verified: true,
    followers: '2.1M',
    description: 'Official account for ELDEN RING. FromSoftware\'s epic dark fantasy action RPG.',
    profileColor: 'from-gray-600 to-amber-600'
  },
  {
    id: 6,
    xHandle: '@sundarpichai',
    displayName: 'Sundar Pichai',
    tokenName: 'SUNDAR',
    price: 173.45,
    change24h: 5.3,
    marketCap: '445M',
    volume24h: '12.4M',
    verified: true,
    followers: '4.8M',
    description: 'CEO of Google and Alphabet. Focused on making technology accessible to everyone.',
    profileColor: 'from-blue-600 to-green-500'
  },
  {
    id: 7,
    xHandle: '@taylorswift13',
    displayName: 'Taylor Swift',
    tokenName: 'TAYLOR',
    price: 1989.13,
    change24h: 22.4,
    marketCap: '3.4B',
    volume24h: '156.7M',
    verified: true,
    followers: '95M',
    description: 'Singer-songwriter telling stories through music. Currently on the Eras Tour.',
    profileColor: 'from-purple-400 to-pink-500'
  },
  {
    id: 8,
    xHandle: '@nvidia',
    displayName: 'NVIDIA',
    tokenName: 'NVDA',
    price: 875.23,
    change24h: 18.9,
    marketCap: '1.8B',
    volume24h: '78.3M',
    verified: true,
    followers: '3.2M',
    description: 'Powering the AI revolution with cutting-edge GPU technology and computing platforms.',
    profileColor: 'from-green-500 to-emerald-400'
  }
];

interface TokenListProps {
  authenticated: boolean;
  onSelectToken: (token: any) => void;
}

export function TokenList({ authenticated, onSelectToken }: TokenListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('all');

  const filteredTokens = mockXTokens.filter(token => {
    const matchesSearch = token.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      token.xHandle.toLowerCase().includes(searchTerm.toLowerCase()) ||
      token.tokenName.toLowerCase().includes(searchTerm.toLowerCase());

    if (filter === 'verified') return matchesSearch && token.verified;
    if (filter === 'trending') return matchesSearch && token.change24h > 0;

    return matchesSearch;
  });

  const openXProfile = (xHandle: string) => {
    window.open(`https://x.com/${xHandle.replace('@', '')}`, '_blank');
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-bold bg-gradient-to-r from-green-600 to-emerald-500 bg-clip-text text-transparent">
          X-Verified Token Creators
        </h2>
        <p className="text-muted-foreground">
          Trade tokens from verified X accounts. Each token represents ownership in the creator's ecosystem.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, handle, or token..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant={filter === 'all' ? 'default' : 'outline'}
            onClick={() => setFilter('all')}
          >
            All
          </Button>
          <Button
            variant={filter === 'verified' ? 'default' : 'outline'}
            onClick={() => setFilter('verified')}
          >
            Verified
          </Button>
          <Button
            variant={filter === 'trending' ? 'default' : 'outline'}
            onClick={() => setFilter('trending')}
          >
            Trending
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredTokens.map((token) => (
          <Card key={token.id} className="hover:shadow-lg transition-all duration-200 hover:scale-[1.02]">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`h-12 w-12 rounded-full bg-gradient-to-r ${token.profileColor} flex items-center justify-center relative`}>
                    <span className="text-white font-bold">{token.tokenName[0]}</span>
                    {token.verified && (
                      <div className="absolute -bottom-1 -right-1 h-4 w-4 bg-blue-500 rounded-full flex items-center justify-center">
                        <Twitter className="h-2.5 w-2.5 text-white" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg truncate">{token.displayName}</CardTitle>
                    <div className="flex items-center space-x-2">
                      <p className="text-sm text-blue-500 truncate">{token.xHandle}</p>
                      <button
                        onClick={() => openXProfile(token.xHandle)}
                        className="opacity-60 hover:opacity-100 transition-opacity"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </div>
                <Badge variant="secondary" className="flex items-center space-x-1">
                  <Sparkles className="h-3 w-3" />
                  <span>${token.tokenName}</span>
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground line-clamp-2">{token.description}</p>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Token Price</span>
                  <span className="font-medium">${token.price.toLocaleString()}</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">24h Change</span>
                  <div className={`flex items-center space-x-1 ${token.change24h >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {token.change24h >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    <span className="text-sm font-medium">{Math.abs(token.change24h)}%</span>
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Market Cap</span>
                  <span className="text-sm font-medium">${token.marketCap}</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Followers</span>
                  <span className="text-sm font-medium">{token.followers}</span>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  className="flex-1"
                  onClick={() => onSelectToken(token)}
                  disabled={!authenticated}
                >
                  Trade ${token.tokenName}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => openXProfile(token.xHandle)}
                  className="flex items-center space-x-1"
                >
                  <Twitter className="h-3 w-3" />
                </Button>
              </div>

              {!authenticated && (
                <p className="text-xs text-muted-foreground text-center">
                  Connect your wallet to start trading
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}