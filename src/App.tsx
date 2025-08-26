import { useState, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
import { Button } from './components/ui/button';
import { Badge } from './components/ui/badge';
import { TokenList } from './components/TokenList';
import { Leaderboard } from './components/Leaderboard';
import { TradingInterface } from './components/TradingInterface';
import { ProfileVerification } from './components/ProfileVerification';
import { Wallet, Trophy, Coins, User, ExternalLink, Sparkles } from 'lucide-react';
import MyWalletProvider from "./components/my-wallet-provider";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { useConnectWallet, useLogin, usePrivy, useSolanaWallets } from "@privy-io/react-auth";

export default function App() {
  const { wallets, createWallet } = useSolanaWallets();
  const { user, ready, authenticated, login, getAccessToken, logout } =
    usePrivy();
  const { connectWallet } = useConnectWallet();
  const [walletAddress, setWalletAddress] = useState('');
  const [selectedToken, setSelectedToken] = useState(null);

  const connectPhantomWallet = async () => {
    try {
      login({ loginMethods: ['wallet'] })
      setWalletAddress(wallets[0].address)
      console.log(wallets[0].address);

    } catch (error) {
      console.error('Error connecting wallet:', error);
    }
  };

  const disconnectWallet = () => {
    logout()
    setWalletAddress('');
  };


  return (

    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="relative">
                <Sparkles className="h-8 w-8 text-green-500" />
                <div className="absolute -top-1 -right-1 h-3 w-3 bg-green-400 rounded-full animate-pulse"></div>
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-green-600 to-emerald-500 bg-clip-text text-transparent">
                  Minty.fun
                </h1>
                <p className="text-xs text-muted-foreground">X-Verified Token Trading</p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              {authenticated ? (
                <div className="flex items-center space-x-2">
                  <Badge variant="secondary" className="flex items-center space-x-1">
                    <Wallet className="h-3 w-3" />
                    <span>{`${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`}</span>
                  </Badge>
                  <Button variant="outline" onClick={disconnectWallet}>
                    Disconnect
                  </Button>
                </div>
              ) : (
                <Button onClick={connectPhantomWallet} className="flex items-center space-x-2">
                  <Wallet className="h-4 w-4" />
                  <span>Connect Phantom</span>
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="tokens" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="tokens" className="flex items-center space-x-2">
              <Coins className="h-4 w-4" />
              <span>X Tokens</span>
            </TabsTrigger>
            <TabsTrigger value="trading" className="flex items-center space-x-2">
              <ExternalLink className="h-4 w-4" />
              <span>Trading</span>
            </TabsTrigger>
            <TabsTrigger value="leaderboard" className="flex items-center space-x-2">
              <Trophy className="h-4 w-4" />
              <span>Leaderboard</span>
            </TabsTrigger>
            <TabsTrigger value="profile" className="flex items-center space-x-2">
              <User className="h-4 w-4" />
              <span>Profile</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tokens">
            <TokenList
              authenticated={authenticated}
              onSelectToken={setSelectedToken}
            />
          </TabsContent>

          <TabsContent value="trading">
            <TradingInterface
              authenticated={authenticated}
              selectedToken={selectedToken}
            />
          </TabsContent>

          <TabsContent value="leaderboard">
            <Leaderboard />
          </TabsContent>

          <TabsContent value="profile">
            <ProfileVerification
              authenticated={authenticated}
              walletAddress={walletAddress}
            />
          </TabsContent>
        </Tabs>
      </main>
    </div>


  );
}