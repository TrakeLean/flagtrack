// Simple validation that the package exists and can be required
try {
    const pkg = require('../index.js'); // Adjust path if your entry point is different
    console.log('Package loaded successfully!');
    process.exit(0); // Success
  } catch (error) {
    console.error('Package could not be loaded:', error);
    process.exit(1); // Failure
  }