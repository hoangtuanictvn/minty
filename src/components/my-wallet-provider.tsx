import { PrivyProvider } from "@privy-io/react-auth";
import { PropsWithChildren } from "react";
import { toSolanaWalletConnectors } from "@privy-io/react-auth/solana";

export default function MyWalletProvider({ children }: PropsWithChildren) {
    return (
        <PrivyProvider
            appId={import.meta.env.VITE_PRIVY_APP_ID}
            config={{
                appearance: {
                    theme: "dark",
                    // logo: env.NEXT_PUBLIC_APP_URL + "/logo.svg",
                    walletList: ["phantom"],
                    walletChainType: "ethereum-and-solana",
                },
                loginMethods: ["wallet"],
                externalWallets: { solana: { connectors: toSolanaWalletConnectors() } },
            }}
        >
            {children}
        </PrivyProvider>
    );
}
