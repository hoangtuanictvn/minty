import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Alert, AlertDescription } from './ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { 
  Twitter, 
  CheckCircle, 
  AlertCircle, 
  Copy, 
  ExternalLink, 
  User, 
  Trophy,
  Coins,
  TrendingUp
} from 'lucide-react';

interface ProfileVerificationProps {
  isWalletConnected: boolean;
  walletAddress: string;
}

export function ProfileVerification({ isWalletConnected, walletAddress }: ProfileVerificationProps) {
  const [xHandle, setXHandle] = useState('');
  const [isVerified, setIsVerified] = useState(false);
  const [verificationStep, setVerificationStep] = useState(1);
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');

  const mockUserStats = {
    totalTrades: 156,
    totalVolume: 45678.92,
    profitLoss: 8.7,
    rank: 42,
    ownedTokens: 12
  };

  const verificationMessage = `I am verifying my wallet address ${walletAddress} on Minty.fun platform. #MintyFunVerification`;

  const handleXVerification = () => {
    if (verificationStep === 1) {
      // Step 1: Generate verification message
      setVerificationStep(2);
    } else if (verificationStep === 2) {
      // Step 2: Mock verification check
      setIsVerified(true);
      setVerificationStep(3);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const openTwitterPost = () => {
    const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(verificationMessage)}`;
    window.open(tweetUrl, '_blank');
  };

  return (
    <div className="space-y-6">
      {!isWalletConnected && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Please connect your wallet to access profile features.
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="verification">Verification</TabsTrigger>
          <TabsTrigger value="stats">Statistics</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Profile Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-center">
                  <Avatar className="h-24 w-24">
                    <AvatarFallback className="text-2xl">
                      {username ? username[0].toUpperCase() : 'U'}
                    </AvatarFallback>
                  </Avatar>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    placeholder="Enter your username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    disabled={!isWalletConnected}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bio">Bio</Label>
                  <Input
                    id="bio"
                    placeholder="Tell us about yourself"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    disabled={!isWalletConnected}
                  />
                </div>

                <Button className="w-full" disabled={!isWalletConnected}>
                  Update Profile
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Wallet Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Wallet Address</span>
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-sm">
                        {isWalletConnected 
                          ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
                          : 'Not Connected'
                        }
                      </span>
                      {isWalletConnected && (
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => copyToClipboard(walletAddress)}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">X Verification</span>
                    <Badge variant={isVerified ? "default" : "secondary"}>
                      {isVerified ? (
                        <div className="flex items-center space-x-1">
                          <CheckCircle className="h-3 w-3" />
                          <span>Verified</span>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-1">
                          <AlertCircle className="h-3 w-3" />
                          <span>Unverified</span>
                        </div>
                      )}
                    </Badge>
                  </div>

                  {isVerified && xHandle && (
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">X Handle</span>
                      <span className="text-blue-500">@{xHandle}</span>
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t">
                  <h4 className="font-medium mb-2">Account Status</h4>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-sm">Wallet Connected</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      {isVerified ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-yellow-500" />
                      )}
                      <span className="text-sm">X Account Verification</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="verification">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Twitter className="h-5 w-5" />
                <span>X Account Verification</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {!isVerified ? (
                <>
                  {verificationStep === 1 && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="x-handle">X Handle (without @)</Label>
                        <Input
                          id="x-handle"
                          placeholder="yourusername"
                          value={xHandle}
                          onChange={(e) => setXHandle(e.target.value)}
                          disabled={!isWalletConnected}
                        />
                      </div>
                      
                      <Button 
                        onClick={handleXVerification}
                        disabled={!isWalletConnected || !xHandle}
                        className="w-full"
                      >
                        Start Verification
                      </Button>
                    </div>
                  )}

                  {verificationStep === 2 && (
                    <div className="space-y-4">
                      <Alert>
                        <Twitter className="h-4 w-4" />
                        <AlertDescription>
                          Post the verification message on X to confirm ownership of your account.
                        </AlertDescription>
                      </Alert>

                      <div className="space-y-2">
                        <Label>Verification Message</Label>
                        <div className="p-3 bg-muted rounded-lg">
                          <p className="text-sm font-mono">{verificationMessage}</p>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button 
                          onClick={openTwitterPost}
                          className="flex-1 flex items-center space-x-2"
                        >
                          <Twitter className="h-4 w-4" />
                          <span>Post on X</span>
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                        <Button 
                          variant="outline"
                          onClick={() => copyToClipboard(verificationMessage)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>

                      <Button 
                        onClick={handleXVerification}
                        variant="secondary"
                        className="w-full"
                      >
                        I've Posted - Verify Now
                      </Button>
                    </div>
                  )}

                  {verificationStep === 3 && (
                    <div className="text-center space-y-4">
                      <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
                      <h3 className="text-xl font-semibold">Verification Complete!</h3>
                      <p className="text-muted-foreground">
                        Your X account @{xHandle} has been successfully verified.
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center space-y-4">
                  <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
                  <h3 className="text-xl font-semibold">Account Verified</h3>
                  <p className="text-muted-foreground">
                    Your X account @{xHandle} is verified and linked to your wallet.
                  </p>
                  <Button 
                    variant="outline"
                    onClick={() => {
                      setIsVerified(false);
                      setVerificationStep(1);
                      setXHandle('');
                    }}
                  >
                    Re-verify Account
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stats">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-2">
                  <Trophy className="h-8 w-8 text-yellow-500" />
                  <div>
                    <p className="text-2xl font-bold">#{mockUserStats.rank}</p>
                    <p className="text-xs text-muted-foreground">Global Rank</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-2">
                  <Coins className="h-8 w-8 text-blue-500" />
                  <div>
                    <p className="text-2xl font-bold">{mockUserStats.totalTrades}</p>
                    <p className="text-xs text-muted-foreground">Total Trades</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-2">
                  <TrendingUp className="h-8 w-8 text-green-500" />
                  <div>
                    <p className="text-2xl font-bold">${mockUserStats.totalVolume.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">Total Volume</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-2">
                  <User className="h-8 w-8 text-purple-500" />
                  <div>
                    <p className="text-2xl font-bold text-green-600">+{mockUserStats.profitLoss}%</p>
                    <p className="text-xs text-muted-foreground">Profit/Loss</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Trading History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="text-center text-muted-foreground">
                  <p>Your trading history will appear here once you start trading.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}