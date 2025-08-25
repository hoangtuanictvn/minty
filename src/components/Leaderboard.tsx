import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Trophy, Medal, Award, TrendingUp, Zap } from 'lucide-react';

const leaderboardData = [
  {
    rank: 1,
    username: 'CryptoWhale',
    walletAddress: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
    totalVolume: 2456789.45,
    profitLoss: 15.8,
    trades: 1247,
    verified: true,
    xHandle: '@cryptowhale'
  },
  {
    rank: 2,
    username: 'SolanaTrader',
    walletAddress: '4xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
    totalVolume: 1987654.32,
    profitLoss: 12.3,
    trades: 956,
    verified: true,
    xHandle: '@solanatrader'
  },
  {
    rank: 3,
    username: 'DegenApe',
    walletAddress: '5xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
    totalVolume: 1567890.12,
    profitLoss: 9.7,
    trades: 2103,
    verified: false,
    xHandle: null
  },
  {
    rank: 4,
    username: 'DeFiMaster',
    walletAddress: '6xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
    totalVolume: 1234567.89,
    profitLoss: 8.2,
    trades: 734,
    verified: true,
    xHandle: '@defimaster'
  },
  {
    rank: 5,
    username: 'TokenHunter',
    walletAddress: '8xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
    totalVolume: 987654.32,
    profitLoss: 6.9,
    trades: 1489,
    verified: false,
    xHandle: null
  },
  {
    rank: 6,
    username: 'SolGamer',
    walletAddress: '9xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
    totalVolume: 876543.21,
    profitLoss: 5.4,
    trades: 612,
    verified: true,
    xHandle: '@solgamer'
  },
  {
    rank: 7,
    username: 'NFTFliper',
    walletAddress: 'AxKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
    totalVolume: 765432.10,
    profitLoss: 4.1,
    trades: 823,
    verified: false,
    xHandle: null
  },
  {
    rank: 8,
    username: 'MetaTrader',
    walletAddress: 'BxKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
    totalVolume: 654321.09,
    profitLoss: 3.8,
    trades: 567,
    verified: true,
    xHandle: '@metatrader'
  }
];

const getRankIcon = (rank: number) => {
  switch (rank) {
    case 1:
      return <Trophy className="h-5 w-5 text-yellow-500" />;
    case 2:
      return <Medal className="h-5 w-5 text-gray-400" />;
    case 3:
      return <Award className="h-5 w-5 text-amber-600" />;
    default:
      return <span className="h-5 w-5 flex items-center justify-center text-sm font-bold text-muted-foreground">#{rank}</span>;
  }
};

export function Leaderboard() {
  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-bold">Top Traders Leaderboard</h2>
        <p className="text-muted-foreground">
          Rankings based on total trading volume and profit/loss ratio
        </p>
      </div>

      {/* Top 3 Podium */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {leaderboardData.slice(0, 3).map((trader) => (
          <Card key={trader.rank} className={`${trader.rank === 1 ? 'ring-2 ring-yellow-400' : ''} hover:shadow-lg transition-shadow`}>
            <CardHeader className="text-center pb-2">
              <div className="flex justify-center mb-2">
                {getRankIcon(trader.rank)}
              </div>
              <div className="flex justify-center mb-2">
                <Avatar className="h-16 w-16">
                  <AvatarFallback className="text-lg font-bold">
                    {trader.username[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </div>
              <CardTitle className="flex items-center justify-center space-x-2">
                <span>{trader.username}</span>
                {trader.verified && <Zap className="h-4 w-4 text-blue-500" />}
              </CardTitle>
              {trader.xHandle && (
                <p className="text-sm text-blue-500">{trader.xHandle}</p>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-center">
                <p className="text-2xl font-bold text-primary">
                  ${trader.totalVolume.toLocaleString()}
                </p>
                <p className="text-sm text-muted-foreground">Total Volume</p>
              </div>
              
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">P&L:</span>
                <span className="text-green-600 font-medium flex items-center">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  +{trader.profitLoss}%
                </span>
              </div>
              
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Trades:</span>
                <span className="font-medium">{trader.trades.toLocaleString()}</span>
              </div>

              <p className="text-xs text-muted-foreground text-center">
                {`${trader.walletAddress.slice(0, 6)}...${trader.walletAddress.slice(-4)}`}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Full Leaderboard Table */}
      <Card>
        <CardHeader>
          <CardTitle>Full Rankings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {leaderboardData.map((trader) => (
              <div key={trader.rank} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center justify-center w-8">
                    {getRankIcon(trader.rank)}
                  </div>
                  
                  <Avatar>
                    <AvatarFallback>
                      {trader.username[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className="font-medium">{trader.username}</h3>
                      {trader.verified && <Zap className="h-3 w-3 text-blue-500" />}
                    </div>
                    <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                      <span>{`${trader.walletAddress.slice(0, 6)}...${trader.walletAddress.slice(-4)}`}</span>
                      {trader.xHandle && (
                        <>
                          <span>•</span>
                          <span className="text-blue-500">{trader.xHandle}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-6 text-sm">
                  <div className="text-right">
                    <p className="font-medium">${trader.totalVolume.toLocaleString()}</p>
                    <p className="text-muted-foreground">Volume</p>
                  </div>
                  
                  <div className="text-right">
                    <p className="font-medium text-green-600 flex items-center">
                      <TrendingUp className="h-3 w-3 mr-1" />
                      +{trader.profitLoss}%
                    </p>
                    <p className="text-muted-foreground">P&L</p>
                  </div>
                  
                  <div className="text-right">
                    <p className="font-medium">{trader.trades.toLocaleString()}</p>
                    <p className="text-muted-foreground">Trades</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}