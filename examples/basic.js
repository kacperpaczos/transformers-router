const { TransformersRouter } = require('../dist/index');

// Create a new router instance
const router = new TransformersRouter();

// Add some routes
router.addRoute('/hello', (name) => {
  return `Hello, ${name}!`;
});

router.addRoute('/add', (a, b) => {
  return a + b;
});

router.addRoute('/async', async (data) => {
  // Simulate async operation
  await new Promise(resolve => setTimeout(resolve, 100));
  return `Processed: ${data}`;
});

// Execute routes
async function main() {
  try {
    // Execute the hello route
    const greeting = await router.execute('/hello', 'World');
    console.log(greeting); // Output: Hello, World!

    // Execute the add route
    const sum = await router.execute('/add', 5, 3);
    console.log(`Sum: ${sum}`); // Output: Sum: 8

    // Execute the async route
    const result = await router.execute('/async', 'test data');
    console.log(result); // Output: Processed: test data

    // List all routes
    console.log('\nAll routes:');
    router.getAllRoutes().forEach(route => {
      console.log(`  - ${route.path}`);
    });
  } catch (error) {
    console.error('Error:', error.message);
  }
}

main();
