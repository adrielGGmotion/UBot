document.addEventListener('DOMContentLoaded', async () => {
    const guildId = new URLSearchParams(window.location.search).get('id');
    if (!guildId) {
        // You might want to redirect or show an error message
        console.error('No guild ID found in URL.');
        return;
    }

    const saveButton = document.getElementById('save-ai-settings-btn');
    const aiSettingsForm = document.getElementById('ai-settings-form');
    const allowedChannelsSelect = document.getElementById('ai-allowed-channels');
    const restrictedChannelsSelect = document.getElementById('ai-restricted-channels');
    const knowledgeList = document.getElementById('knowledge-list');
    const addKnowledgeBtn = document.getElementById('add-knowledge-btn');
    const faqList = document.getElementById('faq-list');
    const addFaqBtn = document.getElementById('add-faq-btn');

    // Live Test Chat Elements
    const testChatWindow = document.getElementById('ai-test-chat-window');
    const testInput = document.getElementById('ai-test-input');
    const testSendBtn = document.getElementById('ai-test-send-btn');
    let testChatHistory = [];

    // --- Data Loading and Form Population ---

    const fetchGuildChannels = async () => {
        try {
            // We can get channels from the general settings endpoint
            const response = await fetch(`/api/guilds/${guildId}/settings`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('dashboard-token')}` }
            });
            if (!response.ok) throw new Error('Failed to fetch guild channels');
            const data = await response.json();
            return data.availableChannels || [];
        } catch (error) {
            console.error('Error fetching guild channels:', error);
            return [];
        }
    };

    const populateChannelSelects = (channels) => {
        allowedChannelsSelect.innerHTML = '';
        restrictedChannelsSelect.innerHTML = '';
        channels.forEach(channel => {
            const option = document.createElement('option');
            option.value = channel.id;
            option.textContent = `#${channel.name}`;
            allowedChannelsSelect.appendChild(option.cloneNode(true));
            restrictedChannelsSelect.appendChild(option.cloneNode(true));
        });
    };

    const fetchAiSettings = async () => {
        try {
            const response = await fetch(`/api/guilds/${guildId}/ai-settings`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('dashboard-token')}` }
            });
            if (!response.ok) throw new Error('Failed to fetch AI settings');
            return await response.json();
        } catch (error) {
            console.error('Error fetching AI settings:', error);
            return null;
        }
    };

    const populateForm = (settings) => {
        if (!settings) return;

        document.getElementById('ai-enabled').checked = settings.enabled || false;
        document.getElementById('ai-faq-enabled').checked = settings.faqEnabled || false;

        // Populate multi-selects
        if (settings.allowedChannels) {
            Array.from(allowedChannelsSelect.options).forEach(option => {
                option.selected = settings.allowedChannels.includes(option.value);
            });
        }
        if (settings.restrictedChannels) {
            Array.from(restrictedChannelsSelect.options).forEach(option => {
                option.selected = settings.restrictedChannels.includes(option.value);
            });
        }

        document.getElementById('ai-personality').value = settings.personality || '';
        document.getElementById('ai-extra-instructions').value = settings.extraInstructions || '';

        // Populate dynamic lists
        knowledgeList.innerHTML = '';
        (settings.knowledge || []).forEach(item => createKnowledgeItem(item.content));

        faqList.innerHTML = '';
        (settings.faq || []).forEach(item => createFaqItem(item.question, item.answer));
    };


    // --- Dynamic List Management ---

    const createKnowledgeItem = (content = '') => {
        const div = document.createElement('div');
        div.className = 'list-item';
        div.innerHTML = `
            <input type="text" class="knowledge-content" value="${content}" placeholder="Enter a piece of knowledge...">
            <button type="button" class="button danger-button remove-item-btn"><i class="material-icons">remove</i></button>
        `;
        knowledgeList.appendChild(div);
        div.querySelector('.remove-item-btn').addEventListener('click', () => div.remove());
    };

    const createFaqItem = (question = '', answer = '') => {
        const div = document.createElement('div');
        div.className = 'list-item';
        div.innerHTML = `
            <input type="text" class="faq-question" value="${question}" placeholder="Question">
            <input type="text" class="faq-answer" value="${answer}" placeholder="Answer">
            <button type="button" class="button danger-button remove-item-btn"><i class="material-icons">remove</i></button>
        `;
        faqList.appendChild(div);
        div.querySelector('.remove-item-btn').addEventListener('click', () => div.remove());
    };

    addKnowledgeBtn.addEventListener('click', () => createKnowledgeItem());
    addFaqBtn.addEventListener('click', () => createFaqItem());


    // --- Saving Settings ---

    const getFormData = () => {
        const formData = new FormData(aiSettingsForm);
        const settings = {
            enabled: formData.has('enabled'),
            faqEnabled: formData.has('faqEnabled'),
            allowedChannels: Array.from(allowedChannelsSelect.selectedOptions).map(opt => opt.value),
            restrictedChannels: Array.from(restrictedChannelsSelect.selectedOptions).map(opt => opt.value),
            personality: document.getElementById('ai-personality').value,
            extraInstructions: document.getElementById('ai-extra-instructions').value,
            knowledge: [],
            faq: []
        };

        document.querySelectorAll('#knowledge-list .list-item').forEach(item => {
            const content = item.querySelector('.knowledge-content').value;
            if (content) settings.knowledge.push({ content });
        });

        document.querySelectorAll('#faq-list .list-item').forEach(item => {
            const question = item.querySelector('.faq-question').value;
            const answer = item.querySelector('.faq-answer').value;
            if (question && answer) settings.faq.push({ question, answer });
        });

        return settings;
    };

    saveButton.addEventListener('click', async () => {
        const settings = getFormData();
        try {
            const response = await fetch(`/api/guilds/${guildId}/ai-settings`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('dashboard-token')}`
                },
                body: JSON.stringify(settings)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to save settings');
            }

            // Simple feedback
            alert('AI settings saved successfully!');
        } catch (error) {
            console.error('Error saving AI settings:', error);
            alert(`Error: ${error.message}`);
        }
    });


    // --- Live Test Chat Logic ---

    const addMessageToChat = (sender, message) => {
        const messageEl = document.createElement('div');
        messageEl.className = `chat-message ${sender}`;
        messageEl.textContent = message;
        testChatWindow.appendChild(messageEl);
        testChatWindow.scrollTop = testChatWindow.scrollHeight; // Scroll to bottom
    };

    const handleSendTestMessage = async () => {
        const messageText = testInput.value.trim();
        if (!messageText) return;

        addMessageToChat('user', messageText);
        testChatHistory.push({ role: 'user', content: messageText });
        testInput.value = '';
        testInput.disabled = true;
        testSendBtn.disabled = true;

        const currentAiConfig = getFormData();

        try {
            const response = await fetch(`/api/guilds/${guildId}/ai-test`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('dashboard-token')}`
                },
                body: JSON.stringify({
                    history: testChatHistory,
                    aiConfig: currentAiConfig
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to get AI response');
            }

            const data = await response.json();
            const botReply = data.reply;

            addMessageToChat('bot', botReply);
            testChatHistory.push({ role: 'assistant', content: botReply });

        } catch (error) {
            console.error('Error in AI test chat:', error);
            addMessageToChat('bot', `Error: ${error.message}`);
        } finally {
            testInput.disabled = false;
            testSendBtn.disabled = false;
            testInput.focus();
        }
    };

    testSendBtn.addEventListener('click', handleSendTestMessage);
    testInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleSendTestMessage();
        }
    });

    // --- Initial Load ---
    const channels = await fetchGuildChannels();
    populateChannelSelects(channels);
    const settings = await fetchAiSettings();
    populateForm(settings);
});