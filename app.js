const tg = window.Telegram?.WebApp;
let token = '';
let paymentMethod = 'crypto';
let discount = 0;
let recipientData = null;
let activeTab = 'buy';
let myUsername = '';
let usdRate = 0;

// Применяем цвета из Telegram WebApp
if (tg) {
    const colors = tg.themeParams;
    document.documentElement.style.setProperty('--tg-bg-color', colors.bg_color || '#17212b');
    document.documentElement.style.setProperty('--tg-text-color', colors.text_color || '#ffffff');
    document.documentElement.style.setProperty('--tg-hint-color', colors.hint_color || '#8b95a1');
    document.documentElement.style.setProperty('--tg-link-color', colors.link_color || '#3390ec');
    document.documentElement.style.setProperty('--tg-button-color', colors.button_color || '#3390ec');
    document.documentElement.style.setProperty('--tg-button-text-color', colors.button_text_color || '#ffffff');
    document.documentElement.style.setProperty('--tg-secondary-bg-color', colors.secondary_bg_color || '#232e3c');
}

if (!tg) {
    document.body.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; text-align: center; padding: 20px;">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-bottom: 20px; opacity: 0.5;">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="15" y1="9" x2="9" y2="15"></line>
                <line x1="9" y1="9" x2="15" y2="15"></line>
            </svg>
            <h2 style="margin-bottom: 10px;">Ошибка запуска</h2>
            <p style="color: var(--tg-hint-color);">Откройте приложение через Telegram</p>
        </div>
    `;
} else {
    tg.ready();
    tg.expand();
    
    const userId = tg.initDataUnsafe?.user?.id;
    myUsername = tg.initDataUnsafe?.user?.username || '';
    
    // Проверяем параметр tab в URL
    const urlParams = new URLSearchParams(window.location.search);
    const tabParam = urlParams.get('tab');
    if (tabParam === 'transactions') {
        activeTab = 'transactions';
    }
    
    if (!userId) {
        document.body.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; text-align: center; padding: 20px;">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-bottom: 20px; opacity: 0.5;">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                    <line x1="4" y1="4" x2="20" y2="20"></line>
                </svg>
                <h2 style="margin-bottom: 10px;">Ошибка авторизации</h2>
                <p style="color: var(--tg-hint-color);">Не удалось получить ID пользователя</p>
            </div>
        `;
    } else {
        fetch('/auth', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({user_id: userId})
        })
        .then(res => {
            if (!res.ok) throw new Error('Auth failed');
            return res.json();
        })
        .then(data => {
            token = data.token;
            updatePrice();
            // Инициализируем кнопки очистки
            toggleClearButton('recipient', 'clear-recipient');
            toggleClearButton('stars', 'clear-stars');
            toggleClearButton('promo', 'clear-promo');
            
            // Если нужно открыть транзакции, переключаемся
            if (activeTab === 'transactions') {
                switchTab('transactions');
            }
        })
        .catch(err => {
            console.error('Auth error:', err);
            tg.showAlert('Ошибка авторизации. Попробуйте перезапустить приложение.');
        });
    }
}

function setMyself() {
    if (myUsername) {
        document.getElementById('recipient').value = myUsername;
        document.getElementById('recipient').dispatchEvent(new Event('input'));
    } else {
        tg.showAlert('Username не найден в вашем профиле Telegram');
    }
}

function togglePromo() {
    const block = document.getElementById('promo-block');
    block.style.display = block.style.display === 'none' ? 'block' : 'none';
}

