import { Alert, AlertDescription } from './ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { AlertCircle } from 'lucide-react';
import { ProfileTab, StatisticsTab } from './profile';
import { usePrivy } from "@privy-io/react-auth";

interface ProfileVerificationProps {
  authenticated: boolean;
  walletAddress: string;
}

export function ProfileVerification({ authenticated, walletAddress }: ProfileVerificationProps) {
  const { user } = usePrivy();

  const twitterUsername = user?.twitter?.username

  return (
    <div className="space-y-6">
      {!authenticated && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Please connect your wallet to access profile features.
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="stats">Statistics</TabsTrigger>

        </TabsList>

        <TabsContent value="profile">
          <ProfileTab
            authenticated={authenticated}
            walletAddress={walletAddress}
            twitterUsername={twitterUsername}
          />
        </TabsContent>

        <TabsContent value="stats">
          <StatisticsTab authenticated={authenticated} />
        </TabsContent>
      </Tabs>
    </div>
  );
}