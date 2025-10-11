# transformers-router

A lightweight, TypeScript-based router library for managing and executing routes with customizable options.

## Features

- 🚀 Simple and intuitive API
- 💪 Written in TypeScript with full type support
- ⚙️ Configurable options (case sensitivity, strict matching)
- 🔄 Async/await support
- 🧪 Well-tested with comprehensive test coverage
- 📦 Zero dependencies

## Installation

```bash
npm install transformers-router
```

## Quick Start

```typescript
import { TransformersRouter } from 'transformers-router';

// Create a new router
const router = new TransformersRouter();

// Add a route
router.addRoute('/hello', (name: string) => {
  return `Hello, ${name}!`;
});

// Execute the route
const result = await router.execute('/hello', 'World');
console.log(result); // Output: Hello, World!
```

## API Reference

### Constructor

```typescript
new TransformersRouter(options?: RouterOptions)
```

#### Options

- `caseSensitive` (boolean, default: `false`): Enable case-sensitive route matching
- `strict` (boolean, default: `false`): Enable strict matching (trailing slashes matter)

### Methods

#### `addRoute(path: string, handler: Function): void`

Register a new route with a handler function.

```typescript
router.addRoute('/user', (id: number) => {
  return { id, name: 'User' };
});
```

#### `removeRoute(path: string): boolean`

Remove a route by path. Returns `true` if the route was removed, `false` otherwise.

```typescript
const removed = router.removeRoute('/user');
```

#### `getRoute(path: string): Route | undefined`

Get a route by path.

```typescript
const route = router.getRoute('/user');
```

#### `execute(path: string, ...args: any[]): Promise<any>`

Execute a route handler with the provided arguments.

```typescript
const result = await router.execute('/user', 123);
```

#### `getAllRoutes(): Route[]`

Get all registered routes.

```typescript
const routes = router.getAllRoutes();
```

#### `clear(): void`

Remove all routes.

```typescript
router.clear();
```

## Examples

### Basic Usage

```typescript
import { TransformersRouter } from 'transformers-router';

const router = new TransformersRouter();

// Add routes
router.addRoute('/add', (a: number, b: number) => a + b);
router.addRoute('/multiply', (a: number, b: number) => a * b);

// Execute routes
const sum = await router.execute('/add', 5, 3); // 8
const product = await router.execute('/multiply', 5, 3); // 15
```

### Async Handlers

```typescript
router.addRoute('/fetch-data', async (url: string) => {
  const response = await fetch(url);
  return response.json();
});

const data = await router.execute('/fetch-data', 'https://api.example.com/data');
```

### Custom Options

```typescript
// Case-sensitive and strict matching
const router = new TransformersRouter({
  caseSensitive: true,
  strict: true,
});

router.addRoute('/User/', handler);

// This will work
await router.execute('/User/', args);

// This will NOT work (case mismatch)
await router.execute('/user/', args); // throws error

// This will NOT work (no trailing slash)
await router.execute('/User', args); // throws error
```

### Route Management

```typescript
// Add routes
router.addRoute('/route1', handler1);
router.addRoute('/route2', handler2);

// Get all routes
const allRoutes = router.getAllRoutes();
console.log(allRoutes); // [{ path: '/route1', handler: ... }, { path: '/route2', handler: ... }]

// Remove a specific route
router.removeRoute('/route1');

// Clear all routes
router.clear();
```

## Development

### Setup

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage

# Lint the code
npm run lint

# Fix linting issues
npm run lint:fix
```

### Project Structure

```
transformers-router/
├── src/
│   ├── index.ts          # Main entry point
│   ├── router.ts         # Router implementation
│   └── router.test.ts    # Tests
├── examples/
│   ├── basic.js          # Basic usage example
│   └── advanced.ts       # Advanced usage example
├── dist/                 # Compiled output
├── package.json
├── tsconfig.json
└── README.md
```

## Testing

The library includes comprehensive test coverage:

```bash
npm test
```

## License

MIT © Kacper Paczos

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.