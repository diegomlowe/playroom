# Backend Testing Guide

This document explains how to run tests for the Phase 2A Prisma migration.

## Setup

Tests use Jest with TypeScript support (ts-jest). Prisma is mocked to avoid database dependencies.

```bash
cd partyserver
npm test
```

## Test Structure

```
partyserver/src/__tests__/
├── setup.ts                    # Global test setup with Prisma mocks
├── collections/
│   ├── games.test.ts          # Games collection tests
│   └── gameSubmissions.test.ts # GameSubmissions collection tests
└── lib/
    └── wallet-auth.test.ts     # Authentication tests
```

## Running Tests

**All tests:**
```bash
npm test
```

**With coverage:**
```bash
npm test -- --coverage
```

**Watch mode:**
```bash
npm test -- --watch
```

**Specific test file:**
```bash
npm test -- games.test.ts
```

## Test Coverage

### Collections (Unit Tests)
- **games.ts** - Create, read, update games with BigInt serialization
- **gameSubmissions.ts** - Player tap submissions with composite keys
- **wallet-auth.ts** - Authentication validation and admin checks

### Test Categories

#### Games Collection (`games.test.ts`)
- ✅ Get single game (success + not found + error cases)
- ✅ Set/create games (new + update + error handling)
- ✅ Get many games (list + empty + error handling)
- ✅ BigInt serialization to strings for JSON

#### GameSubmissions Collection (`gameSubmissions.test.ts`)
- ✅ Get many submissions by game
- ✅ Get single submission by game + player
- ✅ Create/update submissions
- ✅ Composite unique key (gameId, player)
- ✅ Timestamp serialization

#### Wallet Auth (`wallet-auth.test.ts`)
- ✅ Valid authentication headers
- ✅ Missing Authorization header
- ✅ Missing Wallet-Address header
- ✅ Admin authentication
- ✅ Admin address case-insensitivity
- ✅ Non-admin rejection with 403 status
- ✅ Error status codes (401, 403)

## Integration Testing

For end-to-end route testing, use Postman or curl:

```bash
# Start the backend
cd partyserver
npm run dev

# In another terminal, test a route
curl -X POST http://localhost:8787/api/games/:gameId/finalize \
  -H "Authorization: Bearer test-token" \
  -H "X-Wallet-Address: 11111111111111111111111111111111"
```

## What's Mocked

- **Prisma Client**: All database operations are mocked to prevent test dependencies on a live database
- **Collections**: Return serialized data matching API contracts
- **Auth**: Validates headers only (Phase 4 will add signature verification)

## Adding New Tests

1. Create test file in `__tests__/` matching the module structure
2. Mock Prisma in `setup.ts` if needed
3. Test both success and error cases
4. Use descriptive test names
5. Run tests: `npm test`

## Troubleshooting

**Tests fail with "Cannot find module '@jest/globals'"**
- Run: `bun add @jest/globals -D`

**Tests timeout**
- Increase Jest timeout: `jest.setTimeout(10000);`

**Prisma mock not working**
- Ensure mock is imported before test runs
- Check that mock path matches exact module path

## Next Steps

Once Phase 2A is validated with these tests:
1. Add more collection tests (coinFlipMatches, flashMatches, etc.)
2. Create route integration tests for happy paths
3. Add error scenario tests for all routes
4. Set up CI/CD to run tests on PR

See `PHASE_2_IMPLEMENTATION.md` for full migration roadmap.
