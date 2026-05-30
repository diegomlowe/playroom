import type { Context } from 'hono';

export class AuthenticationError extends Error {
  constructor(
    message: string,
    public statusCode: number = 401,
  ) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export async function validateWalletAuth(c: Context): Promise<{
  walletAddress: string;
}> {
  const authHeader = c.req.header('Authorization');
  const walletAddress = c.req.header('X-Wallet-Address');

  if (!authHeader || !walletAddress) {
    throw new AuthenticationError('Missing auth headers');
  }

  // TODO (Phase 4): Verify actual Phantom wallet signature
  // For now: just validate headers exist

  return { walletAddress };
}

export async function validateAdminAuth(c: Context): Promise<{
  walletAddress: string;
}> {
  const { walletAddress } = await validateWalletAuth(c);

  const adminAddresses = (process.env.ADMIN_ADDRESSES || '').split(',').map(a => a.trim().toLowerCase());

  if (!adminAddresses.includes(walletAddress.toLowerCase())) {
    throw new AuthenticationError('Not authorized', 403);
  }

  return { walletAddress };
}
