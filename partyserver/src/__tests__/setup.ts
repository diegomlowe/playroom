
// Mock Prisma client
jest.mock('../db', () => ({
  prisma: {
    game: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
    },
    gameSubmission: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      upsert: jest.fn(),
    },
    coinFlipMatch: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
    },
    flashMatch: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      upsert: jest.fn(),
    },
    flashTap: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      upsert: jest.fn(),
    },
    dailySpin: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      upsert: jest.fn(),
    },
    dailySpinPool: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    spinPayout: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      upsert: jest.fn(),
    },
  },
}));
