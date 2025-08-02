/**
 * WhatsApp Chat Reader - Modern Implementation
 * Enhanced with ES6+ features, better architecture, and improved UX
 */

class WhatsAppChatReader {
    constructor() {
        this.chatData = {
            messages: [],
            users: new Set(),
            userColors: new Map(),
            totalMessages: 0,
            currentUser: null
        };
        
        this.elements = {
            fileInput: document.getElementById('fileInput'),
            uploadSection: document.getElementById('uploadSection'),
            chatControls: document.getElementById('chatControls'),
            usersSection: document.getElementById('usersSection'),
            chatContainer: document.getElementById('chatContainer'),
            chatMessages: document.getElementById('chatMessages'),
            activeUserSelect: document.getElementById('activeUserSelect'),
            refreshBtn: document.getElementById('refreshBtn'),
            toggleUsersBtn: document.getElementById('toggleUsersBtn'),
            messageCount: document.getElementById('messageCount'),
            userCount: document.getElementById('userCount'),
            usersGrid: document.getElementById('usersGrid'),
            fileName: document.getElementById('fileName'),
            fileInfo: document.getElementById('fileInfo')
        };
        
        this.config = {
            dateFormats: {
                english: /^\d{1,2}\/\d{1,2}\/\d{2,4},?\s/,
                international: /^\d{1,2}\/\d{1,2}\/\d{2,4},?\s/
            },
            systemMessages: [
                'Messages and calls are end-to-end encrypted',
                'Your security code with',
                'security code changed',
                'left',
                'You\'re no longer',
                'changed to',
                'You removed',
                'added',
                'changed this group\'s',
                'created group',
                'You\'re now an admin',
                'You created group',
                'was added',
                'changed the group description',
                'joined using this group\'s',
                'changed the subject',
                'changed the group',
                'started a call',
                'Missed voice call',
                'Missed video call',
                'started calling',
                'Calling...',
                'was removed',
                'You left',
                'changed their phone number',
                'This chat is with a business account'
            ],
            months: [
                'January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'
            ]
        };
        
        this.init();
    }
    
    init() {
        this.bindEvents();
        this.generateUserColors();
    }
    
    bindEvents() {
        this.elements.fileInput.addEventListener('change', this.handleFileUpload.bind(this));
        this.elements.activeUserSelect.addEventListener('change', this.handleUserPerspectiveChange.bind(this));
        this.elements.refreshBtn.addEventListener('click', this.refreshPage.bind(this));
        this.elements.toggleUsersBtn.addEventListener('click', this.toggleUsersSection.bind(this));
    }
    
    generateUserColors() {
        const colors = [
            '#e91e63', '#9c27b0', '#673ab7', '#3f51b5', '#2196f3',
            '#03a9f4', '#00bcd4', '#009688', '#4caf50', '#8bc34a',
            '#cddc39', '#ffc107', '#ff9800', '#ff5722', '#795548'
        ];
        this.colorPalette = colors;
    }
    
    async handleFileUpload(event) {
        const file = event.target.files[0];
        
        if (!file) return;
        
        if (!file.name.toLowerCase().endsWith('.txt')) {
            this.showError('Please select a valid .txt file');
            return;
        }
        
        this.showLoading();
        
        try {
            const content = await this.readFile(file);
            await this.parseChat(content);
            this.displayResults(file.name);
        } catch (error) {
            this.showError('Failed to process the chat file: ' + error.message);
        }
    }
    
    readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsText(file);
        });
    }
    
    async parseChat(content) {
        const lines = content.split('\n').filter(line => line.trim());
        this.chatData.messages = [];
        this.chatData.users.clear();
        this.chatData.userColors.clear();
        
        let currentDate = null;
        let colorIndex = 0;
        let parsedMessages = 0;
        let systemMessages = 0;
        
        console.log(`Starting to parse ${lines.length} lines...`);
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            const messageData = this.parseMessageLine(line);
            
            if (messageData) {
                // Assign color to new users
                if (!this.chatData.userColors.has(messageData.sender)) {
                    this.chatData.userColors.set(
                        messageData.sender, 
                        this.colorPalette[colorIndex % this.colorPalette.length]
                    );
                    colorIndex++;
                }
                
                this.chatData.users.add(messageData.sender);
                this.chatData.messages.push(messageData);
                parsedMessages++;
                
                // Handle date changes
                if (currentDate !== messageData.date) {
                    currentDate = messageData.date;
                }
            } else if (this.isSystemMessage(line)) {
                // Handle system messages
                this.chatData.messages.push({
                    type: 'system',
                    content: this.cleanSystemMessage(line),
                    timestamp: this.extractTimestamp(line),
                    date: this.extractDate(line)
                });
                systemMessages++;
            } else if (this.chatData.messages.length > 0) {
                // Handle multi-line messages
                const lastMessage = this.chatData.messages[this.chatData.messages.length - 1];
                if (lastMessage.type === 'user') {
                    lastMessage.content += '\n' + this.cleanMessageContent(line);
                }
            }
            
            // Show progress for large files
            if (i % 1000 === 0) {
                await this.delay(1); // Allow UI to update
            }
        }
        
        this.chatData.totalMessages = this.chatData.messages.filter(m => m.type === 'user').length;
        
        console.log(`Parsing complete: ${parsedMessages} user messages, ${systemMessages} system messages, ${this.chatData.users.size} users`);
    }
    
    parseMessageLine(line) {
        // Match various WhatsApp export formats including modern 2024+ format
        const patterns = [
            // Modern format: M/D/YY, HH:MM AM/PM - Sender: Message (2024+)
            /^(\d{1,2}\/\d{1,2}\/\d{2,4}),\s+(\d{1,2}:\d{2}\s+(?:AM|PM))\s+-\s+([^:]+?):\s*(.*)$/,
            // Standard format: MM/DD/YY, HH:MM - Sender: Message
            /^(\d{1,2}\/\d{1,2}\/\d{2,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM|am|pm)?)\s*[-–]\s*([^:]+?):\s*(.*)$/,
            // Bracketed format: [MM/DD/YY, HH:MM:SS] Sender: Message
            /^\[(\d{1,2}\/\d{1,2}\/\d{2,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?(?:\s*(?:AM|PM|am|pm))?)\]\s*([^:]+?):\s*(.*)$/,
            // European format: DD/MM/YYYY, HH:MM - Sender: Message
            /^(\d{1,2}\/\d{1,2}\/\d{4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?)\s*[-–]\s*([^:]+?):\s*(.*)$/
        ];
        
        for (const pattern of patterns) {
            const match = line.match(pattern);
            if (match) {
                const [, date, time, sender, content] = match;
                
                // Check if this is a system message (no sender after timestamp)
                if (this.isSystemMessageWithTimestamp(line)) {
                    return null; // Will be handled as system message
                }
                
                return {
                    type: 'user',
                    date: this.normalizeDate(date),
                    time: this.normalizeTime(time),
                    sender: sender.trim(),
                    content: this.cleanMessageContent(content),
                    timestamp: this.createTimestamp(date, time),
                    isOutgoing: false, // Will be updated based on user perspective
                    isMedia: content.includes('<Media omitted>'),
                    isDeleted: content.trim() === 'null',
                    isEdited: content.includes('<This message was edited>')
                };
            }
        }
        
        return null;
    }
    
    isSystemMessage(line) {
        // Check for system messages (both with and without timestamp)
        return this.config.systemMessages.some(pattern => 
            line.toLowerCase().includes(pattern.toLowerCase())
        ) || this.isSystemMessageWithTimestamp(line);
    }
    
    isSystemMessageWithTimestamp(line) {
        // Modern format system messages: "M/D/YY, HH:MM AM/PM - System message"
        // No sender name, just timestamp and message
        const systemPattern = /^\d{1,2}\/\d{1,2}\/\d{2,4},\s+\d{1,2}:\d{2}\s+(?:AM|PM)\s+-\s+(?!.*?:)(.+)$/;
        return systemPattern.test(line);
    }
    
    cleanSystemMessage(line) {
        // Remove timestamp from system message - handle both old and new formats
        return line
            .replace(/^\d{1,2}\/\d{1,2}\/\d{2,4},\s+\d{1,2}:\d{2}\s+(?:AM|PM)\s+-\s+/, '') // Modern format
            .replace(/^\d{1,2}\/\d{1,2}\/\d{2,4},?\s+\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM|am|pm)?\s*[-–]?\s*/, '') // Old format
            .trim();
    }
    
    cleanMessageContent(content) {
        return content
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;')
            .trim();
    }
    
    normalizeDate(dateStr) {
        const parts = dateStr.split('/');
        let year = parseInt(parts[2]);
        
        // Handle 2-digit years
        if (year < 100) {
            year += year < 50 ? 2000 : 1900;
        }
        
        return `${parts[0]}/${parts[1]}/${year}`;
    }
    
    normalizeTime(timeStr) {
        return timeStr.trim();
    }
    
    createTimestamp(date, time) {
        return `${date} ${time}`;
    }
    
    extractDate(line) {
        // Handle both modern and old formats
        const modernMatch = line.match(/^(\d{1,2}\/\d{1,2}\/\d{2,4}),\s+\d{1,2}:\d{2}\s+(?:AM|PM)\s+-/);
        if (modernMatch) return this.normalizeDate(modernMatch[1]);
        
        const oldMatch = line.match(/^(\d{1,2}\/\d{1,2}\/\d{2,4})/);
        return oldMatch ? this.normalizeDate(oldMatch[1]) : null;
    }
    
    extractTimestamp(line) {
        // Handle both modern and old formats
        const modernMatch = line.match(/(\d{1,2}:\d{2}\s+(?:AM|PM))/);
        if (modernMatch) return modernMatch[1];
        
        const oldMatch = line.match(/(\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM|am|pm)?)/);
        return oldMatch ? oldMatch[1] : null;
    }
    
    displayResults(fileName) {
        this.elements.fileName.textContent = fileName;
        this.elements.fileInfo.classList.remove('hidden');
        
        this.updateStats();
        this.populateUserSelect();
        this.populateUsersGrid();
        this.renderMessages();
        this.showChatInterface();
    }
    
    updateStats() {
        this.elements.messageCount.textContent = `${this.formatNumber(this.chatData.totalMessages)} messages loaded`;
        this.elements.userCount.textContent = `${this.chatData.users.size} participants`;
    }
    
    populateUserSelect() {
        const select = this.elements.activeUserSelect;
        select.innerHTML = '<option value="">All participants</option>';
        
        Array.from(this.chatData.users)
            .sort()
            .forEach(user => {
                const option = document.createElement('option');
                option.value = user;
                option.textContent = user;
                select.appendChild(option);
            });
    }
    
    populateUsersGrid() {
        const grid = this.elements.usersGrid;
        grid.innerHTML = '';
        
        Array.from(this.chatData.users)
            .sort()
            .forEach(user => {
                const userChip = this.createUserChip(user);
                grid.appendChild(userChip);
            });
    }
    
    createUserChip(user) {
        const chip = document.createElement('div');
        chip.className = 'user-chip';
        
        const avatar = document.createElement('div');
        avatar.className = 'user-avatar';
        avatar.style.backgroundColor = this.chatData.userColors.get(user);
        avatar.textContent = this.getInitials(user);
        
        const name = document.createElement('span');
        name.className = 'user-name';
        name.textContent = user;
        
        chip.appendChild(avatar);
        chip.appendChild(name);
        
        return chip;
    }
    
    getInitials(name) {
        return name
            .split(' ')
            .map(word => word.charAt(0))
            .join('')
            .substring(0, 2)
            .toUpperCase();
    }
    
    renderMessages() {
        const container = this.elements.chatMessages;
        container.innerHTML = '';
        
        let currentDate = null;
        
        this.chatData.messages.forEach((message, index) => {
            // Add date separator
            if (message.date && message.date !== currentDate) {
                container.appendChild(this.createDateSeparator(message.date));
                currentDate = message.date;
            }
            
            if (message.type === 'system') {
                container.appendChild(this.createSystemMessage(message));
            } else if (message.type === 'user') {
                container.appendChild(this.createUserMessage(message));
            }
        });
        
        // Scroll to bottom
        container.scrollTop = container.scrollHeight;
    }
    
    createDateSeparator(date) {
        const separator = document.createElement('div');
        separator.className = 'date-separator';
        
        const badge = document.createElement('div');
        badge.className = 'date-badge';
        badge.textContent = this.formatDate(date);
        
        separator.appendChild(badge);
        return separator;
    }
    
    createSystemMessage(message) {
        const container = document.createElement('div');
        container.className = 'system-message';
        
        const text = document.createElement('div');
        text.className = 'system-message-text';
        text.textContent = message.content;
        
        container.appendChild(text);
        return container;
    }
    
    createUserMessage(message) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${message.isOutgoing ? 'outgoing' : 'incoming'}`;
        
        // Add special classes for different message types
        if (message.isMedia) messageDiv.classList.add('media-message');
        if (message.isDeleted) messageDiv.classList.add('deleted-message');
        if (message.isEdited) messageDiv.classList.add('edited-message');
        
        const bubble = document.createElement('div');
        bubble.className = 'message-bubble';
        
        // Only show sender name for incoming messages in group chats or when no specific user is selected
        if (!message.isOutgoing && (this.chatData.users.size > 2 || !this.chatData.currentUser)) {
            const header = document.createElement('div');
            header.className = 'message-header';
            
            const sender = document.createElement('span');
            sender.className = 'message-sender';
            sender.style.color = this.chatData.userColors.get(message.sender);
            sender.textContent = message.sender;
            
            header.appendChild(sender);
            bubble.appendChild(header);
        }
        
        const content = document.createElement('div');
        content.className = 'message-content';
        content.innerHTML = this.formatMessageContent(message.content);
        
        const time = document.createElement('div');
        time.className = 'message-time';
        time.textContent = message.time;
        
        bubble.appendChild(content);
        bubble.appendChild(time);
        messageDiv.appendChild(bubble);
        
        return messageDiv;
    }
    
    formatMessageContent(content) {
        // Handle special message types
        if (content.includes('<Media omitted>')) {
            return '<span class="media-message">📎 Media</span>';
        }
        
        if (content.trim() === 'null') {
            return '<span class="deleted-message">🚫 This message was deleted</span>';
        }
        
        if (content.includes('<This message was edited>')) {
            content = content.replace('<This message was edited>', '<span class="edited-indicator">✏️ edited</span>');
        }
        
        // Convert URLs to links
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        content = content.replace(urlRegex, '<a href="$1" target="_blank" rel="noopener" class="message-link">$1</a>');
        
        // Preserve line breaks
        content = content.replace(/\n/g, '<br>');
        
        return content;
    }
    
    formatDate(dateStr) {
        const today = new Date();
        const messageDate = new Date(dateStr);
        
        const isToday = today.toDateString() === messageDate.toDateString();
        const isYesterday = new Date(today - 86400000).toDateString() === messageDate.toDateString();
        
        if (isToday) return 'Today';
        if (isYesterday) return 'Yesterday';
        
        // Format as "Month DD, YYYY"
        const options = { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        };
        return messageDate.toLocaleDateString('en-US', options);
    }
    
    formatNumber(num) {
        return new Intl.NumberFormat().format(num);
    }
    
    handleUserPerspectiveChange(event) {
        const selectedUser = event.target.value;
        this.chatData.currentUser = selectedUser || null;
        
        console.log('User perspective changed to:', selectedUser || 'All participants');
        
        // Update message directions based on perspective
        this.chatData.messages.forEach(message => {
            if (message.type === 'user') {
                message.isOutgoing = selectedUser ? message.sender === selectedUser : false;
            }
        });
        
        this.renderMessages();
        
        // Scroll to bottom after re-rendering
        setTimeout(() => {
            const container = this.elements.chatMessages;
            container.scrollTop = container.scrollHeight;
        }, 100);
    }
    
    showChatInterface() {
        // Hide upload section
        this.elements.uploadSection.style.display = 'none';
        
        // Show chat controls but keep users section hidden initially
        this.elements.chatControls.classList.add('visible');
        
        // Show control buttons
        this.elements.refreshBtn.style.display = 'flex';
        this.elements.toggleUsersBtn.style.display = 'flex';
        
        // Ensure chat container is visible and scrollable
        this.elements.chatContainer.style.display = 'flex';
        this.elements.chatContainer.style.flexDirection = 'column';
        
        console.log('Chat interface shown successfully');
    }
    
    toggleUsersSection() {
        const isVisible = this.elements.usersSection.classList.contains('visible');
        if (isVisible) {
            this.elements.usersSection.classList.remove('visible');
        } else {
            this.elements.usersSection.classList.add('visible');
        }
    }
    
    showLoading() {
        const container = this.elements.chatMessages;
        container.innerHTML = `
            <div class="loading">
                <div class="spinner"></div>
                Processing chat file...
            </div>
        `;
    }
    
    showError(message) {
        const container = this.elements.chatMessages;
        container.innerHTML = `
            <div class="error-message">
                ${message}
            </div>
        `;
    }
    
    refreshPage() {
        window.location.reload();
    }
    
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new WhatsAppChatReader();
});

// Add keyboard shortcuts
document.addEventListener('keydown', (event) => {
    if (event.ctrlKey && event.key === 'r') {
        event.preventDefault();
        window.location.reload();
    }
});
