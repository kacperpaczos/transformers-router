import { TransformersRouter } from '../dist/index';

// Create a router with custom options
const router = new TransformersRouter({
  caseSensitive: true,
  strict: true,
});

// Add routes with strict matching
router.addRoute('/User/', (id: number) => {
  return { id, name: 'User ' + id };
});

router.addRoute('/api/data', () => {
  return { status: 'success', data: [] };
});

// This will work
router.execute('/User/', 123).then(result => {
  console.log('Strict match:', result);
});

// This will NOT work (no trailing slash)
router.execute('/User', 123).catch(error => {
  console.log('Error:', error.message);
});

// Case sensitive: this will work
router.execute('/api/data').then(result => {
  console.log('Case sensitive match:', result);
});

// This will NOT work (different case)
router.execute('/API/DATA').catch(error => {
  console.log('Error:', error.message);
});
