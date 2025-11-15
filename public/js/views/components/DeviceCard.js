// ============================================================================
// Fichier: frontend/js/views/components/DeviceCard.js
// Version: v4.0.0
// ============================================================================

class DeviceCard {
    static render(device, options = {}) {
        const typeIcons = { 0: '❓', 1: '🔌', 2: '📡', 3: '💻' };
        const typeNames = ['Unknown', 'USB', 'Bluetooth', 'Virtual'];
        const statusClass = device.status === 2 ? 'connected' : 'disconnected';
        
        return `
            <div class="device-card ${statusClass}" data-device-id="${device.id}">
                <div class="device-icon">${typeIcons[device.type] || '🎸'}</div>
                <div class="device-info">
                    <div class="device-name">${device.name}</div>
                    <div class="device-type">${typeNames[device.type] || 'Unknown'}</div>
                </div>
                ${options.showActions !== false ? `
                    <div class="device-actions">
                        ${device.status === 2 ? 
                            '<button data-action="disconnect">Déconnecter</button>' :
                            '<button data-action="connect">Connecter</button>'
                        }
                    </div>
                ` : ''}
            </div>
        `;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = DeviceCard;
}
if (typeof window !== 'undefined') {
    window.DeviceCard = DeviceCard;
}