// server.js

// CRITIQUE: Optimisation BLE - Accélère les connexions Bluetooth
// Par défaut, noble attend à la fois les données d'advertisement ET de scan response
// Cette variable permet de bypasser l'attente si l'appareil n'utilise pas scan response
// Cela réduit le temps de connexion de 30-40s à <2s
process.env.NOBLE_REPORT_ALL_HCI_EVENTS = '1';

import Application from './src/core/Application.js';

async function main() {
  // Create and initialize application
  const app = new Application();

  try {
    // Initialize all components
    await app.initialize();

    // Setup graceful shutdown
    app.setupShutdownHandlers();

    // Start the application
    await app.start();

    // Log status
    const status = app.getStatus();
    console.log('\n=== Application Status ===');
    console.log(`Devices: ${status.devices}`);
    console.log(`Routes: ${status.routes}`);
    console.log(`Files: ${status.files}`);
    console.log(`WebSocket Clients: ${status.wsClients}`);
    console.log('==========================\n');

  } catch (error) {
    console.error('Failed to start application:', error);
    process.exit(1);
  }
}

// Run
main();