function showOrderDetail(orderId) {
    fetch(`/order/${orderId}`, {
        headers: {'Authorization': `Bearer ${token}`}
    })
    .then(res => {
        if (!res.ok) throw new Error('Failed to load order');
        return res.json();
    })
    .then(order => {
        const detail = document.getElementById('order-detail');
        
        const statusIcon = order.status === 'pending' 
            ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>'
            : order.status === 'completed'
            ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>'
            : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>';
        
        const statusText = order.status === 'pending' ? 'Ожидание оплаты' 
            : order.status === 'completed' ? 'Завершено' 
            : 'Отменено';
        
        detail.innerHTML = `
            <div class="order-card">
                <div class="order-status ${escapeHtml(order.status)}">
                    ${statusIcon}
                    <span>${statusText}</span>
                </div>
                <div class="order-info-row">
                    <span>Заказ:</span>
                    <span class="order-hash">${escapeHtml(order.order_id.substring(0, 16))}...</span>
                </div>
                <div class="order-info-row">
                    <span>Звезды:</span>
                    <span>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="vertical-align: middle; margin-right: 4px;">
                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                        </svg>
                        ${escapeHtml(order.stars.toString())}
                    </span>
                </div>
                <div class="order-info-row">
                    <span>Получатель:</span>
                    <span>@${escapeHtml(order.recipient)}</span>
                </div>
                <div class="order-info-row">
                    <span>Сумма:</span>
                    <span>${escapeHtml(order.total.toString())}₽</span>
                </div>
                <div class="order-info-row">
                    <span>Дата:</span>
                    <span>${escapeHtml(new Date(order.created_at).toLocaleString('ru'))}</span>
                </div>
            </div>
            <button class="buy-btn" onclick="switchTab('transactions')">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="19" y1="12" x2="5" y2="12"></line>
                    <polyline points="12 19 5 12 12 5"></polyline>
                </svg>
                Назад к транзакциям
            </button>
        `;
        switchTab('order-detail');
    })
    .catch(err => {
        tg.showAlert('Ошибка загрузки заказа');
        console.error(err);
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

let recipientTimeout = null;

// Управление кнопками очистки
function toggleClearButton(inputId, btnId) {
    const input = document.getElementById(inputId);
    const btn = document.getElementById(btnId);
    if (input && btn) {
        if (input.value.trim()) {
            btn.style.display = 'flex';
            btn.classList.add('visible');
        } else {
            btn.style.display = 'none';
            btn.classList.remove('visible');
        }
    }
}

function clearRecipient() {
    const input = document.getElementById('recipient');
    input.value = '';
    input.focus();
    document.getElementById('recipient-preview').style.display = 'none';
    recipientData = null;
    toggleClearButton('recipient', 'clear-recipient');
}

function clearStars() {
    const input = document.getElementById('stars');
    input.value = '50';
    input.focus();
    toggleClearButton('stars', 'clear-stars');
    updatePrice();
}

function clearPromo() {
    const input = document.getElementById('promo');
    input.value = '';
    input.focus();
    discount = 0;
    document.getElementById('discount-row').style.display = 'none';
    toggleClearButton('promo', 'clear-promo');
    updatePrice();
}

document.getElementById('recipient').addEventListener('input', (e) => {
    const username = e.target.value.replace('@', '').trim();
    
    // Показываем/скрываем кнопку очистки
    toggleClearButton('recipient', 'clear-recipient');
    
    // Очищаем предыдущий таймаут
    if (recipientTimeout) {
        clearTimeout(recipientTimeout);
    }
    
    if (username.length >= 3 && token) {
        // Показываем индикатор загрузки
        document.getElementById('recipient-preview').style.display = 'flex';
        document.getElementById('recipient-avatar').innerHTML = '<div class="loading"></div>';
        document.getElementById('recipient-name').textContent = 'Проверка...';
        document.getElementById('recipient-username').textContent = '';
        
        // Debounce: ждем 500ms после последнего ввода
        recipientTimeout = setTimeout(() => checkRecipient(username), 500);
    } else {
        document.getElementById('recipient-preview').style.display = 'none';
        recipientData = null;
    }
});

document.getElementById('stars').addEventListener('input', (e) => {
    toggleClearButton('stars', 'clear-stars');
    updatePrice();
});

document.getElementById('stars').addEventListener('input', (e) => {
    toggleClearButton('stars', 'clear-stars');
    updatePrice();
});

document.getElementById('stars').addEventListener('blur', (e) => {
    const val = parseInt(e.target.value) || 50;
    e.target.value = Math.max(50, Math.min(4999, val));
    toggleClearButton('stars', 'clear-stars');
    updatePrice();
});

document.getElementById('promo').addEventListener('input', (e) => {
    toggleClearButton('promo', 'clear-promo');
});

function switchTab(tab) {
    activeTab = tab;
    document.getElementById('buy-tab').style.display = tab === 'buy' ? 'block' : 'none';
    document.getElementById('transactions-tab').style.display = tab === 'transactions' ? 'block' : 'none';
    document.getElementById('order-detail-tab').style.display = tab === 'order-detail' ? 'block' : 'none';
    
    document.querySelectorAll('.tab-item').forEach((el, i) => {
        el.classList.toggle('active', (i === 0 && tab === 'buy') || (i === 1 && tab === 'transactions'));
    });
    
    if (tab === 'transactions') {
        loadTransactions();
    }
}

function loadTransactions() {
    fetch('/transactions', {
        headers: {'Authorization': `Bearer ${token}`}
    })
    .then(res => {
        if (!res.ok) throw new Error('Failed to load transactions');
        return res.json();
    })
    .then(data => {
        const list = document.getElementById('transactions-list');
        if (data.transactions.length === 0) {
            list.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">
                        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                        </svg>
                    </div>
                    <div>Нет транзакций</div>
                </div>
            `;
        } else {
            list.innerHTML = data.transactions.map(tx => {
                const statusText = tx.status === 'pending' ? 'Ожидание' 
                    : tx.status === 'completed' ? 'Завершено' 
                    : 'Отменено';
                
                return `
                    <div class="transaction-item" onclick="showOrderDetail('${escapeHtml(tx.order_id)}')">
                        <div class="transaction-header">
                            <span>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="vertical-align: middle; margin-right: 4px;">
                                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                                </svg>
                                ${escapeHtml(tx.stars.toString())} звезд
                            </span>
                            <span class="transaction-status ${escapeHtml(tx.status)}">
                                ${statusText}
                            </span>
                        </div>
                        <div class="transaction-details">
                            <div>Получатель: @${escapeHtml(tx.recipient)}</div>
                            <div>Сумма: ${escapeHtml(tx.total.toString())}₽</div>
                            <div>Дата: ${escapeHtml(new Date(tx.created_at).toLocaleString('ru'))}</div>
                        </div>
                    </div>
                `;
            }).join('');
        }
    })
    .catch(err => {
        const list = document.getElementById('transactions-list');
        list.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="15" y1="9" x2="9" y2="15"></line>
                        <line x1="9" y1="9" x2="15" y2="15"></line>
                    </svg>
                </div>
                <div>Ошибка загрузки транзакций</div>
            </div>
        `;
        console.error(err);
    });
}

function checkRecipient(username) {
    fetch(`/check-recipient?username=${encodeURIComponent(username)}`, {
        headers: {'Authorization': `Bearer ${token}`}
    })
    .then(res => {
        if (!res.ok) throw new Error('Failed to check recipient');
        return res.json();
    })
    .then(data => {
        if (data.valid) {
            recipientData = data;
            document.getElementById('recipient-name').textContent = data.name;
            document.getElementById('recipient-username').textContent = '@' + data.username;
            if (data.photo) {
                document.getElementById('recipient-avatar').innerHTML = `<img src="${escapeHtml(data.photo)}" alt="Avatar">`;
            } else {
                document.getElementById('recipient-avatar').innerHTML = `
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                        <circle cx="12" cy="7" r="4"></circle>
                    </svg>
                `;
            }
            document.getElementById('recipient-preview').style.display = 'flex';
        } else {
            document.getElementById('recipient-preview').style.display = 'none';
            recipientData = null;
        }
    })
    .catch(() => {
        document.getElementById('recipient-preview').style.display = 'none';
        recipientData = null;
    });
}

function selectPayment(method) {
    paymentMethod = method;
    document.getElementById('btn-crypto').classList.toggle('active', method === 'crypto');
    updatePrice();
}

function updatePrice() {
    const stars = parseInt(document.getElementById('stars').value) || 50;
    if (stars >= 50 && stars <= 4999 && token) {
        fetch(`/get-price?stars=${stars}`)
            .then(res => {
                if (!res.ok) throw new Error('Failed to get price');
                return res.json();
            })
            .then(data => {
                let price = data.price_rub;
                const total = price - discount;
                document.getElementById('total').textContent = total.toFixed(2) + '₽';
            })
            .catch(err => {
                console.error('Price update error:', err);
            });
    }
}

function applyPromo() {
    const promo = document.getElementById('promo').value.trim();
    
    if (!promo) {
        tg.showAlert('Введите промокод');
        return;
    }
    
    const promoBtn = document.querySelector('.promo-btn');
    const originalText = promoBtn.textContent;
    promoBtn.disabled = true;
    promoBtn.innerHTML = '<div class="loading"></div>';
    
    fetch(`/check-promo?code=${encodeURIComponent(promo)}`)
        .then(res => {
            if (!res.ok) throw new Error('Failed to check promo');
            return res.json();
        })
        .then(data => {
            if (data.valid) {
                discount = data.discount;
                document.getElementById('discount').textContent = '-' + discount.toFixed(2) + '₽';
                document.getElementById('discount-row').style.display = 'flex';
                tg.showAlert(`Промокод применен! Скидка ${discount}₽`);
                updatePrice();
                // Скрываем промокод блок после успешного применения
                document.getElementById('promo-block').style.display = 'none';
            } else {
                tg.showAlert('Промокод недействителен');
            }
        })
        .catch(err => {
            tg.showAlert('Ошибка проверки промокода');
            console.error(err);
        })
        .finally(() => {
            promoBtn.disabled = false;
            promoBtn.textContent = originalText;
        });
}

function handleBuy() {
    if (!recipientData) {
        tg.showAlert('Введите корректный username получателя');
        return;
    }
    
    const userId = tg.initDataUnsafe?.user?.id;
    const stars = parseInt(document.getElementById('stars').value);
    const promo = document.getElementById('promo').value;
    
    if (!userId) {
        tg.showAlert('Не удалось определить пользователя');
        return;
    }
    
    if (stars < 50 || stars > 4999) {
        tg.showAlert('Количество звезд должно быть от 50 до 4999');
        return;
    }
    
    // Блокируем кнопку и показываем лоадер
    const buyBtn = document.querySelector('.buy-btn');
    const originalHTML = buyBtn.innerHTML;
    buyBtn.disabled = true;
    buyBtn.innerHTML = `
        <div class="loading"></div>
        <span>Создание заказа...</span>
    `;
    
    fetch('/create-order', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
            user_id: userId,
            stars: stars,
            promo_code: promo,
            payment_method: paymentMethod,
            recipient: recipientData.recipient
        })
    })
    .then(res => {
        if (!res.ok) {
            return res.json().then(err => {
                throw new Error(err.detail || 'Ошибка создания заказа');
            });
        }
        return res.json();
    })
    .then(data => {
        if (data.payment_url) {
            window.location.href = data.payment_url;
        } else {
            throw new Error('Не получен URL оплаты');
        }
    })
    .catch(err => {
        tg.showAlert(err.message || 'Ошибка создания заказа');
        console.error(err);
        buyBtn.disabled = false;
        buyBtn.innerHTML = originalHTML;
    });
}
