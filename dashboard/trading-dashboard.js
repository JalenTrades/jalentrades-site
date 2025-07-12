/**
 * Advanced MES Trading Dashboard
 * Connects to FastAPI backend with WebSocket and REST integration
 */

class TradingDashboard {
    constructor() {
        this.ws = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 2000;
        this.isConnected = false;
        this.selectedSide = 'buy';
        this.currentPrice = 4205.75;
        this.alertTimeout = 5000;
        
        // API endpoints
        this.apiBase = window.location.origin;
        this.wsUrl = `ws://${window.location.host}/ws`;
        
        // Initialize dashboard
        this.init();
    }
    
    async init() {
        console.log('🚀 Initializing Trading Dashboard');
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Connect to WebSocket
        this.connectWebSocket();
        
        // Load initial data
        await this.loadInitialData();
        
        // Start periodic updates
        this.startPeriodicUpdates();
        
        console.log('✅ Trading Dashboard initialized');
    }
    
    setupEventListeners() {
        // Handle page visibility changes
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                console.log('📱 Page hidden - reducing updates');
            } else {
                console.log('👀 Page visible - resuming updates');
                this.refreshData();
            }
        });
        
        // Handle connection loss
        window.addEventListener('online', () => {
            this.showAlert('Internet connection restored', 'success');
            this.connectWebSocket();
        });
        
        window.addEventListener('offline', () => {
            this.showAlert('Internet connection lost', 'error');
        });
    }
    
    connectWebSocket() {
        try {
            console.log(`🔌 Connecting to WebSocket: ${this.wsUrl}`);
            this.updateConnectionStatus('connecting', 'Connecting...');
            
            this.ws = new WebSocket(this.wsUrl);
            
            this.ws.onopen = () => {
                this.onWebSocketOpen();
            };
            
            this.ws.onmessage = (event) => {
                this.handleWebSocketMessage(event);
            };
            
            this.ws.onclose = (event) => {
                this.onWebSocketClose(event);
            };
            
            this.ws.onerror = (error) => {
                this.onWebSocketError(error);
            };
            
        } catch (error) {
            console.error('❌ WebSocket connection failed:', error);
            this.updateConnectionStatus('disconnected', 'Connection Failed');
        }
    }
    
    onWebSocketOpen() {
        console.log('✅ WebSocket connected');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.updateConnectionStatus('connected', 'Connected');
        this.showAlert('Connected to trading system', 'success');
        
        // Subscribe to market data
        this.subscribeToMarketData('MES');
        
        // Request initial data
        this.requestAccountInfo();
        this.requestPositions();
        this.requestOrderHistory();
    }
    
    onWebSocketClose(event) {
        console.log('🔌 WebSocket disconnected:', event.code, event.reason);
        this.isConnected = false;
        this.updateConnectionStatus('disconnected', 'Disconnected');
        
        if (event.code !== 1000) { // Not a normal closure
            this.attemptReconnect();
        }
    }
    
    onWebSocketError(error) {
        console.error('❌ WebSocket error:', error);
        this.updateConnectionStatus('disconnected', 'Connection Error');
        this.showAlert('WebSocket connection error', 'error');
    }
    
    attemptReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            const delay = this.reconnectDelay * this.reconnectAttempts;
            
            console.log(`🔄 Reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
            this.updateConnectionStatus('connecting', `Reconnecting... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
            
            setTimeout(() => {
                this.connectWebSocket();
            }, delay);
        } else {
            console.error('❌ Max reconnection attempts reached');
            this.updateConnectionStatus('disconnected', 'Connection Failed');
            this.showAlert('Failed to reconnect to trading system', 'error');
        }
    }
    
    handleWebSocketMessage(event) {
        try {
            const data = JSON.parse(event.data);
            console.log('📨 WebSocket message:', data.type, data);
            
            switch (data.type) {
                case 'welcome':
                    this.handleWelcomeMessage(data);
                    break;
                case 'market_data':
                    this.handleMarketData(data);
                    break;
                case 'order_update':
                    this.handleOrderUpdate(data);
                    break;
                case 'position_update':
                    this.handlePositionUpdate(data);
                    break;
                case 'account_update':
                    this.handleAccountUpdate(data);
                    break;
                case 'order_confirmation':
                    this.handleOrderConfirmation(data);
                    break;
                case 'error':
                    this.handleErrorMessage(data);
                    break;
                default:
                    console.log('🤷 Unknown message type:', data.type);
            }
        } catch (error) {
            console.error('❌ Error parsing WebSocket message:', error);
        }
    }
    
    handleWelcomeMessage(data) {
        console.log('👋 Welcome message received:', data.message);
        this.showAlert(data.message, 'info');
    }
    
    handleMarketData(data) {
        const { symbol, data: marketData } = data;
        
        if (symbol === 'MES') {
            this.updatePriceDisplay(marketData);
        }
    }
    
    handleOrderUpdate(data) {
        console.log('📋 Order update:', data);
        this.updateOrdersTable();
        this.showAlert(`Order ${data.order_id}: ${data.status}`, 'info');
    }
    
    handlePositionUpdate(data) {
        console.log('🎯 Position update:', data);
        this.updatePositionsDisplay();
        this.updatePnLDisplay();
    }
    
    handleAccountUpdate(data) {
        console.log('💰 Account update:', data);
        this.updateAccountBalance(data);
    }
    
    handleOrderConfirmation(data) {
        console.log('✅ Order confirmation:', data);
        
        if (data.status === 'success') {
            this.showAlert(`Order placed successfully: ${data.data?.order_id || 'Unknown ID'}`, 'success');
            this.clearOrderForm();
        } else {
            this.showAlert(`Order failed: ${data.message || 'Unknown error'}`, 'error');
        }
        
        this.setOrderButtonState(false);
    }
    
    handleErrorMessage(data) {
        console.error('❌ Error message:', data);
        this.showAlert(`Error: ${data.message}`, 'error');
    }
    
    // WebSocket Actions
    sendWebSocketMessage(type, data = {}) {
        if (!this.isConnected || !this.ws) {
            this.showAlert('Not connected to trading system', 'error');
            return false;
        }
        
        const message = {
            type,
            data,
            timestamp: new Date().toISOString(),
            request_id: this.generateRequestId()
        };
        
        try {
            this.ws.send(JSON.stringify(message));
            console.log('📤 Sent WebSocket message:', type, data);
            return true;
        } catch (error) {
            console.error('❌ Failed to send WebSocket message:', error);
            this.showAlert('Failed to send message', 'error');
            return false;
        }
    }
    
    subscribeToMarketData(symbol) {
        return this.sendWebSocketMessage('subscribe', { symbol });
    }
    
    requestAccountInfo() {
        return this.sendWebSocketMessage('get_account_info');
    }
    
    requestPositions() {
        return this.sendWebSocketMessage('get_positions');
    }
    
    requestOrderHistory() {
        return this.sendWebSocketMessage('get_order_history');
    }
    
    // REST API Methods
    async apiRequest(endpoint, options = {}) {
        const url = `${this.apiBase}${endpoint}`;
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
                // Add auth header if needed
                // 'Authorization': `Bearer ${this.authToken}`
            }
        };
        
        try {
            console.log(`🌐 API Request: ${options.method || 'GET'} ${endpoint}`);
            const response = await fetch(url, { ...defaultOptions, ...options });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            console.log(`✅ API Response: ${endpoint}`, data);
            return data;
        } catch (error) {
            console.error(`❌ API Error: ${endpoint}`, error);
            this.showAlert(`API Error: ${error.message}`, 'error');
            throw error;
        }
    }
    
    async loadInitialData() {
        try {
            // Load account info
            const accountInfo = await this.apiRequest('/api/account/info');
            this.updateAccountDisplay(accountInfo);
            
            // Load positions
            const positions = await this.apiRequest('/api/account/positions');
            this.updatePositionsDisplay(positions);
            
            // Load recent orders
            const orders = await this.apiRequest('/api/orders/history?limit=10');
            this.updateOrdersTable(orders);
            
        } catch (error) {
            console.error('❌ Failed to load initial data:', error);
        }
    }
    
    // UI Update Methods
    updateConnectionStatus(status, text) {
        const statusDot = document.getElementById('connectionStatus');
        const statusText = document.getElementById('connectionText');
        
        if (statusDot && statusText) {
            statusDot.className = `status-dot status-${status}`;
            statusText.textContent = text;
        }
    }
    
    updatePriceDisplay(marketData) {
        const { last, bid, ask, volume, change, change_percent } = marketData;
        
        // Update main price
        const priceElement = document.getElementById('mesPrice');
        const changeElement = document.getElementById('mesChange');
        
        if (priceElement) {
            priceElement.textContent = `${last.toFixed(2)}`;
            this.currentPrice = last;
        }
        
        if (changeElement) {
            const changeText = `${change >= 0 ? '+' : ''}${change.toFixed(2)} (${change_percent.toFixed(2)}%)`;
            const changeClass = change >= 0 ? 'change-positive' : 'change-negative';
            const icon = change >= 0 ? 'fa-arrow-up' : 'fa-arrow-down';
            
            changeElement.innerHTML = `<i class="fas ${icon}"></i> ${changeText}`;
            changeElement.className = `metric-change ${changeClass}`;
        }
        
        // Update order form with current price
        const orderPriceInput = document.getElementById('orderPrice');
        if (orderPriceInput && !orderPriceInput.value) {
            orderPriceInput.value = last.toFixed(2);
        }
    }
    
    updateAccountDisplay(accountData) {
        const balanceElement = document.getElementById('accountBalance');
        
        if (balanceElement && accountData.balances && accountData.balances.length > 0) {
            const usdBalance = accountData.balances.find(b => b.currency === 'USD');
            if (usdBalance) {
                balanceElement.textContent = `${usdBalance.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
            }
        }
    }
    
    updatePositionsDisplay(positions = []) {
        const container = document.getElementById('positionsContainer');
        
        if (!container) return;
        
        if (positions.length === 0) {
            container.innerHTML = `
                <div style="padding: 20px; text-align: center; color: var(--text-secondary);">
                    No open positions
                </div>
            `;
            return;
        }
        
        container.innerHTML = positions.map(position => `
            <div class="position-item">
                <div class="position-header">
                    <span class="position-symbol">${position.symbol}</span>
                    <span class="position-side side-${position.side}">${position.side}</span>
                </div>
                <div class="position-details">
                    <span>Size: ${Math.abs(position.size)}</span>
                    <span class="${position.unrealized_pnl >= 0 ? 'change-positive' : 'change-negative'}">
                        ${position.unrealized_pnl >= 0 ? '+' : ''}${position.unrealized_pnl.toFixed(2)}
                    </span>
                </div>
            </div>
        `).join('');
    }
    
    updatePnLDisplay() {
        // This would be called after position updates
        // Calculate total unrealized P&L from positions
    }
    
    updateOrdersTable(orders = []) {
        const tbody = document.getElementById('ordersTableBody');
        
        if (!tbody) return;
        
        if (orders.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; color: var(--text-secondary); padding: 40px;">
                        No orders yet
                    </td>
                </tr>
            `;
            return;
        }
        
        tbody.innerHTML = orders.map(order => {
            const time = new Date(order.timestamp || order.created_at).toLocaleTimeString();
            const statusClass = `status-${order.status.toLowerCase()}`;
            const pnl = order.pnl || 0;
            const pnlClass = pnl >= 0 ? 'change-positive' : 'change-negative';
            
            return `
                <tr>
                    <td>${time}</td>
                    <td>${order.symbol}</td>
                    <td style="text-transform: uppercase; color: ${order.side === 'buy' ? 'var(--success-color)' : 'var(--danger-color)'}">${order.side}</td>
                    <td>${order.quantity}</td>
                    <td>${order.price ? order.price.toFixed(2) : 'Market'}</td>
                    <td><span class="order-status ${statusClass}">${order.status}</span></td>
                    <td class="${pnlClass}">${pnl !== 0 ? (pnl >= 0 ? '+' : '') + ' + pnl.toFixed(2) : '-'}</td>
                </tr>
            `;
        }).join('');
    }
    
    // Order Management
    selectSide(side) {
        this.selectedSide = side;
        
        // Update button states
        document.querySelectorAll('.side-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        document.querySelector(`.side-btn.${side}`).classList.add('active');
        
        console.log(`📝 Selected side: ${side}`);
    }
    
    handleOrderTypeChange() {
        const orderType = document.getElementById('orderType').value;
        const priceGroup = document.getElementById('priceGroup');
        const stopPriceGroup = document.getElementById('stopPriceGroup');
        
        // Show/hide price fields based on order type
        if (orderType === 'limit' || orderType === 'stop_limit') {
            priceGroup.style.display = 'block';
        } else {
            priceGroup.style.display = 'none';
        }
        
        if (orderType === 'stop' || orderType === 'stop_limit') {
            stopPriceGroup.style.display = 'block';
        } else {
            stopPriceGroup.style.display = 'none';
        }
        
        // Set default price to current market price
        const priceInput = document.getElementById('orderPrice');
        if (priceInput && !priceInput.value) {
            priceInput.value = this.currentPrice.toFixed(2);
        }
    }
    
    async placeOrder() {
        const orderData = this.getOrderFormData();
        
        if (!this.validateOrderData(orderData)) {
            return;
        }
        
        this.setOrderButtonState(true);
        
        try {
            // Send via WebSocket for real-time response
            const success = this.sendWebSocketMessage('order', orderData);
            
            if (!success) {
                // Fallback to REST API
                await this.apiRequest('/api/orders/place', {
                    method: 'POST',
                    body: JSON.stringify(orderData)
                });
                
                this.showAlert('Order placed successfully', 'success');
                this.clearOrderForm();
            }
            
        } catch (error) {
            this.showAlert(`Order failed: ${error.message}`, 'error');
        } finally {
            this.setOrderButtonState(false);
        }
    }
    
    getOrderFormData() {
        return {
            symbol: document.getElementById('orderSymbol').value,
            side: this.selectedSide,
            order_type: document.getElementById('orderType').value,
            quantity: parseInt(document.getElementById('orderQuantity').value),
            price: document.getElementById('orderPrice').value ? parseFloat(document.getElementById('orderPrice').value) : null,
            stop_price: document.getElementById('orderStopPrice').value ? parseFloat(document.getElementById('orderStopPrice').value) : null
        };
    }
    
    validateOrderData(orderData) {
        if (!orderData.symbol) {
            this.showAlert('Please select a symbol', 'error');
            return false;
        }
        
        if (!orderData.quantity || orderData.quantity <= 0) {
            this.showAlert('Please enter a valid quantity', 'error');
            return false;
        }
        
        if ((orderData.order_type === 'limit' || orderData.order_type === 'stop_limit') && !orderData.price) {
            this.showAlert('Price is required for limit orders', 'error');
            return false;
        }
        
        if ((orderData.order_type === 'stop' || orderData.order_type === 'stop_limit') && !orderData.stop_price) {
            this.showAlert('Stop price is required for stop orders', 'error');
            return false;
        }
        
        return true;
    }
    
    setOrderButtonState(loading) {
        const button = document.getElementById('placeOrderBtn');
        const buttonText = document.getElementById('orderBtnText');
        const loadingSpinner = document.getElementById('orderLoading');
        
        if (button && buttonText && loadingSpinner) {
            button.disabled = loading;
            buttonText.style.display = loading ? 'none' : 'inline';
            loadingSpinner.style.display = loading ? 'inline-block' : 'none';
        }
    }
    
    clearOrderForm() {
        document.getElementById('orderQuantity').value = '1';
        document.getElementById('orderPrice').value = '';
        document.getElementById('orderStopPrice').value = '';
        document.getElementById('orderType').value = 'market';
        this.handleOrderTypeChange();
    }
    
    // Quick Actions
    async closeAllPositions() {
        if (!confirm('Are you sure you want to close all positions?')) {
            return;
        }
        
        try {
            await this.apiRequest('/api/account/positions/close-all', {
                method: 'POST'
            });
            this.showAlert('All positions closed', 'success');
        } catch (error) {
            this.showAlert('Failed to close positions', 'error');
        }
    }
    
    async cancelAllOrders() {
        if (!confirm('Are you sure you want to cancel all open orders?')) {
            return;
        }
        
        try {
            await this.apiRequest('/api/orders/cancel-all', {
                method: 'POST'
            });
            this.showAlert('All orders cancelled', 'success');
        } catch (error) {
            this.showAlert('Failed to cancel orders', 'error');
        }
    }
    
    async refreshData() {
        console.log('🔄 Refreshing data...');
        await this.loadInitialData();
        this.showAlert('Data refreshed', 'info');
    }
    
    async exportTrades() {
        try {
            const response = await fetch(`${this.apiBase}/api/orders/export`, {
                method: 'GET'
            });
            
            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `trades_${new Date().toISOString().split('T')[0]}.csv`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
                
                this.showAlert('Trades exported successfully', 'success');
            }
        } catch (error) {
            this.showAlert('Failed to export trades', 'error');
        }
    }
    
    // Utility Methods
    generateRequestId() {
        return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    showAlert(message, type = 'info') {
        const alertsContainer = document.getElementById('alertsContainer');
        
        if (!alertsContainer) return;
        
        const alert = document.createElement('div');
        alert.className = `alert alert-${type}`;
        alert.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <span>${message}</span>
                <button onclick="this.parentElement.parentElement.remove()" style="background: none; border: none; color: inherit; cursor: pointer; font-size: 16px;">&times;</button>
            </div>
        `;
        
        alertsContainer.appendChild(alert);
        
        // Auto-remove after timeout
        setTimeout(() => {
            if (alert.parentNode) {
                alert.remove();
            }
        }, this.alertTimeout);
        
        console.log(`🔔 Alert: ${type} - ${message}`);
    }
    
    startPeriodicUpdates() {
        // Update every 30 seconds
        setInterval(() => {
            if (this.isConnected) {
                this.requestAccountInfo();
                this.requestPositions();
            }
        }, 30000);
        
        // Heartbeat every 60 seconds
        setInterval(() => {
            if (this.isConnected) {
                this.sendWebSocketMessage('ping', { timestamp: new Date().toISOString() });
            }
        }, 60000);
    }
    
    // Theme and Settings
    toggleTheme() {
        // Implement theme switching if needed
        this.showAlert('Theme switching coming soon', 'info');
    }
    
    showSettings() {
        // Implement settings modal if needed
        this.showAlert('Settings panel coming soon', 'info');
    }
}

// Initialize dashboard when DOM is loaded
let dashboard;
document.addEventListener('DOMContentLoaded', () => {
    console.log('🎯 DOM loaded, initializing trading dashboard...');
    dashboard = new TradingDashboard();
});

// Export for global access
window.dashboard = dashboard;